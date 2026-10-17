/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContactItem, ActionPayload, ActionType, ReminderItem } from '../types/assistant.ts';

export interface IntentUrls {
  whatsAppDirect: string;
  whatsAppWebFallback: string;
  tel: string;
  sms: string;
}

/**
 * Default sample contacts for immediate fast lookup and voice command testing.
 */
export const INITIAL_CONTACTS: ContactItem[] = [
  { id: 'c1', name: 'Rahul Sharma', phone: '+919876543210', relation: 'Friend' },
  { id: 'c2', name: 'Rahul Verma', phone: '+919811122233', relation: 'Colleague' },
  { id: 'c3', name: 'Priya Singh', phone: '+919876501234', relation: 'Sister' },
  { id: 'c4', name: 'Mom', phone: '+919822001122', relation: 'Family' },
  { id: 'c5', name: 'Office Support', phone: '+911145678900', relation: 'Work' },
];

/**
 * Searches contacts by query (case-insensitive fuzzy match on name, phone, or relation).
 */
export function searchContacts(contacts: ContactItem[], query: string): ContactItem[] {
  if (!query) return [];
  const q = query.trim().toLowerCase();
  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.relation && c.relation.toLowerCase().includes(q)) ||
      c.phone.includes(q)
  );
}

/**
 * Cleans phone number by stripping spaces, hyphens, and brackets.
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Validates international or local phone numbers.
 * Supports numbers with or without leading + and country code.
 */
export function validatePhoneNumber(phone: string): boolean {
  const sanitized = sanitizePhoneNumber(phone);
  // Matches e.g. +919876543210, 9876543210, etc. (min 7 digits, max 15 digits)
  return /^\+?[0-9]{7,15}$/.test(sanitized);
}

/**
 * Generates Android WhatsApp intent URI and standard wa.me web fallback URI.
 * On Android devices, whatsapp:// opens the WhatsApp application directly.
 */
export function buildWhatsAppUrl(phone: string, text: string): { appIntent: string; webFallback: string } {
  let cleaned = sanitizePhoneNumber(phone);
  // Strip leading '+' for wa.me API format
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  const encodedText = encodeURIComponent(text.trim());
  const appIntent = cleaned 
    ? `whatsapp://send?phone=${cleaned}&text=${encodedText}` 
    : `whatsapp://send?text=${encodedText}`;
  const webFallback = cleaned 
    ? `https://wa.me/${cleaned}?text=${encodedText}` 
    : `https://wa.me/?text=${encodedText}`;

  return { appIntent, webFallback };
}

/**
 * Generates Android phone dialer intent URI.
 */
export function buildTelUrl(phone: string): string {
  const cleaned = sanitizePhoneNumber(phone);
  return `tel:${cleaned}`;
}

/**
 * Generates Android SMS intent URI.
 */
export function buildSmsUrl(phone: string, body: string): string {
  const cleaned = sanitizePhoneNumber(phone);
  const encodedBody = encodeURIComponent(body.trim());
  return `sms:${cleaned}?body=${encodedBody}`;
}

/**
 * Formats a YYYY-MM-DD date string into long format (e.g., "October 17, 2026").
 */
export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Not set';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return dateStr;
}

/**
 * Detects standalone wake word phrases ("Angel", "Hey Angel", "Hi Angel", "Ok Angel", "एंजेल").
 */
export function isWakeWord(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().replace(/[!.,?]+$/, '');
  return /^(?:hey\s+|hi\s+|ok\s+|okay\s+)?(?:angel|एंजेल)$/i.test(clean);
}

/**
 * Strips leading wake word prefix from a spoken prompt ("Angel, remind me..." -> "remind me...").
 */
export function stripWakeWord(text: string): string {
  if (!text) return '';
  return text
    .replace(/^(?:hey\s+|hi\s+|hello\s+|ok\s+|okay\s+)?(?:angel|एंजेल)[,\s]*/i, '')
    .trim();
}

/**
 * Checks if a spoken phrase starts with a wake word prefix ("Angel, ...", "Hey Angel ...", "एंजेल ...").
 */
export function hasWakeWordPrefix(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  return /^(?:hey\s+|hi\s+|hello\s+|ok\s+|okay\s+)?(?:angel|एंजेल)[\s,.]/i.test(clean);
}

/**
 * Generates Android Maps intent URI and Google Maps web fallback.
 */
export function buildMapUrl(location: string): { appIntent: string; webFallback: string } {
  const encoded = encodeURIComponent(location.trim());
  return {
    appIntent: `geo:0,0?q=${encoded}`,
    webFallback: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}

export interface ParsedReminder {
  title: string;
  time: string; // HH:mm (24h)
  date: string; // YYYY-MM-DD (local)
  dueTimestamp: number; // epoch ms
  isRelative: boolean;
  relativeDescription?: string;
}

/**
 * Returns YYYY-MM-DD in local device timezone (prevents UTC date shift issues).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns HH:mm (24-hour) in local device timezone.
 */
export function getLocalTimeString(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Intelligently parses natural-language reminder commands:
 * - Relative time: "in 1 minute", "in 5 minutes", "in 30 seconds", "in 2 hours", "5 minute baad", "1 minute baad", etc.
 * - Absolute time: "at 6:00 pm", "18:00", "shaam 6 baje", "subah 8 baje", "kal subah 9 baje"
 * - Extracts clean title, exact epoch dueTimestamp, and friendly relative description.
 */
export function parseReminderDetails(
  userText: string,
  baseDate: Date = new Date()
): ParsedReminder {
  const raw = userText.trim();
  const lower = raw.toLowerCase();

  let offsetMs = 0;
  let isRelative = false;
  let relativeDescription = '';
  let matchedTimePhrase = '';

  // 1. Relative duration in English & Hindi/Hinglish
  const relMinMatch = raw.match(/\bin\s+(\d+)\s*(?:minutes?|mins?|m)\b/i);
  const relSecMatch = raw.match(/\bin\s+(\d+)\s*(?:seconds?|secs?|s)\b/i);
  const relHrMatch = raw.match(/\bin\s+(\d+)\s*(?:hours?|hrs?|h)\b/i);
  const relOneMinMatch = raw.match(/\bin\s+(?:an?|one)\s*(?:minute|min)\b/i);
  const relOneHrMatch = raw.match(/\bin\s+(?:an?|one)\s*(?:hour|hr)\b/i);
  const relHalfHrMatch = raw.match(/\bin\s+half\s+an?\s+hour\b/i);

  const hiMinMatch = raw.match(/(\d+)\s*(?:minute|min|minutes|m)\s*(?:baad|ke\s+baad)\b/i);
  const hiSecMatch = raw.match(/(\d+)\s*(?:second|sec|seconds|s)\s*(?:baad|ke\s+baad)\b/i);
  const hiHrMatch = raw.match(/(\d+)\s*(?:ghante|ghanta|hours?|hrs?)\s*(?:baad|ke\s+baad)\b/i);
  const hiEkMinMatch = raw.match(/ek\s+(?:minute|min)\s*(?:baad|ke\s+baad)\b/i);
  const hiAadhaHrMatch = raw.match(/aadhe\s+(?:ghante|ghanta)\s*(?:baad|ke\s+baad)\b/i);
  const hiEkHrMatch = raw.match(/ek\s+(?:ghante|ghanta)\s*(?:baad|ke\s+baad)\b/i);

  if (relMinMatch) {
    const mins = parseInt(relMinMatch[1], 10);
    offsetMs = mins * 60 * 1000;
    isRelative = true;
    relativeDescription = `in ${mins} minute${mins > 1 ? 's' : ''}`;
    matchedTimePhrase = relMinMatch[0];
  } else if (relSecMatch) {
    const secs = parseInt(relSecMatch[1], 10);
    offsetMs = secs * 1000;
    isRelative = true;
    relativeDescription = `in ${secs} second${secs > 1 ? 's' : ''}`;
    matchedTimePhrase = relSecMatch[0];
  } else if (relHrMatch) {
    const hrs = parseInt(relHrMatch[1], 10);
    offsetMs = hrs * 3600 * 1000;
    isRelative = true;
    relativeDescription = `in ${hrs} hour${hrs > 1 ? 's' : ''}`;
    matchedTimePhrase = relHrMatch[0];
  } else if (relOneMinMatch) {
    offsetMs = 60 * 1000;
    isRelative = true;
    relativeDescription = 'in 1 minute';
    matchedTimePhrase = relOneMinMatch[0];
  } else if (relOneHrMatch) {
    offsetMs = 3600 * 1000;
    isRelative = true;
    relativeDescription = 'in 1 hour';
    matchedTimePhrase = relOneHrMatch[0];
  } else if (relHalfHrMatch) {
    offsetMs = 30 * 60 * 1000;
    isRelative = true;
    relativeDescription = 'in 30 minutes';
    matchedTimePhrase = relHalfHrMatch[0];
  } else if (hiMinMatch) {
    const mins = parseInt(hiMinMatch[1], 10);
    offsetMs = mins * 60 * 1000;
    isRelative = true;
    relativeDescription = `${mins} minute baad`;
    matchedTimePhrase = hiMinMatch[0];
  } else if (hiSecMatch) {
    const secs = parseInt(hiSecMatch[1], 10);
    offsetMs = secs * 1000;
    isRelative = true;
    relativeDescription = `${secs} second baad`;
    matchedTimePhrase = hiSecMatch[0];
  } else if (hiHrMatch) {
    const hrs = parseInt(hiHrMatch[1], 10);
    offsetMs = hrs * 3600 * 1000;
    isRelative = true;
    relativeDescription = `${hrs} ghante baad`;
    matchedTimePhrase = hiHrMatch[0];
  } else if (hiEkMinMatch) {
    offsetMs = 60 * 1000;
    isRelative = true;
    relativeDescription = '1 minute baad';
    matchedTimePhrase = hiEkMinMatch[0];
  } else if (hiAadhaHrMatch) {
    offsetMs = 30 * 60 * 1000;
    isRelative = true;
    relativeDescription = 'aadhe ghante baad';
    matchedTimePhrase = hiAadhaHrMatch[0];
  } else if (hiEkHrMatch) {
    offsetMs = 3600 * 1000;
    isRelative = true;
    relativeDescription = '1 ghante baad';
    matchedTimePhrase = hiEkHrMatch[0];
  }

  let dueTimestamp: number;
  let timeStr: string;
  let dateStr: string;

  if (isRelative) {
    dueTimestamp = baseDate.getTime() + offsetMs;
    const dueDate = new Date(dueTimestamp);
    timeStr = getLocalTimeString(dueDate);
    dateStr = getLocalDateString(dueDate);
  } else {
    // 2. Absolute time matching (e.g. 6:00 pm, 18:30, 7 am, shaam 6 baje)
    let hours = 18;
    let minutes = 0;
    const timeMatch = raw.match(/(?:at\s+|around\s+|ko\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|o'clock)?/i);

    if (timeMatch) {
      matchedTimePhrase = timeMatch[0];
      hours = parseInt(timeMatch[1], 10);
      minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const modifier = timeMatch[3]?.toLowerCase();

      if (modifier === 'pm' && hours < 12) hours += 12;
      if (modifier === 'am' && hours === 12) hours = 0;
      if (
        (modifier === 'baje' || !modifier) &&
        (lower.includes('shaam') || lower.includes('raat') || lower.includes('dopahar') || lower.includes('evening') || lower.includes('night')) &&
        hours < 12
      ) {
        hours += 12;
      }
    }

    const isTomorrow = lower.includes('tomorrow') || lower.includes('kal');
    const targetDate = new Date(baseDate);
    targetDate.setHours(hours, minutes, 0, 0);

    // If time has already passed today and no specific date was given, schedule for tomorrow
    if (!isTomorrow && targetDate.getTime() <= baseDate.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (isTomorrow) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    dueTimestamp = targetDate.getTime();
    timeStr = getLocalTimeString(targetDate);
    dateStr = getLocalDateString(targetDate);
  }

  // 3. Extract title cleanly
  let title = raw;
  // Remove assistant names: "Angel, ", "Hey Angel, "
  title = title.replace(/^(?:angel|hey angel|hello angel)[,\s]*/i, '');
  // Remove matched time phrase
  if (matchedTimePhrase) {
    title = title.replace(matchedTimePhrase, ' ');
  }
  // Remove time / day words
  title = title.replace(/\b(tomorrow|kal|today|aaj|shaam|subah|dopahar|raat|evening|morning|afternoon|night)\b/gi, ' ');
  // Remove reminder intent verbs
  title = title.replace(/\b(?:remind me to|remind me for|remind me about|remind me|set reminder for|set reminder to|set reminder|reminder for|reminder to|reminder|set alarm for|set alarm to|set alarm|alarm for|alarm to|alarm|yaad dilana ki|yaad dilana|remind karo ki|remind karo)\b/gi, ' ');
  // Remove filler prefixes and suffixes
  title = title
    .replace(/^\s*(?:to|ki|that|for|about|ke liye)\s+/i, '')
    .replace(/\s+(?:ke liye|ko|par|pe|kripya|please|urgent|now|abhi)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) {
    title = 'Angel Reminder';
  }

  return {
    title,
    time: timeStr,
    date: dateStr,
    dueTimestamp,
    isRelative,
    relativeDescription,
  };
}

/**
 * Checks reminders against the current timestamp.
 * Returns triggered reminders (due now) and updated reminders list with notified=true.
 * Prevents duplicate alerts and guarantees every due reminder is returned.
 */
export function checkDueReminders(
  reminders: ReminderItem[],
  currentTimestamp: number = Date.now()
): {
  dueReminders: ReminderItem[];
  updatedReminders: ReminderItem[];
} {
  const dueReminders: ReminderItem[] = [];
  const updatedReminders = reminders.map((rem) => {
    // If inactive or already notified, skip
    if (!rem.active || rem.notified) {
      return rem;
    }

    // Determine target epoch ms
    let targetMs = rem.dueTimestamp;
    if (!targetMs && rem.date && rem.time) {
      const [y, m, d] = rem.date.split('-').map(Number);
      const [hh, mm] = rem.time.split(':').map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hh) && !isNaN(mm)) {
        targetMs = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
      }
    }

    if (targetMs && targetMs <= currentTimestamp) {
      const triggered: ReminderItem = {
        ...rem,
        active: false,
        notified: true,
      };
      dueReminders.push(triggered);
      return triggered;
    }

    return rem;
  });

  return { dueReminders, updatedReminders };
}

/**
 * Creates a normalized ReminderItem with exact dueTimestamp and tracking flags.
 */
export function createReminderItem(
  title: string,
  time: string,
  date?: string,
  dueTimestamp?: number
): ReminderItem {
  const now = new Date();
  const localDate = date || getLocalDateString(now);
  let finalTimestamp = dueTimestamp;

  if (!finalTimestamp) {
    const [y, m, d] = localDate.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hh) && !isNaN(mm)) {
      finalTimestamp = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
    } else {
      finalTimestamp = now.getTime();
    }
  }

  return {
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || 'Angel Reminder',
    time,
    date: localDate,
    dueTimestamp: finalTimestamp,
    active: true,
    notified: false,
    createdAt: Date.now(),
  };
}

/**
 * Plays a synthesized multi-tone alarm chime using Web Audio API.
 * Safe, reliable, and does not require external audio assets.
 */
export function playAlarmChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 chime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });

    // Trigger Android device vibration if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400]);
    }
  } catch (err) {
    console.warn('Could not play alarm chime:', err);
  }
}

/**
 * Detects whether a prompt is asking for today's date, day, or current time in Hindi, Hinglish, or English.
 */
export function isDateOrTimeQuery(prompt: string): boolean {
  if (!prompt) return false;
  const lower = prompt.toLowerCase().trim();

  const datePatterns = [
    /aaj\s*(?:ki|ka|ko|kon\s*si|konsi)?\s*(?:taareekh|tareekh|tarikh|tarik|date|din)\b/i,
    /aaj\s*kya\s*(?:date|tarikh|tareekh|tarik|din)\b/i,
    /aaj\s*konsi\s*(?:date|tarikh|tareekh|tarik)\b/i,
    /aaj\s*kaun\s*sa\s*din\b/i,
    /what\s*(?:is|'s)\s*(?:today'?s\s*)?date\b/i,
    /today'?s\s*date\b/i,
    /what\s*date\s*is\s*it\b/i,
    /what\s*day\s*is\s*it\b/i,
    /aaj\s*kya\s*din\s*hai\b/i,
    /aaj\s*ka\s*din\s*kya\s*hai\b/i,
    /aaj\s*ki\s*tarikh\s*batao\b/i,
    /aaj\s*ki\s*date\s*kya\s*hai\b/i,
    /time\s*kya\s*(?:hua|ho\s*raha)\s*hai\b/i,
    /what\s*time\s*is\s*it\b/i,
    /current\s*time\b/i,
  ];

  return datePatterns.some((pattern) => pattern.test(lower));
}

/**
 * Returns a natural, accurate local date or time answer formatted in Asia/Kolkata timezone.
 */
export function getLocalDateAnswer(
  prompt: string,
  language: 'hinglish' | 'hindi' | 'english' = 'hinglish'
): string {
  const now = new Date();

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const formattedDate = now.toLocaleDateString('en-IN', dateOptions);
  const formattedTime = now.toLocaleTimeString('en-IN', timeOptions);

  const lower = (prompt || '').toLowerCase();
  const isTimeOnly =
    lower.includes('time') &&
    !lower.includes('date') &&
    !lower.includes('tarikh') &&
    !lower.includes('din');

  if (isTimeOnly) {
    if (language === 'hindi') {
      return `अभी का समय ${formattedTime} (Asia/Kolkata) हुआ है।`;
    }
    if (language === 'english') {
      return `The current time is ${formattedTime} (IST).`;
    }
    return `Abhi time hua hai ${formattedTime} (IST).`;
  }

  if (language === 'english') {
    return `Today's date is ${formattedDate} and the current time is ${formattedTime}.`;
  }
  return `Aaj ki tarikh hai ${formattedDate} aur abhi time hua hai ${formattedTime}.`;
}

/**
 * Determines a fallback reply if the server or Gemini API is not reachable.
 * Gives Angel an authentic, friendly female voice in Hinglish (Roman script only) or English.
 */
export const ANGEL_WELCOME_MESSAGE_HINGLISH =
  'Hello Sir! Main Angel hoon, aapki personal AI assistant.\nBataiye Sir, main aaj aapki kis kaam mein madad kar sakti hoon?';

export const ANGEL_WELCOME_MESSAGE_ENGLISH =
  'Hello Sir! I am Angel, your personal AI assistant.\nPlease tell me Sir, how may I help you today?';

export function getAngelWelcomeMessage(language: 'hinglish' | 'english' | string = 'hinglish'): string {
  return language === 'english' ? ANGEL_WELCOME_MESSAGE_ENGLISH : ANGEL_WELCOME_MESSAGE_HINGLISH;
}

export function getFallbackAngelReply(
  prompt: string,
  language: 'hinglish' | 'english' | string = 'hinglish'
): string {
  const lower = prompt.toLowerCase().trim();
  const isEnglish = language === 'english';

  // 1. Capability & Feature Queries ("what can you do", "kya kar sakti ho", "help", "madad")
  if (
    lower.includes('what can you do') ||
    lower.includes('kya kar sakti') ||
    lower.includes('kya help') ||
    lower.includes('features') ||
    lower.includes('capabilities') ||
    lower.includes('kaam') ||
    lower.includes('madad')
  ) {
    if (isEnglish) {
      return 'I am your personal AI assistant! I can help you with general questions, everyday tasks, learning and study, daily planning, coding, reminders, and supported phone actions.';
    }
    return 'Main aapki personal AI assistant hoon! Main aapke general sawal, daily tasks, padhai aur learning, planning, coding doubts, reminders aur phone actions mein madad kar sakti hoon.';
  }

  // 2. Greetings / How are you ("kaise ho", "how are you")
  if (lower.includes('kaise ho') || lower.includes('kasi ho') || lower.includes('kaisi ho') || lower.includes('how are you')) {
    if (isEnglish) {
      return "I'm doing wonderful and ready to assist you! What are we working on today?";
    }
    return 'Main ekdum badiya aur ready hoon! Aap bataiye, aaj kya task ya topic par kaam kar rahe hain?';
  }

  // 3. Simple greetings ("hello", "hi", "hey", "namaste")
  if (lower.includes('namaste') || lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('नमस्ते')) {
    if (isEnglish) {
      return ANGEL_WELCOME_MESSAGE_ENGLISH;
    }
    return ANGEL_WELCOME_MESSAGE_HINGLISH;
  }

  // 4. Countdown / Timer request
  if (lower.includes('timer') || lower.includes('countdown')) {
    if (isEnglish) {
      return `Here is a clean React Countdown Timer component:

\`\`\`jsx
import React, { useState, useEffect } from 'react';

export default function CountdownTimer({ initialSeconds = 60 }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  return (
    <div className="p-4 rounded-xl bg-slate-900 text-center">
      <h3 className="text-2xl font-bold">{seconds}s</h3>
      <div className="flex gap-2 justify-center mt-3">
        <button onClick={() => setIsActive(!isActive)} className="px-3 py-1 bg-violet-600 rounded">
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => { setIsActive(false); setSeconds(initialSeconds); }} className="px-3 py-1 bg-slate-700 rounded">
          Reset
        </button>
      </div>
    </div>
  );
}
\`\`\`

You can pass custom initialSeconds directly to use it!`;
    }

    return `Yeh lijiye ek simple aur clean React Countdown Timer component:

\`\`\`jsx
import React, { useState, useEffect } from 'react';

export default function CountdownTimer({ initialSeconds = 60 }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  return (
    <div className="p-4 rounded-xl bg-slate-900 text-center">
      <h3 className="text-2xl font-bold">{seconds}s</h3>
      <div className="flex gap-2 justify-center mt-3">
        <button onClick={() => setIsActive(!isActive)} className="px-3 py-1 bg-violet-600 rounded">
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => { setIsActive(false); setSeconds(initialSeconds); }} className="px-3 py-1 bg-slate-700 rounded">
          Reset
        </button>
      </div>
    </div>
  );
}
\`\`\`

Aap isme custom initialSeconds pass karke direct use kar sakte hain!`;
  }

  if (lower.includes('call') || lower.includes('dial') || lower.includes('कॉल') || lower.includes('phone')) {
    if (isEnglish) {
      return 'You can use the Phone Tools tab to open safe calling and WhatsApp message intents.';
    }
    return 'Calling ke liye aap Phone Tools section se direct dialer intent launch kar sakte hain. Kisko call lagana hai?';
  }

  if (lower.includes('whatsapp') || lower.includes('message')) {
    if (isEnglish) {
      return 'To send a WhatsApp message, you can use my WhatsApp Quick Tool. Enter the recipient number and message, and tap to open WhatsApp!';
    }
    return 'WhatsApp par message bhejne ke liye aap mere WhatsApp Quick Tool ka use kar sakte hain. Number aur message daaliye aur ek tap mein WhatsApp open ho jayega!';
  }

  if (lower.includes('code') || lower.includes('program') || lower.includes('react') || lower.includes('javascript') || lower.includes('python')) {
    if (isEnglish) {
      return 'Coding assistance? Absolutely! Share your syntax error, logic question, or component design, and I will explain it step-by-step.';
    }
    return 'Coding problem? Bilkul! Aap mujhe syntax error, logic question ya koi component design batayein, main step-by-step explain karungi.';
  }

  // Deterministic local response for date and time queries
  if (isDateOrTimeQuery(prompt)) {
    return getLocalDateAnswer(prompt, isEnglish ? 'english' : 'hinglish');
  }

  if (isEnglish) {
    return 'Angel AI service daily free quota limit reached (HTTP 429). Please wait for quota reset. In the meantime, all task, reminder, and phone tools remain fully active!';
  }

  return 'Angel AI service ki daily free quota limit (429 Quota Limit) poori ho gayi hai. Kripya quota reset hone tak wait karein. Tab tak aap Angel ke daily tasks, reminders, aur phone tools use kar sakte hain!';
}

/**
 * Intelligently parses natural language commands in Hindi, Hinglish, and English
 * into structured action intents (Call, WhatsApp, SMS, Reminder, Task, Timer, Map).
 *
 * Rules:
 * - Separates conversational reasoning from executable parameters.
 * - Validates all phone numbers and input values.
 * - Disambiguates contacts when multiple matches are found.
 * - NEVER claims an action has already succeeded; informs user that action is ready for confirmation.
 */
export function parseAssistantAction(
  userText: string,
  contacts: ContactItem[] = INITIAL_CONTACTS,
  language: 'hinglish' | 'english' | string = 'hinglish'
): { action: ActionPayload | null; conversationalReply: string } {
  if (!userText || !userText.trim()) {
    return { action: null, conversationalReply: '' };
  }

  const raw = userText.trim();
  const lower = raw.toLowerCase();
  const isEnglish = language === 'english';

  // Guard against code/programming inquiries with the word "call"
  const isCodingCallQuery =
    lower.includes('call stack') ||
    lower.includes('api call') ||
    lower.includes('function call') ||
    lower.includes('method call') ||
    lower.includes('call by value') ||
    lower.includes('call by reference') ||
    lower.includes('callback') ||
    lower.includes('call apply bind');

  // 1. CALLING INTENT
  if (!isCodingCallQuery && (
    /\b(call|dial|phone lagao|phone karo|call lagao|call karo)\b/i.test(lower) ||
    /ko\s+(call|phone)\s+(lagao|karo|karein|karna hai)/i.test(lower)
  )) {
    // Extract target name or number
    let target = '';
    const match1 = raw.match(/(?:call|dial|phone lagao|phone karo|call lagao|call karo)\s+([a-zA-Z0-9+\s]+)/i);
    const match2 = raw.match(/([a-zA-Z0-9+\s]+)\s+ko\s+(?:call|phone)\s+(?:lagao|karo|karein|karna)/i);

    if (match2 && match2[1]) {
      target = match2[1].trim();
    } else if (match1 && match1[1]) {
      target = match1[1].trim();
    }

    // Clean target from filler words
    target = target.replace(/^(to|ko|kripya|please)\s+/i, '')
      .replace(/\s+(ko|lagao|karo|karein|please|urgent|abhi|now)$/i, '')
      .trim();

    if (target) {
      // Check if target is a raw phone number
      const digitsOnly = target.replace(/[^0-9+]/g, '');
      if (digitsOnly.length >= 7 && validatePhoneNumber(target)) {
        return {
          action: {
            type: 'call',
            contactName: 'Phone Number',
            phoneNumber: sanitizePhoneNumber(target),
            status: 'pending_confirmation',
          },
          conversationalReply: isEnglish
            ? `I have prepared the call for ${target}. Would you like to launch the dialer?`
            : `Maine ${target} ke liye call prepare kar di hai. Kya aap dialer launch karna chahte hain?`,
        };
      }

      // Search contacts by name
      const matches = searchContacts(contacts, target);
      if (matches.length > 1) {
        const namesList = matches.map(m => `${m.name} (${m.relation || m.phone})`).join(', ');
        return {
          action: {
            type: 'call',
            contactName: target,
            matches,
            status: 'disambiguation_needed',
          },
          conversationalReply: isEnglish
            ? `Found ${matches.length} contacts matching "${target}": ${namesList}. Which one would you like to call?`
            : `Aapke contacts mein "${target}" naam ke ${matches.length} log mile: ${namesList}. Aap kise call lagana chahte hain?`,
        };
      } else if (matches.length === 1) {
        const c = matches[0];
        return {
          action: {
            type: 'call',
            contactName: c.name,
            phoneNumber: c.phone,
            status: 'pending_confirmation',
          },
          conversationalReply: isEnglish
            ? `I have prepared the call to ${c.name} (${c.phone}). Please confirm to dial.`
            : `Maine ${c.name} (${c.phone}) ke liye call prepare kar di hai. Kripya confirm karke dialer open karein.`,
        };
      } else {
        // Contact not found in address book
        return {
          action: {
            type: 'call',
            contactName: target,
            phoneNumber: '',
            status: 'pending_confirmation',
          },
          conversationalReply: isEnglish
            ? `I could not find "${target}" in your saved contacts. You can enter their number below or pick from your device.`
            : `Mujhe aapke saved contacts mein "${target}" nahi mila. Aap niche number enter kar sakte hain ya device contacts se choose kar sakte hain.`,
        };
      }
    }
  }

  // 2. WHATSAPP INTENT
  if (/\b(whatsapp|what's app|wa)\b/i.test(lower)) {
    let recipient = '';
    let messageText = '';

    // Pattern A: "WhatsApp Rahul: I am coming" or "WhatsApp to Rahul: message"
    const m1 = raw.match(/(?:whatsapp|what's app|wa)\s+(?:to|par|pe|ko)?\s*([a-zA-Z0-9+\s]+?)(?::|message|msg|ki|that)\s*(.+)/i);
    // Pattern B: "Rahul ko WhatsApp par message bhejo ki meeting 5 baje hai"
    const m2 = raw.match(/([a-zA-Z0-9+\s]+?)\s+ko\s+(?:whatsapp|what's app)\s+(?:par|pe)?\s*(?:message|msg)?\s*(?:bhejo|karo)?\s*(?::|ki)?\s*(.+)/i);

    if (m2 && m2[1] && m2[2]) {
      recipient = m2[1].trim();
      messageText = m2[2].trim();
    } else if (m1 && m1[1] && m1[2]) {
      recipient = m1[1].trim();
      messageText = m1[2].trim();
    } else {
      // General WhatsApp request without explicit message
      const mGeneral = raw.match(/(?:whatsapp|what's app)\s+(?:to|ko|pe|par)?\s*([a-zA-Z0-9+\s]+)/i);
      recipient = mGeneral ? mGeneral[1].replace(/\s+(karo|bhejo|open)$/i, '').trim() : '';
    }

    let phoneNumber = '';
    let matchedName = recipient;

    if (recipient) {
      if (validatePhoneNumber(recipient)) {
        phoneNumber = sanitizePhoneNumber(recipient);
      } else {
        const matches = searchContacts(contacts, recipient);
        if (matches.length > 0) {
          matchedName = matches[0].name;
          phoneNumber = matches[0].phone;
        }
      }
    }

    return {
      action: {
        type: 'whatsapp',
        contactName: matchedName || 'WhatsApp Contact',
        phoneNumber,
        message: messageText || (isEnglish ? 'Hello! Connecting with you via Angel AI.' : 'Hello! Angel AI ke through connect kar raha hoon.'),
        status: 'pending_confirmation',
      },
      conversationalReply: isEnglish
        ? `I have drafted the WhatsApp message${matchedName ? ' for ' + matchedName : ''}. Please review below and tap to open WhatsApp.`
        : `Maine ${matchedName ? matchedName + ' ke liye ' : ''}WhatsApp message draft kar diya hai. Kripya niche review karein aur 'Open in WhatsApp' par tap karein.`,
    };
  }

  // 3. REMINDER OR ALARM INTENT
  if (/\b(reminder|remind me|yaad dilana|set reminder|alarm|set alarm|remind karo)\b/i.test(lower)) {
    const parsed = parseReminderDetails(raw);
    const { title, time, date, dueTimestamp, isRelative, relativeDescription } = parsed;

    let conversationalReply = '';
    if (isEnglish) {
      conversationalReply = isRelative
        ? `I have prepared a reminder for "${title}" ${relativeDescription} (at ${time}). Would you like to confirm?`
        : `I have prepared a reminder for "${title}" at ${time}. Would you like to confirm?`;
    } else {
      conversationalReply = isRelative
        ? `Maine ${relativeDescription} (${time} baje) "${title}" ka reminder prepare kar diya hai. Kripya confirm karein.`
        : `Maine ${time} baje "${title}" ka reminder prepare kar diya hai. Kripya confirm karein.`;
    }

    return {
      action: {
        type: 'reminder',
        title,
        time,
        date,
        dueTimestamp,
        status: 'pending_confirmation',
        statusMessage: `Reminder active for ${time} in Angel. Alert will sound when due.`,
      },
      conversationalReply,
    };
  }

  // 4. TASK CREATION INTENT
  if (/\b(add task|task banao|tasks banao|create task|nayi task|to-do)\b/i.test(lower)) {
    const timeMatches = raw.match(/\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM|baje|बజే))\b/gi) || [];
    if (timeMatches.length > 1 || raw.includes('\n')) {
      return { action: null, conversationalReply: '' };
    }
    let taskTitle = raw.replace(/(?:add task|task banao|tasks banao|create task|nayi task|to-do)\s*/i, '').trim();
    if (!taskTitle) taskTitle = 'New Angel Task';
    return {
      action: {
        type: 'task',
        title: taskTitle,
        priority: lower.includes('urgent') ? 'urgent' : 'normal',
        status: 'pending_confirmation',
      },
      conversationalReply: isEnglish
        ? `I have drafted the task "${taskTitle}". Would you like to save it to your list?`
        : `Maine naya task "${taskTitle}" prepare kar diya hai. Kripya save karne ke liye confirm karein.`,
    };
  }

  // 5. TIMER INTENT
  if (/\b(timer|countdown)\b/i.test(lower) && /\b(\d+)\s*(minute|minutes|min|second|seconds|sec)\b/i.test(lower)) {
    const timerMatch = raw.match(/(\d+)\s*(minute|minutes|min|second|seconds|sec)/i);
    let durationSeconds = 60;
    if (timerMatch) {
      const val = parseInt(timerMatch[1], 10);
      const unit = timerMatch[2].toLowerCase();
      durationSeconds = unit.startsWith('m') ? val * 60 : val;
    }
    return {
      action: {
        type: 'timer',
        title: `${Math.round(durationSeconds / 60)} Minute Timer`,
        durationSeconds,
        status: 'pending_confirmation',
      },
      conversationalReply: isEnglish
        ? `I have prepared a ${Math.round(durationSeconds / 60)} minute timer for you.`
        : `Maine ${Math.round(durationSeconds / 60)} minute ka timer prepare kar diya hai. Kripya start karein.`,
    };
  }

  // 6. MAP / NAVIGATION INTENT
  if (/\b(navigate to|rasta dikhao|directions to|location of|kahan hai)\b/i.test(lower)) {
    let place = raw.replace(/(?:navigate to|rasta dikhao|directions to|location of|kahan hai|ka rasta)\s*/gi, '').trim();
    if (!place) place = 'Nearby';
    return {
      action: {
        type: 'map',
        location: place,
        status: 'pending_confirmation',
      },
      conversationalReply: isEnglish
        ? `I have prepared map directions to "${place}". Tap to launch navigation.`
        : `Maine "${place}" ke liye Google Maps directions prepare kar di hain. Tap karke navigate karein.`,
    };
  }

  return { action: null, conversationalReply: '' };
}

/**
 * Formats a message timestamp into a compact Android-style time string (e.g. 2:45 PM).
 */
export function formatTime(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Prepares text for natural speech synthesis (TTS):
 * - Strips all emojis and pictographs so the speech engine never pronounces emoji names
 *   (e.g. "smiling face", "sparkles", "folded hands", "heart", "thumbs up", "woman technologist").
 * - Strips decorative unicode symbols, bullets, dingbats, stars, and arrows.
 * - Strips markdown characters (*, _, #, ~, backticks, header tags, raw URLs).
 * - Replaces multiline code blocks with a brief conversational notice so code syntax is not read character-by-character.
 * - Fully preserves natural Hindi words (Devanagari script), matras, purna viram / danda (।), and Hinglish phrasing.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return (
    text
      // 1. Replace multiline code blocks (e.g. ```jsx ... ```) with a brief natural voice pause/phrase
      .replace(/```[\s\S]*?```/g, ' [code snippet attached] ')
      // 2. Strip inline code backticks while preserving the code name
      .replace(/`([^`]+)`/g, '$1')
      // 3. Strip markdown links [label](url) -> label
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 4. Strip raw HTTP/HTTPS URLs
      .replace(/https?:\/\/\S+/g, '')
      // 5. Strip all emojis (Extended Pictographic, variation selectors, zero-width joiners, skin tones, symbols)
      .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u2600-\u27BF\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu, '')
      // 6. Strip decorative symbols, dingbats, arrows, bullets, stars, checkmarks
      .replace(/[•◦▪▫★☆✦✧❖⚡✓✔☑✗✘➜→←↑↓↔▲▼►◄◆◇■□●○]/g, ' ')
      // 7. Strip markdown asterisks, underscores, headers (#), tildes, blockquotes (>)
      .replace(/[#*_~>]/g, '')
      // 8. Replace hyphens used as bullet points at start of line
      .replace(/(^|\n)\s*[-+]\s+/g, '$1')
      // 9. Normalize multiple commas, semicolons, or colons
      .replace(/[,;]{2,}/g, ',')
      // 10. Normalize whitespace: preserve newlines between paragraphs/list items, collapse horizontal whitespace
      .replace(/[^\S\r\n]+/g, ' ')
      .replace(/\r\n|\r/g, '\n')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
  );
}

/**
 * Splits text into natural speech chunks (sentences/clauses) under maxChunkLength.
 * This prevents the browser SpeechSynthesis engine from timing out or stopping halfway on long responses.
 * Preserves the complete response, including all paragraphs and numbered list items in order.
 */
export function splitTextIntoSpeechChunks(text: string, maxChunkLength: number = 180): string[] {
  if (!text) return [];

  const clean = text.trim();
  if (!clean) return [];

  if (clean.length <= maxChunkLength) {
    return [clean];
  }

  // Split on sentence boundaries: periods (not part of numbers like 1., 10., 20. or decimals), exclamation, question mark, Devanagari danda (।), colon, or newlines
  const segments = clean.split(/(?<=(?<!\d)[.:!?।]|\n)\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const seg of segments) {
    const trimmedSeg = seg.trim();
    if (!trimmedSeg) continue;

    if (!currentChunk) {
      if (trimmedSeg.length <= maxChunkLength) {
        currentChunk = trimmedSeg;
      } else {
        // Individual segment is longer than maxChunkLength, split by commas or words
        const words = trimmedSeg.split(' ');
        let temp = '';
        for (const w of words) {
          if (!temp) {
            temp = w;
          } else if ((temp + ' ' + w).length <= maxChunkLength) {
            temp += ' ' + w;
          } else {
            chunks.push(temp);
            temp = w;
          }
        }
        if (temp) {
          currentChunk = temp;
        }
      }
    } else if ((currentChunk + ' ' + trimmedSeg).length <= maxChunkLength) {
      currentChunk += ' ' + trimmedSeg;
    } else {
      chunks.push(currentChunk);
      if (trimmedSeg.length <= maxChunkLength) {
        currentChunk = trimmedSeg;
      } else {
        const words = trimmedSeg.split(' ');
        let temp = '';
        for (const w of words) {
          if (!temp) {
            temp = w;
          } else if ((temp + ' ' + w).length <= maxChunkLength) {
            temp += ' ' + w;
          } else {
            chunks.push(temp);
            temp = w;
          }
        }
        currentChunk = temp;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}


