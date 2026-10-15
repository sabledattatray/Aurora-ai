# Security Policy

## Supported Versions
Only the latest release of Aurora AI receives security updates.

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability
If you discover a security vulnerability or privacy leak in Aurora AI:
1. **Do not open a public issue.**
2. Send a private report detailing the steps to reproduce, impact, and affected components to the project maintainers.
3. You will receive an acknowledgment within 48 hours.

## Security Principles & Threat Model
- **Local-Only Privacy**: Local chat must never transmit prompt or completion data over external networks.
- **SSRF Protection**: Local endpoints are strictly constrained to loopback addresses (`127.0.0.1`, `localhost`, `[::1]`).
- **Secret Isolation**: Client bundles are static and must never contain server tokens or provider credentials.
- **Formula Injection Mitigation**: Spreadsheet cells beginning with `=`, `+`, `-`, `@` are sanitized upon import and export.
- **Safe Markdown**: Remote images in model outputs are blocked by default to prevent data exfiltration via image query parameters. Raw HTML is strictly sanitized.

## Incident Guidance & Credential Rotation
If a hosted gateway credential or token is compromised:
1. Immediately invoke the kill switch by setting `KILL_SWITCH=true` on the gateway worker.
2. Revoke and delete the compromised token in the Cloudflare dashboard.
3. Generate a new API token with minimum necessary permissions.
4. Deploy the updated secret using `npx wrangler secret put HOSTED_PROVIDER_API_TOKEN`.
5. Reset `KILL_SWITCH=false` and verify logs.
