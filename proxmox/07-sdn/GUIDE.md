# Guide — Mission 07: SDN

This is not a script to paste blindly — this is a live company cluster, and this mission's commands touch cluster-wide networking config. An SDN "Apply" reloads generated interface stanzas on every node, the same category of action the track safety contract calls out: run it inside an agreed window, same as a corosync change or a cluster-wide upgrade, especially your first Apply and any change to `vmbr-lab`'s own base config. Everything you build here — every zone, VNet, subnet, and firewall rule — is scoped to lab VMIDs and lab subnets, and Phase 7 has you remove all of it before you're done.

Conventions used throughout, carried forward from Mission 01 (and Missions 02-05's fleet pattern, if you've done them):

```
Resource pool                   : learning
VM ID range                     : 9000-9999
Golden template                  : VMID 9000, name tpl-ubuntu2404
Dedicated bridge                 : vmbr-lab (VLAN tag 100 used for plain lab traffic in earlier missions;
                                    lab VLAN range 100-110 reserved for this track)
Lab subnet (vmbr-lab base)       : 10.10.100.0/24, gateway 10.10.100.1
API token                        : learn@pve!tf
Tag on every object              : learning

New this mission:
VXLAN zone (Phase 3)             : labvxlan, VXLAN ID 10000, peers = every lab node's ring/mgmt IP
Phase 3 VNet + subnet            : vxvnet0, 10.20.0.0/24, gateway 10.20.0.1, DHCP range 10.20.0.100-10.20.0.200
Phase 3 test VMs                 : vnet-test-a (VMID 9701, pve1), vnet-test-b (VMID 9702, pve2)
VLAN zone (Phase 4)              : labvlan, bound to vmbr-lab
Tenant VNets / VLAN tags         : tenant-a (101), tenant-b (102), tenant-c (103)
Tenant subnets                   : 10.77.1.0/24, 10.77.2.0/24, 10.77.3.0/24 — gateway .1 in each, SNAT on
IPAM                             : pve plugin (built in, no extra service)
Tenant VMs                       : tenant-a 9711-9713 · tenant-b 9721-9723 · tenant-c 9731-9733
Allowed shared egress target     : 10.10.100.1 (the vmbr-lab gateway) — stands in for "an allowed lab service"
```

Every node is written as `pve1`, `pve2`, `pve3` below — substitute your cluster's real node names. Where a command needs a node's own IP (VXLAN peers, for instance), use the `ring0_addr` values from `/etc/pve/corosync.conf`, the same file Mission 06 had you read.

If you have Mission 03's Terraform module (`modules/pve-vm`) working, feel free to use it for every clone in this guide instead of raw `qm clone` — the commands below stick to plain `qm` so the SDN mechanics stay the focus.

---

## Phase 1 — SDN concepts: zones, VNets, subnets vs. classic bridges

You cannot debug what you don't have a model for, and SDN's UI throws four new nouns at you before you've created anything. Read this once, in full, before opening Datacenter → SDN.

**How every earlier mission did networking:** one bridge (`vmbr-lab`), defined identically in `/etc/network/interfaces` on every node, by hand, because that file lives on local disk and is not cluster-replicated. VLAN separation, where you needed it, meant a tag on the VM's NIC config or a `vmbrX.<tag>` sub-interface — again, repeated per node. There was no built-in address tracking: you picked IPs and wrote them down (or into cloud-init), and if two people picked the same one, nothing stopped them. This works fine for one flat lab network. It does not scale to "three separate tenant networks, each spanning every node, each with tracked IP allocation" without you hand-maintaining a lot of near-identical config across every node and hoping you never let it drift.

**What SDN adds is a layer of config that lives under `/etc/pve/sdn/`** — `zones.cfg`, `vnets.cfg`, `subnets.cfg`, `ipams.cfg`, `controllers.cfg`. Because that directory is inside `/etc/pve`, it's `pmxcfs`-backed — the same cluster-replicated filesystem Mission 01 introduced — so every zone and VNet you define is visible on every node the instant you save it, with no manual copying. Three objects matter for this mission:

- **Zone** — a technology and a scope, not a network by itself. It answers "how is isolation and cross-node reachability actually achieved here." The zone types you'll meet: `Simple` (an isolated bridge, traffic stays local to the node it's on — no cross-node reach at all), `VLAN` (802.1Q tags carried over an existing VLAN-aware Linux bridge — cross-node reach depends entirely on that bridge existing, and being VLAN-aware, on every node), `QinQ` (double-tagged VLANs, for nesting inside a provider's own VLAN), `VXLAN` (UDP-encapsulated L2 overlay between nodes that merely have IP reachability to each other — no VLAN-aware bridge, no trunk needed), and `EVPN` (VXLAN's data plane plus a BGP control plane, for routed multi-tenant setups at a scale this mission doesn't need). A zone is a template every VNet inside it inherits.
- **VNet** — the object a VM's NIC actually attaches to, the way it attaches to `vmbr-lab` today. What a VNet *is* on the wire depends entirely on its zone: inside a VLAN zone, a VNet is a tag; inside a VXLAN zone, a VNet is a VXLAN ID (VNI).
- **Subnet** — an IP range hung off a VNet, optionally carrying a gateway, a DHCP range, and a SNAT flag. This is the object that turns "a network" into "a network with addresses," and it's what the IPAM plugin actually tracks.

**IPAM** is the address bookkeeper: it records which IP is allocated to which VM/MAC inside a given subnet, so Proxmox itself refuses to double-assign an address. The default plugin, `pve`, is built into `pmxcfs` — no extra service, no extra credentials. Larger shops wire SDN to an external IPAM (phpIPAM, NetBox); this mission uses the built-in one throughout.

**The honest caveat:** SDN's cross-node magic still bottoms out in the same primitives Mission 01 had you touch by hand — per-node interface stanzas, and for VXLAN/EVPN, tunnel and (optionally) routing daemon state. SDN's real value isn't a new data plane; it's a single source of truth in `/etc/pve/sdn/` that *generates* every node's derived config consistently, instead of you maintaining N nearly-identical files and hoping they never drift apart.

**Checkpoint:** without looking back at this page, explain in your own words the difference between a zone, a VNet, and a subnet, and state which zone type you'd reach for if you needed cross-node reachability with no VLAN-aware bridge and no shared trunk available. (If your answer is "VXLAN," you've got it — that's exactly what Phase 3 builds.)

---

## Phase 2 — enabling SDN

SDN's backend ships as part of `pve-manager` on any reasonably current Proxmox VE install, but two things around it are worth confirming before you touch the UI, plus the DHCP plugin Phase 3 needs.

**[ANY-NODE]** — confirm the packages SDN depends on:

```bash
dpkg -l | grep -E "ifupdown2|libpve-network-perl|dnsmasq"
```

Expected output: `ifupdown2` shows `ii` (installed) — you already depend on it for the live `ifreload -a` reloads Mission 01 used. `libpve-network-perl` shows `ii` too; it ships with `pve-manager` and is what actually backs the SDN API and GUI — if it's missing here, run `apt update && apt install -y libpve-network-perl` and re-check. `dnsmasq` may not be installed yet.

**[EACH-NODE]** — install `dnsmasq` (Phase 3's DHCP needs it available on every node a DHCP-serving VNet might land on), then immediately disable its system-wide unit:

```bash
apt update && apt install -y dnsmasq
systemctl disable --now dnsmasq
```

Expected output: apt's install log ending `Setting up dnsmasq (...)`, then no error from `disable --now`. Confirm:

```bash
systemctl status dnsmasq
```

Expected output: `Active: inactive (dead)`. This matters: SDN's `dnsmasq` plugin spawns its own per-subnet `dnsmasq` process, bound only to that subnet's interface — it is not the same thing as the system-wide `dnsmasq.service`. Leaving the system unit enabled would fight SDN's own instances for port 67, so it stays disabled on every node from here on; SDN starts and stops its own copies as zones are applied and removed.

**[EACH-NODE]** — confirm the sourcing line that makes SDN's generated config actually load:

```bash
tail -n 5 /etc/network/interfaces
```

Expected output: the last non-comment line reads `source /etc/network/interfaces.d/*`. This is normally present by default on current Proxmox installs — confirm it rather than assume it. If it's missing on any node:

```bash
echo "source /etc/network/interfaces.d/*" | sudo tee -a /etc/network/interfaces
```

Every time you click **Apply** in the SDN UI (or run the CLI equivalent in later phases), Proxmox regenerates a single file, `/etc/network/interfaces.d/sdn`, on every affected node, containing the derived interface stanzas for every zone and VNet you've configured. This line is what makes that generated file actually take effect — without it, your zones and VNets would exist in `/etc/pve/sdn/` but never materialize as real interfaces on the wire.

**Tour the UI** — open **Datacenter → SDN** in the web console. You'll see five entries: **Zones**, **VNets** (with **Subnets** nested under each VNet you create), **IPAM**, **Controllers** (BGP/EVPN control-plane config — unused in this mission), and **Options** (cluster-wide SDN defaults). Note the **Apply** button pinned to the top of this whole section — it applies *every* pending change across all of Zones/VNets/Subnets/IPAM at once, which is exactly what Phase 6 unpacks in detail.

**Checkpoint:** `dpkg -l` confirms `ifupdown2` and `libpve-network-perl` installed on every node, `dnsmasq` installed but its system unit `inactive (dead)` on every node, `source /etc/network/interfaces.d/*` present in `/etc/network/interfaces` on every node, and the Datacenter → SDN menu is visible in the web UI with Zones/VNets/IPAM/Controllers/Options all present.

---

## Phase 3 — a simple zone first: VXLAN, DHCP, cross-node ping

Start with the zone type that gets you real cross-node reachability with the least physical prerequisite — a VXLAN zone needs nothing from the underlying network except plain IP connectivity between nodes, which your cluster already has by definition. No VLAN-aware bridge, no trunk, no switch config to get right first. That's what "simple" means here: simplest path to something that actually spans nodes.

**[ANY-NODE]** — create the zone, giving it every lab node's `ring0_addr` as a peer (from `/etc/pve/corosync.conf`, same file Mission 06 read):

```bash
pvesh create /cluster/sdn/zones --zone labvxlan --type vxlan --peers 10.10.10.11,10.10.10.12,10.10.10.13 --dhcp dnsmasq
```

Expected output: no output on success. `--peers` is the list of node IPs that will encapsulate traffic to each other over UDP — it does not have to be every cluster node, only the ones you want this zone's VNets available on. `--dhcp dnsmasq` is the zone-level setting that tells every VNet under this zone it's allowed to spawn a `dnsmasq` instance for any subnet that defines a DHCP range — without this flag set here, at the zone, a subnet's DHCP range is inert no matter how you configure it (this is exactly what break-fix drill 1 below trains you to recognize).

**[ANY-NODE]** — the VNet and its subnet:

```bash
pvesh create /cluster/sdn/vnets --vnet vxvnet0 --zone labvxlan
pvesh create /cluster/sdn/vnets/vxvnet0/subnets --subnet 10.20.0.0/24 --type subnet --gateway 10.20.0.1 --dhcp-range start-address=10.20.0.100,end-address=10.20.0.200
```

Expected output: no output on success from either command. (Exact flag names have shifted slightly release to release — if either command errors on an unknown option, run `pvesh usage /cluster/sdn/vnets/{vnet}/subnets create` to see your version's current option list; the shape above matches current PVE 8.x.)

**[ANY-NODE]** — apply:

```bash
pvesh set /cluster/sdn
```

Expected output: no output on success, and within a few seconds `ip addr show vxvnet0` on any node in the peer list shows the interface up with `10.20.0.1/24`.

**Two test VMs, on different nodes**, cloned from the golden template:

```bash
qm clone 9000 9701 --name vnet-test-a --pool learning --full 1
qm set 9701 --net0 virtio,bridge=vxvnet0
qm set 9701 --tags learning,sdn-lab
qm start 9701
```

```bash
qm clone 9000 9702 --name vnet-test-b --pool learning --full 1 --target pve2
qm set 9702 --net0 virtio,bridge=vxvnet0
qm set 9702 --tags learning,sdn-lab
qm start 9702
```

Expected output: both clones report success, both VMs start. `--target pve2` on the second clone is what lands it on a different physical node from the first — adjust to your own second node's name.

**[ANY-NODE]** — confirm both picked up a DHCP lease from the zone's `dnsmasq`, then ping across:

```bash
qm guest cmd 9701 network-get-interfaces
qm guest cmd 9702 network-get-interfaces
```

Expected output: each shows a `10.20.0.1xx` address on its main interface (qemu-guest-agent must be running inside the VM for this to work — Mission 02's template already bakes it in). Then, from a console or SSH session on `9701`:

```bash
ping -c 4 <9702's 10.20.0.x address>
```

Expected output: 4 packets transmitted, 4 received, 0% packet loss.

**Checkpoint:** both VMs received a `10.20.0.0/24` lease from `vxvnet0`'s own `dnsmasq` instance (not a lease from anything else on your network), and a ping between them succeeds despite the two VMs running on physically different nodes — proving VXLAN encapsulation is genuinely carrying L2 frames over the underlay network between hosts, not just switching packets within one node's kernel.

---

## Phase 4 — a VLAN zone on `vmbr-lab`: three tenants, IPAM, SNAT

Now the zone type that reuses `vmbr-lab` itself rather than building a fresh overlay: a VLAN zone tags VNets onto an existing bridge, so its cross-node reach depends entirely on that bridge being present *and VLAN-aware* on every node — a prerequisite VXLAN never needed.

**[EACH-NODE]** — make `vmbr-lab` VLAN-aware. This is a manual edit to `/etc/network/interfaces` (local, per-node, **not** replicated by `pmxcfs` — unlike everything in Phase 3, you must repeat this on every single node yourself):

```bash
grep -A5 "^iface vmbr-lab" /etc/network/interfaces
```

Expected output: your existing Mission 01 stanza, something like:

```
iface vmbr-lab inet manual
	bridge-ports none
	bridge-stp off
	bridge-fd 0
```

Edit it to add two lines (`bridge-vlan-aware yes`, and `bridge-vids` covering the lab's reserved tag range):

```bash
sudo sed -i '/^iface vmbr-lab inet manual/,/bridge-fd 0/{/bridge-fd 0/a\	bridge-vlan-aware yes\n	bridge-vids 100-110
}' /etc/network/interfaces
sudo ifreload -a
```

Expected output: no error from `ifreload`. Confirm:

```bash
bridge vlan show dev vmbr-lab
```

Expected output: a table listing VLAN IDs `100-110` as allowed on `vmbr-lab`. **Do this on every node before continuing** — a VLAN zone's cross-node reachability depends on every node's copy of this bridge agreeing, and this is exactly the gap break-fix drill 2 below puts you in front of.

**[ANY-NODE]** — the zone, bound to `vmbr-lab`:

```bash
pvesh create /cluster/sdn/zones --zone labvlan --type vlan --bridge vmbr-lab --exitnodes pve1
```

Expected output: no output on success. `--exitnodes pve1` designates the node where each subnet's gateway/SNAT actually materializes — pick any lab node; the choice matters for Phase 5's egress test but not for correctness here.

**[ANY-NODE]** — three tenant VNets, one VLAN tag each, from the lab's reserved 100-110 range (100 stays reserved for plain lab traffic per Mission 01/02/03):

```bash
pvesh create /cluster/sdn/vnets --vnet tenanta --zone labvlan --tag 101
pvesh create /cluster/sdn/vnets --vnet tenantb --zone labvlan --tag 102
pvesh create /cluster/sdn/vnets --vnet tenantc --zone labvlan --tag 103
```

**[ANY-NODE]** — a subnet per tenant, gateway plus SNAT enabled so each tenant can reach out through the exit node:

```bash
pvesh create /cluster/sdn/vnets/tenanta/subnets --subnet 10.77.1.0/24 --type subnet --gateway 10.77.1.1 --snat 1
pvesh create /cluster/sdn/vnets/tenantb/subnets --subnet 10.77.2.0/24 --type subnet --gateway 10.77.2.1 --snat 1
pvesh create /cluster/sdn/vnets/tenantc/subnets --subnet 10.77.3.0/24 --type subnet --gateway 10.77.3.1 --snat 1
```

Expected output: no output on success from any command above. Apply:

```bash
pvesh set /cluster/sdn
```

**Checkpoint — IPAM in active use:**

```bash
pvesh get /cluster/sdn/vnets/tenanta/subnets/10.77.1.0-24
```

Expected output: a JSON object showing the subnet with `gateway: 10.77.1.1` and `snat: 1`. Open **Datacenter → SDN → IPAM → pve** in the GUI as well — you should see each of the three subnets listed with their gateway address already allocated by the `pve` IPAM plugin, before you've created a single tenant VM. That's the difference this phase is demonstrating: the gateway address wasn't typed into a cloud-init file by you, it was allocated and tracked by SDN's own IPAM the moment the subnet was created.

**Nine tenant VMs**, three per tenant, spread across nodes, cloned from the golden template:

```bash
for id in 9711 9712 9713; do
  qm clone 9000 $id --name tenant-a-${id: -1} --pool learning --full 1
  qm set $id --net0 virtio,bridge=tenanta --tags learning,sdn-lab,tenant-a
  qm start $id
done
```

Repeat the same pattern for `tenantb` with VMIDs `9721 9722 9723` (bridge `tenantb`, tag `tenant-b`), and for `tenantc` with VMIDs `9731 9732 9733` (bridge `tenantc`, tag `tenant-c`). Spread each tenant's three VMs across at least two different nodes — pass `--target pve2` (or `pve3`) on at least one clone per tenant, the same way Phase 3 did.

Expected output: nine successful clones and starts. Confirm addressing:

```bash
qm guest cmd 9711 network-get-interfaces
```

Expected output: a `10.77.1.x` address, DHCP-leased the same way Phase 3's VMs were.

**Checkpoint:** three tenant VNets exist on the `labvlan` zone with tags 101/102/103; each has a subnet with a gateway visible in `Datacenter → SDN → IPAM → pve`; SNAT is enabled on all three; nine VMs are running, three per tenant, each tenant's three VMs spread across more than one node, each VM holding a DHCP lease in its own tenant's subnet; and a VM in any tenant can ping its own gateway and reach `10.10.100.1` (the shared lab egress target) through SNAT.

---

## Phase 5 — isolation proof

Here's the part that surprises people: creating three separate VLAN-tagged VNets does **not**, by itself, stop them from reaching each other. All three subnets share the same `--exitnodes pve1`, which means the kernel on `pve1` has a normal IP route to all three subnets at once — nothing about VLAN tagging prevents `pve1` from happily routing between them, the same way any router with two interfaces routes between the networks on each. Prove this before you fix it.

**[from a tenant-a VM, e.g. 9711]** — scan tenant-b's subnet before any firewall rule exists:

```bash
nmap -sn 10.77.2.0/24
```

Expected output (before isolation): multiple hosts reported `Host is up` — tenant-a can currently see tenant-b in full. This is the gap you're about to close.

**Enable the firewall on each tenant VNet** and add explicit cross-tenant DROP rules — **Datacenter → SDN → VNets → tenanta → Firewall** tab, enable the firewall toggle, then add a rule:

```
Direction: out    Action: DROP    Dest: 10.77.2.0/24,10.77.3.0/24
```

Repeat on `tenantb`'s firewall tab (`DROP` toward `10.77.1.0/24,10.77.3.0/24`) and `tenantc`'s (`DROP` toward `10.77.1.0/24,10.77.2.0/24`). Equivalent CLI form, run once per VNet:

```bash
pvesh create /cluster/sdn/vnets/tenanta/firewall/rules --type out --action DROP --dest 10.77.2.0/24,10.77.3.0/24 --enable 1
pvesh create /cluster/sdn/vnets/tenantb/firewall/rules --type out --action DROP --dest 10.77.1.0/24,10.77.3.0/24 --enable 1
pvesh create /cluster/sdn/vnets/tenantc/firewall/rules --type out --action DROP --dest 10.77.1.0/24,10.77.2.0/24 --enable 1
pvesh set /cluster/sdn
```

**This is the point worth internalizing:** the firewall rule that provides isolation lives on the VNet itself, not on the zone and not on individual VMs. That's deliberate — a VNet's firewall applies to every VM plugged into it uniformly, so a new VM added to `tenanta` next month inherits the same isolation automatically, without anyone remembering to configure it per-VM.

**[from the same tenant-a VM]** — re-scan:

```bash
nmap -sn 10.77.2.0/24
nmap -sn 10.77.3.0/24
```

Expected output: 0 hosts reported up on either subnet — the DROP rule is blocking the traffic that previously succeeded.

**[from the same VM]** — confirm egress still works:

```bash
ping -c 4 10.10.100.1
```

Expected output: 4 packets transmitted, 4 received, 0% loss. Your DROP rules named specific tenant subnets as destinations — everything else, including the shared lab segment, is untouched.

**Checkpoint:** an `nmap -sn` sweep from any tenant's VM against either other tenant's subnet shows 0 hosts up, the same VM still reaches `10.10.100.1` (the shared egress target) without loss, and you can explain — without re-reading this page — why the VLAN tagging and separate subnets alone did not provide this isolation, and what specifically closed the gap.

---

## Phase 6 — apply-config mechanics

Every change you made in Phases 3-5 sat as a **pending** change until you ran `pvesh set /cluster/sdn` (or clicked **Apply** in the GUI) — worth understanding exactly what that button does before you rely on it.

**The pending-changes model:** `/etc/pve/sdn/*.cfg` actually holds two states at once — a "running" config (what's currently applied to the network) and a "pending" config (what you've edited but not yet applied). The SDN UI shows this directly: any object with unsaved changes is highlighted, and a **Reload** vs. the object's real state is visible before you Apply. This exists so you can stage several related changes — a new zone, three VNets, three subnets — and commit them together in one Apply, rather than triggering a network reload after every single `pvesh create`.

**What "Apply" actually does:** it regenerates a single file, `/etc/network/interfaces.d/sdn`, from scratch on every affected node, containing every zone's and VNet's derived interface stanzas, then triggers the equivalent of `ifreload -a` on each of those nodes to make the new stanzas live — the exact mechanism Mission 01 had you use directly. It also starts, stops, or reconfigures any per-subnet `dnsmasq` processes a DHCP-enabled subnet needs, and (for EVPN zones, not used in this mission) reloads FRR's BGP config. Nothing about this is incremental — the generated file is a full rewrite of the current desired state, not a diff or a patch.

**Rollback, given the above, is simple and has exactly one form:** remove the offending zone/VNet/subnet/firewall-rule entry from the SDN config, then Apply again. There is no separate "undo" or version history to step back through — the regenerated file always reflects whatever is currently defined in `/etc/pve/sdn/*.cfg`, so removing an object and re-applying produces the same result as if that object had never existed.

**Checkpoint:** you can explain, in your own words, the difference between an SDN object's "pending" and "running" state, what file gets rewritten on every Apply and by what mechanism it takes effect, and why "delete the object, then Apply" is the entire rollback procedure — there is nothing else to it.

---

## Phase 7 — teardown cleanliness

Leave the cluster's SDN state exactly as Mission 01 left it — this mission's zones, VNets, subnets, and firewall rules are lab-scoped and temporary; `vmbr-lab` itself, including the `bridge-vlan-aware` flag you added in Phase 4, is a durable track fixture that stays in place for future missions, the same way Mission 01's own safety doc calls out that `vmbr-lab`'s base config is "long-lived and not torn down between missions."

**[ANY-NODE]** — stop and remove every VM created in this mission:

```bash
for id in 9701 9702 9711 9712 9713 9721 9722 9723 9731 9732 9733; do
  qm stop $id --skiplock 1 2>/dev/null
  qm destroy $id --purge 1
done
```

Expected output: each VM reports stopped then destroyed, no errors. Confirm nothing lab-related remains:

```bash
qm list | grep -E "970[12]|97[123][123]"
```

Expected output: no rows returned.

**[ANY-NODE]** — remove firewall rules, subnets, VNets, then zones, in that order (children before parents — the API refuses to delete a zone that still has VNets, or a VNet that still has subnets):

```bash
pvesh delete /cluster/sdn/vnets/tenanta/firewall/rules/0
pvesh delete /cluster/sdn/vnets/tenantb/firewall/rules/0
pvesh delete /cluster/sdn/vnets/tenantc/firewall/rules/0

pvesh delete /cluster/sdn/vnets/tenanta/subnets/10.77.1.0-24
pvesh delete /cluster/sdn/vnets/tenantb/subnets/10.77.2.0-24
pvesh delete /cluster/sdn/vnets/tenantc/subnets/10.77.3.0-24
pvesh delete /cluster/sdn/vnets/vxvnet0/subnets/10.20.0.0-24

pvesh delete /cluster/sdn/vnets/tenanta
pvesh delete /cluster/sdn/vnets/tenantb
pvesh delete /cluster/sdn/vnets/tenantc
pvesh delete /cluster/sdn/vnets/vxvnet0

pvesh delete /cluster/sdn/zones/labvlan
pvesh delete /cluster/sdn/zones/labvxlan

pvesh set /cluster/sdn
```

Expected output: no output on success from any delete; the final `pvesh set /cluster/sdn` applies the removals and regenerates `/etc/network/interfaces.d/sdn` without any of this mission's stanzas in it.

**Checkpoint:**

```bash
pvesh get /cluster/sdn/zones
pvesh get /cluster/sdn/vnets
cat /etc/network/interfaces.d/sdn
```

Expected output: `zones` and `vnets` return only whatever existed before this mission (empty, if this was your first SDN work), and `/etc/network/interfaces.d/sdn` no longer contains `labvxlan`, `labvlan`, `vxvnet0`, `tenanta`, `tenantb`, or `tenantc` anywhere. `vmbr-lab` itself, still `bridge-vlan-aware` with `bridge-vids 100-110`, remains untouched on every node — that part is a lasting fixture, not lab debris, exactly as Mission 01's rollback plan for network missions describes.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with what the phases above taught you, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — a VNet is up but no DHCP leases are handed out

Setup: create a fresh test VNet + subnet with a DHCP range defined (same shape as Phase 3's `vxvnet0`), but on a zone where you deliberately leave the zone-level DHCP plugin unset (don't pass `--dhcp dnsmasq` when creating the zone, or unset it on an existing zone via `pvesh set`). Apply. Attach a test VM to the new VNet and boot it.

Expected symptom: the VNet's interface comes up fine on every node, the gateway responds to ping, but the VM never receives a DHCP lease — it boots with no address (or falls back to whatever its own OS defaults to without DHCP).

<details>
<summary>Hint</summary>

DHCP in Proxmox SDN is a two-level setting and both levels have to agree: the subnet defines *where* the address range is, but whether a `dnsmasq` process is spawned for that subnet at all is controlled by the zone's own DHCP plugin field. A subnet with a perfectly valid DHCP range, sitting inside a zone with no DHCP plugin selected, will never spawn anything to actually answer DHCP requests — the range just sits there as unused metadata. Check `pvesh get /cluster/sdn/zones/<zone>` and compare its `dhcp` field against what Phase 3 set, then decide what needs to change and re-apply.

</details>

### Drill 2 — a cross-node VNet is dead

Setup: on a VLAN zone (same shape as Phase 4's `labvlan`), pick one node and deliberately revert its `vmbr-lab` stanza to the pre-Phase-4 state — remove `bridge-vlan-aware yes` and `bridge-vids 100-110` from `/etc/network/interfaces` on that one node only, then `ifreload -a` on that node. Leave every other node untouched. Start a tenant VM on the reverted node.

Expected symptom: tenant VMs on unaffected nodes can still ping each other fine; a VM on the reverted node cannot reach anything in its own tenant subnet, including VMs on other nodes — it behaves as if it's on an entirely different, disconnected network.

<details>
<summary>Hint</summary>

Remember which file this lives in and how it propagates (Phase 4 called this out directly): `/etc/network/interfaces` is local to each node, not replicated by `pmxcfs` the way `/etc/pve/sdn/*.cfg` is. A VLAN zone's cross-node reachability is not one shared property of the zone — it's a property of *each node's own bridge* agreeing to tag and pass the VLAN correctly. `bridge vlan show dev vmbr-lab`, run on the affected node specifically (not from a different node — that command only ever reports local bridge state), tells you immediately whether that node's copy of the config actually matches the others. Fix it the same way Phase 4 built it in the first place, on that one node.

</details>

### Drill 3 — applying SDN config wiped a manual bridge tweak

Setup: open `/etc/network/interfaces.d/sdn` directly on any node (the file Phase 2 and Phase 6 discussed) and hand-add a small, harmless stanza of your own inside it — anything recognizable, like a comment line plus a dummy `iface` block for an interface name that doesn't exist elsewhere. Save it. Then make any real SDN change (add a throwaway test VNet, for instance) and Apply.

Expected symptom: your hand-added stanza is simply gone after the Apply — not merged with, not preserved alongside, the newly generated content. It's as if you never made the edit.

<details>
<summary>Hint</summary>

Go back to what Phase 6 said Apply actually does to that specific file, in exact terms — "regenerates," not "updates" or "appends to." Anything you put inside a file that a system treats as fully owned, generated output gets treated exactly like build output in any other context: it is not a place for hand customization, because the next build (Apply) doesn't know your addition exists and has no reason to preserve it. Contrast this with where Phase 4's `bridge-vlan-aware` change lives — a different file, for a reason. Explain, concretely, which file is safe for a manual, persistent tweak and which one never is, and why the boundary falls exactly where it does.

</details>

---

## Prove-it: three tenants, three VMs each, a scripted isolation matrix

You already have the fleet from Phase 4 — three tenants, three VMs each (9711-9713, 9721-9723, 9731-9733), plus the firewall rules from Phase 5. Formalize the isolation proof into a script you run once, producing a pass/fail table for every tenant pair plus the shared egress target.

**[from your workstation or any lab VM with nmap and SSH access into the fleet]** — save and run:

```bash
#!/usr/bin/env bash
set -uo pipefail

declare -A TENANT_VM=( [a]=9711 [b]=9721 [c]=9731 )
declare -A TENANT_NET=( [a]=10.77.1.0/24 [b]=10.77.2.0/24 [c]=10.77.3.0/24 )
EGRESS=10.10.100.1

printf "%-10s %-10s %-10s\n" "from" "to" "result"
for src in a b c; do
  src_vmid=${TENANT_VM[$src]}
  for dst in a b c; do
    if [ "$src" = "$dst" ]; then continue; fi
    up=$(qm guest exec "$src_vmid" -- nmap -sn "${TENANT_NET[$dst]}" 2>/dev/null | grep -c "Host is up")
    if [ "$up" -eq 0 ]; then result="PASS (blocked)"; else result="FAIL (reachable)"; fi
    printf "%-10s %-10s %-10s\n" "tenant-$src" "tenant-$dst" "$result"
  done
  reach=$(qm guest exec "$src_vmid" -- ping -c 2 -W 2 "$EGRESS" 2>/dev/null | grep -c "bytes from")
  if [ "$reach" -gt 0 ]; then egress_result="PASS (reachable)"; else egress_result="FAIL (blocked)"; fi
  printf "%-10s %-10s %-10s\n" "tenant-$src" "egress" "$egress_result"
done
```

Expected output: a table with six cross-tenant rows all reading `PASS (blocked)` and three egress rows all reading `PASS (reachable)` — nine rows total, all passing. (`qm guest exec` requires qemu-guest-agent inside each VM, already baked into the golden template since Mission 02; adjust the `nmap`/`ping` invocation to however you normally shell into the fleet if you're not using guest-exec.)

This script, and its all-pass output, is the deliverable — save both.

---

## Done when

- [ ] You can explain zone vs. VNet vs. subnet in your own words, and state which zone type gives cross-node reach with no VLAN-aware bridge required
- [ ] `dnsmasq` is installed on every node with its system-wide unit disabled, and `source /etc/network/interfaces.d/*` is confirmed present on every node
- [ ] The `labvxlan` VXLAN zone and `vxvnet0` VNet/subnet exist, and two VMs on different nodes proved a cross-node ping succeeds over DHCP-leased addresses
- [ ] `vmbr-lab` is `bridge-vlan-aware` with `bridge-vids 100-110` on every node, confirmed individually per node (not assumed from one)
- [ ] Three tenant VNets (`tenanta`/`tenantb`/`tenantc`) exist on the `labvlan` zone with tags 101/102/103, each with a subnet whose gateway is visible in `Datacenter → SDN → IPAM → pve`, SNAT enabled on all three
- [ ] Nine tenant VMs running, three per tenant, each tenant's VMs spread across more than one node, each holding a DHCP-leased address in its own tenant's subnet
- [ ] An `nmap -sn` sweep from any tenant against any other tenant's subnet shows 0 hosts up, while the same VM still reaches the shared egress target (`10.10.100.1`)
- [ ] You can explain why VLAN separation alone didn't provide isolation, and what the VNet-level firewall rule specifically closed
- [ ] You can explain the pending/running config model, what file Apply rewrites and how, and why "remove the object, Apply again" is the entire rollback procedure
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork, before opening the hints
- [ ] Prove-it: the scripted nmap isolation matrix ran for real, produced a full pass/fail table for all three tenants against each other and against egress, and every row passed
- [ ] Phase 7 teardown complete: every VM, firewall rule, subnet, VNet, and zone created in this mission removed and confirmed gone; `vmbr-lab`'s durable VLAN-aware config left in place, untouched
