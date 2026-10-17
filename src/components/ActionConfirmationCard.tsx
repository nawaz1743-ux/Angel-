/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  PhoneCall,
  Share2,
  Bell,
  CheckSquare,
  Clock,
  MapPin,
  MessageSquare,
  ExternalLink,
  Check,
  X,
  UserCheck,
  AlertCircle,
  Users,
} from 'lucide-react';
import { ActionPayload, ContactItem } from '../types/assistant';
import {
  buildTelUrl,
  buildWhatsAppUrl,
  buildSmsUrl,
  buildMapUrl,
  validatePhoneNumber,
  sanitizePhoneNumber,
} from '../utils/assistant-logic';

interface ActionConfirmationCardProps {
  action: ActionPayload;
  onExecute: (updatedAction: ActionPayload) => void;
  onCancel: () => void;
  savedContacts?: ContactItem[];
  onOpenContactsPicker?: () => void;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  action,
  onExecute,
  onCancel,
  savedContacts = [],
  onOpenContactsPicker,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(action.phoneNumber || '');
  const [message, setMessage] = useState(action.message || '');
  const [contactName, setContactName] = useState(action.contactName || '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if native Android Contacts API is supported
  const hasNativeContacts =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window;

  const handlePickNativeContact = async () => {
    if (!hasNativeContacts) {
      if (onOpenContactsPicker) onOpenContactsPicker();
      return;
    }
    try {
      const results = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false });
      if (results && results.length > 0) {
        const item = results[0];
        const name = item.name?.[0] || 'Selected Contact';
        const tel = item.tel?.[0] || '';
        setContactName(name);
        setPhoneNumber(tel);
        setErrorMessage(null);
      }
    } catch (err: any) {
      console.warn('Native contact picker cancelled or error:', err);
    }
  };

  // Handle Call Confirmation
  const handleConfirmCall = () => {
    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      setErrorMessage('Please enter a valid phone number (at least 7 digits)');
      return;
    }

    const telUrl = buildTelUrl(phoneNumber);
    try {
      window.location.href = telUrl;
      const updated: ActionPayload = {
        ...action,
        phoneNumber,
        contactName,
        status: 'executed',
      };
      setStatusMessage(`Launched phone dialer for ${contactName || phoneNumber}`);
      onExecute(updated);
    } catch (err) {
      setErrorMessage('Failed to open phone dialer on device');
    }
  };

  // Handle WhatsApp Confirmation
  const handleConfirmWhatsApp = () => {
    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
      setErrorMessage('Please verify phone number format (with country code)');
      return;
    }

    const { appIntent, webFallback } = buildWhatsAppUrl(phoneNumber, message);
    try {
      window.location.href = appIntent;
      const updated: ActionPayload = {
        ...action,
        phoneNumber,
        contactName,
        message,
        status: 'executed',
      };
      setStatusMessage(`Opened WhatsApp with prepared message for ${contactName || 'recipient'}`);
      onExecute(updated);
    } catch {
      window.open(webFallback, '_blank');
      onExecute({ ...action, status: 'executed' });
    }
  };

  // Handle SMS Confirmation
  const handleConfirmSms = () => {
    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      setErrorMessage('Please enter a valid phone number for SMS');
      return;
    }
    const smsUrl = buildSmsUrl(phoneNumber, message);
    window.location.href = smsUrl;
    onExecute({ ...action, status: 'executed' });
  };

  // Handle Map Directions
  const handleConfirmMap = () => {
    const loc = action.location || 'Nearby';
    const { appIntent, webFallback } = buildMapUrl(loc);
    try {
      window.location.href = appIntent;
    } catch {
      window.open(webFallback, '_blank');
    }
    onExecute({ ...action, status: 'executed' });
  };

  // Handle Disambiguation selection
  const handleSelectContactChoice = (c: ContactItem) => {
    setContactName(c.name);
    setPhoneNumber(c.phone);
    const updated: ActionPayload = {
      ...action,
      contactName: c.name,
      phoneNumber: c.phone,
      status: 'pending_confirmation',
    };
    onExecute(updated);
  };

  if (action.status === 'executed') {
    return (
      <div className="mt-2.5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-medium">
          {action.statusMessage || statusMessage || 'Action confirmed & activated in Angel.'}
        </span>
      </div>
    );
  }

  if (action.status === 'cancelled') {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-400 flex items-center gap-2">
        <X className="w-3.5 h-3.5 text-slate-500" />
        <span>Action was cancelled.</span>
      </div>
    );
  }

  // DISAMBIGUATION: Multiple Contacts Found
  if (action.status === 'disambiguation_needed' && action.matches && action.matches.length > 0) {
    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-violet-500/30 shadow-lg text-left">
        <div className="flex items-center gap-2 text-violet-300 text-xs font-bold mb-2">
          <Users className="w-4 h-4 text-violet-400" />
          <span>Choose Contact:</span>
        </div>
        <p className="text-[11px] text-slate-300 mb-2.5">
          Multiple contacts found for "{action.contactName}". Please select one:
        </p>
        <div className="space-y-1.5">
          {action.matches.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectContactChoice(c)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-xs text-white transition-all text-left group"
            >
              <div>
                <div className="font-semibold text-slate-100 group-hover:text-violet-300">
                  {c.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  {c.relation ? `${c.relation} • ` : ''}
                  {c.phone}
                </div>
              </div>
              <PhoneCall className="w-3.5 h-3.5 text-violet-400 opacity-80 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 1. CALL CONFIRMATION CARD
  if (action.type === 'call') {
    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-violet-500/30 shadow-xl text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-violet-300 text-xs font-bold">
            <PhoneCall className="w-4 h-4 text-violet-400" />
            <span>Confirm Phone Call</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold">
            tel: intent
          </span>
        </div>

        <div className="space-y-2 mt-2">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
              Contact Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact Name"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] font-semibold text-slate-400 block">
                Phone Number
              </label>
              <button
                type="button"
                onClick={handlePickNativeContact}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <UserCheck className="w-3 h-3" />
                <span>{hasNativeContacts ? 'Pick from Android' : 'Choose Contact'}</span>
              </button>
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="mt-2 text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3.5">
          <button
            type="button"
            onClick={handleConfirmCall}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Launch Phone Dialer</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // 2. WHATSAPP CONFIRMATION CARD
  if (action.type === 'whatsapp') {
    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Review WhatsApp Message</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
            whatsapp:// intent
          </span>
        </div>

        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                Recipient Name
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Recipient Name"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-semibold text-slate-400 block">
                  Phone (Optional)
                </label>
                <button
                  type="button"
                  onClick={handlePickNativeContact}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300"
                >
                  Pick
                </button>
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="+91 98765 43210"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
              Drafted Message
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type WhatsApp message..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="mt-2 text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3.5">
          <button
            type="button"
            onClick={handleConfirmWhatsApp}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Open in WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // 3. REMINDER CONFIRMATION CARD
  if (action.type === 'reminder') {
    const isDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied';

    const handleConfirmReminder = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      const updated: ActionPayload = {
        ...action,
        status: 'executed',
        statusMessage: `Reminder active for ${action.time || 'scheduled time'} in Angel (in-app audio chime & alert popup).`,
      };
      onExecute(updated);
    };

    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-xl text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Confirm Reminder / Alarm</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
            {action.time || '18:00'}
          </span>
        </div>

        <p className="text-xs text-white font-medium mt-1">
          {action.title || 'Important Reminder'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Scheduled for {action.date || 'today'} at {action.time}. Angel will alert you with in-app audio chime and popup.
        </p>

        {isDenied && (
          <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
            <span>System notifications blocked in browser settings. Angel will still play the audio chime and popup alert while this tab is open.</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleConfirmReminder}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Activate Reminder</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // 4. TASK CONFIRMATION CARD
  if (action.type === 'task') {
    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-violet-500/30 shadow-xl text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-violet-300 text-xs font-bold">
            <CheckSquare className="w-4 h-4 text-violet-400" />
            <span>Add Task to To-Do List</span>
          </div>
        </div>
        <p className="text-xs text-white font-medium mt-1">{action.title}</p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => onExecute({ ...action, status: 'executed' })}
            className="flex-1 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save to Tasks</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // 5. MAP / NAVIGATION CARD
  if (action.type === 'map') {
    return (
      <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-xl text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>Google Maps Navigation</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
            geo: intent
          </span>
        </div>
        <p className="text-xs text-white font-medium mt-1">{action.location || 'Location'}</p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleConfirmMap}
            className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Maps</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
};
