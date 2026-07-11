# Guide — Mission 05: Service Citadel

New machines this mission adds to the lab (clone from `tpl-ubuntu2404` / `tpl-rocky9` per the Mission 01 clone checklist):

```
lab-web01.lab.local   172.16.10.30   Ubuntu 24.04   private CA + nginx reverse proxy
lab-mail01.lab.local  172.16.10.31   Ubuntu 24.04   Postfix + Dovecot + OpenDKIM
lab-ipa01.lab.local   172.16.10.32   Rocky 9        FreeIPA server
lab-dns1.lab.local    172.16.10.11   (from Mission 04) authoritative bind9 for lab.local
```

`lab-web01` and `lab-mail01` are also the two IPA clients you enroll in Phase 5. Realm: `LAB.LOCAL` (uppercase — Kerberos convention). Every command states its machine: **[lab-web01]**, **[lab-mail01]**, **[lab-ipa01]**, **[lab-dns1]**. All are guest bash unless noted.

Wherever you see `<ADMIN_PASSWORD>` or `<DS_PASSWORD>`, pick your own password and use it consistently for the rest of the mission — don't paste a real production password into a lab.

---

## Phase 0 — Setup check: DNS from Mission 04

Confirm the Mission 04 DNS server is alive and authoritative for `lab.local` before building anything on top of it.

**[lab-web01 or any existing lab VM]** — query the SOA record:

```bash
dig @172.16.10.11 lab.local SOA +short
```

Expected output: one line, e.g. `lab-dns1.lab.local. admin.lab.local. 2024052001 3600 900 604800 3600` (serial will differ). Do not continue if this times out — go fix Mission 04's `named` service first.

Clone the three new VMs now using the Mission 01 clone checklist (regenerate machine-id, SSH host keys, hostname, static IP for each):

- `lab-web01` — Ubuntu, `172.16.10.30`
- `lab-mail01` — Ubuntu, `172.16.10.31`
- `lab-ipa01` — Rocky 9, `172.16.10.32`

**[lab-dns1]** — add forward records to the `lab.local` zone file (path depends on your Mission 04 setup, typically `/etc/bind/zones/db.lab.local`):

```
lab-web01   IN A    172.16.10.30
lab-mail01  IN A    172.16.10.31
lab-ipa01   IN A    172.16.10.32
```

Bump the SOA serial number, then reload:

```bash
sudo named-checkzone lab.local /etc/bind/zones/db.lab.local
sudo rndc reload lab.local
```

Expected output from `named-checkzone`: `OK`. Expected from `rndc reload`: `zone lab.local/IN: reloaded`.

**Checkpoint:** from any other guest on the lab network,

```bash
dig @172.16.10.11 lab-web01.lab.local +short
dig @172.16.10.11 lab-mail01.lab.local +short
dig @172.16.10.11 lab-ipa01.lab.local +short
```

Expected: `172.16.10.30`, `172.16.10.31`, `172.16.10.32` respectively. Do not continue to Phase 1 if any of these fail — every later phase assumes name resolution works.

---

## Phase 1 — Private CA

Everything in this mission trusts one root: a CA you build by hand with OpenSSL. It lives on `lab-web01` for convenience — in a real environment you'd isolate CA key material on its own offline host, but for lab purposes we colocate it.

**[lab-web01]** — build the CA directory structure:

```bash
sudo mkdir -p /etc/ssl/lab-ca/{private,certs,csr}
sudo chmod 700 /etc/ssl/lab-ca/private
```

**[lab-web01]** — generate the CA private key (you'll be prompted for a passphrase twice — remember it, you need it every time you sign):

```bash
sudo openssl genrsa -aes256 -out /etc/ssl/lab-ca/private/lab-ca.key 4096
```

Expected output: several lines ending in `.....+++++`, no errors.

**[lab-web01]** — self-sign the root certificate, valid 10 years:

```bash
sudo openssl req -x509 -new -key /etc/ssl/lab-ca/private/lab-ca.key -sha256 -days 3650 \
  -out /etc/ssl/lab-ca/certs/lab-ca.crt \
  -subj "/C=US/O=LabLLC/CN=Lab Root CA"
```

Expected output: passphrase prompt, then the command returns with no error and the file exists.

Verify it looks right:

```bash
openssl x509 -in /etc/ssl/lab-ca/certs/lab-ca.crt -noout -subject -dates
```

Expected: `subject=C = US, O = LabLLC, CN = Lab Root CA` and a `notAfter` roughly 10 years from today.

**[lab-web01]** — write the signing script, `/etc/ssl/lab-ca/sign-cert.sh`:

```bash
#!/bin/bash
# Usage: sign-cert.sh <fqdn> [days]
set -euo pipefail
CN="$1"
DAYS="${2:-825}"
CA_DIR=/etc/ssl/lab-ca

openssl genrsa -out "$CA_DIR/private/${CN}.key" 2048
openssl req -new -key "$CA_DIR/private/${CN}.key" -out "$CA_DIR/csr/${CN}.csr" \
  -subj "/C=US/O=LabLLC/CN=${CN}"

cat > "/tmp/${CN}.ext" <<EOF
subjectAltName=DNS:${CN}
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -in "$CA_DIR/csr/${CN}.csr" \
  -CA "$CA_DIR/certs/lab-ca.crt" -CAkey "$CA_DIR/private/lab-ca.key" -CAcreateserial \
  -out "$CA_DIR/certs/${CN}.crt" -days "$DAYS" -sha256 -extfile "/tmp/${CN}.ext"

echo "Signed: $CA_DIR/certs/${CN}.crt"
```

```bash
sudo chmod +x /etc/ssl/lab-ca/sign-cert.sh
```

**[lab-web01]** — sign a throwaway cert to prove the pipeline works:

```bash
sudo /etc/ssl/lab-ca/sign-cert.sh test.lab.local
```

Expected output: passphrase prompt (CA key), then `Signed: /etc/ssl/lab-ca/certs/test.lab.local.crt`.

**[lab-web01]** — copy the CA root cert to every VM's trust store. Get it onto each machine first (`scp` from `lab-web01`):

```bash
scp /etc/ssl/lab-ca/certs/lab-ca.crt labadmin@172.16.10.31:/tmp/
scp /etc/ssl/lab-ca/certs/lab-ca.crt labadmin@172.16.10.32:/tmp/
```

**[lab-web01 and lab-mail01]** (Ubuntu) — install into the trust store:

```bash
sudo cp /etc/ssl/lab-ca/certs/lab-ca.crt /usr/local/share/ca-certificates/lab-ca.crt
sudo update-ca-certificates
```

Expected output ends with: `1 added, 0 removed; done.`

**[lab-ipa01]** (Rocky) — install into the trust store:

```bash
sudo cp /tmp/lab-ca.crt /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust extract
```

Expected: command returns silently (no output = success).

**Checkpoint:**

```bash
openssl verify -CAfile /etc/ssl/lab-ca/certs/lab-ca.crt /etc/ssl/lab-ca/certs/test.lab.local.crt
```

Expected output: `/etc/ssl/lab-ca/certs/test.lab.local.crt: OK`. Do not continue to Phase 2 unless this says `OK`.

---

## Phase 2 — nginx reverse proxy with TLS

**[lab-web01]** — install nginx and sign the real vhost cert:

```bash
sudo apt update && sudo apt install -y nginx
sudo /etc/ssl/lab-ca/sign-cert.sh app.lab.local
```

Set up a trivial upstream backend (a plain-HTTP nginx block on localhost, standing in for "the internal app"):

```bash
sudo mkdir -p /var/www/labapp
echo "<h1>Internal app is alive</h1>" | sudo tee /var/www/labapp/index.html
```

**[lab-web01]** — `/etc/nginx/sites-available/labapp-backend`:

```nginx
server {
    listen 127.0.0.1:8080;
    server_name _;
    root /var/www/labapp;
    index index.html;
}
```

**[lab-web01]** — `/etc/nginx/sites-available/app.lab.local`, the full TLS-terminating reverse-proxy vhost:

```nginx
server {
    listen 80;
    server_name app.lab.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name app.lab.local;

    ssl_certificate     /etc/ssl/lab-ca/certs/app.lab.local.crt;
    ssl_certificate_key /etc/ssl/lab-ca/private/app.lab.local.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

**[lab-web01]** — enable both sites and reload:

```bash
sudo ln -s /etc/nginx/sites-available/labapp-backend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/app.lab.local /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Expected output from `nginx -t`: `nginx: configuration file /etc/nginx/nginx.conf test is successful`.

Add `app.lab.local` to the zone on **[lab-dns1]** the same way you did in Phase 0 (`A 172.16.10.30`), bump the serial, `rndc reload lab.local`.

**Checkpoint:** from `lab-web01` (or any host trusting the CA and resolving `app.lab.local`):

```bash
curl -v https://app.lab.local/ 2>&1 | grep -E "SSL certificate verify|HTTP/"
```

Expected output includes `SSL certificate verify ok` and `HTTP/1.1 200 OK`. Also confirm the redirect:

```bash
curl -I http://app.lab.local/
```

Expected: `HTTP/1.1 301 Moved Permanently` with `Location: https://app.lab.local/`. Do not continue to Phase 3 if `curl -v` shows any certificate verification error — recheck that the CA cert landed in the trust store on the machine you're testing from.

---

## Phase 3 — Postfix + Dovecot: internal mail

This is the hard part. Take it slow, read every error, and don't skip the debug commands at the end.

**[lab-mail01]** — install and sign the mail cert:

```bash
sudo apt update && sudo apt install -y postfix dovecot-imapd dovecot-lmtpd mailutils swaks
sudo /etc/ssl/lab-ca/sign-cert.sh lab-mail01.lab.local
```

During the Postfix install dialog, pick "Internet Site" and set the mail name to `lab.local`.

**[lab-mail01]** — create two test mailboxes:

```bash
sudo useradd -m -s /bin/bash alice
sudo useradd -m -s /bin/bash bob
echo "alice:LabPass123!" | sudo chpasswd
echo "bob:LabPass123!" | sudo chpasswd
```

**[lab-mail01]** — key directives in `/etc/postfix/main.cf` (edit or append; don't just append duplicates of keys that already exist — replace them):

```
myhostname = lab-mail01.lab.local
mydomain = lab.local
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4

# Only lab.local mail is local; nothing else is accepted for delivery
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain

# Only the lab subnet may relay through this box — this MTA is internal-only
mynetworks = 127.0.0.0/8, 172.16.10.0/24

# Deliver into Maildir format (one file per message, no mbox locking headaches)
home_mailbox = Maildir/

# TLS for SMTP, signed by our private CA
smtpd_tls_cert_file = /etc/ssl/lab-ca/certs/lab-mail01.lab.local.crt
smtpd_tls_key_file = /etc/ssl/lab-ca/private/lab-mail01.lab.local.key
smtpd_tls_security_level = may

# Let Dovecot handle SASL auth for submission
smtpd_sasl_auth_enable = yes
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth

# Accept mail from the lab network or authenticated users only; refuse open relay
smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination
```

Each line's job, plain: `mydestination` says which domains this box delivers locally (not relays). `mynetworks` is the trusted-source list — mail from outside it must authenticate. `home_mailbox` picks Maildir over the legacy single-file mbox. `smtpd_recipient_restrictions` is the anti-open-relay gate — without `reject_unauth_destination` this box would relay spam for the whole internet.

**[lab-mail01]** — Dovecot: `/etc/dovecot/conf.d/10-mail.conf`:

```
mail_location = maildir:~/Maildir
```

`/etc/dovecot/conf.d/10-ssl.conf`:

```
ssl = required
ssl_cert = </etc/ssl/lab-ca/certs/lab-mail01.lab.local.crt
ssl_key = </etc/ssl/lab-ca/private/lab-mail01.lab.local.key
```

`/etc/dovecot/conf.d/10-master.conf` — add the auth socket Postfix needs, inside the existing `service auth {` block:

```
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
```

**[lab-mail01]** — restart both:

```bash
sudo systemctl restart dovecot postfix
sudo systemctl status dovecot postfix --no-pager
```

Expected: both show `active (running)`.

**Checkpoint — send:**

```bash
swaks --to alice@lab.local --from bob@lab.local --server lab-mail01.lab.local
```

Expected output ends with `<-  250 2.0.0 Ok: queued as ...` and `*** SESSION COMPLETE`.

Confirm it landed:

```bash
sudo ls /home/alice/Maildir/new/
```

Expected: one filename (a long dotted timestamp-ish name) — that's the delivered message.

**Checkpoint — receive over IMAP** (standing in for a GUI IMAP client — Thunderbird or K-9 pointed at `lab-mail01.lab.local:993` with the CA imported works identically):

```bash
curl -k --url 'imaps://lab-mail01.lab.local/INBOX' --user 'alice:LabPass123!'
```

Expected output: the raw message you just sent, headers and body, printed to your terminal.

**Debugging tools** (use these any time mail doesn't move):

```bash
mailq                          # what's sitting in the queue right now
postqueue -p                   # same thing, Postfix-native form
postqueue -f                   # force a delivery retry now
postcat -q <queue-id>           # dump one queued message's headers+body
journalctl -u postfix -n 50    # recent Postfix log lines
journalctl -u dovecot -n 50    # recent Dovecot log lines
```

**Checkpoint:** a message sent with `swaks` is queued, delivered, and readable back over IMAP with no manual queue-flushing required. If `swaks` reports a `554` or `450` rejection, re-read `smtpd_recipient_restrictions` before touching anything else.

---

## Phase 4 — Mail DNS: MX, SPF, DKIM, DMARC

Mail servers don't trust each other by hostname alone — DNS is where you prove you're allowed to send as `lab.local`.

**[lab-mail01]** — install OpenDKIM and generate a keypair:

```bash
sudo apt install -y opendkim opendkim-tools
sudo mkdir -p /etc/opendkim/keys/lab.local
sudo opendkim-genkey -b 2048 -d lab.local -s mail01 -D /etc/opendkim/keys/lab.local
sudo chown opendkim:opendkim /etc/opendkim/keys/lab.local/mail01.private
```

**[lab-mail01]** — `/etc/opendkim.conf` key lines:

```
Domain                  lab.local
Selector                mail01
KeyFile                 /etc/opendkim/keys/lab.local/mail01.private
Socket                  inet:8891@localhost
Mode                    sv
Syslog                  yes
```

**[lab-mail01]** — hook it into Postfix, append to `main.cf`:

```
milter_default_action = accept
milter_protocol = 6
smtpd_milters = inet:127.0.0.1:8891
non_smtpd_milters = inet:127.0.0.1:8891
```

```bash
sudo systemctl restart opendkim postfix
```

**[lab-mail01]** — print the public key you need for DNS:

```bash
cat /etc/opendkim/keys/lab.local/mail01.txt
```

Expected output: a `mail01._domainkey IN TXT ( "v=DKIM1; h=sha256; k=rsa; " "p=MIIBIjANBgkq...")` block — copy the `p=` value.

**[lab-dns1]** — add these four records to the `lab.local` zone (substitute the real `p=` value from above; keep it as one quoted string, no line breaks):

```
lab.local.              IN MX    10 lab-mail01.lab.local.
lab.local.              IN TXT   "v=spf1 mx a:lab-mail01.lab.local -all"
mail01._domainkey.lab.local. IN TXT "v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkq...REPLACE_ME"
_dmarc.lab.local.       IN TXT   "v=DMARC1; p=quarantine; rua=mailto:postmaster@lab.local"
```

Bump the serial and reload:

```bash
sudo named-checkzone lab.local /etc/bind/zones/db.lab.local
sudo rndc reload lab.local
```

**Checkpoint:**

```bash
sudo opendkim-testkey -d lab.local -s mail01 -k /etc/opendkim/keys/lab.local/mail01.private -vvv
```

Expected output ends with: `key OK`.

```bash
dig @172.16.10.11 MX lab.local +short
dig @172.16.10.11 TXT mail01._domainkey.lab.local +short
dig @172.16.10.11 TXT _dmarc.lab.local +short
```

Expected: MX shows `10 lab-mail01.lab.local.`; the DKIM TXT shows your `v=DKIM1...` string; the DMARC TXT shows `v=DMARC1; p=quarantine...`. Do not continue to Phase 5 if `opendkim-testkey` reports anything other than `key OK` — a bad key breaks signature verification silently, not loudly.

---

## Phase 5 — FreeIPA: identity, SSO, HBAC

**[lab-ipa01]** — install and run the server installer (this takes 10-20 minutes; DNS is external so no `--setup-dns`):

```bash
sudo dnf install -y freeipa-server
sudo ipa-server-install \
  --realm=LAB.LOCAL \
  --domain=lab.local \
  --hostname=lab-ipa01.lab.local \
  --ds-password=<DS_PASSWORD> \
  --admin-password=<ADMIN_PASSWORD> \
  --no-ntp \
  --unattended
```

Expected output ends with: `The ipa-server-install command was successful`.

The installer prints a path to a DNS records file, e.g. `/tmp/ipa.system.records.XXXX.db`. **[lab-ipa01]**:

```bash
cat /tmp/ipa.system.records.*.db
```

Copy the SRV/TXT records it lists (Kerberos, LDAP, kpasswd service records) into the `lab.local` zone on **[lab-dns1]**, bump the serial, `rndc reload lab.local` — FreeIPA clients use these SRV records for service discovery even with an external DNS server.

**Checkpoint:**

```bash
ipactl status
```

Expected: every line ends `RUNNING`.

```bash
echo "<ADMIN_PASSWORD>" | kinit admin
klist
```

Expected: `klist` shows a valid ticket, `Default principal: admin@LAB.LOCAL`.

**[lab-web01 and lab-mail01]** — enroll both as IPA clients:

```bash
sudo apt install -y freeipa-client
sudo ipa-client-install \
  --domain=lab.local --realm=LAB.LOCAL --server=lab-ipa01.lab.local \
  --mkhomedir --unattended -p admin -w <ADMIN_PASSWORD>
```

Expected output ends with: `Client configuration complete.`

Enable Kerberos SSO over SSH on both clients — edit `/etc/ssh/sshd_config`:

```
GSSAPIAuthentication yes
```

and `/etc/ssh/ssh_config`:

```
GSSAPIAuthentication yes
GSSAPIDelegateCredentials yes
```

```bash
sudo systemctl restart ssh
```

**[lab-ipa01]** — create a user and group:

```bash
ipa user-add jsmith --first=John --last=Smith --email=jsmith@lab.local
ipa group-add ops --desc="Ops team"
ipa group-add-member ops --users=jsmith
```

Expected: `Added user "jsmith"` and `Added group "ops"`, respectively.

Set a password and let `jsmith` unlock it interactively once with `kinit` before relying on SSO:

```bash
ipa passwd jsmith
```

**[lab-ipa01]** — a sudo rule for the `ops` group, scoped to `lab-mail01` only:

```bash
ipa sudorule-add allow-ops-fullaccess
ipa sudorule-add-user allow-ops-fullaccess --groups=ops
ipa sudorule-add-host allow-ops-fullaccess --hosts=lab-mail01.lab.local
ipa sudorule-mod allow-ops-fullaccess --cmdcat=all
```

**[lab-ipa01]** — an HBAC rule that allows `jsmith` to SSH into `lab-web01` only, then disable the wide-open default:

```bash
ipa hbacrule-add restrict-to-web
ipa hbacrule-add-user restrict-to-web --users=jsmith
ipa hbacrule-add-host restrict-to-web --hosts=lab-web01.lab.local
ipa hbacrule-add-service restrict-to-web --hbacsvcs=sshd
ipa hbacrule-disable allow_all
```

**Checkpoint — SSO works:**

```bash
# [lab-web01], as jsmith
kinit jsmith
ssh jsmith@lab-web01.lab.local
```

Expected: no password prompt (Kerberos ticket authenticates you), you land in a shell as `jsmith`.

**Checkpoint — HBAC blocks the restricted host:**

```bash
ipa hbactest --user=jsmith --host=lab-mail01.lab.local --service=sshd
ipa hbactest --user=jsmith --host=lab-web01.lab.local --service=sshd
```

Expected: the `lab-mail01.lab.local` test reports `Access denied`; the `lab-web01.lab.local` test reports `Access granted`. Confirm it for real:

```bash
ssh jsmith@lab-mail01.lab.local
```

Expected: `Permission denied` — the HBAC rule is enforcing, not just advisory.

---

## Break-fix drills

Diagnose from the symptom before opening the hints. State what you observe, form a hypothesis, test it, then fix.

**Drill 1 — Certificate expired**

Ask Claude, in this session, to backdate-sign a fresh `app.lab.local` cert so it's already expired (e.g. using `faketime` to sign as if it were two years ago, with a short validity window), then reload nginx.

Symptom: `curl -v https://app.lab.local/` fails with a certificate expiry error instead of connecting. Diagnose which cert is bad and how you'd confirm the expiry date without guessing, before rotating it.

**Drill 2 — Mail stuck in the queue (MX DNS broken)**

Ask Claude to change the `lab.local` MX record on `lab-dns1` to point at a hostname that doesn't exist (e.g. `nonexistent.lab.local`), reload the zone, then send a test message.

Symptom: `swaks` still reports local queueing succeeded, but the message never reaches the mailbox and `mailq` shows it deferred. Diagnose using the queue tools from Phase 3 before touching DNS.

**Drill 3 — Kerberos fails from time skew**

Ask Claude to shift the clock on one IPA client several minutes off from `lab-ipa01` (e.g. `sudo date -s "+10 minutes"` after stopping `chronyd` on that client).

Symptom: `kinit` on the skewed client fails with a clock-related error, even though the password is correct. Diagnose with `klist`, `journalctl -u sssd`, and the KDC's own log on `lab-ipa01` before touching time sync.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `openssl x509 -in <cert> -noout -dates` tells you `notBefore`/`notAfter` without needing to trust the app to report it honestly.
- Drill 2: `postcat -q <queue-id>` shows you Postfix's own bounce/defer reason text — it usually names the DNS lookup failure directly.
- Drill 3: Kerberos tickets are time-bound by design; the default tolerance is 5 minutes (`clockskew` in `krb5.conf`). Compare `date` output on both machines side by side.

</details>

---

## Prove-it: onboard `newhire01`

One documented sequence, run for real against `newhire01`, with evidence at each step.

**[lab-ipa01]** — create the IPA identity:

```bash
ipa user-add newhire01 --first=New --last=Hire --email=newhire01@lab.local
ipa group-add-member ops --users=newhire01
ipa hbacrule-add-user restrict-to-web --users=newhire01
ipa passwd newhire01
```

**[lab-web01 or lab-mail01]** — evidence the account exists lab-wide via SSSD:

```bash
getent passwd newhire01
```

Expected: a passwd-style line showing `newhire01` with a home directory under `/home/`.

**[lab-mail01]** — mail delivery for an IPA-sourced account needs a Maildir created once (IPA doesn't auto-create it; the account itself is already visible via SSSD):

```bash
sudo mkdir -p /home/newhire01/Maildir/{cur,new,tmp}
sudo chown -R newhire01: /home/newhire01/Maildir
```

Evidence — send and check delivery:

```bash
swaks --to newhire01@lab.local --from bob@lab.local --server lab-mail01.lab.local
sudo ls /home/newhire01/Maildir/new/
```

Expected: `swaks` ends `250 2.0.0 Ok: queued`; the `ls` shows one delivered file.

**[lab-web01]** — evidence of SSO SSH to every enrolled client:

```bash
kinit newhire01
ssh newhire01@lab-web01.lab.local whoami
ssh newhire01@lab-mail01.lab.local whoami
```

Expected: both print `newhire01`, with no password prompt on either.

That's the full onboarding proof: IPA identity, mail account, and passwordless SSO SSH to both clients, all for one new employee, in one session.

---

## Done when

- [ ] `test.lab.local.crt` (and every service cert after it) verifies with `openssl verify` against `lab-ca.crt`
- [ ] `https://app.lab.local/` serves through nginx with a valid chain; `http://` redirects to `https://`
- [ ] A `swaks`-sent message reaches a local Maildir and is readable back over IMAP
- [ ] MX, SPF, DKIM, and DMARC records are live in the `lab.local` zone; `opendkim-testkey` reports `key OK`
- [ ] FreeIPA server running, both `lab-web01` and `lab-mail01` enrolled as clients
- [ ] `kinit` + passwordless SSH SSO works between enrolled clients
- [ ] The HBAC rule provably blocks `jsmith` from the restricted host while allowing the permitted one
- [ ] All three break-fix drills reproduced, diagnosed, and fixed
- [ ] `newhire01` onboarded end-to-end (IPA user, mail delivery, SSO SSH to both clients) with command output as evidence
