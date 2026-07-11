# Guide — Mission 03: Storage Wars

Lab topology (from Mission 01, unchanged):

- Hyper-V internal switch: `LabSwitch`
- NAT subnet: `172.16.10.0/24`, gateway `172.16.10.1`
- VM naming: `lab-<role>`

This mission uses two VMs:

- **`lab-storage1`** at `172.16.10.30` — the primary storage lab VM, cloned from `tpl-ubuntu2404` using the Mission 01 clone procedure. All of Phases 0-6 and the break-fix drills run here unless stated otherwise.
- **`lab-storage2`** at `172.16.10.22` — the ZFS replication target used in Phase 4. Clone this from `tpl-ubuntu2404` too (this is one of the throwaway test VMs from Mission 01's prove-it if you kept it — otherwise clone a fresh one at this address).

Every command below states which machine it runs on: **[HOST]** = Windows PowerShell (admin), **[GUEST-1]** = bash on `lab-storage1`, **[GUEST-2]** = bash on `lab-storage2`.

**Disk reuse note:** `lab-storage1` gets exactly 4 virtual disks. No phase needs all 4 at once, but across the whole mission they get wiped and repurposed several times — that's deliberate. Real ops work is constantly reclaiming capacity from one thing to hand it to another. Each phase tells you exactly what to wipe before it starts.

---

## Phase 0 — Attach the virtual disks

**[HOST]** — confirm `lab-storage1` exists and is running (clone it now per the Mission 01 procedure if you haven't):

```powershell
Get-VM -Name "lab-storage1" | Select-Object Name, State
```

Expected: `State : Running`.

**[HOST]** — create 4 new 5GB dynamic VHDX files and attach them live. Gen-2 VMs use a SCSI controller, so this works without shutting the VM down:

```powershell
1..4 | ForEach-Object {
    $path = "D:\HyperV\lab-storage1\disk$_.vhdx"
    New-VHD -Path $path -SizeBytes 5GB -Dynamic
    Add-VMHardDiskDrive -VMName "lab-storage1" -Path $path
}
```

Expected output: 4 `VHD` objects printed (one per `New-VHD` call), no errors from `Add-VMHardDiskDrive`.

**[HOST]** — confirm all 4 are attached:

```powershell
Get-VMHardDiskDrive -VMName "lab-storage1" | Select-Object ControllerType, ControllerNumber, ControllerLocation, Path
```

Expected: 5 rows total — the original OS disk plus 4 new disks at `disk1.vhdx` through `disk4.vhdx`.

**[GUEST-1]** — rescan SCSI and confirm the new disks appear without a reboot:

```bash
for h in /sys/class/scsi_host/host*/scan; do echo "- - -" | sudo tee "$h" > /dev/null; done
lsblk
```

Expected: `lsblk` lists `sda` (OS disk) plus `sdb`, `sdc`, `sdd`, `sde`, each 5G, with no partitions yet.

**Checkpoint:** `lsblk` on `lab-storage1` shows 5 disks total, 4 of them (`sdb`-`sde`) at 5G with no children. Do not continue until all 4 appear — if one is missing, re-run the SCSI rescan loop or reboot the VM.

---

## Phase 1 — Partitioning with gdisk

**[GUEST-1]** — install gdisk:

```bash
sudo apt update && sudo apt install -y gdisk
```

Expected: `gdisk` installed, no errors.

**[GUEST-1]** — partition `sdb` with a GPT table and one partition spanning the whole disk, type `8300` (Linux filesystem) reset to `8e00` (Linux LVM) since it'll be an LVM PV. Run gdisk interactively:

```bash
sudo gdisk /dev/sdb
```

At the prompts, type exactly:

```
n        (new partition)
1        (partition number 1, press Enter to accept default)
         (press Enter to accept default first sector)
         (press Enter to accept default last sector, uses whole disk)
8e00     (partition type: Linux LVM)
w        (write table to disk)
Y        (confirm)
```

Expected output after `w`: `The operation has completed successfully.`

**[GUEST-1]** — repeat for `sdc` with the same type (`8e00`, LVM):

```bash
sudo gdisk /dev/sdc
```

Same sequence: `n`, `1`, Enter, Enter, `8e00`, `w`, `Y`.

**[GUEST-1]** — repeat for `sdd` and `sde`, this time using type `fd00` (Linux RAID autodetect) since these will start life as mdadm members:

```bash
sudo gdisk /dev/sdd
sudo gdisk /dev/sde
```

Same sequence but type `fd00` instead of `8e00`.

**Checkpoint:**

```bash
sudo gdisk -l /dev/sdb /dev/sdc /dev/sdd /dev/sde 2>/dev/null | grep -E "Disk /dev|8e00|fd00"
```

Expected: 4 disk headers, `sdb1`/`sdc1` showing code `8e00`, `sdd1`/`sde1` showing code `fd00`. Do not continue to Phase 2 if any partition is missing or has the wrong type — partition type codes are just labels here, but get the habit right now because production disk audits check them.

---

## Phase 2 — LVM

### Build the stack

**[GUEST-1]** — create physical volumes on `sdb1` and `sdc1`:

```bash
sudo pvcreate /dev/sdb1 /dev/sdc1
```

Expected:
```
Physical volume "/dev/sdb1" successfully created.
Physical volume "/dev/sdc1" successfully created.
```

**[GUEST-1]** — create the volume group `labvg`:

```bash
sudo vgcreate labvg /dev/sdb1 /dev/sdc1
```

Expected: `Volume group "labvg" successfully created`. Confirm size:

```bash
sudo vgs labvg
```

Expected: `VSize` around `9.99g` (two 5GB partitions minus GPT/LVM metadata overhead).

**[GUEST-1]** — create two logical volumes, one for each filesystem type:

```bash
sudo lvcreate -n lv_ext4 -L 3G labvg
sudo lvcreate -n lv_xfs -L 3G labvg
```

Expected: `Logical volume "lv_ext4" created.` and `Logical volume "lv_xfs" created.` — leaves about 4G free in the VG for the extend step later.

**[GUEST-1]** — format and mount both:

```bash
sudo mkfs.ext4 /dev/labvg/lv_ext4
sudo mkfs.xfs /dev/labvg/lv_xfs
sudo mkdir -p /mnt/lv_ext4 /mnt/lv_xfs
sudo mount /dev/labvg/lv_ext4 /mnt/lv_ext4
sudo mount /dev/labvg/lv_xfs /mnt/lv_xfs
```

Expected: both `mkfs` commands print a filesystem summary ending without errors; both `mount` commands return silently.

**Checkpoint:**

```bash
df -hT /mnt/lv_ext4 /mnt/lv_xfs
```

Expected: two rows, `ext4` at ~2.9G and `xfs` at ~3.0G, both mounted.

### Online extend

**[GUEST-1]** — write a marker file so you can prove data survives the extend:

```bash
echo "before-extend" | sudo tee /mnt/lv_ext4/marker.txt
```

**[GUEST-1]** — extend the VG with the third disk, live:

```bash
sudo gdisk -l /dev/sdd | grep 8e00 || echo "retype sdd1 to 8e00 first"
sudo sgdisk -t 1:8e00 /dev/sdd
sudo vgextend labvg /dev/sdd1
```

Expected: `Volume group "labvg" successfully extended`.

**[GUEST-1]** — extend `lv_ext4` by 2G and grow the filesystem in the same command, while it's mounted and in use:

```bash
sudo lvextend -r -L +2G /dev/labvg/lv_ext4
```

Expected output ends with `Filesystem at /dev/mapper/labvg-lv_ext4 is mounted on /mnt/lv_ext4; on-line resizing required` followed by `The filesystem on /dev/mapper/labvg-lv_ext4 is now 1310720 (4k) blocks long.` The `-r` flag resizes the underlying filesystem automatically — no separate `resize2fs` needed.

**Checkpoint:**

```bash
lvs labvg
cat /mnt/lv_ext4/marker.txt
```

Expected: `lvs` shows `lv_ext4` at `5.00g` (up from `3.00g`); `marker.txt` still reads `before-extend` — the extend didn't touch existing data.

### Snapshot and revert

**[GUEST-1]** — snapshot `lv_ext4` before making a risky change:

```bash
sudo lvcreate -s -n lv_ext4_snap -L 1G -n lv_ext4_snap /dev/labvg/lv_ext4
```

Expected: `Logical volume "lv_ext4_snap" created.`

**[GUEST-1]** — simulate a mistake: overwrite the marker file:

```bash
echo "OOPS-overwritten" | sudo tee /mnt/lv_ext4/marker.txt
cat /mnt/lv_ext4/marker.txt
```

Expected: prints `OOPS-overwritten`.

**[GUEST-1]** — revert to the snapshot. The origin volume must be unmounted first for a merge:

```bash
sudo umount /mnt/lv_ext4
sudo lvconvert --merge /dev/labvg/lv_ext4_snap
```

Expected: `Merging of volume labvg/lv_ext4_snap started.` followed by a completion message. Because the origin was open, the merge completes on next activation.

**[GUEST-1]** — reactivate and remount:

```bash
sudo lvchange -an labvg/lv_ext4
sudo lvchange -ay labvg/lv_ext4
sudo mount /dev/labvg/lv_ext4 /mnt/lv_ext4
cat /mnt/lv_ext4/marker.txt
```

**Checkpoint:**

```bash
lvs labvg
```

Expected: `marker.txt` reads `before-extend` again (the snapshot merge reverted the overwrite), and `lvs` shows `lv_ext4_snap` gone (merged snapshots remove themselves) with `lv_ext4` still present.

### Teardown (frees disks for Phase 3)

**[GUEST-1]** — this mission's 4-disk lab means LVM's disks get reclaimed for the RAID phase. Tear the stack down cleanly:

```bash
sudo umount /mnt/lv_ext4 /mnt/lv_xfs
sudo lvremove -y labvg/lv_ext4 labvg/lv_xfs
sudo vgremove labvg
sudo pvremove /dev/sdb1 /dev/sdc1 /dev/sdd1
sudo wipefs -a /dev/sdb1 /dev/sdc1 /dev/sdd1
```

Expected: each command confirms removal (`Logical volume "lv_ext4" successfully removed`, `Volume group "labvg" successfully removed`, `Labels on physical volume ... successfully wiped`, `/dev/sdb1: 2 bytes were erased` etc.).

**Checkpoint:** `sudo lvs; sudo vgs; sudo pvs` all print nothing — no LVM objects left. `lsblk` still shows the `sdb1`/`sdc1`/`sdd1` partitions (gdisk's GPT table is untouched, only the LVM signature is wiped).

---

## Phase 3 — mdadm software RAID

### RAID1: build, fail, hot-rebuild

**[GUEST-1]** — install mdadm:

```bash
sudo apt install -y mdadm
```

**[GUEST-1]** — build a 2-disk RAID1 array on `sdb1` and `sdc1`:

```bash
sudo mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sdb1 /dev/sdc1
```

Expected: `mdadm: Defaulting to version 1.2 metadata` then `mdadm: array /dev/md0 started.`

**[GUEST-1]** — read the array state:

```bash
cat /proc/mdstat
```

Expected: a block showing `md0 : active raid1 sdc1[1] sdb1[0]` with `[2/2] [UU]` (both members up) — it may show `resync` in progress first; wait for it to finish with `watch cat /proc/mdstat` if so.

**[GUEST-1]** — format and mount it, write a marker:

```bash
sudo mkfs.ext4 /dev/md0
sudo mkdir -p /mnt/raid1
sudo mount /dev/md0 /mnt/raid1
echo "raid1-data" | sudo tee /mnt/raid1/marker.txt
```

**[GUEST-1]** — fail a member on purpose:

```bash
sudo mdadm /dev/md0 --fail /dev/sdc1
cat /proc/mdstat
```

Expected: `/proc/mdstat` shows `[2/1] [U_]` and `sdc1[1](F)` — one member marked failed.

**[GUEST-1]** — remove the failed member and hot-add the spare (`sdd1`) to rebuild:

```bash
sudo mdadm /dev/md0 --remove /dev/sdc1
sudo mdadm /dev/md0 --add /dev/sdd1
watch -n1 cat /proc/mdstat
```

Watch until the `recovery` line disappears (Ctrl+C once done).

**Checkpoint:**

```bash
cat /proc/mdstat
cat /mnt/raid1/marker.txt
```

Expected: `md0 : active raid1 sdd1[2] sdb1[0]` with `[2/2] [UU]` — clean, rebuilt, and `marker.txt` still reads `raid1-data`. Do not continue if state shows anything other than `[UU]`.

### Teardown RAID1, build RAID5

**[GUEST-1]** — tear down the RAID1 array to free all 3 disks:

```bash
sudo umount /mnt/raid1
sudo mdadm --stop /dev/md0
sudo wipefs -a /dev/sdb1 /dev/sdc1 /dev/sdd1
```

Expected: `mdadm: stopped /dev/md0`, then wipefs confirmations for all 3.

**[GUEST-1]** — build a fresh 3-disk RAID5 array:

```bash
sudo mdadm --create /dev/md1 --level=5 --raid-devices=3 /dev/sdb1 /dev/sdc1 /dev/sdd1
```

Expected: `mdadm: array /dev/md1 started.`

**[GUEST-1]** — format and mount:

```bash
sudo mkfs.ext4 /dev/md1
sudo mkdir -p /mnt/raid5
sudo mount /dev/md1 /mnt/raid5
```

**Checkpoint:**

```bash
cat /proc/mdstat
```

Expected: `md1 : active raid5 sdd1[2] sdc1[1] sdb1[0]` with `[3/3] [UUU]` once resync finishes (RAID5 initial resync on 5GB members takes a couple of minutes — check with `watch`). Do not continue until state is clean.

**[GUEST-1]** — tear down `md1` too, to free all 3 disks for ZFS. (You will rebuild a throwaway RAID5 for the break-fix drill later — see the note there.)

```bash
sudo umount /mnt/raid5
sudo mdadm --stop /dev/md1
sudo wipefs -a /dev/sdb1 /dev/sdc1 /dev/sdd1
```

---

## Phase 4 — ZFS

### Install and build the pool

**[GUEST-1]** — install ZFS userland tools:

```bash
sudo apt install -y zfsutils-linux
```

Expected: installs cleanly, may prompt to build a DKMS module — accept defaults.

**[GUEST-1]** — wipe the GPT partition tables gdisk left on `sdb`/`sdc` in Phase 1 (ZFS wants whole disks, not partitions), then build a mirrored pool named `tank`:

```bash
sudo wipefs -a /dev/sdb /dev/sdc
sudo zpool create tank mirror /dev/sdb /dev/sdc
```

Expected: no output on success (ZFS is silent). Confirm:

```bash
sudo zpool status tank
```

Expected: `pool: tank`, `state: ONLINE`, a `mirror-0` vdev listing `sdb` and `sdc`, both `ONLINE`, `errors: No known data errors`.

### Datasets, compression, quota

**[GUEST-1]** — create a dataset with compression and a quota:

```bash
sudo zfs create -o compression=lz4 -o quota=2G tank/data
```

Expected: dataset appears mounted at `/tank/data` automatically. Confirm:

```bash
zfs get compression,quota tank/data
```

Expected: `compression  lz4  local` and `quota  2G  local`.

**[GUEST-1]** — write test data and confirm compression is doing something:

```bash
sudo dd if=/dev/zero of=/tank/data/testfile bs=1M count=200
zfs list -o name,used,avail,refer,compressratio tank/data
```

Expected: `compressratio` greater than `1.00x` (zeros compress extremely well — expect something like `200x` or higher, since this is a trivial worst-case test for compression).

### Snapshot and rollback

**[GUEST-1]** — snapshot, then change data, then roll back:

```bash
sudo zfs snapshot tank/data@before-change
echo "modified" | sudo tee /tank/data/testfile > /dev/null
sudo zfs rollback tank/data@before-change
ls -la /tank/data/testfile
```

Expected: after rollback, `testfile` is back to its pre-snapshot 200M size — `zfs rollback` discards everything written after the snapshot.

**Checkpoint:**

```bash
zfs list -t snapshot
```

Expected: `tank/data@before-change` listed.

### Replication: zfs send | ssh | zfs recv

**[GUEST-2]** — on `lab-storage2` (172.16.10.22), install ZFS and create a receiving pool backed by a sparse file (no extra virtual disk needed on this VM):

```bash
sudo apt install -y zfsutils-linux
sudo truncate -s 5G /var/lib/zfs-target.img
sudo zpool create tank /var/lib/zfs-target.img
```

Expected: `zpool status tank` on `lab-storage2` shows `ONLINE` with the file-backed vdev.

**[GUEST-2]** — create the `lab` account used for the replication stream, and delegate just enough ZFS permission instead of using root over SSH:

```bash
sudo useradd -m -s /bin/bash lab
sudo passwd lab
sudo zfs allow lab create,mount,receive,destroy tank
mkdir -p ~lab/.ssh && sudo chown lab:lab ~lab/.ssh
```

**[GUEST-1]** — copy your SSH key to `lab-storage2` so the send doesn't hang on a password prompt:

```bash
ssh-copy-id lab@172.16.10.22
```

Expected: `Number of key(s) added: 1`. Confirm with `ssh lab@172.16.10.22 whoami` → prints `lab`.

**[GUEST-1]** — send a snapshot of `tank/data` to `lab-storage2` over SSH:

```bash
sudo zfs snapshot tank/data@replica-01
sudo zfs send tank/data@replica-01 | ssh lab@172.16.10.22 "zfs recv tank/data"
```

Expected: no output (send/recv are silent on success); the SSH connection closes cleanly when the stream finishes.

**Checkpoint (on GUEST-2):**

```bash
zfs list tank/data
ls /tank/data/testfile
```

Expected: `tank/data` listed with `USED` roughly matching the source, and `testfile` present with the same size as on `lab-storage1` — the replica exists and holds the same data.

---

## Phase 5 — LUKS with auto-unlock

**[GUEST-1]** — you have `sdd` and `sde` still free. Wipe `sdd`'s leftover partition signature and encrypt the whole disk:

```bash
sudo wipefs -a /dev/sdd
sudo cryptsetup luksFormat /dev/sdd
```

You'll be prompted: type `YES` (all caps) to confirm, then set and confirm a passphrase. Expected: `Command successful.`

**[GUEST-1]** — open it once manually to build the filesystem:

```bash
sudo cryptsetup open /dev/sdd secure_vol
sudo mkfs.ext4 /dev/mapper/secure_vol
sudo mkdir -p /mnt/secure
sudo mount /dev/mapper/secure_vol /mnt/secure
echo "encrypted-data" | sudo tee /mnt/secure/marker.txt
sudo umount /mnt/secure
sudo cryptsetup close secure_vol
```

**[GUEST-1]** — create a keyfile so boot doesn't need an interactive passphrase, and add it as an additional LUKS key slot:

```bash
sudo mkdir -p /etc/luks-keys
sudo dd if=/dev/urandom of=/etc/luks-keys/sdd.key bs=512 count=4
sudo chmod 400 /etc/luks-keys/sdd.key
sudo cryptsetup luksAddKey /dev/sdd /etc/luks-keys/sdd.key
```

You'll be prompted once for the original passphrase to authorize adding the new key. Expected: no error, returns to prompt.

**[GUEST-1]** — get the LUKS UUID and wire up `/etc/crypttab`:

```bash
sudo blkid -s UUID -o value /dev/sdd
```

Copy the printed UUID, then add this line to `/etc/crypttab` (replace `<UUID>` with the value you copied):

```
secure_vol UUID=<UUID> /etc/luks-keys/sdd.key luks
```

**[GUEST-1]** — add the mount to `/etc/fstab` so it mounts automatically once unlocked:

```
/dev/mapper/secure_vol /mnt/secure ext4 defaults 0 2
```

**[GUEST-1]** — restrict permissions on the keyfile's directory and update the initramfs so it's available early enough at boot:

```bash
sudo chmod 700 /etc/luks-keys
sudo update-initramfs -u
```

**[GUEST-1]** — reboot and verify:

```bash
sudo reboot
```

**[HOST]** — reconnect after a minute:

```powershell
ssh labadmin@172.16.10.30
```

**Checkpoint:**

```bash
lsblk /dev/sdd
cat /mnt/secure/marker.txt
```

Expected: `lsblk` shows `sdd` with a `crypt` child mapped to `secure_vol`, mounted at `/mnt/secure` with no passphrase prompt during boot; `marker.txt` reads `encrypted-data`. Do not consider this phase done if the boot log (`journalctl -b | grep secure_vol`) shows a prompt was needed.

---

## Phase 6 — XFS project quota

This uses a loopback-mounted image file rather than one of the 4 physical disks, so it doesn't compete with the ZFS pool or LUKS volume you just built for deliverables.

**[GUEST-1]** — create a 1GB sparse file and format it xfs with quota support:

```bash
sudo truncate -s 1G /var/lib/xfsquota.img
sudo mkfs.xfs /var/lib/xfsquota.img
sudo mkdir -p /mnt/xfsquota
```

**[GUEST-1]** — mount it with project quotas enabled:

```bash
sudo mount -o loop,prjquota /var/lib/xfsquota.img /mnt/xfsquota
```

Expected: mounts silently. Confirm:

```bash
mount | grep xfsquota
```

Expected: shows `pquota` (or `prjquota`) in the mount options.

**[GUEST-1]** — define project 1 as a directory, apply a 100MB limit:

```bash
sudo mkdir -p /mnt/xfsquota/tenant-a
echo "1:/mnt/xfsquota/tenant-a" | sudo tee -a /etc/projects
echo "tenant-a:1" | sudo tee -a /etc/projid
sudo xfs_quota -x -c 'project -s tenant-a' /mnt/xfsquota
sudo xfs_quota -x -c 'limit -p bhard=100m tenant-a' /mnt/xfsquota
```

Expected: `project -s` prints `Setting up project tenant-a...` and processes the directory.

**[GUEST-1]** — try to exceed the limit:

```bash
dd if=/dev/zero of=/mnt/xfsquota/tenant-a/bigfile bs=1M count=150
```

Expected: `dd` stops early with `No space left on device` once it hits ~100MB, even though the filesystem itself has room.

**Checkpoint:**

```bash
sudo xfs_quota -x -c 'report -p' /mnt/xfsquota
```

Expected: a report row for project `#1` (`tenant-a`) showing blocks used near the `100m` hard limit.

---

## Break-fix drills

Diagnose before opening hints. State the symptom, form a hypothesis, test it.

**Drill 1 — disk pulled from RAID5 mid-write**

Your original RAID5 (`md1`) was torn down in Phase 3 to free disks for ZFS — don't touch your ZFS pool or LUKS volume to redo this drill. Instead, attach 3 fresh scratch disks first:

```powershell
1..3 | ForEach-Object {
    $path = "D:\HyperV\lab-storage1\drill1-$_.vhdx"
    New-VHD -Path $path -SizeBytes 5GB -Dynamic
    Add-VMHardDiskDrive -VMName "lab-storage1" -Path $path
}
```

**[GUEST-1]** — rescan, build a throwaway RAID5 across the 3 new disks (same commands as Phase 3), mount it, then start a continuous write:

```bash
sudo mkfs.ext4 /dev/md2
sudo mkdir -p /mnt/drill1
sudo mount /dev/md2 /mnt/drill1
dd if=/dev/zero of=/mnt/drill1/bigwrite bs=1M count=2000 status=progress
```

While the `dd` is running, ask Claude, in this session, to yank one of the three scratch disks:

```powershell
Remove-VMHardDiskDrive -VMName "lab-storage1" -ControllerType SCSI -ControllerNumber 0 -ControllerLocation <location-of-drill-disk>
```

Symptom: `dd` may pause or throw I/O errors, and `cat /proc/mdstat` shows the array degraded. Diagnose the array's state and recover it — restore full redundancy without losing the data already written — before reading the hint.

**Drill 2 — filesystem full, but `du` disagrees with `df`**

**[GUEST-1]** — ask Claude, in this session, to run this sabotage on your `/tank/data` ZFS dataset or on `/mnt/lv_ext4`-style ext4 mount (pick any mounted filesystem you still have):

```bash
sudo bash -c '
exec 9> /mnt/secure/hidden.tmp
dd if=/dev/zero of=/proc/self/fd/9 bs=1M count=$(( $(df --output=avail /mnt/secure | tail -1) / 1024 - 5 )) 2>/dev/null
rm -f /mnt/secure/hidden.tmp
sleep 3600 &
'
```

Symptom: `df -h /mnt/secure` reports the filesystem nearly full, but `du -sh /mnt/secure` (or `du -sh` on any subdirectory) accounts for far less space than `df` says is used, and there's no visible file explaining the gap. Diagnose why space is "missing" and free it without rebooting the VM.

**Drill 3 — logical volume deleted**

This drill needs a live LVM VG, which you tore down at the end of Phase 2. Attach 2 fresh scratch disks and rebuild a small VG first:

```powershell
1..2 | ForEach-Object {
    $path = "D:\HyperV\lab-storage1\drill3-$_.vhdx"
    New-VHD -Path $path -SizeBytes 5GB -Dynamic
    Add-VMHardDiskDrive -VMName "lab-storage1" -Path $path
}
```

**[GUEST-1]** — partition both new disks (same `gdisk` steps as Phase 1, type `8e00`), then build a VG called `drillvg` with one LV `drilllv`, format and mount it, and — important — take a metadata backup snapshot on purpose so you have something to restore from:

```bash
sudo gdisk /dev/sdf   # n, 1, Enter, Enter, 8e00, w, Y
sudo gdisk /dev/sdg   # same sequence
sudo pvcreate /dev/sdf1 /dev/sdg1
sudo vgcreate drillvg /dev/sdf1 /dev/sdg1
sudo lvcreate -n drilllv -L 2G drillvg
sudo mkfs.ext4 /dev/drillvg/drilllv
sudo vgcfgbackup drillvg
```

Then ask Claude, in this session, to delete the LV without your involvement:

```bash
sudo lvremove -f /dev/drillvg/drilllv
```

Symptom: `lvs drillvg` no longer lists `drilllv`, and the data is gone from `/dev/mapper/drillvg-drilllv` (device node itself is gone). Diagnose what LVM still remembers about the deleted LV and recover it using the metadata backup — before reading the hint.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `mdadm --detail /dev/md2` tells you exactly which member is missing and what state the array is in. A replacement member re-added with `mdadm --add` triggers the same recovery you already did in Phase 3 — the process is identical, just under load this time.
- Drill 2: a `dd` process holding a file descriptor open to a file it already `rm`'d keeps the blocks allocated until the process exits — `du` walks the directory tree (which no longer lists the file) while `df` reports actual block usage (which still includes it). `lsof +L1` or `lsof | grep deleted` finds file descriptors pointing at unlinked files.
- Drill 3: `vgcfgbackup` writes to `/etc/lvm/backup/<vgname>` every time VG metadata changes, and LVM also auto-backs-up before destructive operations into `/etc/lvm/archive/`. `vgcfgrestore` can replay one of those files — but it restores metadata, not data blocks, so timing matters: restore before anything overwrites the freed extents.

</details>

---

## Prove-it challenge

**Migrate a live directory from your LVM ext4 volume to a ZFS dataset with under 60 seconds of unavailability.**

Requirements:

1. Write your cutover plan first, in a file `cutover-plan.md` in this mission folder, before touching anything. State: what "unavailable" means for this migration (reads blocked? writes blocked? both?), the exact sequence of commands you'll run, your rollback trigger (the condition under which you abort and revert), and how you'll measure the downtime window.
2. Pick or recreate a small LVM ext4 volume with live data being written to it (a loop that appends a timestamp every second is a reasonable stand-in for "live").
3. Execute the cutover to a ZFS dataset (`tank/migrated` or similar) using your plan.
4. Prove the downtime: show a timestamped log (from the writer loop, or from a script timing the switch) demonstrating the gap between last write to the old location and first successful write to the new one was under 60 seconds.

Acceptance criteria: `cutover-plan.md` exists and predates the migration (check with `ls -la --time-style=full-iso`), the ZFS dataset holds all data that existed on the ext4 volume before cutover, and your timestamped evidence shows the gap.

<details>
<summary>Hints (open only when stuck)</summary>

- A final incremental sync right before the cutover window (rsync, or a final `zfs receive` if you're clever enough to stream directly) shrinks the window to "just the pointer swap," not "the whole dataset copy."
- Decide up front whether the writer target is a mount point path or a symlink — swapping a symlink atomically is far faster than remounting.

</details>

---

## Done when

- [ ] LVM stack built (ext4 + xfs LVs), `lv_ext4` extended live to 5G with `lvextend -r` while mounted, data intact
- [ ] LVM snapshot taken, a change made, and the change reverted via `lvconvert --merge`
- [ ] mdadm RAID1 built, one member failed and hot-rebuilt back to `[UU]` clean state
- [ ] mdadm RAID5 built across 3 disks, reached clean `[UUU]` state
- [ ] ZFS mirrored pool `tank` built with a compressed, quota'd dataset
- [ ] ZFS snapshot taken and rolled back successfully
- [ ] `zfs send | ssh | zfs recv` replica of `tank/data` present and verified on `lab-storage2`
- [ ] LUKS volume on `sdd` auto-unlocks at boot via crypttab + keyfile, verified across an actual reboot
- [ ] XFS project quota enforced and demonstrated with a write that hits the limit
- [ ] All 3 break-fix drills solved and diagnosis documented before hints were opened
- [ ] Prove-it cutover plan written before migration; migration executed with under 60 seconds of proven unavailability
