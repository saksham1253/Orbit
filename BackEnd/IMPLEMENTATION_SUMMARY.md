# Multi-Platform Deployment — Implementation Summary

> Full step-by-step instructions live in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.
> This file records *what* was built and *why* (the design decisions and the
> correction to the original "four free platforms" assumption).

## The correction that drove this design

The original brief assumed Railway + Koyeb + Fly.io + Render are all free with no
card. Verified against each platform's 2026 pricing, that is false:

- **Fly.io** removed its free tier (Oct 2024) — card + pay-as-you-go only.
- **Railway** has no always-on free plan — $5 one-time trial, then a $1/mo Free
  plan that *stops* your container, or $5/mo Hobby (card).
- **Koyeb** is still free but **scales to zero** after 1 h idle.
- **Render** is still free but **sleeps** after 15 min.

So no PaaS free tier is always-on — a problem, because **Socket.io needs a
persistent WebSocket server**. The fix: **Oracle Cloud "Always Free"**, the only
free-forever, never-sleeping host (a real VM). It anchors Socket.io and is the
first REST backend.

## Final architecture

```
Frontend (Vercel)
  VITE_API_URL    → Cloudflare Worker → Oracle → Koyeb → Render  (REST, failover)
  VITE_SOCKET_URL → Oracle (direct, WSS via Caddy)               (Socket.io)
```

## Files

| File | Status | Purpose |
|---|---|---|
| `worker.js` | rewritten | Failover load balancer (see fixes below) |
| `wrangler.toml` | kept | Worker deploy config |
| `Dockerfile`, `.dockerignore` | kept (Dockerfile fixed) | Koyeb container; `--omit=dev` |
| `render.yaml` | kept | Render service + `PLATFORM_NAME` |
| `fly.toml`, `railway.json` | kept (optional/paid) | Only for the paid appendix |
| `server.js` | unchanged logic | `/api/health` already returns platform/uptime; `PORT` from env |
| `FrontEnd/src/services/socket.js` | fixed | Now prefers `VITE_SOCKET_URL` |
| `DEPLOYMENT.md` | rewritten | Oracle + Koyeb + Render + Worker, full VM setup |

## worker.js — correctness fixes over the first draft

1. **Failover now works for POST/PUT/PATCH.** The body is buffered once
   (`request.arrayBuffer()`) and re-sent to each backend. The first draft passed
   `request.body` (a stream) which is consumed on the first attempt, so retries
   sent an empty body.
2. **Fails over on 5xx**, not just network errors — a backend that's up but
   unhealthy (DB down, cold-start 502) is skipped; the last 5xx is returned only
   if everyone fails.
3. **Longer timeout for the last backend** (30 s vs 8 s) so a cold-starting free
   instance can wake instead of being abandoned.
4. **Module format** (`export default { fetch }`) — current Workers standard;
   supports a runtime `BACKENDS` env override (JSON) so you don't edit code.
5. CORS preflight answered by the Worker; WebSocket upgrades rejected with a
   clear message; `X-Served-By` on every path (including 503).

## The change that actually makes it work

`socket.js` previously derived the socket URL from `VITE_API_URL`. With
`VITE_API_URL` pointing at the Worker, Socket.io would have tried to connect
*through the Worker* (which can't proxy WebSocket) and silently broken. It now
prefers `VITE_SOCKET_URL`, so Socket.io reaches Oracle directly.

## Zero recurring cost

Oracle Always Free + Koyeb + Render + Cloudflare Worker + DuckDNS/Caddy = **$0/mo**
(Oracle asks for a card once for identity; Always Free resources are never
billed). Railway/Fly are documented as optional paid extras.
