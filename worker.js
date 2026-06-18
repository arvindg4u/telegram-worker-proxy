/**
 * Rotating Proxy Worker for HuggingClaw — bypasses HF Spaces outbound blocks
 * 
 * Supported modes:
 *   1. /telegram/* — proxies to api.telegram.org
 *   2. /opencode/* — proxies to opencode.ai/zen
 *   3. x-target-host header — proxies to any target domain
 *   4. /health — health check endpoint
 * 
 * VERSION: __VERSION__
 * DEPLOYED: __DEPLOY_TIME__
 */

const TELEGRAM_API = "api.telegram.org";
const UPSTREAM_TIMEOUT = 28000; // 28s — safe under Worker's 30s limit

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
    const tgPath = path.replace("/telegram", "");
    targetUrl = `https://${TELEGRAM_API}${tgPath}${url.search}`;
  } else if (path.startsWith("/opencode/")) {
    const ocPath = path.replace("/opencode", "");
    targetUrl = `https://opencode.ai${ocPath}${url.search}`;
  } else if (targetHost) {
    url.hostname = targetHost;
    targetUrl = url.toString();
  } else {
    return new Response(JSON.stringify({ 
      error: "Use /telegram/*, /opencode/*, or set x-target-host header",
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

  if (path.startsWith("/telegram/")) {
    headers.set("Host", TELEGRAM_API);
  } else if (path.startsWith("/opencode/")) {
    headers.set("Host", "opencode.ai");
  }

  const newReq = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
  });

  // ── Forward with timeout (graceful for long-poll getUpdates) ──
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

  try {
    const response = await fetch(newReq, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    // For getUpdates timeout, return empty result (Telegram API valid response)
    if (path.includes("/getUpdates")) {
      return new Response(JSON.stringify({ ok: true, result: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-proxy-version": "__VERSION__",
          "x-proxy-deployed": "__DEPLOY_TIME__",
        },
      });
    }
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
