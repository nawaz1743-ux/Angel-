/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planProviderExecutionOrder,
  formatHistoryForGemini,
  formatHistoryForOpenAI,
  classifyApiError,
  buildMultiProviderFailureReply,
  GEMINI_FREE_TIER_MODELS,
  OPENAI_MODELS,
  type ChatTurn,
} from './multi-provider-engine.ts';

// ============================================================================
// MULTI-PROVIDER AI SYSTEM VERIFICATION TESTS
// ============================================================================

test('Multi-Provider: Default plan prioritizes Gemini free-tier models and blocks OpenAI by default', () => {
  const plan = planProviderExecutionOrder({
    hasGeminiKey: true,
    hasOpenAiKey: true,
    allowPaidUsage: false, // Strict default
    priority: 'auto',
  });

  // Must only include Gemini models because allowPaidUsage is false
  assert.ok(plan.candidates.length > 0, 'Should have candidate models');
  assert.equal(plan.candidates.every((c) => c.provider === 'gemini'), true, 'All candidates must be Gemini when paid usage is disabled');
  assert.equal(plan.candidates[0].model, GEMINI_FREE_TIER_MODELS[0]);
  assert.deepEqual(GEMINI_FREE_TIER_MODELS, ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], 'Primary and fallback Gemini models must both be configured');
  assert.equal(plan.candidates.filter((c) => c.provider === 'gemini').length, 2, 'Both Gemini primary and fallback models must be planned');
  assert.equal(plan.candidates[0].isPaid, false, 'Gemini models must be flagged as free-tier');
});

test('Multi-Provider: Gemini quota exhaustion (429) triggers fallback to OpenAI if paid usage is authorized', () => {
  const cooldownUntil = Date.now() + 60000; // Simulated active 429 cooldown

  const plan = planProviderExecutionOrder({
    hasGeminiKey: true,
    hasOpenAiKey: true,
    allowPaidUsage: true, // User explicitly granted paid permission
    priority: 'auto',
    geminiQuotaCooldownUntil: cooldownUntil,
  });

  // Gemini is cooled down due to 429 quota exhaustion, so it must fall back to OpenAI
  assert.ok(plan.candidates.length > 0, 'Should have fallback candidates');
  assert.equal(plan.candidates[0].provider, 'gemini', 'Try Gemini model cascade before any paid provider');
  assert.deepEqual(plan.candidates.filter((c) => c.provider === 'gemini').map((c) => c.model), GEMINI_FREE_TIER_MODELS);
  assert.equal(plan.candidates[2].provider, 'openai', 'OpenAI may follow only when paid usage is explicitly authorized');
  assert.equal(plan.candidates[2].model, OPENAI_MODELS[0]);
  assert.equal(plan.candidates[2].isPaid, true);
});

test('Multi-Provider Cost Control: Paid requests are strictly blocked when allowPaidUsage is false', () => {
  const cooldownUntil = Date.now() + 60000;

  const plan = planProviderExecutionOrder({
    hasGeminiKey: true,
    hasOpenAiKey: true,
    allowPaidUsage: false, // Strict cost protection
    priority: 'auto',
    geminiQuotaCooldownUntil: cooldownUntil,
  });

  // Both Gemini is 429 and OpenAI is not authorized
  assert.equal(plan.candidates.length, 2, 'Both configured Gemini models should still be attempted during cooldown');
  assert.ok(plan.candidates.every((c) => c.provider === 'gemini'), 'Paid providers must remain blocked without consent');
  assert.ok(plan.blockedPaidProviderReason.includes('Allow paid API usage'));
});

test('Multi-Provider: OpenAI priority requests OpenAI first if authorized, else falls back to Gemini free tier', () => {
  // Case A: User allowed paid usage and set OpenAI priority
  const planWithConsent = planProviderExecutionOrder({
    hasGeminiKey: true,
    hasOpenAiKey: true,
    allowPaidUsage: true,
    priority: 'openai-first',
  });

  assert.equal(planWithConsent.candidates[0].provider, 'openai', 'OpenAI should be first candidate');
  assert.equal(planWithConsent.candidates[planWithConsent.candidates.length - 1].provider, 'gemini', 'Gemini should be secondary fallback');

  // Case B: User set OpenAI priority but left allowPaidUsage false
  const planWithoutConsent = planProviderExecutionOrder({
    hasGeminiKey: true,
    hasOpenAiKey: true,
    allowPaidUsage: false,
    priority: 'openai-first',
  });

  assert.ok(planWithoutConsent.blockedPaidProviderReason, 'Should set blocked explanation');
  assert.equal(planWithoutConsent.candidates[0].provider, 'gemini', 'Should safely use Gemini free tier instead of charging user');
});

test('Multi-Provider: OpenAI unavailable credentials does not throw and skips OpenAI', () => {
  const plan = planProviderExecutionOrder({
    hasGeminiKey: true,
    hasOpenAiKey: false, // No OpenAI key
    allowPaidUsage: true,
    priority: 'auto',
  });

  assert.ok(plan.candidates.length > 0);
  assert.equal(plan.candidates.every((c) => c.provider === 'gemini'), true);
});

test('Multi-Provider: Auth failures (401) do not retry indefinitely', () => {
  const plan = planProviderExecutionOrder({
    hasGeminiKey: false,
    hasOpenAiKey: true,
    allowPaidUsage: true,
    priority: 'auto',
    openAiAuthFailed: true, // Permanent 401 failure recorded
  });

  assert.equal(plan.candidates.length, 0, 'Must not retry OpenAI when auth failure is active');
});

test('Multi-Provider: All providers unavailable returns clear, polite explanation in Roman script without crashing', () => {
  // Hinglish
  const failureHinglish = buildMultiProviderFailureReply('hinglish', 'quota', 'aaj kya plan hai');
  assert.ok(failureHinglish.reply.length > 0);
  assert.equal(/[\u0900-\u097F]/.test(failureHinglish.reply), false, 'Must not contain Devanagari');
  assert.ok(failureHinglish.note.includes('quota'));

  // English
  const failureEnglish = buildMultiProviderFailureReply('english', 'paid_blocked', 'help me with coding');
  assert.ok(failureEnglish.reply.length > 0);
  assert.ok(failureEnglish.note.includes('Allow paid API usage'));
});

test('Multi-Provider Conversation Continuity: History is formatted cleanly for both Gemini and OpenAI without data loss', () => {
  const sampleHistory: ChatTurn[] = [
    { role: 'user', text: 'Hello Angel!' },
    { role: 'assistant', text: 'Hello Sir! Main Angel hoon, aapki personal AI assistant.' },
    { role: 'user', text: 'Mujhe React state management samjhao.' },
    { role: 'assistant', text: 'React mein state ek variable hota hai jo component ke render ko control karta hai.' },
  ];
  const currentMsg = 'Can you show a simple useState example?';
  const sysPrompt = 'You are Angel AI assistant.';

  // 1. Gemini format verification
  const geminiHistory = formatHistoryForGemini(sampleHistory, currentMsg);
  assert.equal(geminiHistory.length, 5); // 4 history turns + 1 current user prompt
  assert.equal(geminiHistory[0].role, 'user');
  assert.equal(geminiHistory[1].role, 'model');
  assert.equal(geminiHistory[4].role, 'user');
  assert.equal(geminiHistory[4].parts[0].text, currentMsg);

  // 2. OpenAI format verification
  const openAiHistory = formatHistoryForOpenAI(sysPrompt, sampleHistory, currentMsg);
  assert.equal(openAiHistory.length, 6); // 1 system + 4 history + 1 current user prompt
  assert.equal(openAiHistory[0].role, 'system');
  assert.equal(openAiHistory[openAiHistory.length - 1].role, 'user');
  assert.equal(openAiHistory[openAiHistory.length - 1].content, currentMsg);
});

test('Multi-Provider: classifyApiError correctly classifies 429, 401, and 503 errors', () => {
  // 429 Quota
  const quotaErr = classifyApiError({ status: 429, message: 'Resource exhausted: daily quota exceeded' });
  assert.equal(quotaErr.isQuota, true);
  assert.equal(quotaErr.isAuth, false);

  // 401 Auth
  const authErr = classifyApiError({ status: 401, message: 'Incorrect API key provided' });
  assert.equal(authErr.isAuth, true);
  assert.equal(authErr.isQuota, false);

  // 503 Transient
  const transientErr = classifyApiError({ status: 503, message: 'Service unavailable' });
  assert.equal(transientErr.isTransient, true);
});
