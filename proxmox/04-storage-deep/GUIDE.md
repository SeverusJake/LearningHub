# Guide — Mission 04: Storage Deep

This is a live company cluster with real disks. Every `zpool create` and `pveceph osd create` command below wipes whatever is currently on the target block device, silently, with no confirmation prompt worth trusting. Read each command before you run it, confirm the device name against the recon table you build in Phase 1, and if you're not certain a disk is actually spare, stop and ask before running anything against it.

**Safety-contract values used throughout, carried forward from Missions 01-03:**

```
Resource pool                : learning
VM ID range                  : 9000-9999
Golden template               : VMID 9000, name tpl-ubuntu2404
Dedicated bridge              : vmbr-lab (VLAN tag 100 in these examples)
Lab subnet                    : 10.10.100.0/24, gateway 10.10.100.1
Tag on every object            : learning
```

**This mission's own conventions, used from here on:**

```
ZFS lab pool + Proxmox storage id  : lab-zfs
ZFS-backed test VM                  : VMID 9301, zfs-lab01, 10.10.100.131
Ceph lab pool + Proxmox storage id : lab-rbd (size 3, min_size 2)
Ceph-backed test VM                 : VMID 9310, ceph-lab01, 10.10.100.140
```

Every node is written as `pve1`/`pve2`/`pve3` below — replace with your real node names. This mission needs the safety contract's 3-or-more-node assumption to be literally true; Ceph with fewer than 3 hosts is not what this guide is describing, and the whole point of this mission is that your Ceph is real, not simulated.

**[ANY-NODE]** means run it once from any cluster node. **[EACH-NODE]** means run it separately, once per node. **[WORKSTATION]** means your own machine, not the cluster. Commands with no tag run wherever you already are (usually a VM's own shell over SSH).

Missions 01-03 are the prerequisite chain this one assumes done: the `learning` pool, `vmbr-lab`, the API token, and VMID 9000's template all need to already exist. If you have Mission 03's `modules/pve-vm` Terraform module available, you can use it to clone the test VMs in this mission instead of the raw `qm clone` commands below — its `disk` block currently hardcodes `datastore_id = "local-lvm"`, so you'd add a `datastore_id` variable to the module first and point it at `lab-zfs` or `lab-rbd`. This guide sticks to plain `qm` commands throughout so the storage mechanics stay the focus instead of Terraform plumbing; wiring the module up yourself afterward is a good way to double-check you actually understood what each storage backend needs.

---

## Phase 1 — storage recon

You cannot safely hand a disk to ZFS or Ceph without first knowing, with certainty, that nothing else is using it. This phase only reads.

**[EACH-NODE]** — current storage inventory:

```bash
pvesm status
```

Expected output: a table with columns `Name`, `Type`, `Status`, `Total`, `Used`, `Available`, `%` — this is every storage Proxmox already knows about on this node. Anything listed here is claimed; it is not a candidate for Phase 2 or Phase 4.

**[EACH-NODE]** — raw block device inventory:

```bash
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE
```

Expected output: a device tree. Look for a whole disk (`TYPE=disk`) with no children partitions, no `MOUNTPOINT`, and no `FSTYPE` — that's an unclaimed disk. A disk that shows up as a member of an existing `lvm`/`zfs_member`/`ceph_bluestore` device further down the tree is not spare, no matter how much free space `pvesm status` claims elsewhere on it.

Cross-check with the partition table directly, since `lsblk` can occasionally miss a device with a stale signature on it:

```bash
fdisk -l 2>/dev/null | grep -E "^Disk /dev"
wipefs -n /dev/sdX   # dry-run only — lists signatures found without touching anything
```

Expected output: `wipefs -n` on a genuinely unclaimed disk reports nothing found, or reports old signatures you recognize as safe to clear (e.g. a decommissioned test disk you already know about). If it reports an active LVM PV, filesystem, or Ceph signature you don't recognize, **stop** — that disk belongs to something.

**Decision tree — run this per node, not once for the whole cluster:**

```
Does this node have a whole disk that lsblk shows with no partitions,
no mountpoint, and no fstype, AND you can independently confirm
(asking whoever else has hands on this cluster) that it's not reserved
for anything?
│
├── YES → this is your real spare disk for this node.
│         Record its /dev path. Use it directly in Phase 2 (ZFS)
│         and/or Phase 4 (Ceph OSD).
│
├── NO, but there's unused free space inside an existing VG or
│    thin-pool on this node
│         → do NOT carve a new LV out of shared storage for this
│           mission. That's exactly the "storage change outside
│           dedicated lab resources" case the track's safety contract
│           requires a written change note for, and this mission
│           doesn't need it — the file-backed fallback below gets
│           you the same learning outcome with zero blast radius.
│
└── NO spare disk of any kind on this node
          → file-backed vdev fallback: create a sparse file inside
            an existing filesystem (sized well under its actual free
            space — check with `df -h`) and hand ZFS/Ceph that file
            (or a loop device wrapping it) instead of a raw disk.
            Exact commands are in Phase 2 and Phase 4. This is a
            deliberate, permanent part of this mission for any node
            that lacks spare hardware — not a lesser version of the
            exercise, just a different vdev source underneath the
            same ZFS/Ceph commands.
```

If even one node in your cluster lacks a spare disk, that's completely normal for a shared company cluster — use the fallback on that node and real disks on the others; ZFS pools and Ceph OSDs don't need to be symmetric across nodes to work, and mixing real-disk nodes with fallback nodes is a fine way to run the rest of this mission.

**Checkpoint:** you have a filled-in table, one row per node, recording: node name, chosen device (a real `/dev/sdX` path, or "file-backed fallback"), size, and the `pvesm status` output confirming that device isn't already claimed by anything Proxmox knows about. Do not proceed to Phase 2 until every node's row is filled from a command you actually ran, not an assumption.

---

## Phase 2 — ZFS pool, dataset, and replication

### Create the pool

**Real spare-disk case** — pick one node (`pve1` here) and its recon-confirmed spare device:

```bash
wipefs -a /dev/sdb
zpool create lab-zfs /dev/sdb
```

Expected output: silent on success (ZFS tools are quiet by design). Confirm:

```bash
zpool status lab-zfs
```

Expected output: `pool: lab-zfs`, `state: ONLINE`, a `config:` block showing `/dev/sdb` as the sole vdev with `0` under `READ`/`WRITE`/`CKSUM`.

**File-backed vdev fallback** — if Phase 1 found no spare disk on this node, ZFS is happy to use a plain file as a vdev instead of a block device:

```bash
mkdir -p /var/lib/lab-zfs-vdev
df -h /var/lib   # confirm real headroom before sizing the sparse file
truncate -s 20G /var/lib/lab-zfs-vdev/vdev0.img
zpool create lab-zfs /var/lib/lab-zfs-vdev/vdev0.img
```

Expected output: same `zpool status lab-zfs` result as above, except the `config:` block shows the file path instead of a device path. Keep in mind for Phase 7/8: a file-backed vdev sits on top of whatever filesystem and disk already back `/var/lib`, so its performance numbers describe that stack, not a dedicated ZFS disk — note this caveat next to any benchmark you take from a fallback node.

### Add it as Proxmox storage

```bash
pvesm add zfspool lab-zfs -pool lab-zfs -content images,rootdir
```

Expected output: silent on success. Confirm:

```bash
pvesm status
```

Expected output: a new row, `lab-zfs`, type `zfspool`, status `active`.

### Put a VM on it

```bash
qm clone 9000 9301 --name zfs-lab01 --pool learning --full 1 --storage lab-zfs
qm set 9301 --tags learning,zfs-lab
qm set 9301 --net0 virtio,bridge=vmbr-lab,tag=100
qm set 9301 --ipconfig0 ip=10.10.100.131/24,gw=10.10.100.1
qm start 9301
```

Expected output: each `qm set` is silent; `qm start` prints a short startup log. Confirm:

```bash
qm status 9301
ssh ubuntu@10.10.100.131 'hostname && df -hT / '
```

Expected output: `status: running`, and over SSH the root filesystem showing as mounted from a virtual disk with plenty of free space.

### Snapshot

```bash
zfs snapshot lab-zfs/vm-9301-disk-0@baseline
zfs list -t snapshot lab-zfs/vm-9301-disk-0
```

Expected output: one snapshot row, `lab-zfs/vm-9301-disk-0@baseline`, with a small `USED` value (snapshots are copy-on-write — this one costs almost nothing until the live dataset diverges from it).

### Replication to a second node

Proxmox's native storage replication (`pvesr`) is `zfs send`/`receive` under the hood, scheduled and orchestrated for you — this is the "native ZFS replication job" this mission wants, as opposed to hand-rolling `zfs send | ssh ... zfs receive` yourself or reaching for the older standalone `pve-zsync` tool (still available, and worth knowing exists, but `pvesr` is the integrated successor and what the GUI drives).

**GUI path:** Datacenter → VM `9301` → **Replication** tab → **Add** → Target = `pve2`, Schedule = every 15 minutes → Create.

**CLI equivalent:**

```bash
pvesr create-local-job 9301-0 pve2 --schedule "*/15"
```

Expected output: silent on success. Confirm:

```bash
pvesr list
```

Expected output: a row for job `9301-0`, target `pve2`, schedule `*/15`, with a `next-sync` timestamp roughly 15 minutes out.

Don't wait on the schedule — force one run now and watch it work:

```bash
pvesr run 9301-0 --verbose
```

Expected output: log lines showing the underlying `zfs send` stream flowing to `pve2` over SSH, ending with something like `(remote_finalize_local_job) delete stale replication snapshot 'lab-zfs/vm-9301-disk-0@__replicate_9301-0_...'` and no error. Confirm:

```bash
pvesr status
```

Expected output: job `9301-0` shows a recent `last_sync` timestamp and `fail_count: 0`.

Confirm the actual bytes landed on the target node:

```bash
ssh pve2 'zfs list -t all | grep 9301'
```

Expected output: `lab-zfs/vm-9301-disk-0` present on `pve2`, plus its own replication snapshot — a real, restorable copy of the disk sitting on a second node, even though the VM itself only runs on `pve1` right now.

### Failover test

The real value of storage replication shows up during a migration: `qm migrate` detects an existing replication job for a disk and reuses it — sending only what changed since the last sync instead of copying the whole disk again. Stop the VM first (an offline migration is enough to prove the mechanic; live migration on top of replicated storage is Mission 06's HA territory):

```bash
qm stop 9301
qm migrate 9301 pve2 --with-local-disks
```

Expected output: a migration log that explicitly mentions the existing replicated disk and completes in seconds rather than the minutes a full disk copy of the same size would take — look for a line naming `lab-zfs/vm-9301-disk-0` and an incremental send, not a fresh full-disk transfer. It ends with `migration finished successfully`.

Confirm the VM is now homed on `pve2` and still reachable:

```bash
qm start 9301
qm status 9301
ssh ubuntu@10.10.100.131 uptime
```

Expected output: `status: running`, and SSH still answers at the same `10.10.100.131` — the cloud-init network config carried over because the VM is still on the same lab subnet, just served from a different node's copy of the disk now.

**Checkpoint:** `pvesr status` shows a healthy job with `fail_count: 0`; `zfs list -t all` on `pve2` shows the replicated dataset independently of the migration; `qm migrate ... --with-local-disks` completed visibly using the existing replica (not a full resync) and the VM is running and SSH-reachable on `pve2` afterward.

---

## Phase 3 — Ceph concepts primer

Five pieces, and what each one is actually on the hook for:

**MON (Monitor).** Keeps the cluster's maps — which mons exist, which OSDs exist and their state, which pools exist, and the CRUSH topology — in sync across itself and every other mon via Paxos consensus. The cluster only serves I/O with a quorum (a strict majority) of mons reachable; lose quorum and the whole cluster stalls, even if every OSD's disk is perfectly healthy. Run an odd number, one per node on a 3-node cluster, so a single node loss still leaves a majority.

**MGR (Manager).** A companion daemon to the mons that runs modules — the dashboard, the PG autoscaler, Prometheus metrics export, balancer. It is not part of the write path or the quorum; the cluster keeps serving I/O with zero mgrs running. But specific things (autoscaling, dashboard, metrics) stop working without an active one, so production clusters run at least two — one active, the rest standby, ready to take over instantly if the active one dies.

**OSD (Object Storage Daemon).** One daemon per physical disk (or partition acting as one). Each OSD stores objects on its own disk and participates in replicating and recovering the objects CRUSH assigns to it. An OSD has two independent states worth reading separately: **up** (the daemon is reachable right now) and **in** (CRUSH is currently using it to place data). An OSD can be up-but-not-in (drained on purpose, e.g. before decommissioning) or in-but-not-up (down — the failure state you'll cause on purpose in Phase 6).

**Pool.** A logical container for objects with its own replication policy — `size` (how many copies) and `min_size` (the minimum copies that must be written before an I/O is acknowledged as durable) for replicated pools, or an erasure-coding profile instead. RBD images (what backs a VM disk), CephFS data, and RGW buckets all ultimately live inside some pool. This mission's pool is `lab-rbd`, size 3, min_size 2.

**PG (Placement Group).** Ceph doesn't track the location of every individual object — at real scale that lookup table would be enormous. Instead, every object hashes deterministically into one of a pool's fixed number of PGs, and CRUSH maps each *PG* (not each object) onto a set of OSDs — a size-3 pool means every PG maps to 3 OSDs. PG count is set at pool creation (or handled by the autoscaler) and controls how evenly data spreads and how much of the cluster can work in parallel during recovery.

**CRUSH (Controlled Replication Under Scalable Hashing).** The placement algorithm itself — given a PG number and the cluster's live topology (which hosts exist, which OSDs are on them, their weights), it computes which OSDs hold that PG's replicas, deterministically, with no central lookup table to keep in sync. Critically, CRUSH's default failure domain is the **host**, not the disk — so a size-3 pool's three replicas land on three different hosts, meaning an entire node going dark still leaves the other two replicas intact. This is the mechanism that makes Phase 6's drill survivable at all.

**Checkpoint:** without looking back at this page, say out loud (or write down) which of the five is responsible when: (1) the cluster refuses all writes even though every disk reports healthy — mon quorum; (2) the dashboard and PG autoscaler both stop responding — mgr; (3) `ceph -s` shows `58 osds: 57 up, 57 in` — one OSD's daemon is down; (4) a pool reports `128 pgs, size 3` and you need to know how many different hosts hold copies of any given object — PGs mapped by CRUSH across 3 hosts (the pool's size), not 128 different places.

---

## Phase 4 — lab Ceph install

**[EACH-NODE]** — install the Ceph packages Proxmox manages:

```bash
pveceph install --version reef
```

Expected output: an apt-style install log ending cleanly; confirm with `ceph --version`, expected `ceph version 18.x.x (...) reef (stable)`.

**[ANY-NODE]**, once — initialize the cluster's Ceph config, pointed at the lab subnet rather than the management network so lab traffic (including recovery traffic in Phase 6) stays on lab-only infrastructure:

```bash
pveceph init --network 10.10.100.0/24
```

Expected output: silent on success. This writes `/etc/pve/ceph.conf`, which is automatically shared cluster-wide through Proxmox's own cluster filesystem — every node sees it immediately, no manual copying needed. (A real production cluster typically splits this further into a separate `cluster_network` on a dedicated storage NIC for OSD-to-OSD replication traffic; this lab collapses both onto the one lab subnet, which is fine at this scale and worth noting as a simplification, not a lab-only gimmick.)

**[EACH-NODE]** — create a monitor:

```bash
pveceph mon create
```

Expected output: silent on success per node. After all three:

```bash
ceph -s
```

Expected output: a `mon:` line reading `3 daemons, quorum pve1,pve2,pve3`.

**[EACH-NODE]** — create a manager (at least two for real HA, all three costs nothing extra in a lab):

```bash
pveceph mgr create
```

Expected output: `ceph -s` now shows `mgr: pve1(active, since ...), standbys: pve2, pve3` (whichever node's mgr started first becomes active — that's expected and fine).

### OSDs

Using the device (or fallback) your Phase 1 recon table recorded for each node:

**Real spare-disk nodes:**

```bash
pveceph osd create /dev/sdb
```

Expected output: a log ending `created osd.0 on host 'pve1'` (numbers auto-increment cluster-wide — `osd.1` on the next node, `osd.2` after that, regardless of which node they're physically on).

**File-backed fallback nodes** — Ceph OSDs need a block device, not a plain file, so wrap the file in a loop device first:

```bash
mkdir -p /var/lib/lab-ceph-vdev
truncate -s 20G /var/lib/lab-ceph-vdev/osd0.img
losetup -f --show /var/lib/lab-ceph-vdev/osd0.img
```

Expected output: the last command prints the loop device it attached, e.g. `/dev/loop0`. Use that path:

```bash
pveceph osd create /dev/loop0
```

Expected output: same `created osd.N on host '...'` pattern as the real-disk case. **Note this limitation explicitly:** a loop-backed OSD does not survive a reboot on its own — the loop device needs re-attaching (a small systemd unit doing the `losetup` step at boot) before the OSD daemon can start again. That's an acceptable, deliberate lab-only shortcut; don't carry it into anything that matters.

Confirm every OSD across the whole cluster in one view:

```bash
ceph osd tree
```

Expected output: `root default` at the top, one `host` bucket per node, one `osd.N` leaf under each host, every one showing `STATUS up` and `REWEIGHT 1.00000`.

### Pool `lab-rbd`

```bash
pveceph pool create lab-rbd --size 3 --min_size 2 --add_storages 1
```

Expected output: a log ending with `pool lab-rbd: applying size = 3`, `pool lab-rbd: applying min_size = 2`, and `storage 'lab-rbd' successfully added`. Confirm:

```bash
pvesm status
```

Expected output: a new row, `lab-rbd`, type `rbd`, status `active`.

**A naming collision worth internalizing right now:** the `lab-rbd` **pool** you just created is a Ceph-layer object — a namespace with its own replication policy and PGs. It has nothing to do with the `learning` **resource pool** from Mission 01, which is a completely different, Proxmox-layer object that groups VMs for permissions. Both are called "pool" because English ran out of words before storage systems did. Most real confusion in Ceph incident channels traces back to exactly this overload — get used to disambiguating which "pool" a sentence means before you act on it.

### VM disk on Ceph

```bash
qm clone 9000 9310 --name ceph-lab01 --pool learning --full 1 --storage lab-rbd
qm set 9310 --tags learning,ceph-lab
qm set 9310 --net0 virtio,bridge=vmbr-lab,tag=100
qm set 9310 --ipconfig0 ip=10.10.100.140/24,gw=10.10.100.1
qm start 9310
```

Expected output: same pattern as Phase 2's VM — silent `qm set`s, a startup log from `qm start`. Confirm:

```bash
qm status 9310
ssh ubuntu@10.10.100.140 hostname
```

Expected output: `status: running`, SSH answers.

**Checkpoint:** `ceph -s` reports `HEALTH_OK` with 3 mons in quorum, an active mgr plus standbys, all OSDs `up`/`in`, and pool `lab-rbd` present at size 3/min_size 2; `qm config 9310` shows its disk on storage `lab-rbd`; the VM boots and answers SSH.

---

## Phase 5 — health reading

`ceph -s` is the single command you'll run most often for the rest of this mission — learn to read every line of it, not just the top word:

```bash
ceph -s
```

Expected shape (numbers will be yours):

```
  cluster:
    id:     3f2504e0-...
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum pve1,pve2,pve3 (age 2h)
    mgr: pve1(active, since 2h), standbys: pve2, pve3
    osd: 3 osds: 3 up (since 2h), 3 in (since 2h)

  data:
    pools:   2 pools, 33 pgs
    objects: 128 objects, 512 MiB
    usage:   1.6 GiB used, 58 GiB / 60 GiB avail
    pgs:     33 active+clean
```

Read it top to bottom: `health` is the one-word summary everyone jumps to (don't stop there); `mon:` line confirms quorum by name, not just a count; `mgr:` line names the active one and lists standbys; `osd:` line is the fastest way to catch a failure at a glance — `up` and `in` should always match the total unless something's actually wrong; `pgs:` line is the real state of the data — `active+clean` across all of them is the only fully-healthy answer, anything else is a state from the table below.

```bash
ceph osd tree
```

Expected shape:

```
ID  CLASS  WEIGHT   TYPE NAME       STATUS  REWEIGHT  PRI-AFF
-1         0.05878  root default
-3         0.01959      host pve1
 0    hdd  0.01959          osd.0       up   1.00000  1.00000
-5         0.01959      host pve2
 1    hdd  0.01959          osd.1       up   1.00000  1.00000
-7         0.01959      host pve3
 2    hdd  0.01959          osd.2       up   1.00000  1.00000
```

`WEIGHT` is the CRUSH weight (roughly, the disk's size in TB) determining how much data lands on it; `REWEIGHT` is a separate 0-1 dial used to temporarily shed load off an OSD without changing its CRUSH weight; `STATUS` is the `up`/`down` half of the two-state model from Phase 3 — `in`/`out` doesn't show as its own column here but shows up in the `osd:` summary line of `ceph -s` and in `ceph osd tree` as a `(out)` suffix on any OSD that's been explicitly marked out.

### PG-states table

| State | What it means | Worry? |
|---|---|---|
| `active+clean` | Steady state — all replicas in sync, serving reads and writes normally | No — this is the goal state |
| `degraded` | Fewer live copies than `size`, but at least `min_size` copies exist, so I/O still proceeds | Watch — expected during/after a single OSD failure, should self-resolve |
| `undersized` | Fewer live copies than `size` AND CRUSH cannot currently find enough distinct hosts/OSDs to place the missing replica(s) | Yes if it persists — means recovery has nowhere left to go |
| `backfilling` / `backfill_wait` | Data is actively (or about to be) copied onto a new or returning OSD to restore full redundancy | Watch — the visible "recovery in progress" state, resolves back to `active+clean` |
| `peering` | The OSDs responsible for this PG are negotiating which of them has the authoritative latest copy before serving I/O again | Yes if stuck more than a few seconds — should be nearly instantaneous |
| `stale` | No OSD has reported this PG's status recently at all | Yes — usually means OSDs actually crashed, not just went briefly quiet |
| `incomplete` | Not enough surviving OSDs even exist to know what should be in the PG | Yes — a genuine data-availability emergency |

**Checkpoint:** run `ceph -s` and `ceph osd tree` on your own cluster right now and correctly name the current PG state(s) shown against this table, out loud or in writing, before moving on.

---

## Phase 6 — failure drill

Get `fio` onto the Ceph-backed VM (9310) and start a sustained, direct-IO write workload — direct IO matters here, otherwise you'd just be benchmarking the guest's page cache instead of actually hitting Ceph:

```bash
ssh ubuntu@10.10.100.140
sudo apt-get update && sudo apt-get install -y fio
```

Expected output: fio installs cleanly; `fio --version` prints a version string.

Start the write load and leave this session running for the whole drill:

```bash
fio --name=osd-fail-drill --directory=/tmp --rw=randwrite --bs=4k --size=2G --numjobs=4 --iodepth=16 --direct=1 --time_based --runtime=300 --group_reporting
```

Expected output: fio begins printing periodic status lines (`Jobs: 4 (f=4): ...`) and keeps running for the full 300 seconds unless something stops it.

From a **second** terminal on any cluster node, check health, then kill an OSD:

```bash
ceph -s
systemctl stop ceph-osd@0
```

Expected output: within a few seconds, `ceph -s` flips from `HEALTH_OK` to `HEALTH_WARN`, the `osd:` line shows `2 up`, and the `pgs:` line shows PGs shifting into `active+undersized+degraded` (with `min_size 2` and `size 3`, losing exactly one OSD should keep every affected PG at least `active` — never `undersized` without `active`, which is precisely why `min_size 2` was the deliberate choice back in Phase 4).

Watch recovery happen in near-real-time:

```bash
watch -n2 ceph -s
```

Expected output: a `recovery:` line appears, reporting objects/bytes moving per second; the count of PGs in `active+undersized+degraded` (or similar) counts down toward zero while `active+clean` climbs back up, eventually returning the cluster to `HEALTH_OK` for everything except the still-stopped `osd.0` itself — that lingering `1 osds down` warning is expected, since this drill only stopped the daemon, it didn't remove or replace the OSD.

Back in the `fio` terminal, let the run finish and read its own summary:

Expected output: a final block showing `Jobs: 4 (f=0)`, a completed `WRITE: bw=... IOPS=...` summary line, and **zero** `err=` counts anywhere in the output — proof fio itself never saw an I/O error, despite an OSD having gone down mid-run.

Once `fio` finishes and Ceph is quiet again, check the guest filesystem for damage:

```bash
lsblk
sudo fsck -n /dev/vda1
```

(Adjust the device/partition to whatever `lsblk` actually shows as the VM's root partition.) Expected output: `fsck -n` (a dry-run, non-destructive check) reports the filesystem `clean` with zero errors found — the application-level proof that the guest never experienced corruption, even while its storage backend was actively short an OSD.

Bring the OSD back before continuing:

```bash
systemctl start ceph-osd@0
ceph -s
```

Expected output: `HEALTH_OK`, `osd: 3 osds: 3 up, 3 in`.

**Checkpoint: the guest filesystem checks clean (`fsck -n` reports no errors) after the full stop-OSD → degrade → recover → restart-OSD cycle, and fio's own summary shows zero errors for the entire run.** Save every terminal's output from this phase — it's the raw material for Prove-it below.

---

## Phase 7 — benchmarking

`rados bench` measures raw object-storage throughput/latency against the pool directly, with no VM or filesystem in between:

```bash
rados bench -p lab-rbd 60 write --no-cleanup
```

Expected output: a running per-second table, ending in a summary block reporting `Bandwidth (MB/sec)`, `Average Latency(s)`, and `Max latency(s)`.

```bash
rados bench -p lab-rbd 60 seq
rados bench -p lab-rbd 60 rand
```

Expected output: the same style of summary block for sequential and random reads of the objects the write pass left behind.

Clean the benchmark objects out of the pool afterward — they're not real data and shouldn't linger:

```bash
rados -p lab-rbd cleanup
```

Expected output: `Removed ... objects`.

`rbd bench` measures through the RBD image layer instead — closer to what a real VM disk actually experiences:

```bash
rbd create lab-rbd/bench-image --size 4G
rbd bench --io-type write --io-size 4K --io-threads 16 --io-total 1G lab-rbd/bench-image
```

Expected output: a summary reporting `elapsed`, total `ops`, `ops/sec`, and `bytes/sec`.

```bash
rbd rm lab-rbd/bench-image
```

Expected output: `Removing image: 100% complete...done.`

For a fair comparison point, re-run the exact `fio` invocation from Phase 6 against the ZFS-backed VM (9301) instead — same tool, same parameters, different storage backend underneath:

```bash
ssh ubuntu@10.10.100.131 'sudo apt-get update && sudo apt-get install -y fio && fio --name=zfs-compare --directory=/tmp --rw=randwrite --bs=4k --size=2G --numjobs=4 --iodepth=16 --direct=1 --time_based --runtime=60 --group_reporting'
```

Expected output: fio's usual summary block, this time describing the ZFS-backed disk.

Record every number you just produced before moving to Phase 8:

| Test | Bandwidth | Avg latency | Notes |
|---|---|---|---|
| `rados bench` write | _(your number)_ | _(your number)_ | |
| `rados bench` seq read | _(your number)_ | _(your number)_ | |
| `rados bench` rand read | _(your number)_ | _(your number)_ | |
| `rbd bench` write (4K) | _(your number)_ | — | ops/sec and bytes/sec instead |
| `fio` randwrite on `lab-rbd` VM (9310) | _(your number)_ | _(your number)_ | from Phase 6 |
| `fio` randwrite on `lab-zfs` VM (9301) | _(your number)_ | _(your number)_ | from this phase, file-backed-vdev caveat if applicable |

**Checkpoint:** every cell above holds a real figure copied from a command you ran on your own cluster just now — not a number remembered from documentation, not left blank.

---

## Phase 8 — decision doc

Write `docs/zfs-vs-ceph-decision.md` using the template below, filling every bracketed section with your own Phase 7 numbers and your own reasoning — not a generic "it depends."

```markdown
# ZFS vs Ceph — decision doc

## Measured performance (from Phase 7, this cluster, this hardware)

| Test | Result |
|---|---|
| rados bench write | (your number) |
| rados bench seq/rand read | (your numbers) |
| rbd bench write (4K) | (your number) |
| fio randwrite — Ceph-backed VM | (your number) |
| fio randwrite — ZFS-backed VM | (your number) |

## Failure domain and blast radius

- ZFS replication (this mission's `pvesr` job): asynchronous. Between sync
  intervals there is a real RPO window — data written to the source after
  the last sync and lost before the next one is gone. Failover requires an
  explicit migrate/start action; it is not automatic.
- Ceph (this mission's `lab-rbd` pool, size 3/min_size 2): synchronous
  within a write — an write isn't acknowledged until min_size copies exist
  on different hosts. Phase 6 proved a single-OSD failure is invisible to
  a running VM. RPO for a single-node failure is effectively zero.

## Node count and operational overhead

- ZFS + pvesr: works with as few as 2 nodes (source + one replication
  target). Operational surface is a pool, a dataset, and a scheduled job.
- Ceph: needs 3+ nodes to make its default host-level failure domain mean
  anything (this cluster has that). Operational surface is mons, mgrs,
  OSDs, pools, PGs, and CRUSH — meaningfully more to monitor and reason
  about than a ZFS pool, and it showed up directly in how much longer
  Phase 3-5 took versus Phase 2.

## Recommendation

- Workload: (name a real or plausible workload from your environment)
  Recommendation: (ZFS or Ceph) because (your reasoning, referencing the
  measured numbers and failure-domain differences above).
- Workload: (a second, different workload)
  Recommendation: (ZFS or Ceph) because (your reasoning).
```

An example of the kind of reasoning the recommendation sections should contain (write your own, don't copy this verbatim): a single standalone-ish host serving a workload that can tolerate a short async replication lag, where the operational simplicity of one pool and one scheduled job outweighs the cost of standing up quorum, favors ZFS. A workload spread across a real multi-node fleet, where a single node dying mid-write must not be visible to the application at all — the exact scenario Phase 6 proved — justifies Ceph's larger operational footprint because the alternative (async replication's RPO window) is the one thing this workload can't accept.

**Checkpoint:** the decision doc contains real numbers copied from your Phase 7 table (not placeholders) and a stated recommendation for at least two different workloads, each with reasoning that references your own measurements or your own Phase 6 observation, not received wisdom.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools from Phases 5-7, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — a PG stuck `undersized`

Setup: stop an OSD as in Phase 6, but this time also mark it out and leave it that way well past the point recovery would normally finish:

```bash
systemctl stop ceph-osd@0
ceph osd out 0
```

Then just wait and keep watching `ceph -s` and `ceph osd tree`.

Expected symptom: the cluster does not return to `HEALTH_OK` on its own. `ceph -s` keeps reporting a degraded-redundancy warning, and PGs that involve `osd.0` sit in `active+undersized+degraded` indefinitely rather than resolving. `ceph health detail` names the specific PGs.

<details>
<summary>Hint</summary>

Count your OSDs and your pool's `size` together: with only 3 OSDs total in this lab cluster and `size 3`, every PG's three replicas are already spread across all three hosts you have. Take one OSD out for good, and CRUSH has nowhere to put the missing third copy — there is no fourth host or spare OSD for it to use. That's structurally different from Phase 6's drill, where the OSD came back before CRUSH ever needed to solve that problem. The fix is either bringing `osd.0` back (`systemctl start ceph-osd@0`, `ceph osd in 0`) if it was only ever meant to be temporary, or, if you intend it gone for real, `pveceph osd destroy 0 --cleanup 1` followed by adding a genuine replacement OSD so CRUSH has three real homes again. Use `ceph health detail` to see the exact PG IDs affected and confirm they clear once you've acted.
</details>

### Drill 2 — a pool nearfull warning

Setup: push `lab-rbd`'s usage up past Ceph's default nearfull threshold by writing and keeping large benchmark objects instead of cleaning them up:

```bash
rados -p lab-rbd bench 300 write --no-cleanup
# repeat, or use a longer duration, until ceph df shows %USED climbing well past 80%
```

Expected symptom: `ceph -s` reports `HEALTH_WARN`, naming one or more `nearfull osd(s)` or the pool itself as nearfull; `ceph df` shows the pool's `%USED` above roughly 85%.

<details>
<summary>Hint</summary>

Ceph has two separate thresholds, and the distance between them is the whole point: `mon_osd_nearfull_ratio` (default 0.85) is a warning only — writes still succeed. `mon_osd_full_ratio` (default 0.95) is a hard stop — OSDs at or past it refuse new writes outright, and recovery/backfill can itself stall with a `backfill_too_full` condition if the OSDs it would write onto are this full. That "full" ratio is a deliberate safety limit protecting existing data from a disk that runs completely out of space, not a bug to route around. The correct fix in almost every real case is adding capacity or actually deleting data — here, that means `rados -p lab-rbd cleanup` to remove the benchmark objects you created, then confirming `ceph df` drops back under the nearfull line. `ceph osd set-nearfull-ratio` / `set-full-ratio` exist and are occasionally nudged temporarily during a monitored, in-progress capacity expansion — that is not the same thing as using them to make a real capacity problem stop being reported.
</details>

### Drill 3 — a replication job fails after a rename

Setup: stop the ZFS-backed VM first (renaming a zvol out from under a running VM is far more disruptive than this drill needs), then rename the dataset backing its disk without touching the `pvesr` job:

```bash
qm stop 9301
zfs rename lab-zfs/vm-9301-disk-0 lab-zfs/vm-9301-disk-0-renamed
pvesr run 9301-0 --verbose
```

Expected symptom: the replication run fails; `pvesr status` shows a non-zero `fail_count`, and the error references a dataset name that `zfs list` confirms no longer exists.

<details>
<summary>Hint</summary>

`pvesr list`/`pvesr status` and the verbose run output name the exact dataset path pvesr expected. Compare that directly against `zfs list -t all | grep 9301` to see what actually exists now. A VM's disk dataset name is derived from its Proxmox storage config (`qm config 9301`), not something meant to be renamed by hand outside of that config — renaming it independently breaks the link between what the VM references, what the replication job references, and what's actually on disk, all three of which were pointing at the same name a moment ago. The fix is renaming the dataset back to what `qm config` and the replication job both still expect, rather than trying to repoint the job at the new name — repointing would still leave the VM's own config referencing a disk that no longer exists under that name. Confirm the fix with a clean `pvesr run 9301-0 --verbose` and `fail_count` back at 0.
</details>

---

## Prove-it: OSD failure survived, on the record

Reuse Phase 6's drill exactly, but capture it deliberately this time as your evidence.

Start a timestamped `ceph -s` timeline in one terminal, before touching anything:

```bash
( while true; do date; ceph -s; echo "---"; sleep 10; done ) | tee /tmp/ceph-timeline.log
```

In a second terminal, on the VM (9310), start the write load and capture its full output:

```bash
ssh ubuntu@10.10.100.140 'fio --name=proveit --directory=/tmp --rw=randwrite --bs=4k --size=2G --numjobs=4 --iodepth=16 --direct=1 --time_based --runtime=180 --group_reporting' | tee /tmp/fio-output.log
```

While both are running, in a third terminal, kill an OSD exactly as in Phase 6:

```bash
systemctl stop ceph-osd@0
```

Let the timeline keep running until it shows `HEALTH_OK` again, then stop it (`Ctrl-C`) and restart the OSD:

```bash
systemctl start ceph-osd@0
```

Finally, confirm the guest filesystem, same as Phase 6:

```bash
ssh ubuntu@10.10.100.140 'sudo fsck -n /dev/vda1'
```

**What "done" looks like:** `ceph-timeline.log` shows a clear `HEALTH_OK` → `HEALTH_WARN` (OSD down, PGs degraded) → recovery → `HEALTH_OK` sequence with real timestamps; `fio-output.log` shows a completed run with zero `err=` counts, timestamped so it visibly overlaps the OSD-down window in the timeline log; and the `fsck -n` afterward reports clean. All three together, from the same run, are the deliverable — not a description of what would happen.

---

## Done when

- [ ] Phase 1 recon table complete for every node (spare disk or file-backed fallback decision, recorded from commands actually run)
- [ ] ZFS pool `lab-zfs` exists (real disk or file-backed), registered as Proxmox storage, hosting VM 9301
- [ ] A recurring `pvesr` replication job for 9301's disk to a second node, confirmed via `pvesr status` and independently via `zfs list` on the target
- [ ] `qm migrate ... --with-local-disks` failover test completed using the existing replica (visibly incremental), VM reachable on the second node afterward
- [ ] Ceph concepts primer written in your own words (mon/mgr/osd/pool/pg/crush), and the four "who's responsible when..." questions from Phase 3 answerable without notes
- [ ] Lab Ceph cluster healthy: 3 mons in quorum, an active mgr with standbys, all OSDs up/in, `HEALTH_OK`
- [ ] Pool `lab-rbd` at size 3/min_size 2, registered as Proxmox storage, backing VM 9310
- [ ] PG-states table filled in and matched against your own cluster's live state at least once
- [ ] OSD-failure drill completed: VM stayed up, `fio` finished error-free, `fsck -n` reports clean after recovery
- [ ] `rados bench`, `rbd bench`, and the comparable ZFS `fio` numbers all recorded with real figures, no blanks
- [ ] ZFS-vs-Ceph decision doc completed with your own measured numbers and a stated recommendation for at least two workloads
- [ ] All 3 break-fix drills solved by diagnosis before opening the hints
- [ ] Prove-it: `ceph-timeline.log` and `fio-output.log` on file, showing a live OSD-failure survival with zero filesystem errors
