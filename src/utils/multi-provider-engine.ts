/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFallbackAngelReply } from './assistant-logic.ts';

export type AssistantLanguage = 'hinglish' | 'english';
export type ProviderId = 'gemini' | 'openai' | 'offline';
export type ProviderPriority = 'auto' | 'gemini-first' | 'openai-first';

export interface ProviderStatusInfo {
  id: ProviderId;
  name: string;
  isConfigured: boolean;
  status: 'ready' | 'unconfigured' | 'quota_exhausted' | 'blocked_requires_paid_consent' | 'auth_error' | 'error';
  isFreeTierEligible: boolean;
  details?: string;
  supportedModels: string[];
}

export interface MultiProviderConfig {
  hasGeminiKey: boolean;
  hasOpenAiKey: boolean;
  allowPaidUsage: boolean;
  priority: ProviderPriority;
  geminiQuotaCooldownUntil?: number;
  openAiAuthFailed?: boolean;
}

export interface PlannedCandidate {
  provider: ProviderId;
  model: string;
  isPaid: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant' | 'model';
  text: string;
}

// Gemini execution order: requested models first, then a broadly supported fallback.
// A model can be unavailable to a particular API project even when the key is valid.
// Keep the stable fallback last so it is only used when both preferred models fail.
export const GEMINI_FREE_TIER_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];

// OpenAI models (Paid API account required; no free public API tier guaranteed)
export const OPENAI_MODELS = [
  'gpt-4o-mini',
  'gpt-3.5-turbo',
];

/**
 * Determines the execution order of AI models and providers,
 * strictly enforcing cost boundaries and user authorization.
 */
export function planProviderExecutionOrder(config: MultiProviderConfig): {
  candidates: PlannedCandidate[];
  blockedPaidProviderReason?: string;
} {
  const candidates: PlannedCandidate[] = [];
  let blockedPaidProviderReason: string | undefined;

  const now = Date.now();
  const isGeminiQuotaCooledDown = Boolean(
    config.geminiQuotaCooldownUntil && config.geminiQuotaCooldownUntil > now
  );

  // A previous 429 should be reported in provider status, but must not disable
  // every Gemini model for the entire cooldown window. Each request still tries
  // the configured model cascade so a model-specific limit can fall through.
  const canUseGemini = config.hasGeminiKey;
  const canUseOpenAi = config.hasOpenAiKey && !config.openAiAuthFailed;

  if (config.priority === 'openai-first') {
    // 1. User prefers OpenAI first
    if (canUseOpenAi) {
      if (config.allowPaidUsage) {
        for (const m of OPENAI_MODELS) {
          candidates.push({ provider: 'openai', model: m, isPaid: true });
        }
      } else {
        blockedPaidProviderReason =
          "OpenAI API usage may incur billing charges and 'Allow paid API usage' is disabled. Please enable paid usage in Settings if authorized.";
      }
    }

    // 2. Fallback to Gemini free tier
    if (canUseGemini) {
      for (const m of GEMINI_FREE_TIER_MODELS) {
        candidates.push({ provider: 'gemini', model: m, isPaid: false });
      }
    }
  } else {
    // Default: 'gemini-first' or 'auto' (Free Tier Priority)
    // 1. Try Gemini free tier models first
    if (canUseGemini) {
      for (const m of GEMINI_FREE_TIER_MODELS) {
        candidates.push({ provider: 'gemini', model: m, isPaid: false });
      }
    }

    // 2. Next: OpenAI fallback ONLY if paid usage is explicitly authorized
    if (canUseOpenAi) {
      if (config.allowPaidUsage) {
        for (const m of OPENAI_MODELS) {
          candidates.push({ provider: 'openai', model: m, isPaid: true });
        }
      } else if (!canUseGemini && config.hasOpenAiKey) {
        // Only set the blocked notice if Gemini is unavailable and user has an OpenAI key they haven't authorized
        blockedPaidProviderReason =
          "Gemini free quota is unavailable and OpenAI is configured, but 'Allow paid API usage' is turned off. To prevent unexpected charges, Angel will not call OpenAI without your explicit permission in Settings.";
      }
    }
  }

  return { candidates, blockedPaidProviderReason };
}

/**
 * Converts raw conversation history into strict alternating turns for Gemini
 */
export function formatHistoryForGemini(
  history: ChatTurn[],
  currentMessage: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const validTurns: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const item of history) {
    if (item && item.text && item.text.trim()) {
      const itemRole: 'user' | 'model' =
        item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
      const text = item.text.trim();

      if (validTurns.length > 0 && validTurns[validTurns.length - 1].role === itemRole) {
        validTurns[validTurns.length - 1].text += `\n${text}`;
      } else {
        validTurns.push({ role: itemRole, text });
      }
    }
  }

  // Keep up to 10 recent sanitized turns
  const recent = validTurns.slice(-10);
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const turn of recent) {
    contents.push({
      role: turn.role,
      parts: [{ text: turn.text }],
    });
  }

  // Append current user message ensuring no duplicate trailing 'user'
  const trimmed = currentMessage.trim();
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += `\n${trimmed}`;
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: trimmed }],
    });
  }

  return contents;
}

/**
 * Converts raw conversation history into OpenAI Chat Completions messages array
 */
export function formatHistoryForOpenAI(
  systemInstruction: string,
  history: ChatTurn[],
  currentMessage: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemInstruction },
  ];

  const recent = (history || []).slice(-10);
  for (const item of recent) {
    if (item && item.text && item.text.trim()) {
      const role = item.role === 'assistant' || item.role === 'model' ? 'assistant' : 'user';
      messages.push({
        role,
        content: item.text.trim(),
      });
    }
  }

  messages.push({
    role: 'user',
    content: currentMessage.trim(),
  });

  return messages;
}

/**
 * Determines error type for circuit breaker and failover logic
 */
export function classifyApiError(err: any): {
  isQuota: boolean;
  isAuth: boolean;
  isTransient: boolean;
  status: number;
  message: string;
} {
  const status = Number(err?.status || err?.code || (err?.response && err?.response.status) || 0);
  const message = String(err?.message || (err?.error && err?.error.message) || '');
  const lowerMsg = message.toLowerCase();

  const isQuota =
    status === 429 ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit');

  const isAuth =
    status === 401 ||
    status === 403 ||
    lowerMsg.includes('401') ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('invalid_api_key') ||
    lowerMsg.includes('permission_denied');

  const isTransient =
    status === 500 ||
    status === 503 ||
    status === 504 ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('fetch failed');

  return { isQuota, isAuth, isTransient, status, message };
}

/**
 * Generates an informative, polite explanation when all providers fail or are restricted
 */
export function buildMultiProviderFailureReply(
  language: AssistantLanguage,
  reason: 'quota' | 'paid_blocked' | 'no_credentials' | 'connection_error',
  prompt: string
): { reply: string; note: string } {
  const isEnglish = language === 'english';
  const offlineFallback = getFallbackAngelReply(prompt, language);

  let note = '';
  let prefix = '';

  switch (reason) {
    case 'quota':
      note = isEnglish
        ? 'Gemini free tier quota limit reached on API key. Serving Angel smart offline response.'
        : 'Gemini free tier daily quota limit aa gaya hai. Angel offline engine se reply diya gaya.';
      prefix = isEnglish
        ? 'Notice: Cloud AI quota limit reached. '
        : 'Note: AI quota limit aa gaya hai. ';
      break;
    case 'paid_blocked':
      note = isEnglish
        ? "OpenAI is configured but 'Allow paid API usage' is disabled to prevent charges."
        : "'Allow paid API usage' OFF hai isliye OpenAI call block ki gayi hai.";
      prefix = isEnglish
        ? "Notice: Paid API access is paused by safety policy. "
        : "Note: Paid API safety switch OFF hai. ";
      break;
    case 'no_credentials':
      note = isEnglish
        ? 'No active AI API keys configured. Running on Angel local offline engine.'
        : 'Koi API key set nahi hai. Angel offline engine chal raha hai.';
      break;
    default:
      note = isEnglish
        ? 'Temporary network issue connecting to AI services. Running on Angel local offline engine.'
        : 'Network issue ki wajah se offline engine se reply mila.';
      break;
  }

  return {
    reply: offlineFallback,
    note,
  };
}
