# Troubleshooting & Incident Runbook

This runbook provides diagnostic workflows for common connection, storage, and security issues.

---

## 1. Local Model Connection Issues

### Symptom: Status shows "Not Reachable" or "PROVIDER_UNAVAILABLE"
1. **Is Ollama running?**
   - Check if Ollama is running in your taskbar / system tray.
   - Run `curl http://127.0.0.1:11434` or open it in a browser tab. It should return: `Ollama is running`.
2. **Is CORS enabled?**
   - Web browsers block requests from websites to localhost unless explicitly permitted.
   - Set `OLLAMA_ORIGINS="*"` in your system environment and restart Ollama (see [Provider Setup Guide](file:///d:/Datta%20Sable/Aurora/docs/PROVIDER_SETUP.md)).
3. **Is the port correct?**
   - Ensure Ollama is listening on default port `11434`.

### Symptom: Error says "LOCAL_ENDPOINT_BLOCKED"
- **Cause**: Chrome or Edge displayed a permission dialog asking to allow the site to access local network devices, and it was dismissed or rejected.
- **Remedy**:
  - Open browser Site Settings for Aurora.
  - Enable "Local Network Access" or "Insecure content".
  - Alternatively, host Aurora locally on `http://localhost:3000` (`npm run dev`), which completely eliminates cross-network permission prompts.

---

## 2. Storage & History Issues

### Symptom: Past conversations disappeared after restarting the browser
- **Cause 1**: The browser was used in Private / Incognito mode.
- **Cause 2**: Browser site data or cache was manually cleared.
- **Cause 3 (Safari)**: Safari evicts client storage if a website has not been visited in 7 days.
- **Remedy**: Regularly click **Export all data (JSON)** in **Settings > Storage** to keep offline backups of your conversations.

### Symptom: "History will not be saved" notice
- **Cause**: IndexedDB is disabled by strict browser privacy settings or third-party cookie blockers.
- **Remedy**: Check browser settings to ensure IndexedDB and site data storage are enabled for this origin.

---

## 3. Cloud Inference & Gateway Issues

### Symptom: Error code "RATE_LIMITED" (HTTP 429)
- **Cause**: The free hosted gateway allowance has reached its per-minute limit (default 20 requests/minute per client).
- **Remedy**: Wait 30 seconds and click **Retry**, or switch to your local model in **Settings**.

### Symptom: Error code "CONSENT_REQUIRED"
- **Cause**: You attempted to use the cloud route without granting informed consent for remote transmission.
- **Remedy**: Click "Allow for this conversation" or "Send once" on the consent dialog, or stay in `Local-only` mode.

---

## 4. Security Incident: Credential Leak Rotation Runbook

If a Cloudflare API token or account ID is inadvertently exposed in git commits or logs:
1. **Activate the Kill Switch**:
   In `gateway/wrangler.toml`:
   ```toml
   KILL_SWITCH = "true"
   ```
   Deploy immediately: `cd gateway && npx wrangler deploy`. All further gateway requests will be blocked before reaching upstream providers.
2. **Revoke the Exposed Token**:
   - Log into the Cloudflare Dashboard.
   - Go to **My Profile > API Tokens**.
   - Find the exposed token and click **Roll** or **Delete**.
3. **Generate a Replacement Token**:
   - Create a new token with specific permissions limited to: `Workers AI: Run`.
4. **Deploy the New Secret**:
   ```bash
   cd gateway
   npx wrangler secret put HOSTED_PROVIDER_API_TOKEN
   ```
5. **Deactivate the Kill Switch**:
   Reset `KILL_SWITCH = "false"` and redeploy.
