# Mission 06 Guide — IaC

This guide is not a script to paste blindly. Read each phase, run the commands, and actually look at the output before moving on — every phase ends in a checkpoint that proves you understand what happened, not just that a command exited zero.

## Starting point

Everything in this mission runs on your own machine — no cloud account needed. You'll manage local Docker containers and a local `kind` (Kubernetes-in-Docker) cluster through Terraform, back Terraform's state with a self-hosted MinIO server acting as an S3 bucket, and separately use Packer to bake a golden Ubuntu image. Confirm your tools before starting:

```bash
terraform -version
docker --version
kind --version
packer -version
```
Expected output: a version string from each. If any command isn't found, install it now — every phase from here on assumes the full set is already on your PATH. `mc` (the MinIO client) is used in Phase 4; install it then if you don't have it yet.

Make a working directory for this mission and put every file below inside it:

```bash
mkdir -p ~/iac-mission && cd ~/iac-mission
```

---

## Phase 1 — Terraform fundamentals on the Docker provider

A provider is a plugin that knows how to talk to one API (Docker's socket, in this case). A resource is one thing that provider manages. Terraform's whole job is: read your config, compare it to the last known state, compute a diff, and apply that diff.

`providers.tf`:

```hcl
terraform {
  required_version = ">= 1.9"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.9"
    }
  }
}

provider "docker" {}
provider "kind" {}
```

`main.tf` — one managed container:

```hcl
resource "docker_image" "nginx" {
  name = "nginx:1.27-alpine"
}

resource "docker_container" "web" {
  name  = "iac-web"
  image = docker_image.nginx.image_id

  ports {
    internal = 80
    external = 8080
  }
}
```

Also declare the `kind` cluster this mission's later resources will target — Terraform manages its lifecycle exactly like the container:

```hcl
resource "kind_cluster" "lab" {
  name           = "iac-lab"
  wait_for_ready = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"
    }
    node {
      role = "worker"
    }
  }
}
```

Run the cycle:

```bash
terraform init
```
Expected output: `Terraform has been successfully initialized!` with both providers listed as installed.

```bash
terraform plan
```
Expected output: `Plan: 2 to add, 0 to change, 0 to destroy.` — Terraform has never seen these resources, so both the container and the cluster are new.

```bash
terraform apply
```
Type `yes` when prompted. Expected output: `Apply complete! Resources: 2 added, 0 changed, 0 destroyed.` and a `kind_cluster.lab` output block showing the cluster name.

Inspect what Terraform now thinks exists — this is the skill that matters more than `apply` itself:

```bash
terraform state list
```
Expected output:
```
docker_container.web
docker_image.nginx
kind_cluster.lab
```

```bash
terraform state show docker_container.web
```
Expected output: a full attribute dump — `id`, `name`, `image`, `ports`, `network_data`, all the fields Terraform is now tracking for this resource. This is the ground truth Terraform diffs against on every future `plan`.

Confirm against Docker and kubectl directly, not just Terraform's own bookkeeping:

```bash
docker ps --filter name=iac-web
kubectl cluster-info --context kind-iac-lab
```
Expected output: `iac-web` `Up`, and `Kubernetes control plane is running at https://127.0.0.1:...`.

Tear it down to prove `destroy` is symmetric with `apply`, then bring it back — you'll need both running for the rest of the mission:

```bash
terraform destroy
terraform apply
```

**Checkpoint:** `terraform state list` shows exactly the three resources above, `docker ps` shows `iac-web` running, and `kubectl cluster-info --context kind-iac-lab` succeeds. You can explain, from the state-show output, the difference between what's in your `.tf` file (desired) and what's in `terraform.tfstate` (last-known-actual) — they're not the same thing, and `plan` is the diff between them plus a fresh read of real-world state.

---

## Phase 2 — variables, outputs, locals, and tfvars

Hard-coded names and ports are the first thing that breaks the moment you need a second environment. Pull them out.

`variables.tf`:

```hcl
variable "container_name" {
  type        = string
  description = "Name for the managed nginx container"
  default     = "iac-web"
}

variable "nginx_image" {
  type        = string
  description = "Image reference for the nginx container"
  default     = "nginx:1.27-alpine"
}

variable "external_port" {
  type        = number
  description = "Host port mapped to the container's port 80"
  default     = 8080
}
```

`locals.tf` — computed values derived from variables/context, not set directly by the caller:

```hcl
locals {
  # Ties the container's name to whatever workspace it's applied in,
  # so dev and prod never collide on the same Docker host.
  full_name = "${var.container_name}-${terraform.workspace}"
}
```

Update `main.tf`'s container resource to use them:

```hcl
resource "docker_container" "web" {
  name  = local.full_name
  image = docker_image.nginx.image_id

  ports {
    internal = 80
    external = var.external_port
  }
}
```

`outputs.tf`:

```hcl
output "container_id" {
  value = docker_container.web.id
}

output "container_url" {
  value = "http://localhost:${var.external_port}"
}
```

`terraform.tfvars` — Terraform auto-loads this file with no flag needed:

```hcl
container_name = "shiplog-web"
external_port  = 8081
```

```bash
terraform apply
```
Expected output: `Plan: 1 to add, 0 to change, 1 to destroy` (the container's `name` is immutable in Docker — changing it forces replacement, which is exactly the kind of consequence reading a plan diff is supposed to catch before you approve it). After apply:

```bash
terraform output
```
Expected output:
```
container_id  = "..."
container_url = "http://localhost:8081"
```

You can also point at a differently-named vars file explicitly, which matters once you have more than one environment's worth of tfvars sitting side by side:

```bash
terraform apply -var-file="terraform.tfvars"
```

**Checkpoint:** `terraform output container_url` prints `http://localhost:8081`, `curl http://localhost:8081` returns nginx's default page, and you can point to the exact line in `locals.tf` that would break if two workspaces ever shared the same `container_name`.

---

## Phase 3 — a reusable module: DRY infrastructure

Two nginx containers, hand-written, means every future change (image bump, health check, label) gets copy-pasted twice and drifts apart the moment someone forgets the second copy. A module fixes that at the source.

`modules/web-container/variables.tf`:

```hcl
variable "name" {
  type        = string
  description = "Container name"
}

variable "image" {
  type        = string
  description = "Image reference"
  default     = "nginx:1.27-alpine"
}

variable "internal_port" {
  type    = number
  default = 80
}

variable "external_port" {
  type        = number
  description = "Host port to map to internal_port"
}
```

`modules/web-container/main.tf`:

```hcl
resource "docker_image" "this" {
  name = var.image
}

resource "docker_container" "this" {
  name  = var.name
  image = docker_image.this.image_id

  ports {
    internal = var.internal_port
    external = var.external_port
  }
}
```

`modules/web-container/outputs.tf`:

```hcl
output "container_name" {
  value = docker_container.this.name
}

output "url" {
  value = "http://localhost:${var.external_port}"
}
```

Call it twice from the root module — replace the standalone `docker_container.web`/`docker_image.nginx` resources in `main.tf` with:

```hcl
module "web_a" {
  source        = "./modules/web-container"
  name          = "web-a-${terraform.workspace}"
  external_port = 8091
}

module "web_b" {
  source        = "./modules/web-container"
  name          = "web-b-${terraform.workspace}"
  external_port = 8092
}
```

```bash
terraform init
```
Expected output: `Initializing modules... - web_a in modules/web-container - web_b in modules/web-container` — `init` is required again any time a new module source is added.

```bash
terraform apply
```
Expected output: `Plan: 4 to add` (two images, two containers) since the standalone resources were removed and replaced by module calls with different names.

**Checkpoint:**
```bash
docker ps --filter "name=web-"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8092
```
Expected output: both containers `Up`, both curls return `200`. One module, two independent instances, zero duplicated resource blocks — that's the DRY win. Confirm it by changing `modules/web-container/main.tf`'s `image` default in one place and watching `terraform plan` propose updating both callers identically.

---

## Phase 4 — remote state in MinIO, with locking

State sitting in a `.tfstate` file on your laptop is a single point of failure and a lock that doesn't exist — two people (or two terminals) running `apply` at the same time can corrupt it or silently overwrite each other's changes. Remote state with locking fixes both: one source of truth, and a mutex around every write.

`minio-compose.yml`:

```yaml
services:
  minio:
    image: minio/minio:RELEASE.2024-11-07T00-52-20Z
    container_name: iac-minio
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # web console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data

volumes:
  minio-data:
```

```bash
docker compose -f minio-compose.yml up -d
```
Expected output: `Container iac-minio Started`.

Create the bucket that will hold state:

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc mb local/tfstate
```
Expected output: `Bucket created successfully local/tfstate.`

`backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket = "tfstate"
    key    = "iac-mission/terraform.tfstate"
    region = "us-east-1"

    endpoints = {
      s3 = "http://localhost:9000"
    }

    access_key = "minioadmin"
    secret_key = "minioadmin123"

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    use_path_style              = true

    # Terraform's native S3 conditional-write lock — no DynamoDB table needed.
    use_lockfile = true
  }
}
```
`use_path_style` matters because MinIO expects `http://host:9000/bucket/key`, not the AWS-style `bucket.host` virtual-hosted addressing. `use_lockfile` is Terraform's newer S3-native locking (1.11+) — it uses a conditional `PutObject` against the same bucket instead of a separate DynamoDB table, which is exactly the kind of thing a local MinIO backend can satisfy on its own.

Migrate your existing local state into it:

```bash
terraform init -migrate-state
```
Expected output: `Do you want to copy existing state to the new backend?` → `yes`, then `Successfully configured the backend "s3"! Terraform will automatically use this backend unless the backend configuration changes.`

Confirm the state object actually landed in MinIO, not just that Terraform said so:

```bash
mc ls local/tfstate/iac-mission/
```
Expected output: `terraform.tfstate` with a real size and timestamp.

**Why this matters (write this down, don't just nod along):** local state means only one machine can safely run `apply`, there's no lock so two concurrent applies can race and corrupt the file, and losing the laptop means losing the only record of what Terraform thinks exists. Remote state with locking means any teammate (or CI runner) can `init` against the same backend and get the same picture of reality, and Terraform physically refuses to let two applies run against the same state at the same moment — you'll force that exact collision in the break-fix drills below.

**Checkpoint:** `mc ls local/tfstate/iac-mission/` shows `terraform.tfstate`; `local terraform.tfstate` in your working directory is gone or empty (state now lives remotely); `terraform plan` still runs clean against the migrated backend with zero drift reported.

---

## Phase 5 — workspaces: one config, two environments

A workspace is a named slot for state within the same configuration and backend — `dev` and `prod` each get their own state file under the same bucket, but read the same `.tf` files.

```bash
terraform workspace new dev
terraform workspace new prod
terraform workspace list
```
Expected output:
```
  default
* prod
  dev
```

Add an environment-aware replica count. Update `variables.tf`:

```hcl
variable "web_external_base_port" {
  type        = number
  description = "First external port; replicas increment from here"
  default     = 8100
}
```

Update `locals.tf`:

```hcl
locals {
  full_name = "${var.container_name}-${terraform.workspace}"

  # dev gets one replica, prod gets three — same config, different workspace
  replica_count = terraform.workspace == "prod" ? 3 : 1
}
```

Replace the two named module calls in `main.tf` with a `count`-driven set (the two-caller pattern from Phase 3 already proved the module works — this generalizes it):

```hcl
module "web" {
  source        = "./modules/web-container"
  count         = local.replica_count
  name          = "web-${terraform.workspace}-${count.index}"
  external_port = var.web_external_base_port + count.index
}
```

```bash
terraform workspace select dev
terraform apply
```
Expected output: `Plan: 2 to add` (one container + its image) — `dev`'s state is empty until this apply, since each workspace's state starts blank.

```bash
terraform workspace select prod
terraform apply
```
Expected output: `Plan: 6 to add` (three containers + three images).

**Checkpoint:**
```bash
terraform workspace select dev
docker ps --filter "name=web-dev-"
terraform workspace select prod
docker ps --filter "name=web-prod-"
mc ls local/tfstate/iac-mission/env:/
```
Expected output: exactly one `web-dev-0` container, exactly three `web-prod-{0,1,2}` containers, and `mc ls` showing separate state keys per workspace (Terraform's S3 backend prefixes non-default workspaces under `env:/<workspace-name>/`). Same `.tf` files, same module, two independently-sized environments — that's the whole point of workspaces.

---

## Phase 6 — drift: when reality stops matching state

Terraform's state file is a belief about the world. The world doesn't ask permission before changing.

While still in the `dev` workspace, reach around Terraform and kill one of its managed containers by hand:

```bash
terraform workspace select dev
docker rm -f web-dev-0
```
Expected output: `web-dev-0` — the container Terraform believes it's managing no longer exists, and Terraform doesn't know yet.

Ask Terraform what it thinks:

```bash
terraform plan
```
Expected output: Terraform refreshes state against real Docker, notices `web-dev-0` is gone, and reports `Plan: 1 to add, 0 to change, 0 to destroy` — not "0 changes." It detected the drift during refresh and is proposing to recreate the container to match your configuration, because your `.tf` files still say it should exist.

Reconcile by accepting the plan:

```bash
terraform apply
```
Expected output: `Apply complete! Resources: 1 added, 0 changed, 0 destroyed.` — the container is back, state matches reality again.

There's a second, more dangerous kind of drift: someone recreates a resource *outside* Terraform that duplicates what Terraform already manages (say, a colleague manually runs `docker run` with a name Terraform expects to own). In that case `terraform plan` would try to create a second, colliding resource. The fix there isn't `apply` — it's deciding whether to adopt the existing object with `terraform import` (covered as a drill below) or delete the manual one and let Terraform recreate its own.

**Checkpoint:** you can state, from the `plan` output you actually read, exactly which action Terraform proposed and why — "recreate because it's gone" is a different diagnosis from "update in place" or "destroy because config changed," and mixing them up is how people `apply` the wrong fix under pressure.

---

## Phase 7 — Packer: a golden Ubuntu image with node_exporter and qemu-guest-agent

This is the part of the mission that outlives the mission. The image built here — Ubuntu cloud image plus `node_exporter` plus `qemu-guest-agent`, baked in at build time instead of configured after boot — is the exact artifact reused in `proxmox/03-iac-on-proxmox`. Get it right here and that mission starts from a working template instead of a bare cloud image.

```bash
mkdir -p packer/cloud-init packer/files && cd packer
```

`cloud-init/meta-data`:

```yaml
instance-id: iac-mission-build
local-hostname: iac-builder
```

`cloud-init/user-data` — gives Packer's SSH provisioner something to log into during the build; it gets wiped by the last provisioner before the image is finalized:

```yaml
#cloud-config
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
    plain_text_passwd: ubuntu
ssh_pwauth: true
chpasswd:
  expire: false
```

`files/node_exporter.service`:

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

`ubuntu-node.pkr.hcl` — the full build:

```hcl
packer {
  required_plugins {
    qemu = {
      version = ">= 1.1.0"
      source  = "github.com/hashicorp/qemu"
    }
  }
}

variable "iso_url" {
  type    = string
  default = "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-amd64.img"
}

variable "iso_checksum" {
  type    = string
  default = "file:https://cloud-images.ubuntu.com/releases/22.04/release/SHA256SUMS"
}

variable "node_exporter_version" {
  type    = string
  default = "1.8.2"
}

source "qemu" "ubuntu" {
  iso_url      = var.iso_url
  iso_checksum = var.iso_checksum
  disk_image   = true

  output_directory = "output/ubuntu-node-exporter"
  vm_name          = "ubuntu-node-exporter.qcow2"
  format           = "qcow2"

  disk_size      = "10000M"
  memory         = 2048
  cpus           = 2
  accelerator    = "kvm"
  headless       = true
  net_device     = "virtio-net"
  disk_interface = "virtio"

  cd_files = [
    "./cloud-init/user-data",
    "./cloud-init/meta-data",
  ]
  cd_label = "cidata"

  ssh_username = "ubuntu"
  ssh_password = "ubuntu"
  ssh_timeout  = "20m"

  shutdown_command = "sudo shutdown -P now"
}

build {
  name    = "ubuntu-node-exporter"
  sources = ["source.qemu.ubuntu"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y qemu-guest-agent wget",
      "sudo systemctl enable qemu-guest-agent",
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
      "sudo rm -f /etc/ssh/ssh_host_*",
      "sudo truncate -s 0 /etc/machine-id",
    ]
  }
}
```
The `qemu-guest-agent` install matters because that's the service Proxmox (and any KVM/QEMU hypervisor) uses to get real IP/status info back from the guest instead of guessing. `node_exporter` bakes monitoring in from boot one instead of being a post-deploy afterthought. The final shell provisioner strips the SSH host keys and machine-id — every VM cloned from this image gets its own identity on first boot instead of inheriting the builder's.

```bash
packer init .
```
Expected output: `Installed plugin github.com/hashicorp/qemu ...`.

```bash
packer validate ubuntu-node.pkr.hcl
```
Expected output: `The configuration is valid.`

```bash
packer build ubuntu-node.pkr.hcl
```
Expected output: a build log ending `==> Builds finished. The artifacts of successful builds are: --> ubuntu-node-exporter.qemu: A disk image was created: output/ubuntu-node-exporter/ubuntu-node-exporter.qcow2`. This takes a while — Packer boots a real VM, waits for cloud-init and SSH, runs every provisioner, then shuts it down cleanly.

Boot the artifact once yourself to prove it, rather than trusting the build log alone:

```bash
qemu-system-x86_64 -m 2048 -enable-kvm -nographic \
  -drive file=output/ubuntu-node-exporter/ubuntu-node-exporter.qcow2,if=virtio \
  -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::9100-:9100 \
  -device virtio-net,netdev=net0
```
Then, from another terminal once it's up:

```bash
ssh -p 2222 ubuntu@localhost 'systemctl is-active node_exporter qemu-guest-agent'
curl -s http://localhost:9100/metrics | head -n 5
```
Expected output: `active` twice, and real Prometheus-format metric lines from `node_exporter`.

**Checkpoint:** `output/ubuntu-node-exporter/ubuntu-node-exporter.qcow2` exists on disk, boots cleanly, `node_exporter` and `qemu-guest-agent` are both `active` inside it, and `/metrics` returns real data. Keep this file — `proxmox/03-iac-on-proxmox` imports it directly as a VM template base instead of starting from a bare cloud image.

---

## Phase 8 — validation gates: fmt, validate, tflint in CI

Nobody should be able to merge a Terraform change that isn't even formatted consistently, doesn't parse, or trips a linter rule the team agreed on. Gate it before it ever reaches an `apply`.

`.tflint.hcl`:

```hcl
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_typed_variables" {
  enabled = true
}
```

`.github/workflows/iac-validate.yml`:

```yaml
name: iac-validate

on:
  pull_request:
    paths:
      - "devops/06-iac/**"
  push:
    branches: [main]
    paths:
      - "devops/06-iac/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: devops/06-iac
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.11.0"

      - name: terraform fmt (check only, no rewrites)
        run: terraform fmt -check -recursive

      - name: terraform init (no backend — validate doesn't need real state)
        run: terraform init -backend=false

      - name: terraform validate
        run: terraform validate

      - name: Setup tflint
        uses: terraform-linters/setup-tflint@v4
        with:
          tflint_version: latest

      - name: tflint init
        run: tflint --init

      - name: tflint
        run: tflint --recursive
```
`init -backend=false` matters here — CI has no route to your local MinIO container, and `validate` only needs to parse and type-check the configuration, not talk to a real backend. `paths:` scopes the workflow so unrelated changes elsewhere in the repo don't trigger a Terraform check that has nothing to do with them.

**Checkpoint:** push a branch with a deliberately misformatted `.tf` file (wrong indentation) and watch the `terraform fmt` step fail red in the Actions run; fix it, push again, and watch all four steps go green. You've now proven the gate actually gates, not just that it exists.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — state lost, resource still real

<details>
<summary>Setup</summary>

Pick one of the `module.web` containers from Phase 5. Note its real Docker container ID (`docker inspect --format '{{.Id}}' web-dev-0`), then remove just that resource's entry from Terraform's view of the world without touching Docker — the cleanest way is `terraform state rm 'module.web[0].docker_container.this'`. The container keeps running; Terraform now has no memory of it.
</details>

Expected symptom: `terraform plan` proposes creating a *second* container with the same intended name, or errors outright with a name conflict against the one still running — because as far as Terraform's state is concerned, nothing exists there yet, but Docker disagrees.

<details>
<summary>Hint</summary>
`terraform import` takes an existing real-world object and a resource address and re-links them in state without recreating anything. You'll need the exact resource address (`terraform state list` on a sibling resource, or the module's source, tells you the addressing pattern for indexed module resources) and the Docker container ID you noted above. After a successful import, `terraform plan` should report no changes — that "no changes" is your proof the re-link is complete and correct, not just that the command didn't error.
</details>

### Drill 2 — two applies collide

<details>
<summary>Setup</summary>

Open two terminals in the same working directory, same workspace. In the first, start `terraform apply` and get past the approval prompt so it's actively writing state (a `docker_container` recreate with a short `time_sleep` or just being quick with the second terminal works). Before it finishes, run `terraform apply` in the second terminal.
</details>

Expected symptom: the second `apply` (or sometimes the first, depending on timing) fails with something like `Error acquiring the state lock` and a lock ID, "who" holds it, and "when" it was created.

<details>
<summary>Hint</summary>
This is `use_lockfile` doing exactly its job — read the full error message, it tells you which command/process/host holds the lock, not just that one exists. There's a `-lock=false` flag and a `force-unlock` command that both exist for emergencies; the actual lesson here is understanding *why* reaching for either of those on a lock you don't understand yet is dangerous, and what you should confirm first (is the other process actually still running? did it crash mid-write?) before ever touching a lock someone else's process is holding.
</details>

### Drill 3 — a module change breaks the caller

<details>
<summary>Setup</summary>

Edit `modules/web-container/variables.tf` and rename `external_port` to `host_port` (a real breaking change to the module's interface), but leave the root `main.tf`'s `module "web"` block referencing `external_port` unchanged, and leave `source = "./modules/web-container"` as a bare relative path with no version constraint.
</details>

Expected symptom: `terraform plan` (or `init`, depending on what changed) fails with an error about an unsupported/unexpected argument on the module call — the caller has no idea the module's interface moved out from under it until the error happens, because a plain relative-path source has no version boundary to catch this earlier.

<details>
<summary>Hint</summary>
Revert the rename and instead think about what would have caught this *before* `plan` broke: module `source` can point at a versioned registry entry or a pinned git ref (`source = "git::https://...?ref=v1.2.0"`) instead of an unpinned local path, and a `required_version`-style constraint communicates "this caller was written against this module interface" explicitly. Compare what changing `source` to a pinned tag would have meant for this exact break — would the caller have been protected, or just told about the mismatch more clearly? Both are different from "not breaking at all."
</details>

---

## Prove-it: one tfvars file, one command, an identical second environment

A colleague asks you for a second environment identical in shape to `dev` — same module, same container topology, none of your manual fixes from the drills above repeated by hand. Hand them exactly this:

1. One new file: `colleague.tfvars` (just variable overrides — no `.tf` file touched, no module edited).
2. One command:
```bash
terraform workspace new colleague-env
terraform apply -var-file="colleague.tfvars"
```

Expected end state: a fully running environment — matching container count and health — created from your existing module and configuration, with the *only* artifact you handed over being the tfvars file and that one apply command. If getting there required you to also say "oh, and also run this other script" or "and manually create the bucket path first," that's a deliverable that isn't actually done yet — go back and make the configuration handle it.

<details>
<summary>Hint</summary>
Everything you need for this to be true in one shot already exists from earlier phases: workspaces isolate state automatically (Phase 5), the module means the resource logic is already shared (Phase 3), and variables/tfvars are the only thing that should ever need to differ per environment (Phase 2). If your `colleague.tfvars` needs to contain anything beyond values already defined in `variables.tf`, that's a sign a value got hard-coded somewhere it shouldn't have.
</details>

---

## Done when

- [ ] `terraform state list` / `state show` used to inspect a Docker container and a `kind` cluster both managed by Terraform, through a clean `init`/`plan`/`apply`/`destroy` cycle
- [ ] Variables, outputs, and locals drive the configuration, with a working `.tfvars` file overriding defaults
- [ ] `modules/web-container` exists as a real reusable module, called at least twice with different inputs, no duplicated resource blocks
- [ ] Terraform state lives in a MinIO S3-compatible backend with `use_lockfile` locking, migrated from local state and confirmed present via `mc ls`
- [ ] `dev` and `prod` workspaces produce genuinely different resource counts from the same configuration, confirmed live with `docker ps`
- [ ] A real drift incident: caused on purpose (`docker rm -f` on a managed container), detected in a `terraform plan` diff, reconciled with `terraform apply`
- [ ] A Packer-built `output/ubuntu-node-exporter/ubuntu-node-exporter.qcow2` boots with `node_exporter` and `qemu-guest-agent` both active — the artifact `proxmox/03-iac-on-proxmox` will reuse
- [ ] `.github/workflows/iac-validate.yml` gates `fmt`, `validate`, and `tflint`, proven red-then-green on a real formatting break
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork, before opening the hints
- [ ] Prove-it: a colleague gets an identical second environment from one `.tfvars` file and one `terraform apply` command, nothing else touched
