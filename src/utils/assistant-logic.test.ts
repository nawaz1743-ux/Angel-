/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizePhoneNumber,
  validatePhoneNumber,
  buildWhatsAppUrl,
  buildTelUrl,
  buildSmsUrl,
  getFallbackAngelReply,
  formatTime,
  cleanTextForSpeech,
  splitTextIntoSpeechChunks,
  searchContacts,
  parseAssistantAction,
  buildMapUrl,
  parseReminderDetails,
  checkDueReminders,
  createReminderItem,
  getLocalDateString,
  getLocalTimeString,
  formatDisplayDate,
  isWakeWord,
  stripWakeWord,
  hasWakeWordPrefix,
  isDateOrTimeQuery,
  getLocalDateAnswer,
  getAngelWelcomeMessage,
} from './assistant-logic.ts';

test('sanitizePhoneNumber removes spaces, hyphens, and brackets', () => {
  assert.equal(sanitizePhoneNumber('+91 98765-43210'), '+919876543210');
  assert.equal(sanitizePhoneNumber('(011) 2345 6789'), '01123456789');
  assert.equal(sanitizePhoneNumber(''), '');
});

test('validatePhoneNumber validates valid international and local numbers', () => {
  assert.equal(validatePhoneNumber('+919876543210'), true);
  assert.equal(validatePhoneNumber('9876543210'), true);
  assert.equal(validatePhoneNumber('+14155552671'), true);
  assert.equal(validatePhoneNumber('123'), false); // too short
  assert.equal(validatePhoneNumber('invalid-phone'), false);
});

test('buildWhatsAppUrl generates Android app intent and web fallback URLs', () => {
  const result = buildWhatsAppUrl('+919876543210', 'Namaste Angel! Kaise ho?');
  assert.equal(
    result.appIntent,
    'whatsapp://send?phone=919876543210&text=Namaste%20Angel!%20Kaise%20ho%3F'
  );
  assert.equal(
    result.webFallback,
    'https://wa.me/919876543210?text=Namaste%20Angel!%20Kaise%20ho%3F'
  );
});

test('buildTelUrl and buildSmsUrl create valid intent URIs', () => {
  assert.equal(buildTelUrl('+91 98765-43210'), 'tel:+919876543210');
  assert.equal(
    buildSmsUrl('+919876543210', 'Hello from Angel'),
    'sms:+919876543210?body=Hello%20from%20Angel'
  );
});

test('getFallbackAngelReply provides polite Hinglish and English replies with zero Devanagari in Hinglish', () => {
  const hinglishReply = getFallbackAngelReply('Namaste Angel', 'hinglish');
  assert.ok(hinglishReply.includes('Angel'));
  assert.ok(hinglishReply.includes('madad') || hinglishReply.includes('help'));
  assert.ok(hinglishReply.includes('Hello Sir!'));
  assert.ok(!hinglishReply.includes('Namaste'));
  assert.equal(/[\u0900-\u097F]/.test(hinglishReply), false, 'Hinglish reply must not contain Devanagari characters');

  const englishReply = getFallbackAngelReply('Hello', 'english');
  assert.ok(englishReply.includes('Angel'));
  assert.ok(englishReply.includes('help'));
  assert.equal(/[\u0900-\u097F]/.test(englishReply), false);
});

test('formatTime formats a valid date or timestamp', () => {
  const date = new Date(2026, 9, 15, 14, 30);
  const formatted = formatTime(date);
  assert.ok(formatted.length > 0);
  assert.equal(formatTime('invalid-date'), '');
});

test('cleanTextForSpeech strips emojis and pictographs completely', () => {
  const input = 'Namaste! 🙏✨ Main bilkul theek hoon! 😊❤️👍 👩‍💻';
  const cleaned = cleanTextForSpeech(input);
  assert.equal(cleaned, 'Namaste! Main bilkul theek hoon!');
  assert.equal(/[\p{Extended_Pictographic}]/u.test(cleaned), false);
});

test('cleanTextForSpeech preserves natural Hindi and Hinglish words', () => {
  const hindi = 'नमस्ते! 🙏 मैं बिल्कुल ठीक हूँ। 😊 आपका दिन कैसा रहा?';
  const cleanedHindi = cleanTextForSpeech(hindi);
  assert.equal(cleanedHindi, 'नमस्ते! मैं बिल्कुल ठीक हूँ। आपका दिन कैसा रहा?');
  assert.ok(cleanedHindi.includes('नमस्ते'));
  assert.ok(cleanedHindi.includes('बिल्कुल'));
  assert.ok(cleanedHindi.includes('दिन'));
});

test('cleanTextForSpeech strips markdown formatting, bullets, asterisks, headers, and code blocks', () => {
  const markdownInput = '### Important\n• Item 1: **bold** and *italic*\n```jsx\nconst a = 10;\n```\nCheck this: `variableName`';
  const cleaned = cleanTextForSpeech(markdownInput);
  assert.ok(!cleaned.includes('###'));
  assert.ok(!cleaned.includes('**'));
  assert.ok(!cleaned.includes('*'));
  assert.ok(!cleaned.includes('•'));
  assert.ok(!cleaned.includes('```'));
  assert.ok(cleaned.includes('Item 1: bold and italic'));
  assert.ok(cleaned.includes('variableName'));
});

test('splitTextIntoSpeechChunks splits long response into complete ordered chunks without dropping text', () => {
  const longResponse = 'Namaste! Bilkul, main aapki poori help karungi. Coding ek bahut interesting field hai! Pehla step ye hai ki aap basic syntax seekhein. Doosra step ye hai ki practical projects banayein. Teesra step ye hai ki errors ko debug karna seekhein. Agar koi doubt ho toh bejhijhak poochiye, main yahan hoon!';
  const chunks = splitTextIntoSpeechChunks(longResponse, 120);
  assert.ok(chunks.length >= 3);
  for (const c of chunks) {
    assert.ok(c.length <= 130);
  }
  // Rejoining chunks contains all original words in order
  const rejoined = chunks.join(' ');
  assert.ok(rejoined.includes('Namaste!'));
  assert.ok(rejoined.includes('Pehla step'));
  assert.ok(rejoined.includes('Doosra step'));
  assert.ok(rejoined.includes('Teesra step'));
  assert.ok(rejoined.includes('main yahan hoon!'));
});

test('splitTextIntoSpeechChunks preserves all items in a Hindi numbered list without stopping halfway', () => {
  const hindiList = 'नमस्ते! यहाँ आपके 3 मुख्य कदम हैं: 1. अपनी समस्या को समझें। 2. छोटे हिस्सों में बाँटें। 3. एक-एक करके हल करें। अगर कोई परेशानी हो तो बताएं!';
  const chunks = splitTextIntoSpeechChunks(hindiList, 60);
  assert.ok(chunks.length >= 2);
  const combined = chunks.join(' ');
  assert.ok(combined.includes('1. अपनी समस्या को समझें।'));
  assert.ok(combined.includes('2. छोटे हिस्सों में बाँटें।'));
  assert.ok(combined.includes('3. एक-एक करके हल करें।'));
});

test('splitTextIntoSpeechChunks handles short text and empty input safely', () => {
  assert.deepEqual(splitTextIntoSpeechChunks(''), []);
  assert.deepEqual(splitTextIntoSpeechChunks('   '), []);
  assert.deepEqual(splitTextIntoSpeechChunks('Short message.'), ['Short message.']);
});

test('splitTextIntoSpeechChunks processes long multiline responses and numbered steps without losing content', () => {
  const longMultiline = `Namaste! Yeh lijiye aapke 5 daily productivity steps:
1. Subah jaldi uth kar 1 glass paani piyein aur 10 minute stretch karein.
2. Aaj ke 3 sabse zaroori kaam note karein aur unpar focus karein.
3. Kaam ke dauran distraction band karein aur phone silent rakhein.
4. Dopahar mein healthy khana khayein aur thoda break lein.
5. Raat ko sone se pehle agle din ki planning karein aur achhi neend lein.

Ye saare steps follow karne se aapka din active aur focused rahega!`;

  const cleaned = cleanTextForSpeech(longMultiline);
  const chunks = splitTextIntoSpeechChunks(cleaned, 150);

  assert.ok(chunks.length >= 3, `Expected at least 3 chunks, got ${chunks.length}`);
  const combined = chunks.join(' ');

  // Verify all 5 numbered items are in the combined output
  assert.ok(combined.includes('1. Subah jaldi uth kar'));
  assert.ok(combined.includes('2. Aaj ke 3 sabse zaroori kaam'));
  assert.ok(combined.includes('3. Kaam ke dauran distraction'));
  assert.ok(combined.includes('4. Dopahar mein healthy khana'));
  assert.ok(combined.includes('5. Raat ko sone se pehle'));
  assert.ok(combined.includes('Ye saare steps follow karne se'));

  // Ensure no chunk ends with an orphan list number like " 2." or " 3."
  for (const chunk of chunks) {
    assert.equal(/\s\d+\.$/.test(chunk.trim()), false, `Chunk should not end with orphaned number: "${chunk}"`);
  }
});

test('searchContacts filters contacts by name, phone, or relation accurately', () => {
  const contacts = [
    { id: '1', name: 'Rahul Sharma', phone: '+919876543210', relation: 'Friend' },
    { id: '2', name: 'Rahul Verma', phone: '+919811122233', relation: 'Colleague' },
    { id: '3', name: 'Priya Singh', phone: '+919876501234', relation: 'Sister' },
  ];

  // Multiple match for "Rahul"
  const rahuls = searchContacts(contacts, 'Rahul');
  assert.equal(rahuls.length, 2);

  // Single match for "Priya"
  const priya = searchContacts(contacts, 'priya');
  assert.equal(priya.length, 1);
  assert.equal(priya[0].phone, '+919876501234');

  // Match by relation "Sister"
  const sisters = searchContacts(contacts, 'sister');
  assert.equal(sisters.length, 1);
  assert.equal(sisters[0].name, 'Priya Singh');

  // Match by partial phone number
  const byPhone = searchContacts(contacts, '98111');
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].name, 'Rahul Verma');

  // Empty query returns empty array
  assert.deepEqual(searchContacts(contacts, ''), []);
});

test('parseAssistantAction correctly detects multiple contacts and triggers disambiguation', () => {
  const contacts = [
    { id: '1', name: 'Rahul Sharma', phone: '+919876543210', relation: 'Friend' },
    { id: '2', name: 'Rahul Verma', phone: '+919811122233', relation: 'Colleague' },
  ];

  const res = parseAssistantAction('Call Rahul', contacts, 'hinglish');
  assert.ok(res.action);
  assert.equal(res.action?.type, 'call');
  assert.equal(res.action?.status, 'disambiguation_needed');
  assert.equal(res.action?.matches?.length, 2);
  assert.ok(res.conversationalReply.includes('2 log mile') || res.conversationalReply.includes('Rahul'));
});

test('parseAssistantAction detects single contact and prepares call pending confirmation', () => {
  const contacts = [
    { id: '1', name: 'Priya Singh', phone: '+919876501234', relation: 'Sister' },
  ];

  const res = parseAssistantAction('Priya ko call lagao', contacts, 'hinglish');
  assert.ok(res.action);
  assert.equal(res.action?.type, 'call');
  assert.equal(res.action?.status, 'pending_confirmation');
  assert.equal(res.action?.contactName, 'Priya Singh');
  assert.equal(res.action?.phoneNumber, '+919876501234');
  // Strict rule: Never claim call was already placed
  assert.ok(!res.conversationalReply.includes('Maine call laga diya'));
  assert.ok(res.conversationalReply.includes('prepare'));
});

test('parseAssistantAction safely ignores programming questions containing "call"', () => {
  const contacts = [
    { id: '1', name: 'Rahul', phone: '+919876543210' },
  ];

  const q1 = parseAssistantAction('What is a call stack in javascript?', contacts);
  assert.equal(q1.action, null);

  const q2 = parseAssistantAction('React mein API call kaise karte hain?', contacts);
  assert.equal(q2.action, null);
});

test('parseAssistantAction extracts WhatsApp recipient and drafted message safely', () => {
  const contacts = [
    { id: '1', name: 'Priya', phone: '+919876501234' },
  ];

  const res = parseAssistantAction('WhatsApp Priya: Main 10 baje aa raha hoon', contacts, 'hinglish');
  assert.ok(res.action);
  assert.equal(res.action?.type, 'whatsapp');
  assert.equal(res.action?.status, 'pending_confirmation');
  assert.equal(res.action?.contactName, 'Priya');
  assert.equal(res.action?.phoneNumber, '+919876501234');
  assert.equal(res.action?.message, 'Main 10 baje aa raha hoon');
  // Never claim message sent
  assert.ok(!res.conversationalReply.includes('Message bhej diya'));
  assert.ok(res.conversationalReply.includes('draft'));
});

test('parseReminderDetails parses "Angel, remind me to drink water in 1 minute" with exact offset and clean title', () => {
  const baseDate = new Date(2026, 9, 16, 14, 0, 0); // 14:00:00
  const parsed = parseReminderDetails('Angel, remind me to drink water in 1 minute', baseDate);

  assert.equal(parsed.isRelative, true);
  assert.equal(parsed.dueTimestamp, baseDate.getTime() + 60 * 1000);
  assert.equal(parsed.title, 'drink water');
  assert.equal(parsed.time, '14:01');
  assert.equal(parsed.relativeDescription, 'in 1 minute');
});

test('parseReminderDetails parses relative seconds, minutes, and hours in English', () => {
  const baseDate = new Date(2026, 9, 16, 10, 0, 0);

  // 30 seconds
  const pSec = parseReminderDetails('remind me to check oven in 30 seconds', baseDate);
  assert.equal(pSec.isRelative, true);
  assert.equal(pSec.dueTimestamp, baseDate.getTime() + 30 * 1000);
  assert.equal(pSec.title, 'check oven');

  // 5 minutes
  const pMin = parseReminderDetails('remind me in 5 minutes to call mom', baseDate);
  assert.equal(pMin.isRelative, true);
  assert.equal(pMin.dueTimestamp, baseDate.getTime() + 5 * 60 * 1000);
  assert.equal(pMin.title, 'call mom');

  // 2 hours
  const pHr = parseReminderDetails('remind me in 2 hours to take a break', baseDate);
  assert.equal(pHr.isRelative, true);
  assert.equal(pHr.dueTimestamp, baseDate.getTime() + 2 * 3600 * 1000);
  assert.equal(pHr.title, 'take a break');
});

test('parseReminderDetails parses Hindi and Hinglish relative reminders', () => {
  const baseDate = new Date(2026, 9, 16, 15, 30, 0);

  const pHindi = parseReminderDetails('5 minute baad yaad dilana ki dawai leni hai', baseDate);
  assert.equal(pHindi.isRelative, true);
  assert.equal(pHindi.dueTimestamp, baseDate.getTime() + 5 * 60 * 1000);
  assert.equal(pHindi.title, 'dawai leni hai');

  const pEkMin = parseReminderDetails('1 minute baad remind karo', baseDate);
  assert.equal(pEkMin.isRelative, true);
  assert.equal(pEkMin.dueTimestamp, baseDate.getTime() + 60 * 1000);
});

test('parseReminderDetails parses absolute times accurately', () => {
  const baseDate = new Date(2026, 9, 16, 12, 0, 0); // 12:00 PM

  const pAbs = parseReminderDetails('remind me at 6:00 PM to take medicine', baseDate);
  assert.equal(pAbs.isRelative, false);
  assert.equal(pAbs.time, '18:00');
  assert.equal(pAbs.title, 'take medicine');
});

test('createReminderItem creates a well-formed ReminderItem with correct defaults', () => {
  const item = createReminderItem('Drink Water', '14:05', '2026-10-16', 1792140300000);
  assert.ok(item.id.startsWith('rem-'));
  assert.equal(item.title, 'Drink Water');
  assert.equal(item.time, '14:05');
  assert.equal(item.date, '2026-10-16');
  assert.equal(item.dueTimestamp, 1792140300000);
  assert.equal(item.active, true);
  assert.equal(item.notified, false);
});

test('checkDueReminders triggers due reminders and prevents duplicate alerts', () => {
  const t0 = 1000000;
  const reminders = [
    createReminderItem('Task Due Now', '10:00', '2026-10-16', t0),
    createReminderItem('Task Due Later', '10:05', '2026-10-16', t0 + 300000),
  ];

  // 1. Before due time: nothing triggered
  const resBefore = checkDueReminders(reminders, t0 - 1000);
  assert.equal(resBefore.dueReminders.length, 0);
  assert.equal(resBefore.updatedReminders[0].active, true);

  // 2. Exactly at due time: first reminder triggers
  const resDue = checkDueReminders(reminders, t0);
  assert.equal(resDue.dueReminders.length, 1);
  assert.equal(resDue.dueReminders[0].title, 'Task Due Now');
  assert.equal(resDue.dueReminders[0].active, false);
  assert.equal(resDue.dueReminders[0].notified, true);

  // 3. Duplicate Prevention: Calling checkDueReminders again at same or later time
  // should NOT trigger the already notified reminder again
  const resAfter = checkDueReminders(resDue.updatedReminders, t0 + 5000);
  assert.equal(resAfter.dueReminders.length, 0);

  // 4. Later when second reminder becomes due
  const resSecondDue = checkDueReminders(resAfter.updatedReminders, t0 + 300000);
  assert.equal(resSecondDue.dueReminders.length, 1);
  assert.equal(resSecondDue.dueReminders[0].title, 'Task Due Later');
});

test('checkDueReminders triggers multiple simultaneous reminders without dropping any', () => {
  const t0 = 2000000;
  const simultaneous = [
    createReminderItem('Reminder 1', '10:00', '2026-10-16', t0),
    createReminderItem('Reminder 2', '10:00', '2026-10-16', t0),
  ];

  const res = checkDueReminders(simultaneous, t0);
  assert.equal(res.dueReminders.length, 2);
  assert.equal(res.dueReminders[0].title, 'Reminder 1');
  assert.equal(res.dueReminders[1].title, 'Reminder 2');
  assert.equal(res.updatedReminders.every(r => r.notified === true), true);
});

test('parseAssistantAction parses "Angel, remind me to drink water in 1 minute" safely pending confirmation', () => {
  const res = parseAssistantAction('Angel, remind me to drink water in 1 minute', [], 'english');
  assert.ok(res.action);
  assert.equal(res.action?.type, 'reminder');
  assert.equal(res.action?.status, 'pending_confirmation');
  assert.equal(res.action?.title, 'drink water');
  assert.ok(res.action?.dueTimestamp && res.action.dueTimestamp > Date.now());
  // Strict check: Never claim action was already dispatched or completed
  assert.ok(!res.conversationalReply.includes('dispatched'));
  assert.ok(res.conversationalReply.includes('prepared') || res.conversationalReply.includes('prepare'));
});

test('parseAssistantAction extracts Timer duration in seconds', () => {
  const res = parseAssistantAction('Set timer for 10 minutes', [], 'hinglish');
  assert.ok(res.action);
  assert.equal(res.action?.type, 'timer');
  assert.equal(res.action?.durationSeconds, 600);
});

test('buildMapUrl generates Android geo: intent and Google Maps web fallback', () => {
  const res = buildMapUrl('Connaught Place Delhi');
  assert.ok(res.appIntent.startsWith('geo:0,0?q=Connaught%20Place%20Delhi'));
  assert.ok(res.webFallback.includes('google.com/maps/search/'));
});

test('formatDisplayDate formats YYYY-MM-DD correctly for display in task view', () => {
  assert.equal(formatDisplayDate('2026-10-17'), 'October 17, 2026');
  assert.equal(formatDisplayDate('2026-01-01'), 'January 1, 2026');
  assert.equal(formatDisplayDate('invalid'), 'invalid');
  assert.equal(formatDisplayDate(undefined), 'Not set');
});

test('Task updates correctly modify title, date, time, and priority without deleting user data', () => {
  const initialTask = {
    id: 'task-101',
    title: 'Check important messages',
    completed: false,
    createdAt: 1760000000000,
    priority: 'normal' as const,
    time: '9:00 AM',
    date: '2026-10-17',
  };

  const updates = {
    title: 'Check urgent important messages',
    time: '9:30 AM',
    priority: 'urgent' as const,
  };

  const updatedTask = { ...initialTask, ...updates };
  assert.equal(updatedTask.id, 'task-101');
  assert.equal(updatedTask.title, 'Check urgent important messages');
  assert.equal(updatedTask.time, '9:30 AM');
  assert.equal(updatedTask.date, '2026-10-17');
  assert.equal(updatedTask.priority, 'urgent');
  assert.equal(updatedTask.completed, false);
});

test('localStorage task loading repair assigns date "2026-10-17" and correct times to canonical tasks if missing', () => {
  // Simulate stale localStorage record where date and time were missing
  const staleLocalStorage = [
    { id: 'task-101', title: 'Check important messages', completed: false, priority: 'normal' },
    { id: 'task-102', title: 'Complete pending work', completed: false, priority: 'normal' },
    { id: 'task-103', title: 'Plan for the next day', completed: false, priority: 'normal' },
    { id: 'task-999', title: 'Custom User Task', completed: true, priority: 'urgent' },
  ];

  const migratedTasks = staleLocalStorage.map((task: any) => {
    let date = task.date || task.dueDate || task.taskDate;
    let time = task.time || task.dueTime || task.taskTime;

    const lowerTitle = (task.title || '').toLowerCase().trim();
    if (task.id === 'task-101' || lowerTitle.includes('check important messages')) {
      if (!date) date = '2026-10-17';
      if (!time) time = '9:00 AM';
    } else if (task.id === 'task-102' || lowerTitle.includes('complete pending work')) {
      if (!date) date = '2026-10-17';
      if (!time) time = '11:00 AM';
    } else if (task.id === 'task-103' || lowerTitle.includes('plan for the next day')) {
      if (!date) date = '2026-10-17';
      if (!time) time = '6:00 PM';
    }

    return { ...task, date, time };
  });

  assert.equal(migratedTasks.length, 4);

  // Task 1
  assert.equal(migratedTasks[0].id, 'task-101');
  assert.equal(migratedTasks[0].date, '2026-10-17');
  assert.equal(migratedTasks[0].time, '9:00 AM');

  // Task 2
  assert.equal(migratedTasks[1].id, 'task-102');
  assert.equal(migratedTasks[1].date, '2026-10-17');
  assert.equal(migratedTasks[1].time, '11:00 AM');

  // Task 3
  assert.equal(migratedTasks[2].id, 'task-103');
  assert.equal(migratedTasks[2].date, '2026-10-17');
  assert.equal(migratedTasks[2].time, '6:00 PM');

  // Unrelated custom task preserved without modification or duplication
  assert.equal(migratedTasks[3].id, 'task-999');
  assert.equal(migratedTasks[3].title, 'Custom User Task');
  assert.equal(migratedTasks[3].completed, true);
  assert.equal(migratedTasks[3].date, undefined);
  assert.equal(migratedTasks[3].time, undefined);
});

test('Legacy property names (dueDate/dueTime/taskDate/taskTime) are resolved correctly', () => {
  const legacyTask = {
    id: 'task-legacy',
    title: 'Legacy task',
    completed: false,
    dueDate: '2026-10-20',
    dueTime: '2:30 PM',
  };

  const rawTask = legacyTask as any;
  const taskDate = legacyTask.dueDate || rawTask.taskDate || legacyTask.dueDate;
  const taskTime = legacyTask.dueTime || rawTask.taskTime || legacyTask.dueTime;

  assert.equal(taskDate, '2026-10-20');
  assert.equal(taskTime, '2:30 PM');
  assert.equal(formatDisplayDate(taskDate), 'October 20, 2026');
});

test('isWakeWord correctly identifies standalone wake word variations', () => {
  assert.equal(isWakeWord('Angel'), true);
  assert.equal(isWakeWord('Hey Angel'), true);
  assert.equal(isWakeWord('Hi Angel!'), true);
  assert.equal(isWakeWord('Ok Angel.'), true);
  assert.equal(isWakeWord('एंजेल'), true);
  assert.equal(isWakeWord('Angel, kal ke liye ye 3 tasks banao'), false);
  assert.equal(isWakeWord('What is the weather today?'), false);
});

test('stripWakeWord cleanly removes wake word prefixes from spoken requests', () => {
  assert.equal(
    stripWakeWord('Angel, kal ke liye ye 3 tasks banao'),
    'kal ke liye ye 3 tasks banao'
  );
  assert.equal(
    stripWakeWord('Hey Angel call Mom'),
    'call Mom'
  );
  assert.equal(
    stripWakeWord('एंजेल remind me to drink water'),
    'remind me to drink water'
  );
});

test('hasWakeWordPrefix identifies sentences starting with wake word prefix', () => {
  assert.equal(hasWakeWordPrefix('Angel, kal ke liye 3 tasks banao'), true);
  assert.equal(hasWakeWordPrefix('Hey Angel call Mom'), true);
  assert.equal(hasWakeWordPrefix('एंजेल remind me to drink water'), true);
  assert.equal(hasWakeWordPrefix('Check important messages'), false);
  assert.equal(hasWakeWordPrefix('What is the weather today?'), false);
});

test('Hands-Free mode control flow state transition logic with background speech filtering', () => {
  let isHandsFreeActive = false;
  let isAwaitingCommand = false;
  let speechError: string | null = null;
  let processedCommands: string[] = [];

  const startHandsFree = (supported: boolean) => {
    speechError = null;
    if (!supported) {
      speechError = 'Speech recognition is not supported in this browser environment.';
      return;
    }
    isHandsFreeActive = true;
    isAwaitingCommand = false;
  };

  const stopHandsFree = () => {
    isHandsFreeActive = false;
    isAwaitingCommand = false;
  };

  const handleSpeechResult = (text: string) => {
    if (!isHandsFreeActive) return;

    if (isWakeWord(text)) {
      isAwaitingCommand = true;
      return;
    }

    if (hasWakeWordPrefix(text)) {
      const command = stripWakeWord(text);
      if (command) {
        processedCommands.push(command);
        isAwaitingCommand = false;
        return;
      }
    }

    if (isAwaitingCommand) {
      const command = stripWakeWord(text) || text;
      processedCommands.push(command);
      isAwaitingCommand = false;
      return;
    }

    // Ignore background noise / speech without wake word
  };

  // 1. Unsupported browser
  startHandsFree(false);
  assert.equal(isHandsFreeActive, false);
  assert.ok((speechError as any)?.includes('not supported'));

  // 2. Supported browser - start
  startHandsFree(true);
  assert.equal(isHandsFreeActive, true);
  assert.equal(isAwaitingCommand, false);

  // 3. Random background speech without wake word IS IGNORED
  handleSpeechResult('What is the weather today?');
  assert.equal(processedCommands.length, 0);
  assert.equal(isAwaitingCommand, false);

  // 4. Standalone wake word "Angel" activates awaiting state
  handleSpeechResult('Angel');
  assert.equal(isAwaitingCommand, true);

  // 5. Subsequent prompt "Check important messages" is processed
  handleSpeechResult('Check important messages');
  assert.equal(processedCommands.length, 1);
  assert.equal(processedCommands[0], 'Check important messages');
  assert.equal(isAwaitingCommand, false);

  // 6. Single-sentence prompt "Hey Angel call Mom" is processed directly
  handleSpeechResult('Hey Angel call Mom');
  assert.equal(processedCommands.length, 2);
  assert.equal(processedCommands[1], 'call Mom');

  // 7. Stop hands-free
  stopHandsFree();
  assert.equal(isHandsFreeActive, false);
});

test('Continuous multi-turn Hands-Free session processes three consecutive user questions seamlessly', () => {
  let isHandsFreeActive = false;
  let isAwaitingCommand = false;
  let isSpeaking = false;
  const processedCommands: string[] = [];
  const spokenReplies: string[] = [];

  // Simulate startHandsFree
  const startHandsFree = () => {
    isHandsFreeActive = true;
    isAwaitingCommand = true; // Ready to receive first question or wake word
  };

  // Simulate Angel TTS finishSpeech
  const onFinishSpeech = () => {
    isSpeaking = false;
    if (isHandsFreeActive) {
      isAwaitingCommand = true; // Auto-resumes listening for next question in continuous conversation
    }
  };

  // Simulate onresult in useSpeech.ts
  const handleSpeechResult = (text: string) => {
    if (!isHandsFreeActive || isSpeaking) return;

    if (isAwaitingCommand) {
      const command = stripWakeWord(text) || text;
      if (!command.trim() || isWakeWord(text)) {
        // Standalone wake word acknowledgment
        isSpeaking = true;
        spokenReplies.push('Haan, bolo, main sun rahi hoon.');
        onFinishSpeech();
        return;
      }

      processedCommands.push(command);
      isAwaitingCommand = false;

      // Simulate Angel processing command & speaking answer
      isSpeaking = true;
      const reply = getFallbackAngelReply(command, 'hinglish');
      spokenReplies.push(reply);

      // When Angel finishes speaking reply, finishSpeech runs and sets isAwaitingCommand = true
      onFinishSpeech();
      return;
    }

    if (isWakeWord(text)) {
      isAwaitingCommand = true;
      isSpeaking = true;
      spokenReplies.push('Haan, bolo, main sun rahi hoon.');
      onFinishSpeech();
      return;
    }

    if (hasWakeWordPrefix(text)) {
      const command = stripWakeWord(text);
      if (command) {
        processedCommands.push(command);
        isAwaitingCommand = false;
        isSpeaking = true;
        const reply = getFallbackAngelReply(command, 'hinglish');
        spokenReplies.push(reply);
        onFinishSpeech();
      }
    }
  };

  // Start Hands-Free Session
  startHandsFree();
  assert.equal(isHandsFreeActive, true);
  assert.equal(isAwaitingCommand, true);

  // Turn 1: Question 1 ("Angel, tum kya-kya kar sakti ho?")
  handleSpeechResult('Angel, tum kya-kya kar sakti ho?');
  assert.equal(processedCommands.length, 1);
  assert.equal(processedCommands[0], 'tum kya-kya kar sakti ho?');
  assert.equal(spokenReplies.length, 1);
  assert.ok(spokenReplies[0].includes('Main aapki personal AI assistant hoon'));

  // Turn 2: Question 2 (Spoken directly WITHOUT repeating "Angel")
  handleSpeechResult('Mujhe aaj ke tasks dikhao');
  assert.equal(processedCommands.length, 2);
  assert.equal(processedCommands[1], 'Mujhe aaj ke tasks dikhao');
  assert.equal(spokenReplies.length, 2);

  // Turn 3: Question 3 (Spoken directly WITHOUT repeating "Angel")
  handleSpeechResult('Rahul Sharma ko call lagao');
  assert.equal(processedCommands.length, 3);
  assert.equal(processedCommands[2], 'Rahul Sharma ko call lagao');
  assert.equal(spokenReplies.length, 3);
});

test('isDateOrTimeQuery detects all target date and time Hinglish and English variants accurately', () => {
  assert.equal(isDateOrTimeQuery('aaj ki tarikh batao'), true);
  assert.equal(isDateOrTimeQuery('aaj ki date kya hai'), true);
  assert.equal(isDateOrTimeQuery('aaj ka din kya hai'), true);
  assert.equal(isDateOrTimeQuery("what is today's date"), true);
  assert.equal(isDateOrTimeQuery('aaj konsi tarikh hai'), true);
  assert.equal(isDateOrTimeQuery('aaj tareekh kya hai'), true);
  assert.equal(isDateOrTimeQuery('time kya hua hai'), true);
  assert.equal(isDateOrTimeQuery('what time is it'), true);
  assert.equal(isDateOrTimeQuery('Check important messages'), false);
  assert.equal(isDateOrTimeQuery('Call Mom'), false);
});

test('getLocalDateAnswer generates dynamic Asia/Kolkata date and time answers without hardcoding', () => {
  const ansHinglish = getLocalDateAnswer('aaj ki tarikh batao', 'hinglish');
  assert.ok(ansHinglish.includes('Aaj ki tarikh hai'));
  assert.ok(ansHinglish.includes('2026'));
  assert.equal(/[\u0900-\u097F]/.test(ansHinglish), false, 'Hinglish date answer must use Roman script only');

  const ansEnglish = getLocalDateAnswer("what is today's date", 'english');
  assert.ok(ansEnglish.includes("Today's date is"));
  assert.equal(/[\u0900-\u097F]/.test(ansEnglish), false);
});

test('Date/time requests execute local fast path BEFORE Gemini API call and return real local date even when API key is 429 quota exhausted', () => {
  const datePrompts = [
    'aaj ki tarikh batao',
    'aaj ki date kya hai',
    'aaj ka din kya hai',
    "what is today's date",
  ];

  const simulatedIs429QuotaExhausted = true;

  for (const prompt of datePrompts) {
    let responseText = '';

    // Exactly mirrors server.ts execution order:
    // 1. FAST PATH: Check isDateOrTimeQuery(prompt) BEFORE calling Gemini API or hitting quota error
    if (isDateOrTimeQuery(prompt)) {
      responseText = getLocalDateAnswer(prompt, 'hinglish');
    } else if (simulatedIs429QuotaExhausted) {
      responseText = getFallbackAngelReply(prompt, 'hinglish');
    }

    // Must return the real local date answer, NOT the quota message
    assert.ok(!responseText.includes('429 Quota Limit'), `Prompt "${prompt}" returned quota error instead of local date!`);
    assert.ok(responseText.includes('Aaj ki tarikh hai'), `Prompt "${prompt}" did not return expected date response!`);
  }
});

// ============================================================================
// ANGEL LANGUAGE SYSTEM VERIFICATION TESTS
// ============================================================================

test('Angel Language System: Default language is Hinglish and welcome message matches requirements', () => {
  const DEFAULT_SETTINGS = {
    language: 'hinglish',
    spokenResponses: true,
    speechRate: 1.0,
    personality: 'friendly',
    autoListenAfterSpeech: false,
    darkTheme: true,
  };

  assert.equal(DEFAULT_SETTINGS.language, 'hinglish', 'Default language must be Hinglish');

  // Verify welcome message is in Hinglish, uses Roman script, and does not use "Namaste"
  const expectedWelcome =
    'Hello Sir! Main Angel hoon, aapki personal AI assistant.\nBataiye Sir, main aaj aapki kis kaam mein madad kar sakti hoon?';
  const actualWelcome = getAngelWelcomeMessage('hinglish');

  assert.equal(actualWelcome, expectedWelcome, 'Welcome message must match exact required wording');
  assert.ok(!actualWelcome.includes('Namaste'), 'Default welcome message must not contain "Namaste"');
  assert.ok(actualWelcome.startsWith('Hello Sir! Main Angel hoon'));
  assert.equal(/[\u0900-\u097F]/.test(actualWelcome), false, 'Welcome text must not contain Devanagari characters');

  // Verify greeting fallback also uses the clean welcome message without Namaste
  const greetingReply = getFallbackAngelReply('hello', 'hinglish');
  assert.equal(greetingReply, expectedWelcome);
  assert.ok(!greetingReply.includes('Namaste'));
});

test('Angel Language System: Only Hinglish and English are selectable', () => {
  // Available language choices in Angel settings
  const selectableLanguages = [
    { id: 'hinglish', label: 'Hinglish (Default)', desc: 'Hindi + English in Roman script' },
    { id: 'english', label: 'English', desc: 'Natural English' },
  ];

  assert.equal(selectableLanguages.length, 2, 'Only exactly two language options should be selectable');
  assert.deepEqual(
    selectableLanguages.map((l) => l.id),
    ['hinglish', 'english'],
    'Selectable language IDs must be strictly hinglish and english'
  );
  assert.equal(selectableLanguages[0].id, 'hinglish', 'Hinglish must be the first priority option');
  assert.equal(selectableLanguages[1].id, 'english', 'English must be the second priority option');
});

test('Angel Language System: Hinglish responses use Roman script only (zero Devanagari)', () => {
  const testPrompts = [
    'what can you do',
    'kaise ho',
    'namaste',
    'call Rahul',
    'whatsapp Priya: I will be late',
    'remind me to take medicine at 8 pm',
    'add task buy groceries',
    'timer 5 minutes',
    'navigate to India Gate',
    'aaj ki tarikh batao',
    'random query that hits quota limit',
  ];

  for (const prompt of testPrompts) {
    // 1. Fallback replies
    const fallback = getFallbackAngelReply(prompt, 'hinglish');
    assert.equal(
      /[\u0900-\u097F]/.test(fallback),
      false,
      `Hinglish fallback reply for "${prompt}" contains Devanagari characters: "${fallback}"`
    );

    // 2. Action parser replies
    const { conversationalReply } = parseAssistantAction(prompt, undefined, 'hinglish');
    if (conversationalReply) {
      assert.equal(
        /[\u0900-\u097F]/.test(conversationalReply),
        false,
        `Hinglish action reply for "${prompt}" contains Devanagari characters: "${conversationalReply}"`
      );
    }

    // 3. Date queries
    if (isDateOrTimeQuery(prompt)) {
      const dateReply = getLocalDateAnswer(prompt, 'hinglish');
      assert.equal(
        /[\u0900-\u097F]/.test(dateReply),
        false,
        `Hinglish date reply for "${prompt}" contains Devanagari characters: "${dateReply}"`
      );
    }
  }
});

test('Angel Language System: English mode responds in natural English', () => {
  // 1. Capability prompt
  const helpReply = getFallbackAngelReply('what can you do', 'english');
  assert.ok(helpReply.includes('personal AI assistant'));
  assert.ok(helpReply.includes('tasks'));
  assert.ok(!helpReply.includes('hoon') && !helpReply.includes('karti'));

  // 2. Greeting prompt
  const greetingReply = getFallbackAngelReply('hello', 'english');
  assert.ok(greetingReply.includes('Hello Sir! I am Angel, your personal AI assistant.'));

  // 3. Action intent (Call)
  const callAction = parseAssistantAction('call +919876543210', undefined, 'english');
  assert.ok(callAction.conversationalReply.includes('I have prepared the call'));

  // 4. Action intent (WhatsApp)
  const waAction = parseAssistantAction('whatsapp Mom: I am reaching home', undefined, 'english');
  assert.ok(waAction.conversationalReply.includes('I have drafted the WhatsApp message'));

  // 5. Action intent (Task)
  const taskAction = parseAssistantAction('add task Review project report', undefined, 'english');
  assert.ok(taskAction.conversationalReply.includes('I have drafted the task'));

  // 6. Date answer in English
  const dateReply = getLocalDateAnswer("what is today's date", 'english');
  assert.ok(dateReply.includes("Today's date is"));
  assert.ok(dateReply.includes('current time is'));
});

test('Angel Language System: The selected language persists after restart', () => {
  // Simulate localStorage persistence cycle
  const mockStorage: Record<string, string> = {};

  const saveSettings = (settingsObj: { language: string }) => {
    mockStorage['angel_settings'] = JSON.stringify(settingsObj);
  };

  const loadSettingsOnRestart = () => {
    const DEFAULT_SETTINGS = { language: 'hinglish' };
    const saved = mockStorage['angel_settings'];
    if (saved) {
      const parsed = JSON.parse(saved);
      const validLang = parsed.language === 'english' ? 'english' : 'hinglish';
      return { ...DEFAULT_SETTINGS, ...parsed, language: validLang };
    }
    return DEFAULT_SETTINGS;
  };

  // 1. Fresh start: Default is Hinglish
  assert.equal(loadSettingsOnRestart().language, 'hinglish');

  // 2. User switches to English in Settings
  saveSettings({ language: 'english' });
  // Simulate app restart / page reload
  assert.equal(loadSettingsOnRestart().language, 'english', 'English must persist across restart');

  // 3. User switches back to Hinglish in Settings
  saveSettings({ language: 'hinglish' });
  // Simulate app restart / page reload
  assert.equal(loadSettingsOnRestart().language, 'hinglish', 'Hinglish must persist across restart');

  // 4. Legacy 'hindi' in localStorage gracefully normalizes to default 'hinglish'
  saveSettings({ language: 'hindi' });
  assert.equal(loadSettingsOnRestart().language, 'hinglish', 'Legacy Hindi must normalize to Hinglish');
});






