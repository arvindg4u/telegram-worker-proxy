#!/usr/bin/env python3
"""Called by GitHub Actions to register new worker + update HF Space + cleanup."""
import os, json, requests, sys

CF_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', '')
HF_TOKEN = os.environ.get('HF_TOKEN', '')
SPACE_NAME = os.environ.get('SPACE_NAME', 'arvindkumar888/HuggingClaw')
WORKER_NAME = os.environ.get('WORKER_NAME', '')

if not all([CF_TOKEN, HF_TOKEN, WORKER_NAME]):
    print("Missing env vars", file=sys.stderr); sys.exit(1)

H = {'Authorization': f'Bearer {CF_TOKEN}', 'Content-Type': 'application/json'}

# 1. Get account ID
r = requests.get('https://api.cloudflare.com/client/v4/accounts', headers=H)
r.raise_for_status()
aid = r.json()['result'][0]['id']
print(f"Account: {aid}")

# 2. Get subdomain
r = requests.get(f'https://api.cloudflare.com/client/v4/accounts/{aid}/workers/subdomain', headers=H)
r.raise_for_status()
sd = r.json()['result']['subdomain']
print(f"Subdomain: {sd}")

# 3. Enable workers.dev
r = requests.post(
    f'https://api.cloudflare.com/client/v4/accounts/{aid}/workers/scripts/{WORKER_NAME}/subdomain',
    headers=H, json={"enabled": True, "previews_enabled": True})
print(f"Workers.dev enable: {r.status_code}")

worker_url = f"https://{WORKER_NAME}.{sd}.workers.dev"
print(f"URL: {worker_url}")

# 4. Update HF Space secret
from huggingface_hub import HfApi
api = HfApi()
api.add_space_secret(SPACE_NAME, 'CLOUDFLARE_PROXY_URL', worker_url, token=HF_TOKEN)
print("HF secret updated")

# 5. Restart HF Space
api.restart_space(SPACE_NAME, token=HF_TOKEN)
print("HF Space restarting...")

# 6. Cleanup old workers
r = requests.get(f'https://api.cloudflare.com/client/v4/accounts/{aid}/workers/scripts', headers=H)
r.raise_for_status()
workers = r.json().get('result', [])
proxy_w = sorted([w for w in workers if w['id'].startswith('proxy-')], key=lambda w: w['id'], reverse=True)
for stale in proxy_w[3:]:
    wid = stale['id']
    requests.delete(f'https://api.cloudflare.com/client/v4/accounts/{aid}/workers/scripts/{wid}', headers=H)
    print(f"Deleted stale: {wid}")

print(f"Done! Active: {len(proxy_w[:3])}")
