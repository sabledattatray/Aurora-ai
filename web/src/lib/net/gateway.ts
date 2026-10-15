import {
  isLoopbackEndpoint,
  isConsentValid,
  type ConsentRecord,
  type PrivacyMode,
  type Route,
} from '@aurora/core';

export interface GatewayRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export interface GatewaySendParams {
  route: Route;
  privacyMode: PrivacyMode;
  url: string;
  options?: GatewayRequestOptions;
  consent?: ConsentRecord;
  conversationId?: string;
  hasAttachment?: boolean;
}

export class GatewayPrivacyError extends Error {
  code: string;
  constructor(message: string, code: string = 'CONSENT_REQUIRED') {
    super(message);
    this.name = 'GatewayPrivacyError';
    this.code = code;
  }
}

/**
 * PRD 7.11 & AC-03: Single network gateway module.
 * Strictly enforces privacy mode and SSRF loopback rules before making any outbound HTTP request.
 */
export async function sendNetworkRequest(params: GatewaySendParams): Promise<Response> {
  const { route, privacyMode, url, options = {}, consent, conversationId, hasAttachment } = params;

  // 1. In Local-only mode, NEVER send requests to cloud or non-local routes
  if (privacyMode === 'local-only') {
    if (route !== 'device-local') {
      throw new GatewayPrivacyError(
        'Outbound request blocked: Local-only mode strictly forbids remote network transmission.',
        'CONSENT_REQUIRED'
      );
    }
  }

  // 2. Loopback restriction for device-local route (PRD 9.4 SSRF prevention)
  if (route === 'device-local') {
    if (!isLoopbackEndpoint(url)) {
      throw new GatewayPrivacyError(
        'Outbound request blocked: Local model calls must target loopback addresses only (127.0.0.1, localhost, [::1]).',
        'LOCAL_ENDPOINT_BLOCKED'
      );
    }
  }

  // 3. For cloud route, verify explicit unrevoked consent
  if (route === 'cloud') {
    const purpose = hasAttachment ? 'cloud-attachments' : 'cloud-text';
    if (!isConsentValid(consent, purpose, conversationId)) {
      throw new GatewayPrivacyError(
        'Outbound request blocked: Explicit user consent is required before transmitting data to cloud services.',
        'CONSENT_REQUIRED'
      );
    }
  }

  // 4. Handle timeouts and signals cleanly
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('REQUEST_TIMEOUT')), timeoutMs);

  let combinedSignal: AbortSignal = controller.signal;
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error('CANCELLED');
    }
    // Listen to user signal as well
    options.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort(new Error('CANCELLED'));
    });
  }

  try {
    const res = await fetch(url, {
      ...options,
      signal: combinedSignal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.message === 'REQUEST_TIMEOUT' || err.name === 'TimeoutError') {
        throw new Error('REQUEST_TIMEOUT');
      }
      if (err.name === 'AbortError' || err.message === 'CANCELLED') {
        throw new Error('CANCELLED');
      }
    }
    throw err;
  }
}
