/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  X,
  Wifi,
  Users,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { ChatMessage, UserSettings, ActiveTab, ContactItem, ActionPayload } from '../types/assistant';
import { formatTime } from '../utils/assistant-logic';
import { ActionConfirmationCard } from './ActionConfirmationCard';
import { TaskWorkflowCard } from './TaskWorkflowCard';

interface ChatScreenProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, isVoice?: boolean) => void;
  isLoading: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isHandsFreeActive?: boolean;
  isAwaitingHandsFreeCommand?: boolean;
  onStartHandsFree?: () => void;
  onStopHandsFree?: () => void;
  isPaused?: boolean;
  currentSpeakingText?: string | null;
  transcript: string;
  speechError?: string | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onSpeakText: (text: string) => void;
  onPauseSpeech?: () => void;
  onResumeSpeech?: () => void;
  onCancelSpeech: () => void;
  settings: UserSettings;
  onUpdateSettings: (updater: (prev: UserSettings) => UserSettings) => void;
  onNavigate: (tab: ActiveTab) => void;
  onClearChat: () => void;
  error?: string | null;
  onClearError?: () => void;
  onRetry?: () => void;
  isAiConnected?: boolean;
  contacts?: ContactItem[];
  onUpdateMessageAction?: (messageId: string, updatedAction: ActionPayload) => void;
  onOpenContacts?: () => void;
  onApproveWorkflowStep?: (messageId: string, stepId: string) => void;
  onApproveWorkflowAll?: (messageId: string) => void;
  onRejectWorkflow?: (messageId: string) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  messages,
  onSendMessage,
  isLoading,
  isListening,
  isSpeaking,
  isHandsFreeActive = false,
  isAwaitingHandsFreeCommand = false,
  onStartHandsFree,
  onStopHandsFree,
  isPaused = false,
  currentSpeakingText = null,
  transcript,
  speechError = null,
  onStartListening,
  onStopListening,
  onSpeakText,
  onPauseSpeech,
  onResumeSpeech,
  onCancelSpeech,
  settings,
  onUpdateSettings,
  onNavigate,
  onClearChat,
  error,
  onClearError,
  onRetry,
  isAiConnected = true,
  contacts = [],
  onUpdateMessageAction,
  onOpenContacts,
  onApproveWorkflowStep,
  onApproveWorkflowAll,
  onRejectWorkflow,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, transcript]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync transcript into input
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || isLoading) return;
    onSendMessage(clean, isListening);
    setInputText('');
    if (isListening) {
      onStopListening();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = settings.language === 'english' ? [
    { label: 'Hello Angel! How are you?', text: 'Hello Angel! How are you and how can you help me today?' },
    { label: 'Python / JS coding help', text: 'Explain React state management in simple English.' },
    { label: 'WhatsApp message draft', text: 'Draft a polite leave message for my manager on WhatsApp.' },
    { label: 'Today productive routine', text: 'Create a productive daily schedule for me today.' },
  ] : [
    { label: 'Hello Angel! Kaise ho?', text: 'Hello Angel! Aap kaise ho aur aaj meri kya help kar sakti ho?' },
    { label: 'Python / JS coding doubt', text: 'Mujhe React state management samjhao simple Hinglish mein.' },
    { label: 'WhatsApp message draft', text: 'WhatsApp par boss ko leave ka message draft karke do.' },
    { label: 'Aaj ka productive routine', text: 'Mujhe aaj ke liye ek productive daily schedule bana kar do.' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full relative">
      {/* Hands-Free Active Banner */}
      {isHandsFreeActive && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-emerald-300 font-medium shrink-0 z-20">
          <div className="flex items-center gap-1.5 min-w-0">
            <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
            <span className="truncate">
              {isAwaitingHandsFreeCommand
                ? (settings.language === 'english' ? 'Listening for your request...' : 'Aapki request sun rahi hoon...')
                : (settings.language === 'english' ? 'Hands-Free: Speak "Angel"' : 'Hands-Free: Boliye "Angel"')}
            </span>
          </div>
          <button
            onClick={onStopHandsFree}
            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-white/10 shrink-0 ml-2"
          >
            Stop
          </button>
        </div>
      )}

      {/* Speech Error Banner */}
      {speechError && (
        <div className="bg-rose-950/90 border-b border-rose-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-rose-200 shrink-0 z-20">
          <span className="truncate">{speechError}</span>
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 backdrop-blur-md border-b border-white/10 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          {/* Back to Home Button */}
          <button
            onClick={() => onNavigate('home')}
            aria-label="Back to Home"
            className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-white/5 active:scale-95"
            title="Go to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Angel Avatar */}
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 via-pink-500 to-amber-400 p-[1.5px] shadow-sm">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-slate-950 rounded-full" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-white tracking-tight">Angel</h2>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                isAiConnected
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {isAiConnected ? 'Multi-Provider AI • Active' : 'Offline Backup'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>
                {isListening
                  ? (settings.language === 'english' ? 'Listening to your voice...' : 'Aapki aawaz sun rahi hoon...')
                  : isSpeaking
                  ? (settings.language === 'english' ? 'Spoken response active' : 'Spoken response chal raha hai')
                  : 'Online & ready'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Hands-Free Mode Toggle Button */}
          {isHandsFreeActive ? (
            <button
              onClick={onStopHandsFree}
              aria-label="Stop Hands-Free Mode"
              className="px-2 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold active:scale-95 flex items-center gap-1 transition-all animate-pulse"
              title="Hands-Free Active (Click to Stop)"
            >
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span>Stop Hands-Free</span>
            </button>
          ) : (
            onStartHandsFree && (
              <button
                onClick={onStartHandsFree}
                aria-label="Enable Hands-Free Mode"
                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-violet-300 hover:text-white border border-violet-500/30 text-[11px] font-semibold active:scale-95 flex items-center gap-1 transition-all"
                title="Enable Hands-Free ('Angel')"
              >
                <Mic className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden sm:inline">Hands-Free</span>
              </button>
            )
          )}

          {onOpenContacts && (
            <button
              onClick={onOpenContacts}
              aria-label="Open Contacts Book"
              className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 active:scale-95 flex items-center gap-1 text-[11px] font-medium transition-all"
              title="Contacts Book"
            >
              <Users className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">Contacts</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isSpeaking) onCancelSpeech();
              onUpdateSettings((prev) => ({
                ...prev,
                spokenResponses: !prev.spokenResponses,
              }));
            }}
            aria-label={settings.spokenResponses ? 'Disable voice replies' : 'Enable voice replies'}
            className={`p-1.5 rounded-xl border transition-all text-xs active:scale-95 ${
              settings.spokenResponses
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                : 'bg-slate-800 text-slate-400 border-white/5'
            }`}
            title={settings.spokenResponses ? 'Voice replies enabled' : 'Voice replies muted'}
          >
            {settings.spokenResponses ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={onClearChat}
            aria-label="Clear chat history"
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5 active:scale-95"
            title="Clear conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Voice Speech Controls Bar (Pause, Resume, Stop) */}
      {isSpeaking && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-violet-950/80 border-b border-violet-500/30 text-xs text-white backdrop-blur-md animate-fadeIn">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] font-medium text-violet-200">
              {isPaused
                ? (settings.language === 'english' ? 'Speech Paused' : 'Speech Paused (Ruka hua)')
                : (settings.language === 'english' ? 'Angel is speaking...' : 'Angel is speaking... (Bol rahi hoon)')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isPaused ? (
              <button
                onClick={onResumeSpeech}
                aria-label="Resume speech playback"
                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                title="Resume playback"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                onClick={onPauseSpeech}
                aria-label="Pause speech playback"
                className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                title="Pause playback"
              >
                <Pause className="w-3 h-3 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={onCancelSpeech}
              aria-label="Stop speech playback"
              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
              title="Stop playback"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* Clear Error Message Banner if something went wrong */}
      {error && (
        <div className="mx-3 my-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start justify-between text-xs text-rose-300 shrink-0 animate-fadeIn">
          <div className="flex items-start gap-2 pr-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Connection or Response Issue</p>
              <p className="text-[11px] text-rose-300/90 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-500/30 active:scale-95"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
            {onClearError && (
              <button
                onClick={onClearError}
                aria-label="Dismiss error"
                className="p-1 text-rose-400 hover:text-rose-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-10">
            <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-2 text-violet-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Angel is ready to chat</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Hindi, Hinglish ya English mein baat karein. Coding, daily tasks, WhatsApp intents sab mein help milegi.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-900 border border-white/10 text-slate-200 rounded-bl-xs'
                  }`}
                >
                  {/* Sender Header for Assistant */}
                  {!isUser && (
                    <div className="flex items-center justify-between text-[10px] text-violet-400 font-semibold mb-1 border-b border-white/5 pb-1">
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span>Angel</span>
                      </div>
                      {msg.provider && (
                        <span className="text-slate-400 font-normal text-[9px]">{msg.provider}</span>
                      )}
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="whitespace-pre-wrap leading-relaxed break-words font-normal">
                    {msg.text}
                  </div>

                  {/* Executable Action Card (Call, WhatsApp, Reminder, Task, Map) */}
                  {msg.action && (
                    <ActionConfirmationCard
                      action={msg.action}
                      onExecute={(updatedAction) => {
                        if (onUpdateMessageAction) {
                          onUpdateMessageAction(msg.id, updatedAction);
                        }
                      }}
                      onCancel={() => {
                        if (onUpdateMessageAction) {
                          onUpdateMessageAction(msg.id, { ...msg.action!, status: 'cancelled' });
                        }
                      }}
                      savedContacts={contacts}
                      onOpenContactsPicker={onOpenContacts}
                    />
                  )}

                  {/* Autonomous Task Workflow Card (Understand -> Plan -> Execute -> Verify -> Correct -> Final Review) */}
                  {msg.workflow && (
                    <TaskWorkflowCard
                      workflow={msg.workflow}
                      onApproveStep={(stepId) => {
                        if (onApproveWorkflowStep) onApproveWorkflowStep(msg.id, stepId);
                      }}
                      onApproveAll={() => {
                        if (onApproveWorkflowAll) onApproveWorkflowAll(msg.id);
                      }}
                      onRejectWorkflow={() => {
                        if (onRejectWorkflow) onRejectWorkflow(msg.id);
                      }}
                      onExecuteAction={(act) => {
                        if (onUpdateMessageAction) onUpdateMessageAction(msg.id, act);
                      }}
                      savedContacts={contacts}
                      onOpenContactsPicker={onOpenContacts}
                    />
                  )}

                  {/* Intent Suggestion Chip */}
                  {msg.intentSuggestion && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() => {
                          if (msg.intentSuggestion?.type === 'whatsapp') {
                            onNavigate('phone');
                          } else if (msg.intentSuggestion?.type === 'call') {
                            onNavigate('phone');
                          } else {
                            onNavigate('tasks');
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 font-semibold text-[11px] border border-violet-500/30 transition-all active:scale-95"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{msg.intentSuggestion.label}</span>
                      </button>
                    </div>
                  )}

                  {/* Message Footer with Time and Action Buttons */}
                  <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 text-[10px] opacity-75">
                    <span className="text-slate-400">{formatTime(msg.timestamp)}</span>

                    <div className="flex items-center gap-2">
                      {!isUser && (
                        <button
                          onClick={() => onSpeakText(msg.text)}
                          aria-label="Speak message aloud"
                          className="hover:text-violet-300 p-0.5 rounded transition-colors"
                          title="Speak aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        aria-label="Copy text"
                        className="hover:text-slate-200 p-0.5 rounded transition-colors"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Prominent Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5 text-xs text-violet-300 bg-slate-900 border border-violet-500/30 px-3.5 py-2.5 rounded-2xl w-fit shadow-md animate-pulse">
            <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
            <span className="font-medium">
              {settings.language === 'english' ? 'Angel is thinking...' : 'Angel soch rahi hai...'}
            </span>
            <div className="flex gap-1 ml-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-3 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0 bg-slate-950/60 border-t border-white/5">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(p.text)}
            className="text-[11px] whitespace-nowrap px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 shrink-0 transition-all active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Live Speech Recognition Transcript Banner */}
      {isListening && (
        <div className="px-3.5 py-1.5 bg-rose-500/10 border-t border-rose-500/30 flex items-center justify-between text-xs text-rose-300 shrink-0 animate-pulse">
          <div className="flex items-center gap-2 overflow-hidden">
            <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-bounce" />
            <span className="truncate">
              {transcript || (settings.language === 'english' ? 'Listening in English...' : 'Listening in Hinglish...')}
            </span>
          </div>
          <button
            onClick={onStopListening}
            className="text-[10px] font-bold uppercase tracking-wider text-white bg-rose-600 px-2.5 py-0.5 rounded-md hover:bg-rose-500 shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2 bg-slate-950 border-t border-white/10 flex items-center gap-2 shrink-0"
      >
        {/* Microphone Button */}
        <button
          type="button"
          onClick={isListening ? onStopListening : onStartListening}
          aria-label={isListening ? 'Stop voice recording' : 'Start voice speech input'}
          className={`p-2.5 rounded-full shadow-md transition-all active:scale-95 shrink-0 ${
            isListening
              ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40'
              : 'bg-slate-800 text-violet-400 hover:text-violet-300 border border-white/10'
          }`}
          title="Voice speech input"
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Text Input */}
        <textarea
          ref={inputRef as any}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={
            isListening
              ? 'Listening...'
              : settings.language === 'english'
              ? 'Ask Angel anything in English...'
              : 'Ask Angel anything in Hinglish / English...'
          }
          className="flex-1 bg-slate-900 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 transition-all resize-none max-h-24"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          aria-label="Send Message"
          className={`p-2.5 rounded-full transition-all shrink-0 active:scale-95 ${
            inputText.trim() && !isLoading
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/40'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
          }`}
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
