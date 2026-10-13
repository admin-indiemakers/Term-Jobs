import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../../api/client';
import { startSpeechFallback } from '../services/speechFallback';

/** Browser speech capture with bounded recovery and visible failure state. */
export function useSpeechTranscription({
  speakerRole = 'candidate',
  speakerName = 'Participant',
  enabled = true,
  isMicMuted = false,
  isAiSpeaking = false,
} = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const failureCountRef = useRef(0);
  const fallbackStopRef = useRef(null);
  const fallbackStartingRef = useRef(false);
  const generationRef = useRef(0);
  const startupTimerRef = useRef(null);
  const lastResultRef = useRef(Date.now());
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptTurns, setTranscriptTurns] = useState([]);

  const recognitionRef = useRef(null);
  const manualStopRef = useRef(false);
  const isMicMutedRef = useRef(isMicMuted);
  const isAiSpeakingRef = useRef(isAiSpeaking);
  const enabledRef = useRef(enabled);
  const turnStartTimeRef = useRef(Date.now());
  const restartTimerRef = useRef(null);
  const lastAiSpokeTimeRef = useRef(0);

  // Keep refs synchronized
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
    if (isAiSpeaking) {
      lastAiSpokeTimeRef.current = Date.now();
      setLiveTranscript('');
    }
  }, [isAiSpeaking]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const startFallback = useCallback(async () => {
    if (fallbackStopRef.current || fallbackStartingRef.current || manualStopRef.current || !enabledRef.current || isMicMutedRef.current || isAiSpeakingRef.current) return;
    fallbackStartingRef.current = true;
    const generation = generationRef.current;
    clearTimeout(startupTimerRef.current);
    clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.abort();
    }
    setIsListening(false);
    setSpeechError('Browser speech recognition is unavailable. Starting server transcription…');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation !== generationRef.current || manualStopRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      fallbackStopRef.current = startSpeechFallback({ stream, endpoint: `${API_BASE_URL}/api/voice/stt`,
        canCapture: () => enabledRef.current && !isMicMutedRef.current && !isAiSpeakingRef.current && Date.now() - lastAiSpokeTimeRef.current >= 450,
        onListening: () => { setIsSupported(true); setIsListening(true); setSpeechError('Using server transcription. Text appears after each short recording.'); },
        onError: message => { setSpeechError(message); setIsListening(false); },
        onText: text => { lastResultRef.current = Date.now(); setSpeechError(''); setTranscriptTurns(prev => [...prev, { id: `turn_${Date.now()}_${Math.random()}`, speaker: speakerRole, speaker_name: speakerName, text, timestamp: new Date().toLocaleTimeString(), duration_seconds: 5 }]); },
      });
    } catch (_) { setSpeechError('Microphone recording could not start. Allow microphone access in your browser and Windows privacy settings, or type your answer.'); }
    finally { fallbackStartingRef.current = false; }
  }, [speakerRole, speakerName]);

  // Factory function to instantiate and start a fresh SpeechRecognition engine
  const initAndStartRecognition = useCallback(() => {
    if (!enabledRef.current || isMicMutedRef.current || isAiSpeakingRef.current) return;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      startFallback();
      return;
    }

    setIsSupported(true);

    // Clean up existing instance if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        clearTimeout(startupTimerRef.current);
        setIsListening(true);
        setSpeechError('');
        lastResultRef.current = Date.now();
        turnStartTimeRef.current = Date.now();
      };

      recognition.onresult = (event) => {
        // AIC Gating: If mic is muted, or AI is currently speaking, or echo cooldown (<450ms), ignore speech!
        const now = Date.now();
        if (
          isMicMutedRef.current ||
          isAiSpeakingRef.current ||
          now - lastAiSpokeTimeRef.current < 450
        ) {
          setLiveTranscript('');
          return;
        }

        lastResultRef.current = Date.now();
        failureCountRef.current = 0;
        setSpeechError('');
        let interim = '';
        let finalTurnText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTurnText += transcript;
          } else {
            interim += transcript;
          }
        }

        const interimClean = interim.trim();
        const finalClean = finalTurnText.trim();

        // Update live interim view
        setLiveTranscript(interimClean || finalClean);

        // Record finalized speech turn
        if (finalClean) {
          const duration = Math.max(
            0.5,
            parseFloat(((Date.now() - turnStartTimeRef.current) / 1000).toFixed(1))
          );
          const newTurn = {
            id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            speaker: speakerRole,
            speaker_name: speakerName,
            text: finalClean,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            duration_seconds: duration,
          };

          setTranscriptTurns((prev) => [...prev, newTurn]);
          turnStartTimeRef.current = Date.now();
          setLiveTranscript('');
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'aborted' && manualStopRef.current) return;
        if (event.error === 'no-speech') return;
        setIsListening(false);
        failureCountRef.current += 1;
        const fatal = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(event.error);
        if (fatal || failureCountRef.current >= 3) manualStopRef.current = true;
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone or speech recognition permission was denied. Allow microphone access, then retry.'
          : event.error === 'audio-capture'
          ? 'No working microphone was found. Check your microphone connection, then retry.'
          : 'Speech recognition is unavailable or has lost its connection. Retry or type your answer below.';
        setSpeechError(message);
        if (!['not-allowed', 'audio-capture', 'aborted'].includes(event.error)) {
          manualStopRef.current = false;
          startFallback();
        }

      };

      recognition.onend = () => {
        setIsListening(false);
        clearTimeout(startupTimerRef.current);

        // Recover from normal session endings; fatal failures require an explicit retry.
        if (!manualStopRef.current && enabledRef.current && !isMicMutedRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (!manualStopRef.current && enabledRef.current && !isMicMutedRef.current) {
              initAndStartRecognition();
            }
          }, Math.min(3000, 300 * (failureCountRef.current + 1)));
        }
      };

      recognitionRef.current = recognition;
      setIsListening(false);
      startupTimerRef.current = setTimeout(() => {
        manualStopRef.current = true;
        setIsListening(false);
        setSpeechError('Speech recognition did not start. Check microphone permission, retry, or type your answer below.');
        try { recognition.abort(); } catch (_) {}
        manualStopRef.current = false;
        startFallback();
      }, 10000);
      recognition.start();
    } catch (err) {
      clearTimeout(startupTimerRef.current);
      manualStopRef.current = true;
      setIsListening(false);
      setSpeechError('Speech recognition could not start. Retry or type your answer below.');
      manualStopRef.current = false;
      startFallback();
    }
  }, [speakerRole, speakerName, startFallback]);

  // Initial startup
  useEffect(() => {
    manualStopRef.current = false;
    if (enabled && !isMicMuted && !isAiSpeaking) {
      initAndStartRecognition();
    }

    return () => {
      manualStopRef.current = true;
      generationRef.current++;
      fallbackStopRef.current?.();
      fallbackStopRef.current = null;
      setIsListening(false);
      clearTimeout(startupTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [enabled, isMicMuted, isAiSpeaking, initAndStartRecognition]);

  // A browser can report listening while its remote recognition service delivers nothing.
  useEffect(() => {
    if (!enabled || isMicMuted || isAiSpeaking || !isListening) return;
    lastResultRef.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - lastResultRef.current >= 20000) {
        setSpeechError('No speech has been detected. Check your microphone, retry speech recognition, or type your answer below.');
        startFallback();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [enabled, isMicMuted, isAiSpeaking, isListening, startFallback]);

  const startListening = useCallback(() => {
    manualStopRef.current = false;
    generationRef.current++;
    fallbackStopRef.current?.();
    fallbackStopRef.current = null;
    failureCountRef.current = 0;
    setSpeechError('');
    initAndStartRecognition();
  }, [initAndStartRecognition]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    generationRef.current++;
    fallbackStopRef.current?.();
    fallbackStopRef.current = null;
    clearTimeout(startupTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscriptTurns([]);
    setLiveTranscript('');
  }, []);

  return {
    isSupported,
    isListening,
    speechError,
    clearLiveTranscript: () => setLiveTranscript(''),
    liveTranscript,
    transcriptTurns,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}
