# Multi-Platform Backend Deployment — Resilient & Free (2026)

Deploy the **identical** Node.js backend to multiple free hosts and route REST
traffic through a single Cloudflare Worker that automatically fails over between
them. Socket.io connects directly to an always-on host. The frontend points at
two permanent URLs forever and never has to change again.

---

## ⚠️ Read first — the 2026 free-tier reality

The original plan assumed Railway + Koyeb + Fly.io + Render are all "free, no
card." **That is no longer true:**

| Platform | Free in 2026? | Always-on? | Card? | Verdict |
|---|---|---|---|---|
| **Render** | ✅ permanent free | ❌ sleeps after 15 min | No | Keep — REST backend |
| **Koyeb** | ✅ free (1 web service, 512 MB / 0.1 vCPU) | ❌ scales to zero after 1 h | Usually no | Keep — REST backend |
| **Oracle Cloud "Always Free"** | ✅ free **forever** | ✅ **never sleeps** | Card once (identity only, never charged) | **Add — Socket.io host + REST #1** |
| **Railway** | ⚠️ $5 one-time trial, then $1/mo Free (container stops) / $5/mo Hobby | ❌ free can't stay on | Card for Hobby | Optional (paid) |
| **Fly.io** | ❌ **free tier removed Oct 2024** | — | Card required | Optional (paid) |
| **Cloudflare Workers** | ✅ free 100k req/day | ✅ serverless | No | Load balancer |

**Conclusion:** the best *genuinely free* resilient setup is **Oracle Always
Free + Koyeb + Render**, balanced by a **Cloudflare Worker**. Oracle is the only
free-forever host that never sleeps, so it anchors Socket.io. Railway/Fly are
documented at the end as optional paid add-ons.

---

## Architecture

```
                       Frontend (Vercel)
        VITE_API_URL ──┐                 └── VITE_SOCKET_URL
                       │                              │
              REST (failover)                Socket.io (direct, WSS)
                       ▼                              │
            ┌───────────────────────┐                │
            │  Cloudflare Worker     │                │
            │  (load balancer)       │                │
            └───────────┬───────────┘                │
                        │ try in order, 5xx/timeout → next
        ┌───────────────┼────────────────┐           │
        ▼               ▼                ▼           ▼
   ┌─────────┐    ┌──────────┐     ┌──────────┐  ┌──────────┐
   │ Oracle  │    │  Koyeb   │     │  Render  │  │  Oracle  │
   │ (on)    │    │ (sleeps) │     │ (sleeps) │  │  (on)    │
   └─────────┘    └──────────┘     └──────────┘  └──────────┘
   REST #1         REST #2          REST #3       Socket.io
```

Why Socket.io bypasses the Worker: **Cloudflare Workers cannot proxy the
WebSocket `Upgrade`.** Socket.io therefore connects straight to Oracle (always
on, real TLS via Caddy), using the new `VITE_SOCKET_URL`.

---

## What's already done in the code

- `server.js` — `PORT` uses `process.env.PORT` ✅, `/api/health` returns
  `{ status, platform: process.env.PLATFORM_NAME, uptime }` ✅
- `socket.js` — now prefers `VITE_SOCKET_URL` (the change that lets Socket.io
  skip the Worker). Falls back to the old behaviour if unset.
- `worker.js` — failover Worker (buffers the body so retries work, fails over on
  5xx/timeout, longer timeout for the last/cold backend, CORS preflight, rejects
  WebSocket, `X-Served-By`).
- `Dockerfile`, `.dockerignore` — production container (used by Koyeb).
- `wrangler.toml` — Worker deploy config.
- `fly.toml`, `railway.json` — kept for the **optional paid** appendix only.

You only need to **deploy** and set env vars. No further code changes required.

---

## Prerequisites

- The GitHub repo (already connected). All hosts pull the same repo/branch.
- Your MongoDB Atlas connection string and all secrets from `BackEnd/.env.example`.
- Accounts (all free): [Oracle Cloud](https://www.oracle.com/cloud/free/),
  [Koyeb](https://www.koyeb.com), [Render](https://render.com) (exists),
  [Cloudflare](https://workers.cloudflare.com), [DuckDNS](https://www.duckdns.org)
  (free hostname for Oracle's TLS).

---

## Step 0 — Commit the deployment files

```bash
cd /path/to/React-SkillSwap-fully-fledged
git add BackEnd/Dockerfile BackEnd/.dockerignore BackEnd/worker.js \
        BackEnd/wrangler.toml BackEnd/fly.toml BackEnd/railway.json \
        BackEnd/render.yaml BackEnd/DEPLOYMENT.md BackEnd/server.js \
        FrontEnd/src/services/socket.js
git commit -m "feat: multi-platform failover deployment (Oracle + Koyeb + Render + Worker)"
git push origin main
```

---

## Step 1 — Oracle Cloud Always Free VM (the always-on anchor)

This is the most steps, but it gives you a **free-forever, never-sleeping**
server — the thing no PaaS free tier provides.

### 1.1 Create the instance
1. Sign up at https://www.oracle.com/cloud/free/ (a card is required for identity
   verification; **Always Free** resources are never billed — confirm your shapes
   show the green "Always Free-eligible" tag).
2. Console → **Compute → Instances → Create Instance**.
3. **Image:** Canonical Ubuntu 22.04. **Shape:** `VM.Standard.A1.Flex`
   (Ampere ARM — Always Free up to 4 OCPU / 24 GB). If ARM shows "out of
   capacity," use `VM.Standard.E2.1.Micro` (AMD, Always Free).
4. Add your SSH public key (or let it generate one — download it).
5. Under **Networking**, keep "Assign a public IPv4 address" = Yes. Create.
6. Note the **Public IP address**.

### 1.2 Open the firewall (two layers — both required)
**a) VCN Security List (cloud firewall):** Console → **Networking → Virtual
Cloud Networks →** your VCN **→ Security Lists →** default **→ Add Ingress
Rules**. Add two rules, source `0.0.0.0/0`, IP Protocol TCP, destination ports
**80** and **443**.

**b) Instance firewall (Ubuntu ships with iptables blocking everything but 22 —
the classic Oracle gotcha):**
```bash
ssh ubuntu@YOUR_PUBLIC_IP
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 1.3 Install Node, git, PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2
node -v   # should print v22.x
```

### 1.4 Clone the repo and install
```bash
git clone https://github.com/saksham1253/Orbit.git
cd Orbit/BackEnd
npm ci --omit=dev
```

### 1.5 Create the `.env` (all secrets — never committed)
```bash
nano .env
```
Paste (fill in real values from your existing Render env / `.env.example`):
```
NODE_ENV=production
PORT=8000
PLATFORM_NAME=oracle
MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/skillswap
JWT_SECRET=...
CORS_ORIGIN=https://react-skill-swap-fully-fledged.vercel.app
ADMIN_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
HUGGINGFACE_API_KEY=...
GROQ_API_KEY=...
```

### 1.6 Run it under PM2 (auto-restart + boot persistence)
```bash
pm2 start npm --name orbit -- start
pm2 save
pm2 startup systemd     # run the exact command it prints
curl http://localhost:8000/api/health
# {"status":"ok","platform":"oracle","uptime":...}
```

### 1.7 Free hostname + automatic HTTPS (required for WSS)
The Vercel frontend is HTTPS, so Socket.io needs `wss://` → Oracle needs a real
TLS cert → which needs a hostname. Use DuckDNS (free) + Caddy (auto Let's
Encrypt, and it proxies WebSocket out of the box).

**DuckDNS:** sign in at https://www.duckdns.org, create a subdomain e.g.
`orbit-yourname`, set its IP to your VM's public IP. Your host is now
`orbit-yourname.duckdns.org`.

**Caddy:**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
echo 'orbit-yourname.duckdns.org {
    reverse_proxy localhost:8000
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Verify (TLS auto-provisions in ~30 s):
```bash
curl https://orbit-yourname.duckdns.org/api/health
# {"status":"ok","platform":"oracle","uptime":...}
```
This URL is your **`VITE_SOCKET_URL`** and Oracle entry in the Worker.

---

## Step 2 — Koyeb (free REST backend, Docker)

1. https://app.koyeb.com → **Create Web Service → GitHub** → pick the repo/branch.
2. **Builder:** Dockerfile. **Dockerfile location:** `BackEnd/Dockerfile`.
   **Work directory / context:** `BackEnd`.
3. **Instance:** Free. **Region:** Washington or Frankfurt. **Port:** `8000`.
4. **Health check:** HTTP path `/api/health`.
5. **Environment variables:** same as Step 1.5 but `PLATFORM_NAME=koyeb`.
6. Deploy, then copy the URL (e.g. `https://orbit-backend-xxxx.koyeb.app`).
```bash
curl https://orbit-backend-xxxx.koyeb.app/api/health   # platform: koyeb
```
> Koyeb free scales to zero after 1 h idle — expected. The Worker skips it while
> it's cold and it wakes on the next hit.

---

## Step 3 — Render (existing free backend)

1. https://dashboard.render.com → your backend service → **Environment**.
2. Add `PLATFORM_NAME=render` → **Save** (auto-redeploys).
```bash
curl https://skillswap-backend-mb4k.onrender.com/api/health   # platform: render
```

---

## Step 4 — Cloudflare Worker (the load balancer)

### 4.1 Put your real backend URLs in `worker.js`
Edit `BackEnd/worker.js` → `DEFAULT_BACKENDS` (always-on first):
```javascript
const DEFAULT_BACKENDS = [
  { name: 'Oracle', url: 'https://orbit-yourname.duckdns.org' },
  { name: 'Koyeb',  url: 'https://orbit-backend-xxxx.koyeb.app' },
  { name: 'Render', url: 'https://skillswap-backend-mb4k.onrender.com' },
];
```
> Alternatively leave the code alone and set a `BACKENDS` var (JSON array) in
> `wrangler.toml` `[vars]` — the Worker reads it at runtime.

### 4.2 Deploy
```bash
npm install -g wrangler
cd BackEnd
wrangler login
wrangler deploy
```
You'll get `https://orbit-backend-lb.YOURNAME.workers.dev`.

### 4.3 Verify proxy + failover
```bash
curl -i https://orbit-backend-lb.YOURNAME.workers.dev/api/health | grep -i x-served-by
# X-Served-By: Oracle
```
Stop the Oracle app (`pm2 stop orbit`) and curl again → `X-Served-By: Koyeb`.
Restart it (`pm2 start orbit`).

---

## Step 5 — Frontend env vars on Vercel (the only two changes, forever)

Vercel → project → **Settings → Environment Variables**:
```
VITE_API_URL    = https://orbit-backend-lb.YOURNAME.workers.dev/api
VITE_SOCKET_URL = https://orbit-yourname.duckdns.org
```
- `VITE_API_URL` → the **Worker** (note the trailing `/api`).
- `VITE_SOCKET_URL` → **Oracle directly** (no `/api`) — Socket.io target.

Redeploy the frontend:
```bash
cd FrontEnd && git commit --allow-empty -m "chore: point frontend at Worker + Oracle socket" && git push
```
(or Vercel dashboard → Deployments → Redeploy).

---

## Step 6 — End-to-end verification

```bash
# 1. Each backend healthy with the right platform field
curl https://orbit-yourname.duckdns.org/api/health      # oracle
curl https://orbit-backend-xxxx.koyeb.app/api/health    # koyeb
curl https://skillswap-backend-mb4k.onrender.com/api/health  # render

# 2. Worker proxies + reports who served it
curl -i https://orbit-backend-lb.YOURNAME.workers.dev/api/health | grep -i x-served-by

# 3. CORS preflight is answered by the Worker (204 + CORS headers)
curl -i -X OPTIONS \
  -H "Origin: https://react-skill-swap-fully-fledged.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  https://orbit-backend-lb.YOURNAME.workers.dev/api/auth/login
```

In the browser (logged-in frontend, DevTools):
- Console shows `Socket connected: <id>`.
- Network → WS → the WebSocket is to **`orbit-yourname.duckdns.org`**, not the Worker.
- Failover test: `pm2 stop orbit` on Oracle → REST keeps working via Koyeb/Render
  (Socket.io will reconnect when Oracle returns; that's the one trade-off of a
  single always-on host).

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Worker `503 All backend services unavailable` | All backends down or all returned 5xx. `curl` each `/api/health` directly; the usual culprit is a bad `MONGO_URI` on one host. |
| Oracle URL times out | Firewall. Re-check **both** the VCN ingress rules (80/443) and the instance `iptables` rules (Step 1.2). |
| Caddy won't get a cert | DuckDNS subdomain must point at the VM IP and ports 80+443 must be open. `sudo journalctl -u caddy -f`. |
| Socket.io connects to the Worker (fails) | `VITE_SOCKET_URL` not set, or frontend not redeployed after setting it. It must be the Oracle URL. |
| CORS error in browser | Confirm the Vercel origin is in the Worker `ALLOWED_ORIGINS` **and** in `server.js` `allowedOrigins`. |
| Koyeb/Render slow first hit | Cold start from sleep — expected. The Worker's last-backend timeout (30 s) lets a cold instance wake; the keep-warm self-ping in `server.js` reduces it. |

---

## Cost (honest, 2026)

| Item | Cost |
|---|---|
| Oracle Always Free VM | $0 forever (card for identity only) |
| Koyeb free instance | $0 |
| Render free instance | $0 |
| Cloudflare Worker | $0 (100k req/day) |
| DuckDNS + Caddy/Let's Encrypt | $0 |
| **Total** | **$0 / month** |

---

## Appendix — Optional PAID platforms (Railway / Fly.io)

These are **not free** in 2026 but the configs exist if you want more capacity.

**Railway** (`railway.json`): New Project → Deploy from GitHub → Settings → Root
Directory `BackEnd` → add env vars (`PLATFORM_NAME=railway`) → Generate Domain.
Free trial is $5 one-time; staying online needs the $5/mo Hobby plan (card).

**Fly.io** (`fly.toml`): `fly launch --no-deploy` (keep the existing `fly.toml`),
`fly secrets set ...` (`PLATFORM_NAME=fly.io`), `fly deploy`. No free tier —
pay-as-you-go after the short trial; a card is required. Note `fly.toml` sets
`auto_stop_machines = false`, which on pay-as-you-go bills continuously.

To include either, just add it to `DEFAULT_BACKENDS` in `worker.js` and redeploy
the Worker.
