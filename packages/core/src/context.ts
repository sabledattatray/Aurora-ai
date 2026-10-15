import { LIMITS } from './limits';
import type { ChatRequestMessage, Role } from './types';

/**
 * Estimate tokens for text (~4 characters per token heuristic).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export interface ContextBudgetOptions {
  modelContextTokens?: number;
  reservedOutputTokens?: number;
  systemPrompt?: string;
}

export interface TruncatedContext {
  messages: ChatRequestMessage[];
  droppedCount: number;
  estimatedTokens: number;
  budgetTokens: number;
  notice?: string;
}

export type ContextResult =
  | { ok: true; context: TruncatedContext }
  | { ok: false; error: 'CONTEXT_EXCEEDED' | 'REQUEST_TOO_LARGE'; message: string };

/**
 * Manages the message context window to fit within model constraints without silent truncation (PRD 7.8, AC-19).
 */
export function buildContextWindow(
  rawMessages: Array<{ role: Role; content: string }>,
  options?: ContextBudgetOptions
): ContextResult {
  const modelContext = options?.modelContextTokens ?? LIMITS.defaultContextWindowTokens;
  const reservedOutput = options?.reservedOutputTokens ?? LIMITS.defaultReservedOutputTokens;
  const budget = Math.max(1, modelContext - reservedOutput);

  // Validate the latest user message individually first
  const latestMessage = rawMessages[rawMessages.length - 1];
  if (latestMessage) {
    if (latestMessage.content.length > LIMITS.maxUserMessageChars) {
      return {
        ok: false,
        error: 'REQUEST_TOO_LARGE',
        message: `Message exceeds maximum allowed character length of ${LIMITS.maxUserMessageChars.toLocaleString()}.`,
      };
    }
    const latestTokens = estimateTokens(latestMessage.content);
    if (latestTokens > budget) {
      return {
        ok: false,
        error: 'CONTEXT_EXCEEDED',
        message: `Message estimated at ${latestTokens.toLocaleString()} tokens exceeds the available context budget of ${budget.toLocaleString()} tokens.`,
      };
    }
  }

  const systemMessage: ChatRequestMessage | null = options?.systemPrompt
    ? { role: 'system', content: options.systemPrompt }
    : null;

  const systemTokens = systemMessage ? estimateTokens(systemMessage.content) : 0;
  let remainingBudget = budget - systemTokens;

  // We must always retain the latest message
  const result: ChatRequestMessage[] = [];
  let droppedCount = 0;
  let totalTokens = systemTokens;

  if (rawMessages.length === 0) {
    return {
      ok: true,
      context: {
        messages: systemMessage ? [systemMessage] : [],
        droppedCount: 0,
        estimatedTokens: totalTokens,
        budgetTokens: budget,
      },
    };
  }

  // Work backwards from the newest message to the oldest
  const includedRev: ChatRequestMessage[] = [];
  for (let i = rawMessages.length - 1; i >= 0; i--) {
    const msg = rawMessages[i];
    if (!msg) continue;
    const msgTokens = estimateTokens(msg.content);

    // Latest message MUST be included
    if (i === rawMessages.length - 1) {
      includedRev.push({ role: msg.role, content: msg.content });
      remainingBudget -= msgTokens;
      totalTokens += msgTokens;
      continue;
    }

    // Check if adding this older turn exceeds remaining budget or max messages
    if (remainingBudget >= msgTokens && (includedRev.length + (systemMessage ? 1 : 0)) < LIMITS.maxMessagesPerRequest) {
      includedRev.push({ role: msg.role, content: msg.content });
      remainingBudget -= msgTokens;
      totalTokens += msgTokens;
    } else {
      droppedCount = i + 1;
      break;
    }
  }

  includedRev.reverse();

  const finalMessages: ChatRequestMessage[] = [];
  if (systemMessage) {
    finalMessages.push(systemMessage);
  }
  finalMessages.push(...includedRev);

  const notice = droppedCount > 0
    ? `Earlier messages (${droppedCount}) are not included in the model's context window.`
    : undefined;

  return {
    ok: true,
    context: {
      messages: finalMessages,
      droppedCount,
      estimatedTokens: totalTokens,
      budgetTokens: budget,
      notice,
    },
  };
}
