/**
 * Cloudflare Worker — Multi-Backend Load Balancer with Automatic Failover
 *
 * Routes REST API traffic across multiple backend deployments, trying each in
 * order and moving to the next on failure, timeout, or a 5xx response. Returns
 * the first healthy response unchanged (plus an X-Served-By header).
 *
 * Socket.io traffic MUST bypass this Worker entirely (Cloudflare Workers do not
 * proxy WebSocket upgrades) — the frontend connects Socket.io directly to a
 * backend via VITE_SOCKET_URL. See DEPLOYMENT.md.
 *
 * Module ("export default") format — the current Workers standard. Backend URLs
 * can be overridden at deploy time via the BACKENDS env var (JSON array) so you
 * don't have to edit code to reorder/add platforms; otherwise the DEFAULT_
 * BACKENDS below are used.
 */

// Priority order: always-on first, sleepers last. Override at deploy time with
// the BACKENDS env var (a JSON array) so you never have to edit code to add or
// reorder platforms. See DEPLOYMENT.md for the 2026 free-tier reality
// (Railway/Fly.io are no longer free-always-on; Oracle Always Free is).
const DEFAULT_BACKENDS = [
  { name: 'Oracle', url: 'https://orbit.YOURNAME.duckdns.org' }, // always-on free VM
  { name: 'Koyeb',  url: 'https://orbit-backend-yourapp.koyeb.app' }, // free, sleeps ~1h
  { name: 'Render', url: 'https://skillswap-backend-mb4k.onrender.com' }, // free, sleeps ~15m
];

// Per-backend timeout. The LAST backend gets a longer window so a cold-starting
// free instance (e.g. Render waking from its 15-min sleep, ~30-60s) still has a
// chance to answer instead of being abandoned when it's the only one left.
const TIMEOUT_MS = 8000;
const LAST_BACKEND_TIMEOUT_MS = 30000;

const ALLOWED_ORIGINS = [
  'https://react-skill-swap-fully-fledged.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost',       // Android Capacitor (androidScheme: https)
  'capacitor://localhost',   // iOS Capacitor
];

// Hop-by-hop headers must not be forwarded (RFC 7230 §6.1) — they describe a
// single transport hop and break proxying if passed through.
const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

function resolveBackends(env) {
  if (env && env.BACKENDS) {
    try {
      const parsed = JSON.parse(env.BACKENDS);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (_) { /* fall back to defaults on bad JSON */ }
  }
  return DEFAULT_BACKENDS;
}

/**
 * Proxy a single attempt to one backend. The body is passed as an already-
 * buffered ArrayBuffer (NOT request.body) so it can be re-sent to the next
 * backend on failover — a request stream can only be consumed once.
 */
async function tryBackend(backend, request, bodyBuffer, timeoutMs) {
  const url = new URL(request.url);
  const backendUrl = `${backend.url}${url.pathname}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== 'host' && lower !== 'content-length') {
      headers.set(key, value);
    }
  }

  const init = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD' && bodyBuffer && bodyBuffer.byteLength > 0) {
    init.body = bodyBuffer; // ArrayBuffer → fresh body each attempt, no duplex needed
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    init.signal = controller.signal;
    return await fetch(backendUrl, init);
  } finally {
    clearTimeout(timeoutId);
  }
}

function finalizeResponse(response, backendName, corsHeaders) {
  const responseHeaders = new Headers(response.headers);
  for (const h of HOP_BY_HOP_HEADERS) responseHeaders.delete(h);
  for (const [k, v] of Object.entries(corsHeaders)) responseHeaders.set(k, v);
  responseHeaders.set('X-Served-By', backendName);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function handleRequest(request, env) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const backends = resolveBackends(env);

  // Never proxy WebSocket upgrades — Socket.io connects directly to a backend.
  if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    return new Response(
      JSON.stringify({ error: 'WebSocket not supported here. Connect Socket.io directly via VITE_SOCKET_URL.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-Served-By': 'worker', ...corsHeaders } }
    );
  }

  // Buffer the body ONCE so every failover attempt can re-send it.
  let bodyBuffer = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      bodyBuffer = await request.arrayBuffer();
    } catch (_) {
      bodyBuffer = null;
    }
  }

  let lastErrorResponse = null; // a backend that answered but with 5xx

  for (let i = 0; i < backends.length; i++) {
    const backend = backends[i];
    const isLast = i === backends.length - 1;
    const timeoutMs = isLast ? LAST_BACKEND_TIMEOUT_MS : TIMEOUT_MS;
    try {
      const response = await tryBackend(backend, request, bodyBuffer, timeoutMs);

      // A 5xx means the backend is up but unhealthy (DB down, cold-start crash,
      // gateway error) — try the next one, but remember it so we can return a
      // real status if everyone is down rather than a generic 503.
      if (response.status >= 500) {
        lastErrorResponse = finalizeResponse(response, backend.name, corsHeaders);
        continue;
      }
      return finalizeResponse(response, backend.name, corsHeaders);
    } catch (error) {
      // Network error or timeout (incl. AbortError) → try the next backend.
      console.error(`Backend ${backend.name} failed:`, error && error.message);
      continue;
    }
  }

  if (lastErrorResponse) return lastErrorResponse;

  return new Response(
    JSON.stringify({ error: 'All backend services are currently unavailable', tried: backends.map((b) => b.name) }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'X-Served-By': 'none', ...corsHeaders } }
  );
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      // Worker answers CORS preflight itself — never forwarded to a backend.
      return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('Origin')) });
    }
    return handleRequest(request, env);
  },
};
