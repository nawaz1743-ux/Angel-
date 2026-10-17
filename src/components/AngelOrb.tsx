/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Mic, Volume2 } from 'lucide-react';

interface AngelOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const AngelOrb: React.FC<AngelOrbProps> = ({
  isListening,
  isSpeaking,
  onClick,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-28 h-28',
    lg: 'w-36 h-36',
  }[size];

  return (
    <div className="relative flex items-center justify-center cursor-pointer select-none" onClick={onClick}>
      {/* Outer Glow Wave */}
      <div
        className={`absolute rounded-full transition-all duration-700 ${
          isListening
            ? 'w-44 h-44 bg-rose-500/25 blur-2xl animate-ping'
            : isSpeaking
            ? 'w-44 h-44 bg-violet-500/25 blur-2xl animate-pulse'
            : 'w-36 h-36 bg-indigo-500/15 blur-xl'
        }`}
      />

      {/* Middle Rotating Halo */}
      <div
        className={`absolute rounded-full border border-white/10 transition-all duration-500 ${
          isListening
            ? 'w-36 h-36 border-rose-400/40 animate-spin'
            : isSpeaking
            ? 'w-36 h-36 border-violet-400/40 animate-pulse'
            : 'w-32 h-32 border-indigo-400/20'
        }`}
        style={{ animationDuration: '6s' }}
      />

      {/* Core Orb */}
      <div
        className={`${sizeClasses} relative rounded-full shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-300 transform active:scale-95 ${
          isListening
            ? 'bg-gradient-to-tr from-rose-600 via-pink-500 to-amber-400 scale-105 shadow-rose-500/50'
            : isSpeaking
            ? 'bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-400 scale-105 shadow-violet-500/50'
            : 'bg-gradient-to-tr from-violet-700 via-purple-600 to-indigo-600 shadow-purple-900/40 hover:scale-102'
        }`}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-radial from-white/30 via-transparent to-black/20" />

        {/* Center Icon */}
        <div className="relative z-10 text-white flex flex-col items-center justify-center">
          {isListening ? (
            <div className="flex flex-col items-center">
              <Mic className="w-8 h-8 animate-bounce text-white drop-shadow-md" />
              <span className="text-[10px] font-bold uppercase tracking-widest mt-1 text-white/90">
                Listening
              </span>
            </div>
          ) : isSpeaking ? (
            <div className="flex flex-col items-center">
              <Volume2 className="w-8 h-8 animate-pulse text-white drop-shadow-md" />
              <span className="text-[10px] font-bold uppercase tracking-widest mt-1 text-white/90">
                Speaking
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Sparkles className="w-7 h-7 text-amber-200 drop-shadow-md" />
              <span className="text-[11px] font-bold tracking-wide mt-1 text-white/95">
                Angel
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
