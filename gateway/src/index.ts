import {
  CURRENT_DISCLOSURE_VERSION,
  LIMITS,
  type ErrorCode,
} from '@aurora/core';

export interface GatewayEnv {
  HOSTED_PROVIDER_ACCOUNT_ID?: string;
  HOSTED_PROVIDER_API_TOKEN?: string;
  HOSTED_PROVIDER_MODEL_ALLOWLIST?: string;
  HOSTED_PROVIDER_DEFAULT_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  GLOBAL_DAILY_REQUEST_BUDGET?: string;
  KILL_SWITCH?: string;
}

const DEFAULT_ALLOWED_MODELS = [
  '@cf/meta/llama-3-8b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

// Simple in-memory rate tracker for standalone/test environments
// In Cloudflare production, this can be backed by Rate Limiting or Durable Objects (PRD 10.5)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

async function hashClientIp(ip: string): Promise<string> {
  const salt = 'aurora-ip-salt-v1';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function checkRateLimit(clientHash: string, maxRequests: number): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(clientHash);
  if (!existing || now > existing.expiresAt) {
    rateLimitMap.set(clientHash, { count: 1, expiresAt: now + 60_000 });
    return true;
  }
  if (existing.count >= maxRequests) {
    return false;
  }
  existing.count++;
  return true;
}

function jsonError(code: ErrorCode, message: string, status = 400, headers?: HeadersInit) {
  return new Response(
    JSON.stringify({
      error: { code, message, promptKept: true },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

export async function handleGatewayRequest(req: Request, env: GatewayEnv): Promise<Response> {
  const url = new URL(req.url);

  // Origin & CORS Setup (PRD 10.3, 10.4)
  const origin = req.headers.get('Origin') || '';
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim());

  const corsAllowOrigin =
    origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))
      ? origin
      : allowedOrigins[0] || '*';

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': corsAllowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Aurora-Consent',
  };

  // Preflight OPTIONS for all gateway routes
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 1. Health Endpoint (PRD 10.3: zero inference cost, returns version only)
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return new Response(JSON.stringify({ ok: true, version: '0.1.0' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 2. Models Allowlist Endpoint
  if (req.method === 'GET' && url.pathname === '/api/models') {
    const rawAllowlist = env.HOSTED_PROVIDER_MODEL_ALLOWLIST;
    const allowed = rawAllowlist
      ? rawAllowlist.split(',').map((m) => m.trim())
      : DEFAULT_ALLOWED_MODELS;
    return new Response(JSON.stringify({ models: allowed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 3. Only handle /api/chat
  if (url.pathname !== '/api/chat') {
    return jsonError('INVALID_REQUEST', 'Endpoint not found', 404, corsHeaders);
  }

  if (req.method !== 'POST') {
    return jsonError('INVALID_REQUEST', 'Method not allowed. POST required.', 405, corsHeaders);
  }

  // Kill Switch (PRD 10.5)
  if (env.KILL_SWITCH === 'true') {
    return jsonError(
      'QUOTA_EXHAUSTED',
      'The online service is temporarily unavailable. Please switch to your local model.',
      503,
      corsHeaders
    );
  }

  // Origin Validation (PRD 10.3, 10.4)
  if (origin && !allowedOrigins.includes(origin) && !allowedOrigins.includes('*')) {
    return jsonError('INVALID_REQUEST', 'Forbidden origin.', 403, corsHeaders);
  }

  // Consent Header Validation (PRD 8.3 & 10.3)
  const consentHeader = req.headers.get('X-Aurora-Consent');
  if (!consentHeader || consentHeader !== CURRENT_DISCLOSURE_VERSION) {
    return jsonError(
      'CONSENT_REQUIRED',
      'Missing or outdated consent header. Consent must be granted in the client UI.',
      400,
      corsHeaders
    );
  }

  // Content-Type Check
  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    return jsonError('INVALID_REQUEST', 'Content-Type must be application/json', 415, corsHeaders);
  }

  // Rate Limiting (PRD 10.5: Hashed IP)
  const clientIp = req.headers.get('CF-Connecting-IP') || req.headers.get('x-forwarded-for') || '127.0.0.1';
  const clientHash = await hashClientIp(clientIp);
  const maxReqs = parseInt(env.RATE_LIMIT_MAX_REQUESTS || '20', 10);
  if (!checkRateLimit(clientHash, maxReqs)) {
    return jsonError(
      'RATE_LIMITED',
      'The online service is busy. Please try again in a moment, or switch to your local model.',
      429,
      { ...corsHeaders, 'Retry-After': '30' }
    );
  }

  // Parse Body
  let body: {
    requestId?: string;
    modelId?: string;
    messages?: Array<{ role: string; content: string }>;
    maxOutputTokens?: number;
    temperature?: number;
  };

  try {
    const rawText = await req.text();
    if (rawText.length > LIMITS.maxRequestBodyBytesGateway) {
      return jsonError('REQUEST_TOO_LARGE', 'Request body exceeds maximum allowed size.', 413, corsHeaders);
    }
    body = JSON.parse(rawText);
  } catch {
    return jsonError('INVALID_REQUEST', 'Malformed JSON in request body.', 400, corsHeaders);
  }

  // Validate Body Fields
  if (!body.requestId || typeof body.requestId !== 'string') {
    return jsonError('INVALID_REQUEST', 'Field requestId is required.', 400, corsHeaders);
  }

  if (!body.modelId || typeof body.modelId !== 'string') {
    return jsonError('INVALID_REQUEST', 'Field modelId is required.', 400, corsHeaders);
  }

  const allowedModels = (env.HOSTED_PROVIDER_MODEL_ALLOWLIST ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const effectiveAllowlist = allowedModels.length > 0 ? allowedModels : DEFAULT_ALLOWED_MODELS;

  if (!effectiveAllowlist.includes(body.modelId)) {
    return jsonError(
      'MODEL_NOT_FOUND',
      `Requested model "${body.modelId}" is not allowed by this gateway.`,
      400,
      corsHeaders
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError('INVALID_REQUEST', 'Field messages must be a non-empty array.', 400, corsHeaders);
  }

  if (body.messages.length > LIMITS.maxMessagesPerRequest) {
    return jsonError('REQUEST_TOO_LARGE', `Too many messages. Maximum is ${LIMITS.maxMessagesPerRequest}.`, 400, corsHeaders);
  }

  for (const m of body.messages) {
    if (!m.role || !['user', 'assistant', 'system'].includes(m.role)) {
      return jsonError('INVALID_REQUEST', `Invalid role in message: ${m.role}`, 400, corsHeaders);
    }
    if (typeof m.content !== 'string' || m.content.length > LIMITS.maxUserMessageChars) {
      return jsonError('REQUEST_TOO_LARGE', 'Message length exceeds maximum allowed characters.', 400, corsHeaders);
    }
  }

  // Upstream Inference Provider: Cloudflare Workers AI (PRD 10.6)
  if (!env.HOSTED_PROVIDER_ACCOUNT_ID || !env.HOSTED_PROVIDER_API_TOKEN) {
    return jsonError(
      'PROVIDER_NOT_CONFIGURED',
      'Hosted AI provider credentials have not been configured on this gateway.',
      503,
      corsHeaders
    );
  }

  const upstreamUrl = `https://api.cloudflare.com/client/v4/accounts/${env.HOSTED_PROVIDER_ACCOUNT_ID}/ai/run/${body.modelId}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.HOSTED_PROVIDER_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: body.messages,
        stream: true,
        max_tokens: Math.min(body.maxOutputTokens ?? 1024, LIMITS.maxOutputTokensHostedCeiling),
        temperature: body.temperature ?? 0.7,
      }),
      signal: req.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return jsonError('CANCELLED', 'Request was cancelled.', 499, corsHeaders);
    }
    return jsonError('PROVIDER_UNAVAILABLE', 'Could not connect to upstream AI provider.', 502, corsHeaders);
  }

  if (!upstreamRes.ok) {
    if (upstreamRes.status === 429) {
      return jsonError('RATE_LIMITED', 'Upstream provider rate limit reached.', 429, corsHeaders);
    }
    if (upstreamRes.status === 404) {
      return jsonError('MODEL_NOT_FOUND', 'Upstream provider could not find requested model.', 404, corsHeaders);
    }
    return jsonError(
      'PROVIDER_UNAVAILABLE',
      'Upstream provider encountered an error processing the request.',
      502,
      corsHeaders
    );
  }

  if (!upstreamRes.body) {
    return jsonError('NETWORK_ERROR', 'No response body from upstream provider.', 502, corsHeaders);
  }

  // Transform SSE from Cloudflare Workers AI into Aurora SSE stream
  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr) as { response?: string };
              if (parsed.response) {
                const event = { type: 'delta', text: parsed.response };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              }
            } catch {
              // Ignore non-json SSE lines
            }
          }
        }
        controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(responseStream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export default {
  fetch(req: Request, env: GatewayEnv): Promise<Response> {
    return handleGatewayRequest(req, env);
  },
};
