#!/usr/bin/env python3
"""
Manual rotation script for the Cloudflare Worker proxy.

Run this to immediately rotate to a new worker with a fresh IP.

Usage:
    export CLOUDFLARE_API_TOKEN="your_token"
    export HF_TOKEN="hf_your_token"
    python3 scripts/rotate-proxy.py
"""

import os, json, requests, sys, time
from datetime import datetime
from huggingface_hub import HfApi

CF_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN') or os.environ.get('CLOUDFLARE_WORKERS_TOKEN')
HF_TOKEN = os.environ.get('HF_TOKEN')
SPACE_NAME = os.environ.get('SPACE_NAME', 'arvindkumar888/HuggingClaw')

def cf_api(method, path, token, body=None):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    url = f'https://api.cloudflare.com/client/v4{path}'
    r = requests.request(method, url, headers=headers, json=body)
    r.raise_for_status()
    return r.json().get('result')

def deploy_worker(account_id, token, worker_name):
    worker_source = '''
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const targetHost = request.headers.get("x-target-host") || "api.telegram.org";
  url.hostname = targetHost;
  const newReq = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow"
  });
  newReq.headers.delete("x-target-host");
  newReq.headers.delete("x-proxy-key");
  try {
    return await fetch(newReq);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502, headers: { "content-type": "application/json" }
    });
  }
}
'''
    r = requests.put(
        f'https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{worker_name}',
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/javascript'},
        data=worker_source.encode()
    )
    r.raise_for_status()
    print(f"Worker '{worker_name}' deployed")

def enable_subdomain(account_id, token, worker_name):
    requests.post(
        f'https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{worker_name}/subdomain',
        headers={'Authorization': f'Bearer {token}'},
        json={"enabled": True, "previews_enabled": True}
    )

def main():
    if not CF_TOKEN:
        print("Set CLOUDFLARE_API_TOKEN environment variable")
        sys.exit(1)

    accounts = cf_api('GET', '/accounts', CF_TOKEN)
    if not accounts:
        print("No Cloudflare account found")
        sys.exit(1)
    account_id = accounts[0]['id']
    print(f"Account: {account_id}")

    sd = cf_api('GET', f'/accounts/{account_id}/workers/subdomain', CF_TOKEN)
    subdomain = (sd or {}).get('subdomain', '')
    if not subdomain:
        print("Workers subdomain not configured")
        sys.exit(1)
    print(f"Subdomain: {subdomain}")

    ts = int(time.time())
    worker_name = f"proxy-{ts}"
    deploy_worker(account_id, CF_TOKEN, worker_name)
    enable_subdomain(account_id, CF_TOKEN, worker_name)

    worker_url = f"https://{worker_name}.{subdomain}.workers.dev"
    print(f"New URL: {worker_url}")

    if HF_TOKEN:
        api = HfApi()
        print("Updating HF Space secret...")
        api.add_space_secret(SPACE_NAME, 'CLOUDFLARE_PROXY_URL', worker_url, token=HF_TOKEN)
        print("Restarting HF Space...")
        api.restart_space(SPACE_NAME, token=HF_TOKEN)
        print("HF Space restarted!")

    print("Cleaning up old workers...")
    all_workers = cf_api('GET', f'/accounts/{account_id}/workers/scripts', CF_TOKEN)
    if all_workers:
        proxy_workers = sorted(
            [w for w in all_workers if w['id'].startswith('proxy-')],
            key=lambda w: w['id'], reverse=True
        )
        for stale in proxy_workers[3:]:
            wid = stale['id']
            requests.delete(
                f'https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{wid}',
                headers={'Authorization': f'Bearer {CF_TOKEN}'}
            )
            print(f"  Deleted stale: {wid}")

    print(f"\nRotation complete! New proxy: {worker_url}")

if __name__ == '__main__':
    main()
