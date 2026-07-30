# Spiflix on Oracle Cloud (us-ashburn-1)

Moves the core API and stream proxy off the laptop. Home region **us-ashburn-1** —
good latency from the East Coast, and Oracle's busiest region, so ARM capacity is
the main obstacle.

## Why this exists

The backend ran as a bare `node` process on a MacBook Air behind a cloudflared
tunnel. It died twice in one day with nothing to restart it, and every byte of
video went out over a home connection and through Cloudflare. This setup fixes
the supervision (systemd `Restart=always`), the uptime (a VM that doesn't sleep),
and the routing (streams bypass Cloudflare).

## 1. Instance

Try **VM.Standard.A1.Flex** (ARM, 4 OCPU / 24 GB, Always Free) first. In Ashburn
expect `Out of capacity` repeatedly — it's contention, not a mistake in your
request. Retry later or from a different availability domain.

Fall back to **VM.Standard.E2.1.Micro** (1/8 OCPU, 1 GB, 480 Mbps). This is
genuinely adequate: proxying is I/O-bound, segments are piped rather than
buffered, and 480 Mbps carries roughly 60 concurrent 1080p viewers. If you land
here, keep `--max-old-space-size=384` in the unit file.

Image: **Ubuntu 22.04**. Egress on Always Free is 10 TB/month — about 3,300 hours
of 1080p at ~3 GB/hour.

### Idle reclamation

Oracle reclaims Always Free compute that looks idle over a 7-day window. A proxy
that's quiet midweek can trip it. Upgrading the tenancy to **Pay-As-You-Go**
exempts you and improves ARM availability; Always Free resources stay free. The
trade-off is a card on file and real liability past the free limits — set a $1
budget alert immediately if you do this.

## 2. Networking — the trap that costs an evening

Oracle's Ubuntu images ship with a **restrictive iptables INPUT chain** in
addition to the VCN security list. Opening ports in the console is not enough;
the host firewall still drops the traffic, and the symptom is a connection that
times out with no log anywhere.

Both layers must allow 80 and 443:

```bash
# 1. VCN security list (console): Networking > VCN > Security Lists >
#    Default Security List > Add Ingress Rules
#      Source 0.0.0.0/0, TCP, dest ports 80, 443

# 2. Host firewall — insert BEFORE the default REJECT rule
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 7 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Verify the ACCEPT lines land above the REJECT, not below it:

```bash
sudo iptables -L INPUT -n --line-numbers
```

## 3. Deploy

```bash
sudo apt update && sudo apt install -y nodejs npm caddy
sudo corepack enable && sudo corepack prepare pnpm@latest --activate

sudo mkdir -p /opt/spiflix && sudo chown ubuntu:ubuntu /opt/spiflix
git clone <repo> /opt/spiflix && cd /opt/spiflix
pnpm install && pnpm --filter @spiflix/core build
```

Create `/opt/spiflix/packages/core/.env` (copy from the laptop — same
`PROXY_SIGNING_SECRET`, or in-flight signed URLs break for up to
`PROXY_TOKEN_TTL_SECONDS`):

```ini
PORT=3000
HOST=127.0.0.1              # Caddy and cloudflared both connect locally
NODE_ENV=production
TMDB_API_KEY=...
PROXY_SIGNING_SECRET=...
CORS_ORIGIN=*

PUBLIC_URL=https://api.spiflix.online
PROXY_PUBLIC_URL=https://stream.spiflix.online   # sends media off the CF path
```

`PROXY_PUBLIC_URL` is what splits stream traffic from the API. Leave it unset and
everything falls back to `PUBLIC_URL` — the current single-host behaviour.

```bash
sudo cp deploy/oracle/spiflix-core.service /etc/systemd/system/
sudo cp deploy/oracle/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy

sudo systemctl daemon-reload
sudo systemctl enable --now spiflix-core caddy
systemctl status spiflix-core --no-pager
```

## 4. DNS

| Record | Type | Value | Cloudflare |
|---|---|---|---|
| `stream` | A | *VM public IP* | **DNS only (grey)** — must not be proxied |
| `api` | CNAME | tunnel target | Proxied (orange), unchanged |

Grey-clouding `stream` is the entire point. Orange-clouding it puts video back on
Cloudflare and reintroduces the ToS exposure.

Move the tunnel by copying `~/.cloudflared/` to the VM and running
`cloudflared service install`, so `api.spiflix.online` keeps working with no DNS
change at all.

## 5. Verify

```bash
# TLS issued and the stream host answers
curl -sI https://stream.spiflix.online/api/health | head -3

# Proxy URLs must now carry the stream hostname
curl -s https://api.spiflix.online/v1/movies/550 \
  -H 'User-Agent: Mozilla/5.0' | grep -o 'https://stream.spiflix.online' | head -1

# Survives a reboot (the original problem)
sudo reboot   # then re-check both endpoints
```

Confirm playback in the browser before retiring the laptop process — a working
`/api/health` proved nothing useful the last two times something broke.

## 6. Then turn off the laptop path

Only after the above passes: stop the Mac's `node dist/server.js`. Keep it
runnable as a fallback until Oracle has a few days of clean uptime.
