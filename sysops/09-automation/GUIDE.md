# Guide — Mission 09: Automation

New machine this mission adds — the Ansible control node (clone from `tpl-ubuntu2404` per the Mission 01 clone checklist):

```
lab-ctrl01.lab.local  172.16.10.5    Ubuntu 24.04   Ansible control node + bash toolkit
```

Machines this mission automates (already exist from earlier missions, or get rebuilt fresh as blank clones in Phase 8):

```
lab-dns1.lab.local    172.16.10.11   (Mission 04) bind9 — inventory group: dns
lab-web01.lab.local   172.16.10.30   (Mission 05) nginx reverse proxy — inventory group: web
lab-mon01.lab.local   172.16.10.40   new — Prometheus + node_exporter target — inventory group: monitor
```

Every command below states its machine: **[lab-ctrl01]**, **[lab-dns1]**, **[lab-web01]**, **[lab-mon01]**. All are guest bash unless noted. `lab-ctrl01` talks to the other three over SSH as the `labadmin` user created in Mission 01 — confirm you can already `ssh labadmin@172.16.10.30` etc. by password before starting Phase 2.

Wherever you see `<VAULT_PASSWORD>` or `<GRAFANA_ADMIN_PASSWORD>`, pick your own and use it consistently for the rest of the mission.

---

## Phase 0 — Setup check

Confirm the three target machines are reachable and the prerequisite missions actually ran.

**[lab-ctrl01]** — clone this VM now if you haven't (static IP `172.16.10.5`, hostname `lab-ctrl01`, per the Mission 01 clone checklist), then confirm reachability of every target:

```bash
for h in 172.16.10.11 172.16.10.30 172.16.10.40; do
  ping -c1 -W2 "$h" >/dev/null && echo "$h: up" || echo "$h: DOWN"
done
```

Expected output: `172.16.10.11: up` and `172.16.10.30: up`. `172.16.10.40` (`lab-mon01`) doesn't exist yet — expect `DOWN` for it; you'll clone it in Phase 2. Do not continue if `.11` or `.30` are down — go fix Mission 04 or Mission 05 first.

**[lab-web01]** — confirm nginx from Mission 05 is actually running, since Phase 5 assumes it:

```bash
systemctl is-active nginx
```

Expected output: `active`.

**Checkpoint:** `lab-dns1` and `lab-web01` both respond to ping, nginx is `active` on `lab-web01`. Do not continue to Phase 1 until both hold.

---

## Phase 1 — Advanced bash: a real toolkit

Every earlier-mission script so far has been a flat list of commands with no error handling. If step 3 of 5 fails, steps 4 and 5 still run against broken state. Fix that with a skeleton every future script in this lab starts from.

**[lab-ctrl01]** — install shellcheck and create the toolkit directory:

```bash
sudo apt update && sudo apt install -y shellcheck
mkdir -p ~/toolkit
```

**[lab-ctrl01]** — `~/toolkit/template.sh`, the skeleton:

```bash
#!/usr/bin/env bash
#
# template.sh - skeleton for every script in this toolkit.
# Usage: template.sh [-v] [-n NAME] [-h]

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TMPDIR="$(mktemp -d)"
VERBOSE=0
NAME=""

log() {
  # log LEVEL message...
  local level="$1"; shift
  printf '[%s] %s: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$level" "$*" >&2
}

cleanup() {
  local exit_code=$?
  rm -rf "$TMPDIR"
  if [ "$exit_code" -ne 0 ]; then
    log ERROR "$SCRIPT_NAME exited with code $exit_code"
  fi
  exit "$exit_code"
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-v] [-n NAME] [-h]
  -v        verbose logging
  -n NAME   name to operate on (required)
  -h        show this help
EOF
}

while getopts ":vn:h" opt; do
  case "$opt" in
    v) VERBOSE=1 ;;
    n) NAME="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) log ERROR "invalid option: -$OPTARG"; usage; exit 1 ;;
    :) log ERROR "option -$OPTARG requires an argument"; usage; exit 1 ;;
  esac
done

if [ -z "$NAME" ]; then
  log ERROR "-n NAME is required"
  usage
  exit 1
fi

[ "$VERBOSE" -eq 1 ] && log INFO "verbose mode on, TMPDIR=$TMPDIR"

log INFO "doing work for $NAME"
# ... real work goes here ...
log INFO "done"
```

```bash
chmod +x ~/toolkit/template.sh
shellcheck ~/toolkit/template.sh
```

Expected output from `shellcheck`: nothing — a clean run prints no output and exits `0`. Confirm the exit code:

```bash
echo $?
```

Expected: `0`.

The four things that matter, plain: `set -euo pipefail` kills the script the instant a command fails, an unset variable is used, or a pipeline's middle stage fails silently — instead of limping forward on bad state. The `trap cleanup EXIT` runs on every exit path (success, error, or `Ctrl-C`) so temp files never leak. `getopts` gives real flag parsing instead of positional-argument guessing. `log()` timestamps every line and writes to stderr, so output can be redirected without losing diagnostics.

**[lab-ctrl01]** — rewrite the Mission 05 CA signing script, `~/toolkit/sign-cert.sh`, on the skeleton:

```bash
#!/usr/bin/env bash
#
# sign-cert.sh - sign a server cert against the lab CA (rewrite of Mission 05's version).
# Usage: sign-cert.sh -c FQDN [-d DAYS] [-v] [-h]

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TMPDIR="$(mktemp -d)"
VERBOSE=0
CN=""
DAYS=825
CA_DIR=/etc/ssl/lab-ca

log() {
  local level="$1"; shift
  printf '[%s] %s: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$level" "$*" >&2
}

cleanup() {
  local exit_code=$?
  rm -rf "$TMPDIR"
  [ "$exit_code" -ne 0 ] && log ERROR "$SCRIPT_NAME exited with code $exit_code"
  exit "$exit_code"
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME -c FQDN [-d DAYS] [-v] [-h]
  -c FQDN   common name / hostname to sign for (required)
  -d DAYS   validity in days (default: 825)
  -v        verbose logging
  -h        show this help
EOF
}

while getopts ":c:d:vh" opt; do
  case "$opt" in
    c) CN="$OPTARG" ;;
    d) DAYS="$OPTARG" ;;
    v) VERBOSE=1 ;;
    h) usage; exit 0 ;;
    \?) log ERROR "invalid option: -$OPTARG"; usage; exit 1 ;;
    :) log ERROR "option -$OPTARG requires an argument"; usage; exit 1 ;;
  esac
done

if [ -z "$CN" ]; then
  log ERROR "-c FQDN is required"
  usage
  exit 1
fi

if [ -f "$CA_DIR/certs/${CN}.crt" ]; then
  log INFO "cert for $CN already exists, skipping (idempotent)"
  exit 0
fi

[ "$VERBOSE" -eq 1 ] && log INFO "signing for CN=$CN days=$DAYS in $TMPDIR"

openssl genrsa -out "$CA_DIR/private/${CN}.key" 2048
openssl req -new -key "$CA_DIR/private/${CN}.key" -out "$CA_DIR/csr/${CN}.csr" \
  -subj "/C=US/O=LabLLC/CN=${CN}"

cat > "$TMPDIR/${CN}.ext" <<EOF
subjectAltName=DNS:${CN}
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -in "$CA_DIR/csr/${CN}.csr" \
  -CA "$CA_DIR/certs/lab-ca.crt" -CAkey "$CA_DIR/private/lab-ca.key" -CAcreateserial \
  -out "$CA_DIR/certs/${CN}.crt" -days "$DAYS" -sha256 -extfile "$TMPDIR/${CN}.ext"

log INFO "signed: $CA_DIR/certs/${CN}.crt"
```

The rewrite fixes two real bugs in the Mission 05 original: the extfile lived in shared `/tmp/${CN}.ext` (a race and a leftover-file problem — fixed by `mktemp -d` + the trap), and re-running it against an existing CN blew up with an OpenSSL error instead of just confirming the cert was already there — fixed by the idempotency check up top.

```bash
chmod +x ~/toolkit/sign-cert.sh
shellcheck ~/toolkit/sign-cert.sh
```

Expected: no output, exit `0`.

**[lab-ctrl01]** — rewrite the Mission 06 node_exporter install script, `~/toolkit/install-node-exporter.sh`, on the same skeleton:

```bash
#!/usr/bin/env bash
#
# install-node-exporter.sh - install and start node_exporter (rewrite of Mission 06's version).
# Usage: install-node-exporter.sh -V VERSION [-v] [-h]

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TMPDIR="$(mktemp -d)"
VERBOSE=0
VERSION="1.8.2"

log() {
  local level="$1"; shift
  printf '[%s] %s: %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$level" "$*" >&2
}

cleanup() {
  local exit_code=$?
  rm -rf "$TMPDIR"
  [ "$exit_code" -ne 0 ] && log ERROR "$SCRIPT_NAME exited with code $exit_code"
  exit "$exit_code"
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-V VERSION] [-v] [-h]
  -V VERSION   node_exporter version to install (default: $VERSION)
  -v           verbose logging
  -h           show this help
EOF
}

while getopts ":V:vh" opt; do
  case "$opt" in
    V) VERSION="$OPTARG" ;;
    v) VERBOSE=1 ;;
    h) usage; exit 0 ;;
    \?) log ERROR "invalid option: -$OPTARG"; usage; exit 1 ;;
    :) log ERROR "option -$OPTARG requires an argument"; usage; exit 1 ;;
  esac
done

if [ -x /usr/local/bin/node_exporter ] && systemctl is-active --quiet node_exporter; then
  log INFO "node_exporter already installed and running, skipping (idempotent)"
  exit 0
fi

[ "$VERBOSE" -eq 1 ] && log INFO "installing node_exporter $VERSION via $TMPDIR"

curl -fsSL -o "$TMPDIR/node_exporter.tar.gz" \
  "https://github.com/prometheus/node_exporter/releases/download/v${VERSION}/node_exporter-${VERSION}.linux-amd64.tar.gz"
tar -xzf "$TMPDIR/node_exporter.tar.gz" -C "$TMPDIR"
sudo cp "$TMPDIR/node_exporter-${VERSION}.linux-amd64/node_exporter" /usr/local/bin/node_exporter

if ! id -u node_exporter >/dev/null 2>&1; then
  sudo useradd --no-create-home --shell /usr/sbin/nologin node_exporter
fi

sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<'EOF'
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter

log INFO "node_exporter $VERSION installed and running"
```

The rewrite fixes the same class of bug: the original re-downloaded and re-installed on every run with no check, and it used a shared, never-cleaned `/tmp` extraction path. Now a second run is a one-line no-op.

```bash
chmod +x ~/toolkit/install-node-exporter.sh
shellcheck ~/toolkit/install-node-exporter.sh
```

Expected: no output, exit `0`.

**Checkpoint:**

```bash
shellcheck ~/toolkit/*.sh; echo "exit: $?"
```

Expected output: no warnings from any of the three scripts, `exit: 0`. Do not continue to Phase 2 if `shellcheck` reports anything.

---

## Phase 2 — Ansible control node

**[lab-ctrl01]** — install Ansible and generate a dedicated SSH key for it to use against every target:

```bash
sudo apt install -y ansible
ssh-keygen -t ed25519 -f ~/.ssh/lab_ansible -N "" -C "lab-ctrl01-ansible"
```

Expected output from `ssh-keygen`: a key fingerprint and randomart, no errors.

**[lab-ctrl01]** — copy the public key to every current target (you'll be prompted for `labadmin`'s password each time — this is the last time you need it):

```bash
ssh-copy-id -i ~/.ssh/lab_ansible.pub labadmin@172.16.10.11
ssh-copy-id -i ~/.ssh/lab_ansible.pub labadmin@172.16.10.30
```

Expected output ends with: `Number of key(s) added: 1` for each host. (`lab-mon01` at `.40` doesn't exist yet — you'll do this for it once it's cloned in Phase 8.)

**[lab-ctrl01]** — project layout and inventory, `~/ansible/inventory.ini`:

```bash
mkdir -p ~/ansible
cd ~/ansible
```

```ini
[dns]
lab-dns1 ansible_host=172.16.10.11

[web]
lab-web01 ansible_host=172.16.10.30

[monitor]
lab-mon01 ansible_host=172.16.10.40

[lab:children]
dns
web
monitor

[lab:vars]
ansible_user=labadmin
ansible_ssh_private_key_file=~/.ssh/lab_ansible
```

`~/ansible/ansible.cfg`:

```ini
[defaults]
inventory = inventory.ini
host_key_checking = False
retry_files_enabled = False
```

**[lab-ctrl01]** — ad-hoc commands against what's reachable right now:

```bash
ansible dns,web -m ping
```

Expected output: two blocks, each ending `"ping": "pong"` with `SUCCESS`.

```bash
ansible web -a "systemctl is-active nginx"
```

Expected output: `lab-web01 | CHANGED | rc=0 >>` — wait, actually expect `SUCCESS`, with `active` in the returned text.

```bash
ansible-inventory --graph
```

Expected output: a tree showing `@lab:`, with `@dns:`, `@web:`, `@monitor:` as children and one host under each (`lab-mon01` will show even though it's not up yet — that's fine, inventory is static text).

**Checkpoint:**

```bash
ansible all -m ping
```

Expected: `lab-dns1` and `lab-web01` report `"ping": "pong"`. `lab-mon01` fails with `UNREACHABLE` — expected, since it doesn't exist yet. Do not continue to Phase 3 until `dns` and `web` both pong.

---

## Phase 3 — First playbook + idempotency

**[lab-ctrl01]** — `~/ansible/first.yml`, a playbook that installs a package and drops a marker file — proof of idempotency before anything more complex:

```yaml
---
- name: First playbook - idempotency proof
  hosts: dns,web
  become: true
  tasks:
    - name: Ensure htop is installed
      ansible.builtin.apt:
        name: htop
        state: present
        update_cache: true

    - name: Drop a marker file recording last-configured time
      ansible.builtin.copy:
        content: "configured by ansible\n"
        dest: /etc/lab-managed
        owner: root
        group: root
        mode: "0644"
```

**[lab-ctrl01]** — run it twice:

```bash
ansible-playbook first.yml
```

Expected output (first run): a `PLAY RECAP` line like `lab-dns1 : ok=2 changed=2 ...` and the same for `lab-web01` — both tasks change something the first time.

```bash
ansible-playbook first.yml
```

Expected output (second run): `PLAY RECAP` shows `changed=0` for both hosts — `htop` is already present, the marker file already has the right content, so Ansible reports `ok` without touching anything.

**Checkpoint:** second consecutive run of `first.yml` reports `changed=0` on every host. If it reports any `changed` on the second run, a task is comparing state wrong (usually a `command`/`shell` task standing in for a module that already handles idempotency) — fix it before moving on; this exact failure mode is one of the break-fix drills later.

---

## Phase 4 — Roles: common, nginx, node_exporter, monitoring

A playbook that's one long task list doesn't scale. Roles package tasks, handlers, templates, and defaults into a reusable, testable unit — one per piece of the lab you're automating.

**[lab-ctrl01]** — scaffold all four:

```bash
cd ~/ansible
mkdir -p roles
for r in common nginx node_exporter monitoring; do
  ansible-galaxy init "roles/$r"
done
```

Expected output: `- Role $r was created successfully` four times. Each role now has this skeleton (trim the unused generated files — `tests/`, `meta/main.yml` boilerplate — down to what you actually use):

```
roles/common/
  tasks/main.yml
  handlers/main.yml
  templates/
  files/
  defaults/main.yml
  vars/main.yml
  meta/main.yml
```

**[lab-ctrl01]** — `roles/common/defaults/main.yml`:

```yaml
---
common_users:
  - name: opuser
    groups: sudo
common_packages:
  - vim
  - curl
  - htop
  - ufw
ssh_permit_root_login: "no"
ssh_password_authentication: "no"
```

**[lab-ctrl01]** — `roles/common/tasks/main.yml` — packages, a standard user, and the Mission 08 SSH hardening, now as code instead of hand edits:

```yaml
---
- name: Install baseline packages
  ansible.builtin.apt:
    name: "{{ common_packages }}"
    state: present
    update_cache: true

- name: Create standard operational users
  ansible.builtin.user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
    shell: /bin/bash
    create_home: true
  loop: "{{ common_users }}"

- name: Harden sshd_config - disable root login
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^#?PermitRootLogin'
    line: "PermitRootLogin {{ ssh_permit_root_login }}"
  notify: Restart sshd

- name: Harden sshd_config - disable password auth
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^#?PasswordAuthentication'
    line: "PasswordAuthentication {{ ssh_password_authentication }}"
  notify: Restart sshd
```

**[lab-ctrl01]** — `roles/common/handlers/main.yml`:

```yaml
---
- name: Restart sshd
  ansible.builtin.systemd:
    name: ssh
    state: restarted
```

**[lab-ctrl01]** — `roles/node_exporter/defaults/main.yml`:

```yaml
---
node_exporter_version: "1.8.2"
node_exporter_port: 9100
```

`roles/node_exporter/tasks/main.yml`:

```yaml
---
- name: Check if node_exporter binary already present
  ansible.builtin.stat:
    path: /usr/local/bin/node_exporter
  register: node_exporter_bin

- name: Download and extract node_exporter
  ansible.builtin.unarchive:
    src: "https://github.com/prometheus/node_exporter/releases/download/v{{ node_exporter_version }}/node_exporter-{{ node_exporter_version }}.linux-amd64.tar.gz"
    dest: /tmp
    remote_src: true
  when: not node_exporter_bin.stat.exists

- name: Install node_exporter binary
  ansible.builtin.copy:
    src: "/tmp/node_exporter-{{ node_exporter_version }}.linux-amd64/node_exporter"
    dest: /usr/local/bin/node_exporter
    mode: "0755"
    remote_src: true
  when: not node_exporter_bin.stat.exists

- name: Create node_exporter system user
  ansible.builtin.user:
    name: node_exporter
    shell: /usr/sbin/nologin
    create_home: false
    system: true

- name: Install node_exporter systemd unit
  ansible.builtin.template:
    src: node_exporter.service.j2
    dest: /etc/systemd/system/node_exporter.service
    mode: "0644"
  notify: Restart node_exporter

- name: Enable and start node_exporter
  ansible.builtin.systemd:
    name: node_exporter
    enabled: true
    state: started
    daemon_reload: true
```

`roles/node_exporter/templates/node_exporter.service.j2`:

```ini
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:{{ node_exporter_port }}

[Install]
WantedBy=multi-user.target
```

`roles/node_exporter/handlers/main.yml`:

```yaml
---
- name: Restart node_exporter
  ansible.builtin.systemd:
    name: node_exporter
    state: restarted
```

The `nginx` and `monitoring` roles' task files follow in Phases 5 and 8 once templating and vault are covered.

**Checkpoint:**

```bash
find roles -maxdepth 2 -type d | sort
```

Expected output: `tasks`, `handlers`, `templates`, `defaults` (at minimum) under each of `roles/common`, `roles/nginx`, `roles/node_exporter`, `roles/monitoring`. Do not continue to Phase 5 if any role is missing `tasks/main.yml`.

---

## Phase 5 — Templates + handlers: nginx

**[lab-ctrl01]** — `roles/nginx/defaults/main.yml`:

```yaml
---
nginx_server_name: app.lab.local
nginx_upstream_port: 8080
nginx_document_root: /var/www/labapp
```

**[lab-ctrl01]** — `roles/nginx/templates/nginx.conf.j2` — the templated version of the Mission 05 vhost, variables where the original hardcoded values:

```nginx
server {
    listen 80;
    server_name {{ nginx_server_name }};

    location / {
        root {{ nginx_document_root }};
        index index.html;
    }
}
```

**[lab-ctrl01]** — `roles/nginx/tasks/main.yml`:

```yaml
---
- name: Install nginx
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true

- name: Ensure document root exists
  ansible.builtin.file:
    path: "{{ nginx_document_root }}"
    state: directory
    mode: "0755"

- name: Deploy placeholder index page
  ansible.builtin.copy:
    content: "<h1>Internal app is alive</h1>\n"
    dest: "{{ nginx_document_root }}/index.html"
    mode: "0644"

- name: Deploy templated vhost
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: "/etc/nginx/sites-available/{{ nginx_server_name }}"
    mode: "0644"
  notify: Restart nginx

- name: Enable vhost
  ansible.builtin.file:
    src: "/etc/nginx/sites-available/{{ nginx_server_name }}"
    dest: "/etc/nginx/sites-enabled/{{ nginx_server_name }}"
    state: link
  notify: Restart nginx

- name: Remove default site
  ansible.builtin.file:
    path: /etc/nginx/sites-enabled/default
    state: absent
  notify: Restart nginx
```

**[lab-ctrl01]** — `roles/nginx/handlers/main.yml`:

```yaml
---
- name: Restart nginx
  ansible.builtin.systemd:
    name: nginx
    state: restarted
```

The rule that matters here: a `notify` only fires a handler if the task that notified it reported `changed`. If the vhost file is already byte-identical, `template` reports `ok`, no notify fires, and nginx is never bounced — which is correct, not a bug. Handlers also only run once per play, at the end, no matter how many tasks notify the same handler name — three tasks notifying `Restart nginx` still restarts it exactly once.

**[lab-ctrl01]** — apply it to `web` only, ad-hoc, before wiring it into `site.yml`:

```bash
ansible-playbook -l web --syntax-check first.yml
```

(This is just a syntax sanity check on the tooling — the real nginx role run happens once it's composed into `site.yml` in Phase 8.)

**Checkpoint:** `roles/nginx/tasks/main.yml` references `roles/nginx/templates/nginx.conf.j2` by relative path and the handler name in every `notify:` matches the handler's `name:` in `handlers/main.yml` **exactly**, including case. Do not continue to Phase 6 if any `notify:` string doesn't character-match a handler name — Ansible fails silently here, it does not error at parse time.

---

## Phase 6 — ansible-vault: secrets

The `common_users` password and the Grafana admin password (used by the `monitoring` role) don't belong in plaintext YAML, even in a lab.

**[lab-ctrl01]** — create a vault password file (keep it out of version control — this is the vault-id's secret, not a lab secret itself):

```bash
mkdir -p ~/.ansible-secrets
echo "<VAULT_PASSWORD>" > ~/.ansible-secrets/lab.pass
chmod 600 ~/.ansible-secrets/lab.pass
```

**[lab-ctrl01]** — create the encrypted secrets file, tagged with the vault-id `lab`:

```bash
cd ~/ansible
ansible-vault create --vault-id lab@~/.ansible-secrets/lab.pass group_vars/all/vault.yml
```

This opens `$EDITOR`. Enter:

```yaml
---
vault_opuser_password: "ChangeMe123!"
vault_grafana_admin_password: "<GRAFANA_ADMIN_PASSWORD>"
```

Save and exit. Expected output: `Encryption successful`.

**[lab-ctrl01]** — confirm it's actually encrypted on disk:

```bash
head -1 group_vars/all/vault.yml
```

Expected output: `$ANSIBLE_VAULT;1.1;AES256` — plaintext is never written to disk.

**[lab-ctrl01]** — view or edit it later without leaving cleartext temp files lying around:

```bash
ansible-vault view --vault-id lab@~/.ansible-secrets/lab.pass group_vars/all/vault.yml
ansible-vault edit --vault-id lab@~/.ansible-secrets/lab.pass group_vars/all/vault.yml
```

**[lab-ctrl01]** — reference the vaulted variable from `roles/common/tasks/main.yml` by adding a password to the user task:

```yaml
    password: "{{ vault_opuser_password | password_hash('sha512') }}"
```

(add that line inside the existing `Create standard operational users` task, alongside `name:`/`groups:`.)

**[lab-ctrl01]** — any playbook run against vaulted vars needs the vault-id supplied:

```bash
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass first.yml --syntax-check
```

Expected output: `playbook: first.yml` with no error — the vault-id decrypts `group_vars/all/vault.yml` in memory for the duration of the run only.

**Checkpoint:**

```bash
git status --porcelain 2>/dev/null | grep vault.yml || cat group_vars/all/vault.yml | head -1
```

Expected: the file's first line is `$ANSIBLE_VAULT;1.1;AES256` whether or not this directory is a git repo. Do not continue to Phase 7 with any secret still in plaintext anywhere under `~/ansible`.

---

## Phase 7 — Tags and the `--check --diff` workflow

**[lab-ctrl01]** — tag the roles in `site.yml` (written fully in Phase 8) so any one piece can run alone:

```yaml
      tags: [nginx]
```

```yaml
      tags: [node_exporter]
```

```yaml
      tags: [common, ssh]
```

Run only the SSH-hardening piece:

```bash
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass site.yml --tags ssh
```

Expected output: `PLAY RECAP` shows tasks touched only for the `common` role's SSH tasks — nginx and node_exporter tasks are skipped, not run.

List available tags without running anything:

```bash
ansible-playbook site.yml --list-tags
```

Expected output: `TASK TAGS: [common, nginx, node_exporter, monitoring, ssh]` (exact set depends on what you tagged).

**[lab-ctrl01]** — the safe-by-default workflow for any change from here on: preview before applying.

```bash
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass site.yml --check --diff
```

Expected output: every task reports what it *would* change (file diffs shown inline, package installs marked) with `PLAY RECAP` showing `changed=N` — but nothing on disk actually changes. Only after reading that output clean, run for real:

```bash
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass site.yml
```

**Checkpoint:** `--tags ssh` runs a visibly smaller task list than a full run, and `--check --diff` against an already-converged lab reports `changed=0` with no diffs — proof the dry run and the real run agree. Do not adopt `--check --diff` as a habit-forming step if it disagrees with what a real run does; that mismatch means a task uses `command`/`shell` without `check_mode: false`/`changed_when` handling, and check mode is lying to you.

---

## Phase 8 — site.yml: composing everything

This is the file that turns three blank clones into the whole core lab.

**[lab-ctrl01]** — first, finish the `monitoring` role (Prometheus server, deployed only to the `monitor` group). `roles/monitoring/defaults/main.yml`:

```yaml
---
monitoring_prometheus_version: "2.53.0"
monitoring_scrape_interval: 15s
```

`roles/monitoring/templates/prometheus.yml.j2`:

```yaml
global:
  scrape_interval: {{ monitoring_scrape_interval }}

scrape_configs:
  - job_name: node
    static_configs:
      - targets:
{% for host in groups['lab'] %}
          - "{{ hostvars[host].ansible_host }}:9100"
{% endfor %}
```

`roles/monitoring/tasks/main.yml`:

```yaml
---
- name: Check if Prometheus binary already present
  ansible.builtin.stat:
    path: /usr/local/bin/prometheus
  register: prometheus_bin

- name: Download and extract Prometheus
  ansible.builtin.unarchive:
    src: "https://github.com/prometheus/prometheus/releases/download/v{{ monitoring_prometheus_version }}/prometheus-{{ monitoring_prometheus_version }}.linux-amd64.tar.gz"
    dest: /tmp
    remote_src: true
  when: not prometheus_bin.stat.exists

- name: Install Prometheus binary
  ansible.builtin.copy:
    src: "/tmp/prometheus-{{ monitoring_prometheus_version }}.linux-amd64/prometheus"
    dest: /usr/local/bin/prometheus
    mode: "0755"
    remote_src: true
  when: not prometheus_bin.stat.exists

- name: Ensure Prometheus config directory exists
  ansible.builtin.file:
    path: /etc/prometheus
    state: directory
    mode: "0755"

- name: Deploy templated scrape config
  ansible.builtin.template:
    src: prometheus.yml.j2
    dest: /etc/prometheus/prometheus.yml
    mode: "0644"
  notify: Restart prometheus

- name: Install Prometheus systemd unit
  ansible.builtin.copy:
    dest: /etc/systemd/system/prometheus.service
    mode: "0644"
    content: |
      [Unit]
      Description=Prometheus
      After=network.target

      [Service]
      ExecStart=/usr/local/bin/prometheus --config.file=/etc/prometheus/prometheus.yml
      Restart=on-failure

      [Install]
      WantedBy=multi-user.target
  notify: Restart prometheus

- name: Enable and start Prometheus
  ansible.builtin.systemd:
    name: prometheus
    enabled: true
    state: started
    daemon_reload: true
```

`roles/monitoring/handlers/main.yml`:

```yaml
---
- name: Restart prometheus
  ansible.builtin.systemd:
    name: prometheus
    state: restarted
```

**[lab-ctrl01]** — the full `~/ansible/site.yml`:

```yaml
---
- name: Core lab - common baseline everywhere
  hosts: lab
  become: true
  roles:
    - role: common
      tags: [common, ssh]

- name: Core lab - node_exporter on every host
  hosts: lab
  become: true
  roles:
    - role: node_exporter
      tags: [node_exporter]

- name: Core lab - nginx reverse proxy
  hosts: web
  become: true
  roles:
    - role: nginx
      tags: [nginx]

- name: Core lab - Prometheus monitoring server
  hosts: monitor
  become: true
  roles:
    - role: monitoring
      tags: [monitoring]
```

**Grand deliverable** — rebuild the core lab from nothing:

**[HOST]** — clone three blank VMs from `tpl-ubuntu2404` per the Mission 01 clone checklist, wiping and reusing the `lab-dns1`/`lab-web01` names and adding `lab-mon01` fresh, all with only base OS + SSH, no manual service config:

```powershell
Copy-Item "D:\HyperV\tpl-ubuntu2404\tpl-ubuntu2404.vhdx" "D:\HyperV\lab-mon01\lab-mon01.vhdx"
New-VM -Name "lab-mon01" -Generation 2 -MemoryStartupBytes 2GB -VHDPath "D:\HyperV\lab-mon01\lab-mon01.vhdx" -SwitchName "LabSwitch"
Set-VMFirmware -VMName "lab-mon01" -EnableSecureBoot Off
Start-VM -Name "lab-mon01"
```

Run the Mission 01 clone identity checklist on `lab-mon01` (machine-id, SSH host keys, hostname, static IP `172.16.10.40`), then:

**[lab-ctrl01]**:

```bash
ssh-copy-id -i ~/.ssh/lab_ansible.pub labadmin@172.16.10.40
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass site.yml
```

Expected output: `PLAY RECAP` with `failed=0` across all four plays, all three hosts.

**Checkpoint:**

```bash
ansible lab -m shell -a "systemctl is-active node_exporter"
ansible web -m shell -a "systemctl is-active nginx"
ansible monitor -m shell -a "systemctl is-active prometheus"
```

Expected: `active` from every command, on every targeted host. From `lab-ctrl01`, confirm the monitor is actually scraping:

```bash
curl -s http://172.16.10.40:9090/api/v1/targets | grep -o '"health":"[a-z]*"'
```

Expected output: one `"health":"up"` line per target in `groups['lab']`.

---

## Break-fix drills (no inline solutions)

Diagnose from the symptom before opening the hints. State what you observe, form a hypothesis, test it, then fix.

**Drill 1 — Non-idempotent playbook**

Ask Claude, in this session, to add the following task to `roles/nginx/tasks/main.yml` (deliberately missing an idempotency guard) and re-run `site.yml` twice:

```yaml
    - name: Warm up a cache directory
      ansible.builtin.shell: mkdir /var/cache/labapp && date > /var/cache/labapp/built-at
```

Symptom: the second `ansible-playbook site.yml` run reports `changed=1` (or fails outright on the second run because `mkdir` errors on an existing directory) instead of `changed=0`. Find the task, explain in your own words why `shell`/`command` tasks are never idempotent by default, and fix it.

**Drill 2 — Broken handler notify chain**

Ask Claude to rename the handler in `roles/nginx/handlers/main.yml` from `Restart nginx` to `Restart Nginx Service` without updating the `notify:` lines in `roles/nginx/tasks/main.yml`, then edit the vhost template so a real config change is pending.

Symptom: `ansible-playbook site.yml` reports the template task as `changed`, but `curl -I http://app.lab.local/` still serves the old response — nginx was never restarted, and there's no error telling you why. Diagnose using `ansible-playbook site.yml -vv` (verbose mode shows which handlers actually fired) before touching any file.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `ansible.builtin.shell`/`ansible.builtin.command` always report `changed` unless you add `creates:` (or `removes:`) so Ansible can check whether the effect already exists — same idea as the `Check if ... already present` `stat` tasks you wrote in Phase 4/8.
- Drill 2: `notify:` matches handler names as exact strings, not by task order or proximity. `-vv` output lists `NOTIFIED HANDLER` lines — if the handler you expect never appears there, the name doesn't match.

</details>

---

## Prove-it: drift report + full restore

**[HOST or lab-ctrl01, as instructed]** — ask Claude, in this session, to break all three VMs at once: delete `/etc/nginx/sites-enabled/app.lab.local` on `lab-web01`, stop and mask `node_exporter` on `lab-dns1`, and remove `/etc/prometheus/prometheus.yml` on `lab-mon01`.

**[lab-ctrl01]** — produce the drift report first, touching nothing:

```bash
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass site.yml --check --diff | tee /tmp/drift-report.txt
```

Expected output: `changed=` counts greater than zero on all three hosts, with diffs showing the missing vhost symlink, the config file that would be recreated, and (separately) confirm the masked service:

```bash
ansible dns -m shell -a "systemctl is-active node_exporter"
```

Expected: `failed` or `inactive` — proof the drift is real, not just a `--check` false positive.

**[lab-ctrl01]** — restore everything with one real run:

```bash
ansible-playbook --vault-id lab@~/.ansible-secrets/lab.pass site.yml
```

Expected output: `PLAY RECAP` shows `changed=` matching what `--check` predicted, `failed=0`.

**Checkpoint:**

```bash
curl -I http://app.lab.local/
ansible dns -m shell -a "systemctl is-active node_exporter"
ansible monitor -m shell -a "systemctl is-active prometheus"
```

Expected: `curl` returns `HTTP/1.1 200 OK`, both `systemctl` checks return `active`. The drift report you saved at `/tmp/drift-report.txt` is your evidence trail: what was broken, predicted before the fix, confirmed fixed after.

---

## Done when

- [ ] `~/toolkit/template.sh`, `sign-cert.sh`, and `install-node-exporter.sh` all pass `shellcheck` with zero warnings
- [ ] `ansible all -m ping` pongs from all three inventory groups (`dns`, `web`, `monitor`)
- [ ] `first.yml` run twice in a row reports `changed=0` on the second run
- [ ] Four roles exist (`common`, `nginx`, `node_exporter`, `monitoring`), each with `tasks/`, `handlers/`, and `defaults/` at minimum
- [ ] `nginx.conf.j2` is templated with variables and its `notify:` correctly triggers the restart handler only on real change
- [ ] `group_vars/all/vault.yml` is encrypted on disk and referenced in a role via a vaulted variable
- [ ] `--tags` runs a subset of `site.yml`, and `--check --diff` against a converged lab reports zero changes
- [ ] `site.yml`, run against three blank template clones, brings up nginx (`web`), node_exporter (all), and Prometheus (`monitor`) with one command
- [ ] Both break-fix drills reproduced, diagnosed, and fixed
- [ ] Drift deliberately introduced across all three VMs, reported via `--check --diff` before any fix, then fully restored by one `site.yml` run
