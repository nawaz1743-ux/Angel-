/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'user' | 'assistant';

export type ActionType = 'call' | 'whatsapp' | 'sms' | 'reminder' | 'task' | 'note' | 'map' | 'timer';

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  relation?: string;
  email?: string;
}

export interface ActionPayload {
  type: ActionType;
  title?: string;
  contactName?: string;
  phoneNumber?: string;
  message?: string;
  time?: string;
  date?: string;
  dueTimestamp?: number;
  priority?: 'normal' | 'urgent';
  durationSeconds?: number;
  location?: string;
  matches?: ContactItem[]; // If multiple contacts match query
  status?: 'pending_confirmation' | 'disambiguation_needed' | 'executed' | 'cancelled';
  statusMessage?: string;
}

export type WorkflowStage =
  | 'understand'
  | 'plan'
  | 'execute'
  | 'verify'
  | 'correct'
  | 'review'
  | 'completed';

export type PlanStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'needs_approval'
  | 'failed';

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  toolOrIntegration: string;
  status: PlanStepStatus;
  result?: string;
  verificationEvidence?: string;
  error?: string;
  requiresUserApproval?: boolean;
  actionPayload?: ActionPayload;
}

export interface TaskWorkflow {
  id: string;
  title: string;
  originalGoal: string;
  stage: WorkflowStage;
  clarificationNeeded?: string;
  plan: PlanStep[];
  currentStepIndex: number;
  completedSummary?: string[];
  verifiedItems?: string[];
  incompleteItems?: string[];
  pendingDecisions?: string[];
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  isVoice?: boolean;
  provider?: string;
  action?: ActionPayload;
  workflow?: TaskWorkflow;
  intentSuggestion?: {
    type: 'whatsapp' | 'call' | 'reminder' | 'note' | 'timer';
    label: string;
    target?: string;
    body?: string;
  };
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  priority: 'normal' | 'urgent';
  time?: string;
  date?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  category: 'personal' | 'work' | 'idea';
}

export interface ReminderItem {
  id: string;
  title: string;
  time: string;
  date: string;
  dueTimestamp: number;
  active: boolean;
  notified?: boolean;
  createdAt?: number;
}

export type AssistantLanguage = 'hinglish' | 'english';
export type AssistantPersonality = 'friendly' | 'professional' | 'coder';
export type ProviderPriority = 'auto' | 'gemini-first' | 'openai-first';

export interface ProviderStatusInfo {
  id: 'gemini' | 'openai' | 'offline';
  name: string;
  isConfigured: boolean;
  status: 'ready' | 'unconfigured' | 'quota_exhausted' | 'blocked_requires_paid_consent' | 'auth_error' | 'error';
  isFreeTierEligible: boolean;
  details?: string;
  supportedModels: string[];
}

export interface UserSettings {
  language: AssistantLanguage;
  spokenResponses: boolean;
  speechRate: number;
  personality: AssistantPersonality;
  autoListenAfterSpeech: boolean;
  darkTheme: boolean;
  providerPriority: ProviderPriority;
  allowPaidUsage: boolean;
}

export type ActiveTab = 'home' | 'chat' | 'phone' | 'tasks' | 'screen' | 'settings';
