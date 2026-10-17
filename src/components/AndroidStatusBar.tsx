/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, BatteryMedium, Sparkles } from 'lucide-react';

import { AssistantLanguage } from '../types/assistant';

interface AndroidStatusBarProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  language?: AssistantLanguage;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = ({ isListening, isSpeaking, language = 'hinglish' }) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const getStatusText = () => {
    if (language === 'english') {
      return isListening ? 'Angel is listening...' : 'Angel is speaking...';
    }
    return isListening ? 'Angel sun rahi hai...' : 'Angel bol rahi hai...';
  };

  return (
    <div className="w-full px-5 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 bg-slate-950/80 backdrop-blur-md select-none border-b border-white/5 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <span className="tracking-tight text-slate-200">{timeStr || '12:00'}</span>
        {(isListening || isSpeaking) && (
          <div className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 animate-pulse">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span>{getStatusText()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          5G
        </span>
        <Wifi className="w-3.5 h-3.5 text-slate-300" />
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-300">92%</span>
          <BatteryMedium className="w-4 h-4 text-emerald-400" />
        </div>
      </div>
    </div>
  );
};
