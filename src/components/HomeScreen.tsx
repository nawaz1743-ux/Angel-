/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Mic,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { FemaleAngelAvatar } from './FemaleAngelAvatar';
import { HamburgerMenu } from './HamburgerMenu';
import { ActiveTab, UserSettings } from '../types/assistant';

interface HomeScreenProps {
  onNavigate: (tab: ActiveTab) => void;
  isListening: boolean;
  isSpeaking: boolean;
  isHandsFreeActive?: boolean;
  isAwaitingHandsFreeCommand?: boolean;
  onStartHandsFree?: () => void;
  onStopHandsFree?: () => void;
  onMicClick: () => void;
  onSendMessage: (text: string) => void;
  settings: UserSettings;
  transcript?: string;
  speechError?: string | null;
  onOpenContacts?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  isListening,
  isSpeaking,
  isHandsFreeActive = false,
  isAwaitingHandsFreeCommand = false,
  onStartHandsFree,
  onStopHandsFree,
  onMicClick,
  onSendMessage,
  settings,
  transcript = '',
  speechError = null,
  onOpenContacts,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync speech transcript into input field when speaking
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleAvatarClick = () => {
    if (isSpeaking) {
      onMicClick();
    } else if (isHandsFreeActive && onStopHandsFree) {
      onStopHandsFree();
    } else if (onStartHandsFree) {
      onStartHandsFree();
    } else {
      onMicClick();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden select-none">
      {/* Background Ambient Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Speech Error Banner */}
      {speechError && (
        <div className="z-30 px-4 py-2 bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <span className="truncate">{speechError}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-5 pt-3 pb-2 z-20">
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open Navigation Menu"
          className="w-12 h-12 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center border border-white/10 active:scale-95 transition-all shadow-md backdrop-blur-md"
        >
          <Menu className="w-6 h-6 text-violet-300" />
        </button>

        {/* Hands-Free Mode Toggle Button / Badge */}
        {isHandsFreeActive ? (
          <button
            onClick={onStopHandsFree}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse shadow-md hover:bg-emerald-900/80"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hands-Free Active (Stop)</span>
          </button>
        ) : (
          <button
            onClick={onStartHandsFree}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-violet-500/30 text-violet-300 text-xs font-semibold shadow-md"
          >
            <Mic className="w-3.5 h-3.5 text-violet-400" />
            <span>Enable Hands-Free ("Angel")</span>
          </button>
        )}

        {/* Brand / Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/10 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide">
            {settings.language === 'english' ? 'English' : 'Hinglish'}
          </span>
        </div>
      </header>

      {/* Hamburger Navigation Drawer Modal */}
      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={onNavigate}
        onStartVoiceAssistant={() => {
          setIsMenuOpen(false);
          if (onStartHandsFree) onStartHandsFree();
          else if (!isListening) onMicClick();
        }}
        onOpenContacts={() => {
          setIsMenuOpen(false);
          if (onOpenContacts) onOpenContacts();
        }}
        isListening={isListening}
      />

      {/* Main Center Area: Female AI Avatar as Primary Focus */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 z-10 min-h-0">
        {/* Female AI Virtual Assistant Avatar */}
        <div className="my-auto flex flex-col items-center">
          <FemaleAngelAvatar
            isListening={isListening}
            isSpeaking={isSpeaking}
            onClick={handleAvatarClick}
            size="lg"
          />

          {/* Assistant Name & Identity */}
          <div className="mt-5 text-center">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
                Angel
              </h1>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                AI Assistant
              </span>
            </div>

            {/* Availability Status Indicator */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isHandsFreeActive
                    ? isAwaitingHandsFreeCommand
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-emerald-400 animate-pulse'
                    : isListening
                    ? 'bg-rose-400 animate-ping'
                    : isSpeaking
                    ? 'bg-violet-400 animate-pulse'
                    : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="text-xs font-medium text-slate-300 tracking-wide">
                {isHandsFreeActive
                  ? isAwaitingHandsFreeCommand
                    ? (settings.language === 'english' ? 'Listening for your request...' : 'Aapki request sun rahi hoon...')
                    : (settings.language === 'english' ? 'Hands-Free Mode: Say "Angel"' : 'Hands-Free Mode: Boliye "Angel"')
                  : isListening
                  ? (settings.language === 'english' ? 'Listening...' : 'Sun rahi hoon...')
                  : isSpeaking
                  ? (settings.language === 'english' ? 'Angel is speaking...' : 'Angel bol rahi hai...')
                  : (settings.language === 'english' ? 'Online & Ready' : 'Online & Ready (Taiyar hoon)')}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              {isHandsFreeActive
                ? (settings.language === 'english' ? 'Speak "Angel" to activate hands-free, or speak your request directly.' : 'Hands-free mode on hai. "Angel" boliye ya seedha request boliye.')
                : isListening
                ? (settings.language === 'english' ? 'Speak now in English' : 'Speak now in Hinglish or English')
                : (settings.language === 'english' ? 'Your personal AI assistant. Tap avatar, enable hands-free, or type below.' : 'Aapki personal AI assistant. Tap avatar, enable hands-free, ya type karein.')}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Area: Touch-Friendly Message Input & Mic Button */}
      <div className="p-4 sm:p-5 z-20 pb-6">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-slate-900/90 border border-violet-500/30 focus-within:border-violet-400 rounded-full p-1.5 shadow-2xl backdrop-blur-xl transition-all"
        >
          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={() => {
              if (isHandsFreeActive && onStopHandsFree) {
                onStopHandsFree();
              } else {
                onMicClick();
              }
            }}
            aria-label={isListening ? 'Stop Listening' : 'Voice Input'}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${
              isListening || isHandsFreeActive
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                : 'bg-slate-800 text-violet-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Message Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : (settings.language === 'english' ? 'Ask Angel anything...' : 'Ask Angel anything / Kuch bhi poochiye...')
            }
            className="flex-1 bg-transparent px-2.5 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none min-w-0"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            aria-label="Send Message to Angel"
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${
              inputText.trim()
                ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-600/30'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
