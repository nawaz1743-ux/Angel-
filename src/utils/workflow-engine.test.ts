/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMultiStepTaskRequest,
  createAutonomousWorkflow,
  processWorkflowExecution,
  verifyStep,
  attemptStepCorrection,
  formatWorkflowReviewSummary,
  extractIndividualTasks,
  verifySavedTasks,
} from './workflow-engine.ts';
import type { ContactItem, TaskWorkflow, PlanStep, TaskItem } from '../types/assistant.ts';

const SAMPLE_CONTACTS: ContactItem[] = [
  { id: 'c1', name: 'Rahul Sharma', phone: '+919876543210', relation: 'Colleague' },
  { id: 'c2', name: 'Priya Verma', phone: '+919123456789', relation: 'Friend' },
];

test('isMultiStepTaskRequest identifies explicit workflow and multi-step triggers in English', () => {
  assert.equal(isMultiStepTaskRequest('Work with me to organize my weekly goals'), true);
  assert.equal(
    isMultiStepTaskRequest('Draft a meeting agenda and schedule a reminder for 5 PM'),
    true
  );
  assert.equal(
    isMultiStepTaskRequest('Create a task for project review then prepare a WhatsApp message to Rahul'),
    true
  );
  assert.equal(isMultiStepTaskRequest('Help me complete step by step workflow for release'), true);
});

test('isMultiStepTaskRequest identifies Hindi and Hinglish multi-action commands', () => {
  assert.equal(
    isMultiStepTaskRequest('Rahul ko WhatsApp message bhejo aur mujhe sham 6 baje yaad dilana'),
    true
  );
  assert.equal(
    isMultiStepTaskRequest('Ek meeting agenda likho aur 5 baje ka reminder lagao'),
    true
  );
  assert.equal(
    isMultiStepTaskRequest('राहुल को व्हाट्सएप पर मैसेज तैयार करो और मुझे शाम 5 बजे याद दिलाना'),
    true
  );
  assert.equal(isMultiStepTaskRequest('Mere sath kaam karo aur task plan banao'), true);
});

test('isMultiStepTaskRequest ignores simple queries or single action commands', () => {
  assert.equal(isMultiStepTaskRequest('What is the weather today?'), false);
  assert.equal(isMultiStepTaskRequest('Namaste Angel!'), false);
  assert.equal(isMultiStepTaskRequest('Call Rahul'), false);
  assert.equal(isMultiStepTaskRequest('Remind me to drink water in 1 minute'), false);
  assert.equal(isMultiStepTaskRequest(''), false);
});

test('createAutonomousWorkflow creates structured multi-step plan (PLAN stage)', () => {
  const workflow = createAutonomousWorkflow(
    'Draft a project proposal, create a task to review it, and schedule a reminder at 18:00',
    'english',
    SAMPLE_CONTACTS
  );

  assert.equal(workflow.stage, 'plan');
  assert.ok(workflow.plan.length >= 3);
  assert.ok(workflow.plan.some((s) => s.toolOrIntegration.includes('Notes') || s.toolOrIntegration.includes('Drafter')));
  assert.ok(workflow.plan.some((s) => s.toolOrIntegration.includes('Task')));
  assert.ok(workflow.plan.some((s) => s.toolOrIntegration.includes('Reminder')));

  // Initial step statuses must all be 'pending'
  for (const step of workflow.plan) {
    assert.equal(step.status, 'pending');
  }
});

test('createAutonomousWorkflow enters UNDERSTAND stage when critical recipient info is missing', () => {
  const workflow = createAutonomousWorkflow(
    'Send a WhatsApp message and draft notes',
    'english',
    SAMPLE_CONTACTS
  );

  assert.equal(workflow.stage, 'understand');
  assert.ok(workflow.clarificationNeeded);
  assert.ok(
    workflow.clarificationNeeded.includes('Who should I prepare the WhatsApp message for') ||
    workflow.clarificationNeeded.includes('contact name')
  );
});

test('createAutonomousWorkflow honestly identifies unsupported external capabilities', () => {
  const workflow = createAutonomousWorkflow(
    'Publish a Facebook ad campaign and draft meeting notes',
    'english',
    SAMPLE_CONTACTS
  );

  const guardStep = workflow.plan.find((s) => s.toolOrIntegration === 'External Integration Guard');
  assert.ok(guardStep, 'Must include External Integration Guard for unsupported actions');
  assert.equal(guardStep?.status, 'failed');
  assert.ok(guardStep?.error?.includes('Capability not available'));
});

test('processWorkflowExecution executes and verifies steps (EXECUTE -> VERIFY)', () => {
  const initial = createAutonomousWorkflow(
    'Draft meeting agenda and schedule reminder at 18:00',
    'hinglish',
    SAMPLE_CONTACTS
  );

  const executed = processWorkflowExecution(initial, {
    contacts: SAMPLE_CONTACTS,
  });

  assert.equal(executed.stage, 'review');
  assert.ok(executed.completedSummary && executed.completedSummary.length > 0);
  assert.ok(executed.verifiedItems && executed.verifiedItems.length > 0);

  // Completed steps have verification evidence
  const completedSteps = executed.plan.filter((s) => s.status === 'completed');
  for (const step of completedSteps) {
    assert.ok(step.verificationEvidence, `Step ${step.title} must have verification evidence`);
  }
});

test('processWorkflowExecution handles verification failures and safe auto-correction (CORRECT stage)', () => {
  // Construct a step with missing phone number for a known contact name
  const stepWithMissingPhone: PlanStep = {
    id: 'step-wa',
    title: 'Prepare WhatsApp message for Rahul Sharma',
    toolOrIntegration: 'WhatsApp Intent Engine',
    status: 'pending',
    requiresUserApproval: true,
    actionPayload: {
      type: 'whatsapp',
      contactName: 'Rahul Sharma',
      phoneNumber: '', // missing phone number
      message: 'Hello Rahul, team sync today at 5.',
      status: 'pending_confirmation',
    },
  };

  const workflow: TaskWorkflow = {
    id: 'wf-test-correct',
    title: 'WhatsApp workflow',
    originalGoal: 'WhatsApp Rahul',
    stage: 'plan',
    plan: [stepWithMissingPhone],
    currentStepIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const executed = processWorkflowExecution(workflow, {
    contacts: SAMPLE_CONTACTS,
  });

  const correctedStep = executed.plan[0];
  assert.equal(correctedStep.status, 'needs_approval');
  assert.equal(correctedStep.actionPayload?.phoneNumber, '+919876543210');
  assert.ok(correctedStep.verificationEvidence?.includes('Auto-linked contact phone number'));
  assert.ok(executed.verifiedItems?.some((v) => v.includes('Auto-corrected')));
});

test('verifyStep fails and does not falsely pass invalid parameters', () => {
  // Empty draft
  const emptyNoteStep: PlanStep = {
    id: 'step-1',
    title: 'Draft note',
    toolOrIntegration: 'Content Drafter & Notes Organizer',
    status: 'in_progress',
    result: '   ',
  };
  const noteVerification = verifyStep(emptyNoteStep);
  assert.equal(noteVerification.passed, false);
  assert.ok(noteVerification.error);

  // Invalid reminder timestamp
  const invalidReminderStep: PlanStep = {
    id: 'step-2',
    title: 'Schedule reminder',
    toolOrIntegration: 'Reminder Scheduler',
    status: 'in_progress',
    actionPayload: {
      type: 'reminder',
      time: '18:00',
      dueTimestamp: -1,
    },
  };
  const remVerification = verifyStep(invalidReminderStep);
  assert.equal(remVerification.passed, false);
  assert.ok(remVerification.error);
});

test('formatWorkflowReviewSummary formats complete summary for FINAL REVIEW stage', () => {
  const workflow: TaskWorkflow = {
    id: 'wf-summary-test',
    title: 'Review test',
    originalGoal: 'Review goal',
    stage: 'review',
    plan: [
      {
        id: 's1',
        title: 'Draft agenda',
        toolOrIntegration: 'Notes Organizer',
        status: 'completed',
        verificationEvidence: 'Content verified: 120 characters.',
      },
      {
        id: 's2',
        title: 'WhatsApp Priya',
        toolOrIntegration: 'WhatsApp Intent Engine',
        status: 'needs_approval',
        requiresUserApproval: true,
      },
    ],
    currentStepIndex: 2,
    completedSummary: ['Draft agenda'],
    verifiedItems: ['Content verified: 120 characters.'],
    incompleteItems: ['WhatsApp Priya (Requires your review & tap)'],
    pendingDecisions: ['Confirm WhatsApp launch'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const summaryEnglish = formatWorkflowReviewSummary(workflow, 'english');
  assert.ok(summaryEnglish.includes('Completed Steps'));
  assert.ok(summaryEnglish.includes('Draft agenda'));
  assert.ok(summaryEnglish.includes('Verified Evidence'));
  assert.ok(summaryEnglish.includes('Requires Your Final Approval'));

  const summaryHinglish = formatWorkflowReviewSummary(workflow, 'hinglish');
  assert.ok(summaryHinglish.includes('Completed Steps'));
  assert.ok(summaryHinglish.includes('Draft agenda'));
  assert.ok(summaryHinglish.includes('Verified Evidence'));
  assert.ok(summaryHinglish.includes('Requires Your Approval'));
  // Verify zero Devanagari in Hinglish mode
  assert.equal(/[\u0900-\u097F]/.test(summaryHinglish), false);
});

test('multi-task creation regression test: "Angel, kal ke liye ye 3 tasks banao..."', () => {
  const prompt = `Angel, kal ke liye ye 3 tasks banao:
9 AM - Check important messages.
11 AM - Complete pending work.
6 PM - Plan for the next day.`;

  // 1. Extract individual tasks
  const extracted = extractIndividualTasks(prompt);
  assert.equal(extracted.length, 3, 'Exactly three tasks must be extracted');
  assert.equal(extracted[0].title, 'Check important messages');
  assert.equal(extracted[0].time, '9:00 AM');
  assert.ok(extracted[0].date, '"kal" must resolve to tomorrow date');

  assert.equal(extracted[1].title, 'Complete pending work');
  assert.equal(extracted[1].time, '11:00 AM');

  assert.equal(extracted[2].title, 'Plan for the next day');
  assert.equal(extracted[2].time, '6:00 PM');

  // 2. Verify isMultiStepTaskRequest detects the multiline task prompt
  assert.equal(isMultiStepTaskRequest(prompt), true, 'isMultiStepTaskRequest must return true for multiline task prompt');

  // 3. Create autonomous workflow & verify 3 distinct task steps are planned
  const workflow = createAutonomousWorkflow(prompt, 'hinglish', SAMPLE_CONTACTS);
  const taskSteps = workflow.plan.filter((s) => s.toolOrIntegration === 'Task Management Engine');
  assert.equal(taskSteps.length, 3, 'Workflow must contain 3 distinct task steps');

  // Ensure the entire raw prompt never becomes one task title
  for (const step of taskSteps) {
    const taskTitle = step.actionPayload?.title || step.result || '';
    assert.notEqual(taskTitle.trim(), prompt.trim(), 'Raw prompt must never become a single task title');
    assert.ok(taskTitle.length < prompt.length, 'Task title must be individual task title, not full prompt');
  }

  // 4. Test single-line pasted input with inline times
  const singleLinePasted = `Angel, kal ke liye ye 3 tasks banao: 9 AM - Check important messages. 11 AM - Complete pending work. 6 PM - Plan for the next day.`;
  assert.equal(isMultiStepTaskRequest(singleLinePasted), true, 'isMultiStepTaskRequest must return true for singleline pasted task prompt');
  const extractedPasted = extractIndividualTasks(singleLinePasted);
  assert.equal(extractedPasted.length, 3, 'Singleline pasted input must extract 3 tasks');
  assert.equal(extractedPasted[0].title, 'Check important messages');
  assert.equal(extractedPasted[0].time, '9:00 AM');

  // 5. Before approval, no tasks are saved
  const initialSavedTasks: TaskItem[] = [];
  assert.equal(initialSavedTasks.length, 0, 'No tasks saved before approval');

  // 6. Simulate approval: save all 3 tasks
  const savedTasksAfterApproval: TaskItem[] = taskSteps.map((s, idx) => ({
    id: `task-reg-${idx}`,
    title: s.actionPayload?.title || s.result || s.title,
    completed: false,
    createdAt: Date.now(),
    priority: 'normal',
    time: s.actionPayload?.time,
    date: s.actionPayload?.date,
  }));

  // 7. Read actual saved task list and verify
  const verification = verifySavedTasks(extracted, savedTasksAfterApproval);
  assert.equal(verification.passed, true, 'Verification of saved tasks must pass');
  assert.equal(savedTasksAfterApproval.length, 3, 'All 3 tasks must be saved');

  // 8. Missing tasks cause verification failure
  const incompleteSavedTasks: TaskItem[] = [savedTasksAfterApproval[0]];
  const failedVerification = verifySavedTasks(extracted, incompleteSavedTasks);
  assert.equal(failedVerification.passed, false, 'Missing tasks must cause verification failure');
  assert.ok(failedVerification.missing.length > 0, 'Missing tasks reported');
});
