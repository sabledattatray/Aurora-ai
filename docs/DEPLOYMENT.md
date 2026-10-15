# Deployment Guide

Aurora AI consists of two independent deployable units:
1. **Frontend Web App (`web/`)**: Static client-side application exported into `web/out/`.
2. **Hosted Gateway (`gateway/`)**: Serverless Cloudflare Worker handling optional cloud inference.

---

## 1. Deploying the Frontend Static App

The frontend is completely static and can be deployed to any static site host (Cloudflare Pages, Vercel, Netlify, GitHub Pages, or a self-hosted Nginx/Caddy container).

### Build Command
From the project root:
```bash
npm run build -w web
```
The production bundle is generated in `web/out/`.

### Cloudflare Pages Deployment
1. Connect your repository to Cloudflare Pages.
2. Build settings:
   - **Framework preset**: None / Next.js (Static)
   - **Build command**: `npm run build -w web`
   - **Build output directory**: `web/out`
3. Verify that `web/public/_headers` is deployed, which automatically configures Content-Security-Policy (CSP), Referrer-Policy, and X-Content-Type-Options headers.

### Self-Hosted Local Server
If your browser restricts mixed content or localhost access from public HTTPS origins, run Aurora locally on loopback:
```bash
npm run dev
# or build and serve with a local static file server:
npx serve web/out -p 3000
```

---

## 2. Deploying the Gateway Worker

The gateway worker lives in `gateway/`:
1. Authenticate with Wrangler:
   ```bash
   cd gateway
   npx wrangler login
   ```
2. Configure required server secrets (do not put these in `wrangler.toml`):
   ```bash
   npx wrangler secret put HOSTED_PROVIDER_ACCOUNT_ID
   npx wrangler secret put HOSTED_PROVIDER_API_TOKEN
   ```
3. Deploy to production:
   ```bash
   npx wrangler deploy
   ```

---

## 3. Post-Deployment Verification Checklist
1. Visit `https://your-domain/` and ensure the welcome cards and no-model message load without console errors.
2. Check HTTP response headers using curl or browser DevTools:
   - Verify `Content-Security-Policy` is present.
   - Verify `X-Content-Type-Options: nosniff`.
   - Verify `Referrer-Policy: no-referrer`.
3. Test `GET https://your-gateway.workers.dev/api/health` to confirm `{ ok: true, version: "0.1.0" }`.
4. Ensure in Local-only mode that zero requests are dispatched to any hosted URL.

---

## 4. Emergency Rollback & Kill Switch
- **Frontend Rollback**: Instant rollback to previous deployment commit in your hosting dashboard.
- **Gateway Suspension**: Set `KILL_SWITCH = "true"` in `gateway/wrangler.toml` and run `npx wrangler deploy`. The gateway will immediately return 503 `QUOTA_EXHAUSTED` responses without attempting any upstream provider calls.
