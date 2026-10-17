/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Share2,
  PhoneCall,
  MessageSquare,
  ShieldAlert,
  ExternalLink,
  Check,
  AlertCircle,
  Copy,
} from 'lucide-react';
import {
  buildWhatsAppUrl,
  buildTelUrl,
  buildSmsUrl,
  validatePhoneNumber,
} from '../utils/assistant-logic';

export const PhoneFeaturesScreen: React.FC = () => {
  // WhatsApp State
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('Hello! Angel AI assistant ke through connect kar raha hoon.');
  const [waStatus, setWaStatus] = useState<string | null>(null);

  // Call State
  const [callPhone, setCallPhone] = useState('');
  const [callStatus, setCallStatus] = useState<string | null>(null);

  // SMS State
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('Angel Assistant Quick Note.');

  // Handle WhatsApp Intent
  const handleOpenWhatsApp = () => {
    if (waPhone && !validatePhoneNumber(waPhone)) {
      setWaStatus('Please enter a valid phone number with country code (e.g. +91 9876543210)');
      return;
    }

    const { appIntent, webFallback } = buildWhatsAppUrl(waPhone, waMessage);

    // Attempt Android deep-link intent, provide link fallback
    try {
      window.location.href = appIntent;
      setWaStatus('Opening WhatsApp via Android Intent...');
    } catch (e) {
      window.open(webFallback, '_blank');
      setWaStatus('Redirecting to WhatsApp...');
    }
  };

  // Handle Calling Intent
  const handleMakeCall = () => {
    if (!callPhone || !validatePhoneNumber(callPhone)) {
      setCallStatus('Please enter a valid phone number');
      return;
    }
    const telUrl = buildTelUrl(callPhone);
    setCallStatus(`Launching Android dialer for ${callPhone}...`);
    window.location.href = telUrl;
  };

  // Handle SMS Intent
  const handleSendSms = () => {
    if (!smsPhone || !validatePhoneNumber(smsPhone)) {
      setWaStatus('Please enter a valid phone number for SMS');
      return;
    }
    const smsUrl = buildSmsUrl(smsPhone, smsMessage);
    window.location.href = smsUrl;
  };

  return (
    <div className="flex flex-col gap-5 pb-24 pt-3 px-4 max-w-md mx-auto animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-violet-400" />
          <span>Phone Features & Android Intents</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Angel interacts with Android apps using standard, permission-safe URI schemes and Intents.
        </p>
      </div>

      {/* WhatsApp Integration Card */}
      <div className="bg-slate-900/70 border border-emerald-500/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">WhatsApp Integration</h2>
            <p className="text-[11px] text-slate-400">
              Send messages via Android <code className="text-emerald-400">whatsapp://</code> intent
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <label className="text-[11px] font-semibold text-slate-300">
            Recipient Phone Number (with Country Code)
          </label>
          <input
            type="tel"
            value={waPhone}
            onChange={(e) => {
              setWaPhone(e.target.value);
              setWaStatus(null);
            }}
            placeholder="+91 98765 43210"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <label className="text-[11px] font-semibold text-slate-300 mt-1">
            Pre-filled Message
          </label>
          <textarea
            rows={2}
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          {waStatus && (
            <div className="text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{waStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={handleOpenWhatsApp}
              aria-label="Open WhatsApp App Intent"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all active:scale-95 shadow-md shadow-emerald-900/30"
            >
              <Share2 className="w-4 h-4" />
              <span>Open in WhatsApp</span>
            </button>

            <button
              onClick={() => {
                const { webFallback } = buildWhatsAppUrl(waPhone, waMessage);
                window.open(webFallback, '_blank');
              }}
              aria-label="Open WhatsApp Web Link"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-white/10 transition-all active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Web Link</span>
            </button>
          </div>
        </div>

        {/* Security & Intent Transparency Notice */}
        <div className="flex items-start gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-white/5 text-[11px] text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-tight">
            <strong>Security Notice:</strong> Android isolates app data. Angel prepares and pre-fills the message in WhatsApp. You confirm and tap Send in WhatsApp. This guarantees your messages are never sent silently without your approval.
          </p>
        </div>
      </div>

      {/* Safe Calling Assistant Card */}
      <div className="bg-slate-900/70 border border-blue-500/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Safe Calling Assistant</h2>
            <p className="text-[11px] text-slate-400">
              Launch phone dialer via Android <code className="text-blue-400">tel:</code> URI
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <label className="text-[11px] font-semibold text-slate-300">
            Enter Phone Number
          </label>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={callPhone}
              onChange={(e) => {
                setCallPhone(e.target.value);
                setCallStatus(null);
              }}
              placeholder="+91 98765 43210"
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleMakeCall}
              aria-label="Dial Call"
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-md shadow-blue-900/30 shrink-0"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call</span>
            </button>
          </div>

          {callStatus && (
            <div className="text-[11px] text-blue-400 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{callStatus}</span>
            </div>
          )}

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 mt-1 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-slate-400 shrink-0">Sample:</span>
            {['112 (Emergency)', '+91 9876543210', '198 (Helpline)'].map((num, i) => (
              <button
                key={i}
                onClick={() => setCallPhone(num.split(' ')[0])}
                className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/5 shrink-0"
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SMS Helper */}
      <div className="bg-slate-900/70 border border-purple-500/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">SMS Helper</h2>
            <p className="text-[11px] text-slate-400">
              Open default Android messaging via <code className="text-purple-400">sms:</code> URI
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <input
            type="tel"
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            placeholder="Recipient number"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <input
            type="text"
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="SMS message text..."
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSendSms}
            aria-label="Open SMS Intent"
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-md shadow-purple-900/30"
          >
            Open in SMS App
          </button>
        </div>
      </div>
    </div>
  );
};
