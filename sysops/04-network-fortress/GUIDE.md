# Mission 04 Guide — Network Fortress

This guide is not a script to paste blindly. Read each phase, run the commands, and actually look at the output before moving on — every phase ends in a checkpoint that proves you understand what happened, not just that a command exited zero.

## Topology used in this guide

You need three VMs cloned from your Mission 01 templates (`tpl-ubuntu2404` recommended — bonding, VLAN, `nftables`, `bind9`, and Kea packages are all in the Ubuntu repos). Clone them per the Mission 01 procedure, then re-address as below. Names, roles, and addresses are used verbatim through every phase — keep them as-is so the commands in this guide work unmodified.

| VM | Role | Interfaces (by end of Phase 7) |
|---|---|---|
| `lab-router` | Router, firewall, NAT, DHCP server, WireGuard server | `bond0` (2 NICs, active-backup) `172.16.10.10/24` · `vlan10` (`bond0.10`) `10.10.10.1/24` · `vlan20` (`bond0.20`) `10.20.20.1/24` · `wg0` `10.99.99.1/24` |
| `lab-dns` | Authoritative DNS, WireGuard client | `eth0` (Hyper-V VLAN access = 10) `10.10.10.11/24` · `wg0` `10.99.99.2/24` |
| `lab-app` | DHCP client / test target | `eth0` (Hyper-V VLAN access = 20), DHCP-assigned from Kea (reserved `10.20.20.50`) |

Two segments hang off the router: **vlan10** ("services", where `lab-dns` lives) and **vlan20** ("clients", where `lab-app` lives). `lab-router`'s native, untagged VLAN is your existing Mission 01 mgmt network, `172.16.10.0/24`, which is already NATed to the internet by `LabNat`.

**Before you touch anything: `Checkpoint-VM` all three VMs.** Every phase below can be un-done by restoring a snapshot; that's the point.

---

## Phase 0 — Setup check

Confirm the three VMs exist, boot, and are reachable on the flat `172.16.10.0/24` network from Mission 01 before you start reshaping it.

From the **host** (PowerShell):

```powershell
Get-VM lab-router, lab-dns, lab-app | Select-Object Name, State
```
Expected output: all three `Running`.

```powershell
172.16.10.10, 172.16.10.11, 172.16.10.12 | ForEach-Object { Test-Connection $_ -Count 1 -Quiet }
```
Expected output: `True` three times. (Adjust the IPs to whatever static addresses you gave these VMs when you cloned them in Mission 01.)

From the **host**, confirm SSH works to each:

```powershell
ssh user@172.16.10.10 hostname
ssh user@172.16.10.11 hostname
ssh user@172.16.10.12 hostname
```
Expected output: `lab-router`, `lab-dns`, `lab-app` respectively.

**Checkpoint:** all three VMs `Running`, all three ping, all three answer SSH with the right hostname.

---

## Phase 1 — Netplan static addressing + verify

Confirm each VM's current static configuration is clean and known-good before you start layering VLANs and bonds on top of it. On each VM (guest, bash), find your interface name first:

```bash
ip -br link
```
Expected output (name varies — Hyper-V synthetic NICs are usually `eth0`):
```
lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP>
eth0             UP             00:15:5d:xx:xx:xx <BROADCAST,MULTICAST,UP,LOWER_UP>
```

Confirm the netplan file matches what's actually applied (substitute your interface name for `eth0` everywhere in this guide if it differs):

```bash
cat /etc/netplan/01-netcfg.yaml
```
Expected output — a baseline single-NIC static config, e.g. on `lab-router`:
```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses: [172.16.10.10/24]
      routes:
        - to: default
          via: 172.16.10.1
      nameservers:
        addresses: [172.16.10.1]
```

Verify the live state matches the file on all three VMs:

```bash
ip -br a
```
Expected output: your static address on `eth0`, `lo` as `127.0.0.1/8`.

```bash
ip r
```
Expected output: a `default via 172.16.10.1 dev eth0` line plus the local `172.16.10.0/24 dev eth0` route.

**Checkpoint:** `ip -br a` and `ip r` on all three VMs match their netplan files exactly — no drift, no leftover DHCP leases.

---

## Phase 2 — VLAN subinterfaces on the router

You might expect a Linux bridge here. Skip it — a bridge switches frames between ports at Layer 2; what you're building is Layer 3 routing between two new segments, so 802.1q VLAN subinterfaces directly on the router's NIC are the correct tool. (You'd reach for a bridge if you needed a virtual switch joining multiple local ports together — that's not this job. Keep the distinction straight: bridge = L2 switching, subinterface + routing = L3 segmentation.)

**Host (PowerShell):** put `lab-router`'s vNIC in trunk mode so tagged frames pass through untouched, and put `lab-dns`/`lab-app`'s vNICs in access mode so Hyper-V does the tagging/untagging for them and they see plain untagged Ethernet:

```powershell
Get-VMNetworkAdapter -VMName lab-router | Set-VMNetworkAdapterVlan -Trunk -AllowedVlanIdList "10,20" -NativeVlanId 0
Get-VMNetworkAdapter -VMName lab-dns    | Set-VMNetworkAdapterVlan -Access -VlanId 10
Get-VMNetworkAdapter -VMName lab-app    | Set-VMNetworkAdapterVlan -Access -VlanId 20
```

Verify:
```powershell
Get-VMNetworkAdapterVlan -VMName lab-router, lab-dns, lab-app
```
Expected output: `lab-router` shows `Trunk` mode with allowed list `10,20`; `lab-dns` shows `Access` / `10`; `lab-app` shows `Access` / `20`.

**Guest, `lab-router` (bash):** add VLAN subinterfaces to netplan:

```bash
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0:
      addresses: [172.16.10.10/24]
      routes:
        - to: default
          via: 172.16.10.1
      nameservers:
        addresses: [172.16.10.1]
  vlans:
    vlan10:
      id: 10
      link: eth0
      addresses: [10.10.10.1/24]
    vlan20:
      id: 20
      link: eth0
      addresses: [10.20.20.1/24]
EOF
sudo netplan apply
```

Enable IPv4 forwarding so the router actually routes between segments:

```bash
sudo tee /etc/sysctl.d/99-router.conf > /dev/null <<'EOF'
net.ipv4.ip_forward = 1
EOF
sudo sysctl --system
```

Verify:
```bash
ip -br a
```
Expected output:
```
eth0     UP    172.16.10.10/24
vlan10@eth0  UP  10.10.10.1/24
vlan20@eth0  UP  10.20.20.1/24
```

```bash
sysctl net.ipv4.ip_forward
```
Expected output: `net.ipv4.ip_forward = 1`

**Guest, `lab-dns` (bash):** re-address into the services segment (this VM's vNIC is now access-mode VLAN 10, so it's physically on that segment already — netplan just needs to match):

```bash
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0:
      addresses: [10.10.10.11/24]
      routes:
        - to: default
          via: 10.10.10.1
      nameservers:
        addresses: [172.16.10.1]
EOF
sudo netplan apply
```

**Guest, `lab-app` (bash):** re-address into the client segment (static for now — this becomes DHCP in Phase 7):

```bash
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0:
      addresses: [10.20.20.12/24]
      routes:
        - to: default
          via: 10.20.20.1
      nameservers:
        addresses: [172.16.10.1]
EOF
sudo netplan apply
```

**Checkpoint:** from `lab-dns`, `ping -c 3 10.10.10.1` (its own gateway) and `ping -c 3 10.20.20.12` (across the router, into the other segment) both succeed. `ip -br a` and `ip r` on all three VMs show the new addressing.

---

## Phase 3 — NIC bonding, active-backup

Give the router a second NIC and bond it, so a single failed link doesn't take the whole network down.

**Host (PowerShell):** add a second vNIC and trunk it identically to the first:

```powershell
Add-VMNetworkAdapter -VMName lab-router -SwitchName LabSwitch
Get-VMNetworkAdapter -VMName lab-router | Set-VMNetworkAdapterVlan -Trunk -AllowedVlanIdList "10,20" -NativeVlanId 0
```

Verify:
```powershell
Get-VMNetworkAdapter -VMName lab-router | Select-Object Name, MacAddress
```
Expected output: two adapters listed, e.g. `Network Adapter` and `Network Adapter 2`, each with a distinct MAC.

**Guest, `lab-router` (bash):** confirm the new NIC showed up, then bond both into `bond0` and move the VLANs onto it:

```bash
ip -br link
```
Expected output: a second link, e.g. `eth1`, `DOWN` (no config yet).

```bash
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0: {}
    eth1: {}
  bonds:
    bond0:
      interfaces: [eth0, eth1]
      addresses: [172.16.10.10/24]
      routes:
        - to: default
          via: 172.16.10.1
      nameservers:
        addresses: [172.16.10.1]
      parameters:
        mode: active-backup
        primary: eth0
        mii-monitor-interval: 100
  vlans:
    vlan10:
      id: 10
      link: bond0
      addresses: [10.10.10.1/24]
    vlan20:
      id: 20
      link: bond0
      addresses: [10.20.20.1/24]
EOF
sudo netplan apply
```

Verify the bond is up and `eth0` is the active slave:
```bash
cat /proc/net/bonding/bond0
```
Expected output includes:
```
Bonding Mode: fault-tolerance (active-backup)
Currently Active Slave: eth0
Slave Interface: eth0
MII Status: up
Slave Interface: eth1
MII Status: up
```

**Failover test.** From `lab-dns` (bash), start a continuous ping to the router's `vlan10` address and leave it running:

```bash
ping 10.10.10.1
```

While that's running, on the **host** (PowerShell), disconnect the active NIC:

```powershell
Get-VMNetworkAdapter -VMName lab-router | Where-Object Name -eq "Network Adapter" | Disconnect-VMNetworkAdapter
```

Watch the ping window: expect at most one or two dropped replies, then pings resume. On `lab-router` (bash), confirm the failover:

```bash
cat /proc/net/bonding/bond0
```
Expected output: `Currently Active Slave: eth1`.

Reconnect the first NIC so you have redundancy again:

```powershell
Get-VMNetworkAdapter -VMName lab-router | Where-Object Name -eq "Network Adapter" | Connect-VMNetworkAdapter -SwitchName LabSwitch
```

**Checkpoint:** ping loss during failover is brief (a couple of dropped packets, not a sustained outage), and `/proc/net/bonding/bond0` shows the active slave switching to `eth1` and back once you reconnect and fail the other side.

---

## Phase 4 — nftables: default-deny everywhere

Every VM gets a default-deny `INPUT` policy. The router additionally does NAT masquerade (so the internal segments reach the internet through the existing `LabNat`) and one DNAT port-forward example.

**Guest, `lab-router` (bash):** install and write the full ruleset.

```bash
sudo apt update && sudo apt install -y nftables
```

```bash
sudo tee /etc/nftables.conf > /dev/null <<'EOF'
#!/usr/sbin/nft -f

flush ruleset

define WAN_IF   = "bond0"
define VLAN_SVC = "vlan10"
define VLAN_CLI = "vlan20"

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        ct state established,related accept
        ct state invalid drop

        iif lo accept
        icmp type { echo-request, echo-reply, destination-unreachable, time-exceeded } accept
        icmpv6 type { echo-request, echo-reply, nd-neighbor-solicit, nd-neighbor-advert } accept

        tcp dport 22 accept comment "ssh mgmt"
        udp dport 51820 accept comment "wireguard"

        # Kea DHCP replies to clients on the client vlan
        udp dport { 67, 68 } iifname $VLAN_CLI accept comment "kea dhcp"
    }

    chain forward {
        type filter hook forward priority 0; policy drop;

        ct state established,related accept
        ct state invalid drop

        # both internal segments out to the internet via WAN
        iifname { $VLAN_SVC, $VLAN_CLI } oifname $WAN_IF accept
        iifname $WAN_IF oifname { $VLAN_SVC, $VLAN_CLI } ct state established,related accept

        # let the two internal segments reach each other
        # (delete these two lines to fully isolate the segments)
        iifname $VLAN_SVC oifname $VLAN_CLI accept
        iifname $VLAN_CLI oifname $VLAN_SVC accept
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}

table ip nat {
    chain prerouting {
        type nat hook prerouting priority -100;

        # port-forward example: expose lab-app's web server on the router's
        # mgmt address, port 8080. 10.20.20.50 is lab-app's Kea reservation
        # (see Phase 7) -- update this if you used a different IP.
        iifname $WAN_IF tcp dport 8080 dnat to 10.20.20.50:80
    }

    chain postrouting {
        type nat hook postrouting priority 100;

        ip saddr 10.10.10.0/24 oifname $WAN_IF masquerade
        ip saddr 10.20.20.0/24 oifname $WAN_IF masquerade
    }
}
EOF
```

Load it and make it persistent:

```bash
sudo nft -f /etc/nftables.conf
sudo systemctl enable --now nftables
```

**Guest, `lab-dns` and `lab-app` (bash), each:** a simpler host-only ruleset — default-deny input, ssh, established/related, icmp:

```bash
sudo apt update && sudo apt install -y nftables
sudo tee /etc/nftables.conf > /dev/null <<'EOF'
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        ct state established,related accept
        ct state invalid drop
        iif lo accept
        icmp type { echo-request, echo-reply } accept

        tcp dport 22 accept comment "ssh mgmt"
    }
    chain forward {
        type filter hook forward priority 0; policy drop;
    }
    chain output {
        type filter hook output priority 0; policy accept;
    }
}
EOF
sudo nft -f /etc/nftables.conf
sudo systemctl enable --now nftables
```

(You'll add `tcp/udp dport 53` to `lab-dns`'s ruleset in Phase 6, and `udp dport 51820` if you ever flip it to a WireGuard server. Edit `/etc/nftables.conf` and re-run `nft -f` — never leave a stale rule in place without reloading.)

**Checkpoint — proof, not just `nft list ruleset`:**

```bash
sudo nft list ruleset
```
Expected output: the chains and rules you just wrote, `policy drop` on every `input` chain.

From the **host**, prove SSH (allowed) still works and an arbitrary port (blocked) doesn't:
```powershell
ssh user@10.10.10.11 hostname   # allowed -> prints "lab-dns"
```
```powershell
Test-NetConnection 10.10.10.11 -Port 80   # blocked -> TcpTestSucceeded: False
```

---

## Phase 5 — WireGuard tunnel

Build an encrypted tunnel between `lab-router` (server) and `lab-dns` (client). Even though they already share a routed network, this proves you can build an overlay that would work identically across the open internet.

**Guest, `lab-router` (bash):**
```bash
sudo apt update && sudo apt install -y wireguard
umask 077
wg genkey | sudo tee /etc/wireguard/router_private.key | wg pubkey | sudo tee /etc/wireguard/router_public.key
cat /etc/wireguard/router_public.key
```
Expected output: a base64 public key — copy it, you need it for `lab-dns`'s config.

**Guest, `lab-dns` (bash):**
```bash
sudo apt update && sudo apt install -y wireguard
umask 077
wg genkey | sudo tee /etc/wireguard/dns_private.key | wg pubkey | sudo tee /etc/wireguard/dns_public.key
cat /etc/wireguard/dns_public.key
```
Expected output: a base64 public key — copy it, you need it for `lab-router`'s config.

**Guest, `lab-router` (bash):** write the server config (`AllowedIPs` here scopes *inbound* — only traffic from `10.99.99.2` is accepted from this peer, and only traffic to `10.99.99.2` is routed out to it):

```bash
sudo tee /etc/wireguard/wg0.conf > /dev/null <<EOF
[Interface]
PrivateKey = $(sudo cat /etc/wireguard/router_private.key)
Address = 10.99.99.1/24
ListenPort = 51820

[Peer]
# lab-dns
PublicKey = <PASTE_LABDNS_PUBLIC_KEY_HERE>
AllowedIPs = 10.99.99.2/32
EOF
sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
```

**Guest, `lab-dns` (bash):** write the client config:

```bash
sudo tee /etc/wireguard/wg0.conf > /dev/null <<EOF
[Interface]
PrivateKey = $(sudo cat /etc/wireguard/dns_private.key)
Address = 10.99.99.2/24

[Peer]
# lab-router
PublicKey = <PASTE_ROUTER_PUBLIC_KEY_HERE>
Endpoint = 172.16.10.10:51820
AllowedIPs = 10.99.99.1/32
PersistentKeepalive = 25
EOF
sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
```

**`AllowedIPs`, explained:** it does two jobs at once. First, cryptokey routing — WireGuard only decrypts a packet from a peer if its source address falls inside that peer's `AllowedIPs`, and it drops anything else even though the tunnel is up. Second, it's the routing table for outbound traffic — packets destined for an address in a peer's `AllowedIPs` get encrypted and sent to that peer. We scoped both sides to `/32` (just the other tunnel endpoint), which makes this strictly point-to-point. Widen it to `0.0.0.0/0` on the client and you'd get a full-tunnel VPN routing all its traffic through the router instead.

**Checkpoint:**
```bash
sudo wg show
```
Expected output on `lab-router`: a peer entry for `lab-dns` with a recent `latest handshake`.

```bash
ping -c 3 10.99.99.2   # from lab-router
ping -c 3 10.99.99.1   # from lab-dns
```
Expected output: both succeed.

---

## Phase 6 — bind9: authoritative DNS for `lab.local`

**Guest, `lab-dns` (bash):** install bind9 and generate the TSIG key Kea will use later for dynamic updates.

```bash
sudo apt update && sudo apt install -y bind9 bind9utils dnsutils
tsig-keygen -a hmac-sha256 kea-ddns
```
Expected output:
```
key "kea-ddns" {
	algorithm hmac-sha256;
	secret "base64-secret-string-here==";
};
```
Copy that whole block — you'll paste it into `named.conf.local` below, and paste the bare secret string into Kea's config in Phase 7.

Open port 53 in `lab-dns`'s firewall:
```bash
sudo nft add rule inet filter input tcp dport 53 accept
sudo nft add rule inet filter input udp dport 53 accept
sudo sh -c 'nft list ruleset > /etc/nftables.conf'
```

Write `named.conf.local` (paste your real TSIG key block in place of the placeholder):

```bash
sudo tee /etc/bind/named.conf.local > /dev/null <<'EOF'
key "kea-ddns" {
    algorithm hmac-sha256;
    secret "PASTE_YOUR_TSIG_SECRET_HERE==";
};

zone "lab.local" {
    type master;
    file "/etc/bind/zones/db.lab.local";
    allow-update { key kea-ddns; };
};

zone "10.16.172.in-addr.arpa" {
    type master;
    file "/etc/bind/zones/db.172.16.10";
};

zone "20.20.10.in-addr.arpa" {
    type master;
    file "/etc/bind/zones/db.10.20.20";
    allow-update { key kea-ddns; };
};
EOF
```

Forwarders, so lab clients get real internet resolution too:
```bash
sudo sed -i '/^};/i \\tforwarders { 172.16.10.1; };\n\tdnssec-validation auto;' /etc/bind/named.conf.options
```

Create the zone directory and files:

```bash
sudo mkdir -p /etc/bind/zones
```

Forward zone, `/etc/bind/zones/db.lab.local`:
```bash
sudo tee /etc/bind/zones/db.lab.local > /dev/null <<'EOF'
$TTL 3600
@   IN  SOA lab-dns.lab.local. admin.lab.local. (
                2026071201 ; serial
                3600       ; refresh
                900        ; retry
                604800     ; expire
                3600 )     ; negative TTL
    IN  NS  lab-dns.lab.local.

lab-router  IN  A   172.16.10.10
lab-dns     IN  A   10.10.10.11
EOF
```

Reverse zone for the mgmt network, `/etc/bind/zones/db.172.16.10`:
```bash
sudo tee /etc/bind/zones/db.172.16.10 > /dev/null <<'EOF'
$TTL 3600
@   IN  SOA lab-dns.lab.local. admin.lab.local. (
                2026071201
                3600
                900
                604800
                3600 )
    IN  NS  lab-dns.lab.local.

10  IN  PTR lab-router.lab.local.
EOF
```

Reverse zone for the client segment — empty for now, Kea populates it in Phase 7, `/etc/bind/zones/db.10.20.20`:
```bash
sudo tee /etc/bind/zones/db.10.20.20 > /dev/null <<'EOF'
$TTL 3600
@   IN  SOA lab-dns.lab.local. admin.lab.local. (
                2026071201
                3600
                900
                604800
                3600 )
    IN  NS  lab-dns.lab.local.
EOF
```

Check syntax and start:
```bash
sudo named-checkconf
sudo named-checkzone lab.local /etc/bind/zones/db.lab.local
sudo chown -R bind:bind /etc/bind/zones
sudo systemctl enable --now bind9
```

Point `lab-dns` and `lab-app` at this server for resolution (edit each VM's netplan `nameservers.addresses` to `[10.10.10.11]`, keeping `172.16.10.1` as a fallback where useful, then `sudo netplan apply`).

**Checkpoint:**
```bash
dig @10.10.10.11 lab-router.lab.local +short
```
Expected output: `172.16.10.10`

```bash
dig @10.10.10.11 -x 172.16.10.10 +short
```
Expected output: `lab-router.lab.local.`

```bash
dig @10.10.10.11 lab.local NS +short
```
Expected output: `lab-dns.lab.local.`

---

## Phase 7 — Kea DHCP with dynamic DNS

Kea hands out leases on the client segment (`vlan20`) and pushes DDNS updates straight into `bind9`, authenticated by the same TSIG key.

**Guest, `lab-router` (bash):**
```bash
sudo apt update && sudo apt install -y kea-dhcp4-server kea-dhcp-ddns-server
```

Get `lab-app`'s MAC address so you can give it a fixed reservation (matches the DNAT target you used in Phase 4):
```bash
ssh user@10.20.20.12 "ip link show eth0 | awk '/ether/ {print \$2}'"
```
Expected output: something like `00:15:5d:aa:bb:cc` — use it below in place of the placeholder.

`/etc/kea/kea-dhcp4.conf`:
```bash
sudo tee /etc/kea/kea-dhcp4.conf > /dev/null <<'EOF'
{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": [ "vlan20" ]
    },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea4-ctrl-socket"
    },
    "lease-database": {
      "type": "memfile",
      "lfc-interval": 3600
    },
    "valid-lifetime": 3600,
    "renew-timer": 1800,
    "rebind-timer": 3150,
    "dhcp-ddns": {
      "enable-updates": true
    },
    "ddns-qualifying-suffix": "lab.local",
    "ddns-replace-client-name": "when-not-present",
    "ddns-send-updates": true,
    "subnet4": [
      {
        "id": 1,
        "subnet": "10.20.20.0/24",
        "pools": [ { "pool": "10.20.20.100 - 10.20.20.200" } ],
        "option-data": [
          { "name": "routers", "data": "10.20.20.1" },
          { "name": "domain-name-servers", "data": "10.10.10.11" },
          { "name": "domain-name", "data": "lab.local" }
        ],
        "reservations": [
          {
            "hw-address": "PASTE_LABAPP_MAC_HERE",
            "ip-address": "10.20.20.50",
            "hostname": "lab-app"
          }
        ]
      }
    ]
  }
}
EOF
```

`/etc/kea/kea-dhcp-ddns.conf` (paste the same TSIG secret from Phase 6, bare, no `key` wrapper):
```bash
sudo tee /etc/kea/kea-dhcp-ddns.conf > /dev/null <<'EOF'
{
  "DhcpDdns": {
    "ip-address": "127.0.0.1",
    "port": 53001,
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea-ddns-ctrl-socket"
    },
    "tsig-keys": [
      {
        "name": "kea-ddns",
        "algorithm": "HMAC-SHA256",
        "secret": "PASTE_YOUR_TSIG_SECRET_HERE=="
      }
    ],
    "forward-ddns": {
      "ddns-domains": [
        {
          "name": "lab.local.",
          "key-name": "kea-ddns",
          "dns-servers": [ { "ip-address": "10.10.10.11", "port": 53 } ]
        }
      ]
    },
    "reverse-ddns": {
      "ddns-domains": [
        {
          "name": "20.20.10.in-addr.arpa.",
          "key-name": "kea-ddns",
          "dns-servers": [ { "ip-address": "10.10.10.11", "port": 53 } ]
        }
      ]
    }
  }
}
EOF
```

```bash
sudo systemctl enable --now kea-dhcp4-server kea-dhcp-ddns-server
```

**Guest, `lab-app` (bash):** switch from static to DHCP:
```bash
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
EOF
sudo netplan apply
sudo dhclient -r eth0 2>/dev/null; sudo dhclient eth0 2>/dev/null || sudo networkctl renew eth0
```

**Checkpoint:**
```bash
ip -br a
```
Expected output on `lab-app`: `eth0` holding `10.20.20.50/24` (the reservation).

From `lab-dns` (bash), confirm the DDNS update landed:
```bash
dig @10.10.10.11 lab-app.lab.local +short
```
Expected output: `10.20.20.50`

```bash
dig @10.10.10.11 -x 10.20.20.50 +short
```
Expected output: `lab-app.lab.local.`

---

## Phase 8 — tcpdump: read the DHCP handshake and a DNS query

**Guest, `lab-app` (bash), first terminal:**
```bash
sudo tcpdump -i eth0 -vvv port 67 or port 68
```

**Guest, `lab-app` (bash), second terminal:** trigger a fresh lease:
```bash
sudo dhclient -r eth0
sudo dhclient eth0
```

Expected output in the first terminal: four packets — `DHCP-Discover`, `DHCP-Offer`, `DHCP-Request`, `DHCP-ACK`. Read them: `Discover` comes from `0.0.0.0.68` to `255.255.255.255.67` (client has no address yet, so it broadcasts); `Offer` comes back from the server (`lab-router`, `10.20.20.1`) with `Your-IP` set to the offered lease; `Request` is the client broadcasting again to confirm which offer it's accepting (still no unicast — other DHCP servers on the segment need to see this too); `ACK` is the server confirming, again carrying `Your-IP` plus your option-data (router, DNS, domain).

**Guest, `lab-dns` (bash), first terminal:**
```bash
sudo tcpdump -i eth0 -vvv port 53
```

**From the host or `lab-app`, second terminal:**
```bash
dig @10.10.10.11 lab-router.lab.local
```

Expected output in the first terminal: one query packet (`A? lab-router.lab.local`, a random source port, destination `10.10.10.11.53`) and one response packet (source `.53`, flags include `qr` for "this is a response" and `aa` for "authoritative answer", `ANCOUNT: 1` since one record came back). Match the transaction ID in both packets — it's how the resolver matches a reply to its query over connectionless UDP.

**Checkpoint:** you can point at each packet in both captures and say what it is and why it exists, not just that four DHCP packets and two DNS packets showed up.

---

## Break-fix drills

Do these for real — break the thing, watch it fail, diagnose it with the tools above, fix it, and confirm the fix. No solutions given here on purpose; use `ip route`, `ip neigh`, `tcpdump`, `dig +trace`, and `journalctl` to work each one out.

### Drill 1 — wrong gateway, one-way reachable

Change `lab-app`'s default route to point at the wrong address (something that exists on the segment but isn't the router, e.g. `lab-dns`'s IP if it were on the same segment, or simply a dead IP like `10.20.20.254`). Try pinging from `lab-app` to `lab-router` and from `lab-router` to `lab-app`. One direction breaks; figure out which, and why the other direction can still look like it's working for a moment.

<details>
<summary>Hint</summary>
Check which host initiates the packet that never finds a path home. ARP and `ip route get <dest>` on both ends will show you exactly where the packet is trying to go versus where it needs to go.
</details>

### Drill 2 — MTU 1300 black hole

Set the router's `vlan20` interface MTU to 1300 (`ip link set vlan20 mtu 1300`, then figure out how to make it stick via netplan) while leaving `lab-app`'s MTU at the default 1500. Run a normal `ping` (small packets) — it works fine. Then try an `scp` of a large file, or `ping -s 1400 -M do`, between segments. It hangs.

<details>
<summary>Hint</summary>
Small ICMP echoes fit under any MTU on the path, so they're not proof of anything. The `-M do` ping flag sets the don't-fragment bit — that's how you find out where a packet this size actually dies, and why "ping works" is not the same as "the network works."
</details>

### Drill 3 — firewall locks out SSH

On `lab-router`, temporarily edit `/etc/nftables.conf` to change `tcp dport 22 accept` to `tcp dport 2222 accept` (or just delete the SSH rule entirely), then `nft -f /etc/nftables.conf`. Your SSH session may survive (existing connections are already `established`), but new connections won't. Confirm you're locked out, then recover.

<details>
<summary>Hint</summary>
Hyper-V's VM Connect console (`vmconnect.exe`, or right-click the VM → Connect in Hyper-V Manager) talks to the VM's virtual console directly — it doesn't go over the network at all, so a broken firewall can't block it.
</details>

### Drill 4 — DNS forwarding loop, SERVFAIL storm

On `lab-dns`, change the `forwarders` line in `/etc/bind/named.conf.options` to point at `lab-dns`'s own address (`10.10.10.11`) instead of `172.16.10.1`. Restart `bind9` and run a handful of `dig` queries for a name it isn't authoritative for (e.g. `dig @10.10.10.11 example.com`).

<details>
<summary>Hint</summary>
Watch `journalctl -u bind9 -f` while you query. A resolver that forwards to itself for anything it doesn't already know the answer to will ask itself the same question forever until something gives up — that "something" is what SERVFAIL is telling you.
</details>

---

## Prove-it: 3-tier segmented network

Build a third segment and prove a strict access chain with `nmap`, using nothing but skills from Phases 2 and 4 (VLAN subinterfaces + `nftables` `forward` chain rules):

- **web tier**: reachable from the lab mgmt network (`172.16.10.0/24`) on port 443 only — nothing else.
- **app tier**: reachable from the web tier only — not from mgmt, not from db.
- **db tier**: reachable from the app tier only — not from mgmt, not from web.

Clone one additional VM from your Mission 01 template for the db tier (or repurpose `lab-app` and clone two fresh ones — your call). Add a third VLAN subinterface on `lab-router` for it, run a simple listener on the relevant port in each tier (`nc -lvp 443`, `nc -lvp 8080`, `nc -lvp 5432` are enough — you're proving reachability, not deploying real services), and write `forward`-chain rules on the router scoped by `iifname`/`oifname` per segment, mirroring what you wrote in Phase 4.

Prove it with `nmap`, run from each segment against the others:
```bash
nmap -p 443,8080,5432 <target-ip>
```

<details>
<summary>Hint</summary>
Your Phase 4 `forward` chain currently has two blanket rules letting `vlan10` and `vlan20` talk to each other. That's the pattern to replace: instead of segment-to-segment blanket accepts, you need segment-and-port-specific accepts, one direction at a time, default-deny underneath. Test from the segment that should be blocked first — a scan that shows everything `filtered` (not `closed`) confirms the packet is being dropped by policy, not refused by an absent service.
</details>

Expected end state: `nmap` from the mgmt network shows only 443 open on the web tier (app and db show `filtered` on all three ports); `nmap` from the web tier shows only 8080 open on the app tier; `nmap` from the app tier shows only 5432 open on the db tier; `nmap` from any other direction (db → app, db → web, app → web reverse, mgmt → app, mgmt → db) shows everything `filtered`.

---

## Done when

- [ ] Three VMs are up with the topology above: `lab-router` (bonded, VLAN-subinterfaced), `lab-dns`, `lab-app`
- [ ] `lab-router`'s bond fails over cleanly between its two NICs with minimal ping loss
- [ ] Every VM loads a default-deny `nftables` ruleset from `/etc/nftables.conf` and it survives a reboot
- [ ] `lab-router` masquerades both internal segments out to the internet and DNATs port 8080 to `lab-app`
- [ ] WireGuard tunnel between `lab-router` and `lab-dns` passes ping traffic over `10.99.99.0/24`
- [ ] `bind9` on `lab-dns` answers authoritative forward and reverse queries for `lab.local`
- [ ] Kea hands `lab-app` its reserved lease and the DDNS update shows up in `bind9` automatically
- [ ] You can read a captured DHCP handshake and a DNS query/response and explain every field
- [ ] All four break-fix drills completed — broken, diagnosed, fixed, confirmed
- [ ] Prove-it 3-tier network built and proven with `nmap` scans from every segment
