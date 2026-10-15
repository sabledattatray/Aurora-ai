# Provider Setup Guide

This guide describes how to configure local and hosted AI inference providers in Aurora AI.

---

## 1. Local Provider: Ollama (Recommended, Free & Private)

Ollama runs open-weights models directly on your hardware.

### Endpoints Used by Aurora AI
- `GET http://127.0.0.1:11434/api/tags`: Connection health check and list of installed models.
- `POST http://127.0.0.1:11434/api/show`: Model capabilities and context window retrieval.
- `POST http://127.0.0.1:11434/api/chat`: Chat inference with NDJSON streaming.

### Recommended Models
| Model | Parameters | Approximate Disk Size | RAM Recommended | License |
|---|---|---|---|---|
| `llama3:latest` | 8B | ~4.7 GB | 8 GB+ | Meta Llama 3 Community License |
| `mistral:latest` | 7B | ~4.1 GB | 8 GB+ | Apache 2.0 |
| `phi3:mini` | 3.8B | ~2.3 GB | 4 GB+ | MIT |
| `gemma2:2b` | 2B | ~1.6 GB | 3 GB+ | Gemma Terms of Use |

### Enabling Browser Access (`OLLAMA_ORIGINS`)
Because Aurora runs in the browser, Ollama must allow cross-origin requests:
- **Windows**: In PowerShell, run `setx OLLAMA_ORIGINS "*"` and restart Ollama from the Start menu.
- **macOS**: In Terminal, run `launchctl setenv OLLAMA_ORIGINS "*"` and restart Ollama.
- **Linux**: Add `Environment="OLLAMA_ORIGINS=*"` to `/etc/systemd/system/ollama.service.d/override.conf` and run `sudo systemctl restart ollama`.

---

## 2. Hosted Provider: Cloudflare Workers AI (Optional)

Optional hosted inference is deployed as a serverless Cloudflare Worker located in `gateway/`.

### Architecture & Security
- The client web app never holds or sees Cloudflare API tokens.
- The Cloudflare Worker enforces:
  - Allowed origin verification
  - Mandatory `X-Aurora-Consent: 1.0` header
  - Salted IP hash rate limiting (20 reqs/minute by default)
  - Upstream SSE to Aurora SSE translation

### Deployment Steps
1. Navigate to the gateway directory:
   ```bash
   cd gateway
   ```
2. Configure your Cloudflare Account credentials:
   ```bash
   npx wrangler secret put HOSTED_PROVIDER_ACCOUNT_ID
   npx wrangler secret put HOSTED_PROVIDER_API_TOKEN
   ```
3. Update `wrangler.toml` with your production web app URL in `ALLOWED_ORIGINS`:
   ```toml
   ALLOWED_ORIGINS = "https://your-aurora-domain.com,http://localhost:3000"
   ```
4. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```
5. Test the gateway health endpoint:
   ```bash
   curl https://aurora-gateway.<your-subdomain>.workers.dev/api/health
   # Returns: {"ok":true,"version":"0.1.0"}
   ```
