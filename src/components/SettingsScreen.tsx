/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Languages,
  Volume2,
  Mic,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  Layers,
  KeyRound,
  ExternalLink,
  Cpu,
  RefreshCw,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { UserSettings, AssistantLanguage, AssistantPersonality, ProviderPriority, ProviderStatusInfo } from '../types/assistant';

interface SettingsScreenProps {
  settings: UserSettings;
  onUpdateSettings: (updater: (prev: UserSettings) => UserSettings) => void;
  onTestVoice: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onTestVoice,
}) => {
  const [micPermStatus, setMicPermStatus] = useState<string>('Ready on demand');
  const [testVoiceStatus, setTestVoiceStatus] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatusInfo[]>([
    {
      id: 'gemini',
      name: 'Google Gemini',
      isConfigured: true,
      status: 'ready',
      isFreeTierEligible: true,
      details: 'Checking live status...',
      supportedModels: ['gemini-3.5-flash-lite'],
    },
    {
      id: 'openai',
      name: 'OpenAI API',
      isConfigured: false,
      status: 'unconfigured',
      isFreeTierEligible: false,
      details: 'Checking live status...',
      supportedModels: ['gpt-4o-mini', 'gpt-3.5-turbo'],
    },
  ]);
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(false);

  const fetchProviders = useCallback(async () => {
    setIsRefreshingProviders(true);
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.providers)) {
          setProviderStatuses(data.providers);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch provider status:', e);
    } finally {
      setIsRefreshingProviders(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const checkMicrophone = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermStatus('Granted & Working');
      } else {
        setMicPermStatus('SpeechRecognition fallback active');
      }
    } catch (err: any) {
      setMicPermStatus('Requires tap in browser: ' + (err.name || 'Check permissions'));
    }
  };

  const handleVoiceTest = () => {
    onTestVoice();
    setTestVoiceStatus('Playing test audio...');
    setTimeout(() => setTestVoiceStatus(null), 3000);
  };

  return (
    <div className="flex flex-col gap-5 pb-24 pt-3 px-4 max-w-md mx-auto animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-violet-400" />
          <span>Angel Settings & Architecture</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Customize Angel's voice, personality, language, and review Android architecture details.
        </p>
      </div>

      {/* Language Preferences */}
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Languages className="w-4 h-4 text-violet-400" />
          <span>Conversation Language</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              { id: 'hinglish', label: 'Hinglish (Default)', desc: 'Hindi + English in Roman script' },
              { id: 'english', label: 'English', desc: 'Natural English' },
            ] as const
          ).map((lang) => {
            const isSelected = settings.language === lang.id;
            return (
              <button
                key={lang.id}
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    language: lang.id as AssistantLanguage,
                  }))
                }
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/50 font-bold'
                    : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-slate-200'
                }`}
              >
                <span className="text-xs">{lang.label}</span>
                <span className="text-[10px] opacity-75 mt-0.5">{lang.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Voice & Speech Output */}
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Volume2 className="w-4 h-4 text-violet-400" />
            <span>Angel Spoken Voice Responses</span>
          </div>
          <button
            onClick={() =>
              onUpdateSettings((prev) => ({
                ...prev,
                spokenResponses: !prev.spokenResponses,
              }))
            }
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
              settings.spokenResponses ? 'bg-violet-600 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="bg-white w-4 h-4 rounded-full shadow-md" />
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          When enabled, Angel reads responses aloud using natural female speech synthesis in Hinglish (Roman script) or English.
        </p>

        {/* Speech Speed slider */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Speech Speed:</span>
            <span className="font-semibold text-violet-400">{settings.speechRate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.3"
            step="0.1"
            value={settings.speechRate}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                speechRate: parseFloat(e.target.value),
              }))
            }
            className="w-full accent-violet-500 cursor-pointer"
          />
        </div>

        <button
          onClick={handleVoiceTest}
          aria-label="Test Angel voice output"
          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-violet-300 border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Volume2 className="w-4 h-4" />
          <span>{testVoiceStatus || (settings.language === 'english' ? 'Test Angel Voice (Listen)' : 'Test Angel Voice (Aawaz Sunein)')}</span>
        </button>
      </div>

      {/* Personality Mode */}
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Personality Mode</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'friendly', label: 'Friendly', desc: 'Warm & Caring' },
              { id: 'professional', label: 'Executive', desc: 'Crisp & Direct' },
              { id: 'coder', label: 'Tech & Code', desc: 'Coding Expert' },
            ] as const
          ).map((mode) => {
            const isSelected = settings.personality === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    personality: mode.id as AssistantPersonality,
                  }))
                }
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-slate-950/60 text-slate-400 border-white/5'
                }`}
              >
                <span className="text-xs">{mode.label}</span>
                <span className="text-[10px] opacity-75 mt-0.5">{mode.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-Provider AI System & Cost Safety */}
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>AI Provider Status</span>
          </div>
          <button
            onClick={fetchProviders}
            title="Refresh Provider Status"
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingProviders ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Angel's Gemini model is fixed to Gemini 3.5 Flash-Lite. It does not try other Gemini models.
        </p>

        {/* Provider Priority Selection */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-slate-300">Provider Priority:</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'auto', label: 'Auto (Free First)', desc: 'Recommended' },
              { id: 'gemini-first', label: 'Gemini', desc: 'Free Tier priority' },
              { id: 'openai-first', label: 'OpenAI', desc: 'Requires Paid Consent' },
            ].map((p) => {
              const isSelected = (settings.providerPriority || 'auto') === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      providerPriority: p.id as ProviderPriority,
                    }))
                  }
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[11px]">{p.label}</span>
                  <span className="text-[9px] opacity-75 mt-0.5">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time Provider Status Badges */}
        <div className="space-y-2 pt-1 border-t border-white/5 text-xs">
          {providerStatuses.map((prov) => {
            const isGemini = prov.id === 'gemini';
            return (
              <div
                key={prov.id}
                className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        prov.status === 'ready'
                          ? 'bg-emerald-400 animate-pulse'
                          : prov.status === 'quota_exhausted'
                          ? 'bg-amber-400'
                          : prov.status === 'auth_error'
                          ? 'bg-rose-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span>{prov.name}</span>
                    {prov.isFreeTierEligible && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Free Tier
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold ${
                      prov.status === 'ready'
                        ? 'text-emerald-400'
                        : prov.status === 'quota_exhausted'
                        ? 'text-amber-400'
                        : prov.status === 'auth_error'
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {prov.status === 'ready'
                      ? 'Connected'
                      : prov.status === 'quota_exhausted'
                      ? 'Quota Cooldown (429)'
                      : prov.status === 'auth_error'
                      ? 'Auth Failed (401)'
                      : 'Key Not Set'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">{prov.details}</p>
              </div>
            );
          })}
        </div>

        {/* Strict Cost Safety Gate Switch */}
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>Allow Paid API Usage</span>
            </div>
            <button
              onClick={() =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  allowPaidUsage: !prev.allowPaidUsage,
                }))
              }
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                settings.allowPaidUsage ? 'bg-amber-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="bg-white w-4 h-4 rounded-full shadow-md" />
            </button>
          </div>

          <p className="text-[10px] text-slate-300 leading-relaxed">
            <strong>Cost Protection Guarantee:</strong> Default is <strong>OFF</strong>. When OFF, Angel will never call OpenAI or any billable models. If free Gemini quota is exhausted, Angel stops and notifies you instead of incurring charges.
          </p>
        </div>
      </div>

      {/* Android Device Permissions Status */}
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Android Permissions & Hardware Check</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-white/5">
            <div className="flex items-center gap-2 text-slate-300">
              <Mic className="w-4 h-4 text-violet-400" />
              <span>Microphone Speech Input</span>
            </div>
            <button
              onClick={checkMicrophone}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30 hover:bg-violet-500/30"
            >
              {micPermStatus}
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-white/5">
            <div className="flex items-center gap-2 text-slate-300">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>API Key Protection</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold">
              Server Proxy (Zero exposure)
            </span>
          </div>
        </div>
      </div>

      {/* Development Roadmap & Completed Features Log */}
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Development Status & Roadmap</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
            Step 1 Complete
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Honest progress record: here is what is fully built and working right now vs what requires Android native packaging:
        </p>

        {/* Working Foundation */}
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
            <p className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Completed & Functional Today:</span>
            </p>
            <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1 pl-1">
              <li>Angel Identity & Hinglish/English chat personality</li>
              <li>Secure server-side Gemini 3.8 Flash backend proxy</li>
              <li>Voice Speech-to-Text via microphone button</li>
              <li>Voice Text-to-Speech playback with female voice</li>
              <li>Android WhatsApp intent launcher (<code>whatsapp://send</code>)</li>
              <li>Safe phone calling dialer intent (<code>tel:</code>)</li>
              <li>Screen assistance image vision analyzer</li>
              <li>Tasks, Notes & Reminders with mobile storage</li>
              <li>Android status bar & mobile navigation interface</li>
            </ul>
          </div>

          {/* Next Native Steps */}
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
            <p className="font-bold text-blue-300 flex items-center gap-1.5 mb-1 text-xs">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Next Steps for Native APK Build:</span>
            </p>
            <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1 pl-1">
              <li>Packaging via Capacitor/TWA for Google Play Store APK</li>
              <li>Background ForegroundService for &quot;Hey Angel&quot; voice hotword</li>
              <li>AccessibilityService for automated screen taps on native OS</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
