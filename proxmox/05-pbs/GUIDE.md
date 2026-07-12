# Guide — Mission 05: PBS

This is not a script to paste blindly — this is a live company cluster, and this mission's whole point is proving your backups actually work, which only means something if you did the work yourself. Read each phase, run the commands, and look at the actual output before moving on.

Conventions used throughout, carried forward from Missions 01-03, plus the ones this mission adds:

```
Resource pool                  : learning
VM ID range                    : 9000-9999
Golden template                 : VMID 9000, name tpl-ubuntu2404 (Ubuntu 24.04, cloud-init + qemu-guest-agent baked in)
Dedicated bridge                : vmbr-lab (VLAN tag 100 in these examples)
Lab subnet                      : 10.10.100.0/24, gateway 10.10.100.1
PVE API token                   : learn@pve!tf
Tag on every object             : learning

New this mission:
PBS VM                          : VMID 9005, hostname pbs1, 10.10.100.5
PBS web UI                      : https://10.10.100.5:8007
PBS primary datastore           : learning-ds1, backed by /datastore
PBS sync-target datastore       : learning-ds2, backed by /datastore2
PBS user for the PVE link       : learn@pbs, API token learn@pbs!pve-sync
PVE storage ID for PBS          : pbs-learning
Two lab VMs used in this mission : lab-vm1 (VMID 9101, 10.10.100.101), lab-vm2 (VMID 9102, 10.10.100.102)
```

Every node is written as `pve1` below — replace it with your real node name. In a real deployment, a backup server is usually parked on its own management segment, separate from the guest network it protects, precisely so that whatever takes out your guest network doesn't also take out your only path to the backups. This lab reuses `vmbr-lab` for simplicity, consistent with the safety contract in `proxmox/README.md` — note the tradeoff, don't just repeat it at work without thinking about it.

## Starting point

If Mission 02 is done, you already have a golden template at VMID 9000 and know the clone/network/tag pattern. If you don't already have at least two lab VMs sitting around, make two now — this mission needs real guests to back up:

```bash
qm clone 9000 9101 --name lab-vm1 --pool learning --full
qm clone 9000 9102 --name lab-vm2 --pool learning --full
qm set 9101 --tags learning --net0 virtio,bridge=vmbr-lab,tag=100 --ipconfig0 ip=10.10.100.101/24,gw=10.10.100.1
qm set 9102 --tags learning --net0 virtio,bridge=vmbr-lab,tag=100 --ipconfig0 ip=10.10.100.102/24,gw=10.10.100.1
qm start 9101
qm start 9102
```

Expected output: no errors; `qm status 9101` and `qm status 9102` both report `status: running` within a minute or two.

---

## Phase 1 — install PBS as a VM on the cluster

PBS ships as its own ISO installer — a real Debian-based install, not a cloud-init template. This is the one interactive OS install in this whole track; everything else you've built so far was a clone.

**Sizing guidance, and why:** PBS's own hard rule of thumb is roughly 1GB of RAM per 1TB of datastore, on top of a sane baseline, because garbage collection keeps chunk digests in memory while it works. For this lab:

- 2 vCPU, 4GB RAM (bump to 8GB if you plan on backing up more than a couple hundred GB of lab VMs)
- A 32GB disk for the OS — small, because the OS never needs to grow
- A **separate, dedicated disk** for the datastore, added *after* install, sized at roughly 3-5x the combined logical size of everything you intend to back up. Deduplication and compression usually make real usage much smaller than that, but plan for the ceiling, not the optimistic case — you'll see exactly why in break-fix drill 2.

Keeping the datastore on its own disk (not sharing the OS disk) means a full datastore never has a chance of taking the OS down with it, and growing or replacing the datastore later is a storage-layer operation, not a reinstall.

Download the PBS ISO from proxmox.com and upload it to a PVE ISO storage (Datacenter → local storage → ISO Images → Upload, or `pvesm` if you prefer the CLI), then create the VM:

```bash
qm create 9005 --name pbs1 --pool learning --tags learning \
  --memory 4096 --cores 2 --cpu host \
  --net0 virtio,bridge=vmbr-lab,tag=100 \
  --scsihw virtio-scsi-pci \
  --scsi0 local-lvm:32 \
  --ide2 local:iso/proxmox-backup-server_3.2-1.iso,media=cdrom \
  --boot order=ide2 \
  --ostype l26
qm start 9005
```

Expected output: no errors; `qm status 9005` reports `running`.

Open the VM's console (GUI: click `pbs1` → Console) and run the graphical installer: accept the license, pick the 32GB disk, set your timezone, set a root password you'll actually remember, and configure networking by hand — static IP `10.10.100.5/24`, gateway `10.10.100.1`, since PBS doesn't get cloud-init. Reboot when it finishes.

Confirm the web UI is reachable:

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://10.10.100.5:8007
```

Expected output: `200`.

Log in at `https://10.10.100.5:8007` as `root@pam` with the password you set. Now add the dedicated datastore disk — hot-add it to the running VM from the PVE side:

```bash
qm set 9005 --scsi1 local-lvm:200
```

Expected output: `update VM 9005: -scsi1 local-lvm:200`.

Inside `pbs1` (SSH or console), format and mount it:

```bash
lsblk
sudo mkfs.ext4 /dev/sdb
sudo mkdir -p /datastore
sudo mount /dev/sdb /datastore
echo "$(sudo blkid -s UUID -o value /dev/sdb) /datastore ext4 defaults 0 2" | sudo tee -a /etc/fstab
```

Expected output: `lsblk` shows `sdb` with no partitions yet (the new 200GB disk); `mkfs.ext4` ends with a summary block and no errors; after the `fstab` line is added, `mount | grep /datastore` shows it mounted from `/dev/sdb`.

**Checkpoint:** `pbs1` boots, is reachable over HTTPS on `10.10.100.5:8007`, sits in the `learning` pool, is tagged `learning`, and has two disks — a 32GB OS disk and a 200GB disk mounted at `/datastore` and persisted in `/etc/fstab`.

---

## Phase 2 — datastore, PVE-facing user, and adding PBS as PVE storage

Create the datastore on the dedicated disk from Phase 1:

```bash
proxmox-backup-manager datastore create learning-ds1 /datastore
```

Expected output: no error; `proxmox-backup-manager datastore list` shows `learning-ds1` pointed at `/datastore`.

Don't hand PVE your `root@pam` credentials for this — create a dedicated PBS user scoped to exactly the datastore permissions it needs, the same least-privilege habit Mission 01 built for the PVE side:

```bash
proxmox-backup-manager user create learn@pbs --email learn@company.local
proxmox-backup-manager user generate-token learn@pbs pve-sync
```

Expected output: the `generate-token` command prints a JSON block containing `"value"` — the token secret. Copy it now; like every API token in this track, it's shown exactly once.

Grant it exactly what PVE needs — backup, restore, and prune on this one datastore, nothing store-wide:

```bash
proxmox-backup-manager acl update /datastore/learning-ds1 DatastorePowerUser --auth-id 'learn@pbs!pve-sync'
```

Expected output: no error. Confirm:

```bash
proxmox-backup-manager acl list | grep learning-ds1
```

Expected output: a line showing `/datastore/learning-ds1`, `learn@pbs!pve-sync`, `DatastorePowerUser`.

Grab the server's certificate fingerprint — PVE needs this to trust the connection instead of blindly trusting whatever's listening on that IP:

```bash
proxmox-backup-manager cert info | grep Fingerprint
```

Expected output: a line like `Fingerprint (sha256): AB:CD:...`.

Now, on any PVE node (or the GUI: Datacenter → Storage → Add → Proxmox Backup Server):

```bash
pvesm add pbs pbs-learning \
  --server 10.10.100.5 \
  --datastore learning-ds1 \
  --username 'learn@pbs!pve-sync' \
  --password '<paste the token secret from generate-token>' \
  --fingerprint 'AB:CD:...(paste the fingerprint you just read)'
```

Expected output: no error. Confirm:

```bash
pvesm status
```

**Checkpoint:** `pvesm status` shows `pbs-learning` with `Active` = `1`, and the same storage shows a green status icon in the PVE GUI under Datacenter → Storage. If it shows red, re-check the fingerprint first — a mismatched fingerprint is the single most common reason this fails.

---

## Phase 3 — backup job, pool-based selection, and encryption keys

### The backup job

Datacenter → Backup → Add (or the CLI equivalent, `pvesh create /cluster/backup`). Configure it as pool-based, not VM-by-VM — point it at the `learning` pool so any VM added to that pool later (which every learning VM must be, per the safety contract) gets backed up automatically with zero extra config:

- **Selection mode:** Pool based → `learning`
- **Storage:** `pbs-learning`
- **Schedule:** daily, `02:00`
- **Mode:** Snapshot

```bash
pvesh create /cluster/backup --schedule "02:00" --pool learning --storage pbs-learning --mode snapshot --enabled 1 --id learning-nightly
```

Expected output: no error; `pvesh get /cluster/backup` lists a job with `id: learning-nightly`.

### Encryption — read this whole section before running anything

PBS backups can be encrypted client-side: the key never leaves the PVE node, PBS itself only ever stores and serves opaque encrypted chunks, and it cannot decrypt them for you even if you ask nicely. That's the entire security value of client-side encryption — and the entire risk.

> **WARNING — read this twice.** If you lose this encryption key and have no working backup of it, every encrypted snapshot in this datastore becomes permanently, cryptographically unrecoverable. Not by Proxmox. Not by anyone. There is no backdoor, no support ticket, no password reset, no "contact support with your account details." A backup you cannot decrypt is functionally the same as no backup at all, except it also cost you the disk space. Treat this key like a spare key to a safety deposit box, not like a sticky note on the monitor.

Generate the key on the PVE node (this is the node that will encrypt/decrypt, not PBS itself):

```bash
proxmox-backup-client key create /etc/pve/priv/storage/pbs-learning.enc
```

Expected output: prompts for a passphrase twice, then prints the key's fingerprint. PVE will automatically use this file for every backup job targeting the `pbs-learning` storage from now on — the filename convention `<storeid>.enc` is what makes that automatic.

Passphrases get forgotten. Build yourself an escape hatch *now*, before you need it — a master keypair that can recover the raw key even if the passphrase is gone:

```bash
proxmox-backup-client key create-master-key
```

Expected output: creates `master-public.pem` and `master-private.pem` in your working directory. `master-public.pem` gets registered against your encryption key (so PVE can, on request, produce a copy of the raw key encrypted to this master key instead of to your passphrase); `master-private.pem` is what actually recovers it later, and it must be stored somewhere that survives the loss of this VM — not on `pbs1`, not only on the PVE node, somewhere physically separate.

Now make the paper backup — an actual, scannable, printable copy of the key:

```bash
proxmox-backup-client key paperkey /etc/pve/priv/storage/pbs-learning.enc --output-format html > pbs-learning-paperkey.html
```

Expected output: an HTML file containing a QR code and the human-readable key material. **Print it.** Put the printout somewhere physically secure — a locked drawer, a safe, anywhere that isn't "the same rack this VM lives in." If the building housing `pbs1` and the PVE node both burns down, the paper copy in a fireproof safe (or offsite) is what saves the data; a second digital copy sitting next to the first one saves you from nothing.

**Checkpoint:** `proxmox-backup-client key create` succeeded and PVE lists an encryption key for `pbs-learning` (Datacenter → Storage → pbs-learning → Encryption Key shows a fingerprint, not "none"). A master keypair exists, with the private half stored somewhere other than `pbs1` or the PVE node. A printed paper-key copy exists and you know exactly where it's physically stored right now, without checking notes. Run the job once by hand and confirm it lands encrypted:

```bash
vzdump 9101 --storage pbs-learning --mode snapshot
```

Expected output: ends in `INFO: Finished Backup of VM 9101`. In the PBS GUI, the snapshot under `learning-ds1` shows a lock icon, confirming it's encrypted.

---

## Phase 4 — prune schedule and garbage collection

### Retention math

Unpruned backups grow forever. A prune job doesn't delete data directly — it decides which *snapshots* (manifests) are allowed to still exist; garbage collection afterward reclaims the disk space of any chunk no longer referenced by a surviving snapshot. Configure both, and be deliberate about the shape of the retention, not just the numbers.

Example policy — `keep-last=3, keep-daily=7, keep-weekly=4, keep-monthly=6, keep-yearly=1`:

| Rule | Count | What it actually keeps | Reaches back to roughly |
|---|---|---|---|
| `keep-last` | 3 | The 3 most recent snapshots outright, regardless of any other bucket | The last 3 backup runs |
| `keep-daily` | 7 | The most recent snapshot of each calendar day | 1 week |
| `keep-weekly` | 4 | The most recent snapshot of each ISO week, once dailies age out | ~1 month |
| `keep-monthly` | 6 | The most recent snapshot of each calendar month, once weeklies age out | ~6 months |
| `keep-yearly` | 1 | The most recent snapshot of the calendar year | Into last year |

Run this nightly for a full year and the naive sum (3+7+4+6+1=21) overstates the real count — today's backup is simultaneously "most recent" for `keep-last`, `keep-daily`, `keep-weekly`, `keep-monthly`, and `keep-yearly` at the same time, so the rules overlap on the newest snapshots rather than stacking. Steady state settles closer to 18-20 snapshots per VM, not 365, and not unbounded. That's the entire point: cheap fine-grained recovery for anything recent, cheap coarse recovery for anything old, and a number you can actually predict and budget disk space against — which is exactly the number break-fix drill 2 will make you wish you'd calculated ahead of time.

Note also: without `keep-yearly`, nothing survives past the `keep-monthly` window — six months from now, last January's backup is gone. Whether that's fine depends entirely on what you (or a compliance policy) actually need; decide it on purpose, don't let it happen by default.

Configure it:

```bash
proxmox-backup-manager prune-job create learning-nightly-prune \
  --store learning-ds1 --schedule "03:00" \
  --keep-last 3 --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-yearly 1
```

Expected output: no error; `proxmox-backup-manager prune-job list` shows the job.

Run it once by hand to see the effect before waiting for the schedule:

```bash
proxmox-backup-manager prune-job run learning-nightly-prune
```

Expected output: a table listing each snapshot as `keep` or `remove`.

### Garbage collection

```bash
proxmox-backup-manager garbage-collection start learning-ds1
```

Expected output: progress lines ending in `Removed garbage: X.XX GiB`, `Original data usage: ...`, `On-Disk usage: ...`.

Read the deduplication factor from the PBS GUI's Datastore → `learning-ds1` → Summary panel. It's the ratio of logical backed-up data to what's actually sitting on disk. Because `lab-vm1` and `lab-vm2` are both clones of the same `tpl-ubuntu2404` template, expect this number to be noticeably higher than a single VM backed up alone would produce — every OS-level chunk unmodified since the template is shared once, across every VM's snapshots, not stored per-VM. That cross-VM sharing, not just cross-snapshot sharing within one VM, is most of what a healthy dedup factor is telling you.

**Checkpoint:** the prune job ran and reduced the snapshot list to the retention shape in your table above; garbage collection completed with a `Removed garbage` line; you can state the datastore's current deduplication factor from the GUI and explain in one sentence why it's higher than "just this VM's own repeated backups" would produce.

---

## Phase 5 — verify jobs

A disk doesn't announce when it silently flips a bit — no read error, no SMART alert, just a chunk that now decodes to something other than what was written. That's bitrot, and the failure mode is uniquely bad: the corruption sits there, unnoticed, for however long it takes until the one day you actually need to restore that exact chunk — at which point you find out your backup was broken, at the worst possible moment to discover it.

Verify jobs exist specifically to move that discovery from "during the incident" to "during a quiet Tuesday": PBS reads every chunk back and checks it against the SHA-256 digest recorded when it was written, on a schedule, whether or not anyone is about to need a restore.

```bash
proxmox-backup-manager verify-job create learning-verify \
  --store learning-ds1 --schedule "sun 04:00" --ignore-verified true --outdated-after 30
```

Expected output: no error; `proxmox-backup-manager verify-job list` shows the job.

Run it once by hand:

```bash
proxmox-backup-manager verify-job run learning-verify
```

Expected output: a per-snapshot pass/fail list ending in `TASK OK` if everything checks out.

**Checkpoint:** the verify job is scheduled and has completed at least one manual run with `TASK OK` against every current snapshot. You can explain, without notes, why a backup that "exists" and a backup that has been "recently verified" are two different claims.

---

## Phase 6 — restore drills

### Full VM restore to a new VMID, timed

Never restore over the original VMID for a drill — a new, unused ID proves the restore is self-contained and leaves the original untouched if something goes wrong.

Find the backup volid to restore:

```bash
pvesm list pbs-learning --content backup | grep 9101
```

Expected output: a line like `pbs-learning:backup/vm/9101/2026-07-10T02:00:00Z`.

Time the actual restore, not a guess after the fact:

```bash
time qmrestore pbs-learning:backup/vm/9101/2026-07-10T02:00:00Z 9501 --storage local-lvm
```

Expected output: progress lines ending in `TASK OK`, followed by `time`'s own `real` line — write that number down, it's the timed measurement the prove-it section grades against.

```bash
qm start 9501
qm status 9501
```

Expected output: `status: running`.

### Single-file restore from an encrypted backup

The File Restore feature browses inside a snapshot without restoring the whole disk, by booting a lightweight ephemeral helper VM against the backup image. In the PVE GUI: pbs-learning storage → Backups → select a `lab-vm1` snapshot → **File Restore**. Because this backup is encrypted (Phase 3), the browser prompts for the encryption passphrase before it can open anything — the same passphrase you set when you ran `key create`, which is exactly why losing it is not a minor inconvenience.

CLI equivalent, run against the same snapshot:

```bash
proxmox-file-restore list pbs-learning:backup/vm/9101/2026-07-10T02:00:00Z /etc/hostname
proxmox-file-restore extract pbs-learning:backup/vm/9101/2026-07-10T02:00:00Z /etc/hostname --output-format zip > hostname-restore.zip
```

Expected output: `list` shows the file's path and size; `extract` produces a small zip containing the file, unchanged from the moment of that snapshot.

### Live-restore — what it is, and when it's actually safe

The Restore dialog offers a **Live Restore** checkbox: the VM boots immediately, and a background process keeps streaming the remaining disk blocks from PBS while it runs, pulling any block the guest touches on demand if it hasn't arrived yet.

Safe to reach for: genuine "minutes matter" triage, where getting *something* booted right now is worth more than ideal I/O performance for the next several minutes — or just confirming a backup boots at all, fast.

Not safe to treat as finished: production cutover before the background restore has actually completed (check the task log for its own completion, not just "VM is running"), or any workload that hammers random I/O across the whole disk immediately (a database doing a full scan on boot) — that pattern fights the background restore for the same blocks and can make both slower than a plain restore would have been. It also has a hard dependency the plain restore doesn't: if PBS becomes unreachable mid-live-restore, the VM can hang or fail on the next block it needs that hasn't arrived yet. Use it to get eyes on a system fast; don't call the incident closed until the background restore reports done.

**Checkpoint:** VM 9501 exists, is running, and its restore time is written down. A single file has been pulled from an encrypted snapshot and its contents confirmed correct. You can state, in one sentence each, when live-restore is the right call and what specifically breaks if you treat it as a substitute for waiting out a real restore.

---

## Phase 7 — sync job: an offsite stand-in

A real offsite copy lives on a second physical PBS server, somewhere your building's fire/flood/theft risk doesn't reach. This lab only has one PBS VM, so build the mechanism honestly with a second datastore standing in for "somewhere else" — the sync-job configuration is identical either way; only the "somewhere else" part is simulated here.

Add a second disk and datastore:

```bash
qm set 9005 --scsi2 local-lvm:100
```

Inside `pbs1`:

```bash
sudo mkfs.ext4 /dev/sdc
sudo mkdir -p /datastore2
sudo mount /dev/sdc /datastore2
echo "$(sudo blkid -s UUID -o value /dev/sdc) /datastore2 ext4 defaults 0 2" | sudo tee -a /etc/fstab
proxmox-backup-manager datastore create learning-ds2 /datastore2
```

Expected output: `datastore list` now shows both `learning-ds1` and `learning-ds2`.

Sync jobs pull from a configured **Remote** into a local datastore. With only one physical PBS box, register this same server as its own Remote — it proves the pull mechanism end to end without needing second hardware:

```bash
proxmox-backup-manager remote create pbs-self \
  --host 10.10.100.5 --auth-id 'learn@pbs!pve-sync' \
  --password '<the pve-sync token secret from Phase 2>' \
  --fingerprint 'AB:CD:...(same fingerprint from Phase 2)'
```

Expected output: no error; `proxmox-backup-manager remote list` shows `pbs-self`.

```bash
proxmox-backup-manager sync-job create learning-offsite-sync \
  --remote pbs-self --remote-store learning-ds1 \
  --store learning-ds2 --schedule "hourly"
proxmox-backup-manager sync-job run learning-offsite-sync
```

Expected output: progress lines showing chunks pulled, ending `TASK OK`.

**Checkpoint:**

```bash
proxmox-backup-manager datastore list
```

Then compare snapshot listings — `learning-ds2` should show the same VM snapshots as `learning-ds1` after the sync job runs. Only new or changed chunks transfer on each run, the same incremental principle that makes the nightly backups themselves cheap. In a real deployment, `--host` would point at a second PBS server's real address at another site, and everything else about this configuration is unchanged.

---

## Phase 8 — monitoring hook (forward reference only)

Nothing to build in this phase — just don't lose track of two facts proxmox/09 (Cluster Watchtower) will need: the datastore name `learning-ds1`, and the fact that PBS exposes its own datastore usage, task history, and verify/GC status through its API and native Metrics Server (Configuration → Metrics Server in the PBS GUI). Mission 09 wires PVE and PBS metrics into the same Grafana instance node_exporter already feeds, so a stale backup or a shrinking dedup factor shows up on a dashboard instead of requiring someone to remember to log into PBS and look. Nothing to configure here — just note it, since 09 will reuse this datastore and this token rather than asking you to build a second one.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — backup fails with "guest agent not running"

Setup: stop the `qemu-guest-agent` service inside `lab-vm1` (`sudo systemctl stop qemu-guest-agent`), leave the VM running, then trigger a manual backup:

```bash
vzdump 9101 --storage pbs-learning --mode snapshot
```

Expected symptom: the job doesn't necessarily fail outright — read the log closely. It likely completes, but with a warning about the guest agent being unreachable and the freeze/thaw (fsfreeze) step being skipped.

<details>
<summary>Hint</summary>

Snapshot-mode backups without a responding guest agent still take a disk-level snapshot — but without `fsfreeze-freeze` / `fsfreeze-thaw` calls into the guest first, that snapshot is only *crash-consistent*, not *application-consistent*. Crash-consistent means: equivalent to what the disk would look like if you'd yanked the power cord at that exact instant — a journaling filesystem usually recovers from that fine on boot, but anything with in-flight application writes (a database mid-transaction, a file being rewritten in place) is not guaranteed to come back clean, because nothing told the guest "quiesce your writes, I'm about to snapshot you." The fix is making sure `qemu-guest-agent` is actually running and the VM's Agent option is enabled *before* backups are relied on, not discovering the gap during a real restore.
</details>

### Drill 2 — restore fails because the datastore is full

Setup: this one is about space you didn't plan for, in either direction. First, fill `learning-ds1` close to its limit — repeatedly clone and back up disposable VMs (or just shrink the datastore disk in a scratch copy of this lab) until free space on `/datastore` is nearly zero, then attempt a restore.

Expected symptom: the restore fails partway, or refuses to start, with an I/O or "no space left on device" style error — even though a restore mostly *reads* from the datastore rather than writing to it.

<details>
<summary>Hint</summary>

Two separate space traps live here, and the fix for each is planning, not panic. First: PBS needs working room even during operations that look read-only from the outside — task logs, temporary state, and GC/verify bookkeeping all need somewhere to write, and a datastore at true 100% can refuse operations broadly rather than fail gracefully on just the write it needed. Second, and easy to miss: the *destination* storage a restore writes to needs free space equal to the full logical (uncompressed, undeduplicated) size of the disk being restored — PBS's compact deduplicated on-disk usage number is not the number that matters here, and someone who only ever looked at that small number can be genuinely surprised when the restore target runs out of room. The real fix, in both directions: size datastores with real headroom (a commonly cited rule is keeping at least 10-20% free at all times) using the retention math from Phase 4, not the smallest number that happened to fit today, and separately confirm the restore *destination* storage has room for the full-size disk before you start timing anything.
</details>

### Drill 3 — a verify job finds a corrupt chunk

Setup: after Phase 5's verify job has a clean baseline, corrupt a chunk file directly on disk to simulate real bitrot (do this only on a disposable lab datastore, never anywhere real):

```bash
sudo find /datastore/.chunks -type f | head -n 1 | xargs -I{} sudo sh -c 'echo corrupted >> {}'
proxmox-backup-manager verify-job run learning-verify
```

Expected symptom: the verify job reports a failure against one or more snapshots that reference the corrupted chunk, instead of the clean `TASK OK` from Phase 5.

<details>
<summary>Hint</summary>

Do not panic-delete anything, and do not run garbage collection immediately — GC's job is reclaiming *unreferenced* space, not fixing a *referenced, corrupted* chunk, and running it in a hurry doesn't help here. First, read exactly which snapshot(s) the verify log flags as affected — a single corrupt chunk usually only invalidates the specific snapshots that reference it, and older or newer snapshots that don't share that chunk may still be perfectly good, which is itself worth confirming rather than assuming the whole VM's history is gone. Second, immediately back up the live guest again, right now, so you have a known-good current snapshot regardless of what happened to the old one — the priority order is "stop the bleeding," then "understand the wound." Third, actually investigate: a corrupt chunk at the PBS layer almost always points at a problem one layer down — failing disk sectors, a RAID/controller issue, or (if you're on ZFS) a scrub will tell you definitively whether this is isolated or systemic. Treat one corrupt chunk as a symptom to investigate, not just a snapshot to write off.
</details>

---

## Prove-it: destroy something on purpose, restore it within a stated RTO

Write the RTO worksheet **before** you break anything — you're graded against these numbers, and an RTO you can't actually hit is worse than no RTO written at all:

| Scenario | System | RTO | Justification |
|---|---|---|---|
| Single-file restore | `lab-vm1` | 10 min | Small, targeted, no full boot required — File Restore should be fast |
| Full VM restore | `lab-vm2` | 30 min | Full disk restore + boot + a real service check, not just "files exist" |

Adjust the numbers to your own judgment, but write them down first, in this repo or on your workstation, before the drills below.

**File-level drill.** First, plant a canary so you have something exact to prove recovery against, and make sure it's actually captured by a backup:

```bash
echo "pbs-mission-canary-$(date +%s)" | sudo tee /etc/pbs-mission-canary.txt
vzdump 9101 --storage pbs-learning --mode snapshot
cat /etc/pbs-mission-canary.txt
```

Now delete it and start the clock:

```bash
sudo rm /etc/pbs-mission-canary.txt
date
```

Restore just that file using Phase 6's file-restore procedure, then stop the clock the moment its contents are confirmed:

```bash
proxmox-file-restore extract pbs-learning:backup/vm/9101/<snapshot-with-the-canary> /etc/pbs-mission-canary.txt --output-format zip > canary-restore.zip
unzip -p canary-restore.zip etc/pbs-mission-canary.txt
date
```

Expected output: the extracted file's contents match exactly what you wrote before deleting it, and the elapsed wall-clock time between the two `date` calls is your real measurement.

**Full-VM drill.** Destroy `lab-vm2` entirely — not a snapshot rollback, an actual destroy:

```bash
date
qm stop 9102
qm destroy 9102 --purge
```

The instant that command returns, your clock is running. Restore it fully to a new VMID, boot it, and confirm it's genuinely working, not just present:

```bash
pvesm list pbs-learning --content backup | grep 9102
time qmrestore pbs-learning:backup/vm/9102/<latest-snapshot> 9502 --storage local-lvm
qm start 9502
qm status 9502
ssh ubuntu@10.10.100.102 'systemctl is-active qemu-guest-agent'
date
```

Expected output: `qm status 9502` reports `running`; the SSH check reports `active`; the elapsed time between the destroy and this final confirmation is your real measurement.

Write both results down next to your RTO table — met or missed, and by how much, honestly. A missed RTO you understand and can explain is a more useful outcome than a met RTO you got lucky on.

**Checkpoint:** the canary file's exact content was recovered via file-restore, and `lab-vm2` was fully destroyed and rebuilt via a timed full restore with its guest agent confirmed active afterward — both measured against the RTO table you wrote before either drill started, with the actual elapsed time recorded for each.

---

## Done when

- [ ] `pbs1` (VMID 9005) is running, tagged `learning`, in the `learning` pool, with the datastore on its own dedicated disk separate from the OS disk
- [ ] `learning-ds1` exists, and `pbs-learning` shows `Active: 1` / green in the PVE GUI, added using a fingerprint-verified connection and a least-privilege `learn@pbs!pve-sync` token
- [ ] A pool-based, encrypted, scheduled backup job covers the `learning` pool; an encryption key, a master keypair, and a printed paper-key backup all exist, and you can say exactly where the paper copy is stored right now
- [ ] A prune job with a stated retention policy runs on schedule, and you can explain the retention math in your own words without notes
- [ ] Garbage collection has run at least once, and you can state the datastore's current deduplication factor and why it's as high as it is
- [ ] A verify job is scheduled, has completed at least one clean manual run, and you can explain why bitrot detection matters even when nothing looks wrong
- [ ] A full VM restore to a new VMID has been performed and timed; a single-file restore from an encrypted backup has been performed and confirmed correct; you can state when live-restore is safe to use and when it isn't
- [ ] A sync job to `learning-ds2` runs and its content mirrors `learning-ds1`
- [ ] All 3 break-fix drills reproduced, diagnosed from the symptom, and fixed before opening the hints
- [ ] Prove-it complete: a canary file recovered via file-restore, and a fully destroyed VM rebuilt via a timed full restore — both measured against an RTO written down before either drill started, with the result (met or missed, by how much) recorded honestly
