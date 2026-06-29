# Multi-Platform Deployment — Implementation Summary

> Full step-by-step instructions live in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.
> This file records *what* was built and *why*.

## The correction that drove this design

The original brief assumed Railway + Koyeb + Fly.io + Render are all free with no
card. Verified against 2026 pricing, that is false and kept shrinking during the
work:

- **Fly.io** — free tier removed (Oct 2024); card + pay-as-you-go.
- **Koyeb** — free Starter tier removed for new users after the Mistral AI
  acquisition (Feb 2026); now card + $29/mo Pro.
- **Railway** — no always-on free plan; ~$5 / 30-day **no-card trial**, then the
  Free plan ($1/mo usage) stops the container.
- **Render** — still free forever, but sleeps after 15 min.
- **Oracle "Always Free"** — free forever and never sleeps, but needs a card once
  for identity (never charged).

**Under a strict no-card rule, only Render (durable) + Railway (trial) remain.**
The user chose to avoid a card, so the shipped setup is **Railway + Render behind
the Cloudflare Worker, Socket.io → Railway**. Oracle (one-time card, the only
durable always-on free option) and Koyeb/Fly (paid) are documented as appendices.

## Final architecture

```
Frontend (Vercel)
  VITE_API_URL    → Cloudflare Worker → Railway → Render   (REST, failover)
  VITE_SOCKET_URL → Railway (direct, WSS)                  (Socket.io)
```

Known trade-off: no durable no-card always-on host exists in 2026, so when
Railway's trial ends Socket.io can drop until Railway is up (REST still fails
over to Render). Fixing that needs Railway Hobby ($5/mo) or Oracle (card once).

## Files

| File | Status | Purpose |
|---|---|---|
| `worker.js` | rewritten | Failover load balancer (Railway → Render) |
| `wrangler.toml` | kept | Worker deploy config |
| `railway.json` | primary | Railway (NIXPACKS) config |
| `Dockerfile`, `.dockerignore` | appendix | Koyeb/Fly container (`--omit=dev`) |
| `fly.toml` | appendix | Optional paid Fly.io |
| `render.yaml` | kept | Render service + `PLATFORM_NAME` |
| `server.js` | unchanged logic | `/api/health` returns platform/uptime; `PORT` from env |
| `FrontEnd/src/services/socket.js` | fixed | Now prefers `VITE_SOCKET_URL` |
| `DEPLOYMENT.md` | rewritten | Railway + Render + Worker; Oracle/Koyeb/Fly appendices |

## worker.js — correctness fixes over the first draft

1. **Failover works for POST/PUT/PATCH** — the body is buffered once
   (`request.arrayBuffer()`) and re-sent to each backend. The first draft passed
   `request.body` (a stream), consumed on the first attempt, so retries sent an
   empty body.
2. **Fails over on 5xx**, not just network errors.
3. **Longer timeout (30 s) for the last backend** so a cold free instance can wake.
4. **Module format** (`export default { fetch }`) with a runtime `BACKENDS`
   override (JSON env) so platforms can be reordered without code edits.
5. CORS preflight handled by the Worker; WebSocket rejected; `X-Served-By` on
   every path.

## The change that actually makes it work

`socket.js` previously derived the socket URL from `VITE_API_URL`. With
`VITE_API_URL` pointing at the Worker, Socket.io would have tried to connect
*through the Worker* (which can't proxy WebSocket) and silently broken. It now
prefers `VITE_SOCKET_URL`, so Socket.io reaches Railway directly.
