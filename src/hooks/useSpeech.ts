/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantLanguage } from '../types/assistant';
import { cleanTextForSpeech, splitTextIntoSpeechChunks, isWakeWord, stripWakeWord, hasWakeWordPrefix } from '../utils/assistant-logic';

interface SpeechHookOptions {
  language: AssistantLanguage;
  spokenResponses: boolean;
  speechRate: number;
  onTranscriptReceived?: (transcript: string) => void;
  onWakeWordDetected?: () => void;
}

interface ActiveSpeechSession {
  id: number;
  fullText: string;
  chunks: string[];
  currentIndex: number;
  isPaused: boolean;
  cancelled: boolean;
  chosenVoice: SpeechSynthesisVoice | null;
}

export type SpeechState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export function useSpeech({
  language,
  spokenResponses,
  speechRate,
  onTranscriptReceived,
  onWakeWordDetected,
}: SpeechHookOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHandsFreeActive, setIsHandsFreeActive] = useState(false);
  const [isAwaitingHandsFreeCommand, setIsAwaitingHandsFreeCommand] = useState(false);
  const [currentSpeakingText, setCurrentSpeakingText] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscriptReceived);
  onTranscriptRef.current = onTranscriptReceived;
  const onWakeWordRef = useRef(onWakeWordDetected);
  onWakeWordRef.current = onWakeWordDetected;

  const isHandsFreeActiveRef = useRef(isHandsFreeActive);
  isHandsFreeActiveRef.current = isHandsFreeActive;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  const isAwaitingHandsFreeCommandRef = useRef(isAwaitingHandsFreeCommand);
  isAwaitingHandsFreeCommandRef.current = isAwaitingHandsFreeCommand;

  const restartTimerRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setSpeechError(null);
    setTranscript('');
    if (!recognitionRef.current) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }
    }
    try {
      recognitionRef.current?.start();
    } catch (err: any) {
      console.warn('Error starting speech recognition:', err);
      if (err.name === 'InvalidStateError' || err.message?.includes('already started')) {
        setIsListening(true);
      } else {
        try {
          recognitionRef.current?.stop();
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch {
              setSpeechError('Could not start microphone. Please check browser permissions.');
            }
          }, 150);
        } catch {
          setSpeechError('Could not start microphone');
        }
      }
    }
  }, []);

  const notifyProcessingStarted = useCallback(() => {
    setIsProcessing(true);
    isProcessingRef.current = true;
    stopListening();
  }, [stopListening]);

  const notifyProcessingFinished = useCallback(() => {
    setIsProcessing(false);
    isProcessingRef.current = false;
    if (isHandsFreeActiveRef.current && !isSpeakingRef.current) {
      setIsAwaitingHandsFreeCommand(true);
      isAwaitingHandsFreeCommandRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (isHandsFreeActiveRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          startListening();
        }
      }, 350);
    }
  }, [startListening]);

  const startHandsFree = useCallback(() => {
    setSpeechError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition && !recognitionRef.current) {
      setSpeechError('Speech recognition is not supported in this browser environment. Please use Chrome/Edge or type messages.');
      return;
    }
    setIsHandsFreeActive(true);
    isHandsFreeActiveRef.current = true;
    setIsAwaitingHandsFreeCommand(true);
    isAwaitingHandsFreeCommandRef.current = true;
    setIsProcessing(false);
    isProcessingRef.current = false;
    startListening();
  }, [startListening]);

  const stopHandsFree = useCallback(() => {
    setIsHandsFreeActive(false);
    isHandsFreeActiveRef.current = false;
    setIsAwaitingHandsFreeCommand(false);
    isAwaitingHandsFreeCommandRef.current = false;
    setIsProcessing(false);
    isProcessingRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    stopListening();
  }, [stopListening]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Select BCP 47 language tag: Hinglish (en-IN handles Indian accent and Hinglish best), English (en-US)
      if (language === 'english') {
        recognition.lang = 'en-US';
      } else {
        recognition.lang = 'en-IN';
      }

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        // Crucial safeguard: Ignore mic input while Angel is processing or TTS is actively speaking
        if (isSpeakingRef.current || isProcessingRef.current) {
          return;
        }

        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        if (event.results[0] && event.results[0].isFinal) {
          const cleanText = currentTranscript.trim();
          if (!cleanText) return;

          if (isHandsFreeActiveRef.current) {
            // A. Check for standalone wake word ("Angel", "Hey Angel", "Ok Angel")
            if (isWakeWord(cleanText)) {
              console.log('[Angel Hands-Free] Standalone wake word detected:', cleanText);
              setTranscript('');
              setIsAwaitingHandsFreeCommand(true);
              isAwaitingHandsFreeCommandRef.current = true;

              if (onWakeWordRef.current) {
                onWakeWordRef.current();
              }
              return;
            }

            // B. In Hands-Free mode, process any spoken request (with or without leading wake word)
            const command = stripWakeWord(cleanText) || cleanText;

            if (!command.trim()) {
              console.log('[Angel Hands-Free] Empty command after stripping wake word.');
              return;
            }

            console.log('[Angel Hands-Free] Processing command received:', command);
            stopListening();
            setIsProcessing(true);
            isProcessingRef.current = true;
            setIsAwaitingHandsFreeCommand(true);
            isAwaitingHandsFreeCommandRef.current = true;
            setTranscript('');

            if (onTranscriptRef.current) {
              onTranscriptRef.current(command);
            }
            return;
          } else {
            // Standard manual microphone mode
            stopListening();
            setIsProcessing(true);
            isProcessingRef.current = true;
            if (onTranscriptRef.current) {
              onTranscriptRef.current(cleanText);
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission denied. Please enable microphone access in your browser settings.');
          stopHandsFree();
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Mic: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);

        // Auto-restart loop when hands-free mode is active and Angel is neither speaking nor processing
        if (isHandsFreeActiveRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (isHandsFreeActiveRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
              try {
                recognitionRef.current?.start();
              } catch {
                // ignore
              }
            }
          }, 350);
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Failed to initialize speech recognition:', err);
      setIsSupported(false);
    }

    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [language, stopHandsFree]);

  // Speech Session state tracking
  const sessionRef = useRef<ActiveSpeechSession | null>(null);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const chunkTimerRef = useRef<any>(null);
  const watchdogTimerRef = useRef<any>(null);

  const clearTimers = useCallback(() => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const finishSpeech = useCallback(() => {
    clearTimers();
    sessionRef.current = null;
    activeUtterancesRef.current = [];
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsPaused(false);
    setCurrentSpeakingText(null);

    // Auto-resume continuous listening if Hands-Free mode is active
    if (isHandsFreeActiveRef.current) {
      setIsAwaitingHandsFreeCommand(true);
      isAwaitingHandsFreeCommandRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (isHandsFreeActiveRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          startListening();
        }
      }, 350);
    }
  }, [clearTimers, startListening]);

  const cancelSpeech = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancelled = true;
    }
    clearTimers();
    activeUtterancesRef.current = [];
    sessionRef.current = null;
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setIsPaused(false);
    setCurrentSpeakingText(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [clearTimers]);

  // Pause speech without losing position
  const pauseSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const session = sessionRef.current;
    if (session && !session.cancelled && !session.isPaused) {
      session.isPaused = true;
      setIsPaused(true);
      clearTimers();
      try {
        window.speechSynthesis.pause();
      } catch (e) {
        console.warn('speechSynthesis.pause() error:', e);
      }
    }
  }, [clearTimers]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clearTimers]);

  // Play a specific chunk index sequentially
  const playChunk = useCallback(
    (targetSessionId: number, index: number) => {
      clearTimers();
      const session = sessionRef.current;
      if (!session || session.id !== targetSessionId || session.cancelled) {
        finishSpeech();
        return;
      }

      if (session.isPaused) {
        return;
      }

      // Check if all chunks completed
      if (index >= session.chunks.length) {
        finishSpeech();
        return;
      }

      session.currentIndex = index;
      const chunkText = session.chunks[index].trim();
      if (!chunkText) {
        // Skip empty chunk immediately
        playChunk(targetSessionId, index + 1);
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(chunkText);
        // Retain strong reference to prevent GC from terminating speech early
        activeUtterancesRef.current = [utterance];

        utterance.rate = speechRate || 1.0;
        utterance.pitch = 1.05;
        if (session.chosenVoice) {
          utterance.voice = session.chosenVoice;
        }

        let chunkSettled = false;

        const advanceToNext = () => {
          if (chunkSettled) return;
          chunkSettled = true;
          if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }

          if (sessionRef.current?.id === targetSessionId && !sessionRef.current.cancelled) {
            chunkTimerRef.current = setTimeout(() => {
              playChunk(targetSessionId, index + 1);
            }, 35);
          } else {
            finishSpeech();
          }
        };

        utterance.onend = () => {
          advanceToNext();
        };

        utterance.onerror = (e: any) => {
          if (sessionRef.current?.cancelled || sessionRef.current?.id !== targetSessionId) {
            finishSpeech();
            return;
          }
          console.warn(`Utterance chunk ${index + 1}/${session.chunks.length} error (${e.error}), advancing:`, e);
          advanceToNext();
        };

        const estimatedDurationMs = Math.max(6000, chunkText.length * 130);
        watchdogTimerRef.current = setTimeout(() => {
          if (!chunkSettled && sessionRef.current?.id === targetSessionId && !sessionRef.current.isPaused) {
            console.warn(`Watchdog timed out on chunk ${index + 1}, advancing to next chunk.`);
            advanceToNext();
          }
        }, estimatedDurationMs + 3500);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Failed to speak utterance chunk, skipping to next:', err);
        playChunk(targetSessionId, index + 1);
      }
    },
    [clearTimers, finishSpeech, speechRate]
  );

  // Resume playback from the exact position
  const resumeSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const session = sessionRef.current;
    if (session && session.isPaused && !session.cancelled) {
      session.isPaused = false;
      setIsPaused(false);

      if (window.speechSynthesis.paused) {
        try {
          window.speechSynthesis.resume();
          return;
        } catch (e) {
          console.warn('speechSynthesis.resume() failed, re-playing current chunk:', e);
        }
      }

      playChunk(session.id, session.currentIndex);
    }
  }, [playChunk]);

  // Main Speak function: Starts clean, sequential playback of the full response
  const speak = useCallback(
    (text: string) => {
      if (!spokenResponses || !('speechSynthesis' in window)) return;

      // Crucial: Turn off microphone before playing TTS to prevent audio feedback loop
      stopListening();

      // Cancel prior session cleanly
      cancelSpeech();

      const cleaned = cleanTextForSpeech(text);
      if (!cleaned.trim()) {
        finishSpeech();
        return;
      }

      const chunks = splitTextIntoSpeechChunks(cleaned, 160);
      if (chunks.length === 0) {
        finishSpeech();
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      let chosenVoice: SpeechSynthesisVoice | null = null;

      if (language === 'hinglish') {
        // Hinglish uses Roman script: Indian English female voices pronounce it naturally
        chosenVoice =
          voices.find((v) => (v.lang === 'en-IN' || v.lang.includes('IN')) && (v.name.includes('Female') || v.name.includes('Heera') || v.name.includes('Google') || v.name.includes('India'))) ||
          voices.find((v) => v.lang === 'en-IN') ||
          voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Karen') || v.name.includes('Natural'))) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          null;
      } else {
        // Natural English female voice
        chosenVoice =
          voices.find((v) => (v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en')) && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Karen') || v.name.includes('Natural') || v.name.includes('Google'))) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          null;
      }

      const sessionId = Date.now();
      const newSession: ActiveSpeechSession = {
        id: sessionId,
        fullText: text,
        chunks,
        currentIndex: 0,
        isPaused: false,
        cancelled: false,
        chosenVoice,
      };

      sessionRef.current = newSession;
      setIsProcessing(false);
      isProcessingRef.current = false;
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      setIsPaused(false);
      setCurrentSpeakingText(text);

      setTimeout(() => {
        if (sessionRef.current?.id === sessionId && !sessionRef.current.cancelled) {
          playChunk(sessionId, 0);
        }
      }, 40);
    },
    [spokenResponses, language, cancelSpeech, finishSpeech, playChunk, stopListening]
  );

  const speechState: SpeechState = speechError
    ? 'error'
    : isSpeaking
    ? 'speaking'
    : isProcessing
    ? 'processing'
    : isListening
    ? 'listening'
    : 'idle';

  return {
    speechState,
    isListening,
    isProcessing,
    isSpeaking,
    isPaused,
    isHandsFreeActive,
    isAwaitingHandsFreeCommand,
    currentSpeakingText,
    transcript,
    isSupported,
    speechError,
    startListening,
    stopListening,
    startHandsFree,
    stopHandsFree,
    notifyProcessingStarted,
    notifyProcessingFinished,
    speak,
    pauseSpeech,
    resumeSpeech,
    cancelSpeech,
  };
}
