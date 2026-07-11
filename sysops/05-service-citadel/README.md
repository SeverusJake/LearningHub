# Mission 05 — Service Citadel

**Track:** sysops · **Difficulty:** 💀💀💀💀💀 · **Time:** 16-24h
**Prerequisites:** Mission 01 (Lab Forge), Mission 04 (Network Fortress — DNS)

> **Warning:** mail is the single hardest service in this track. Postfix, Dovecot, SPF/DKIM/DMARC, and a queue that silently refuses to move will eat more hours than every other phase combined. That difficulty is the point — if you can stand up working internal mail from scratch, you can debug it in production.

## Goal

Stand up the internal services a real company network actually depends on, all wired together for real: a private certificate authority so nothing runs on self-signed warnings, an nginx reverse proxy terminating TLS for an internal app, a working internal mail system you send and receive real messages through, and FreeIPA tying it all together with centralized identity, SSO, and host-based access control. When this mission is done, logging into any lab machine, sending lab mail, and browsing an internal HTTPS site all trust the same root of authority.

## Skills gained

- Build and operate a private CA with OpenSSL (root key, signing script, trust distribution)
- Configure nginx as a TLS-terminating reverse proxy with a real upstream
- Run Postfix as an internal-only MTA and Dovecot for IMAP retrieval, backed by Maildir
- Publish and verify mail authentication DNS records: MX, SPF, DKIM, DMARC
- Deploy FreeIPA for centralized identity: users, groups, sudo rules, HBAC, and Kerberos SSO
- Diagnose and recover from expired certs, stuck mail queues, and Kerberos clock-skew failures

## Deliverables

- [ ] Private CA operational; every internal service's certificate verifies with `openssl verify` against the CA chain
- [ ] nginx reverse proxy serving an internal app over TLS, HTTP redirecting to HTTPS
- [ ] Internal mail flowing lab.local → lab.local: a message sent via `swaks`, delivered to Dovecot, and read back over IMAP
- [ ] FreeIPA server running with two enrolled Ubuntu clients, SSO SSH working between them, and an HBAC rule proven to block the restricted host
- [ ] All three break-fix drills solved and documented
- [ ] `newhire01` onboarded end-to-end (IPA user + mail + SSO ssh to every client) with command sequence and evidence

## Start

Open a Claude Code session in this folder and say: `start sysops/05`. Follow GUIDE.md.
