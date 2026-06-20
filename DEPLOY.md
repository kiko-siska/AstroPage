# Deployment Guide — RPI5 Home Server

This guide covers the one-time setup needed to get AstroPage running at
`https://astropage.onboard.academy` with automatic deploys on every push to `main`.

---

## Architecture

```
Internet
  │
  ▼ ports 80 + 443
Router (NAT)
  │
  ▼
RPI5  ─────────────────────────────────────────────────────────────
  │
  ├── Caddy (80/443)           ← TLS termination, auto Let's Encrypt cert
  │     └── proxy → frontend:80
  │
  ├── frontend nginx (internal) ← serves React SPA, proxies /api/ to backend
  │     └── proxy /api/ → backend:8000
  │
  ├── backend FastAPI (127.0.0.1:8000 only)
  │     └── reads/writes → db:5432
  │
  └── db Postgres (127.0.0.1:5432 only)
```

The backend and database are **not** reachable from the network — only from
the RPI5 itself. Caddy is the only service with public ports.

---

## Part 1 — DNS

1. Log in to wherever `onboard.academy` is managed (Cloudflare, Namecheap, etc.).
2. Add an **A record**:
   - Name: `astropage`
   - Value: your home router's public IP (check `curl ifconfig.me` on the RPI5)
   - TTL: 300 (short so you can change it quickly)
3. If your ISP gives you a dynamic IP, set up a DDNS updater (see Part 4).

> **Cloudflare users:** leave the proxy (orange cloud) **OFF** (grey cloud /
> DNS only). Caddy needs to reach port 80 directly for the ACME HTTP challenge
> to issue its Let's Encrypt cert. You can enable the proxy later after the
> first cert is issued — but it's simpler to leave it off.

---

## Part 2 — Router

Forward two ports from the router to the RPI5's **LAN IP** (e.g. `192.168.1.50`):

| External port | Internal port | Protocol |
|---|---|---|
| 80 | 80 | TCP |
| 443 | 443 | TCP + UDP |

Find the RPI5's LAN IP with `hostname -I` on the RPI5. Set a **static DHCP
lease** for it in the router so the IP never changes.

---

## Part 3 — RPI5 one-time setup

SSH into the RPI5 and run these steps once.

### 3.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in so the group takes effect
```

### 3.2 Clone the repo

```bash
sudo mkdir -p /opt/astropage
sudo chown $USER:$USER /opt/astropage
git clone https://github.com/KikoSiska/AstroPage.git /opt/astropage
```

### 3.3 Create production `.env`

```bash
cd /opt/astropage
cp backend/.env.example backend/.env
nano backend/.env
```

Set these values (everything else can stay at the default for now):

```env
APP_ENV=production
APP_DEBUG=false

# Generate: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=<64-char hex>
JWT_SECRET=<64-char hex>

# Generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY=<fernet key>

DATABASE_URL=postgresql+asyncpg://astropage:<strong-password>@db:5432/astropage

FRONTEND_ORIGIN=https://astropage.onboard.academy

GEMINI_API_KEY=<your Gemini API key>
```

Also create a root `.env` for compose Postgres credentials:

```bash
cat > /opt/astropage/.env <<'EOF'
POSTGRES_USER=astropage
POSTGRES_PASSWORD=<same strong password as above>
POSTGRES_DB=astropage
EOF
```

### 3.4 First-time stack start

```bash
cd /opt/astropage
docker compose up -d --build
```

Watch Caddy obtain its TLS cert (takes ~10 seconds):

```bash
docker compose logs -f caddy
```

You should see `certificate obtained successfully` in the logs. Then visit
`https://astropage.onboard.academy` — you should get the login page.

---

## Part 4 — GitHub Actions self-hosted runner

The runner is what makes `git push → auto-deploy` work. It runs on the RPI5
and polls GitHub for jobs — no inbound ports required.

### 4.1 Register the runner

1. Go to your GitHub repo → **Settings → Actions → Runners → New self-hosted runner**
2. Select **Linux / ARM64** (RPI5 is ARM64)
3. Copy the download and configure commands GitHub shows you
4. Run them on the RPI5:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# Paste the curl download command from GitHub (it will look like this):
curl -o actions-runner-linux-arm64-<version>.tar.gz -L https://github.com/actions/runner/releases/download/...
tar xzf actions-runner-linux-arm64-*.tar.gz
./config.sh --url https://github.com/KikoSiska/AstroPage --token <token-from-github>
```

When asked for labels, enter: `astropage`

### 4.2 Run as a service (survives reboots)

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status   # should show: active (running)
```

### 4.3 Verify the runner appears in GitHub

Go to **Settings → Actions → Runners** — the runner should show as **Idle**.

---

## Part 5 — Dynamic IP (if your ISP doesn't give a static IP)

If your public IP changes, the DNS A record stops working. Fix this with a
DDNS updater that patches the record automatically.

### Option A — ddclient (works with Cloudflare, DuckDNS, etc.)

```bash
sudo apt install ddclient
sudo nano /etc/ddclient.conf
```

For Cloudflare:
```
daemon=300
ssl=yes
use=web, web=checkip.dyndns.com
protocol=cloudflare
login=<your-cloudflare-email>
password=<cloudflare-api-token>
zone=onboard.academy
astropage.onboard.academy
```

```bash
sudo systemctl enable ddclient
sudo systemctl start ddclient
```

### Option B — Cloudflare Tunnel (no port forwarding needed)

If port forwarding isn't an option (carrier-grade NAT, etc.), use a
**Cloudflare Tunnel** instead. This replaces Caddy and the router setup:

```bash
# On RPI5
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create astropage
cloudflared tunnel route dns astropage astropage.onboard.academy
```

Then remove the Caddy service from `docker-compose.yml` and replace it with
`cloudflared` pointing at `http://frontend:80`.

---

## Part 6 — Branch protection (recommended)

To prevent CI failures from reaching production:

1. Go to **Settings → Branches → Add rule** for `main`
2. Enable **Require status checks to pass before merging**
3. Select the `Lint & Test` check from CI
4. Enable **Require branches to be up to date**

The CD workflow is already wired to only deploy if CI passed (via `workflow_run`).

---

## Routine operations

### Redeploy manually
Go to **Actions → CD → Run workflow** and click the green button.

### View live logs
```bash
ssh rpi5
cd /opt/astropage
docker compose logs -f          # all services
docker compose logs -f backend  # just the API
```

### Update secrets
```bash
ssh rpi5
nano /opt/astropage/backend/.env
cd /opt/astropage && docker compose up -d backend  # restart backend only
```

### Renew TLS cert
Caddy renews automatically 30 days before expiry. Nothing to do.

### Access the database
The DB has no host port — connect via exec:
```bash
docker compose exec db psql -U astropage
```

### Back up the database
```bash
docker compose exec db pg_dump -U astropage astropage > backup.sql
```
