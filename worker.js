/**
 * Rotating Proxy Worker for HuggingClaw — bypasses HF Spaces outbound blocks
 * 
 * Deployed automatically every 30 min by GitHub Actions cron.
 * Each deploy gets a unique worker name → fresh egress IP → bypasses rate limits.
 * 
 * VERSION: __VERSION__
 * DEPLOYED: __DEPLOY_TIME__
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
  
  // Add debug headers so we can identify which proxy version handled the request
  newReq.headers.set("x-proxy-version", "__VERSION__");
  newReq.headers.set("x-proxy-deployed", "__DEPLOY_TIME__");
  
  // Remove proxy-specific headers before forwarding
  newReq.headers.delete("x-target-host");
  newReq.headers.delete("x-proxy-key");
  
  try {
    const response = await fetch(newReq);
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, version: "__VERSION__" }), {
      status: 502,
      headers: { "content-type": "application/json" }
    });
  }
}
