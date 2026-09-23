import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for zero-cost, in-browser speech transcription using Web Speech API.
 * Captures real-time audio from microphone, produces live interim captions,
 * and records timestamped speech turns for communication skill analysis.
 */
export function useSpeechTranscription({
  speakerRole = 'candidate',
  speakerName = 'Participant',
  enabled = true,
  isMicMuted = false,
} = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptTurns, setTranscriptTurns] = useState([]);

  const recognitionRef = useRef(null);
  const manualStopRef = useRef(false);
  const isMicMutedRef = useRef(isMicMuted);
  const enabledRef = useRef(enabled);
  const turnStartTimeRef = useRef(Date.now());

  // Keep ref up to date
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
    if (isMicMuted && recognitionRef.current && isListening) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
  }, [isMicMuted, isListening]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

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
        if (isMicMutedRef.current) return;

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

        setLiveTranscript(interim || finalTurnText);

        if (finalTurnText.trim()) {
          const duration = Math.max(
            0.5,
            parseFloat(((Date.now() - turnStartTimeRef.current) / 1000).toFixed(1))
          );
          const newTurn = {
            id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            speaker: speakerRole,
            speaker_name: speakerName,
            text: finalTurnText.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            duration_seconds: duration,
          };

          setTranscriptTurns((prev) => [...prev, newTurn]);
          turnStartTimeRef.current = Date.now();
          setLiveTranscript('');
        }
      };

      recognition.onerror = (event) => {
        // 'no-speech' is normal when user is listening rather than speaking
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition notification:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setLiveTranscript('');

        // Auto-reconnect if not explicitly stopped and mic is active
        if (!manualStopRef.current && enabledRef.current && !isMicMutedRef.current) {
          try {
            setTimeout(() => {
              if (!manualStopRef.current && enabledRef.current && !isMicMutedRef.current) {
                recognition.start();
              }
            }, 300);
          } catch (_) {}
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('SpeechRecognition could not be initialized:', err);
      setIsSupported(false);
    }

    return () => {
      manualStopRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, [speakerRole, speakerName]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;
    manualStopRef.current = false;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (_) {}
  }, [isSupported]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (_) {}
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
