# Guide — Mission 01: Recon + Safety Rails

Read this before you touch anything. You have full admin on a real company Proxmox cluster. That means every command in this guide is capable of affecting hardware, VMs, and services that other people depend on. This mission's entire purpose is to build a fenced-off area — the `learning` pool, the `vmbr-lab` network, a least-privilege API token — so that every mission after this one operates only inside that fence. Nothing here is a drill. Read each command before you run it, and if a command's blast radius is unclear to you, stop and ask before running it.

**Safety-contract values used throughout this mission and every mission after it (from `proxmox/README.md` — copy these exactly, do not improvise variants):**

```
Resource pool (all learning objects)  : learning
VM ID range (learning objects only)   : 9000-9999
Dedicated bridge                      : vmbr-lab
API token user (least-privilege)      : learn@pve!tf
Tag on every learning object           : learning
```

Every command below states which machine it runs on: **[ANY-NODE]** means it can be run from any one cluster node (cluster-wide commands only need to run once), **[EACH-NODE]** means run it separately on every node in the cluster, **[WORKSTATION]** means your own PC, not the cluster.

---

## Phase 1 — Cluster inventory

You cannot build safe guardrails around a system you don't understand yet. This phase is pure observation — no command in this phase changes anything.

**[ANY-NODE]** — cluster membership and quorum state:

```bash
pvecm status
```

Expected output: a `Cluster information` block showing the cluster name and node count, a `Quorum information` block ending in `Quorate: Yes`, and a `Membership information` table listing every node with its Node ID and vote. Record the cluster name, node count, and every node's name and Node ID — you will need the full node list again in Phase 6.

**[ANY-NODE]** — package and version inventory:

```bash
pveversion -v
```

Expected output: a multi-line list starting with `proxmox-ve:` and `pve-manager:`, followed by every related package (`pve-kernel-*`, `qemu-server`, `corosync`, `ceph` if installed, etc.) with version numbers. Record the `pve-manager` version — it tells you which API and CLI syntax applies for the rest of this track.

**[EACH-NODE]** — storage inventory:

```bash
pvesm status
```

Expected output: a table with columns `Name`, `Type`, `Status`, `Total`, `Used`, `Available`, `%`. Run this on every node — storage can be node-local (`dir`, `lvm`, `zfspool`) or cluster-shared (`nfs`, `cifs`, `ceph`, `pbs`). Record which storages are shared across all nodes and which are node-local; you'll need this distinction in Phase 4 and Phase 6.

**[EACH-NODE]** — network configuration:

```bash
cat /etc/network/interfaces
```

Expected output: the node's bridge/bond/VLAN configuration — at minimum a management bridge (commonly `vmbr0`) with an IP address, and possibly additional bridges, bonds, or VLAN sub-interfaces. Record, per node: every bridge name, whether it carries an IP, which physical NIC(s) it rides on, and whether any VLAN tagging is already configured.

**[EACH-NODE]** — existing VM and container census:

```bash
qm list
pct list
```

Expected output: `qm list` gives a table of `VMID`, `NAME`, `STATUS`, `MEM(MB)`, `BOOTDISK(GB)`, `PID` for QEMU VMs; `pct list` gives `VMID`, `Status`, `Lock`, `Name` for LXC containers. Run both on every node. Record every VMID, name, and node it lives on — this list becomes the seed of your never-touch list in Phase 6.

**Inventory doc template** — create this file now (any path outside the cluster's config, e.g. your own notes repo or `~/proxmox-mission-01-inventory.md`) and record what you found above:

```markdown
# Proxmox Cluster Inventory — <cluster name>

## Cluster
- Cluster name:
- Node count:
- Nodes (name / Node ID / current role):
- pve-manager version:
- Quorum status at time of recon:

## Storage (per node)
- Node <name>:
  - Storage name / type / shared or local / total / used:

## Network (per node)
- Node <name>:
  - Bridges (name / physical NIC / IP / VLAN tags present):

## Existing VMs and Containers (cluster-wide)
- VMID / Name / Node / Status / Notes (owner, purpose, if known):
```

Fill every row you found above into this doc. This is not busywork — Phase 6's never-touch list is built directly from the VM/CT census and network sections here.

**Checkpoint:** your inventory doc has a non-empty entry for every node's storage, every node's network bridges, and every existing VM/CT on the cluster. Do not continue to Phase 2 until the VM/CT census section lists something for every node that has one — an empty census on a node that actually has VMs means you missed a node, not that the node is empty.

---

## Phase 2 — Understand pmxcfs before you touch it

`/etc/pve` is not a normal directory on local disk. It's a FUSE-mounted filesystem backed by `pmxcfs` (the Proxmox Cluster File System), which stores its data in a local SQLite database (`/var/lib/pve-cluster/config.db`) and replicates every write to all other nodes in real time over corosync. When you edit a file under `/etc/pve` on one node — `qemu-server/<vmid>.conf`, `storage.cfg`, `user.cfg`, `firewall/cluster.fw` — that change propagates cluster-wide within seconds, without you touching any other node. This is exactly why it needs a backup routine before you make any cluster-level change: a bad edit doesn't stay contained to the node you typed it on.

Because `/etc/pve` is a FUSE mount, ordinary filesystem tools like `tar` still work against it (it presents as regular files and directories), but block-level backup tools do not apply to it — there is no block device to snapshot. A config backup means archiving the files through the filesystem layer, plus capturing the live cluster state for context.

**[ANY-NODE]** — create the backup script:

```bash
sudo mkdir -p /usr/local/sbin
sudo tee /usr/local/sbin/pve-config-backup.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/var/backups/pve-cluster-config"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${TIMESTAMP}"

mkdir -p "${DEST}"

tar -czf "${DEST}/etc-pve.tar.gz" -C / etc/pve
pvecm status > "${DEST}/pvecm-status.txt" 2>&1
pveversion -v > "${DEST}/pveversion.txt" 2>&1

# keep 30 days of local backups
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;

echo "pve-config-backup: wrote ${DEST}"
EOF
sudo chmod +x /usr/local/sbin/pve-config-backup.sh
```

Expected output: no error from any line; `ls -l /usr/local/sbin/pve-config-backup.sh` shows an executable file.

**[ANY-NODE]** — run it once by hand to confirm it works before you automate it:

```bash
sudo /usr/local/sbin/pve-config-backup.sh
```

Expected output: `pve-config-backup: wrote /var/backups/pve-cluster-config/<timestamp>`. Confirm with `ls /var/backups/pve-cluster-config/<timestamp>/` — you should see `etc-pve.tar.gz`, `pvecm-status.txt`, and `pveversion.txt`.

**[ANY-NODE]** — schedule it with a systemd service + timer instead of cron, so you get logging via `journalctl` for free:

```bash
sudo tee /etc/systemd/system/pve-config-backup.service > /dev/null << 'EOF'
[Unit]
Description=Backup /etc/pve cluster config

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/pve-config-backup.sh
EOF

sudo tee /etc/systemd/system/pve-config-backup.timer > /dev/null << 'EOF'
[Unit]
Description=Daily backup of /etc/pve

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pve-config-backup.timer
```

Expected output: no error; `systemctl enable --now` reports the unit was enabled.

**Checkpoint:**

```bash
systemctl list-timers pve-config-backup.timer
```

Expected: a row showing `pve-config-backup.timer` with a populated `NEXT` time within the next 24 hours. Do not continue to Phase 3 until this timer is active — every phase from here on makes cluster-level changes, and you want a config backup in place before the first one.

This backup routine only needs to run on one node — `/etc/pve` is the same replicated filesystem everywhere, so backing it up from any single node captures the whole cluster's config. Running it on every node is harmless but redundant.

---

## Phase 3 — Resource pool: the `learning` boundary

A Proxmox pool is a named grouping of VMs, containers, and (optionally) storage, and it is also an ACL anchor point — you can grant a user or token permissions scoped to exactly the objects in a pool, and nothing else. This is the mechanism that makes "least-privilege API token" actually enforceable rather than just a promise.

**[ANY-NODE]** — create the pool:

```bash
pvesh create /pools --poolid learning
```

Expected output: no output on success (Proxmox's API CLI is silent for a successful create with no return value). Confirm it exists in the next step.

**Checkpoint:**

```bash
pvesh get /pools/learning
```

Expected output: a JSON object for the pool, including `"poolid": "learning"` and an empty (or near-empty) `"members"` array, since nothing has been assigned to it yet.

**The rule, from this point forward, with no exceptions:** nothing outside the `learning` pool gets touched by any mission in this track. Every VM and container you create from Mission 02 onward gets created inside this pool, tagged `learning`, and numbered in the `9000-9999` VMID range. If a future mission's instructions ever seem to require touching an object outside this pool, stop and treat that as a sign something is wrong with the instructions, not a green light to proceed.

---

## Phase 4 — Network isolation

Lab VMs need a network to talk on, and that network must never be able to reach a production subnet — not through misconfiguration, not through a VM someone clones carelessly, not ever. There are two valid ways to achieve this, and which one is correct for your cluster depends on what Phase 1's recon actually found. Use this decision table:

| What Phase 1 recon found | Correct choice |
|---|---|
| Existing bridges (e.g. `vmbr0`) carry a flat, untagged network with no VLANs in use anywhere | Add a dedicated `vmbr-lab` bridge with **no physical uplink** (`bridge-ports none`). It exists only inside the hypervisor — lab VMs can reach each other, but there is no wire out, so it is physically incapable of reaching production. |
| The switch already trunks multiple VLANs to each node's physical NIC, and a spare VLAN ID is available for lab use | Use a VLAN-tagged sub-interface (either a plain `vmbrX.<vlan>` config or a Proxmox SDN VLAN zone) on the existing trunk. Isolation is enforced by the switch's VLAN ACLs, and you get real internet egress for lab VMs without new cabling. |
| A node has only one physical NIC/port total, with no spare port for a second physical bridge | You cannot build a second physically-uplinked bridge on that node. Either use an internal-only `vmbr-lab` (`bridge-ports none`, no egress) or a VLAN sub-interface on the single existing trunk — pick internal-only unless lab VMs genuinely need outbound internet access. |
| You are not fully confident the switch enforces VLAN ACLs correctly, or you don't control the switch configuration | Default to the internal-only `vmbr-lab` bridge. It cannot leak lab traffic into production regardless of any switch misconfiguration, because it never touches a physical port at all. When in doubt, choose the option that fails safe. |

<details>
<summary>Hint — still unsure which option applies to your cluster (open only if stuck)</summary>

If you don't control the physical switch (many company networks are managed by a separate network team), you almost never have enough confidence in the VLAN ACL enforcement to rely on it for isolation. Default to the internal-only bridge (`bridge-ports none`) in that case — it makes the isolation guarantee independent of anyone else's switch configuration, including future changes you won't be told about.

</details>

**[EACH-NODE]** — add the internal-only `vmbr-lab` bridge (adjust if your recon led you to the VLAN option instead — apply the equivalent VLAN sub-interface config on each node in that case):

```bash
sudo tee -a /etc/network/interfaces > /dev/null << 'EOF'

auto vmbr-lab
iface vmbr-lab inet manual
	bridge-ports none
	bridge-stp off
	bridge-fd 0
EOF
```

Expected output: no error; `tail -n 6 /etc/network/interfaces` shows the new stanza appended.

**[EACH-NODE]** — apply the network config without a reboot (Proxmox uses `ifupdown2`, which supports live reload):

```bash
sudo ifreload -a
```

Expected output: no error. If `ifreload` is not available on your Proxmox version, use `systemctl restart networking` instead, but be aware that briefly interrupts networking on that node — do this one node at a time, never on all nodes simultaneously.

**Checkpoint:**

```bash
ip link show vmbr-lab
```

Expected output: `vmbr-lab` listed with `state UP` (or `UNKNOWN`, which is normal for bridges with no active ports yet). Run this on every node before continuing — do not proceed to Phase 5 until `vmbr-lab` exists on every node in the cluster, since VMs may need to migrate between nodes in later missions and the bridge must exist everywhere.

---

## Phase 5 — Least-privilege API token

This is the token every future mission's automation (Terraform, Packer, Ansible, scripts) will authenticate with. It must be able to manage VMs inside the `learning` pool and nothing else — it should not even be able to see that production VMs exist.

**[ANY-NODE]** — create the user (no password needed; this account only ever authenticates via API token):

```bash
pveum user add learn@pve --comment "Least-privilege API user for LearningHub missions"
```

Expected output: no output on success.

**[ANY-NODE]** — create a role containing only VM-management privileges (the exact `VM.*` privilege list — nothing from `Datastore.*`, `Sys.*`, `Realm.*`, or any other privilege family):

```bash
pveum role add LearningRole -privs "VM.Allocate,VM.Audit,VM.Backup,VM.Clone,VM.Config.CDROM,VM.Config.CPU,VM.Config.Cloudinit,VM.Config.Disk,VM.Config.HWType,VM.Config.Memory,VM.Config.Network,VM.Config.Options,VM.Console,VM.Migrate,VM.Monitor,VM.PowerMgmt,VM.Snapshot,VM.Snapshot.Rollback"
```

Expected output: no output on success. Confirm with `pveum role list` — `LearningRole` appears with that exact privilege string.

**[ANY-NODE]** — grant that role to the user, scoped only to the `learning` pool (not to `/`, not to any node path — the ACL path is the pool):

```bash
pveum acl modify /pool/learning --roles LearningRole --users learn@pve
```

Expected output: no output on success.

**[ANY-NODE]** — create the API token under that user, with privilege separation enabled (`--privsep 1` means the token does not automatically inherit the user's permissions — it needs its own ACL grant, which is the safer default and exactly what makes this "least privilege" rather than "least privilege in theory"):

```bash
pveum user token add learn@pve tf --privsep 1
```

Expected output: a table showing `full-tokenid: learn@pve!tf` and a `value:` field containing the token secret — a UUID-like string. **This secret is shown exactly once.** Copy it immediately into a password manager or secrets store; it cannot be retrieved again, only regenerated (which invalidates the old one).

**[ANY-NODE]** — grant the token itself the same role on the same pool (required because of `--privsep 1` above — without this step the token exists but can do nothing):

```bash
pveum acl modify /pool/learning --roles LearningRole --tokens 'learn@pve!tf'
```

Expected output: no output on success.

**[WORKSTATION or ANY-NODE]** — test the token with a direct API call:

```bash
curl -k -H "Authorization: PVEAPIToken=learn@pve!tf=<token-secret>" \
  "https://<any-node-ip>:8006/api2/json/pools/learning"
```

(Replace `<token-secret>` with the value you copied above, and `<any-node-ip>` with a real node's management IP. `-k` skips TLS verification, which is fine against the cluster's self-signed cert for this test.)

Expected output: HTTP 200 with a JSON body like:

```json
{"data":{"poolid":"learning","members":[]}}
```

**Checkpoint:** the curl command above returns HTTP 200 with the pool's JSON body, not a 401 or 403. Do not continue to the prove-it section until this succeeds — a 401 means the token secret was copied wrong; a 403 here (on the token's own pool) means the ACL grant on the token itself didn't take, and you need to re-run the `pveum acl modify ... --tokens` command above.

---

## Prove-it: the token must be blind outside the pool

A least-privilege token is only as good as its actual boundary. Prove the boundary holds by pointing the token at a real production VMID — one from your Phase 1 census that is **not** in the `learning` pool — and confirming Proxmox refuses it.

Pick any production VMID from your Phase 1 inventory (call it `<prod-vmid>` on node `<prod-node>` below) and run each of these:

**Attempt 1 — read the production VM's status:**

```bash
curl -k -H "Authorization: PVEAPIToken=learn@pve!tf=<token-secret>" \
  "https://<any-node-ip>:8006/api2/json/nodes/<prod-node>/qemu/<prod-vmid>/status/current"
```

Expected output: HTTP 403 Forbidden, with a body like:

```json
{"data":null}
```

**Attempt 2 — read the production VM's config:**

```bash
curl -k -H "Authorization: PVEAPIToken=learn@pve!tf=<token-secret>" \
  "https://<any-node-ip>:8006/api2/json/nodes/<prod-node>/qemu/<prod-vmid>/config"
```

Expected output: HTTP 403 Forbidden, same `{"data":null}` shape.

**Attempt 3 — try to power-cycle the production VM:**

```bash
curl -k -X POST -H "Authorization: PVEAPIToken=learn@pve!tf=<token-secret>" \
  "https://<any-node-ip>:8006/api2/json/nodes/<prod-node>/qemu/<prod-vmid>/status/start"
```

Expected output: HTTP 403 Forbidden. This is the one that matters most — a token that can only "see" a VM but not act on it is bad enough to leak information; a token that can act on it is a production incident waiting to happen. Confirm this returns 403, not 200.

If any of these three attempts returns anything other than 403 — especially a 200 — stop immediately. That means the token can see or touch production. Do not proceed to any later mission; re-check the `pveum acl modify` scoping in Phase 5, and re-verify the role only contains `VM.*` privileges with no ACL grant anywhere above the pool path.

---

## Phase 6 — Write the safety doc

This is the deliverable that makes the rest of this mission real rather than theoretical. Record your own findings from Phase 1 into the template below, then save it somewhere you'll see it again — the top of your notes for this track is a good place.

```markdown
# Proxmox Safety Doc — signed by <your name>, <today's date>

## Blast-radius statement

I have full administrative access to a <N>-node Proxmox cluster (<cluster name>)
that also runs production workloads belonging to <company/team name>. Any
command I run cluster-wide, or any command run against a node/storage/network
object outside the `learning` pool, can affect systems other people depend on.
I accept that the safety rails below are the only thing standing between my
learning activity and a production incident, and I will not bypass them for
convenience.

## Never-touch list

Built directly from the Phase 1 inventory. Every object below existed before
this mission and is not tagged `learning` — none of it gets modified, deleted,
migrated, or power-cycled by any mission in this track.

- Nodes: <list every node name from Phase 1>
- VMs/CTs (VMID / name / node): <list every entry from the Phase 1 census that
  is not later moved into the `learning` pool>
- Storage: <list every storage backend from Phase 1 that isn't dedicated to
  lab use>
- Networks: <list every bridge/VLAN from Phase 1 other than `vmbr-lab`>

## Rollback plan per mission type

- Template/build missions (manual VM/CT work): delete the specific VMID(s)
  created, via `qm destroy <vmid>` or `pct destroy <vmid>`, scoped to VMIDs in
  the 9000-9999 range only. Never run a destroy command without confirming the
  VMID is in range first.
- IaC missions (Terraform/Packer/Ansible): `terraform destroy` scoped to that
  mission's own state file/workspace. Never run `terraform destroy` against a
  state file you did not create in this track.
- Storage missions (ZFS/Ceph): tear down only the specific dataset/pool/RBD
  image created for the mission, identified by its lab-only naming or the
  `learning` tag — never a storage object that existed in the Phase 1
  inventory.
- Network missions (SDN/VLAN): remove only the lab-specific zone/VNet/VLAN
  created for that mission; `vmbr-lab` itself and its base config are
  long-lived and are not torn down between missions.
- Cluster-wide missions (HA/corosync): revert via the `/etc/pve` backup taken
  by the routine in Phase 2 — restore the pre-change tarball and re-verify
  `pvecm status` shows the cluster quorate before considering the rollback
  complete.

## Sign-off

Signed: <your name>
Date: <today's date>
Reviewed the never-touch list against the live Phase 1 census: yes
```

<details>
<summary>Hint — how far should the never-touch list go? (open only if stuck)</summary>

Literally everything in your Phase 1 census that isn't going to live in the `learning` pool. If you're unsure whether an existing VM belongs to someone, that uncertainty itself is the answer — put it on the never-touch list. The list is allowed to shrink later if you get explicit confirmation an object is safe to use, but it should never start narrow.

</details>

**Checkpoint:** the safety doc has a non-empty blast-radius statement, a never-touch list with at least one entry per node/VM/CT/storage/network category found in Phase 1, a rollback plan for every mission type listed, and your signature with today's date. Do not start Mission 02 until this doc exists and you've re-read it once.

---

## Break-fix drills

None for this mission. Mission 01 is recon and guardrail construction, not building — there is nothing here worth deliberately breaking. Break-fix practice starts in Mission 02, once there are templates and running VMs to actually damage and repair.

---

## Done when

- [ ] Cluster inventory doc complete: cluster name, every node, `pve-manager` version, storage per node, network config per node, full VM/CT census
- [ ] `/etc/pve` backup routine running: script at `/usr/local/sbin/pve-config-backup.sh`, `pve-config-backup.timer` active and scheduled within the next 24h
- [ ] `learning` pool created and confirmed via `pvesh get /pools/learning`
- [ ] `vmbr-lab` bridge (or the VLAN equivalent your recon justified) present and `UP` on every node
- [ ] `learn@pve!tf` API token created, scoped to `LearningRole` on `/pool/learning` only, and its token secret stored somewhere durable
- [ ] Prove-it passed: all three curl attempts against a real production VMID returned 403
- [ ] Safety doc written and signed: blast-radius statement, never-touch list built from the real Phase 1 census, rollback plan per mission type
