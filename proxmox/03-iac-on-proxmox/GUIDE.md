# Guide — Mission 03: IaC on Proxmox

This is not a script to paste blindly — this is a live company cluster. Read each phase, run the commands, and look at the actual output before moving on. Every phase ends in a checkpoint that proves the infrastructure did what you think it did, not just that a command exited zero.

Conventions used throughout, carried forward from Missions 01 and 02:

```
Resource pool                : learning
VM ID range                  : 9000-9999
Golden template               : VMID 9000, name tpl-ubuntu2404 (Ubuntu 24.04, cloud-init + qemu-guest-agent baked in)
Dedicated bridge              : vmbr-lab (VLAN tag 100 in these examples)
Lab subnet                    : 10.10.100.0/24, gateway 10.10.100.1 (template itself sits on .10)
API token                     : learn@pve!tf
Token's role                  : LearningRole, granted on /pool/learning
Tag on every object            : learning
```

Every node is written as `pve1` below — replace it with your real node name(s). This mission's fleet spreads across whatever nodes your cluster actually has (the safety contract in `proxmox/README.md` assumes 3 or more); `pve2` and `pve3` appear as stand-ins for the others.

## Starting point

Confirm your tools before starting — this mission needs all three:

```bash
terraform -version
packer -version
ansible --version
```

Expected output: a version string from each (Terraform ≥ 1.9, Packer ≥ 1.11, Ansible ≥ 2.16). Install the collection the dynamic inventory plugin lives in:

```bash
ansible-galaxy collection install community.general
```

Expected output: `community.general:X.Y.Z was installed successfully` (or `is already installed`).

Make a working directory and put every file below inside it:

```bash
mkdir -p ~/pve-iac && cd ~/pve-iac
```

You'll also need the token secret from Mission 01 (the UUID-looking value you saved when you ran `pveum user token add learn@pve tf --privsep 1`). If you didn't keep it, regenerate it now (`pveum user token add learn@pve tf --privsep 1` again — this invalidates the old one) and re-grant it exactly as Mission 01's Phase 5 describes before continuing.

---

## Phase 1 — bpg/proxmox provider auth

The provider is a plugin that translates Terraform's resource model into calls against the Proxmox REST API. It authenticates exactly the way your `curl` test in Mission 01 did — an `Authorization: PVEAPIToken=...` header — Terraform just builds that header for you on every request.

`providers.tf`:

```hcl
terraform {
  required_version = ">= 1.9"

  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.66"
    }
  }
}

provider "proxmox" {
  endpoint  = var.pve_api_url
  api_token = "learn@pve!tf=${var.pve_api_secret}"

  # Skip only if the cluster's self-signed cert isn't in your trust store yet.
  # Prefer importing the cert and setting this to false once you can.
  insecure = var.pve_insecure
}
```

`variables.tf`:

```hcl
variable "pve_api_url" {
  type        = string
  description = "Proxmox API endpoint, e.g. https://pve1.company.local:8006/"
}

variable "pve_api_secret" {
  type        = string
  description = "UUID secret half of the learn@pve!tf token — never committed, always supplied via env var"
  sensitive   = true
}

variable "pve_insecure" {
  type        = bool
  description = "Skip TLS verification against the cluster's API"
  default     = false
}
```

`terraform.tfvars` — everything that is *not* secret:

```hcl
pve_api_url  = "https://pve1.company.local:8006/"
pve_insecure = true
```

The token secret is the one value that never goes in a `.tfvars` file. Export it as an environment variable instead — Terraform auto-picks up any `TF_VAR_<name>` for the matching variable:

```bash
export TF_VAR_pve_api_secret="<your-token-secret-uuid>"
```

Prove the provider can actually reach the API before you ask it to manage anything. A data source is read during `plan`, so a version lookup is enough to prove the round trip without touching a single VM:

```hcl
data "proxmox_virtual_environment_version" "this" {}

output "pve_api_version" {
  value = data.proxmox_virtual_environment_version.this.version
}
```

```bash
terraform init
```

Expected output: `Terraform has been successfully initialized!` with `bpg/proxmox` listed as installed.

```bash
terraform plan
```

Expected output: `Changes to Outputs:` followed by `+ pve_api_version = "8.2.4"` (your real cluster version) and `Plan: 0 to add, 0 to change, 0 to destroy.` No VM exists yet — the only thing this plan proves is that the token authenticated and the API answered.

**Checkpoint:** `terraform plan` reaches the API and prints your cluster's real version string in the outputs diff. If you get a `401`, the secret is wrong or wasn't exported in this shell. If you get a connection error, `pve_api_url` or `pve_insecure` is wrong for your cluster's cert setup.

---

## Phase 2 — a single VM resource, cloned from the template

Cloning allocates a new disk on real storage — that's a `Datastore.*` action, and Mission 01's `LearningRole` was scoped deliberately narrow: every `VM.*` privilege, and nothing else. Read it back:

```bash
pveum role list
```

You'll see `LearningRole` with a privilege string that has no `Datastore.` prefix anywhere in it. This mission is the first one that needs that gap closed. Add exactly the one privilege cloning needs, to the same role, and grant it on the storage path (not `/`, not the pool — storage is a different ACL tree entirely):

```bash
pveum role modify LearningRole -privs "VM.Allocate,VM.Audit,VM.Backup,VM.Clone,VM.Config.CDROM,VM.Config.CPU,VM.Config.Cloudinit,VM.Config.Disk,VM.Config.HWType,VM.Config.Memory,VM.Config.Network,VM.Config.Options,VM.Console,VM.Migrate,VM.Monitor,VM.PowerMgmt,VM.Snapshot,VM.Snapshot.Rollback,Datastore.AllocateSpace,Datastore.Audit"
pveum acl modify /storage/local-lvm --roles LearningRole --tokens 'learn@pve!tf'
```

Expected output: silent on success. Confirm:

```bash
pveum acl list | grep local-lvm
```

Expected output: a line showing `/storage/local-lvm`, `learn@pve!tf`, `LearningRole`. Keep this exact gap in mind — it's the whole setup for break-fix drill 1 below.

Now the resource itself. `main.tf`:

```hcl
resource "proxmox_virtual_environment_vm" "test_vm" {
  name      = "tf-test01"
  node_name = "pve1"
  vm_id     = 9101
  pool_id   = "learning"
  tags      = ["learning"]

  clone {
    vm_id = 9000
    full  = true
  }

  agent {
    enabled = true
  }

  cpu {
    cores = 2
  }

  memory {
    dedicated = 2048
  }

  disk {
    datastore_id = "local-lvm"
    interface    = "scsi0"
    size         = 10
  }

  network_device {
    bridge  = "vmbr-lab"
    vlan_id = 100
  }

  initialization {
    datastore_id = "local-lvm"

    user_account {
      username = "ubuntu"
      keys     = [trimspace(file("~/.ssh/id_ed25519.pub"))]
    }

    ip_config {
      ipv4 {
        address = "10.10.100.101/24"
        gateway = "10.10.100.1"
      }
    }
  }
}
```

`vm_id = 9101` is deliberately inside the `9000-9999` range and deliberately not `9000` itself — that number is the template, and it's about to get a `prevent_destroy` guard in Phase 6 that would make this resource unmanageable if you reused it.

```bash
terraform apply
```

Expected output: `Plan: 1 to add, 0 to change, 0 to destroy`, then after `yes`, `Apply complete! Resources: 1 added`. This takes a couple of minutes — Proxmox is doing a full clone of a real disk, not a symlink.

Confirm against the cluster directly, not just Terraform's own bookkeeping:

```bash
qm config 9101 | grep -E "pool|tags|net0|ipconfig0"
qm status 9101
```

Expected output: `pool: learning`, `tags: learning`, `net0: virtio,bridge=vmbr-lab,tag=100`, `ipconfig0: ip=10.10.100.101/24,gw=10.10.100.1`, and `status: running`.

**Checkpoint:** VM 9101 exists, is running, sits in the `learning` pool, carries the `learning` tag, and its VMID is inside `9000-9999`. `ssh ubuntu@10.10.100.101` succeeds using the key referenced in `user_account.keys`.

---

## Phase 3 — module `modules/pve-vm`: a `for_each` fleet

One hand-written resource per VM means every fleet change gets copy-pasted across VMs and drifts the moment someone forgets one. Turn Phase 2's resource into a module parameterized by a map, and the fleet becomes data instead of code.

`modules/pve-vm/variables.tf`:

```hcl
variable "vms" {
  description = "Map of VM name => its configuration"
  type = map(object({
    node_name = string
    vm_id     = number
    ip        = string
    gateway   = optional(string, "10.10.100.1")
    cores     = optional(number, 2)
    memory    = optional(number, 2048)
    disk_size = optional(number, 10)
    tags      = optional(list(string), [])
  }))
}

variable "template_vm_id" {
  type        = number
  description = "VMID of the template every fleet member clones from"
  default     = 9000
}

variable "pool_id" {
  type    = string
  default = "learning"
}

variable "bridge" {
  type    = string
  default = "vmbr-lab"
}

variable "vlan_id" {
  type    = number
  default = 100
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/id_ed25519.pub"
}
```

`modules/pve-vm/main.tf`:

```hcl
resource "proxmox_virtual_environment_vm" "this" {
  for_each = var.vms

  name      = each.key
  node_name = each.value.node_name
  vm_id     = each.value.vm_id
  pool_id   = var.pool_id
  tags      = distinct(concat(["learning"], each.value.tags))

  clone {
    vm_id = var.template_vm_id
    full  = true
  }

  agent {
    enabled = true
  }

  cpu {
    cores = each.value.cores
  }

  memory {
    dedicated = each.value.memory
  }

  disk {
    datastore_id = "local-lvm"
    interface    = "scsi0"
    size         = each.value.disk_size
  }

  network_device {
    bridge  = var.bridge
    vlan_id = var.vlan_id
  }

  initialization {
    datastore_id = "local-lvm"

    user_account {
      username = "ubuntu"
      keys     = [trimspace(file(var.ssh_public_key_path))]
    }

    ip_config {
      ipv4 {
        address = "${each.value.ip}/24"
        gateway = each.value.gateway
      }
    }
  }
}
```

`modules/pve-vm/outputs.tf`:

```hcl
output "vm_ids" {
  value = { for k, v in proxmox_virtual_environment_vm.this : k => v.vm_id }
}

output "vm_ips" {
  value = { for k, v in var.vms : k => v.ip }
}
```

Replace Phase 2's standalone resource in `main.tf` with a caller — this exact shape is what the prove-it section scales up to five entries later:

```hcl
module "fleet" {
  source = "./modules/pve-vm"

  vms = {
    web1 = { node_name = "pve1", vm_id = 9111, ip = "10.10.100.111", tags = ["web"] }
    db1  = { node_name = "pve2", vm_id = 9112, ip = "10.10.100.112", tags = ["db"] }
  }
}
```

```bash
terraform init
```

Expected output: `Initializing modules... - fleet in modules/pve-vm`.

```bash
terraform apply
```

Expected output: `Plan: 2 to add` (Terraform destroys the old standalone `test_vm` name-address and creates the two module-managed VMs fresh — read the plan diff, don't just approve blind).

**Checkpoint:**

```bash
terraform output
qm status 9111
qm status 9112
```

Expected output: `vm_ids` and `vm_ips` maps showing both entries, both VMs `running`. One module, two independently-configured instances, driven entirely by the `vms` map — change a value in the map and re-`apply` to prove it, rather than editing any `.tf` resource block.

---

## Phase 4 — Packer `proxmox-clone`: a golden image built on the cluster

devops/06 built its golden image with Packer's `qemu` builder, booting Ubuntu from a bare ISO/cloud-image on a laptop or CI runner with no Proxmox involved at all. Here, Packer talks to the Proxmox API directly: instead of booting from scratch, the `proxmox-clone` builder clones VMID 9000 (which already carries cloud-init and `qemu-guest-agent` from Mission 02), boots that clone, runs the exact same provisioner logic devops/06 used to install `node_exporter`, then converts the result into a brand-new template. Same install steps, different starting point, because the starting point here is already warm.

```bash
mkdir -p packer/files && cd packer
```

`files/node_exporter.service` — identical to the one baked in devops/06 (copy it from `devops/06-iac/packer/files/node_exporter.service` if that mission's directory is still around; otherwise retype it, it's short):

```ini
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

`golden-image.pkr.hcl` — the full build:

```hcl
packer {
  required_plugins {
    proxmox = {
      version = ">= 1.2.0"
      source  = "github.com/hashicorp/proxmox"
    }
  }
}

variable "proxmox_api_url" {
  type    = string
  default = "https://pve1.company.local:8006/api2/json"
}

variable "proxmox_api_token_id" {
  type    = string
  default = "learn@pve!tf"
}

variable "proxmox_api_token_secret" {
  type      = string
  sensitive = true
}

variable "node_exporter_version" {
  type    = string
  default = "1.8.2"
}

variable "template_version" {
  type        = string
  description = "Bump this every rebuild — becomes part of the new template's name"
}

source "proxmox-clone" "golden" {
  proxmox_url              = var.proxmox_api_url
  username                 = var.proxmox_api_token_id
  token                    = var.proxmox_api_token_secret
  insecure_skip_tls_verify = true

  node        = "pve1"
  clone_vm_id = 9000
  full_clone  = true

  vm_name = "tpl-ubuntu2404-node-exporter-${var.template_version}"
  vm_id   = 9010
  pool    = "learning"
  tags    = "learning;golden-image"

  cores  = 2
  memory = 2048

  cloud_init              = true
  cloud_init_storage_pool = "local-lvm"

  qemu_agent = true

  ssh_username = "ubuntu"
  ssh_timeout  = "20m"

  template_name        = "tpl-ubuntu2404-node-exporter-${var.template_version}"
  template_description = "Ubuntu 24.04 + node_exporter ${var.node_exporter_version}, cloned from VMID 9000"
}

build {
  sources = ["source.proxmox-clone.golden"]

  # Same provisioner logic as devops/06-iac's ubuntu-node.pkr.hcl.
  # qemu-guest-agent is already baked into VMID 9000 from Mission 02 — only node_exporter is new here.
  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y wget",
      "wget -q https://github.com/prometheus/node_exporter/releases/download/v${var.node_exporter_version}/node_exporter-${var.node_exporter_version}.linux-amd64.tar.gz",
      "tar xzf node_exporter-${var.node_exporter_version}.linux-amd64.tar.gz",
      "sudo mv node_exporter-${var.node_exporter_version}.linux-amd64/node_exporter /usr/local/bin/node_exporter",
      "sudo useradd --system --no-create-home --shell /usr/sbin/nologin node_exporter || true",
    ]
  }

  provisioner "file" {
    source      = "files/node_exporter.service"
    destination = "/tmp/node_exporter.service"
  }

  provisioner "shell" {
    inline = [
      "sudo mv /tmp/node_exporter.service /etc/systemd/system/node_exporter.service",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable node_exporter",
      "sudo cloud-init clean --logs",
      "sudo truncate -s 0 /etc/machine-id",
    ]
  }
}
```

Setting `vm_id = 9010` explicitly (instead of leaving it for Proxmox to auto-assign) is deliberate — it sidesteps the exact allocation race you'll diagnose in break-fix drill 2 below.

```bash
export PKR_VAR_proxmox_api_token_secret="<your-token-secret-uuid>"
packer init .
```

Expected output: `Installed plugin github.com/hashicorp/proxmox ...`.

```bash
packer validate -var="template_version=v1" golden-image.pkr.hcl
```

Expected output: `The configuration is valid.`

```bash
packer build -var="template_version=v1" golden-image.pkr.hcl
```

Expected output: a build log showing the clone, a wait for the guest agent to report an IP, both shell provisioners running, then `==> proxmox-clone.golden: Converting VM to template` and finally `Build 'proxmox-clone.golden' finished`.

**Template versioning strategy — read this, don't skip it:** VMID 9000 itself is never touched by this build — `proxmox-clone` clones it, provisions the clone, and templates the clone under a new VMID (`9010`). Every rebuild bumps `template_version` (`v1`, `v2`, ...) and lands on the next free VMID in a small reserved block (9010, 9011, 9012...) rather than overwriting the last one. That gives you an instant rollback: if a new golden image turns out broken, the previous VMID is still sitting there, untouched, and `modules/pve-vm`'s `template_vm_id` variable is the single place you "promote" a version — flip it, re-apply, done. Keep the last two or three versions around; reclaim older ones only after everything cloned from the newer one has been running clean for a while.

Prove the template actually works by cloning a disposable VM from it — the same module from Phase 3, pointed at the new template instead of 9000:

```hcl
module "template_smoke_test" {
  source         = "./modules/pve-vm"
  template_vm_id = 9010

  vms = {
    smoke1 = { node_name = "pve1", vm_id = 9199, ip = "10.10.100.199" }
  }
}
```

```bash
terraform apply -target=module.template_smoke_test
ssh ubuntu@10.10.100.199 'systemctl is-active node_exporter qemu-guest-agent'
curl -s http://10.10.100.199:9100/metrics | head -n 3
terraform destroy -target=module.template_smoke_test
```

Expected output: `active` twice, real Prometheus-format metric lines, then the smoke-test VM torn down — leaving only the new template behind.

**Checkpoint:** `qm config 9010` shows `template: 1`, tagged `learning;golden-image`, in the `learning` pool. A VM cloned from 9010 boots with `node_exporter` and `qemu-guest-agent` both `active` with no post-boot configuration step required.

---

## Phase 5 — Ansible dynamic inventory from Proxmox tags

A static `inventory.ini` goes stale the moment a VM is added or destroyed outside of whoever last edited that file by hand. The `community.general.proxmox` plugin asks Proxmox itself, live, every time you run Ansible — the fleet's actual tags become the inventory's actual groups.

```bash
mkdir -p ~/pve-iac/ansible/inventory && cd ~/pve-iac/ansible
```

`inventory/proxmox.yml`:

```yaml
plugin: community.general.proxmox
url: https://pve1.company.local:8006
user: learn@pve
token_id: tf
token_secret: "{{ lookup('env', 'PVE_API_SECRET') }}"
validate_certs: false

want_facts: true

# Only ever pull objects this token is even allowed to see — belt-and-suspenders
# on top of the ACL scoping from Mission 01, not a substitute for it.
filters:
  - "'learning' in (proxmox_tags_parsed | default([]))"

compose:
  ansible_host: proxmox_ipconfig0.split(',')[0].split('=')[1].split('/')[0]

keyed_groups:
  - key: proxmox_tags_parsed
    separator: ""
```

`ansible.cfg`:

```ini
[defaults]
inventory = inventory/proxmox.yml
host_key_checking = False

[inventory]
enable_plugins = community.general.proxmox, yaml, ini
```

`group_vars/all.yml`:

```yaml
ansible_user: ubuntu
ansible_ssh_private_key_file: ~/.ssh/id_ed25519
```

Export the token secret the plugin's `lookup('env', ...)` reads:

```bash
export PVE_API_SECRET="<your-token-secret-uuid>"
```

See what the plugin actually finds, without touching any host yet:

```bash
ansible-inventory --graph
```

Expected output: a tree with `@learning:` as a group containing every fleet VM, plus per-tag groups like `@web:` and `@db:` from `keyed_groups` — `web1` and `db1` from Phase 3, and `smoke1` if you haven't destroyed it yet.

Ping everything the inventory found:

```bash
ansible all -m ping
```

Expected output: `"ping": "pong"` from every host the plugin listed.

Apply the `common` role from sysops/09 if that mission's `roles/common` directory is still around on this machine (it just installs baseline packages and hardens SSH — nothing Proxmox-specific about it, which is exactly why it's reusable here):

```bash
ls ../../sysops/09-automation/ansible/roles/common 2>/dev/null && echo "found it" || echo "not on this machine — recreate it, it's two short files"
```

If found, symlink it in rather than copying (one source of truth):

```bash
mkdir -p roles
ln -s ../../../sysops/09-automation/ansible/roles/common roles/common
```

If it isn't on this machine, recreate the two files from sysops/09's Phase 4 (`roles/common/tasks/main.yml` and `roles/common/defaults/main.yml`) — they're short and self-contained.

`site.yml`:

```yaml
---
- name: Baseline every fleet VM
  hosts: learning
  become: true
  roles:
    - role: common
```

```bash
ansible-playbook site.yml
```

Expected output: `PLAY RECAP` with `failed=0` across every host the dynamic inventory returned.

**Checkpoint:** `ansible-inventory --graph` shows real fleet VMs grouped by their actual Proxmox tags with no static inventory file anywhere in this directory; `ansible all -m ping` pongs from all of them; `site.yml` applies the `common` role cleanly. Add a VM through Terraform, tag it, re-run `ansible-inventory --graph` with no edits to any Ansible file, and watch it appear on its own.

---

## Phase 6 — state discipline

**Backend options.** Local state works for solo experimentation but has no locking and lives or dies with your laptop. If devops/06 is already done, reuse its MinIO S3-compatible backend — same `use_lockfile` locking, just a different key:

```hcl
terraform {
  backend "s3" {
    bucket                       = "tfstate"
    key                          = "pve-iac/terraform.tfstate"
    region                       = "us-east-1"
    endpoints                    = { s3 = "http://localhost:9000" }
    access_key                   = "minioadmin"
    secret_key                   = "minioadmin123"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    use_path_style              = true
    use_lockfile                = true
  }
}
```

If devops/06 isn't done yet, local state is acceptable for now, but treat `terraform state pull > backups/$(date +%s).tfstate` after every `apply` as mandatory, not optional, and migrate to a real backend before you build the 5-VM fleet in the prove-it section — five VMs' worth of state is not something you want to lose to a laptop crash.

**The rule, no exceptions:** never import a production VM into this state. This state file — wherever it's backed — must only ever contain resources whose `vm_id` sits in `9000-9999` and whose `pool_id` is `learning`. The moment something outside that range gets imported, a future `terraform destroy`, `terraform apply` with a removed resource block, or even an unreviewed `plan` you approve too fast can act on infrastructure someone else depends on — the exact thing the safety contract in `proxmox/README.md` exists to prevent. If you ever genuinely need Terraform to adopt something outside this range, that's a different, separately-reviewed state file, never folded into this one.

**`prevent_destroy` on the template.** The golden template from Phase 4 (VMID 9010) is the one resource in this whole mission that must never be destroyable by an ordinary `terraform destroy` of the fleet. Bring it under management, then lock it:

```bash
terraform import proxmox_virtual_environment_vm.golden_template pve1/9010
```

`main.tf` (or a new `template.tf`):

```hcl
resource "proxmox_virtual_environment_vm" "golden_template" {
  name      = "tpl-ubuntu2404-node-exporter-v1"
  node_name = "pve1"
  vm_id     = 9010
  template  = true

  lifecycle {
    prevent_destroy = true
  }
}
```

```bash
terraform plan
```

Expected output: some drift on first plan after an import is normal — reconcile the resource block's arguments against `qm config 9010` until `plan` reports no changes, the same muscle devops/06's Phase 6 built for container drift.

```bash
terraform destroy
```

Expected output: Terraform refuses, with `Instance cannot be destroyed` naming `proxmox_virtual_environment_vm.golden_template` and pointing at `prevent_destroy`. That refusal, on this exact resource, is the checkpoint.

**Checkpoint:** `terraform destroy` errors out on `golden_template` specifically, citing `prevent_destroy`, while still being willing to destroy everything else in the plan. You can state, without checking notes, which two facts about this state file (VMID range, pool) make an accidental production import structurally harder here than in a state file with no such convention.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — apply fails with 403

Setup: revoke the exact grant you added at the top of Phase 2, without touching anything else:

```bash
pveum acl modify /storage/local-lvm --roles LearningRole --tokens 'learn@pve!tf' --delete
```

Then clone another test VM through Terraform (add a third entry to the `vms` map from Phase 3, or re-target the smoke test from Phase 4).

Expected symptom: `terraform apply` fails with an HTTP 403 from the Proxmox API — not a Terraform-internal error. Read the actual response body in the error output, not just the status code; the API tells you exactly which privilege it checked and where.

<details>
<summary>Hint</summary>

`pveum acl list` shows you what's actually granted, on which path, right now — compare that against the privilege string the 403 body names. The fix is the same two commands from the top of Phase 2, run again; the point of this drill is reading the error closely enough that you'd know which two commands to run even without this guide open. Notice which ACL path the error points at — it's a different tree than `/pool/learning`, which is exactly why granting more on the pool would never have fixed this.
</details>

### Drill 2 — two VMs get the same VMID

Setup: have two people (or two terminals as one person, racing on purpose) both add a new entry to the `vms` map at the same moment, each independently picking "the next free-looking number" by eye instead of checking a shared record, and both happen to write `vm_id = 9120`. Run `terraform apply` from both directories/workspaces close together.

Expected symptom: one `apply` succeeds; the other fails with an error that the VMID is already in use — or, worse, if the two applies use genuinely separate Terraform state files that don't know about each other, both can *appear* to succeed against Proxmox's own bookkeeping in a way that only surfaces as a conflict later.

<details>
<summary>Hint</summary>

Proxmox's own "next free ID" helper (the `/cluster/nextid` API call, which the GUI's "Create VM" button also uses) works by reading the current highest ID and returning one more — it does not reserve that number for you. Two independent readers can read the same answer before either one actually creates a VM, and nothing stops both from then trying to use it. The structural fix isn't a faster read — it's not relying on a race-prone read at all: treat the `9000-9999` range as a small allocation table tracked in the `vms` map itself (or a comment block listing what's taken), reviewed in code review like any other change, so a collision is a merge conflict caught before `apply`, not an API error caught during it.
</details>

### Drill 3 — plan wants to replace a VM over a cloud-init change

Setup: pick a running fleet VM and edit only its `ip_config` block in the `vms` map — change the IP address, leave everything else untouched. Run `terraform plan`.

Expected symptom: instead of an in-place update, the plan shows `-/+` — destroy and re-create the entire VM — over what looks like a one-line cloud-init change.

<details>
<summary>Hint</summary>

Run `terraform plan` again with `-out=tfplan` and inspect it with `terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions | contains(["delete"])) | .change.actions, .change.before.initialization'` (or just read the human-readable plan output carefully) to see exactly which argument the provider marked as forcing replacement. Once you've confirmed it's the `initialization` block specifically: is this VM disposable state you're fine losing and rebuilding (in which case letting the replace happen is the correct, boring answer), or does it hold anything you'd mind losing (in which case `lifecycle { ignore_changes = [...] }` naming that exact argument stops Terraform from ever revisiting it after first creation)? That second option is a real tradeoff, not a free fix — decide, in writing, what you're giving up by telling Terraform to stop looking.
</details>

---

## Prove-it: 5 VMs, one apply, one destroy, zero drift

Take the before-census first, with nothing from this mission's fleet running yet (the golden template from Phase 4 is expected to still be there — it's `prevent_destroy`'d and stays for the whole mission):

```bash
pvesh get /cluster/resources --type vm --output-format json | jq -r '.[].vmid' | sort -n > /tmp/before-census.txt
cat /tmp/before-census.txt
```

Expand the `vms` map to the full environment — 2 web, 2 app, 1 db, distinguished by tags:

```hcl
module "fleet" {
  source = "./modules/pve-vm"

  vms = {
    web1 = { node_name = "pve1", vm_id = 9211, ip = "10.10.100.211", tags = ["web"] }
    web2 = { node_name = "pve2", vm_id = 9212, ip = "10.10.100.212", tags = ["web"] }
    app1 = { node_name = "pve1", vm_id = 9213, ip = "10.10.100.213", tags = ["app"] }
    app2 = { node_name = "pve2", vm_id = 9214, ip = "10.10.100.214", tags = ["app"] }
    db1  = { node_name = "pve3", vm_id = 9215, ip = "10.10.100.215", tags = ["db"] }
  }
}
```

```bash
terraform apply
```

Expected output: `Plan: 5 to add`, then `Apply complete! Resources: 5 added`.

Point the dynamic inventory at the live fleet and configure all 5 with one command:

```bash
cd ansible
ansible-inventory --graph
ansible-playbook site.yml
```

Expected output: `@web:` with 2 hosts, `@app:` with 2 hosts, `@db:` with 1 host, all under `@learning:`; `PLAY RECAP` shows `failed=0` across all 5.

Tear the fleet down and take the after-census:

```bash
cd ..
terraform destroy -target=module.fleet
pvesh get /cluster/resources --type vm --output-format json | jq -r '.[].vmid' | sort -n > /tmp/after-census.txt
diff /tmp/before-census.txt /tmp/after-census.txt
```

Expected output: `diff` prints nothing — the VMID list after teardown is byte-identical to the one before you started, because `terraform destroy -target=module.fleet` removed exactly the 5 resources it created and touched nothing else, including the `prevent_destroy`'d template.

**Checkpoint:** `terraform apply` produced exactly 5 VMs, correctly tagged and grouped; the dynamic inventory found and configured all 5 with no static inventory file; `diff before-census.txt after-census.txt` is empty. That empty diff is the actual proof — "I destroyed some VMs" is not the same claim as "the cluster is exactly as it was."

---

## Done when

- [ ] `terraform plan` in Phase 1 reaches the real API and prints the cluster's actual version in the outputs diff
- [ ] A single VM cloned from VMID 9000 exists inside `9000-9999`, in the `learning` pool, tagged `learning`, reachable over SSH
- [ ] `modules/pve-vm` exists as a real `for_each`-driven module, called with at least two map entries with no duplicated resource blocks
- [ ] A Packer-built golden image (VMID 9010) exists, cloned from 9000, with `node_exporter` and `qemu-guest-agent` both active on a VM cloned from it — with a stated, working template versioning strategy
- [ ] `ansible-inventory --graph` builds groups from live Proxmox tags with zero static inventory files, and `ansible all -m ping` pongs from the whole fleet
- [ ] The `common` role from sysops/09 (or its recreated equivalent) applies cleanly across the fleet via the dynamic inventory
- [ ] A stated backend choice with a reason, the "never import a production VM" rule written down where you'll see it again, and `prevent_destroy` proven on the golden template via a refused `terraform destroy`
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork, before opening the hints
- [ ] Prove-it: a real 5-VM fleet (2 web, 2 app, 1 db) built by one `apply`, fully configured by the dynamic inventory, and torn down with an empty before/after VM census diff
