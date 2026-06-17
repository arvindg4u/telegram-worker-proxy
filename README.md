# Telegram Worker Proxy

A Cloudflare Worker that proxies Telegram & WhatsApp API requests from HuggingFace Spaces.

HF Spaces blocks DNS for `api.telegram.org` — this Worker lets you route traffic through Cloudflare instead.

## Deploy

### Option 1: Connect GitHub repo (recommended)
1. Go to [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=workers)
2. Click **Create Application** → **Pages** → **Connect to Git**
3. Select this repo
4. Set **Build command**: (none — it's a Worker)
5. Set **Build output**: `/`
6. Click **Save and Deploy**

### Option 2: Copy-paste
1. Go to [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=workers)
2. Click **Create Application** → **Worker**
3. Paste `worker.js` content
4. Click **Deploy**

## Configure HuggingClaw

After deploying, set these secrets in your HF Space:

```bash
hf spaces secrets arvindkumar888/HuggingClaw \
  --set CLOUDFLARE_PROXY_URL=https://your-worker.workers.dev \
  --set CLOUDFLARE_PROXY_SECRET=anything

hf spaces restart arvindkumar888/HuggingClaw
```

## Test

```bash
curl https://your-worker.workers.dev/bot<YOUR_TOKEN>/getMe
```

Should return your bot info if the proxy is working.
