/**
 * Rotating Proxy Worker for HuggingClaw — bypasses HF Spaces outbound blocks
 * 
 * Supported modes:
 *   1. /telegram/* — proxies to api.telegram.org (used by cloudflare-proxy.js)
 *   2. x-target-host header — proxies to any target domain
 *   3. /health — health check endpoint
 * 
 * VERSION: __VERSION__
 * DEPLOYED: __DEPLOY_TIME__
 */

const TELEGRAM_API = "api.telegram.org";

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Health check ──
  if (path === "/health" || path === "/") {
    return new Response(JSON.stringify({
      status: "ok",
      version: "__VERSION__",
      deployed: "__DEPLOY_TIME__",
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-proxy-version": "__VERSION__",
        "x-proxy-deployed": "__DEPLOY_TIME__",
      },
    });
  }

  // ── Determine target host ──
  let targetHost = request.headers.get("x-target-host");
  let targetUrl;

  if (path.startsWith("/telegram/")) {
    // Mode 1: /telegram/bot<TOKEN>/<method> → api.telegram.org
    const tgPath = path.replace("/telegram", "");
    targetUrl = `https://${TELEGRAM_API}${tgPath}${url.search}`;
  } else if (targetHost) {
    // Mode 2: x-target-host header (legacy)
    url.hostname = targetHost;
    targetUrl = url.toString();
  } else {
    return new Response(JSON.stringify({ 
      error: "Use /telegram/* path or set x-target-host header",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // ── Build forwarding request ──
  const headers = new Headers(request.headers);
  headers.set("x-proxy-version", "__VERSION__");
  headers.set("x-proxy-deployed", "__DEPLOY_TIME__");
  headers.delete("x-target-host");
  headers.delete("x-proxy-key");

  // Preserve original Host for Telegram's validation
  if (targetHost === TELEGRAM_API || path.startsWith("/telegram/")) {
    headers.set("Host", TELEGRAM_API);
  }

  const newReq = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
  });

  // ── Forward with timeout ──
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(newReq, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    return new Response(JSON.stringify({ 
      error: error.message, 
      version: "__VERSION__",
      host: targetHost || TELEGRAM_API,
    }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
