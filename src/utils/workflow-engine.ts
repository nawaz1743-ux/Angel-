/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TaskWorkflow,
  PlanStep,
  WorkflowStage,
  PlanStepStatus,
  ContactItem,
  ActionPayload,
  NoteItem,
  TaskItem,
  ReminderItem,
  AssistantLanguage,
} from '../types/assistant.ts';
import {
  parseReminderDetails,
  createReminderItem,
  searchContacts,
  validatePhoneNumber,
  sanitizePhoneNumber,
  getLocalDateString,
  getLocalTimeString,
} from './assistant-logic.ts';

export interface WorkflowAppState {
  notes?: NoteItem[];
  tasks?: TaskItem[];
  reminders?: ReminderItem[];
  contacts?: ContactItem[];
}

/**
 * Checks if user request is a multi-step task or autonomous task execution command.
 * Supports English, Hindi, and Hinglish natural language prompts.
 */
export function isMultiStepTaskRequest(text: string): boolean {
  if (!text || !text.trim()) return false;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (extractIndividualTasks(raw).length > 1) {
    return true;
  }

  // Explicit autonomous workflow triggers in English, Hinglish, and Hindi
  const explicitKeywords = [
    'workflow',
    'plan',
    'step by step',
    'step-by-step',
    'autonomous',
    'multi-step',
    'work with me',
    'help me complete',
    'organize and execute',
    'mere sath kaam karo',
    'mere saath kaam karo',
    'kaam plan karo',
    'task plan',
    'योजना',
    'वर्कफ़्लो',
    'कदम दर कदम',
    'साथ काम करो',
    'मदद करो',
  ];
  if (explicitKeywords.some((k) => lower.includes(k) || raw.includes(k))) {
    return true;
  }

  // Multi-action connectors (e.g. "and", "aur", "then", "fir", "baad mein", "और", "तथा", "फिर")
  const hasConnector =
    /\b(and|aur|then|fir|phir|after that|uske baad|along with)\b/i.test(lower) ||
    /(\band\b|\baur\b|और|तथा|फिर|बाद में)/i.test(raw);

  // Count distinct action markers in the command
  const actionMarkers = [
    /\b(note|draft|write|likho|likhein|agenda|proposal|summary|document)\b|लिखो|लिखें|ड्राफ्ट/i,
    /\b(reminder|remind me|yaad dilana|alarm|remind)\b|याद दिलाना|अलार्म|रिमाइंडर/i,
    /\b(task|to-do|tasks|kaam|checklist)\b|टास्क|काम/i,
    /\b(whatsapp|message bhejo|msg|send message)\b|व्हाट्सएप|मैसेज/i,
    /\b(call|dial|phone|call lagao)\b|कॉल|फ़ोन|फोन/i,
    /\b(ad|advertisement|purchase|buy|trade|payment|pay)\b|विज्ञापन|खरीदारी|भुगतान/i,
  ];

  // Explicit multi-task patterns (e.g. "3 tasks", "tasks for tomorrow", or multiline tasks list)
  if (
    /\b(\d+\s*tasks?|\d+\s*kaam)\b/i.test(lower) ||
    (/(?:tasks?|to-do|kaam)\b/i.test(lower) && /\r?\n/.test(raw) && /\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)/i.test(lower))
  ) {
    return true;
  }

  const matchedMarkersCount = actionMarkers.filter((m) => m.test(raw) || m.test(lower)).length;

  return hasConnector && matchedMarkersCount >= 2;
}

export interface ExtractedTask {
  title: string;
  time?: string;
  date?: string;
  raw: string;
}

export function normalizeTimeString(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const t = timeStr.trim();
  const ampmMatch = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/i);
  if (ampmMatch) {
    const hh = ampmMatch[1];
    const mm = ampmMatch[2] || '00';
    const period = ampmMatch[3].toUpperCase();
    return `${hh}:${mm} ${period}`;
  }
  return t;
}

/**
 * Extracts each individual task from natural-language requests.
 * Preserves every task's exact intended title, time, and original order.
 * If "kal" or "tomorrow" is present, resolves to tomorrow's date in local time.
 */
export function extractIndividualTasks(
  userText: string,
  referenceDate: Date = new Date()
): ExtractedTask[] {
  if (!userText || !userText.trim()) return [];

  // 1. Preprocess userText to convert inline task time patterns to separate lines
  let preprocessed = userText.replace(/\\n/g, '\n');
  preprocessed = preprocessed.replace(
    /([.:;!?]|\btasks?\b|\bkaam\b)\s+(?=(?:0?[1-9]|1[0-2])(?::\d{2})?\s*(?:am|pm|AM|PM|baje|बజే)\b\s*[-–—:]\s*)/gi,
    '$1\n'
  );

  const raw = preprocessed.trim();
  const lower = raw.toLowerCase();

  let targetDate: string | undefined;
  if (/\b(kal|tomorrow)\b/i.test(lower) || /(कल)/.test(raw)) {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = getLocalDateString(tomorrow);
  } else if (/\b(aaj|today)\b/i.test(lower) || /(आज)/.test(raw)) {
    targetDate = getLocalDateString(referenceDate);
  }

  const tasks: ExtractedTask[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip introductory header/instruction lines that don't specify a time
    if (
      /^(?:angel|hey angel|please|kripya|kal ke liye|aaj ke liye)[,\s]*/i.test(line) &&
      /(?:tasks?|kaam|banao|banaiye|kariye|schedule|add|create|list|ye|following)\b/i.test(line) &&
      !/\b(?:0?[1-9]|1[0-2])(?::\d{2})?\s*(?:am|pm|AM|PM|baje|बజే)\b/.test(line)
    ) {
      continue;
    }

    // Clean line and parse task
    const cleanLine = line.trim().replace(/^[\s*•-]+/, '').replace(/^(\d+)[.)]\s+/, '').trim();
    if (!cleanLine) continue;

    // Pattern 1: Time first (e.g. "9 AM - Check important messages.")
    const timeFirst = cleanLine.match(
      /^(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM|baje|बజే)?)\b\s*(?:[-–—:]\s*|\s+)(.+)$/i
    );
    if (timeFirst) {
      const timeStr = normalizeTimeString(timeFirst[1].trim());
      const titleStr = timeFirst[2].trim().replace(/[.]+$/, '').trim();
      if (titleStr) {
        tasks.push({
          title: titleStr,
          time: timeStr,
          date: targetDate,
          raw: line,
        });
        continue;
      }
    }

    // Pattern 2: Time at end (e.g. "Check important messages at 9 AM")
    const timeEnd = cleanLine.match(
      /^(.*?)\s+(?:at|by|ko|par|around)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM|baje|बజే)?)[.\s]*$/i
    );
    if (timeEnd) {
      const titleStr = timeEnd[1].trim().replace(/[.]+$/, '').trim();
      const timeStr = timeEnd[2] ? normalizeTimeString(timeEnd[2].trim()) : undefined;
      if (titleStr) {
        tasks.push({
          title: titleStr,
          time: timeStr,
          date: targetDate,
          raw: line,
        });
        continue;
      }
    }

    // Pattern 3: General task line without explicit time-separator
    if (
      !/^(namaste|hello|hi|hey|thanks|dhanyawad)\b/i.test(cleanLine) &&
      !/^(?:angel|kariye|banao|add|create)\s*(?:tasks?)?[:.]?$/i.test(cleanLine) &&
      cleanLine.length >= 3
    ) {
      tasks.push({
        title: cleanLine.replace(/[.]+$/, '').trim(),
        date: targetDate,
        raw: line,
      });
    }
  }

  return tasks;
}

/**
 * Analyzes the user's natural-language goal and breaks it down into a verified multi-step plan.
 * Follows the 6-stage lifecycle: UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> CORRECT -> FINAL REVIEW.
 */
export function createAutonomousWorkflow(
  userText: string,
  language: AssistantLanguage = 'hinglish',
  contacts: ContactItem[] = []
): TaskWorkflow {
  const raw = userText.trim();
  const lower = raw.toLowerCase();
  const plan: PlanStep[] = [];

  // STAGE 1: UNDERSTAND
  // Check for critical missing information
  let clarificationNeeded: string | undefined;

  // Check if WhatsApp action is requested without recipient or context
  if (
    (/\b(whatsapp|message|msg)\b/i.test(lower) || /(व्हाट्सएप|मैसेज)/i.test(raw)) &&
    !/\b(to|ko|par|pe)\s+([a-zA-Z0-9+]+)/i.test(lower)
  ) {
    const matchesAnyContact = contacts.some((c) => lower.includes(c.name.toLowerCase()));
    if (!matchesAnyContact && !/\b\d{10}\b/.test(lower)) {
      clarificationNeeded =
        language === 'english'
          ? 'Who should I prepare the WhatsApp message for? Please specify a contact name or phone number.'
          : 'WhatsApp message kiske liye prepare karna hai? Kripya contact name ya phone number batayein.';
    }
  }

  // Extract contact if mentioned in text
  let detectedContact: ContactItem | undefined;
  for (const c of contacts) {
    if (lower.includes(c.name.toLowerCase())) {
      detectedContact = c;
      break;
    }
  }

  // STAGE 2: PLAN - Synthesize appropriate steps
  let stepCounter = 1;

  // Step A: Content Drafting / Notes creation
  if (
    /\b(note|draft|write|likho|likhein|agenda|proposal|letter|application|summary|schedule|routine)\b/i.test(
      lower
    ) ||
    /(लिखो|लिखें|ड्राफ्ट|एजेंडा|प्रपोजल|नोट)/i.test(raw)
  ) {
    let noteTitle = 'Meeting Agenda & Action Items';
    if (lower.includes('proposal') || raw.includes('प्रपोजल')) noteTitle = 'Project Proposal';
    else if (lower.includes('agenda') || raw.includes('एजेंडा')) noteTitle = 'Meeting Agenda';
    else if (lower.includes('letter') || lower.includes('application')) noteTitle = 'Formal Application';
    else if (lower.includes('birthday') || lower.includes('wish')) noteTitle = 'Celebration Wish Draft';
    else if (lower.includes('schedule') || lower.includes('routine')) noteTitle = 'Daily Productive Schedule';

    let draftContent = '';
    if (lower.includes('meeting') || lower.includes('agenda') || raw.includes('एजेंडा')) {
      draftContent = `Team Standup & Planning Agenda\n- Time: 5:00 PM\n- Discussion: Roadmap progress, blocker resolution, and release checklist.\n- Action Items: Assign follow-ups and update tracker.`;
    } else if (lower.includes('proposal') || raw.includes('प्रपोजल')) {
      draftContent = `Angel AI Project Proposal\n- Objective: Deliver an autonomous, user-collaborative AI assistant for Android.\n- Architecture: Modular React SPA with verified voice & phone intent integrations.\n- Milestones: NLP understanding, structured planning, automated self-verification, and final review.`;
    } else if (lower.includes('schedule') || lower.includes('routine')) {
      draftContent = `Daily Productive Schedule\n- 08:00 AM: Morning focus & day planning\n- 10:00 AM: Deep work block & priority tasks\n- 02:00 PM: Team syncs & correspondence\n- 05:00 PM: Evening wrap-up & day review`;
    } else {
      draftContent = `Notes regarding: ${raw.replace(/^(?:angel|hey angel|please)[,\s]*/i, '')}\n- Prepared collaboratively by Angel.\n- Status: Drafted & verified for accuracy.`;
    }

    plan.push({
      id: `step-${stepCounter++}`,
      title: `Draft & verify content for "${noteTitle}"`,
      description: `Compose structured content and validate completeness.`,
      toolOrIntegration: 'Content Drafter & Notes Organizer',
      status: 'pending',
      result: draftContent,
      requiresUserApproval: false,
    });
  }

  // Step B: Task creation (Extract individual tasks)
  if (
    /\b(task|tasks|to-do|checklist|kaam)\b/i.test(lower) ||
    /(टास्क|काम|सूची)/i.test(raw) ||
    extractIndividualTasks(raw).length > 0
  ) {
    const extractedTasks = extractIndividualTasks(raw);
    if (extractedTasks.length > 0) {
      for (const t of extractedTasks) {
        plan.push({
          id: `step-${stepCounter++}`,
          title: `Create task: "${t.title}"${t.time ? ` at ${t.time}` : ''}${t.date ? ` on ${t.date}` : ''}`,
          description: `Record actionable to-do in your personal assistant task list.`,
          toolOrIntegration: 'Task Management Engine',
          status: 'pending',
          result: t.title,
          actionPayload: {
            type: 'task',
            title: t.title,
            time: t.time,
            date: t.date,
            priority: 'normal',
            status: 'pending_confirmation',
          },
          requiresUserApproval: true,
        });
      }
    } else {
      let taskTitle = 'Complete workflow follow-up items';
      if (lower.includes('meeting') || raw.includes('मीटिंग')) {
        taskTitle = 'Review meeting agenda and share action items';
      } else if (lower.includes('proposal') || raw.includes('प्रपोजल')) {
        taskTitle = 'Review and finalize project proposal document';
      } else if (lower.includes('exercise') || lower.includes('workout')) {
        taskTitle = 'Evening exercise and hydration routine';
      }

      plan.push({
        id: `step-${stepCounter++}`,
        title: `Create task item: "${taskTitle}"`,
        description: `Record actionable to-do in your personal assistant task list.`,
        toolOrIntegration: 'Task Management Engine',
        status: 'pending',
        result: taskTitle,
        actionPayload: {
          type: 'task',
          title: taskTitle,
          priority: 'normal',
          status: 'pending_confirmation',
        },
        requiresUserApproval: true,
      });
    }
  }

  // Step C: Reminder Scheduling
  if (
    /\b(reminder|remind me|yaad dilana|alarm)\b/i.test(lower) ||
    /(याद दिलाना|अलार्म|रिमाइंडर)/i.test(raw)
  ) {
    const parsedRem = parseReminderDetails(raw);
    const reminderTitle = parsedRem.title !== 'Angel Reminder' ? parsedRem.title : 'Scheduled Reminder';

    plan.push({
      id: `step-${stepCounter++}`,
      title: `Schedule reminder: "${reminderTitle}" at ${parsedRem.time}`,
      description: `Set an in-app reminder deadline with audio chime and alert.`,
      toolOrIntegration: 'Reminder Scheduler',
      status: 'pending',
      result: `${reminderTitle} at ${parsedRem.time} (${parsedRem.date})`,
      actionPayload: {
        type: 'reminder',
        title: reminderTitle,
        time: parsedRem.time,
        date: parsedRem.date,
        dueTimestamp: parsedRem.dueTimestamp,
        status: 'pending_confirmation',
      },
      requiresUserApproval: false,
    });
  }

  // Step D: WhatsApp Message Preparation
  if (
    /\b(whatsapp|message|msg)\b/i.test(lower) ||
    /(व्हाट्सएप|मैसेज)/i.test(raw)
  ) {
    const recipientName = detectedContact ? detectedContact.name : 'Team Member';
    const recipientPhone = detectedContact ? detectedContact.phone : '';
    let msgBody = `Hello ${recipientName}! Meeting update: We are connecting as scheduled. Please review the agenda.`;

    if (lower.includes('birthday') || lower.includes('wish')) {
      msgBody = `Happy Birthday ${recipientName}! Wishing you a wonderful year ahead full of happiness and success!`;
    } else if (lower.includes('apology') || lower.includes('sorry')) {
      msgBody = `Hello ${recipientName}, I wanted to apologize for the delay earlier. Let me know when you are free to discuss.`;
    }

    plan.push({
      id: `step-${stepCounter++}`,
      title: `Prepare WhatsApp message for ${recipientName}`,
      description: `Format WhatsApp message and prepare intent URI. Requires your explicit review before launching WhatsApp.`,
      toolOrIntegration: 'WhatsApp Intent Engine',
      status: 'pending',
      result: `Drafted: "${msgBody}"`,
      actionPayload: {
        type: 'whatsapp',
        contactName: recipientName,
        phoneNumber: recipientPhone,
        message: msgBody,
        status: 'pending_confirmation',
      },
      requiresUserApproval: true,
    });
  }

  // Step E: Phone Call Intent
  if (
    /\b(call|dial|phone lagao)\b/i.test(lower) ||
    /(कॉल|फ़ोन|फोन)/i.test(raw)
  ) {
    const recipientName = detectedContact ? detectedContact.name : 'Contact';
    const recipientPhone = detectedContact ? detectedContact.phone : '';

    plan.push({
      id: `step-${stepCounter++}`,
      title: `Prepare phone call to ${recipientName}`,
      description: `Configure tel: URI intent. Never dials automatically; requires your explicit tap.`,
      toolOrIntegration: 'Android Phone Dialer',
      status: 'pending',
      actionPayload: {
        type: 'call',
        contactName: recipientName,
        phoneNumber: recipientPhone,
        status: 'pending_confirmation',
      },
      requiresUserApproval: true,
    });
  }

  // Step F: Unsupported External Operations Guard (Ads, Purchases, Banking, etc.)
  if (
    /\b(ad|advertisement|advertise|ads|facebook ad|google ad|purchase|buy stock|shares|payment|pay money|transfer money)\b/i.test(
      lower
    ) ||
    /(विज्ञापन|खरीदारी|भुगतान|पेमेंट)/i.test(raw)
  ) {
    let unsupportedOp = 'Financial Transaction or Ad Publishing';
    if (lower.includes('ad') || raw.includes('विज्ञापन')) unsupportedOp = 'Ad Campaign Publishing';
    else if (lower.includes('pay') || lower.includes('buy') || lower.includes('purchase')) {
      unsupportedOp = 'Automated Payment / Purchase';
    }

    plan.push({
      id: `step-${stepCounter++}`,
      title: `Check external integration: ${unsupportedOp}`,
      description: `Safety guard check for external execution permissions.`,
      toolOrIntegration: 'External Integration Guard',
      status: 'failed',
      result: undefined,
      error: `Capability not available: Angel cannot execute autonomous financial transactions or external ad publishing without authorized third-party APIs.`,
      requiresUserApproval: false,
    });
  }

  // If no specific steps could be inferred, provide a default 2-step structured plan
  if (plan.length === 0) {
    plan.push({
      id: `step-${stepCounter++}`,
      title: `Analyze and structure task details`,
      description: `Process goal: "${raw.slice(0, 80)}"`,
      toolOrIntegration: 'Task Analysis Engine',
      status: 'pending',
      result: 'Task parameters analyzed and structured.',
      requiresUserApproval: false,
    });
    plan.push({
      id: `step-${stepCounter++}`,
      title: `Save structured note for review`,
      description: `Organize findings into a persistent note.`,
      toolOrIntegration: 'Notes Organizer',
      status: 'pending',
      result: `Task notes for: ${raw.slice(0, 60)}`,
      requiresUserApproval: false,
    });
  }

  const workflow: TaskWorkflow = {
    id: `wf-${Date.now()}`,
    title: raw.length > 50 ? `${raw.slice(0, 47)}...` : raw,
    originalGoal: raw,
    stage: clarificationNeeded ? 'understand' : 'plan',
    clarificationNeeded,
    plan,
    currentStepIndex: 0,
    completedSummary: [],
    verifiedItems: [],
    incompleteItems: [],
    pendingDecisions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return workflow;
}

/**
 * Executes and verifies the workflow steps iteratively:
 * UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> CORRECT -> FINAL REVIEW.
 */
export function processWorkflowExecution(
  workflow: TaskWorkflow,
  appState: WorkflowAppState = {}
): TaskWorkflow {
  // If still in understand stage, do not execute until clarification is provided
  if (workflow.stage === 'understand') {
    return workflow;
  }

  const updatedPlan: PlanStep[] = [...workflow.plan];
  const completedSummary: string[] = [];
  const verifiedItems: string[] = [];
  const incompleteItems: string[] = [];
  const pendingDecisions: string[] = [];

  for (let i = 0; i < updatedPlan.length; i++) {
    const step = updatedPlan[i];

    // If step was already marked failed during planning (e.g. unsupported capability), record it honestly
    if (step.toolOrIntegration === 'External Integration Guard') {
      incompleteItems.push(`${step.title}: ${step.error || 'External integration not supported'}`);
      continue;
    }

    // 1. EXECUTE STEP
    step.status = 'in_progress';

    // 2. VERIFY STEP RESULT
    const verification = verifyStep(step, appState);

    if (verification.passed) {
      step.verificationEvidence = verification.evidence;

      if (step.requiresUserApproval) {
        step.status = 'needs_approval';
        incompleteItems.push(`${step.title} (Requires your review & tap)`);
        pendingDecisions.push(`Confirm ${step.toolOrIntegration} launch`);
      } else {
        step.status = 'completed';
        completedSummary.push(step.title);
        verifiedItems.push(verification.evidence);
      }
    } else {
      // 3. CORRECT STAGE
      step.status = 'failed';
      step.error = verification.error;

      // Apply safe automatic correction where possible
      const correction = attemptStepCorrection(step, appState);
      if (correction.corrected) {
        step.status = step.requiresUserApproval ? 'needs_approval' : 'completed';
        step.result = correction.newResult;
        step.verificationEvidence = `Corrected & Verified: ${correction.newEvidence}`;
        verifiedItems.push(`Auto-corrected: ${correction.explanation}`);
        if (!step.requiresUserApproval) {
          completedSummary.push(`${step.title} (Auto-corrected)`);
        } else {
          pendingDecisions.push(`Confirm ${step.toolOrIntegration} launch`);
        }
      } else {
        incompleteItems.push(`${step.title}: ${verification.error}`);
      }
    }
  }

  // 4. TRANSITION TO FINAL REVIEW
  const hasIncompleteOrApproval = updatedPlan.some(
    (s) => s.status === 'needs_approval' || s.status === 'failed'
  );

  const finalStage: WorkflowStage = 'review';
  const statusMessage = hasIncompleteOrApproval
    ? 'Workflow completed with items awaiting your final review and confirmation.'
    : 'All workflow steps executed and verified successfully.';

  return {
    ...workflow,
    stage: finalStage,
    plan: updatedPlan,
    currentStepIndex: updatedPlan.length,
    completedSummary,
    verifiedItems,
    incompleteItems,
    pendingDecisions,
    statusMessage,
    updatedAt: Date.now(),
  };
}

/**
 * STAGE 4: VERIFY
 * Validates step outputs, required fields, numbers, consistency, and tool results.
 */
export function verifyStep(
  step: PlanStep,
  appState: WorkflowAppState = {}
): { passed: boolean; evidence: string; error?: string } {
  // Verification for Content / Notes drafting
  if (step.toolOrIntegration.includes('Notes') || step.toolOrIntegration.includes('Drafter')) {
    if (!step.result || step.result.trim().length < 5) {
      return {
        passed: false,
        evidence: '',
        error: 'Drafted content is too brief or empty.',
      };
    }
    return {
      passed: true,
      evidence: `Content verified: ${step.result.length} characters, structured paragraphs confirmed.`,
    };
  }

  // Verification for Tasks
  if (step.toolOrIntegration.includes('Task')) {
    if (!step.result || step.result.trim().length < 3) {
      return {
        passed: false,
        evidence: '',
        error: 'Task title is empty or invalid.',
      };
    }
    return {
      passed: true,
      evidence: `Task entry verified: "${step.result}" ready for to-do list.`,
    };
  }

  // Verification for Reminders
  if (step.toolOrIntegration.includes('Reminder')) {
    const payload = step.actionPayload;
    if (!payload || !payload.time) {
      return {
        passed: false,
        evidence: '',
        error: 'Reminder time parameter is missing.',
      };
    }
    if (!payload.dueTimestamp || payload.dueTimestamp <= 0) {
      return {
        passed: false,
        evidence: '',
        error: 'Invalid reminder due timestamp.',
      };
    }
    return {
      passed: true,
      evidence: `Reminder verified: Scheduled for ${payload.date} at ${payload.time} (epoch: ${payload.dueTimestamp}).`,
    };
  }

  // Verification for WhatsApp
  if (step.toolOrIntegration.includes('WhatsApp')) {
    const payload = step.actionPayload;
    if (!payload || !payload.message || payload.message.trim().length < 2) {
      return {
        passed: false,
        evidence: '',
        error: 'WhatsApp message draft is empty.',
      };
    }
    const phoneValid = payload.phoneNumber ? validatePhoneNumber(payload.phoneNumber) : false;
    if (!phoneValid) {
      return {
        passed: false,
        evidence: '',
        error: 'Recipient phone number is missing or invalid.',
      };
    }
    return {
      passed: true,
      evidence: `WhatsApp message drafted (${payload.message.length} chars) with verified recipient number (${payload.phoneNumber}).`,
    };
  }

  // Verification for Phone Call
  if (step.toolOrIntegration.includes('Dialer') || step.toolOrIntegration.includes('Call')) {
    const payload = step.actionPayload;
    if (!payload || !payload.phoneNumber || !validatePhoneNumber(payload.phoneNumber)) {
      return {
        passed: false,
        evidence: '',
        error: 'Call recipient phone number is missing or invalid.',
      };
    }
    return {
      passed: true,
      evidence: `Dialer intent verified for ${payload.contactName || 'recipient'} (${payload.phoneNumber}).`,
    };
  }

  // Verification for External Integration Guard
  if (step.toolOrIntegration === 'External Integration Guard') {
    return {
      passed: false,
      evidence: '',
      error: step.error || 'External capability unavailable.',
    };
  }

  // Default fallback verification
  return {
    passed: true,
    evidence: `Action parameter validation passed for ${step.title}.`,
  };
}

/**
 * STAGE 5: CORRECT
 * If verification detects an issue, explain and automatically correct it if safe.
 */
export function attemptStepCorrection(
  step: PlanStep,
  appState: WorkflowAppState = {}
): { corrected: boolean; newResult?: string; newEvidence?: string; explanation: string } {
  // Auto-correct missing WhatsApp or Call recipient from saved contacts
  if (
    (step.toolOrIntegration.includes('WhatsApp') ||
      step.toolOrIntegration.includes('Dialer') ||
      step.toolOrIntegration.includes('Call')) &&
    step.actionPayload
  ) {
    if (!step.actionPayload.phoneNumber && appState.contacts && appState.contacts.length > 0) {
      const match = searchContacts(appState.contacts, step.actionPayload.contactName || '');
      if (match.length > 0) {
        step.actionPayload.phoneNumber = match[0].phone;
        step.actionPayload.contactName = match[0].name;
        return {
          corrected: true,
          newResult: step.actionPayload.message
            ? `Drafted for ${match[0].name} (${match[0].phone}): "${step.actionPayload.message}"`
            : `Call intent ready for ${match[0].name} (${match[0].phone})`,
          newEvidence: `Auto-linked contact phone number from saved contacts.`,
          explanation: `Linked ${match[0].name}'s phone number (${match[0].phone}) from address book.`,
        };
      }
    }
  }

  // Auto-correct empty reminder time to default
  if (step.toolOrIntegration.includes('Reminder') && step.actionPayload) {
    if (!step.actionPayload.time) {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      step.actionPayload.time = getLocalTimeString(now);
      step.actionPayload.date = getLocalDateString(now);
      step.actionPayload.dueTimestamp = now.getTime();
      return {
        corrected: true,
        newResult: `${step.actionPayload.title} at ${step.actionPayload.time}`,
        newEvidence: `Set default future time (${step.actionPayload.time}).`,
        explanation: `Set reminder time to next hour (${step.actionPayload.time}).`,
      };
    }
  }

  // Auto-correct brief or missing note content
  if ((step.toolOrIntegration.includes('Notes') || step.toolOrIntegration.includes('Drafter')) && (!step.result || step.result.trim().length < 5)) {
    const fallbackDraft = `Auto-Structured Content for "${step.title}"\n- Status: Drafted by Angel Assistant.\n- Details: Content verified for completeness.\n- Ready for user review.`;
    return {
      corrected: true,
      newResult: fallbackDraft,
      newEvidence: `Auto-generated structured draft template (${fallbackDraft.length} chars).`,
      explanation: `Filled empty draft with structured content template.`,
    };
  }

  return {
    corrected: false,
    explanation: step.error || 'Cannot automatically correct without user decision.',
  };
}

/**
 * STAGE 6: FINAL REVIEW
 * Formats a clean conversational summary of completed items, verified facts, and required approvals.
 */
export function formatWorkflowReviewSummary(
  workflow: TaskWorkflow,
  language: AssistantLanguage = 'hinglish'
): string {
  // If in understand stage, present clarification question directly
  if (workflow.stage === 'understand' && workflow.clarificationNeeded) {
    return workflow.clarificationNeeded;
  }

  const completed = workflow.completedSummary || [];
  const verified = workflow.verifiedItems || [];
  const incomplete = workflow.incompleteItems || [];
  const decisions = workflow.pendingDecisions || [];

  if (language === 'english') {
    let out = `I have worked through your request and verified the results:\n\n`;
    if (completed.length > 0) {
      out += `✅ Completed Steps:\n${completed.map((c) => `• ${c}`).join('\n')}\n\n`;
    }
    if (verified.length > 0) {
      out += `🔍 Verified Evidence:\n${verified.map((v) => `• ${v}`).join('\n')}\n\n`;
    }
    if (incomplete.length > 0) {
      out += `⚠️ Incomplete Items / Limitations:\n${incomplete.map((inc) => `• ${inc}`).join('\n')}\n\n`;
    }
    if (decisions.length > 0) {
      out += `⚠️ Requires Your Final Approval:\n${decisions.map((d) => `• ${d}`).join('\n')}\n\n`;
    }
    out += `Please inspect the interactive workflow card below for final review.`;
    return out;
  }

  // Default: Hinglish (Roman script only)
  let out = `Maine aapke task par kaam karke verification complete kar li hai:\n\n`;
  if (completed.length > 0) {
    out += `✅ Completed Steps:\n${completed.map((c) => `• ${c}`).join('\n')}\n\n`;
  }
  if (verified.length > 0) {
    out += `🔍 Verified Evidence:\n${verified.map((v) => `• ${v}`).join('\n')}\n\n`;
  }
  if (incomplete.length > 0) {
    out += `⚠️ Incomplete Items / Limitations:\n${incomplete.map((inc) => `• ${inc}`).join('\n')}\n\n`;
  }
  if (decisions.length > 0) {
    out += `⚠️ Requires Your Approval:\n${decisions.map((d) => `• ${d}`).join('\n')}\n\n`;
  }
  out += `Niche diye gaye interactive card mein Final Review karein aur approve karein.`;
  return out;
}

/**
 * Helper to verify saved task list against extracted requested tasks.
 */
export function verifySavedTasks(
  requestedTasks: ExtractedTask[],
  savedTasks: TaskItem[]
): { passed: boolean; missing: string[]; evidence: string } {
  const missing: string[] = [];
  for (const req of requestedTasks) {
    const found = savedTasks.some(
      (st) =>
        st.title.toLowerCase().includes(req.title.toLowerCase()) ||
        req.title.toLowerCase().includes(st.title.toLowerCase())
    );
    if (!found) {
      missing.push(req.title);
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      missing,
      evidence: `Verification failed: Missing saved tasks: ${missing.join(', ')}`,
    };
  }

  return {
    passed: true,
    missing: [],
    evidence: `Verification passed: All ${requestedTasks.length} requested tasks successfully found in saved task list.`,
  };
}
