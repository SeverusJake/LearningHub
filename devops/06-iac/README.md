# Mission 06 — IaC

**Track:** devops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Mission 01 (git)

## Goal

Stop clicking things into existence and start declaring them. This mission takes the container-level thinking from Mission 02 and puts Terraform in front of it: you'll provision local Docker containers and a `kind` cluster through code, refactor duplicated resources into a reusable module, move state off your laptop and into a real remote backend with locking, manage two environments from one codebase with workspaces, and practice reconciling drift when reality and state disagree. Then you'll cross into Packer and bake a golden Ubuntu image with monitoring and guest-agent tooling built in — the same image the Proxmox track boots from in its own IaC mission. By the end, "provision a second environment" means editing one variables file and running one command, not remembering seventeen manual steps.

## Skills gained

- Terraform core lifecycle: `init` / `plan` / `apply` / `destroy`, and reading a plan diff before you trust it
- Provider and resource blocks against the Docker provider, and `terraform state list` / `state show` to inspect what Terraform actually thinks exists
- Variables, outputs, and locals — and `.tfvars` files to drive the same configuration differently per environment
- Writing a reusable module (`modules/web-container`) and calling it twice instead of copy-pasting a resource block
- Remote state in a self-hosted MinIO (S3-compatible) backend, state locking, and why "state on a laptop" is a production incident waiting to happen
- Workspaces for parallel dev/prod state within one configuration, with resource counts that differ per workspace
- Diagnosing and reconciling drift: a manual change outside Terraform shows up in `terraform plan`, and you decide whether to import it or overwrite it
- Building a golden image with Packer's `qemu` builder: cloud-init-driven Ubuntu, provisioners installing `node_exporter` and `qemu-guest-agent`
- Gating IaC changes in CI with `terraform fmt -check`, `terraform validate`, and `tflint`

## Deliverables

- [ ] A Terraform configuration managing local Docker containers and a `kind` cluster, built through a reusable `modules/web-container` module called at least twice
- [ ] Remote state stored in a MinIO S3-compatible backend, with state locking configured and proven
- [ ] Dev and prod workspaces with genuinely different resource counts, driven by `.tfvars`, not by hand-editing `.tf` files
- [ ] A documented drift incident: caused on purpose, detected with `terraform plan`, and reconciled deliberately
- [ ] A Packer-built Ubuntu cloud image with `node_exporter` and `qemu-guest-agent` baked in — the exact artifact reused by `proxmox/03-iac-on-proxmox`
- [ ] A GitHub Actions workflow gating every change on `fmt`, `validate`, and `tflint`
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork
- [ ] Prove-it: a colleague asks for an identical second environment — you hand them one `.tfvars` file and one command, nothing else changes

## Start

Open a Claude Code session in this folder and say: `start devops/06`. Follow GUIDE.md.
