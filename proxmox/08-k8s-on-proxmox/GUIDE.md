# Guide — Mission 08: K8s on Proxmox

This is not a script to paste blindly — this is a live company cluster, and by the end of this mission it is running a real, HA control plane that other missions (proxmox/09, proxmox/10, and anything you build afterward) will assume is still there. Read each phase, run the commands, and look at the actual output before moving on. Every phase ends in a checkpoint that proves the infrastructure did what you think it did, not just that a command exited zero.

**Safety-contract values, carried forward from Missions 01 and 03:**

```
Resource pool                : learning
VM ID range                  : 9000-9999
Golden template               : VMID 9010, tpl-ubuntu2404-node-exporter-v1 (Mission 03's Packer image — falls back to VMID 9000 if you skipped Packer, node_exporter just won't be along for the ride)
Dedicated bridge              : vmbr-lab (VLAN tag 100 in these examples)
Lab subnet                    : 10.10.100.0/24, gateway 10.10.100.1
API token                     : learn@pve!tf
Tag on every learning object    : learning
```

**This mission's own conventions, used from here on:**

```
Cluster name                          : pve-lab
Control-plane VIP (kube-vip)          : 10.10.100.150
MetalLB L2 address pool               : 10.10.100.220-10.10.100.229
k3s server node   1 / 2 / 3           : 9401 k3s-server-1 (pve1, 10.10.100.151, cluster-init)
                                         9402 k3s-server-2 (pve2, 10.10.100.152, joins via VIP)
                                         9403 k3s-server-3 (pve3, 10.10.100.153, joins via VIP)
k3s agent node    1 / 2               : 9404 k3s-agent-1  (pve1, 10.10.100.154)
                                         9405 k3s-agent-2  (pve2, 10.10.100.155)
```

Every node is written as `pve1`/`pve2`/`pve3` below — substitute your cluster's real node names. Spreading the three servers one-per-physical-node is deliberate: it's the only layout where a single dead hypervisor can't cost you etcd quorum on its own.

## Starting point

Confirm your tools before starting:

```bash
terraform -version
kubectl version --client
helm version
argocd version --client
k6 version
```

Expected output: a version string from each (Terraform ≥ 1.9, kubectl ≥ 1.29, Helm ≥ 3.14, argocd CLI ≥ 2.11, k6 ≥ 0.50). You also need Mission 03's `pve-iac/` Terraform directory (`modules/pve-vm`, the `bpg/proxmox` provider auth, the `learn@pve!tf` token secret exported as `TF_VAR_pve_api_secret`) and devops/07's `shiplog-gitops` repo with a running ArgoCD instance — this mission extends both rather than starting fresh.

```bash
cd ~/pve-iac
terraform init
terraform state list | grep pve-vm
```

Expected output: `module.fleet.module...` or similar, proving Mission 03's state and module are actually there before you build on top of them.

---

## Phase 1 — architecture decision: k3s HA vs. kubeadm

You cannot cloud-init your way through five VMs' worth of bootstrap without first deciding, in writing, which control-plane architecture you're actually building — the two are not interchangeable at the install-script level.

| Dimension | k3s HA (embedded etcd) | kubeadm (stacked or external etcd) |
|---|---|---|
| Binary / footprint | one ~70MB static binary bundling server, agent, containerd, kubelet, and the control-plane components | separate binaries per component (kubelet, kubeadm, a separately-run etcd, your own CNI choice), each versioned independently |
| etcd topology | embedded automatically the instant you pass `--cluster-init` — no separate etcd cluster to stand up or operate | stacked (etcd co-located on control-plane nodes) or external (dedicated etcd VMs) — either way, a second cluster you now run and reason about |
| Bootstrap mechanism | one `curl \| sh` install script per node; a shared token plus a role flag decide everything | `kubeadm init` on node 1 produces a join token and a CA cert hash you must securely distribute to every other node, then `kubeadm join` per node |
| Default add-ons | Traefik, ServiceLB, `local-path-provisioner`, CoreDNS — all bundled, all individually disable-able | nothing bundled; you install a CNI, an ingress controller, and storage provisioning yourself, always |
| Resource floor per control-plane node | comfortably runs in 2 vCPU / 4GB — built for constrained and edge hardware | commonly-recommended minimums land in the same range but grow faster as separately-run add-ons stack up |
| HA bootstrap complexity | one flag on node 1 (`--cluster-init`), one flag on the rest (`--server https://<peer>:6443`) | multiple `kubeadm` invocations, manual cert/key distribution between control-plane nodes, materially more moving parts to get wrong |
| Upgrade story | replace the k3s binary, restart one systemd service — brief, single-component disruption per node | coordinate kubelet, control-plane component, and (if stacked) etcd versions across a compatibility-skew window |
| Where it wins | homelab/edge/on-prem clusters run by a small team that wants a standard Kubernetes API with minimal separately-operated infrastructure underneath it | shops already standardized on stock upstream tooling, or a platform team that needs every component independently swappable |

**Why k3s, here, specifically:** this mission's entire premise is that a node's whole identity reduces to "one flag choice, one shared secret" so it can be handed to cloud-init with zero post-boot SSH steps — that's k3s's install script, not kubeadm's multi-step token-and-cert-hash dance. Embedded etcd means the HA story is "3 servers, `--cluster-init` once," with no separate etcd fleet to size or back up — its quorum math is the exact same N/2+1 arithmetic you did by hand in Mission 06 for corosync, just running one layer up the stack (3 members tolerate 1 loss, and that's the number this mission's Phase 7 drill spends its entire budget proving for real). And the resource floor matters directly here, because this cluster shares real, finite company hardware with everyone else's workloads: k3s's whole control plane fits in the same 2 vCPU/4GB envelope a bare kubeadm control-plane node would want for the API server and scheduler alone, before etcd's own footprint is even counted separately.

**Sizing guidance, used for every VM below:**

- **k3s server** (control plane + embedded etcd): **2 vCPU / 4GB RAM minimum**, 20GB disk on the fastest storage your cluster has. etcd's quorum timeouts are measured against write latency — a server on spinning-rust-backed `local-lvm` is a real risk to cluster stability, not a theoretical one.
- **k3s agent** (workload node): 2 vCPU / 4GB RAM for this mission specifically — shiplog, Postgres, ingress-nginx, and a MetalLB speaker all need to land somewhere. A lighter 2 vCPU / 2GB floor is viable for agents once you're past this mission's exact footprint.
- Five VMs at this sizing commit 10 vCPU / 20GB RAM against the shared cluster. Confirm that's actually free before provisioning:

```bash
pvesh get /cluster/resources --type node --output-format json | jq -r '.[] | "\(.node): \(.maxcpu) vCPU total, \(.maxmem/1024/1024/1024|floor)GB RAM total"'
```

**Checkpoint:** you can state, from the table above and without notes, the one-sentence reason k3s's embedded etcd removes an entire category of operational work that kubeadm never removes, and you've confirmed real headroom for 10 vCPU/20GB across three physical nodes before continuing.

---

## Phase 2 — Terraform: five VMs, cloud-init-driven, zero post-boot commands

**Enable Proxmox snippets on a datastore.** Custom cloud-init user-data has to live somewhere Proxmox can read it from at boot — a `snippets`-enabled datastore is that place, and it's very likely not enabled yet:

```bash
pvesm status -storage local
```

Expected output: a `content` column that does **not** yet list `snippets` (commonly `iso,vztmpl,backup` only). Add it — this replaces the whole content-type list, so keep every type already there:

```bash
pvesm set local --content iso,vztmpl,backup,snippets
```

Expected output: no output on success. Confirm:

```bash
pvesm status -storage local
```

Expected output: `content` now includes `snippets`.

**Extend Mission 03's `modules/pve-vm`** to accept a per-VM custom cloud-init user-data file instead of always generating one from `user_account`. `modules/pve-vm/variables.tf` — add one field to the `vms` object type:

```hcl
variable "vms" {
  description = "Map of VM name => its configuration"
  type = map(object({
    node_name         = string
    vm_id             = number
    ip                = string
    gateway           = optional(string, "10.10.100.1")
    cores             = optional(number, 2)
    memory            = optional(number, 2048)
    disk_size         = optional(number, 10)
    tags              = optional(list(string), [])
    user_data_file_id = optional(string, null)
  }))
}
```

`modules/pve-vm/main.tf` — when a VM supplies `user_data_file_id`, stop generating a `user_account` block (the provider does not allow both at once — a custom `user_data_file_id` completely replaces the auto-generated cloud-init user-data, SSH keys and all) and reference the uploaded snippet instead:

```hcl
  initialization {
    datastore_id = "local-lvm"

    dynamic "user_account" {
      for_each = each.value.user_data_file_id == null ? [1] : []
      content {
        username = "ubuntu"
        keys     = [trimspace(file(var.ssh_public_key_path))]
      }
    }

    user_data_file_id = each.value.user_data_file_id

    ip_config {
      ipv4 {
        address = "${each.value.ip}/24"
        gateway = each.value.gateway
      }
    }
  }
```

Network config (`ip_config`) stays independent of `user_data_file_id` — the provider writes it to its own `network-config` file regardless of where user-data comes from, so every VM still gets a static IP through Terraform even though its cloud-init identity now comes from a hand-written template.

**The three cloud-init templates.** `cloud-init/kube-vip-manifest.tftpl` — shared by all three servers, rendered inline into each one's user-data:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kube-vip
  namespace: kube-system
spec:
  containers:
    - name: kube-vip
      image: ghcr.io/kube-vip/kube-vip:v0.8.2
      imagePullPolicy: IfNotPresent
      args: ["manager"]
      env:
        - name: vip_arp
          value: "true"
        - name: port
          value: "6443"
        - name: vip_interface
          value: "eth0"
        - name: vip_cidr
          value: "32"
        - name: cp_enable
          value: "true"
        - name: cp_namespace
          value: "kube-system"
        - name: svc_enable
          value: "false"
        - name: vip_leaderelection
          value: "true"
        - name: vip_leaseduration
          value: "5"
        - name: vip_renewdeadline
          value: "3"
        - name: vip_retryperiod
          value: "1"
        - name: address
          value: "${vip_address}"
      securityContext:
        capabilities:
          add: ["NET_ADMIN", "NET_RAW"]
      volumeMounts:
        - mountPath: /etc/rancher/k3s/k3s.yaml
          name: kubeconfig
  hostAliases:
    - hostnames: ["kubernetes"]
      ip: 127.0.0.1
  hostNetwork: true
  volumes:
    - name: kubeconfig
      hostPath:
        path: /etc/rancher/k3s/k3s.yaml
```

`cloud-init/server-init.yaml.tftpl` — the very first server, the only node that ever passes `--cluster-init`:

```yaml
#cloud-config
hostname: ${hostname}
users:
  - name: ubuntu
    groups: sudo
    shell: /bin/bash
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    ssh_authorized_keys:
      - ${ssh_public_key}
package_update: true
write_files:
  - path: /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
    permissions: "0644"
    content: |
      ${indent(6, kube_vip_manifest)}
runcmd:
  - curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --cluster-init --tls-san ${vip_address} --disable traefik --disable servicelb --node-taint node-role.kubernetes.io/control-plane=true:NoSchedule" K3S_TOKEN="${k3s_token}" sh -s -
```

`cloud-init/server-join.yaml.tftpl` — the other two servers; same kube-vip manifest (so either can win the VIP's leader election later), different install flags:

```yaml
#cloud-config
hostname: ${hostname}
users:
  - name: ubuntu
    groups: sudo
    shell: /bin/bash
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    ssh_authorized_keys:
      - ${ssh_public_key}
package_update: true
write_files:
  - path: /var/lib/rancher/k3s/server/manifests/kube-vip.yaml
    permissions: "0644"
    content: |
      ${indent(6, kube_vip_manifest)}
runcmd:
  - curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --server https://${vip_address}:6443 --tls-san ${vip_address} --disable traefik --disable servicelb --node-taint node-role.kubernetes.io/control-plane=true:NoSchedule" K3S_TOKEN="${k3s_token}" sh -s -
```

`cloud-init/agent-join.yaml.tftpl` — no kube-vip, no control-plane taint, just join:

```yaml
#cloud-config
hostname: ${hostname}
users:
  - name: ubuntu
    groups: sudo
    shell: /bin/bash
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    ssh_authorized_keys:
      - ${ssh_public_key}
package_update: true
runcmd:
  - curl -sfL https://get.k3s.io | K3S_URL="https://${vip_address}:6443" K3S_TOKEN="${k3s_token}" sh -s -
```

**Why `server/manifests/` and not a plain static-pod path:** k3s's server process ships its own manifest auto-deploy controller that watches `/var/lib/rancher/k3s/server/manifests/` and applies anything it finds directly against its own embedded API server as soon as that server comes up — over loopback, entirely internal to the node, with no dependency on the VIP existing yet. kube-vip only becomes useful *after* it's running: it's what gives servers 2 and 3, agents, ArgoCD, and your own `kubectl` a single floating address that survives any one server dying, not something server 1 needs in order to bootstrap itself.

**The join token, the VIP, and wiring it all together.** `k3s.tf`:

```hcl
terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.66"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
  }
}

resource "random_password" "k3s_token" {
  length  = 48
  special = false
}

variable "k3s_vip" {
  type    = string
  default = "10.10.100.150"
}

locals {
  kube_vip_manifest = templatefile("${path.module}/cloud-init/kube-vip-manifest.tftpl", {
    vip_address = var.k3s_vip
  })

  k3s_vms = {
    k3s-server-1 = { node_name = "pve1", vm_id = 9401, ip = "10.10.100.151", role = "server", cluster_init = true }
    k3s-server-2 = { node_name = "pve2", vm_id = 9402, ip = "10.10.100.152", role = "server", cluster_init = false }
    k3s-server-3 = { node_name = "pve3", vm_id = 9403, ip = "10.10.100.153", role = "server", cluster_init = false }
    k3s-agent-1  = { node_name = "pve1", vm_id = 9404, ip = "10.10.100.154", role = "agent",  cluster_init = false }
    k3s-agent-2  = { node_name = "pve2", vm_id = 9405, ip = "10.10.100.155", role = "agent",  cluster_init = false }
  }

  k3s_template_path = {
    for name, vm in local.k3s_vms : name => (
      vm.role == "agent" ? "${path.module}/cloud-init/agent-join.yaml.tftpl" :
      vm.cluster_init ? "${path.module}/cloud-init/server-init.yaml.tftpl" :
      "${path.module}/cloud-init/server-join.yaml.tftpl"
    )
  }
}

resource "proxmox_virtual_environment_file" "k3s_user_data" {
  for_each     = local.k3s_vms
  content_type = "snippets"
  datastore_id = "local"
  node_name    = each.value.node_name

  source_raw {
    file_name = "k3s-user-data-${each.key}.yaml"
    data = templatefile(local.k3s_template_path[each.key], {
      hostname          = each.key
      vip_address       = var.k3s_vip
      k3s_token         = random_password.k3s_token.result
      ssh_public_key    = trimspace(file(var.ssh_public_key_path))
      kube_vip_manifest = local.kube_vip_manifest
    })
  }
}

module "k3s_first_server" {
  source         = "./modules/pve-vm"
  template_vm_id = 9010

  vms = {
    k3s-server-1 = merge(local.k3s_vms["k3s-server-1"], {
      user_data_file_id = proxmox_virtual_environment_file.k3s_user_data["k3s-server-1"].id
      tags              = ["k3s", "server"]
    })
  }
}

# Real HA bootstrap has a real ordering dependency: servers 2/3 and both agents
# must not attempt to join before server 1's own API and kube-vip are actually up.
# This is exactly the ordering break-fix drill 1 below is built around.
resource "time_sleep" "wait_for_first_server" {
  depends_on      = [module.k3s_first_server]
  create_duration = "90s"
}

module "k3s_rest" {
  source         = "./modules/pve-vm"
  template_vm_id = 9010
  depends_on     = [time_sleep.wait_for_first_server]

  vms = {
    for name, vm in local.k3s_vms : name => merge(vm, {
      user_data_file_id = proxmox_virtual_environment_file.k3s_user_data[name].id
      tags              = ["k3s", vm.role]
    }) if name != "k3s-server-1"
  }
}
```

```bash
terraform init
```

Expected output: `Installing hashicorp/time...` alongside the already-installed `bpg/proxmox`.

```bash
terraform apply
```

Expected output: `Plan: 7 to add` (5 VMs + `random_password.k3s_token` + the snippet uploads counted per-resource — read the actual plan, the exact count depends on how Terraform batches the `for_each` snippet resource). Apply it, then wait — the first server clones, boots, and installs k3s while `time_sleep` counts down 90 seconds before the other four VMs are even created.

**Checkpoint:**

```bash
qm status 9401
ssh ubuntu@10.10.100.151 'sudo systemctl is-active k3s'
```

Expected output: `status: running` and `active`. Do not continue to Phase 3 until server 1's own `k3s` service is `active` — the 90-second sleep is a courtesy, not a guarantee; if server 1 is slow to come up (a busy node, a cold clone), confirm it's actually ready before trusting the other four VMs joined cleanly.

---

## Phase 3 — kube-vip and the first `kubectl get nodes`

Retrieve the kubeconfig k3s generated on server 1, and repoint its embedded `127.0.0.1` server address at the VIP — the whole reason kube-vip exists is so this file (and everyone else's) never has to hardcode a single node's IP:

```bash
scp ubuntu@10.10.100.151:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-pve.yaml
sed -i 's/127.0.0.1/10.10.100.150/' ~/.kube/k3s-pve.yaml
export KUBECONFIG=~/.kube/k3s-pve.yaml
```

```bash
kubectl get nodes -o wide
```

Expected output: 5 rows — `k3s-server-1/2/3` with `ROLES` including `control-plane,etcd,master`, `k3s-agent-1/2` with `ROLES` blank (worker) — all `STATUS: Ready`. If you see fewer than 5, or any stuck `NotReady`, that node's cloud-init join step is the thing to investigate before proceeding — do not paper over it by re-running commands by hand.

Confirm kube-vip itself, and prove the VIP is actually routing to a live API server rather than just existing as an unused IP:

```bash
kubectl -n kube-system get pods -l app.kubernetes.io/name=kube-vip 2>/dev/null; kubectl -n kube-system get pods | grep kube-vip
```

Expected output: three `kube-vip-*` pods, one per server, all `Running` — only one is currently holding the lease, but all three are alive and eligible to win it. See who's holding it:

```bash
kubectl -n kube-system get lease plndr-cp-lock
```

Expected output: a `HOLDER` field naming whichever server currently owns the VIP.

```bash
curl -k -s -o /dev/null -w "%{http_code}\n" https://10.10.100.150:6443/version
```

Expected output: `401` — Unauthorized, because you sent no credentials, but a `401` (not a connection refused or a timeout) proves the VIP is genuinely answering TLS on port 6443 for the real API server behind it, not just sitting there as an unclaimed address.

**Checkpoint:** `kubectl get nodes` shows all 5 nodes `Ready` while `KUBECONFIG` points only at the VIP address, never at any single node's own IP — and `plndr-cp-lock`'s holder is a real server name, proving leader election actually ran.

---

## Phase 4 — MetalLB in L2 mode

k3s's default `ServiceLB` was disabled at install time specifically so this phase means something — without MetalLB, every `type: LoadBalancer` Service on this cluster would sit at `<pending>` forever, exactly the way it does on any other bare-metal cluster with no cloud provider to hand out IPs.

```bash
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.8/config/manifests/metallb-native.yaml
kubectl -n metallb-system rollout status deploy/controller --timeout=120s
```

Expected output: `deployment "controller" successfully rolled out`.

`metallb/ipaddresspool.yaml` — a slice of the lab subnet no other mission or VM uses:

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: lab-pool
  namespace: metallb-system
spec:
  addresses:
    - 10.10.100.220-10.10.100.229
```

`metallb/l2advertisement.yaml`:

```yaml
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: lab-l2
  namespace: metallb-system
spec:
  ipAddressPools:
    - lab-pool
```

```bash
kubectl apply -f metallb/ipaddresspool.yaml -f metallb/l2advertisement.yaml
```

Expected output: `ipaddresspool.metallb.io/lab-pool created`, `l2advertisement.metallb.io/lab-l2 created`.

Prove it with a disposable test Service:

```bash
kubectl create deployment metallb-smoke --image=nginx:1.27-alpine
kubectl expose deployment metallb-smoke --port=80 --type=LoadBalancer
kubectl get svc metallb-smoke -w
```

Expected output: `EXTERNAL-IP` moves from `<pending>` to `10.10.100.220` within a few seconds. Ctrl-C the watch once it's assigned.

From a workstation or any VM actually on the `10.10.100.0/24` lab network — not through any port-forward:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://10.10.100.220/
```

Expected output: `200`. Clean up the smoke test before moving on:

```bash
kubectl delete deployment metallb-smoke
kubectl delete svc metallb-smoke
```

**Checkpoint:** a real `LoadBalancer` Service got a real IP from `lab-pool`, and `curl` from an actual lab-network host — not `kubectl port-forward`, not `localhost` — returned `200`. That's the ARP announcement working, not a shortcut around it.

---

## Phase 5 — storage: local-path vs. Proxmox CSI

**local-path** is already there — k3s ships it by default and nothing in Phase 2's install flags disabled it:

```bash
kubectl get storageclass
```

Expected output: `local-path` listed, `(default)` next to it.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: local-path-test
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: local-path-writer
spec:
  containers:
    - name: writer
      image: busybox
      command: ["sh", "-c", "echo hello > /data/hello.txt && sleep 3600"]
      volumeMounts:
        - mountPath: /data
          name: vol
  volumes:
    - name: vol
      persistentVolumeClaim:
        claimName: local-path-test
EOF
kubectl get pvc local-path-test
```

Expected output: `local-path-test` `Bound`, pod `local-path-writer` `Running`.

**Proxmox CSI** ([sergelogvinov/proxmox-csi-plugin](https://github.com/sergelogvinov/proxmox-csi-plugin)) provisions real Proxmox disks on demand instead of using a node's local filesystem. It needs the exact same class of privilege the `learn@pve!tf` token was missing in Mission 03 — disk allocation privileges the original `LearningRole` never had reason to include:

```bash
pveum role modify LearningRole -privs "VM.Allocate,VM.Audit,VM.Backup,VM.Clone,VM.Config.CDROM,VM.Config.CPU,VM.Config.Cloudinit,VM.Config.Disk,VM.Config.HWType,VM.Config.Memory,VM.Config.Network,VM.Config.Options,VM.Console,VM.Migrate,VM.Monitor,VM.PowerMgmt,VM.Snapshot,VM.Snapshot.Rollback,Datastore.AllocateSpace,Datastore.Audit"
pveum acl modify /storage/local-lvm --roles LearningRole --tokens 'learn@pve!tf'
```

(If you already granted this in Mission 03, `pveum acl list | grep local-lvm` will show it's already there — confirm rather than assume.)

Store the token as a Proxmox CSI config secret:

```bash
cat > /tmp/csi-config.yaml <<EOF
clusters:
  - url: https://pve1.company.local:8006/api2/json
    insecure: true
    token_id: "learn@pve!tf"
    token_secret: "<token-secret>"
    region: pve-lab
EOF
kubectl create secret generic proxmox-csi-plugin -n kube-system --from-file=config.yaml=/tmp/csi-config.yaml
rm /tmp/csi-config.yaml
```

```bash
helm repo add proxmox-csi https://sergelogvinov.github.io/proxmox-csi-plugin
helm upgrade --install proxmox-csi-plugin proxmox-csi/proxmox-csi-plugin -n kube-system
kubectl -n kube-system rollout status deploy/proxmox-csi-plugin-controller --timeout=120s
```

Expected output: `deployment "proxmox-csi-plugin-controller" successfully rolled out`.

**The node-identity gap.** The CSI controller needs to know which Proxmox VMID each Kubernetes node corresponds to — normally a cloud-controller-manager sets this automatically via `spec.providerID`. This lab skips running a full CCM and patches it by hand instead (the honest shortcut, not a hidden one):

```bash
kubectl patch node k3s-agent-1 -p '{"spec":{"providerID":"proxmox://pve-lab/9404"}}'
kubectl patch node k3s-agent-2 -p '{"spec":{"providerID":"proxmox://pve-lab/9405"}}'
```

`manifests/storageclass-proxmox-csi.yaml`:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: proxmox-csi
provisioner: csi.proxmox.sinextra.dev
parameters:
  storage: local-lvm
  cache: none
  ssd: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

`volumeBindingMode: WaitForFirstConsumer` matters here specifically: the CSI driver can only provision a disk on the same physical node the pod actually lands on, so binding has to wait until the scheduler has already made that decision.

```bash
kubectl apply -f manifests/storageclass-proxmox-csi.yaml
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: proxmox-csi-test
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: proxmox-csi
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: proxmox-csi-writer
spec:
  containers:
    - name: writer
      image: busybox
      command: ["sh", "-c", "echo hello > /data/hello.txt && sleep 3600"]
      volumeMounts:
        - mountPath: /data
          name: vol
  volumes:
    - name: vol
      persistentVolumeClaim:
        claimName: proxmox-csi-test
EOF
kubectl get pvc proxmox-csi-test
```

Expected output: `proxmox-csi-test` `Bound`, pod `Running`. Confirm the disk is real, on the actual Proxmox node the pod landed on:

```bash
kubectl get pod proxmox-csi-writer -o jsonpath='{.spec.nodeName}'
qm config 9404 | grep scsi1
```

Expected output: a new `scsi1` (or next free slot) disk entry on whichever agent VMID the pod scheduled to — a disk Terraform never created, provisioned live by the CSI driver.

**Comparison table:**

| Dimension | local-path | Proxmox CSI (`local-lvm`, per-node) |
|---|---|---|
| Setup complexity | zero — ships with k3s | Helm install, token privilege grant, manual `providerID` patch per node |
| Portability if the pod reschedules | none — data is pinned to whichever node created it via a node affinity k3s adds automatically | none, in this exact config — `local-lvm` is just as node-local as `local-path`'s own directory; only a **shared** Proxmox storage (Ceph's `lab-rbd` from Mission 04, if you have it) makes a CSI volume follow the pod to a different node |
| Performance | fastest possible — a directory on the node's own disk, no network hop, no extra driver in the I/O path | one layer of indirection (a real virtual disk, attached over the same path any other VM disk uses) — close to native, not zero-cost |
| Failure behavior if the node dies | data unavailable until that exact node returns — pod cannot reschedule anywhere else and keep its data | on `local-lvm`: identical failure mode to local-path. On a Ceph-backed storage id instead: the disk survives the node's death and a rescheduled pod can reattach it elsewhere |
| Setup honesty | none required | this lab skips the cloud-controller-manager and patches `providerID` by hand — real production use of this driver runs the CCM so that step is automatic |
| Best use here | shiplog's own ephemeral scratch space, anything genuinely fine to lose with its node | Postgres's actual data — swap `parameters.storage` to `lab-rbd` in Phase 6 if Mission 04 is done, specifically so a dead agent doesn't take the database down with it |

**Checkpoint:** both PVCs are `Bound`, both writer pods are `Running`, and you can point at the `qm config` output proving the Proxmox CSI PVC is a real disk that didn't exist before you created the PVC — plus a one-sentence answer for why `local-lvm`-backed CSI storage isn't actually more portable than local-path, only `lab-rbd`-backed CSI storage would be.

---

## Phase 6 — GitOps bridge: register this cluster in devops/07's ArgoCD

**Merge this cluster's kubeconfig into the same kubeconfig your ArgoCD CLI already uses**, renaming its context so it doesn't collide with your `kind` cluster's:

```bash
kubectl config rename-context default pve-lab --kubeconfig ~/.kube/k3s-pve.yaml
KUBECONFIG=~/.kube/config:~/.kube/k3s-pve.yaml kubectl config view --flatten > /tmp/merged-kubeconfig
mv /tmp/merged-kubeconfig ~/.kube/config
kubectl config get-contexts
```

Expected output: both `kind-kind` (or whatever your kind context is named) and `pve-lab` listed.

**Register the cluster** — this is the one command in this whole phase that isn't a `git push`, and it's an ArgoCD operation, not a `kubectl apply`:

```bash
argocd cluster add pve-lab --name pve-lab
```

Expected output: a warning that this will create a `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` named `argocd-manager` inside the `pve-lab` context — confirm with `y`. Then: `Cluster 'https://10.10.100.150:6443' added`.

```bash
argocd cluster list
```

Expected output: two rows — the in-cluster `https://kubernetes.default.svc` (the kind cluster ArgoCD itself runs on) and `https://10.10.100.150:6443` named `pve-lab`, both showing a successful connection state.

**ingress-nginx on this cluster**, exposed through MetalLB (traefik was disabled at install time, so there is no ingress controller here yet):

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer
kubectl -n ingress-nginx get svc ingress-nginx-controller
```

Expected output: `EXTERNAL-IP` set to the next free `lab-pool` address, `10.10.100.221`.

**sealed-secrets on this cluster** (its own controller, its own keypair — a `SealedSecret` sealed against devops/07's kind cluster will not decrypt here, the same namespace/name-and-cluster-keypair scoping Break-fix Drill 2 in devops/07 already taught you):

```bash
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/controller.yaml
kubectl -n kube-system rollout status deploy/sealed-secrets-controller
```

Seal the pve DB secret the same way devops/07 Phase 5 did, targeted at this cluster and the `shiplog-pve` namespace:

```bash
kubectl create secret generic shiplog-pve-secret -n shiplog-pve \
  --dry-run=client \
  --from-literal=DATABASE_URL='postgresql://shiplog:a-real-password-here@shiplog-pve-postgres.shiplog-pve.svc.cluster.local:5432/shiplog' \
  --from-literal=LOG_LEVEL='info' \
  -o yaml > /tmp/shiplog-pve-secret-plain.yaml
kubeseal --controller-namespace kube-system --controller-name sealed-secrets-controller \
  --format yaml < /tmp/shiplog-pve-secret-plain.yaml > apps/shiplog/envs/pve/sealed-secret.yaml
rm /tmp/shiplog-pve-secret-plain.yaml
```

**The new environment**, in the `shiplog-gitops` repo from devops/07. `apps/shiplog/envs/pve/values.yaml`:

```yaml
replicaCount: 2

image:
  repository: ghcr.io/<owner>/shiplog
  tag: v0.2.0

service:
  type: ClusterIP

ingress:
  enabled: true
  className: nginx
  host: shiplog.pve.lab

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

postgres:
  enabled: true
  storageClassName: proxmox-csi
  storage: 5Gi

externalSecret: true
migration:
  enabled: true
```

`argocd/shiplog-pve.yaml` — same multi-source shape every other environment uses, but `destination.name` instead of `destination.server`, naming the cluster by the friendly name `argocd cluster add` just registered rather than an in-cluster URL:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shiplog-pve
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  sources:
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      path: apps/shiplog/base
      helm:
        releaseName: shiplog-pve
        valueFiles:
          - $values/apps/shiplog/envs/pve/values.yaml
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      ref: values
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      path: apps/shiplog/envs/pve
      directory:
        include: "sealed-secret.yaml"
  destination:
    name: pve-lab
    namespace: shiplog-pve
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

devops/07's app-of-apps `root` Application already watches every file under `argocd/` — adding this one file is the entire registration:

```bash
git add apps/shiplog/envs/pve/values.yaml apps/shiplog/envs/pve/sealed-secret.yaml argocd/shiplog-pve.yaml
git commit -m "gitops: add pve environment on the external k3s cluster"
git push
argocd app sync root
```

**Checkpoint:**

```bash
argocd app get shiplog-pve
kubectl --context pve-lab get pods -n shiplog-pve
```

Expected output: `Sync Status: Synced`, `Health Status: Healthy`, destination showing `pve-lab`; pods `Running`/`Ready` on the actual k3s cluster, not the kind one. Prove it end to end:

```bash
curl -s -H "Host: shiplog.pve.lab" http://10.10.100.221/healthz
```

Expected output: `{"status":"ok"}` — served by a pod running on hardware you provisioned yourself in Phase 2, deployed by the exact same ArgoCD instance managing dev/staging/prod on `kind`.

---

## Phase 7 — resilience: replace an agent, then kill a server for real

**Agent replacement via Terraform**, the boring, expected kind of disruption:

```bash
terraform taint 'module.k3s_rest.proxmox_virtual_environment_vm.this["k3s-agent-2"]'
terraform apply
```

Expected output: `Plan: 1 to add, 0 to change, 1 to destroy` — Terraform destroys and recreates only `k3s-agent-2`; its cloud-init join script runs again on the fresh VM and it rejoins on its own.

```bash
kubectl get pods -n shiplog-pve -o wide -w
```

Expected output: any shiplog/Postgres pod that had been on `k3s-agent-2` gets rescheduled onto a surviving node while it's gone, then the scheduler is free to rebalance once the new VM rejoins `Ready`. Ctrl-C once you've watched a full cycle.

**Now the real test — a hard-killed server, mid-flight, no graceful shutdown.** Note the wall-clock time, then, from a node that isn't the target:

```bash
qm stop 9402
```

`qm stop` is an immediate power-off — the Proxmox equivalent of pulling the plug, not `qm shutdown`'s ACPI request. `k3s-server-2` (VMID 9402) is gone with no warning to etcd or the API.

**API stays reachable via the VIP** — run this from your workstation, hitting only `10.10.100.150`, never a node IP directly:

```bash
kubectl get nodes
```

Expected output: 5 rows still returned — `k3s-server-2` flips to `NotReady` within seconds, but the command itself succeeds throughout, proving the VIP failed over to one of the two surviving servers (or was already pointed at one) without you doing anything.

**etcd quorum holds — proven, not assumed.** SSH to a *surviving* server and ask etcd to do real work:

```bash
ssh ubuntu@10.10.100.151
sudo k3s etcd-snapshot save --dir /tmp
```

Expected output: a successful snapshot file written. `etcd-snapshot save` requires a quorate cluster to succeed — a passing result here is direct proof that 2 of 3 members still hold quorum, not an inference from `kubectl` still working.

**Workloads are unaffected** — shiplog and Postgres were never scheduled on a control-plane node (the `node-role.kubernetes.io/control-plane=true:NoSchedule` taint from Phase 2 saw to that):

```bash
kubectl get pods -n shiplog-pve
curl -s -H "Host: shiplog.pve.lab" http://10.10.100.221/healthz
```

Expected output: pods still `Running`/`Ready`, `/healthz` still `200` throughout — the app never knew a control-plane node died.

Bring it back and confirm full recovery:

```bash
qm start 9402
```

```bash
kubectl get nodes -w
```

Expected output: `k3s-server-2` returns to `Ready` within a minute or two of boot, rejoining etcd on its own.

**Evidence checklist for this phase — all of it, not a subset:**

- [ ] Timestamped note of when `qm stop 9402` ran
- [ ] `kubectl get nodes` output captured *during* the outage, showing 4/5 `Ready` and `k3s-server-2` `NotReady`
- [ ] `sudo k3s etcd-snapshot save` succeeding on a surviving server *during* the outage
- [ ] `curl .../healthz` returning `200` at least once *during* the outage
- [ ] `kubectl get nodes` showing 5/5 `Ready` again after `qm start 9402`

**Checkpoint:** every box above is checked with a real captured output, not a memory of having seen it happen once.

---

## Phase 8 — teardown / rebuild, timed

```bash
time terraform destroy
```

Expected output: all 5 VMs (and the snippet uploads, and the `random_password`) destroyed; record the elapsed time.

```bash
time terraform apply
```

Expected output: the full fleet recreated from scratch. Because this is a genuinely new cluster (new etcd, new CA, new certs), last time's kubeconfig will fail TLS verification against it — re-run Phase 3's `scp`/`sed` steps to fetch a fresh one before checking node status:

```bash
scp ubuntu@10.10.100.151:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-pve.yaml
sed -i 's/127.0.0.1/10.10.100.150/' ~/.kube/k3s-pve.yaml
export KUBECONFIG=~/.kube/k3s-pve.yaml
kubectl get nodes
```

Expected output, and the actual timing target: **all 5 nodes `Ready` within 15 minutes of the `terraform apply` you timed above.** If you're over that, look at where the time actually went — usually the 90-second `time_sleep` plus however long the k3s install script itself takes per node, not Terraform's own VM-clone time — before assuming something's broken.

**Checkpoint:** two recorded elapsed times (`destroy`, `apply`), and `kubectl get nodes` showing 5/5 `Ready` inside the 15-minute target measured from the moment `terraform apply` started.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools from the phases above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — the second server VM won't join

Setup: taint and replace `k3s-server-2` (`terraform taint 'module.k3s_rest.proxmox_virtual_environment_vm.this["k3s-server-2"]'`), but before re-applying, deliberately corrupt the ordering: either shrink `time_sleep`'s `create_duration` to `"5s"` (too short for server 1 to be genuinely ready), or swap `server-join.yaml.tftpl`'s content for `server-init.yaml.tftpl`'s in the template-selection `locals` block (giving the replacement node `--cluster-init` instead of `--server https://...`) — pick one, not both, and know which one you picked.

Expected symptom: the replaced server VM comes up, `k3s` starts, but it never appears in `kubectl get nodes` from the surviving cluster — either it's forming a second, independent single-node cluster of its own, or it's failing to join at all.

<details>
<summary>Hint</summary>

`journalctl -u k3s` on the affected node is where this gets diagnosed, not guessed at — a `--cluster-init` node logs starting its *own* etcd cluster from scratch, with no mention of any peer; a node with the right `--server` flag but a bad `K3S_TOKEN` logs an explicit authentication failure joining the existing cluster. Compare what's actually in `/var/lib/rancher/k3s/server/manifests/` and the exact `INSTALL_K3S_EXEC` string cloud-init ran (`cat /var/log/cloud-init-output.log`) against what the *other* two servers received — the fix is correcting whichever of the two (flag or token) is actually wrong, then tainting and replacing that one VM again, not the whole cluster.

</details>

### Drill 2 — a MetalLB IP is unreachable from the lab network

Setup: pick one node currently eligible to run the MetalLB speaker (any agent) and give it a different VLAN tag on its `network_device` than the rest of the fleet — edit that one VM's block in Terraform and `terraform apply` just that change (or do it live with `qm set <vmid> -net0 virtio,bridge=vmbr-lab,tag=<different-tag>` to see the symptom immediately, then fix it back through Terraform afterward so state doesn't drift).

Expected symptom: `kubectl get svc` still shows a `LoadBalancer` Service with an assigned `EXTERNAL-IP` from `lab-pool`, but `curl` to that IP from the lab network times out, and `arp -n <ip>` on the workstation shows no ARP entry at all — not a wrong one, none.

<details>
<summary>Hint</summary>

`kubectl -n metallb-system logs -l component=speaker --all-containers` names which node is currently answering ARP for this IP and on which interface — cross-reference that node's actual `vlan_id` (from `qm config <vmid> | grep net0`, or your Terraform config) against every other node's. A speaker running on a node tagged into a different broadcast domain than the rest of `vmbr-lab` answers ARP requests nobody on the lab's actual VLAN ever hears — the fix is retagging that node back in line with the rest of the fleet, not touching the `IPAddressPool` or `L2Advertisement` at all, since neither of those is what's actually broken.

</details>

### Drill 3 — a Proxmox CSI PVC stays Pending

Setup: revoke the exact grant Phase 5 added, without touching anything else:

```bash
pveum acl modify /storage/local-lvm --roles LearningRole --tokens 'learn@pve!tf' --delete
```

Then create a fresh PVC against the `proxmox-csi` StorageClass (a new claim name — reusing `proxmox-csi-test` will just show you the old, already-bound one).

Expected symptom: the PVC sits `Pending` indefinitely; `kubectl describe pvc <name>` shows a `ProvisioningFailed` event.

<details>
<summary>Hint</summary>

This is the exact same shape of failure as Mission 03's Drill 1, one layer up the stack: `kubectl -n kube-system logs deploy/proxmox-csi-plugin-controller` names the specific Proxmox API call the driver made and the privilege it was rejected for — a 403, not a CSI-internal error. `pveum acl list | grep local-lvm` shows you what's actually granted right now. The lesson repeats deliberately: a privilege grant scoped to one consumer's needs (Mission 03's Terraform clones) doesn't automatically cover a second, later consumer (this driver's disk-allocation calls) just because both happen to hit the same storage path — each caller's actual required privilege set has to be verified on its own, not assumed from a sibling's working config.

</details>

---

## Prove-it: kill a server under real load, and the SLO holds

Phase 7 proved the mechanism works with nothing else going on. This is the same drill, run against genuine traffic, with a number at the end instead of a feeling.

1. Point `/etc/hosts` (or your DNS) so `shiplog.pve.lab` resolves to `10.10.100.221` (the ingress-nginx MetalLB IP from Phase 6), and confirm `curl http://shiplog.pve.lab/healthz` returns `200` before starting anything.
2. In one terminal, start devops/09's `load.js` against this cluster specifically (build devops/09 first if you haven't — this prove-it has nothing to run against without it):

```bash
k6 run -e TARGET=http://shiplog.pve.lab devops/09-chaos-sre/k6/load.js
```

3. Note the wall-clock time, then, in a second terminal, partway through the run:

```bash
qm stop 9403
```

(Kill `k3s-server-3` this time — proving it isn't specifically the first or second server that's "special" matters as much as the mechanism itself.)

4. Let `load.js` run to completion. Do not stop it early because you're satisfied the node is back — the thresholds are evaluated over the whole run.
5. Immediately after, capture the incident timeline as evidence:

```bash
kubectl get events -A --sort-by=.lastTimestamp | tail -n 40
```

**Acceptance criteria:** k6's own summary reports `http_req_failed` still under its configured threshold (`rate<0.01`) and `http_req_duration`'s `p(95)` still under its configured bound, despite a control-plane node dying mid-run — plus a written timeline (k6 start time, the `qm stop` timestamp, the moment `kubectl get nodes` showed the node `NotReady`, the moment it showed `Ready` again) and the `kubectl get events` capture above, submitted together. If the SLO didn't hold, that's a real finding — write down which threshold broke and your best explanation from the events log, don't quietly re-run until you get a cleaner result.

---

## Done when

- [ ] You can state, without notes, the one-sentence reason k3s's embedded etcd removes an entire category of operational work kubeadm never removes, plus your cluster's real available-capacity check before provisioning 10 vCPU/20GB
- [ ] `modules/pve-vm` extended with `user_data_file_id`, and all 5 k3s VMs exist in `9000-9999`, in the `learning` pool, spread one-server-per-physical-node
- [ ] `kubectl get nodes` (via the VIP, never a node IP) shows 5/5 `Ready`, and `plndr-cp-lock`'s holder proves kube-vip leader election actually ran
- [ ] A real `LoadBalancer` Service reachable by its MetalLB-assigned IP from an actual lab-network host, proven with `curl`, not a port-forward
- [ ] Both a `local-path` and a `proxmox-csi` PVC `Bound` with a writer pod `Running` on each, plus the stated comparison of when each one's portability claim actually holds
- [ ] This cluster registered in devops/07's ArgoCD as `pve-lab`; `shiplog-pve` `Synced`/`Healthy`; `curl -H "Host: shiplog.pve.lab" http://<metallb-ip>/healthz` returns `200`
- [ ] An agent VM replaced via `terraform taint`/`apply` with workloads observed rescheduling, and a hard-killed server VM's evidence checklist fully satisfied (API reachable, etcd quorum proven via `etcd-snapshot save`, workloads unaffected, full recovery confirmed)
- [ ] A timed `terraform destroy` + `apply` cycle reaching 5/5 `Ready` in under 15 minutes, with the fresh-kubeconfig gotcha called out, not silently worked around
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork, before opening the hints
- [ ] Prove-it: a k3s server killed mid-run under real k6 load, SLO thresholds still passing (or a named, evidenced finding if they didn't), backed by a written timeline and a `kubectl get events` capture
