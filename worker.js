/**
 * Telegram & WhatsApp API Proxy for HuggingClaw
 * 
 * Deploy this Worker on Cloudflare and point your HuggingClaw Space's
 * CLOUDFLARE_PROXY_URL to it. This bypasses HuggingFace Spaces'
 * DNS-level blocking of api.telegram.org and WhatsApp domains.
 * 
 * Deploy: Connect this repo to Cloudflare Workers via the dashboard,
 * or copy-paste worker.js into a new Worker.
 */

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // If x-target-host header is set (HuggingClaw sends this), route to that host
  const targetHost = request.headers.get("x-target-host") || "api.telegram.org";
  url.hostname = targetHost;
  
  // Preserve the original path and query
  const newReq = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow"
  });
  
  // Remove proxy-specific headers before forwarding
  newReq.headers.delete("x-target-host");
  newReq.headers.delete("x-proxy-key");
  
  try {
    const response = await fetch(newReq);
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: { "content-type": "application/json" }
    });
  }
}
