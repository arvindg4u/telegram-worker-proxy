# Telegram Worker Proxy

Cloudflare Worker for [HuggingClaw](https://github.com/arvindg4u/HuggingClaw) that proxies Telegram API requests to bypass HF Spaces outbound DNS blocks.

## Deploy

### Option 1: Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Worker**
2. Name it (e.g. `telegram-proxy`)
3. Replace the default code with [`worker.js`](./worker.js)
4. **Deploy**
5. URL: `https://telegram-proxy.your-subdomain.workers.dev`

### Option 2: GitHub Actions (auto-deploy)

1. Create a [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with **Workers** → **Edit** permission
2. Add as `CLOUDFLARE_API_TOKEN` secret in repo Settings → Secrets → Actions
3. Push to `main` — auto-deploys via GitHub Actions

## Test

```bash
curl https://telegram-proxy.your-subdomain.workers.dev/health

# Proxy Telegram getMe
curl https://telegram-proxy.your-subdomain.workers.dev/telegram/bot<YOUR_TOKEN>/getMe
```

## Usage in HuggingClaw

Set in HF Space secrets:
```
CLOUDFLARE_PROXY_URL=https://telegram-proxy.your-subdomain.workers.dev
```
