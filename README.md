# Telegram Worker Proxy

A Cloudflare Worker that proxies Telegram & WhatsApp API requests from HuggingFace Spaces.

HF Spaces blocks DNS for `api.telegram.org` — this Worker lets you route traffic through Cloudflare instead.

## Deploy (2 ways)

### 👉 Easiest: Copy-paste in browser

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Worker**
2. Give it a name (e.g. `telegram-proxy`)
3. Delete the default code and paste the contents of [`worker.js`](./worker.js)
4. Click **Deploy**
5. Copy your Worker URL: `https://telegram-proxy.your-subdomain.workers.dev`

### ⚡ Advanced: GitHub Actions (auto-deploy on push)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **My Profile** → **API Tokens** → **Create Token** → **Edit Cloudflare Workers** template
2. Copy the token
3. Go to this repo's **Settings** → **Secrets and variables** → **Actions** → **Add secret**
4. Name: `CLOUDFLARE_API_TOKEN`, value: the token
5. Push to `main` — the action auto-deploys

## Configure HuggingClaw

After deploying, set these secrets in your HF Space:

```bash
hf spaces secrets add arvindkumar888/HuggingClaw \
  --secrets CLOUDFLARE_PROXY_URL=https://telegram-proxy.your-subdomain.workers.dev \
  --secrets CLOUDFLARE_PROXY_SECRET=anything

hf spaces restart arvindkumar888/HuggingClaw
```

## Test

```bash
curl https://telegram-proxy.your-subdomain.workers.dev/bot<YOUR_TOKEN>/getMe
```

Should return your bot info.
