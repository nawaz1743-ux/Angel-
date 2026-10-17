/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  MessageSquare,
  Mic,
  PhoneCall,
  Share2,
  Smartphone,
  CheckSquare,
  Settings,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ActiveTab } from '../types/assistant';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onStartVoiceAssistant: () => void;
  onOpenContacts?: () => void;
  isListening?: boolean;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onStartVoiceAssistant,
  onOpenContacts,
  isListening,
}) => {
  if (!isOpen) return null;

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  const menuItems = [
    {
      id: 'chat',
      label: 'Chat',
      sublabel: 'Chat',
      description: 'Talk to Angel in Hinglish or English',
      icon: MessageSquare,
      iconColor: 'text-violet-400 bg-violet-500/15 border-violet-500/30',
      action: () => onNavigate('chat'),
    },
    {
      id: 'voice',
      label: 'Voice Assistant',
      sublabel: 'Voice',
      description: isListening ? 'Listening now...' : 'Live voice speech & female response',
      icon: Mic,
      iconColor: isListening
        ? 'text-rose-400 bg-rose-500/20 border-rose-500/40 animate-pulse'
        : 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/30',
      action: () => onStartVoiceAssistant(),
    },
    {
      id: 'calling',
      label: 'Calling',
      sublabel: 'Dialer',
      description: 'Safe phone dialer with tel: intent',
      icon: PhoneCall,
      iconColor: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
      action: () => onNavigate('phone'),
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Assistant',
      sublabel: 'WhatsApp',
      description: 'Prepare WhatsApp messages & direct intent',
      icon: Share2,
      iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      action: () => onNavigate('phone'),
    },
    {
      id: 'phone_assistant',
      label: 'Phone Assistant',
      sublabel: 'Tools',
      description: 'Android system tools & screen assistance',
      icon: Smartphone,
      iconColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
      action: () => onNavigate('screen'),
    },
    {
      id: 'tasks',
      label: 'Tasks and Reminders',
      sublabel: 'Tasks',
      description: 'Manage to-dos, notes & daily schedule',
      icon: CheckSquare,
      iconColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
      action: () => onNavigate('tasks'),
    },
    {
      id: 'contacts',
      label: 'Contacts Book',
      sublabel: 'Contacts',
      description: 'Manage contacts & Android phone dialer',
      icon: Users,
      iconColor: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
      action: () => {
        if (onOpenContacts) onOpenContacts();
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      sublabel: 'Settings',
      description: 'Language (Hinglish/English) & settings',
      icon: Settings,
      iconColor: 'text-slate-300 bg-slate-800 border-white/10',
      action: () => onNavigate('settings'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex animate-fadeIn" role="dialog" aria-modal="true" aria-label="Main Navigation Menu">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
      />

      {/* Slide-in Drawer Container */}
      <aside className="relative w-4/5 max-w-xs h-full bg-slate-900/95 border-r border-violet-500/20 shadow-2xl flex flex-col z-10 overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-950/40 to-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-white tracking-tight">Angel</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                  AI Assistant
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Virtual AI Assistant</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Menu"
            className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-white/10 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Navigation List */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.action)}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 active:bg-violet-600/15 border border-transparent hover:border-violet-500/20 text-left transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105 group-active:scale-95 ${item.iconColor}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white tracking-tight group-hover:text-violet-200">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </button>
            );
          })}
        </div>

        {/* Drawer Footer with Security Badge */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center gap-2.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Safe Android Intents & Private Storage</span>
        </div>
      </aside>
    </div>
  );
};
