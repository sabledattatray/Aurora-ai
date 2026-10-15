import type { ErrorCode } from './errors';
import type { ConsentRecord, PrivacyMode, Route } from './types';

export const CURRENT_DISCLOSURE_VERSION = '1.0';

export interface RouteTarget {
  route: Route;
  providerId: string;
  modelId: string;
}

export type RouteDecision =
  | {
      allowed: true;
      route: Route;
      providerId: string;
      modelId: string;
      consentRecord?: ConsentRecord;
    }
  | {
      allowed: false;
      code: ErrorCode;
      reason: string;
    };

export interface RouteContext {
  privacyMode: PrivacyMode;
  target: RouteTarget;
  conversationId?: string;
  hasAttachment?: boolean;
  consents?: ConsentRecord[];
}

/**
 * Checks if a consent record is currently valid for the required purpose and conversation.
 */
export function isConsentValid(
  consent: ConsentRecord | undefined,
  purpose: 'cloud-text' | 'cloud-attachments',
  conversationId?: string
): boolean {
  if (!consent) return false;
  if (consent.choice !== 'granted') return false;
  if (consent.revokedAt !== undefined) return false;
  if (consent.disclosureVersion !== CURRENT_DISCLOSURE_VERSION) return false;
  if (consent.purpose !== purpose) return false;

  // If conversationId is specified in scope, it must match
  if (consent.scope.conversationId && conversationId) {
    return consent.scope.conversationId === conversationId;
  }

  return true;
}

/**
 * Central Privacy Router deciding whether an outbound request is permitted (PRD Section 8, AC-03, AC-04).
 */
export function routeRequest(ctx: RouteContext): RouteDecision {
  const { privacyMode, target, conversationId, hasAttachment, consents = [] } = ctx;

  // Rule 1: Local-only mode STRICTLY forbids any remote route
  if (privacyMode === 'local-only') {
    if (target.route !== 'device-local') {
      return {
        allowed: false,
        code: 'CONSENT_REQUIRED',
        reason: 'Cloud routing is blocked in Local-only privacy mode. Change mode in Settings if you wish to use cloud models.',
      };
    }

    if (!target.modelId) {
      return {
        allowed: false,
        code: 'PROVIDER_NOT_CONFIGURED',
        reason: 'No local model has been selected. Set up an Ollama model in Settings.',
      };
    }

    return {
      allowed: true,
      route: 'device-local',
      providerId: target.providerId || 'ollama',
      modelId: target.modelId,
    };
  }

  // Rule 2: Ask-before-cloud mode
  if (privacyMode === 'ask-before-cloud') {
    if (target.route === 'device-local') {
      if (!target.modelId) {
        return {
          allowed: false,
          code: 'PROVIDER_NOT_CONFIGURED',
          reason: 'No local model has been selected.',
        };
      }
      return {
        allowed: true,
        route: 'device-local',
        providerId: target.providerId || 'ollama',
        modelId: target.modelId,
      };
    }

    // Cloud route requested: check consent for text
    const textConsent = consents.find(
      (c) => isConsentValid(c, 'cloud-text', conversationId) && c.scope.providerId === target.providerId
    );

    if (!textConsent) {
      return {
        allowed: false,
        code: 'CONSENT_REQUIRED',
        reason: 'Explicit consent is required before sending conversation data to an online provider.',
      };
    }

    // If attachments are included, require separate attachment consent
    if (hasAttachment) {
      const attachConsent = consents.find(
        (c) => isConsentValid(c, 'cloud-attachments', conversationId) && c.scope.providerId === target.providerId
      );
      if (!attachConsent) {
        return {
          allowed: false,
          code: 'CONSENT_REQUIRED',
          reason: 'Explicit consent is required before sending document attachment data to an online provider.',
        };
      }
    }

    if (!target.modelId) {
      return {
        allowed: false,
        code: 'MODEL_NOT_FOUND',
        reason: 'No cloud model specified.',
      };
    }

    return {
      allowed: true,
      route: 'cloud',
      providerId: target.providerId,
      modelId: target.modelId,
      consentRecord: textConsent,
    };
  }

  return {
    allowed: false,
    code: 'UNKNOWN_SAFE_ERROR',
    reason: 'Unrecognized privacy mode.',
  };
}
