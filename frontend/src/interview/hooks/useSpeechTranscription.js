import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Continuous, Unbreakable Speech Transcription Hook with Acoustic Echo Cancellation (AIC) Filter.
 * - Auto-restarts SpeechRecognition instance to prevent stopping after ~150 words / 60 seconds.
 * - Hardware and software AIC Gating: completely ignores speaker output while AI agent is speaking.
 * - Accumulates clean timestamped speaker turns for communication skill analysis.
 */
export function useSpeechTranscription({
  speakerRole = 'candidate',
  speakerName = 'Participant',
  enabled = true,
  isMicMuted = false,
  isAiSpeaking = false,
} = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
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

  // Factory function to instantiate and start a fresh SpeechRecognition engine
  const initAndStartRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
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
        setIsListening(true);
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
        // 'no-speech' is normal when user is pausing/thinking
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setLiveTranscript('');

        // Unbreakable auto-reconnect: Instantiates a fresh recognition object so it never terminates after 150 words!
        if (!manualStopRef.current && enabledRef.current && !isMicMutedRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (!manualStopRef.current && enabledRef.current && !isMicMutedRef.current) {
              initAndStartRecognition();
            }
          }, 200);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition initialization error:', err);
    }
  }, [speakerRole, speakerName]);

  // Initial startup
  useEffect(() => {
    manualStopRef.current = false;
    if (enabled && !isMicMuted) {
      initAndStartRecognition();
    }

    return () => {
      manualStopRef.current = true;
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
  }, [enabled, isMicMuted, initAndStartRecognition]);

  const startListening = useCallback(() => {
    manualStopRef.current = false;
    initAndStartRecognition();
  }, [initAndStartRecognition]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
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
    liveTranscript,
    transcriptTurns,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}
