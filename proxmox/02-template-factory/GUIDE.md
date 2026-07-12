# Guide — Mission 02: Template Factory

Conventions used throughout this mission (from Mission 01):

- Resource pool: `learning`
- VM ID range: `9000-9999`
- Dedicated bridge: `vmbr-lab` (lab VLAN tag `100` in the examples below — substitute your own tag if Mission 01 set a different one)
- Tag on every object: `learning`
- API token (for the prove-it script's API variant): `learn@pve!tf`

Every command states the node it runs on as **[NODE]** — run these as `root` on any node in the cluster, either at the console or over SSH. Guest-side commands are marked **[GUEST]**. Replace `pve1` with your actual node name.

Example lab subnet used in this guide: `10.10.100.0/24`, gateway `10.10.100.1`. Adjust to match your `vmbr-lab` addressing from Mission 01.

---

## Phase 1 — Base VM shell

Every template starts life as an ordinary VM. This phase gets a bootable disk attached; Phase 2 makes it cloud-init aware.

**[NODE pve1]** — download the Ubuntu 24.04 cloud image:

```bash
mkdir -p /var/lib/vz/template/iso
cd /var/lib/vz/template/iso
wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
```

Expected output: a progress bar ending in `'noble-server-cloudimg-amd64.img' saved`. Confirm the file landed:

```bash
ls -lh /var/lib/vz/template/iso/noble-server-cloudimg-amd64.img
```

Expected: a single file, roughly 600M.

**[NODE pve1]** — create the VM shell at VMID 9000, in the `learning` pool, tagged `learning`, on `vmbr-lab`:

```bash
qm create 9000 \
  --name tpl-ubuntu2404 \
  --pool learning \
  --tags learning \
  --memory 2048 \
  --cores 2 \
  --cpu host \
  --net0 virtio,bridge=vmbr-lab,tag=100 \
  --scsihw virtio-scsi-pci \
  --agent enabled=1 \
  --serial0 socket \
  --vga serial0 \
  --ostype l26
```

Expected output: none (`qm create` is silent on success). Confirm it exists:

```bash
qm config 9000
```

Expected: a config block showing `name: tpl-ubuntu2404`, `pool: learning`, `tags: learning`, `agent: enabled=1`, `serial0: socket`, `vga: serial0`, `scsihw: virtio-scsi-pci`, `net0: virtio,bridge=vmbr-lab,tag=100`.

**[NODE pve1]** — import the cloud image as a disk on `local-lvm` (swap in whatever storage you actually use):

```bash
qm importdisk 9000 /var/lib/vz/template/iso/noble-server-cloudimg-amd64.img local-lvm
```

Expected output ends with something like:

```
Successfully imported disk as 'unused0:local-lvm:vm-9000-disk-0'
```

**[NODE pve1]** — attach the imported disk as `scsi0` and grow it (cloud images ship tiny, ~3.5G):

```bash
qm set 9000 --scsihw virtio-scsi-pci --scsi0 local-lvm:vm-9000-disk-0
qm resize 9000 scsi0 10G
```

Expected: `qm set` returns silently; `qm resize` prints `Disk size updated`.

**[NODE pve1]** — attach the cloud-init drive on `ide2`, and set boot order to the real disk:

```bash
qm set 9000 --ide2 local-lvm:cloudinit
qm set 9000 --boot order=scsi0
```

Expected output: both commands return with no error. Confirm with `qm config 9000` — you should now see a `scsi0`, an `ide2` ending in `cloudinit,media=cdrom`, and `boot: order=scsi0`.

**Checkpoint:**

```bash
qm config 9000
```

Expected: `scsi0` (10G, real disk), `ide2` (cloudinit), `net0` (vmbr-lab, tag 100), `agent: enabled=1`, `pool: learning`, `tags: learning`. Do not continue to Phase 2 if any of these are missing — re-run the corresponding `qm set`.

---

## Phase 2 — Cloud-init configuration

The cloud-init drive is what turns a generic disk image into a machine with your user, your SSH key, and your network config, applied fresh on every clone's first boot.

**[NODE pve1]** — set the cloud-init user and inject your SSH public key:

```bash
qm set 9000 --ciuser ubuntu --sshkeys ~/.ssh/id_ed25519.pub
```

Expected: returns silently. Confirm with `qm config 9000` — `ciuser: ubuntu` and a `sshkeys:` line (URL-encoded key) appear.

**[NODE pve1]** — set a static IP for the template itself (clones will typically override this per-instance, but the template needs *something* valid to prove cloud-init works):

```bash
qm set 9000 --ipconfig0 ip=10.10.100.10/24,gw=10.10.100.1
```

Expected: returns silently. Confirm with `qm config 9000` — `ipconfig0: ip=10.10.100.10/24,gw=10.10.100.1`.

**[NODE pve1]** — enable the `snippets` content type on local storage so you can drop a vendor cloud-init file on it:

```bash
pvesm set local --content iso,vztmpl,backup,snippets
```

Expected output: none, or `update storage 'local'`. Confirm:

```bash
pvesm status
```

Expected: the `local` row shows `active` with no errors. Confirm `snippets` is now a valid content type:

```bash
grep -A6 "^dir: local$" /etc/pve/storage.cfg
```

Expected: the `content` line includes `snippets`.

**[NODE pve1]** — create the snippets directory (if it doesn't already exist) and write a vendor-data snippet that installs and enables `qemu-guest-agent` on first boot:

```bash
mkdir -p /var/lib/vz/snippets
```

```bash
cat > /var/lib/vz/snippets/qemu-guest-agent.yaml <<'EOF'
#cloud-config
package_update: true
packages:
  - qemu-guest-agent
runcmd:
  - systemctl enable qemu-guest-agent
  - systemctl start qemu-guest-agent
EOF
```

Expected: no output. Confirm the file exists:

```bash
cat /var/lib/vz/snippets/qemu-guest-agent.yaml
```

Expected: the exact YAML you just wrote, printed back.

**[NODE pve1]** — attach the vendor snippet to VM 9000:

```bash
qm set 9000 --cicustom "vendor=local:snippets/qemu-guest-agent.yaml"
```

Expected: returns silently. Confirm with `qm config 9000` — `cicustom: vendor=local:snippets/qemu-guest-agent.yaml`.

**[NODE pve1]** — regenerate the cloud-init drive so it picks up everything set above:

```bash
qm cloudinit update 9000
```

Expected output: no error (may be silent).

**Checkpoint:**

```bash
qm config 9000 | grep -E "ciuser|sshkeys|ipconfig0|cicustom"
```

Expected: all four lines present and non-empty. Do not convert to a template in Phase 3 until every line here is populated — a template with a hole in its cloud-init config produces broken clones.

---

## Phase 3 — Convert to template, clone, verify

**[NODE pve1]** — convert VM 9000 into a template:

```bash
qm template 9000
```

Expected: no output. Confirm:

```bash
qm config 9000 | grep template
```

Expected: `template: 1`. This is a one-way trip for that VM object — Proxmox strips its disk into a read-only base image. If you need to change the template later, you edit it via the rebuild procedure in Phase 6, not by un-templating this VM.

**Full clone vs linked clone — know which one you're getting:**

| | Full clone | Linked clone |
|---|---|---|
| Disk | Independent copy of the full disk | Thin overlay referencing the template's base disk |
| Speed | Slower — copies every block | Fast — near-instant, just allocates an overlay |
| Storage used | Full disk size, immediately | Only the diff from the base, grows as the clone writes |
| Dependency on template | None — safe to delete/modify the template afterward | Hard dependency — the template must stay untouched and undeleted for the clone's life |
| When to use | Storage backend doesn't support linked clones (e.g. some non-thin-provisioned storage); or you're about to retire/rebuild the template and need clones to survive that | Fast disposable test VMs; the common case for this mission and for CI-style provisioning |
| Command | `qm clone <src> <dst> --full` | `qm clone <src> <dst>` (default when source is a template and storage supports it) |

**[NODE pve1]** — clone VM 9000 to VMID 9001 (linked clone, the default):

```bash
qm clone 9000 9001 --name tpl-test-clone --pool learning
```

Expected output: none, or a brief progress line. Confirm:

```bash
qm config 9001 | grep -E "name|pool"
```

Expected: `name: tpl-test-clone`, `pool: learning`.

**[NODE pve1]** — tag the clone (clones don't automatically inherit the parent's tags) and boot it:

```bash
qm set 9001 --tags learning
qm start 9001
```

Expected: `qm start` returns with no error; `qm status 9001` shows `status: running`.

**Checkpoint:** wait ~30-60s for cloud-init and the guest agent to come up, then:

```bash
qm agent 9001 network-get-interfaces
```

Expected: a JSON blob listing interfaces, including one with an `ip-addresses` entry showing `10.10.100.10` (or whatever IP cloud-init assigned). If this returns `QEMU guest agent is not running` or times out, do not continue to Phase 4 — see Break-fix drill 2 below.

---

## Phase 4 — LXC templates

Containers share the host kernel, so they're faster to build and lighter to run, but they can't do everything a VM can. Build one alongside the VM template so later missions can pick whichever fits.

**[NODE pve1]** — refresh the list of downloadable container templates and find the Ubuntu 24.04 one:

```bash
pveam update
pveam available --section system | grep ubuntu-24.04
```

Expected: a line like `system  ubuntu-24.04-standard_24.04-2_amd64.tar.zst`.

**[NODE pve1]** — download it to local storage:

```bash
pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst
```

Expected output ends with `download of 'http://.../ubuntu-24.04-standard_24.04-2_amd64.tar.zst' to '/var/lib/vz/template/cache/ubuntu-24.04-standard_24.04-2_amd64.tar.zst' finished`. Confirm:

```bash
pveam list local | grep ubuntu-24.04
```

Expected: the same filename, listed with its size.

**[NODE pve1]** — build an unprivileged container from it at VMID 9100, in the `learning` pool, tagged, with an extra mount point:

```bash
pct create 9100 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname lxc-tpl-ubuntu2404 \
  --pool learning \
  --tags learning \
  --unprivileged 1 \
  --features nesting=1 \
  --cores 1 \
  --memory 512 \
  --rootfs local-lvm:8 \
  --mp0 local-lvm:4,mp=/data \
  --net0 name=eth0,bridge=vmbr-lab,tag=100,ip=dhcp
```

Expected output ends with `extracting archive` ... `creating rootfs` ... no errors. Confirm:

```bash
pct config 9100
```

Expected: `unprivileged: 1`, `mp0: local-lvm:...,mp=/data,size=4G`, `net0` on `vmbr-lab` tag `100`, `pool: learning`, `tags: learning`.

**Checkpoint:**

```bash
pct start 9100
pct exec 9100 -- ip -4 addr show eth0
```

Expected: `pct start` returns with no error; the `ip addr` output shows an `inet` line with a DHCP-assigned address. Do not continue if the container fails to start — check `pct status 9100` and `journalctl -u pve-container@9100`.

**LXC vs VM — decision table:**

| Factor | Use LXC | Use VM |
|---|---|---|
| Guest OS | Same kernel family as the host (Linux-on-Linux) | Different OS (Windows, BSD) or a different/older kernel needed |
| Boot time | Sub-second to a few seconds | 10-60+ seconds |
| Density (VMs/containers per node) | High — shares one kernel, low per-instance overhead | Lower — each VM has its own kernel and memory overhead |
| Nested containers (Docker/Podman inside) | Works with `--features nesting=1`, some caveats | Works natively, no caveats |
| Kernel module access / custom kernel | Not available (shares host kernel) | Full control |
| Hardware passthrough (GPU, PCIe device) | Limited/fragile | Native support (PCI passthrough) |
| Security isolation | Weaker boundary even unprivileged; namespace-based | Stronger boundary; hardware-virtualized |
| Live migration | Supported, generally faster | Supported |
| Typical use here | Stateless app tiers, build agents, quick test harnesses | Anything needing a distinct kernel, strong isolation, or passthrough |

---

## Phase 5 — Hookscript

A hookscript runs at defined points in a VM's lifecycle (`pre-start`, `post-start`, `pre-stop`, `post-stop`). Use it here to log every start/stop and enforce the `learning` tag even if someone clones without setting it.

**[NODE pve1]** — write the hookscript to the snippets directory:

```bash
cat > /var/lib/vz/snippets/hookscript-tag-log.sh <<'EOF'
#!/bin/bash
# Proxmox hookscript: logs every lifecycle phase and enforces the `learning` tag.
# Invoked by Proxmox as: <script> <vmid> <phase>

VMID="$1"
PHASE="$2"
LOGFILE="/var/log/pve-hookscript.log"

echo "$(date -Is) VM ${VMID}: phase=${PHASE}" >> "$LOGFILE"

case "$PHASE" in
  post-start)
    CURRENT_TAGS=$(qm config "$VMID" | awk -F': ' '/^tags:/{print $2}')
    case ";${CURRENT_TAGS};" in
      *";learning;"*)
        echo "$(date -Is) VM ${VMID}: already tagged learning" >> "$LOGFILE"
        ;;
      *)
        if [ -n "$CURRENT_TAGS" ]; then
          qm set "$VMID" --tags "${CURRENT_TAGS};learning" >> "$LOGFILE" 2>&1
        else
          qm set "$VMID" --tags "learning" >> "$LOGFILE" 2>&1
        fi
        echo "$(date -Is) VM ${VMID}: tag learning applied" >> "$LOGFILE"
        ;;
    esac
    ;;
esac

exit 0
EOF
chmod +x /var/lib/vz/snippets/hookscript-tag-log.sh
```

Expected: no output. Confirm:

```bash
ls -l /var/lib/vz/snippets/hookscript-tag-log.sh
```

Expected: `-rwxr-xr-x` (executable bit set).

**[NODE pve1]** — attach it to VM 9001:

```bash
qm set 9001 --hookscript local:snippets/hookscript-tag-log.sh
```

Expected: returns silently. Confirm with `qm config 9001` — `hookscript: local:snippets/hookscript-tag-log.sh`.

**[NODE pve1]** — restart the VM to trigger the hook, then read the log:

```bash
qm stop 9001
qm start 9001
tail -n 10 /var/log/pve-hookscript.log
```

**Checkpoint:** the log shows lines for `phase=pre-start`, `phase=post-start`, and a tag line (`already tagged learning` or `tag learning applied`), all timestamped within the last minute. Do not consider the hookscript done if the log file is empty or missing — check `journalctl -u pvedaemon` for a hookscript execution error (usually a missing shebang or missing execute bit).

---

## Phase 6 — Template hygiene

Templates rot: base images get CVEs, cloud-init formats change, someone edits the wrong VM by hand. Two habits keep this from becoming a mess.

**[NODE pve1]** — stamp a version and build date into the template's notes so anyone looking at `qm config` knows exactly what they're cloning:

```bash
qm set 9000 --description "tpl-ubuntu2404-v1 | built $(date -I) | Ubuntu 24.04 cloud image + qemu-guest-agent vendor snippet | rebuild: see GUIDE.md Phase 6"
```

Expected: returns silently. Confirm:

```bash
qm config 9000 | grep -A1 description
```

Expected: the description string you just set, base64-decoded back to plain text by `qm config`.

**Documented rebuild procedure** (follow this exact sequence whenever the base image needs refreshing — new Ubuntu point release, patched CVE, changed cloud-init snippet):

1. Pick the next VMID in the template's family (e.g. `9000` → build the replacement at a scratch ID like `9002`, don't overwrite `9000` in place).
2. Repeat Phases 1-3 against the new VMID with the updated cloud image or snippet.
3. Bump the version in `--description` (`tpl-ubuntu2404-v2 | built <date> | ...`).
4. Clone at least one test VM from the new template and run the Phase 3 checkpoint (`qm agent ... network-get-interfaces`) before trusting it.
5. Once validated, update whatever downstream automation (later missions, this doc's VMID references) points at the old VMID to point at the new one.
6. Only after downstream consumers have moved off the old template do you `qm destroy` it — never delete a template that active clones still depend on (linked clones will break).

**Checkpoint:**

```bash
qm config 9000 | grep description
```

Expected: a non-empty description containing a version string (`v1`) and a build date. Mission is not done if this line is blank.

---

## Break-fix drills

Diagnose before asking for hints. State the symptom, form a hypothesis, test it, then open the hints if you're stuck.

**Drill 1 — clone boots but reports no IP**

Clone the template again (`qm clone 9000 9002 --name broken-clone`), but before starting it, remove its cloud-init drive:

```bash
qm set 9002 --delete ide2
qm start 9002
```

Symptom: the VM boots, but `qm agent 9002 network-get-interfaces` either times out waiting for the agent or comes back with an interface that has no useful IP, and the console shows no static address applied. Diagnose what's missing from `qm config 9002` compared to a working clone, and how you'd put it back and make the VM pick up the change without a full re-clone.

**Drill 2 — qemu-guest-agent shows no data**

Build a plain VM from the *raw* cloud image (skip the vendor snippet from Phase 2 — `qm set --cicustom` is never applied), boot it, and run:

```bash
qm agent <vmid> ping
```

Symptom: `QEMU guest agent is not running` even though the VM is clearly up and reachable some other way (console login, or a DHCP lease showing in your router). Diagnose why the agent channel never comes alive, and how the Phase 2 vendor snippet is supposed to prevent exactly this.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `qm config 9002` will simply be missing an `ide2` line — cloud-init has nothing to boot from, so none of `ciuser`/`sshkeys`/`ipconfig0` ever gets applied to the guest. `qm set 9002 --ide2 <storage>:cloudinit` followed by `qm cloudinit update 9002` regenerates the drive without a re-clone; the VM needs a reboot to pick it up.
- Drill 2: the guest agent only runs if the *package* is installed and the *service* is enabled inside the guest — the stock Ubuntu cloud image does not ship it preinstalled. That's exactly what the Phase 2 `qemu-guest-agent.yaml` vendor snippet's `packages:` and `runcmd:` sections exist to fix. A VM built without `--cicustom vendor=...` never runs that install step.

</details>

---

## Prove-it

Write a script that clones the template, waits for the guest agent to report an IP, and prints the ready-to-use SSH command — end to end, under 2 minutes, and repeatable (run it twice, back to back, with no manual cleanup in between).

**[NODE pve1]** — save this as `/root/prove-it.sh`:

```bash
#!/bin/bash
set -euo pipefail

SRC_TEMPLATE=9000
CLONE_ID="${1:-9050}"
CLONE_NAME="clone-test-$(date +%s)"
SSH_USER="ubuntu"
TIMEOUT=110   # seconds — leaves headroom under the 2-minute budget

echo "[*] Cleaning up any previous VM at ${CLONE_ID}"
if qm status "$CLONE_ID" >/dev/null 2>&1; then
  qm stop "$CLONE_ID" --skiplock 1 >/dev/null 2>&1 || true
  sleep 2
  qm destroy "$CLONE_ID" --purge 1 >/dev/null 2>&1 || true
fi

START=$(date +%s)

echo "[*] Cloning template ${SRC_TEMPLATE} -> ${CLONE_ID} (${CLONE_NAME})"
qm clone "$SRC_TEMPLATE" "$CLONE_ID" --name "$CLONE_NAME" --pool learning
qm set "$CLONE_ID" --tags learning

echo "[*] Starting ${CLONE_ID}"
qm start "$CLONE_ID"

echo "[*] Waiting for guest agent to report a non-loopback IP (timeout ${TIMEOUT}s)"
IP=""
ELAPSED=0
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  IP=$(qm agent "$CLONE_ID" network-get-interfaces 2>/dev/null \
        | grep -oE '"ip-address":"[0-9]{1,3}(\.[0-9]{1,3}){3}"' \
        | grep -v '"127.0.0.1"' \
        | head -n1 \
        | cut -d'"' -f4 || true)
  if [ -n "$IP" ]; then
    break
  fi
  sleep 3
  ELAPSED=$(( $(date +%s) - START ))
done

if [ -z "$IP" ]; then
  echo "[!] No IP reported within ${TIMEOUT}s — check the cloud-init drive and guest agent install"
  exit 1
fi

END=$(date +%s)
DURATION=$(( END - START ))

echo "[*] Guest agent reports IP: ${IP}"
echo "[*] Total time: ${DURATION}s"
echo ""
echo "SSH command:"
echo "  ssh ${SSH_USER}@${IP}"
```

```bash
chmod +x /root/prove-it.sh
```

**[NODE pve1]** — run it twice back to back:

```bash
/root/prove-it.sh 9050
/root/prove-it.sh 9050
```

Expected output (each run): a `Cleaning up`/`Cloning`/`Starting`/`Waiting` sequence, then `Guest agent reports IP: 10.10.100.x`, `Total time: <N>s` with `<N>` under 120, and a final `ssh ubuntu@10.10.100.x` line. The second run must succeed identically — same steps, same outcome, no manual intervention — which is what proves the process is repeatable and not a one-off fluke.

If you'd rather drive this through the Proxmox API instead of local `qm` commands (useful once you're off-node), the same three calls — `POST /nodes/{node}/qemu/{vmid}/clone`, `POST /nodes/{node}/qemu/{vmid}/status/start`, and polling `GET /nodes/{node}/qemu/{vmid}/agent/network-get-interfaces` — work identically against the least-privilege `learn@pve!tf` API token from Mission 01.

---

## Done when

- [ ] VM 9000 exists, is a template (`qm config 9000` shows `template: 1`), is in the `learning` pool, tagged `learning`, with a versioned `description`
- [ ] The cloud-init drive on 9000 has `ciuser`, `sshkeys`, `ipconfig0`, and `cicustom` (vendor snippet) all populated
- [ ] A clone of 9000 boots and `qm agent <vmid> network-get-interfaces` reports a real IP
- [ ] Container 9100 exists, unprivileged, built from a `pveam`-downloaded template, with a working mount point and network
- [ ] A hookscript is attached to at least one VM and `/var/log/pve-hookscript.log` shows real entries from a start/stop cycle
- [ ] Both break-fix drills diagnosed and explained (cloud-init drive missing → no IP; agent not installed → no agent data) before opening the hints
- [ ] `prove-it.sh` runs twice back to back, each run finishing in under 2 minutes and printing a working `ssh` command
- [ ] Every object created in this mission carries the `learning` tag and sits inside VMID range `9000-9999`
