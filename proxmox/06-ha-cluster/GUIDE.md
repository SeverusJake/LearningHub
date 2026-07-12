# Guide — Mission 06: HA + Cluster

Read this in full before you run anything, especially Phase 5. This mission is not like Mission 03's IaC work, where a mistake costs you a `terraform destroy` and a clean retry. Corosync, quorum, and HA fencing operate at the level of "is this physical node allowed to keep running or does it get reset" — the blast radius of getting this wrong is a real node going down, potentially taking real workloads with it, not a Terraform state file getting confused. Every phase below is written to keep that blast radius contained to lab VMs for as long as possible, and Phase 5 is written to be explicit, in plain language, about the one point where that containment requires your team's coordination rather than just a safe command.

Conventions used throughout, carried forward from Missions 01 and 04:

```
Resource pool                 : learning
VM ID range                   : 9000-9999
Dedicated bridge               : vmbr-lab
Lab subnet                    : 10.10.100.0/24
Ceph-backed shared storage     : ceph-lab (RBD pool provisioned in Mission 04 — substitute your real storage ID if it differs)
API token                     : learn@pve!tf
Tag on every learning object    : learning
```

This guide writes node names as `pve1`, `pve2`, `pve3` — substitute your cluster's real node names everywhere. Everything here assumes the 3-or-more-node cluster the track's safety contract calls for; the quorum math in Phase 1 explains exactly why that minimum matters for this specific mission.

**Lab VMs used in this mission** — create these now if they don't already exist, exactly like Mission 03's fleet pattern (cloned from the golden template, in the `learning` pool, tagged `learning`):

```
9301  web-a   pve1   disk on ceph-lab (shared)   — HA-managed from Phase 3 onward
9302  web-b   pve2   disk on ceph-lab (shared)   — HA-managed from Phase 3 onward
9310  local-a pve1   disk on local-lvm (node-local) — used only for the Phase 2 local-disk migration comparison
```

---

## Phase 1 — corosync deep-read

You cannot reason about failover safely until you understand exactly what keeps this cluster a single cluster instead of three independent machines. That mechanism is corosync, and the number that matters most is quorum — the minimum number of votes that must be present and talking to each other before the cluster considers itself allowed to make decisions.

**[ANY-NODE]** — read the live config:

```bash
cat /etc/pve/corosync.conf
```

Expected output: something shaped like this (your node names, IPs, and `config_version` will differ):

```
logging {
  debug: off
  to_syslog: yes
}

nodelist {
  node {
    name: pve1
    nodeid: 1
    quorum_votes: 1
    ring0_addr: 10.10.10.11
  }
  node {
    name: pve2
    nodeid: 2
    quorum_votes: 1
    ring0_addr: 10.10.10.12
  }
  node {
    name: pve3
    nodeid: 3
    quorum_votes: 1
    ring0_addr: 10.10.10.13
  }
}

quorum {
  provider: corosync_votequorum
}

totem {
  cluster_name: prod-cluster
  config_version: 7
  interface {
    linknumber: 0
  }
  ip_version: ipv4-6
  link_mode: passive
  secauth: on
  version: 2
}
```

Read it against this map: `nodelist` is the membership roster — every node gets exactly one `quorum_votes` (default 1, and almost never changed from that in practice) and a `ring0_addr`, the IP corosync's own heartbeat traffic uses, which is often a dedicated management or cluster-only network segment, not the same address VMs traffic rides on. `totem.config_version` is a single integer that increments every time this file changes structurally (a node added or removed) — it's the version-bump mechanism break-fix drill 3 below is built around. `quorum.provider: corosync_votequorum` is what actually does vote counting.

**The quorum math, by hand:**

| Total nodes (all votes = 1) | Total votes | Votes needed for quorum (`> total/2`) | Node failures tolerated |
|---|---|---|---|
| 2 | 2 | 2 | 0 — any single node loss drops both sides below quorum, unless a qdevice is added |
| 3 | 3 | 2 | 1 |
| 4 | 4 | 3 | 1 — same tolerance as 3 nodes, for one more node's worth of hardware |
| 5 | 5 | 3 | 2 |
| 6 | 6 | 4 | 2 — same tolerance as 5 nodes |

The pattern: quorum requires *strictly more than half* the total votes, and odd node counts are the efficient shape — each additional odd node beyond the previous odd number actually buys you one more tolerated failure, while each even node count only ever matches the tolerance of the odd count below it. That's why "add a qdevice" is the standard answer for even-sized clusters (most commonly 2-node clusters): a qdevice is a tie-breaking vote cast by an external `corosync-qnetd` process running on a host that is not itself a cluster member (so it can't be split alongside either half), letting an even-sized cluster behave like it has one more vote than it physically does. Your cluster, at 3-or-more nodes, is already in the efficient odd-or-comfortably-above-minimum shape — you will not need to set one up for this mission, but you need to be able to recognize the exact situation (an even node count, or any cluster where losing one more node would tie the vote) where a qdevice stops being optional.

**[ANY-NODE]** — the live status command, field by field:

```bash
pvecm status
```

Expected output:

```
Cluster information
-------------------
Name:             prod-cluster
Config Version:   7
Transport:        knet
Secure auth:      on

Quorum information
------------------
Date:             Sun Jul 12 14:02:11 2026
Quorum provider:  corosync_votequorum
Nodes:            3
Node ID:          0x00000001
Ring ID:          1.1a2
Quorate:          Yes

Votequorum information
----------------------
Expected votes:   3
Highest expected: 3
Total votes:      3
Quorum:           2
Flags:            Quorate

Membership information
----------------------
    Nodeid      Votes Name
0x00000001          1 10.10.10.11 (local)
0x00000002          1 10.10.10.12
0x00000003          1 10.10.10.13
```

`Config Version` is the same integer from `corosync.conf`'s `totem.config_version` — the two must always match; a mismatch is exactly what break-fix drill 3 below trains you to recognize. `Quorate: Yes` is the single most important word in this entire output — everything else is context for it. `Total votes` / `Quorum` is the live version of the table above: this cluster has 3 total votes and needs 2 to stay quorate. `Expected votes` is what the cluster believes its total should be under normal conditions — if `Expected votes` and `Total votes` ever disagree while the cluster still shows `Quorate: Yes`, that's a sign a node is down but the survivors still have enough votes to keep going, which is the exact situation Phase 5 puts you in on purpose.

**What happens cluster-wide the instant quorum is lost:** `pmxcfs`, the FUSE filesystem backing `/etc/pve` that Mission 01 introduced, refuses to accept writes on any node that finds itself in a non-quorate partition — `/etc/pve` on that node effectively goes read-only. That means no VM config changes, no new VMs, no user or ACL changes, nothing that touches cluster-replicated config, from that node, until quorum is restored. It does **not** mean VMs already running on that node stop running — compute keeps going independent of quorum. What quorum loss does gate, specifically for HA-managed resources, is covered in full in Phase 5: a node that can't prove it still has quorum can't keep re-arming its own watchdog, and that's the mechanism that eventually forces the issue.

**Checkpoint:** you can read your own cluster's `corosync.conf` and state, without looking anything up, its total vote count, its quorum threshold, and how many simultaneous node failures it currently tolerates. You can also state whether your cluster's node count is in the "efficient" (odd, or minimum-for-tolerance) shape or the "wasteful" (even) shape, and if it's the latter, what a qdevice would buy you that adding one more full node wouldn't.

---

## Phase 2 — migration: live vs. local-disk, measured

Migration is how a VM moves from one node to another without you manually recreating it. How much that VM's guest OS actually notices depends entirely on where its disk lives — this phase makes you measure that difference instead of taking it on faith.

**Live migration with shared storage** (`web-a`, VMID 9301, disk on `ceph-lab`): because the disk is already visible identically from every node in the cluster, live migration only has to move the VM's *running memory state* — the disk stays exactly where it is. QEMU does this with iterative pre-copy: it copies RAM to the target while the VM keeps running and writing to it, re-copies whatever pages changed during that first pass, repeats until the remaining "dirty" set is tiny, then does one final, very short pause to copy the last sliver of state and switch the VM's execution to the target node. That final pause is the only actual downtime, and because there's no disk to reconcile, it's typically sub-second.

**[ANY-NODE]** — start a continuous ping from a vantage point that isn't migrating (your workstation, or a third node):

```bash
ping -D 10.10.100.231 | tee /tmp/migrate-ping-shared.log
```

(`-D` prints a Unix timestamp on every line — that's what makes the gap measurable afterward. Replace the IP with `web-a`'s real address. Let this run in its own terminal or session; don't background it, you want to watch it live too.)

**[ANY-NODE]** — in a second terminal, trigger the migration:

```bash
qm migrate 9301 pve2 --online
```

Expected output: a progress log ending in `migration finished successfully` with a duration. Let it finish, then stop the ping with Ctrl-C.

Find the largest gap between consecutive ping timestamps — that gap is your measured downtime:

```bash
awk '{print $1}' /tmp/migrate-ping-shared.log | tr -d '[]' | awk 'NR>1{d=$1-prev; if (d>max) max=d} {prev=$1} END{print "largest gap (s):", max}'
```

Expected output: `largest gap (s): 0.XX` — a fraction of a second. That's the entire cost of moving a VM between two physical nodes while it keeps running.

**Live migration with a local disk** (`local-a`, VMID 9310, disk on `local-lvm`): now the disk itself is only visible on `pve1`. `--with-local-disks` tells Proxmox to live-mirror that disk to the target over the network (QEMU block-mirror) while the VM keeps running, the same way it mirrors RAM — but the disk is almost always far bigger than RAM, so the mirror takes proportionally longer, and the final cutover has to wait for the last dirty disk blocks to sync in addition to the last dirty memory pages. The guest still keeps running throughout the transfer; the pause at the end is simply larger because there's strictly more to reconcile at that final moment.

**[ANY-NODE]** — repeat the same ping-and-migrate pattern:

```bash
ping -D 10.10.100.240 | tee /tmp/migrate-ping-local.log
```

```bash
qm migrate 9310 pve2 --online --with-local-disks
```

Expected output: a longer-running progress log (disk mirror progress lines you didn't see in the shared-storage case), ending the same way, `migration finished successfully`.

```bash
awk '{print $1}' /tmp/migrate-ping-local.log | tr -d '[]' | awk 'NR>1{d=$1-prev; if (d>max) max=d} {prev=$1} END{print "largest gap (s):", max}'
```

Expected output: a noticeably larger gap than the shared-storage run — commonly a few seconds rather than a fraction of one, though the exact number depends on your disk size and network speed. The point isn't a specific number, it's that you now have two real measurements to compare instead of an assumption.

**For contrast, offline migration** (no `--online` at all, on a VM you don't mind briefly stopping): Proxmox shuts the VM down, moves its config and disk, and boots it fresh on the target. There is no pre-copy, no mirror, and no cutover trick — downtime is the VM's full shutdown-plus-boot time, typically tens of seconds. You don't need to measure this one with a ping log to appreciate why it's the last resort, not the first choice, whenever a VM's storage situation allows anything better.

**Checkpoint:** you have two saved ping logs and two computed downtime numbers — sub-second for the Ceph-backed live migration, a materially larger pause for the local-disk live migration — and you can explain in your own words exactly which part of each migration (memory-only cutover vs. memory-and-disk cutover) accounts for the difference.

---

## Phase 3 — the HA stack

**Two services, two jobs.** `pve-ha-crm` (Cluster Resource Manager) is the decision-maker: it looks at every HA-managed resource's configured state and group, looks at which nodes are currently up and quorate, and decides where each resource *should* be running. It runs on every node, but only one instance is ever active at a time — the others sit in standby, ready to take over the moment the active one's node stops updating a lock it holds in `/etc/pve`. `pve-ha-lrm` (Local Resource Manager) is the doer: it runs on every node unconditionally, watches what the CRM has assigned to *its own* node specifically, and issues the actual start/stop/migrate commands to make that assignment real, then reports status back up.

**[ANY-NODE]** — confirm both are running everywhere and see who's currently the CRM master:

```bash
systemctl status pve-ha-crm pve-ha-lrm
```

Expected output: `active (running)` for both units, on every node.

```bash
ha-manager status
```

Expected output includes a `quorum OK` line and a line naming the current master, e.g. `master pve1 (active, ...)`, followed by per-node LRM status lines (`lrm status: idle` when nothing's assigned yet).

**Build the group first**, since a resource can't reference a group that doesn't exist yet:

```bash
ha-manager groupadd labgroup --nodes "pve1:2,pve2:2,pve3:1" --nofailback 0 --restricted 0
```

Expected output: no output on success. Read every option before moving on — you'll be relying on all three during Phase 4 and Phase 5:

- The numbers after each node name are **priorities** — higher wins. `pve1` and `pve2` here are tied at the top priority (2), `pve3` is the lower-priority fallback (1). When a resource needs a home, the CRM picks from the highest-priority tier that's currently up; if more than one node ties at that tier, it spreads load across them rather than always picking the first one alphabetically.
- `--restricted 0` means this group is a *preference*, not a hard fence — if every listed node is down, the CRM is still allowed to try other cluster nodes rather than leaving the resource stopped. `--restricted 1` would forbid that; you'd use it only when a resource genuinely must never run anywhere outside a specific node set (licensing, local hardware passthrough, that kind of constraint).
- `--nofailback 0` means that once a resource relocates away from its top-priority node during a failure, it automatically moves back once that node returns and stabilizes. `--nofailback 1` would leave it on whatever node it failed over to until you relocate it by hand — useful when failing back automatically would itself cause a second disruptive cutover you'd rather schedule deliberately instead of letting it happen the moment a recovering node rejoins.

**[ANY-NODE]** — put both HA-managed lab VMs under that group:

```bash
ha-manager add vm:9301 --group labgroup --max_restart 2 --max_relocate 2 --state started
ha-manager add vm:9302 --group labgroup --max_restart 2 --max_relocate 2 --state started
```

Expected output: no output on success. `max_restart` and `max_relocate` both matter and mean different things: `max_restart` is how many times the CRM will try to restart a failed resource **in place, on the same node**, before concluding the node-local restart path isn't working. `max_relocate` is how many times, after in-place restarts are exhausted, it will try starting the resource on a **different** node from the group before giving up entirely. Once both counters are exhausted with no success, the resource's state becomes `error` — a state that requires a human to acknowledge before the CRM will touch that resource again, which is exactly what break-fix drill 2 below puts you through.

**Checkpoint:**

```bash
ha-manager config
ha-manager status
```

Expected output: `ha-manager config` lists `labgroup` with its three nodes and priorities, and both `vm:9301` and `vm:9302` referencing it with `state started`. `ha-manager status` shows both services `started`, each currently running on one of `labgroup`'s two top-priority nodes (`pve1` or `pve2`).

---

## Phase 4 — node maintenance: drain, reboot, refill

Patching or rebooting a node that's carrying live workloads is routine cluster operations — the point of this phase is doing it in a way where nothing goes down, because everything moved off first.

**Manual drain**, the way you'd do it before Mission 06 taught you a better tool — migrate every HA-managed VM off the node you intend to reboot:

```bash
qm migrate 9301 pve3 --online
qm migrate 9302 pve3 --online
```

Expected output: both report `migration finished successfully`. Confirm:

```bash
qm list | grep -E "9301|9302"
```

Expected output: both now show `pve3` as their current node.

**The HA-aware way**, which does the same thing automatically and also stops the CRM from assigning anything new to that node while you work on it:

```bash
ha-manager crm-command node-maintenance enable pve1
```

Expected output: an acknowledgement that maintenance mode was requested. Give it a minute, then:

```bash
ha-manager status
```

Expected output: `pve1` shown in a maintenance state, and every HA-managed resource that had been assigned to it now relocated to its next-best `labgroup` priority tier. (If your Proxmox version's exact command name or flags differ slightly, run `ha-manager crm-command help` to see the current form — the mechanism is stable even where the exact CLI surface has moved between versions.)

**[ANY-NODE]** — with the node confirmed empty of HA workloads, reboot it cleanly:

```bash
ssh root@pve1 'reboot'
```

Watch it leave and rejoin from another node:

```bash
watch -n 5 pvecm status
```

Expected output: `Nodes` drops from 3 to 2 the moment `pve1` goes down for its reboot, `Quorate` stays `Yes` throughout (2 of 3 nodes is still quorate — this is the same quorum math from Phase 1, now observed live), then `pve1` reappears in the membership table once it finishes booting and rejoins.

Maintenance mode clears itself once the node rejoins cleanly and stabilizes — confirm:

```bash
ha-manager status
```

Expected output: `pve1` no longer shown in maintenance. Because this group was configured with `--nofailback 0`, watch for `vm:9301` and/or `vm:9302` (whichever had `pve1` as a tied top-priority node) migrating back to `pve1` on their own over the next CRM cycle, with no command from you.

**Checkpoint: node rejoins, VMs redistribute per policy.** Specifically: `pvecm status` shows all 3 nodes back, quorate; `ha-manager status` shows no node in maintenance; and the resources that had `pve1` in their top priority tier are either already back on it or visibly migrating there without any manual `qm migrate` from you.

---

## Phase 5 — the failure drill (lab VMs only, agreed maintenance window)

**Read this entire section before running a single command in it.** Everything in Phase 1 through Phase 4 was reversible with nothing worse than a brief live-migration pause. This phase is different in kind, not just degree: the mechanism that makes Proxmox HA safe — fencing — works by forcing a **real, hard reset** of the physical node in question, not a graceful shutdown and not a simulation. That reset does not distinguish between lab workloads and anything else that happens to be running on that node at the moment it fires. Treat everything below as equivalent, in terms of required care, to scheduling a real unplanned power-cycle of a company server, because that is functionally what you are about to cause on purpose.

**Do not proceed past this point until every item below is true and you can say so honestly:**

1. You have agreed a maintenance window with your team — which node, what time, how long, and who else needs to know it's happening. This is not a solo judgment call.
2. You have drained the target node of **everything**, not just lab VMs — repeat Phase 4's full drain procedure (manual `qm migrate` or `ha-manager crm-command node-maintenance enable`) against every workload currently on that node, lab-tagged or not. The node should be empty of anything that isn't disposable before you deliberately break it.
3. You have re-run `pvecm status` immediately beforehand and confirmed the cluster is currently at full node count and quorate — you are not layering this drill on top of an already-degraded cluster.
4. You have redone the quorum math from Phase 1 for your actual node count and confirmed, in writing, that the surviving nodes after this one drops will still hold quorum. For a 3-node cluster, losing 1 leaves 2 of 3 — quorate, safe. Do not run this drill on a 2-node cluster without a working qdevice, and do not run it if your cluster is currently sitting at exactly its quorum threshold for any other reason.
5. **One node, at a time, ever.** Do not start a second node's drill until the first node has fully rejoined and `ha-manager status` shows nothing in an unresolved state.
6. Having drained the node in step 2, you have now deliberately migrated one or two `labgroup` VMs (`9301`/`9302`) back onto that specific node — these are the intended casualties of the drill, and the only things that should be running there when you trigger it.

Once all six are true, proceed.

**What you're about to trigger, mechanically:** every node's `pve-ha-lrm` holds a reference to that node's hardware watchdog (`/dev/watchdog`, backed by the `softdog` kernel module on most Proxmox installs, proxied through a small `watchdog-mux` daemon so only one process ever arms it) and continuously re-arms it as long as the node has quorum and its LRM is healthy. If quorum is lost and can't be regained before the watchdog's timeout elapses, nothing re-arms it, and the watchdog fires — a hard, immediate reset of that physical machine, with no shutdown sequence. This is deliberate: it's the mechanism that lets the rest of the cluster treat a non-responding node as **provably, verifiably dead** rather than merely unreachable, which is exactly what makes it safe to start that node's VMs somewhere else without risking two live copies of the same VM running at once. You are about to watch that exact mechanism happen for real.

**[TARGET NODE]** — note the wall-clock time, then sever this node's cluster communication:

```bash
systemctl stop corosync
```

Expected behavior: this command itself returns almost immediately, but from this instant the node has no corosync membership at all — the other nodes will see it vanish within seconds, and this node itself can no longer confirm it holds quorum. Your SSH session to this node may hang or drop entirely once the watchdog fires; that's expected, not an error to troubleshoot.

**[ANY SURVIVING NODE]** — watch quorum react immediately:

```bash
pvecm status
```

Expected output: `Nodes: 2` (down from 3), `Quorate: Yes` for the two survivors — they still hold 2 of 3 total votes, comfortably above the quorum threshold of 2. The target node has simply dropped out of the membership table.

**[CRM MASTER NODE]** — follow the CRM's decision-making live:

```bash
journalctl -u pve-ha-crm -f
```

Expected sequence, in order (exact wording can vary slightly by Proxmox version — match the pattern, not the byte-for-byte text):

1. `node '<target>': state changed from 'online' to 'unknown'` — the CRM notices the node stopped reporting.
2. `must fence node '<target>'` — the CRM will not touch any resource that was assigned to that node until it can prove the node is dead.
3. `node '<target>': state changed from 'unknown' to 'fence'` — waiting on the watchdog timeout window described above; this is the bulk of the elapsed time you're about to measure.
4. `fencing: acknowledged - got agent lock for node '<target>'` — the CRM has now confirmed (via the watchdog contract, not by asking the node directly) that the node is gone.
5. `service 'vm:9301': state changed from 'started' to 'fence'`, then `... to 'recovery'` — the specific VM's own state machine catching up to the node-level fencing decision.
6. `recover service 'vm:9301' from fenced node '<target>'` followed by `service 'vm:9301': state changed from 'recovery' to 'started' (node = <survivor>)` — the VM is now assigned to, and starting on, a surviving node.

Time the whole thing: from your noted stop-corosync timestamp to the final `... to 'started' (node = ...)` line, budget roughly two minutes. Most of that is the watchdog's own timeout window; the rest is the CRM's polling and lock-acquisition cycle layered on top of it.

**[TARGET NODE, once it's back]** — after the hard reset completes and the node boots and rejoins (give it a few minutes), read its own side of the story:

```bash
journalctl -u pve-ha-lrm --since "-20min"
```

Expected output: the log ends abruptly around the moment corosync was stopped (no graceful shutdown lines — the reset simply cut the log off mid-stream), then resumes fresh after boot with the LRM starting up, re-establishing quorum, and re-syncing its status with the CRM.

**Write the full annotated log trail** — every line from step 3 (`node '<target>': state changed from 'online' to 'unknown'`) through the VM's `started` line, in the order you actually saw them, each one followed by one or two sentences in your own words explaining what was happening in the cluster at that moment. This is the deliverable the prove-it section below asks you to produce formally.

Confirm the node's full recovery before considering the drill complete:

```bash
pvecm status
ha-manager status
```

Expected output: `Nodes: 3` again, `Quorate: Yes`; `ha-manager status` shows the recovered VM either back on its priority-preferred node (if `--nofailback 0`, as configured in Phase 3) or still on the node it failed over to (if you'd set `--nofailback 1`) — either way, `started`, not `error` or `fence`.

**Checkpoint:** the target node completed a real hard reset and rejoined the cluster cleanly; the affected lab VM relocated in roughly two minutes; you have a complete, ordered, self-annotated log trail from both the CRM master's and the affected node's own perspective; and every one of the six preconditions above was actually true before you started, not assumed.

---

## Phase 6 — split-brain theory

**Why fencing has to happen before any restart, not after:** imagine the target node in Phase 5 wasn't actually dead — it was just cut off from the network (a switch fault, not a crashed kernel) while its VM kept running and writing to its Ceph-backed disk. If the CRM restarted that same VM on another node purely on the assumption that the first node was gone, you'd now have two live QEMU processes for the same VM, both believing they own the same RBD image, both writing to it independently. That's not a theoretical concern — it's immediate, silent data corruption, and it's the single scenario every clustering system's fencing design exists to prevent. Fencing's entire job is converting "I can't reach that node" (ambiguous — could mean dead, could mean just unreachable) into "that node is provably not running anything anymore" (unambiguous) before anything else is allowed to start in its place. This is the classic STONITH principle — shoot the other node in the head before you trust that it's not still holding the gun.

**What the watchdog actually guarantees — and what it doesn't.** It does not guarantee instant awareness that a node died; from the cluster's point of view, a node that lost network connectivity looks identical, for a while, to a node that's still alive and healthy but unreachable. What it guarantees instead is a **bounded, known-in-advance time window** after which that node is either still successfully re-arming its watchdog (meaning it still has quorum and a healthy LRM, and is therefore fine) or it has been hard-reset and is unambiguously not running anything. The CRM doesn't need an external device to go check — it just needs to wait exactly that bounded window, and the watchdog's own timeout mechanism resolves the ambiguity for it, one way or the other, without exception. That's why Proxmox HA can fence reliably without requiring a separate physical fence device (a PDU with remote power control, an IPMI/iDRAC/iLO integration, etc.) the way older HA stacks did — the watchdog turns "am I still allowed to be running" into a question every node answers about itself, continuously, with no external arbiter required.

**Checkpoint:** you can explain, without reading back Phase 5's notes, why restarting a resource on a new node before fencing completes is unsafe specifically for shared-storage VMs, and you can state precisely what guarantee the watchdog timeout provides (a bounded time-to-certainty) versus what it does not provide (instant notification).

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools from the phases above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — a VM won't migrate

Setup: mount an ISO from local storage onto one of your HA-managed lab VMs' CD-ROM drive (GUI: VM → Hardware → CD/DVD Drive → pick an ISO from `local:iso`; CLI equivalent works too), confirm it's attached, then attempt a live migration of that VM to another node.

Expected symptom: the migration fails during its pre-flight checks, before any actual data transfer starts, citing the CD-ROM/local storage as the reason the target node can't satisfy the request.

<details>
<summary>Hint</summary>

`qm config <vmid>` shows you exactly which device is holding a reference to storage the target node can't see — `local` storage, by definition, only exists on the node it's local to, so anything pointing at it is invisible from anywhere else. Migration's pre-flight check is specifically looking for any device configuration like this before it commits to moving anything. The fix is about removing or changing that one device reference so nothing on the VM still points at node-local storage — work out the right `qm set` invocation for the specific device slot you attached the ISO to, from `qm config`'s own output, rather than guessing at a slot number.

</details>

### Drill 2 — HA state shows `error`

Setup: pick a disposable lab VM under HA management and force it into a state the CRM can't resolve on its own — for example, set `--max_restart 0 --max_relocate 0` on it via `ha-manager set`, then stop the VM's QEMU process directly on its node (not through `ha-manager`, not through a normal `qm stop` — kill it out from under the HA stack so the LRM discovers a mismatch between what it expects and what's actually running).

Expected symptom: `ha-manager status` shows that resource's state as `error`, and it stays there — the CRM will not attempt anything further on its own.

<details>
<summary>Hint</summary>

An `error` state is the CRM's way of saying "I've exhausted my automatic options and I refuse to guess what you want next" — it deliberately will not self-heal from here, because guessing wrong at this stage is how you'd get a duplicate-running-VM situation like the one Phase 6 describes. Recovering from it is a two-part motion: first get the resource's actual runtime state (is it really stopped? confirm directly, don't assume) into a condition you're confident about, then use `ha-manager set` to change its managed `--state` in a way that gives the CRM a clean state to start reasoning from again, rather than trying to resume mid-error. Read `man ha-manager`'s description of the `disabled` and `started` states before you pick which transition to use — the order matters.

</details>

### Drill 3 — a node rejoins with a stale corosync config

Setup: disconnect one node's network access to the rest of the cluster (pull its `vmbr` uplink, or block corosync's port between it and the others — anything that isolates it without touching the node itself). While it's isolated, on a still-connected node, make a real structural change to the cluster's corosync membership (this is most safely done by adding, then removing, a spare test entry in `nodelist`, or by any change your team has already planned that bumps `config_version`) so `totem.config_version` increments cluster-wide among the connected nodes. Then restore the isolated node's network access.

Expected symptom: the rejoining node's own corosync process may keep running against the config it had in memory before it was cut off, even though `/etc/pve/corosync.conf` on disk has already been resynced to the newer version by pmxcfs — `pvecm status` run on that node (or about that node) can show a `Config Version` mismatch immediately after reconnection.

<details>
<summary>Hint</summary>

Two different sync mechanisms are at play here and they don't run on the same schedule: pmxcfs replicates the *file* to every reachable node continuously, independent of corosync's own protocol state — so the bytes on disk are correct again almost immediately after reconnection. Corosync's own running process, though, only picks up a changed config when it's told to — either through its own reload path or a restart of the service. `corosync-cfgtool -s` shows you what a node's corosync process currently believes its config version is, right now, versus what's actually on disk. Once you've confirmed a mismatch, look at what `corosync-cfgtool -R` is documented to do (`man corosync-cfgtool`) and reason out whether that's the right tool to make the running process catch up to the file it's already sitting next to, or whether the mismatch you're seeing needs something more.

</details>

---

## Prove-it: the full Phase 5 incident narrative

Write out the complete log trail from your Phase 5 drill, start to finish — every relevant line from the moment `systemctl stop corosync` ran to the moment the recovered VM showed `started` on its new node, in the exact order you observed them, pulled from both the CRM master's `pve-ha-crm` log and the affected node's own `pve-ha-lrm` log. After each line, write one to three sentences in your own words explaining what was actually happening in the cluster at that instant — not a restatement of the log text, an explanation of the mechanism behind it (what corosync, quorum, the watchdog, or the CRM's state machine was doing).

This narrative gets reviewed in session, not graded against a template — the bar is whether someone who wasn't there could read your narrative and understand not just *that* the failover happened, but *why* each step had to happen in that order, and what would have gone wrong if a step had been skipped or reordered.

---

## Done when

- [ ] You can state your real cluster's total vote count, quorum threshold, and current tolerated-failure count from `corosync.conf` and `pvecm status`, without notes
- [ ] You can state whether your cluster's node count is quorum-efficient (odd) or wasteful (even), and what a qdevice specifically buys an even-sized cluster
- [ ] Two real, saved ping-log downtime measurements exist: one for a Ceph-backed (shared storage) live migration, one for a `--with-local-disks` live migration, with the shared-storage number clearly smaller
- [ ] `labgroup` exists with real node priorities, `restricted`/`nofailback` set deliberately (not left at a default you can't explain), and at least two lab VMs added to it and `started`
- [ ] `max_restart` and `max_relocate` can be explained correctly and distinctly, in your own words, without re-reading Phase 3
- [ ] A full node maintenance drain-reboot-refill cycle has been completed for real, with VMs confirmed redistributed per `labgroup` policy afterward
- [ ] The Phase 5 failure drill was executed with all six safety preconditions genuinely satisfied beforehand (not skipped), the affected VM relocated in roughly two minutes, and the node rejoined cleanly afterward
- [ ] You can explain, unprompted, why fencing must precede any restart on shared storage, and what the watchdog timeout does and does not guarantee
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork, before opening the hints
- [ ] Prove-it: the full annotated Phase 5 incident narrative is written, in order, with every line explained in your own words, ready to be reviewed in session
