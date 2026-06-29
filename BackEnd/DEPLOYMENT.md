# Multi-Platform Backend Deployment — Free & No-Card (2026)

Deploy the **identical** Node.js backend to more than one free host and route
REST traffic through a single Cloudflare Worker that automatically fails over
between them. Socket.io connects directly to the most-available host. The
frontend points at two permanent URLs and never changes again.

---

## ⚠️ Read first — the 2026 no-card free reality

The original brief assumed Railway + Koyeb + Fly.io + Render are all free with no
card. Verified against each platform's current pricing, that is **no longer
true**, and it keeps shrinking:

| Platform | No-card free in 2026? | Always-on? | Notes |
|---|---|---|---|
| **Render** | ✅ free forever | ❌ sleeps after 15 min | The durable anchor |
| **Railway** | ⏳ trial only (~$5 / 30 days, no card) | ⚠️ on during trial, then **stops** | Best while trial lasts |
| Koyeb | ❌ card + $29/mo (Mistral acquisition, Feb 2026) | — | Was free; not anymore |
| Fly.io | ❌ card, free tier removed Oct 2024 | — | Paid only |
| Oracle "Always Free" | ❌ card once (then free forever) | ✅ never sleeps | Best *durable* free if you accept a one-time card |
| **Cloudflare Workers** | ✅ free 100k req/day | ✅ serverless | The load balancer |

**Honest conclusion:** with a strict **no-card** rule, the only genuinely free
hosts left are **Render** (permanent) and **Railway** (a ~30-day no-card trial).
This guide deploys both behind the Worker, with Socket.io on Railway.

> **The catch you must know:** when Railway's trial credit runs out (~30 days),
> its Free plan ($1/mo of usage) will stop the container partway through each
> month. REST keeps working because the Worker fails over to Render, but
> **Socket.io (pointed at Railway) will drop** until Railway is up again. To make
> this durable you eventually need either Railway Hobby ($5/mo) **or** the
> one-time-card Oracle Always Free option (Appendix A). There is no durable,
> no-card, always-on free host in 2026.

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
                        │ try in order; 5xx/timeout → next
              ┌─────────┴──────────┐                  │
              ▼                    ▼                  ▼
        ┌──────────┐         ┌──────────┐       ┌──────────┐
        │ Railway  │         │  Render  │       │ Railway  │
        │ (trial)  │         │ (sleeps) │       │ (trial)  │
        └──────────┘         └──────────┘       └──────────┘
        REST #1               REST #2            Socket.io
```

Socket.io bypasses the Worker because **Cloudflare Workers can't proxy the
WebSocket `Upgrade`.** It connects straight to Railway via `VITE_SOCKET_URL`
(Railway serves real TLS on its `*.up.railway.app` domain, so `wss://` works
out of the box — no extra TLS setup needed).

---

## What's already done in the code

- `server.js` — `PORT` from `process.env.PORT` ✅; `/api/health` returns
  `{ status, platform: process.env.PLATFORM_NAME, uptime }` ✅
- `socket.js` — prefers `VITE_SOCKET_URL` (so Socket.io skips the Worker);
  falls back to the old behaviour if unset
- `worker.js` — failover Worker (buffers the body so retries work, fails over on
  5xx/timeout, longer timeout for the last/cold backend, CORS preflight, rejects
  WebSocket, adds `X-Served-By`)
- `Dockerfile`, `.dockerignore`, `wrangler.toml`, `railway.json` — deploy configs
- `fly.toml` — kept for the optional paid path (Appendix B)

You only need to **deploy** and set env vars.

---

## Prerequisites

- The GitHub repo (already connected). Both hosts pull the same repo/branch.
- Your MongoDB Atlas connection string and all secrets from `BackEnd/.env.example`.
- Accounts (free): [Railway](https://railway.app), [Render](https://render.com)
  (exists), [Cloudflare](https://workers.cloudflare.com).

---

## Step 0 — Commit the deployment files

```bash
cd /path/to/React-SkillSwap-fully-fledged
git add BackEnd/Dockerfile BackEnd/.dockerignore BackEnd/worker.js \
        BackEnd/wrangler.toml BackEnd/railway.json BackEnd/fly.toml \
        BackEnd/render.yaml BackEnd/server.js FrontEnd/src/services/socket.js
git add -f BackEnd/DEPLOYMENT.md BackEnd/IMPLEMENTATION_SUMMARY.md   # repo gitignores *.md
git commit -m "feat: Railway + Render failover deployment with Cloudflare Worker"
git push origin main
```

---

## Step 1 — Railway (no-card trial; REST #1 + Socket.io host)

### 1.1 Create the project
1. https://railway.app/dashboard → **New Project → Deploy from GitHub repo**.
2. Pick the `Orbit` (React-SkillSwap) repo. Start the free trial when prompted —
   **no credit card is required for the trial.**

### 1.2 Point it at the backend folder
1. Open the service → **Settings**.
2. **Root Directory:** `BackEnd` → Save. (Railway then reads `BackEnd/railway.json`.)

### 1.3 Environment variables
**Variables** tab → add (fill in real values from your existing Render env):
```
NODE_ENV=production
PORT=8000
PLATFORM_NAME=railway
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

### 1.4 Generate the public URL
1. **Settings → Networking → Generate Domain**.
2. Copy it (e.g. `https://orbit-backend-production.up.railway.app`).
   This is both the Worker's **Railway** entry and your **`VITE_SOCKET_URL`**.

### 1.5 Verify
```bash
curl https://YOUR-railway-url.up.railway.app/api/health
# {"status":"ok","platform":"railway","uptime":...}
```

---

## Step 2 — Render (free forever; REST #2)

Your existing Render service just needs one env var:
1. https://dashboard.render.com → backend service → **Environment**.
2. Add `PLATFORM_NAME=render` → **Save** (auto-redeploys).
```bash
curl https://skillswap-backend-mb4k.onrender.com/api/health   # platform: render
```

---

## Step 3 — Cloudflare Worker (the load balancer)

### 3.1 Put your real URLs in `worker.js`
Edit `BackEnd/worker.js` → `DEFAULT_BACKENDS` (most-available first):
```javascript
const DEFAULT_BACKENDS = [
  { name: 'Railway', url: 'https://YOUR-railway-url.up.railway.app' },
  { name: 'Render',  url: 'https://skillswap-backend-mb4k.onrender.com' },
];
```
> Or leave the code and set a `BACKENDS` var (JSON array) in `wrangler.toml`
> `[vars]` — the Worker reads it at runtime.

### 3.2 Deploy
```bash
npm install -g wrangler
cd BackEnd
wrangler login
wrangler deploy
```
You'll get `https://orbit-backend-lb.YOURNAME.workers.dev`.

### 3.3 Verify proxy + failover
```bash
curl -i https://orbit-backend-lb.YOURNAME.workers.dev/api/health | grep -i x-served-by
# X-Served-By: Railway
```
Stop the Railway service (dashboard → pause) and curl again → `X-Served-By: Render`.

---

## Step 4 — Frontend env vars on Vercel (the only two, forever)

Vercel → project → **Settings → Environment Variables**:
```
VITE_API_URL    = https://orbit-backend-lb.YOURNAME.workers.dev/api
VITE_SOCKET_URL = https://YOUR-railway-url.up.railway.app
```
- `VITE_API_URL` → the **Worker** (note the trailing `/api`).
- `VITE_SOCKET_URL` → **Railway directly** (no `/api`) — the Socket.io target.

Redeploy the frontend:
```bash
cd FrontEnd && git commit --allow-empty -m "chore: point frontend at Worker + Railway socket" && git push
```
(or Vercel → Deployments → Redeploy).

---

## Step 5 — End-to-end verification

```bash
# Each backend healthy with the right platform field
curl https://YOUR-railway-url.up.railway.app/api/health        # railway
curl https://skillswap-backend-mb4k.onrender.com/api/health    # render

# Worker proxies + reports who served it
curl -i https://orbit-backend-lb.YOURNAME.workers.dev/api/health | grep -i x-served-by

# CORS preflight answered by the Worker (204 + CORS headers)
curl -i -X OPTIONS \
  -H "Origin: https://react-skill-swap-fully-fledged.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  https://orbit-backend-lb.YOURNAME.workers.dev/api/auth/login
```

In the browser (logged-in frontend, DevTools):
- Console shows `Socket connected: <id>`.
- Network → WS → the WebSocket is to **Railway**, not the Worker.
- Failover test: pause Railway → REST keeps working via Render (Socket.io
  reconnects when Railway returns).

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Worker `503 All backend services unavailable` | Both backends down/5xx. `curl` each `/api/health`; usual culprit is a bad `MONGO_URI` on one host. |
| Socket.io connects to the Worker (fails) | `VITE_SOCKET_URL` not set, or frontend not redeployed. It must be the Railway URL. |
| CORS error in browser | Confirm the Vercel origin is in the Worker `ALLOWED_ORIGINS` **and** `server.js` `allowedOrigins`. |
| Railway stops mid-month | Trial credit exhausted → see the box at the top. Add Railway Hobby ($5/mo) or switch the always-on host to Oracle (Appendix A). |
| Render slow first hit | Cold start from 15-min sleep — expected. The Worker's 30 s last-backend timeout lets it wake; the keep-warm self-ping in `server.js` reduces it. |

---

## Cost

| Item | Cost |
|---|---|
| Render free instance | $0 forever |
| Railway trial | $0 for ~30 days (no card), then $1/mo Free (stops) or $5/mo Hobby |
| Cloudflare Worker | $0 (100k req/day) |
| **Total (first ~30 days)** | **$0, no card** |

---

## Appendix A — Durable always-on for free: Oracle Cloud (one-time card)

The only way to get a **free-forever, never-sleeping** backend is Oracle Cloud
"Always Free." It asks for a card **once** for identity verification; Always Free
resources are never billed. If you later accept that, it's the best Socket.io
host. Outline:

1. Create an Always Free VM (Ubuntu 22.04, shape `VM.Standard.A1.Flex` ARM, or
   `E2.1.Micro` if ARM capacity is out).
2. Open ports 80/443 in **both** the VCN Security List **and** the instance
   `iptables` (Oracle's classic double-firewall):
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. Install Node + PM2, clone the repo, `npm ci --omit=dev`, create `.env`
   (`PLATFORM_NAME=oracle`), `pm2 start npm --name orbit -- start && pm2 save && pm2 startup`.
4. Free hostname + auto-HTTPS: point a [DuckDNS](https://www.duckdns.org)
   subdomain at the VM IP, install Caddy with a one-line Caddyfile
   (`yourname.duckdns.org { reverse_proxy localhost:8000 }`) — it auto-issues TLS
   and proxies WebSocket.
5. Set `VITE_SOCKET_URL` to the DuckDNS URL and add Oracle as the first entry in
   the Worker's `DEFAULT_BACKENDS`.

---

## Appendix B — Optional paid platforms (Koyeb / Fly.io / Railway Hobby)

- **Koyeb** (`Dockerfile`): no longer free for new users (card + $29/mo Pro after
  the Mistral acquisition). Builder = Dockerfile, path `BackEnd/Dockerfile`,
  port 8000, `PLATFORM_NAME=koyeb`.
- **Fly.io** (`fly.toml`): no free tier; pay-as-you-go + card. `fly launch
  --no-deploy`, `fly secrets set ...` (`PLATFORM_NAME=fly.io`), `fly deploy`.
- **Railway Hobby** ($5/mo): the simplest way to make the Railway backend above
  durable/always-on.

To add any of these, append it to `DEFAULT_BACKENDS` in `worker.js` and redeploy
the Worker.
