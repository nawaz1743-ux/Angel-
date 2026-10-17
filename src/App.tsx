/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AndroidStatusBar } from './components/AndroidStatusBar';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { PhoneFeaturesScreen } from './components/PhoneFeaturesScreen';
import { PersonalAssistantScreen } from './components/PersonalAssistantScreen';
import { ScreenAssistScreen } from './components/ScreenAssistScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ContactsModal } from './components/ContactsModal';
import { useSpeech } from './hooks/useSpeech';
import {
  ActiveTab,
  ChatMessage,
  TaskItem,
  NoteItem,
  ReminderItem,
  UserSettings,
  ContactItem,
  ActionPayload,
  TaskWorkflow,
  AssistantLanguage,
  ProviderPriority,
} from './types/assistant';
import {
  getFallbackAngelReply,
  parseAssistantAction,
  INITIAL_CONTACTS,
  playAlarmChime,
  createReminderItem,
  checkDueReminders,
  getLocalDateString,
  getLocalTimeString,
} from './utils/assistant-logic';
import {
  isMultiStepTaskRequest,
  createAutonomousWorkflow,
  processWorkflowExecution,
  formatWorkflowReviewSummary,
} from './utils/workflow-engine';
import { Bell, X, Clock } from 'lucide-react';

const DEFAULT_SETTINGS: UserSettings = {
  language: 'hinglish',
  spokenResponses: true,
  speechRate: 1.0,
  personality: 'friendly',
  autoListenAfterSpeech: false,
  darkTheme: true,
  providerPriority: 'auto',
  allowPaidUsage: false,
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: 'Hello Sir! Main Angel hoon, aapki personal AI assistant.\nBataiye Sir, main aaj aapki kis kaam mein madad kar sakti hoon?',
    timestamp: Date.now(),
    provider: 'Angel Assistant Engine',
  },
];

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-101',
    title: 'Check important messages',
    completed: false,
    createdAt: Date.now() - 3600000,
    priority: 'normal',
    time: '9:00 AM',
    date: '2026-10-17',
  },
  {
    id: 'task-102',
    title: 'Complete pending work',
    completed: false,
    createdAt: Date.now() - 2700000,
    priority: 'normal',
    time: '11:00 AM',
    date: '2026-10-17',
  },
  {
    id: 'task-103',
    title: 'Plan for the next day',
    completed: false,
    createdAt: Date.now() - 1800000,
    priority: 'normal',
    time: '6:00 PM',
    date: '2026-10-17',
  },
];

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Angel App Vision',
    content: 'Angel is designed for smooth everyday smartphone assistance with privacy and safe Android intents.',
    createdAt: Date.now() - 7200000,
    category: 'personal',
  },
];

const INITIAL_REMINDERS: ReminderItem[] = [
  {
    id: 'rem-1',
    title: 'Daily Evening Review',
    time: '19:00',
    date: getLocalDateString(),
    dueTimestamp: Date.now() + 3600000 * 4,
    active: true,
    notified: false,
    createdAt: Date.now(),
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isAiConnected, setIsAiConnected] = useState<boolean>(true);

  // Check backend health & Gemini status on startup
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setIsAiConnected(Boolean(data.hasGeminiKey));
      })
      .catch((err) => {
        console.warn('Backend health check error:', err);
        setIsAiConnected(false);
      });
  }, []);

  // Settings state with localStorage persistence
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('angel_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const language: AssistantLanguage = parsed.language === 'english' ? 'english' : 'hinglish';
        const providerPriority: ProviderPriority =
          parsed.providerPriority === 'gemini-first' || parsed.providerPriority === 'openai-first'
            ? parsed.providerPriority
            : 'auto';
        const allowPaidUsage: boolean = Boolean(parsed.allowPaidUsage);
        return { ...DEFAULT_SETTINGS, ...parsed, language, providerPriority, allowPaidUsage };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Messages state with localStorage persistence
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('angel_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m) => {
            if (
              m.id === 'welcome-1' &&
              m.role === 'assistant' &&
              (m.text.includes('Namaste!') || m.text.includes('aapki kya madad karoon?'))
            ) {
              return {
                ...m,
                text: 'Hello Sir! Main Angel hoon, aapki personal AI assistant.\nBataiye Sir, main aaj aapki kis kaam mein madad kar sakti hoon?',
              };
            }
            return m;
          });
        }
      }
      return INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  // Tasks state with safe migration/restoration for dates, times, and legacy properties
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('angel_tasks');
      let loaded: TaskItem[] = saved ? JSON.parse(saved) : INITIAL_TASKS;

      if (!Array.isArray(loaded) || loaded.length === 0) {
        loaded = INITIAL_TASKS;
      }

      // Safe migration/repair to preserve user data and supply missing dates/times for the 3 target tasks
      return loaded.map((task) => {
        const rawTask = task as any;
        let date = task.date || rawTask.dueDate || rawTask.taskDate;
        let time = task.time || rawTask.dueTime || rawTask.taskTime;

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

        return {
          ...task,
          date,
          time,
        };
      });
    } catch {
      return INITIAL_TASKS;
    }
  });

  // Notes state
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('angel_notes');
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });

  // Reminders state with backwards-compatible dueTimestamp & notified restoration
  const [reminders, setReminders] = useState<ReminderItem[]>(() => {
    try {
      const saved = localStorage.getItem('angel_reminders');
      if (saved) {
        const parsed: ReminderItem[] = JSON.parse(saved);
        return parsed.map((r) => {
          let dueTimestamp = r.dueTimestamp;
          if (!dueTimestamp && r.date && r.time) {
            const [y, m, d] = r.date.split('-').map(Number);
            const [hh, mm] = r.time.split(':').map(Number);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hh) && !isNaN(mm)) {
              dueTimestamp = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
            } else {
              dueTimestamp = Date.now();
            }
          }
          return {
            ...r,
            dueTimestamp: dueTimestamp || Date.now(),
            notified: Boolean(r.notified),
          };
        });
      }
      return INITIAL_REMINDERS;
    } catch {
      return INITIAL_REMINDERS;
    }
  });

  // Contacts state
  const [contacts, setContacts] = useState<ContactItem[]>(() => {
    try {
      const saved = localStorage.getItem('angel_contacts');
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
    } catch {
      return INITIAL_CONTACTS;
    }
  });

  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<ReminderItem | null>(null);

  const handleSendMessageRef = useRef<(text: string, isVoice?: boolean) => void>(() => {});
  const speechRef = useRef<any>(null);

  // Hook for Speech Input and Output
  const speech = useSpeech({
    language: settings.language,
    spokenResponses: settings.spokenResponses,
    speechRate: settings.speechRate,
    onTranscriptReceived: (transcript) => {
      setActiveTab('chat');
      handleSendMessageRef.current(transcript, true);
    },
    onWakeWordDetected: () => {
      const ackMsg =
        settings.language === 'english'
          ? 'Yes, I am listening.'
          : 'Haan, bolo, main sun rahi hoon.';
      speechRef.current?.speak(ackMsg);
    },
  });
  speechRef.current = speech;

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('angel_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('angel_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('angel_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('angel_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('angel_reminders', JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem('angel_contacts', JSON.stringify(contacts));
  }, [contacts]);

  // Periodic Reminder & Alarm Checker (runs every 1 second while app is open)
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      setReminders((prevReminders) => {
        const { dueReminders, updatedReminders } = checkDueReminders(prevReminders, now);
        if (dueReminders.length > 0) {
          playAlarmChime();
          setActiveAlarm(dueReminders[0]);

          for (const due of dueReminders) {
            // Trigger browser notification if permission is granted
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                const notif = new Notification(`Angel Reminder: ${due.title}`, {
                  body: `Scheduled for ${due.time}. Tap to view.`,
                  icon: '/favicon.ico',
                });
                notif.onclick = () => {
                  window.focus();
                };
              } catch (err) {
                console.warn('System notification error:', err);
              }
            }

            // Speak aloud if spoken responses are enabled
            if (settings.spokenResponses) {
              speech.speak(`Reminder: ${due.title}`);
            }
          }

          return updatedReminders;
        }
        return prevReminders;
      });
    };

    const interval = setInterval(checkReminders, 1000);
    checkReminders();
    return () => clearInterval(interval);
  }, [settings.spokenResponses, speech]);

  const handleAddContact = useCallback((newContact: Omit<ContactItem, 'id'>) => {
    setContacts((prev) => [
      ...prev,
      { ...newContact, id: `contact-${Date.now()}` },
    ]);
  }, []);

  const handleDeleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleUpdateMessageAction = useCallback(
    (messageId: string, updatedAction: ActionPayload) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, action: updatedAction } : m))
      );

      if (updatedAction.status === 'executed') {
        if (updatedAction.type === 'reminder') {
          const newRem = createReminderItem(
            updatedAction.title || 'Scheduled Reminder',
            updatedAction.time || '18:00',
            updatedAction.date,
            updatedAction.dueTimestamp
          );
          setReminders((prev) => [newRem, ...prev]);
          if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
          }
        } else if (updatedAction.type === 'task') {
          const newTask: TaskItem = {
            id: `task-${Date.now()}`,
            title: updatedAction.title || 'New Task',
            completed: false,
            createdAt: Date.now(),
            priority: updatedAction.priority || 'normal',
            time: updatedAction.time,
            date: updatedAction.date,
          };
          setTasks((prev) => [...prev, newTask]);
        }
      }
    },
    []
  );

  // Send message handler
  const handleSendMessage = useCallback(
    async (text: string, isVoice: boolean = false) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: text.trim(),
        timestamp: Date.now(),
        isVoice,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setChatError(null);

      // 1. Autonomous Task-Execution Workflow (UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> CORRECT -> FINAL REVIEW)
      if (isMultiStepTaskRequest(text)) {
        const initialWorkflow = createAutonomousWorkflow(text, settings.language, contacts);
        const executedWorkflow = processWorkflowExecution(initialWorkflow, {
          notes,
          tasks,
          reminders,
          contacts,
        });
        const reviewSummary = formatWorkflowReviewSummary(executedWorkflow, settings.language);

        const assistantMsg: ChatMessage = {
          id: `angel-wf-${Date.now()}`,
          role: 'assistant',
          text: reviewSummary,
          timestamp: Date.now(),
          provider: 'Angel Workflow Engine',
          workflow: executedWorkflow,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);

        if (settings.spokenResponses) {
          speechRef.current?.speak(reviewSummary);
        }
        return;
      }

      // 2. Intelligently parse natural language action commands (Calling, WhatsApp, Reminders, Tasks, Maps)
      const actionResult = parseAssistantAction(text, contacts, settings.language);

      if (actionResult.action) {
        const assistantMsg: ChatMessage = {
          id: `angel-${Date.now()}`,
          role: 'assistant',
          text: actionResult.conversationalReply,
          timestamp: Date.now(),
          provider: 'Angel Intent Engine',
          action: actionResult.action,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);

        if (settings.spokenResponses) {
          speechRef.current?.speak(actionResult.conversationalReply);
        }
        return;
      }

      // 2. Otherwise proceed with AI query via /api/chat
      const lower = text.toLowerCase();
      let intentSuggestion: ChatMessage['intentSuggestion'] = undefined;
      if (lower.includes('whatsapp') || lower.includes('message bhejo') || lower.includes('send message')) {
        intentSuggestion = {
          type: 'whatsapp',
          label: 'Open WhatsApp Tool',
        };
      } else if (lower.includes('call') || lower.includes('phone lagao') || lower.includes('dial')) {
        intentSuggestion = {
          type: 'call',
          label: 'Open Calling Dialer',
        };
      } else if (lower.includes('task') || lower.includes('reminder') || lower.includes('yaad dilana')) {
        intentSuggestion = {
          type: 'reminder',
          label: 'View Tasks & Reminders',
        };
      }

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            history: messages.slice(-10).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              text: m.text,
            })),
            language: settings.language,
            personality: settings.personality,
            providerPriority: settings.providerPriority || 'auto',
            allowPaidUsage: Boolean(settings.allowPaidUsage),
          }),
        });

        const data = await response.json();

        if (data.isRealAi) {
          setIsAiConnected(true);
          setChatError(null);
          setLastFailedPrompt(null);
        } else if (data.isPaidBlocked) {
          // Transparent notice that paid API call was safely prevented
          setChatError(data.note || "OpenAI paid API access is blocked by safety policy. Turn on 'Allow paid API usage' in Settings if authorized.");
          setLastFailedPrompt(null);
        } else if (data.isQuotaExceeded) {
          // Informative warning, not a breaking crash
          setChatError(data.note || 'Gemini Free Tier daily quota limit reached on API key. Angel smart offline engine responded.');
          setLastFailedPrompt(null);
        } else if (data.error) {
          setChatError(data.error);
          setLastFailedPrompt(text);
        } else if (data.note) {
          setChatError(data.note);
          setLastFailedPrompt(null);
        } else {
          setLastFailedPrompt(null);
        }

        const replyText =
          data.reply || getFallbackAngelReply(text, settings.language);

        const assistantMsg: ChatMessage = {
          id: `angel-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: Date.now(),
          provider: data.provider || 'Angel Engine',
          intentSuggestion,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Speak aloud if enabled
        if (settings.spokenResponses) {
          speechRef.current?.speak(replyText);
        }
      } catch (err: any) {
        console.warn('Backend /api/chat error, utilizing fallback:', err);
        setChatError(err?.message || 'Could not reach backend AI server. Processed via local engine.');
        setLastFailedPrompt(text);
        const fallbackText = getFallbackAngelReply(text, settings.language);
        const assistantMsg: ChatMessage = {
          id: `angel-${Date.now()}`,
          role: 'assistant',
          text: fallbackText,
          timestamp: Date.now(),
          provider: 'Angel Local Engine',
          intentSuggestion,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (settings.spokenResponses) {
          speechRef.current?.speak(fallbackText);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, settings.language, settings.personality, settings.spokenResponses]
  );

  handleSendMessageRef.current = handleSendMessage;

  const handleRetryMessage = useCallback(() => {
    if (lastFailedPrompt) {
      handleSendMessage(lastFailedPrompt);
    }
  }, [lastFailedPrompt, handleSendMessage]);

  // Task actions
  const handleAddTask = (title: string, priority: 'normal' | 'urgent', time?: string, date?: string) => {
    const newTask: TaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      completed: false,
      createdAt: Date.now(),
      priority,
      time,
      date,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleUpdateTask = useCallback((id: string, updates: Partial<Omit<TaskItem, 'id'>>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Note actions
  const handleAddNote = (title: string, content: string, category: 'personal' | 'work' | 'idea') => {
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title,
      content,
      createdAt: Date.now(),
      category,
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Reminder actions
  const handleAddReminder = (title: string, time: string, date: string, dueTimestamp?: number) => {
    const newRem = createReminderItem(title, time, date, dueTimestamp);
    setReminders((prev) => [newRem, ...prev]);
  };

  const handleToggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextActive = !r.active;
          return {
            ...r,
            active: nextActive,
            notified: nextActive && r.dueTimestamp > Date.now() ? false : r.notified,
          };
        }
        return r;
      })
    );
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  // Workflow Approval Handlers (Final Review -> Commit to App State)
  const handleApproveWorkflowAll = useCallback((messageId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId || msg.workflow?.id === messageId) {
          if (!msg.workflow) return msg;

          const updatedPlan = msg.workflow.plan.map((step) => {
            if (step.toolOrIntegration.includes('Notes') || step.toolOrIntegration.includes('Drafter')) {
              if (step.result) {
                const noteTitle =
                  step.title.replace(/^Draft & verify content for ["']?|["']?$/gi, '').trim() ||
                  'Workflow Draft';
                handleAddNote(noteTitle, step.result, 'work');
              }
            } else if (step.toolOrIntegration.includes('Task')) {
              const taskTitle =
                step.actionPayload?.title ||
                step.result?.replace(/^Create task(?:\s*item)?: ["']?|["']?$/gi, '').trim() ||
                step.title;
              const taskTime = step.actionPayload?.time;
              const taskDate = step.actionPayload?.date;
              handleAddTask(taskTitle, 'normal', taskTime, taskDate);
            } else if (step.toolOrIntegration.includes('Reminder')) {
              if (step.actionPayload) {
                handleAddReminder(
                  step.actionPayload.title || 'Scheduled Reminder',
                  step.actionPayload.time || '18:00',
                  step.actionPayload.date || getLocalDateString(),
                  step.actionPayload.dueTimestamp
                );
              }
            }
            return {
              ...step,
              status: 'completed' as const,
            };
          });

          const completedWorkflow: TaskWorkflow = {
            ...msg.workflow,
            stage: 'completed',
            plan: updatedPlan,
            statusMessage: 'All workflow steps approved and synchronized into your assistant.',
            pendingDecisions: [],
            updatedAt: Date.now(),
          };

          return {
            ...msg,
            workflow: completedWorkflow,
          };
        }
        return msg;
      })
    );

    if (settings.spokenResponses) {
      speech.speak(
        settings.language === 'english'
          ? 'Workflow approved! All notes, tasks, and reminders have been synchronized.'
          : 'Workflow approve ho gaya hai! Sabhi notes, tasks aur reminders save ho gaye hain.'
      );
    }
  }, [settings.language, settings.spokenResponses, speech]);

  const handleApproveWorkflowStep = useCallback((messageId: string, stepId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId || msg.workflow?.id === messageId) {
          if (!msg.workflow) return msg;

          const updatedPlan = msg.workflow.plan.map((step) => {
            if (step.id === stepId) {
              if (step.toolOrIntegration.includes('Notes') || step.toolOrIntegration.includes('Drafter')) {
                if (step.result) {
                  const noteTitle =
                    step.title.replace(/^Draft & verify content for ["']?|["']?$/gi, '').trim() ||
                    'Workflow Draft';
                  handleAddNote(noteTitle, step.result, 'work');
                }
              } else if (step.toolOrIntegration.includes('Task')) {
                const taskTitle =
                  step.actionPayload?.title ||
                  step.result?.replace(/^Create task(?:\s*item)?: ["']?|["']?$/gi, '').trim() ||
                  step.title;
                const taskTime = step.actionPayload?.time;
                const taskDate = step.actionPayload?.date;
                handleAddTask(taskTitle, 'normal', taskTime, taskDate);
              } else if (step.toolOrIntegration.includes('Reminder')) {
                if (step.actionPayload) {
                  handleAddReminder(
                    step.actionPayload.title || 'Scheduled Reminder',
                    step.actionPayload.time || '18:00',
                    step.actionPayload.date || getLocalDateString(),
                    step.actionPayload.dueTimestamp
                  );
                }
              }
              return {
                ...step,
                status: 'completed' as const,
              };
            }
            return step;
          });

          const allDone = updatedPlan.every((s) => s.status === 'completed');
          return {
            ...msg,
            workflow: {
              ...msg.workflow,
              plan: updatedPlan,
              stage: allDone ? 'completed' : msg.workflow.stage,
              statusMessage: allDone
                ? 'All workflow steps approved and synchronized.'
                : msg.workflow.statusMessage,
              updatedAt: Date.now(),
            },
          };
        }
        return msg;
      })
    );
  }, []);

  const handleRejectWorkflow = useCallback((messageId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId || msg.workflow?.id === messageId) {
          if (!msg.workflow) return msg;
          return {
            ...msg,
            workflow: {
              ...msg.workflow,
              stage: 'completed',
              statusMessage: 'Workflow cancelled by user.',
              plan: msg.workflow.plan.map((s) =>
                s.status === 'needs_approval'
                  ? { ...s, status: 'failed' as const, error: 'Cancelled by user.' }
                  : s
              ),
              pendingDecisions: [],
              updatedAt: Date.now(),
            },
          };
        }
        return msg;
      })
    );
  }, []);

  const handleClearChat = () => {
    if (window.confirm('Clear conversation history?')) {
      setMessages(INITIAL_MESSAGES);
    }
  };

  const handleTestVoice = () => {
    const testPhrase =
      settings.language === 'english'
        ? "Hello Sir! I am Angel, your personal AI assistant."
        : 'Hello Sir! Main Angel hoon, aapki personal AI assistant. Aawaz bilkul natural hai!';
    speech.speak(testPhrase);
  };

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start overflow-hidden selection:bg-violet-500 selection:text-white">
      {/* Mobile container wrapper */}
      <main className="w-full max-w-md h-full max-h-screen bg-slate-950 flex flex-col relative shadow-2xl border-x border-white/5 overflow-hidden">
        {/* Android Simulated Status Bar */}
        <AndroidStatusBar
          isListening={speech.isListening}
          isSpeaking={speech.isSpeaking}
          language={settings.language}
        />

        {/* Tab Views */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'home' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <HomeScreen
                onNavigate={setActiveTab}
                isListening={speech.isListening}
                isSpeaking={speech.isSpeaking}
                isHandsFreeActive={speech.isHandsFreeActive}
                isAwaitingHandsFreeCommand={speech.isAwaitingHandsFreeCommand}
                onStartHandsFree={speech.startHandsFree}
                onStopHandsFree={speech.stopHandsFree}
                speechError={speech.speechError}
                onMicClick={() => {
                  if (speech.isListening) {
                    speech.stopListening();
                  } else {
                    speech.startListening();
                  }
                }}
                onSendMessage={(text) => {
                  handleSendMessage(text);
                  setActiveTab('chat');
                }}
                settings={settings}
                transcript={speech.transcript}
                onOpenContacts={() => setIsContactsModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 pb-14">
              <ChatScreen
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                isListening={speech.isListening}
                isSpeaking={speech.isSpeaking}
                isHandsFreeActive={speech.isHandsFreeActive}
                isAwaitingHandsFreeCommand={speech.isAwaitingHandsFreeCommand}
                onStartHandsFree={speech.startHandsFree}
                onStopHandsFree={speech.stopHandsFree}
                speechError={speech.speechError}
                isPaused={speech.isPaused}
                transcript={speech.transcript}
                onStartListening={speech.startListening}
                onStopListening={speech.stopListening}
                onSpeakText={speech.speak}
                onPauseSpeech={speech.pauseSpeech}
                onResumeSpeech={speech.resumeSpeech}
                onCancelSpeech={speech.cancelSpeech}
                settings={settings}
                onUpdateSettings={setSettings}
                onNavigate={setActiveTab}
                onClearChat={handleClearChat}
                error={chatError}
                onClearError={() => setChatError(null)}
                onRetry={lastFailedPrompt ? handleRetryMessage : undefined}
                isAiConnected={isAiConnected}
                contacts={contacts}
                onUpdateMessageAction={handleUpdateMessageAction}
                onOpenContacts={() => setIsContactsModalOpen(true)}
                onApproveWorkflowStep={handleApproveWorkflowStep}
                onApproveWorkflowAll={handleApproveWorkflowAll}
                onRejectWorkflow={handleRejectWorkflow}
              />
            </div>
          )}

          {activeTab === 'phone' && (
            <div className="flex-1 overflow-y-auto pb-16">
              <PhoneFeaturesScreen />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="flex-1 overflow-y-auto pb-16">
              <PersonalAssistantScreen
                tasks={tasks}
                notes={notes}
                reminders={reminders}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onAddReminder={handleAddReminder}
                onToggleReminder={handleToggleReminder}
                onDeleteReminder={handleDeleteReminder}
              />
            </div>
          )}

          {activeTab === 'screen' && (
            <div className="flex-1 overflow-y-auto pb-16">
              <ScreenAssistScreen />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto pb-16">
              <SettingsScreen
                settings={settings}
                onUpdateSettings={setSettings}
                onTestVoice={handleTestVoice}
              />
            </div>
          )}
        </div>

        {/* Bottom Navigation only visible when away from the clean Home screen */}
        {activeTab !== 'home' && (
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        {/* Contacts Book Modal */}
        <ContactsModal
          isOpen={isContactsModalOpen}
          onClose={() => setIsContactsModalOpen(false)}
          contacts={contacts}
          onAddContact={handleAddContact}
          onDeleteContact={handleDeleteContact}
          onSelectContact={(c) => {
            setActiveTab('chat');
            handleSendMessage(`Call ${c.name}`);
          }}
        />

        {/* Active Scheduled Reminder / Alarm Trigger Modal */}
        {activeAlarm && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(245,158,11,0.35)] text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 animate-bounce">
                <Bell className="w-8 h-8" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300">
                Angel Reminder Alert
              </span>
              <h2 className="text-xl font-extrabold text-white mt-3">{activeAlarm.title}</h2>
              <p className="text-sm font-semibold text-amber-400 mt-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{activeAlarm.time}</span>
              </p>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    const snoozeDue = Date.now() + 5 * 60 * 1000;
                    const snoozeDateObj = new Date(snoozeDue);
                    const snoozeTime = getLocalTimeString(snoozeDateObj);
                    const snoozeDate = getLocalDateString(snoozeDateObj);
                    handleAddReminder(
                      `${activeAlarm.title} (Snoozed)`,
                      snoozeTime,
                      snoozeDate,
                      snoozeDue
                    );
                    setActiveAlarm(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Snooze 5 Min
                </button>
                <button
                  onClick={() => setActiveAlarm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
