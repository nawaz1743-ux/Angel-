/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { getFallbackAngelReply, isDateOrTimeQuery, getLocalDateAnswer } from './src/utils/assistant-logic.ts';
import {
  planProviderExecutionOrder,
  formatHistoryForGemini,
  formatHistoryForOpenAI,
  classifyApiError,
  buildMultiProviderFailureReply,
  ProviderStatusInfo,
  ProviderPriority,
  AssistantLanguage,
  GEMINI_FREE_TIER_MODELS,
  OPENAI_MODELS,
} from './src/utils/multi-provider-engine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '15mb' }));

// 1. Google Gemini Client (Free-Tier eligible)
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('GEMINI_API_KEY is not set. Gemini cloud calls will be bypassed.');
}

// 2. OpenAI Client (Requires paid credits / explicit user authorization)
const openaiApiKey = process.env.OPENAI_API_KEY;
let openAiClient: OpenAI | null = null;

if (openaiApiKey) {
  openAiClient = new OpenAI({
    apiKey: openaiApiKey,
  });
}

// Circuit breaker state to protect against rapid quota loops and auth thrashing
let geminiQuotaCooldownUntil = 0;
let openAiAuthFailed = false;

/**
 * System prompt definition for Angel AI Assistant
 */
function getAngelSystemInstruction(language: string = 'hinglish', personality: string = 'friendly'): string {
  const isEnglish = language === 'english';

  const languageRule = isEnglish
    ? `LANGUAGE REQUIREMENT - ENGLISH MODE (SECOND PRIORITY):
- You must generate your response directly in natural, fluent English.
- Do NOT use Hindi words or Hinglish phrases.
- Example tone and response:
  "Sir, your task is complete. What would you like to do next?"`
    : `LANGUAGE REQUIREMENT - HINGLISH MODE (DEFAULT / FIRST PRIORITY):
- You must generate your response directly in natural conversational Hinglish (a blend of Hindi and English widely spoken in India).
- STRICT ROMAN SCRIPT RULE: You MUST use Roman script (Latin alphabet) ONLY.
- NEVER generate Devanagari characters anywhere in your response (e.g., do NOT use Devanagari letters like नमस्ते, एंजेल, कार्य, हाँ, etc.).
- All Hindi words must be written strictly in Roman letters (e.g., "Hello", "Angel", "Aapka", "Haan", "Shukriya", "Bilkul").
- Do NOT use "Namaste" or unwanted greetings in default responses. Greet with "Hello Sir!" or "Hello!" in Roman script.
- Example tone and response:
  "Hello Sir! Aapka task complete ho gaya hai. Ab aage kya karna hai?"`;

  return `You are Angel, a practical, intelligent, polite, and highly capable female personal AI assistant designed for Android smartphones.

Core Capabilities & Assistance Scope:
1. General Questions & Everyday Tasks:
   - Answer general queries, everyday tasks, science, general knowledge, daily organization, and life questions accurately.
2. Learning & Study:
   - Help users learn, study, explain complex topics simply, and break down problems step-by-step.
3. Daily Planning & Productivity:
   - Organize schedules, plan daily routines, track tasks, and suggest efficient workflows.
4. Coding & Programming:
   - Provide clean, modern code snippets (React, JavaScript, TypeScript, Python, HTML/CSS, Android, etc.), explain concepts clearly, and help debug errors.
5. Tasks, Notes & Reminders:
   - Manage task lists, alarms, notifications, and personal notes.
6. Supported Phone Actions:
   - Safely prepare Android dialer calls (tel:) and WhatsApp messages (whatsapp://, wa.me) with confirmation.
7. General-Purpose Role:
   - You are a versatile general-purpose personal assistant. Do NOT assume the user only wants to work on the Angel project or that every message is about this application.
   - However, if the user explicitly asks about their current Angel assistant project, recognize the features and capabilities of this running application and answer accurately without inventing details or claiming to build a new mobile app from scratch.

Current Application Context:
- Embedded assistant inside "Angel AI Assistant".
- Supported local features: Tasks, Notes, Reminders with browser chime, Phone/WhatsApp intent dispatch, Natural female text-to-speech, Hands-free wake word ("Angel"), Screen/vision analysis, and Autonomous multi-step workflows.

Core Identity & Persona:
- Name: Angel.
- Persona: Warm, polite, respectful ("Sir" in Hinglish/English when addressing the user), sharp, empathetic, encouraging, and intelligent female assistant.
- Personality Mode: ${personality.toUpperCase()}.

${languageRule}

Strict Behavioral Principles:
1. Work WITH the user, not merely talking or lecturing:
   - Follow the multi-step workflow for complex goals: UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> CORRECT -> FINAL REVIEW.
2. NEVER claim an action was already completed externally:
   - Always state: ${isEnglish ? '"I have prepared this for you. Please review and confirm below."' : '"Maine prepare kar diya hai. Kripya niche review karke confirm karein."'}
3. Greeting:
   - When greeting, use "Hello Sir!" without using "Namaste" or any Devanagari characters.

Format: Keep responses crisp, well-structured, mobile-friendly, and easy to read on an Android phone screen.`;
}

/**
 * Endpoint: /api/providers
 * Returns live status of AI providers (Gemini, OpenAI, Offline engine)
 */
app.get('/api/providers', (_req: Request, res: Response) => {
  const now = Date.now();
  const isGeminiQuotaExhausted = geminiQuotaCooldownUntil > now;

  const providers: ProviderStatusInfo[] = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      isConfigured: Boolean(geminiApiKey),
      status: !geminiApiKey
        ? 'unconfigured'
        : isGeminiQuotaExhausted
        ? 'quota_exhausted'
        : 'ready',
      isFreeTierEligible: true,
      details: isGeminiQuotaExhausted
        ? 'Free tier quota exhausted (429 received from Google API). Will retry automatically.'
        : geminiApiKey
        ? 'Free-tier eligible (gemini-2.5-flash, gemini-3.5-flash-lite, gemini-2.0-flash).'
        : 'GEMINI_API_KEY not configured.',
      supportedModels: GEMINI_FREE_TIER_MODELS,
    },
    {
      id: 'openai',
      name: 'OpenAI API',
      isConfigured: Boolean(openaiApiKey),
      status: !openaiApiKey
        ? 'unconfigured'
        : openAiAuthFailed
        ? 'auth_error'
        : 'ready',
      isFreeTierEligible: false,
      details: !openaiApiKey
        ? 'OPENAI_API_KEY not configured on server.'
        : openAiAuthFailed
        ? 'Invalid or expired OPENAI_API_KEY (401 received).'
        : 'Requires explicit paid API authorization. Free ChatGPT accounts do not provide free API access.',
      supportedModels: OPENAI_MODELS,
    },
  ];

  res.json({
    providers,
    hasGeminiKey: Boolean(geminiApiKey),
    hasOpenAiKey: Boolean(openaiApiKey),
    geminiQuotaCooldownRemainingMs: Math.max(0, geminiQuotaCooldownUntil - now),
    openAiAuthFailed,
  });
});

/**
 * Endpoint: /api/chat
 * Multi-provider conversation route with automated fallback between Gemini and OpenAI,
 * strict cost safety gating, and smart offline backup.
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      message,
      history = [],
      language = 'hinglish',
      personality = 'friendly',
      providerPriority = 'auto',
      allowPaidUsage = false,
    } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message text is required' });
      return;
    }

    const selectedLang: AssistantLanguage = language === 'english' ? 'english' : 'hinglish';

    // 1. FAST PATH: Serve deterministic date/time requests locally BEFORE calling cloud APIs
    if (isDateOrTimeQuery(message)) {
      const localReply = getLocalDateAnswer(message, selectedLang);
      res.json({
        reply: localReply,
        provider: 'angel-local-date-engine',
        isRealAi: false,
        timestamp: Date.now(),
      });
      return;
    }

    // 2. Plan Multi-Provider Execution Order
    const { candidates, blockedPaidProviderReason } = planProviderExecutionOrder({
      hasGeminiKey: Boolean(ai),
      hasOpenAiKey: Boolean(openAiClient),
      allowPaidUsage: Boolean(allowPaidUsage),
      priority: (providerPriority as ProviderPriority) || 'auto',
      geminiQuotaCooldownUntil,
      openAiAuthFailed,
    });

    const systemInstruction = getAngelSystemInstruction(selectedLang, personality);
    const rawHistory = Array.isArray(history) ? history : [];

    let generatedText: string | null = null;
    let successfulProviderInfo: string | null = null;
    let lastErrorType: 'quota' | 'paid_blocked' | 'no_credentials' | 'connection_error' = 'connection_error';

    // 3. Execute planned candidates in sequence
    for (const candidate of candidates) {
      if (candidate.provider === 'gemini' && ai) {
        try {
          const contents = formatHistoryForGemini(rawHistory, message);
          const response = await ai.models.generateContent({
            model: candidate.model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });

          if (response && response.text) {
            generatedText = response.text;
            successfulProviderInfo = `Gemini (${candidate.model})`;
            break;
          }
        } catch (err: any) {
          const classified = classifyApiError(err);
          console.warn(`Gemini model ${candidate.model} failed (${classified.status}):`, classified.message.slice(0, 140));

          if (classified.isQuota) {
            geminiQuotaCooldownUntil = Date.now() + 60000; // 1 min circuit breaker
            lastErrorType = 'quota';
            // Continue cascade to try OpenAI or other eligible models
          }
        }
      } else if (candidate.provider === 'openai' && openAiClient) {
        // Strict Cost Safety Gate
        if (!allowPaidUsage) {
          console.warn('Blocked paid OpenAI invocation because allowPaidUsage is false.');
          lastErrorType = 'paid_blocked';
          continue;
        }

        try {
          const messages = formatHistoryForOpenAI(systemInstruction, rawHistory, message);
          const completion = await openAiClient.chat.completions.create({
            model: candidate.model,
            messages: messages as any,
            temperature: 0.7,
          });

          const reply = completion.choices[0]?.message?.content;
          if (reply) {
            generatedText = reply;
            successfulProviderInfo = `OpenAI (${candidate.model})`;
            break;
          }
        } catch (err: any) {
          const classified = classifyApiError(err);
          console.warn(`OpenAI model ${candidate.model} failed (${classified.status}):`, classified.message.slice(0, 140));

          if (classified.isAuth) {
            openAiAuthFailed = true; // Stop retrying invalid credentials indefinitely
          }
          if (classified.isQuota) {
            lastErrorType = 'quota';
          }
        }
      }
    }

    // 4. Return real AI response if any candidate succeeded
    if (generatedText && successfulProviderInfo) {
      res.json({
        reply: generatedText,
        provider: successfulProviderInfo,
        isRealAi: true,
        timestamp: Date.now(),
      });
      return;
    }

    // 5. Fallback Handler: When all cloud providers fail, hit quota, or are restricted by safety policy
    if (blockedPaidProviderReason && candidates.length === 0) {
      lastErrorType = 'paid_blocked';
    } else if (!ai && !openAiClient) {
      lastErrorType = 'no_credentials';
    }

    const failureDetails = buildMultiProviderFailureReply(selectedLang, lastErrorType, message);

    res.json({
      reply: failureDetails.reply,
      provider: 'angel-smart-offline',
      isRealAi: false,
      isQuotaExceeded: lastErrorType === 'quota',
      isPaidBlocked: lastErrorType === 'paid_blocked',
      note: blockedPaidProviderReason || failureDetails.note,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Fatal error in /api/chat:', error);
    const fallbackText = getFallbackAngelReply(
      req.body?.message || '',
      req.body?.language === 'english' ? 'english' : 'hinglish'
    );
    res.status(200).json({
      reply: fallbackText,
      provider: 'angel-smart-offline',
      isRealAi: false,
      error: error?.message || 'Request handled by Angel offline engine.',
      timestamp: Date.now(),
    });
  }
});

/**
 * Endpoint: /api/screen-analyze
 * Analyzes screenshots or mobile camera captures
 */
app.post('/api/screen-analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt = 'What is on this mobile screen and how can I help the user?' } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'Image data is required' });
      return;
    }

    if (!ai) {
      res.json({
        analysis: 'Screen Assistant Preview: Angel has detected your uploaded screenshot. To enable full AI vision analysis, ensure GEMINI_API_KEY is active in your environment. You can also ask Angel direct questions about this screen!',
        provider: 'offline-engine',
      });
      return;
    }

    // Strip header if provided in data URL format
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '');

    let response: any = null;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
          {
            text: `You are Angel, analyzing this Android smartphone screen. 
            User prompt: ${prompt}
            Please provide:
            1. Short summary of what is visible on this screen.
            2. Any key text or alerts detected.
            3. Recommended next step or action for the user in clear, friendly Hinglish/Hindi.`,
          },
        ],
      },
    });
    } catch {
      // Fallback
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType } },
            { text: prompt },
          ],
        },
      });
    }

    res.json({
      analysis: response?.text || 'Screen analysis complete.',
      provider: 'gemini-vision',
    });
  } catch (error: any) {
    console.error('Error in /api/screen-analyze:', error);
    res.status(500).json({
      error: 'Failed to analyze screen capture',
      details: error.message || String(error),
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Angel Android AI Assistant',
    hasGeminiKey: Boolean(geminiApiKey),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Angel Android AI Assistant server running on port ${port} (dev: ${isDev})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
