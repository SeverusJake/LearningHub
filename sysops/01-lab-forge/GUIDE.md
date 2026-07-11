# Guide — Mission 01: Lab Forge

Lab topology used throughout this mission and every mission after it:

- Hyper-V internal switch: `LabSwitch`
- NAT subnet: `172.16.10.0/24`, gateway `172.16.10.1`
- Domain: `lab.local`
- VM naming: `lab-<role>` (e.g. `lab-web01`)
- Templates: `tpl-ubuntu2404`, `tpl-rocky9`
- Host: Windows 11 Pro, 32GB RAM, Hyper-V

Every command below states which machine it runs on: **[HOST]** = Windows PowerShell (admin), **[GUEST]** = bash inside the VM.

---

## Phase 0 — Setup check

Confirm Hyper-V is available and you're running an elevated PowerShell session.

**[HOST]** — check you're admin:

```powershell
([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
```

Expected output: `True`. If `False`, relaunch PowerShell with "Run as administrator".

**[HOST]** — check the OS supports Hyper-V:

```powershell
Get-ComputerInfo -Property "HyperV*"
```

Expected: `HyperVRequirementVirtualizationFirmwareEnabled : True` and no `False` values in the other `HyperVRequirement*` fields. If virtualization is disabled, enable it in BIOS/UEFI (Intel VT-x / AMD-V) before continuing.

**Checkpoint:** both commands above return the expected values. Do not continue if virtualization firmware support is `False` — fix that in BIOS first.

---

## Phase 1 — Enable Hyper-V

**[HOST]** — enable the Hyper-V feature:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

Expected output ends with:

```
RestartNeeded : True
```

**[HOST]** — reboot:

```powershell
Restart-Computer
```

After reboot, log back in and open an elevated PowerShell again.

**Checkpoint:**

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V
```

Expected: `State : Enabled`. Do not continue to Phase 2 if `State` is `Disabled` — re-run Phase 1.

---

## Phase 2 — Network: internal switch + NAT

This builds the isolated subnet every VM in the lab lives on.

**[HOST]** — create the internal switch:

```powershell
New-VMSwitch -Name LabSwitch -SwitchType Internal
```

Expected output: a table row showing `Name : LabSwitch`, `SwitchType : Internal`.

**[HOST]** — assign the gateway IP to the host's virtual adapter for that switch:

```powershell
New-NetIPAddress -IPAddress 172.16.10.1 -PrefixLength 24 -InterfaceAlias "vEthernet (LabSwitch)"
```

Expected output: a table row with `IPAddress : 172.16.10.1`, `PrefixLength : 24`.

**[HOST]** — create NAT so lab VMs can reach the internet through the host:

```powershell
New-NetNat -Name LabNat -InternalIPInterfaceAddressPrefix 172.16.10.0/24
```

Expected output: a table row with `Name : LabNat`, `InternalIPInterfaceAddressPrefix : 172.16.10.0/24`.

**Checkpoint:** host can reach the gateway address it just created:

```powershell
Test-Connection -TargetName 172.16.10.1 -Count 2
```

Expected: 2 replies, `0`% packet loss. Do not continue if this fails — re-check `Get-NetAdapter` for `vEthernet (LabSwitch)` and confirm it's `Up`.

---

## Phase 3 — Build the Ubuntu 24.04 VM

**[HOST]** — download the Ubuntu 24.04 Server ISO:

```powershell
Invoke-WebRequest -Uri "https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso" -OutFile "D:\ISOs\ubuntu-24.04.iso"
```

Expected: file appears at `D:\ISOs\ubuntu-24.04.iso`, size roughly 2.6 GB. Adjust the path to wherever you keep ISOs.

**[HOST]** — create a generation-2 VM attached to LabSwitch:

```powershell
New-VM -Name "tpl-ubuntu2404" -Generation 2 -MemoryStartupBytes 2GB -NewVHDPath "D:\HyperV\tpl-ubuntu2404\tpl-ubuntu2404.vhdx" -NewVHDSizeBytes 40GB -SwitchName "LabSwitch"
Set-VMDvdDrive -VMName "tpl-ubuntu2404" -Path "D:\ISOs\ubuntu-24.04.iso"
Set-VMFirmware -VMName "tpl-ubuntu2404" -EnableSecureBoot Off
Set-VMProcessor -VMName "tpl-ubuntu2404" -Count 2
Start-VM -Name "tpl-ubuntu2404"
```

Expected output: no errors; `Start-VM` returns silently on success (check with `Get-VM tpl-ubuntu2404` — `State : Running`).

**[HOST]** — connect to the console:

```powershell
vmconnect.exe localhost tpl-ubuntu2404
```

Run through the Ubuntu Server installer in the console window:

- Hostname: `lab-tpl-ubuntu`
- Enable OpenSSH server when prompted (installer step "SSH Setup" → check "Install OpenSSH server")
- Skip additional snaps
- Use the whole disk, default LVM layout
- Create a user, e.g. `labadmin`, and set a password you'll remember — this account gets wiped of identity later but keep it for now

Let the install finish, reboot when prompted, remove the ISO:

**[HOST]**:

```powershell
Set-VMDvdDrive -VMName "tpl-ubuntu2404" -Path $null
```

**[GUEST]** — after first boot, log in at the console and set a static IP with netplan. Edit (or create) `/etc/netplan/01-lab-static.yaml`:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - 172.16.10.20/24
      routes:
        - to: default
          via: 172.16.10.1
      nameservers:
        addresses:
          - 172.16.10.1
          - 1.1.1.1
```

**[GUEST]** — apply it:

```bash
sudo netplan apply
```

Expected output: command returns with no error (netplan is silent on success). Confirm with `ip -4 addr show eth0` — expect `inet 172.16.10.20/24`.

**Checkpoint:** from the host, SSH into the VM:

```powershell
ssh labadmin@172.16.10.20
```

Expected: password prompt, then a bash shell inside `lab-tpl-ubuntu`. Do not continue to Phase 4 if SSH fails — check `sudo systemctl status ssh` on the guest and re-verify the netplan file.

---

## Phase 4 — Generalize to templates

A template must boot to a clean slate every time it's cloned — no leftover machine-id, no reused SSH host keys, no stale hostname.

### Ubuntu → `tpl-ubuntu2404`

**[GUEST]** — clear machine-id:

```bash
sudo truncate -s0 /etc/machine-id
sudo rm -f /var/lib/dbus/machine-id
sudo ln -s /etc/machine-id /var/lib/dbus/machine-id
```

**[GUEST]** — remove SSH host keys (regenerated fresh on next boot via `ssh-keygen` in cloud-init or manually per clone):

```bash
sudo rm -f /etc/ssh/ssh_host_*
```

**[GUEST]** — clear the netplan static config back to a placeholder (each clone gets its own IP in Phase 5):

```bash
sudo rm -f /etc/netplan/01-lab-static.yaml
```

**[GUEST]** — shut down:

```bash
sudo shutdown -h now
```

**[HOST]** — mark the template VM as do-not-boot so nobody starts it directly and drifts its state:

```powershell
Set-VM -Name "tpl-ubuntu2404" -Notes "TEMPLATE - DO NOT BOOT - clone the VHDX instead"
Set-VM -Name "tpl-ubuntu2404" -AutomaticStartAction Nothing
```

**Checkpoint:**

```powershell
Get-VM -Name "tpl-ubuntu2404" | Select-Object Name, State, Notes
```

Expected: `State : Off`, `Notes` contains `DO NOT BOOT`. Do not clone from this template if `State` is anything but `Off`.

### Rocky 9 → `tpl-rocky9`

Repeat the same VM build steps as Phase 3 (download the Rocky 9 minimal ISO, `New-VM -Name "tpl-rocky9" ...`, install with OpenSSH enabled), then generalize with nmcli instead of netplan.

**[GUEST]** — set static IP with nmcli during template build (temporary, cleared before shutdown):

```bash
sudo nmcli con mod "System eth0" ipv4.addresses 172.16.10.21/24
sudo nmcli con mod "System eth0" ipv4.gateway 172.16.10.1
sudo nmcli con mod "System eth0" ipv4.dns "172.16.10.1 1.1.1.1"
sudo nmcli con mod "System eth0" ipv4.method manual
sudo nmcli con up "System eth0"
```

Expected output: `Connection successfully activated`. Confirm with `ip -4 addr show eth0` — expect `inet 172.16.10.21/24`.

**[GUEST]** — generalize: clear machine-id, SSH host keys, and reset the connection to DHCP so the template doesn't carry a claimed IP:

```bash
sudo truncate -s0 /etc/machine-id
sudo rm -f /etc/ssh/ssh_host_*
sudo nmcli con mod "System eth0" ipv4.method auto
sudo nmcli con mod "System eth0" ipv4.addresses ""
sudo nmcli con mod "System eth0" ipv4.gateway ""
```

**[GUEST]** — shut down:

```bash
sudo shutdown -h now
```

**[HOST]** — mark as do-not-boot:

```powershell
Set-VM -Name "tpl-rocky9" -Notes "TEMPLATE - DO NOT BOOT - clone the VHDX instead"
Set-VM -Name "tpl-rocky9" -AutomaticStartAction Nothing
```

**Checkpoint:**

```powershell
Get-VM -Name "tpl-rocky9" | Select-Object Name, State, Notes
```

Expected: `State : Off`, `Notes` contains `DO NOT BOOT`. Do not continue to Phase 5 until both templates show `Off` with the do-not-boot note.

---

## Phase 5 — Clone workflow

Never boot a template directly. Always copy its VHDX and import as a new VM.

**[HOST]** — clone `tpl-ubuntu2404` into a new VM named `lab-web01`:

```powershell
Copy-Item "D:\HyperV\tpl-ubuntu2404\tpl-ubuntu2404.vhdx" "D:\HyperV\lab-web01\lab-web01.vhdx"
New-VM -Name "lab-web01" -Generation 2 -MemoryStartupBytes 2GB -VHDPath "D:\HyperV\lab-web01\lab-web01.vhdx" -SwitchName "LabSwitch"
Set-VMFirmware -VMName "lab-web01" -EnableSecureBoot Off
Start-VM -Name "lab-web01"
```

Expected: `Get-VM lab-web01` shows `State : Running`.

Clone identity checklist — run every item, in order, on first boot of the clone:

- [ ] **[GUEST]** Regenerate machine-id: `sudo systemd-machine-id-setup` (confirm with `cat /etc/machine-id` — non-empty, unique per VM)
- [ ] **[GUEST]** Regenerate SSH host keys: `sudo ssh-keygen -A` (confirm with `ls /etc/ssh/ssh_host_*` — files present)
- [ ] **[GUEST]** Set hostname to match the VM name: `sudo hostnamectl set-hostname lab-web01`
- [ ] **[GUEST]** Set the static IP for this clone (netplan on Ubuntu, nmcli on Rocky) — pick the next free address in `172.16.10.0/24`
- [ ] **[GUEST]** Reboot and confirm hostname + IP: `hostnamectl` and `ip -4 addr show`
- [ ] **[HOST]** Confirm no duplicate hostnames or IPs exist among running lab VMs before bringing the clone onto the network for real work

**Checkpoint:** from the host,

```powershell
ssh labadmin@172.16.10.<clone-ip>
```

then on the guest, `hostnamectl` shows the expected unique hostname and `cat /etc/machine-id` differs from the template and from every other clone. Do not proceed to normal use of the clone if machine-id or hostname still matches another VM.

---

## Phase 6 — Snapshot discipline

Before starting any mission or making a risky change, checkpoint the VM so you can roll back.

**[HOST]** — snapshot before mission work, using the naming convention `pre-mission-NN`:

```powershell
Checkpoint-VM -Name "lab-web01" -SnapshotName "pre-mission-02"
```

Expected output: no error; `Get-VMSnapshot -VMName lab-web01` lists the new checkpoint.

**Checkpoint:**

```powershell
Get-VMSnapshot -VMName "lab-web01" | Select-Object Name, CreationTime
```

Expected: a row with `Name : pre-mission-02` and a recent `CreationTime`. Do not skip this step before any mission that modifies system config, packages, or network settings — if a mission goes wrong, restore with `Restore-VMSnapshot`.

---

## Break-fix drills

Diagnose before you ask for hints. State the symptom you observe, form a hypothesis, and test it before opening the hints below.

**Drill 1 — NAT deleted, VMs lose internet**

Ask Claude, in this session, to run:

```powershell
Remove-NetNat -Name LabNat -Confirm:$false
```

Symptom: guest VMs can still ping `172.16.10.1` (the gateway) but cannot reach anything outside the subnet, e.g. `ping 1.1.1.1` from a guest times out. Diagnose what changed and how you'd confirm it from both host and guest before fixing it.

**Drill 2 — IP conflict from two clones**

Clone two VMs from the same template but skip the "set the static IP for this clone" checklist item on one of them, leaving both at the same address. Boot both. Diagnose the symptom (intermittent SSH failures, ARP flapping, or one VM simply unreachable) using tools available on both host and guest before changing anything.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: check `Get-NetNat` on the host — is `LabNat` even listed anymore?
- Drill 2: `arp -a` on the host, or `ip neigh` on a guest, will show two different MAC addresses claiming the same IP.

</details>

---

## Prove-it challenges

Clone 3 VMs from your templates with static IPs `172.16.10.21`, `172.16.10.22`, `172.16.10.23`, complete the full clone identity checklist on each, and SSH successfully between every pair (6 directions total: each of the 3 VMs to each of the other 2) — all in under 10 minutes.

<details>
<summary>Hints (open only when stuck)</summary>

- Keep a text file open with the clone checklist so you're not re-reading Phase 5 for each VM.
- Generate SSH host keys and set hostname/IP before the first reboot of each clone — one reboot per VM, not two.

</details>

---

## Done when

- [ ] `LabSwitch` internal switch + `LabNat` NAT up, host pings `172.16.10.1` successfully
- [ ] `tpl-ubuntu2404` built, generalized (clean machine-id, no SSH host keys, no static IP), marked do-not-boot
- [ ] `tpl-rocky9` built, generalized (clean machine-id, no SSH host keys, no static IP), marked do-not-boot
- [ ] Clone procedure documented and followed at least 3 times without leftover shared identity
- [ ] 3 test VMs running with static IPs `.21`, `.22`, `.23`, each reachable via SSH from the host and from each other
