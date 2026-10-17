/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Volume2, Upload, Link as LinkIcon, X, Check, Camera } from 'lucide-react';

interface FemaleAngelAvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const FemaleAngelAvatar: React.FC<FemaleAngelAvatarProps> = ({
  isListening,
  isSpeaking,
  onClick,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('angel_ai_avatar') || null;
    } catch {
      return null;
    }
  });
  const [hasImgError, setHasImgError] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if /angel_avatar.png exists on server if no user avatar set
  useEffect(() => {
    if (!avatarUrl) {
      const img = new Image();
      img.src = '/angel_avatar.png';
      img.onload = () => {
        setAvatarUrl('/angel_avatar.png');
        setHasImgError(false);
      };
      img.onerror = () => {
        // No custom file found, default to full-body high-fidelity vector assistant
      };
    }
  }, [avatarUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);
      setHasImgError(false);
      setShowConfigModal(false);
      try {
        localStorage.setItem('angel_ai_avatar', base64);
      } catch (err) {
        console.warn('Could not cache avatar in localStorage:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setAvatarUrl(urlInput.trim());
    setHasImgError(false);
    setShowConfigModal(false);
    try {
      localStorage.setItem('angel_ai_avatar', urlInput.trim());
    } catch (err) {
      console.warn('Could not cache avatar in localStorage:', err);
    }
  };

  const handleResetToDefault = () => {
    setAvatarUrl(null);
    setHasImgError(false);
    setShowConfigModal(false);
    try {
      localStorage.removeItem('angel_ai_avatar');
    } catch (err) {
      console.warn('Could not remove avatar from localStorage:', err);
    }
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Angel AI Full-Body Avatar"
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group focus:outline-none max-h-[52vh] sm:max-h-[58vh]"
    >
      {/* Hidden File Input for uploading custom AI-generated full-body photo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Subtle Purple & Blue Ambient Studio Backlight Accents */}
      <div
        className={`absolute rounded-full transition-all duration-700 pointer-events-none ${
          isListening
            ? 'w-72 h-80 bg-rose-500/20 blur-3xl animate-ping'
            : isSpeaking
            ? 'w-80 h-96 bg-violet-600/25 blur-3xl animate-pulse'
            : 'w-64 h-80 bg-gradient-to-t from-cyan-500/15 via-violet-600/20 to-indigo-500/15 blur-2xl'
        }`}
      />

      {/* Futuristic Holographic Pedestal / Ground Glow below her feet */}
      <div className="absolute bottom-0 w-48 sm:w-56 h-6 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent rounded-full blur-md pointer-events-none" />
      <div className="absolute bottom-1 w-36 sm:w-44 h-2 bg-gradient-to-r from-transparent via-violet-400/45 to-transparent rounded-full blur-sm pointer-events-none" />

      {/* Full-Body Avatar Presentation Container */}
      <div className="relative z-10 flex flex-col items-center h-full max-h-[50vh] sm:max-h-[54vh]">
        <div
          className={`relative h-full flex flex-col items-center justify-center rounded-3xl p-1 transition-all duration-300 ${
            isListening
              ? 'ring-2 ring-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.35)]'
              : isSpeaking
              ? 'ring-2 ring-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.35)]'
              : 'hover:ring-1 hover:ring-cyan-400/30 shadow-[0_0_25px_rgba(99,102,241,0.2)]'
          }`}
        >
          {avatarUrl && !hasImgError ? (
            /* Photorealistic Full-Body Standing Photograph (Head to Toe) */
            <div className="relative h-full flex flex-col items-center">
              <img
                src={avatarUrl}
                alt="Angel - Full-Body Photorealistic Indian AI Assistant"
                onError={() => setHasImgError(true)}
                className="h-full max-h-[48vh] sm:max-h-[52vh] w-auto object-contain rounded-2xl drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] filter contrast-[1.02] brightness-[1.01]"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfigModal(true);
                }}
                className="absolute bottom-2 left-2 p-1.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-white/10 text-slate-300 hover:text-white text-[10px] flex items-center gap-1 shadow-md active:scale-95 transition-all"
                title="Change Avatar Photo"
              >
                <Camera className="w-3 h-3 text-cyan-400" />
                <span>Avatar Options</span>
              </button>
            </div>
          ) : (
            /* High-Fidelity Full-Body Indian Female AI Assistant Standing (Head to Toe) */
            <div className="h-full max-h-[48vh] sm:max-h-[52vh] aspect-[9/16] rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-900/90 border border-violet-500/30 flex flex-col items-center justify-between p-3 relative overflow-hidden backdrop-blur-md">
              {/* Holographic vertical light scan beam */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-pulse pointer-events-none" />

              {/* Full-Body Standing Indian Woman Graphic (Head to Toe with blazer, blouse, formal trousers & shoes) */}
              <div className="my-auto relative flex flex-col items-center justify-center">
                <svg
                  viewBox="0 0 140 320"
                  className="h-64 sm:h-72 w-auto drop-shadow-[0_8px_20px_rgba(139,92,246,0.45)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    {/* Skin Tone Gradient: Warm fair Indian complexion */}
                    <linearGradient id="skinTone" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffdfcb" />
                      <stop offset="50%" stopColor="#f7cdb0" />
                      <stop offset="100%" stopColor="#eab592" />
                    </linearGradient>

                    {/* Dark Professional Hair Gradient */}
                    <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#1e1822" />
                      <stop offset="70%" stopColor="#141118" />
                      <stop offset="100%" stopColor="#2d2238" />
                    </linearGradient>

                    {/* Corporate Tailored Blazer: Midnight Blue with Purple Sheen */}
                    <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e1b4b" />
                      <stop offset="45%" stopColor="#2e1065" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>

                    {/* Blouse: Clean Silk White with subtle violet tint */}
                    <linearGradient id="blouseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#e2e8f0" />
                    </linearGradient>

                    {/* Formal Trousers Gradient: Deep Slate Charcoal */}
                    <linearGradient id="trouserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#1e293b" />
                      <stop offset="50%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#090d16" />
                    </linearGradient>

                    {/* Shoes Gradient */}
                    <linearGradient id="shoeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#1e1b4b" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>

                    {/* Futuristic Rim Light Gradient */}
                    <linearGradient id="cyberRim" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>

                  {/* Holographic AI Halo around head */}
                  <circle cx="70" cy="38" r="24" stroke="url(#cyberRim)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />

                  {/* 1. Hair Background (Long dark hair falling behind shoulders) */}
                  <path
                    d="M52 32 C50 16, 90 16, 88 32 C91 46, 93 64, 88 78 C80 82, 60 82, 52 78 C47 64, 49 46, 52 32 Z"
                    fill="url(#hairGrad)"
                  />

                  {/* 2. Neck */}
                  <path d="M64 54 L64 68 C64 71, 76 71, 76 68 L76 54 Z" fill="url(#skinTone)" />

                  {/* 3. Face (Oval jawline, gentle cheekbones) */}
                  <path
                    d="M57 32 C56 22, 84 22, 83 32 C83 45, 80 57, 70 59 C60 57, 57 45, 57 32 Z"
                    fill="url(#skinTone)"
                  />

                  {/* 4. Front Styled Hair (Side parted, sleek waves) */}
                  <path
                    d="M56 28 C62 18, 78 18, 84 28 C80 25, 74 24, 68 25 C61 26, 58 27, 56 28 Z"
                    fill="url(#hairGrad)"
                  />
                  <path
                    d="M56 28 C55 36, 58 44, 59 48 C58 42, 57 36, 58 30 Z"
                    fill="#141118"
                  />
                  <path
                    d="M84 28 C85 36, 82 44, 81 48 C82 42, 83 36, 82 30 Z"
                    fill="#141118"
                  />

                  {/* 5. Natural Indian Facial Features */}
                  {/* Eyebrows */}
                  <path d="M60 32 Q64 30 67 32" stroke="#261b2c" strokeWidth="1" strokeLinecap="round" />
                  <path d="M73 32 Q76 30 80 32" stroke="#261b2c" strokeWidth="1" strokeLinecap="round" />
                  {/* Expressive dark eyes */}
                  <ellipse cx="63.5" cy="35.5" rx="2" ry="1.2" fill="#2d1f18" />
                  <ellipse cx="76.5" cy="35.5" rx="2" ry="1.2" fill="#2d1f18" />
                  <circle cx="63.2" cy="35.2" r="0.5" fill="#ffffff" />
                  <circle cx="76.2" cy="35.2" r="0.5" fill="#ffffff" />
                  {/* Subtle bindi dot */}
                  <circle cx="70" cy="31" r="0.75" fill="#dc2626" opacity="0.85" />
                  {/* Delicate nose */}
                  <path d="M70 34 L69.5 41 L71 41.5" stroke="#d59a72" strokeWidth="0.8" strokeLinecap="round" />
                  {/* Warm, genuine smile */}
                  <path d="M65 47 Q70 51 75 47" stroke="#b91c1c" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M66.5 47 Q70 48.5 73.5 47" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />

                  {/* Subtle earrings */}
                  <circle cx="56.5" cy="40" r="1.2" fill="#fbbf24" />
                  <circle cx="83.5" cy="40" r="1.2" fill="#fbbf24" />

                  {/* 6. Silk White Blouse & V-Neck Underneath */}
                  <path
                    d="M63 68 L70 94 L77 68 Z"
                    fill="url(#blouseGrad)"
                  />
                  {/* Subtle pendant necklace */}
                  <path d="M65 68 Q70 78 75 68" stroke="#38bdf8" strokeWidth="0.6" fill="none" opacity="0.8" />
                  <polygon points="70,78 68.8,80.5 71.2,80.5" fill="#38bdf8" />

                  {/* 7. Corporate Tailored Blazer (Jacket) */}
                  {/* Torso & Shoulders */}
                  <path
                    d="M45 74 C52 70, 88 70, 95 74 L91 146 C80 150, 60 150, 49 146 Z"
                    fill="url(#blazerGrad)"
                    stroke="url(#cyberRim)"
                    strokeWidth="0.5"
                  />
                  {/* Blazer Lapels */}
                  <path d="M57 74 L66 112 L61 112 L49 84 Z" fill="#2d1b4e" opacity="0.9" />
                  <path d="M83 74 L74 112 L79 112 L91 84 Z" fill="#2d1b4e" opacity="0.9" />
                  {/* Single button closure */}
                  <circle cx="70" cy="116" r="1.5" fill="#38bdf8" opacity="0.9" />

                  {/* 8. Arms & Hands Standing Naturally at sides */}
                  {/* Left Arm */}
                  <path
                    d="M45 74 L37 122 L40 148"
                    stroke="url(#blazerGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Left Hand */}
                  <path d="M39 148 L41 160 C41 162, 44 162, 44 160 L44 148 Z" fill="url(#skinTone)" />

                  {/* Right Arm */}
                  <path
                    d="M95 74 L103 122 L100 148"
                    stroke="url(#blazerGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Right Hand */}
                  <path d="M97 148 L96 160 C96 162, 99 162, 101 160 L101 148 Z" fill="url(#skinTone)" />

                  {/* 9. Tailored Trousers / Legs (Head to Toe) */}
                  {/* Waistband */}
                  <rect x="52" y="144" width="36" height="6" rx="2" fill="#0f172a" />
                  {/* Slim buckle */}
                  <rect x="68" y="145.5" width="4" height="3" rx="0.5" fill="#94a3b8" />

                  {/* Left Leg */}
                  <path
                    d="M53 150 L57 274 L67 274 L69 152 Z"
                    fill="url(#trouserGrad)"
                  />
                  {/* Trouser center crease line */}
                  <line x1="62" y1="156" x2="62" y2="272" stroke="#334155" strokeWidth="0.6" opacity="0.7" />

                  {/* Right Leg */}
                  <path
                    d="M71 152 L73 274 L83 274 L87 150 Z"
                    fill="url(#trouserGrad)"
                  />
                  {/* Trouser center crease line */}
                  <line x1="78" y1="156" x2="78" y2="272" stroke="#334155" strokeWidth="0.6" opacity="0.7" />

                  {/* 10. Both Feet / Professional Shoes on the Floor */}
                  {/* Left Shoe */}
                  <path
                    d="M56 274 L55 284 C55 287, 68 287, 68 284 L68 274 Z"
                    fill="url(#shoeGrad)"
                  />
                  {/* Right Shoe */}
                  <path
                    d="M72 274 L72 284 C72 287, 85 287, 85 284 L84 274 Z"
                    fill="url(#shoeGrad)"
                  />

                  {/* Ground Shadow & Floor Reflection */}
                  <ellipse cx="70" cy="292" rx="36" ry="5" fill="#06b6d4" opacity="0.3" />
                  <ellipse cx="70" cy="292" rx="22" ry="2.5" fill="#a855f7" opacity="0.4" />
                </svg>
              </div>

              {/* Set / Upload Photo Button for Phone Users */}
              <div className="w-full flex justify-center pb-1 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfigModal(true);
                  }}
                  className="w-full max-w-[210px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600/50 to-cyan-600/40 hover:from-violet-600/70 hover:to-cyan-600/60 border border-violet-400/40 text-white text-xs font-semibold active:scale-95 transition-all shadow-lg backdrop-blur-md"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Set AI Photo Asset</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Voice Wave & Status Pill attached to Avatar */}
          <div className="absolute top-3 right-3 z-20">
            {isListening ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/95 text-white shadow-lg shadow-rose-500/50 backdrop-blur-md animate-pulse">
                <Mic className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold tracking-wider uppercase">Listening</span>
              </div>
            ) : isSpeaking ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-600/95 text-white shadow-lg shadow-violet-600/50 backdrop-blur-md animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold tracking-wider uppercase">Speaking</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-white/10 text-slate-300 shadow-md backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-slate-200">Angel AI</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Options Modal */}
      {showConfigModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                Angel Female Avatar
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Angel uses a full-body female Indian AI assistant avatar. You can select an image file from your device, enter an image URL, or place <code className="text-cyan-300 font-mono text-[11px]">public/angel_avatar.png</code> in the project.
            </p>

            <div className="mt-4 space-y-3">
              {/* Option 1: Upload from Phone / Device */}
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold active:scale-95 transition-all shadow-md"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Photo from Device</span>
              </button>

              {/* Option 2: Image Web URL */}
              <form onSubmit={handleUrlSubmit} className="space-y-2">
                <label className="text-[11px] font-medium text-slate-400 block">Or paste full-body image URL:</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/angel_avatar.png"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </form>

              {/* Option 3: Reset to Default Built-in Avatar */}
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                >
                  Reset to Built-in Full-Body Avatar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
