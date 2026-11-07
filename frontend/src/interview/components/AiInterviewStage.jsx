import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  User,
  Clock,
  Mic,
  MicOff,
  Send,
  SkipForward,
  RotateCcw,
  Pause,
  Play,
  LogOut,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertCircle,
  ExternalLink,
  Briefcase,
  Flag,
  Type,
  AudioLines,
  ShieldAlert,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { useFocusMonitoring } from '../hooks/useFocusMonitoring';
import { interviewApi } from '../services/interviewApi';
import { finalizeRecording } from '../utils/recording';
import { deduplicateOverlap, collapseWordStutters } from '../utils/speechDedup';
import { InterviewCompletedCard } from './InterviewCompletedCard';
import { useNavigate } from 'react-router-dom';
import termjobsLogo from '../../assets/termjobs-logo.png';

/**
 * Live AI Interview Stage (Azure OpenAI gpt-6-luna)
 * Displays the conversational live interviewer room in the side panel of TermJobs:
 * - Session status bar with gpt-6-luna badge, Question counter, 20m timer, Text/Voice toggle, Pause, and Finish.
 * - STAR pattern detection indicators.
 * - Interactive dialog transcript stream with AI Interviewer bubble, Read aloud button, Candidate answer bubble, and Follow-Up cards.
 * - Realistic Human Female Voice synthesis (Microsoft Jenny / Aria / Google US English / Microsoft Zira) with automatic Chrome un-suspend.
 * - Exclusive, continuous live microphone Speech-to-Text with full toggle control, wave visualizer, and deduplication.
 * - Recruiter scorecard generation with gpt-6-luna on completion.
 */
export function AiInterviewStage({
  round,
  candidateName = 'Candidate',
  requisitionTitle = 'Position',
  companyName = 'Hiring Partner',
  userRole = 'candidate',
  isMicOn = true,
  onToggleMicrophone,
  isCameraOn = false,
  onEnableCamera,
  cameraError,
  localStream = null,
  onAiSpeakingChange,
  onAnalysisReady,
  onSaveProofRecording,
  onFocusViolationCountChange,
  onInterviewComplete,
}) {
  const navigate = useNavigate();
  const cacheKey = round?.id ? `tj_interview_cache_${round.id}` : null;
  const initialCache = useRef((() => {
    if (!round?.id || typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(`tj_interview_cache_${round.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  })()).current;

  const [questions, setQuestions] = useState(() => (Array.isArray(initialCache?.questions) && initialCache.questions.length > 0 ? initialCache.questions : []));
  const [questionLoadError, setQuestionLoadError] = useState('');
  const [currentStep, setCurrentStep] = useState(() => (typeof initialCache?.currentStep === 'number' ? initialCache.currentStep : 0));
  const [inputMode, setInputMode] = useState('voice'); // 'text' | 'voice'
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micVolume, setMicVolume] = useState(0); // 0 - 100 real-time microphone volume
  const [sttEngine, setSttEngine] = useState('browser'); // 'browser' | 'whisper'
  const [sttStatus, setSttStatus] = useState('ready'); // 'ready' | 'recording' | 'transcribing'
  const [micErrorMessage, setMicErrorMessage] = useState('');
  const [speechConfidence, setSpeechConfidence] = useState(100);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isCompleted, setIsCompleted] = useState(round?.status === 'Completed');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() => (typeof initialCache?.secondsRemaining === 'number' ? initialCache.secondsRemaining : 20 * 60));

  // Audio / Voice Synthesis (Realistic Female Voice)
  const [isSpeakingAi, setIsSpeakingAi] = useState(false);
  const [activeSpeakingTurnIndex, setActiveSpeakingTurnIndex] = useState(null);
  const [selectedFemaleVoice, setSelectedFemaleVoice] = useState(null);
  const selectedVoiceRef = useRef(null);

  // Dialog conversation stream
  const [turns, setTurns] = useState(() => (Array.isArray(initialCache?.turns) && initialCache.turns.length > 0 ? initialCache.turns : []));
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(() => {
    if (Array.isArray(initialCache?.questions) && initialCache.questions.length > 0) return false;
    if (Array.isArray(initialCache?.turns) && initialCache.turns.length > 0) return false;
    return true;
  });
  const [followUpQuestion, setFollowUpQuestion] = useState(null);
  const [followUpsCount, setFollowUpsCount] = useState(0);
  const [lastStar, setLastStar] = useState(null);

  // Recording
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [recordingUploaded, setRecordingUploaded] = useState(false);

  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const turnsEndRef = useRef(null);

  // Dedicated single-engine Speech Recognition references
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  isListeningRef.current = isListening;
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;
  const isCompletedRef = useRef(false);
  isCompletedRef.current = isCompleted;
  const isAiSpeakingRef = useRef(false);
  const aiSpeakingSafetyTimerRef = useRef(null);
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const roundIdRef = useRef(round?.id);
  roundIdRef.current = round?.id;
  const currentTurnIdRef = useRef(0);

  // Real-Time Audio Level Analyzer & Whisper MediaRecorder references
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const whisperRecorderRef = useRef(null);
  const whisperChunksRef = useRef([]);
  const whisperSliceTimerRef = useRef(null);
  const activeAudioStreamRef = useRef(null);

  const baseTextRef = useRef('');
  const currentAnswerRef = useRef('');
  currentAnswerRef.current = currentAnswer;

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);

  // =========================================================================
  // REALISTIC HUMAN FEMALE VOICE SELECTOR & ENGINE
  // =========================================================================
  const loadRealisticFemaleVoice = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return;

    const enVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
    const pool = enVoices.length ? enVoices : voices;

    const femalePriority = [
      'Microsoft Jenny Online (Natural)',
      'Microsoft Aria Online (Natural)',
      'Jenny',
      'Aria',
      'Google US English', // Chrome's high-quality neural female voice
      'Google UK English Female',
      'Samantha (Enhanced)',
      'Samantha',
      'Ava (Enhanced)',
      'Ava',
      'Microsoft Zira', // Windows built-in female voice
      'Zira',
      'Karen (Enhanced)',
      'Karen',
      'Victoria',
      'Female',
    ];

    let chosenVoice = null;
    for (const name of femalePriority) {
      chosenVoice = pool.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
      if (chosenVoice) break;
    }

    if (!chosenVoice) {
      // Exclude male voice names
      const maleKeywords = ['david', 'mark', 'george', 'daniel', 'guy', 'male', 'richard'];
      chosenVoice = pool.find((v) => !maleKeywords.some((m) => v.name.toLowerCase().includes(m))) || pool[0];
    }

    if (chosenVoice) {
      setSelectedFemaleVoice(chosenVoice);
      selectedVoiceRef.current = chosenVoice;
      console.log('🎤 [Realistic Female Voice Loaded]:', chosenVoice.name);
    }
  }, []);

  useEffect(() => {
    loadRealisticFemaleVoice();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadRealisticFemaleVoice;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [loadRealisticFemaleVoice]);

  // Robust speak function with safety timeout so isAiSpeaking NEVER gets stuck
  const speakText = useCallback(
    (text, turnIndex = null) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
      const synth = window.speechSynthesis;

      // Automatically pause microphone so AI speaking through speakers is never recorded
      isAiSpeakingRef.current = true;
      whisperChunksRef.current = [];
      setIsListening(false);
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
      if (whisperRecorderRef.current && whisperRecorderRef.current.state !== 'inactive') {
        try { whisperRecorderRef.current.stop(); } catch (_) {}
      }

      if (aiSpeakingSafetyTimerRef.current) {
        clearTimeout(aiSpeakingSafetyTimerRef.current);
        aiSpeakingSafetyTimerRef.current = null;
      }

      const endSpeaking = () => {
        if (aiSpeakingSafetyTimerRef.current) {
          clearTimeout(aiSpeakingSafetyTimerRef.current);
          aiSpeakingSafetyTimerRef.current = null;
        }
        isAiSpeakingRef.current = false;
        setIsSpeakingAi(false);
        setActiveSpeakingTurnIndex(null);
        onAiSpeakingChange?.(false);
        whisperChunksRef.current = [];
      };

      try {
        if (synth.paused) synth.resume();
        synth.cancel();

        setTimeout(() => {
          try {
            if (synth.paused) synth.resume();
            const utterance = new SpeechSynthesisUtterance(text);

            const voice = selectedVoiceRef.current || selectedFemaleVoice;
            if (voice) {
              utterance.voice = voice;
              utterance.lang = voice.lang || 'en-US';
            } else {
              utterance.lang = 'en-US';
            }

            utterance.rate = 0.96;
            utterance.pitch = 1.05;
            utterance.volume = 1.0;

            utterance.onstart = () => {
              isAiSpeakingRef.current = true;
              setIsSpeakingAi(true);
              setActiveSpeakingTurnIndex(turnIndex);
              onAiSpeakingChange?.(true);
              whisperChunksRef.current = [];

              // Strict safety timeout: guarantees isAiSpeaking resets even if Chrome drops onend event
              const estimatedMs = Math.max(3500, text.length * 85 + 2500);
              aiSpeakingSafetyTimerRef.current = setTimeout(endSpeaking, estimatedMs);
            };

            utterance.onend = endSpeaking;
            utterance.onerror = endSpeaking;

            synth.speak(utterance);
          } catch (innerErr) {
            console.warn('[TTS inner warning]:', innerErr);
            endSpeaking();
          }
        }, 60);
      } catch (e) {
        console.warn('[TTS invocation warning]:', e);
        endSpeaking();
      }
    },
    [selectedFemaleVoice, onAiSpeakingChange]
  );

  // Chrome long-speech keep-alive
  useEffect(() => {
    if (!isSpeakingAi) return;
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(timer);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [isSpeakingAi]);

  // =========================================================================
  // DUAL-ENGINE SPEECH-TO-TEXT (Browser Speech + High-Speed Groq Whisper AI)
  // Real-time audio level meter, auto-unmute sync, and zero-drop transcription
  // =========================================================================

  // Flushes recorded microphone audio chunk to backend Groq Whisper STT
  const flushAudioChunkToWhisper = useCallback(async () => {
    // If AI is currently speaking, drop any speaker sound immediately
    if (isAiSpeakingRef.current) {
      whisperChunksRef.current = [];
      return;
    }

    if (!whisperChunksRef.current.length || !roundIdRef.current) return;
    const capturedTurnId = currentTurnIdRef.current;
    const chunks = [...whisperChunksRef.current];
    whisperChunksRef.current = [];
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (blob.size < 600) return; // Ignore micro clicks

    setSttStatus('transcribing');
    try {
      const res = await interviewApi.transcribeAudio(roundIdRef.current, blob, 'candidate_voice.webm');
      // If candidate transitioned to next question while request was in-flight, discard old transcript!
      if (capturedTurnId !== currentTurnIdRef.current || isAiSpeakingRef.current) {
        return;
      }
      if (res && res.transcript && res.transcript.trim()) {
        const newText = res.transcript.trim();
        setCurrentAnswer((prev) => {
          if (capturedTurnId !== currentTurnIdRef.current) return '';
          const current = (prev || '').trim();
          if (!current) return newText;
          const merged = deduplicateOverlap(current, newText);
          const clean = collapseWordStutters(merged).replace(/\s+/g, ' ').trim();
          currentAnswerRef.current = clean;
          baseTextRef.current = clean;
          return clean;
        });
      }
    } catch (err) {
      console.warn('[Whisper STT transcription warning]:', err);
    } finally {
      if (isListeningRef.current) {
        setSttStatus('recording');
      } else {
        setSttStatus('ready');
      }
    }
  }, []);

  const setupAudioMeter = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !stream) return;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!isListeningRef.current) {
          setMicVolume(0);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      animFrameRef.current = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.warn('[Audio meter setup warning]:', err);
    }
  }, []);

  const startWhisperRecorder = useCallback((stream) => {
    if (typeof MediaRecorder === 'undefined' || !stream) return;
    try {
      if (whisperRecorderRef.current && whisperRecorderRef.current.state !== 'inactive') {
        try { whisperRecorderRef.current.stop(); } catch (_) {}
      }
      whisperChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          // Do not accumulate chunks if AI is speaking
          if (!isAiSpeakingRef.current) {
            whisperChunksRef.current.push(e.data);
          }
        }
      };

      recorder.start(1000);
      whisperRecorderRef.current = recorder;

      if (whisperSliceTimerRef.current) clearInterval(whisperSliceTimerRef.current);
      // Auto-flush speech chunks every 4 seconds so spoken words appear naturally
      whisperSliceTimerRef.current = setInterval(() => {
        if (isListeningRef.current && !isAiSpeakingRef.current && whisperChunksRef.current.length > 0) {
          flushAudioChunkToWhisper();
        }
      }, 4000);
    } catch (e) {
      console.warn('[Whisper Recorder init warning]:', e);
    }
  }, [flushAudioChunkToWhisper]);

  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // If AI is currently reading aloud, stop AI speech before candidate speaks
    if (isAiSpeakingRef.current) {
      if (synthRef.current) synthRef.current.cancel();
      isAiSpeakingRef.current = false;
      setIsSpeakingAi(false);
      setActiveSpeakingTurnIndex(null);
      onAiSpeakingChange?.(false);
    }

    setMicErrorMessage('');

    // 1. Unmute synchronization: if bottom dock muted mic, unmute it immediately
    if (!isMicOnRef.current && onToggleMicrophone) {
      try {
        await onToggleMicrophone();
      } catch (_) {}
    }

    // 2. Obtain or verify active microphone stream and enable audio tracks
    let stream = localStream;
    let audioTrack = stream?.getAudioTracks()?.find((t) => t.readyState === 'live');

    if (audioTrack) {
      audioTrack.enabled = true;
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        activeAudioStreamRef.current = stream;
        audioTrack = stream.getAudioTracks()[0];
      } catch (mediaErr) {
        console.error('[Microphone hardware access error]:', mediaErr);
        setMicErrorMessage('Microphone access is blocked. Allow microphone in your browser address bar permissions and retry.');
        setIsListening(false);
        return;
      }
    }

    setIsListening(true);
    isListeningRef.current = true;
    setSttStatus('recording');
    whisperChunksRef.current = [];
    baseTextRef.current = currentAnswerRef.current.trim();
    const capturedTurnId = currentTurnIdRef.current;

    // 3. Start real-time audio volume meter
    setupAudioMeter(stream);

    // 4. Start Whisper continuous recorder (ultra-reliable backup across all browsers)
    startWhisperRecorder(stream);

    // 5. Also launch browser SpeechRecognition for immediate live streaming in Chrome/Edge
    const windowObj = window;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (_) {}
          recognitionRef.current = null;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setSttEngine('browser');
        };

        recognition.onresult = (event) => {
          // If AI is speaking or turn changed, ignore speech from speakers!
          if (isAiSpeakingRef.current || capturedTurnId !== currentTurnIdRef.current) return;

          let sessionFinal = '';
          let sessionInterim = '';

          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            if (!res) continue;
            const transcript = (res[0]?.transcript || '').trim();
            if (!transcript) continue;

            if (res.isFinal) {
              if (res[0]?.confidence) {
                setSpeechConfidence(Math.round(res[0].confidence * 100));
              }
              sessionFinal = deduplicateOverlap(sessionFinal, transcript);
            } else {
              sessionInterim = deduplicateOverlap(sessionInterim, transcript);
            }
          }

          const cleanFinal = collapseWordStutters(sessionFinal);
          const cleanInterim = collapseWordStutters(sessionInterim);

          const currentSpoken = cleanInterim
            ? deduplicateOverlap(cleanFinal, cleanInterim)
            : cleanFinal;

          const base = baseTextRef.current.trim();
          const full = base ? deduplicateOverlap(base, currentSpoken) : currentSpoken;
          const clean = full.replace(/\s+/g, ' ').trim();

          setCurrentAnswer(clean);
          currentAnswerRef.current = clean;
        };

        recognition.onerror = (event) => {
          // If browser shields (Brave) or network block Web Speech, seamlessly route through Whisper AI
          if (event.error !== 'no-speech') {
            console.log('Web Speech API status:', event.error, '-> Seamlessly using Whisper AI');
          }
          setSttEngine('whisper');
        };

        recognition.onend = () => {
          // If user hasn't paused and AI is not speaking, keep browser recognition alive
          if (isListeningRef.current && sttEngine === 'browser' && !isAiSpeakingRef.current) {
            try {
              recognition.start();
            } catch (_) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (srErr) {
        console.log('Web Speech unavailable, using Whisper AI:', srErr);
        setSttEngine('whisper');
      }
    } else {
      setSttEngine('whisper');
    }
  }, [localStream, onToggleMicrophone, setupAudioMeter, startWhisperRecorder, sttEngine, onAiSpeakingChange]);

  const stopListening = useCallback(async (flushPending = true) => {
    isListeningRef.current = false;
    setIsListening(false);
    setMicVolume(0);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (whisperSliceTimerRef.current) {
      clearInterval(whisperSliceTimerRef.current);
      whisperSliceTimerRef.current = null;
    }

    // Stop browser SpeechRecognition safely
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    // Stop Whisper recorder and flush final captured chunk only if requested
    if (whisperRecorderRef.current && whisperRecorderRef.current.state !== 'inactive') {
      try {
        whisperRecorderRef.current.stop();
      } catch (_) {}
    }

    if (flushPending && !isAiSpeakingRef.current) {
      await flushAudioChunkToWhisper();
    } else {
      whisperChunksRef.current = [];
    }
    setSttStatus('ready');
    baseTextRef.current = currentAnswerRef.current.trim();
  }, [flushAudioChunkToWhisper]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening(true);
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // =========================================================================
  // AI INTERVIEW FOCUS MONITORING & MALPRACTICE PREVENTION
  // =========================================================================
  const pausedByFocusRef = useRef(false);

  const {
    isFocusLost,
    incidents: focusIncidents,
    incidentCount: focusIncidentCount,
    currentViolation,
    showReturnToast,
    dismissViolation,
  } = useFocusMonitoring({
    roundId: round?.id,
    candidateToken: round?.candidate_token || round?.interviewer_token || '',
    activeQuestionNumber: currentStep + 1,
    initialFocusEvents: round?.focus_monitoring_events || [],
    enabled: !isCompleted && !isAnalyzing,
    onFocusLost: () => {
      if (isListeningRef.current) {
        pausedByFocusRef.current = true;
        stopListening(false);
      }
    },
    onViolation: (_incident, count, level) => {
      onFocusViolationCountChange?.(count);
      if (level === 'critical_warning') {
        setIsPaused(true);
      }
    },
  });

  // Notify parent room of restored or updated focus violation count (survives page refresh)
  useEffect(() => {
    if (typeof focusIncidentCount === 'number') {
      onFocusViolationCountChange?.(focusIncidentCount);
    }
  }, [focusIncidentCount, onFocusViolationCountChange]);

  const handleAcknowledgeViolation = () => {
    const isCritical = currentViolation?.violation_level === 'critical_warning';
    dismissViolation();
    if (isCritical) {
      setIsPaused(false);
    }
    if (pausedByFocusRef.current) {
      pausedByFocusRef.current = false;
      startListening();
    }
  };

  // =========================================================================
  // CAMERA PROOF RECORDING (MediaRecorder)
  // =========================================================================
  useEffect(() => {
    if (round?.status === 'Completed' || isCompleted || onSaveProofRecording) return;
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return;

    let isCancelled = false;
    const initRecording = async () => {
      try {
        const stream = localStream;
        if (!stream?.getVideoTracks().some((track) => track.readyState === 'live') || isCancelled) return;

        const mimeCandidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4',
        ];
        let chosenMime = '';
        for (const candidate of mimeCandidates) {
          if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) {
            chosenMime = candidate;
            break;
          }
        }

        if (mediaRecorderRef.current && (mediaRecorderRef.current.state !== 'inactive' || recordedChunksRef.current.length > 0)) {
          return;
        }

        const options = {
          ...(chosenMime ? { mimeType: chosenMime } : {}),
          videoBitsPerSecond: 1200000,
          audioBitsPerSecond: 64000,
        };
        const recorder = new MediaRecorder(stream, options);
        recordedChunksRef.current = [];
        recordingStartTimeRef.current = Date.now();

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn('[RECORDING] MediaRecorder initialization warning:', err);
      }
    };

    initRecording();
    return () => {
      isCancelled = true;
    };
  }, [localStream, isCompleted, round?.status, onSaveProofRecording]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (synthRef.current) synthRef.current.cancel();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (activeAudioStreamRef.current) {
        try {
          activeAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch (_) {}
      }
    };
  }, [stopListening]);

  // 20-minute Countdown Timer
  useEffect(() => {
    if (isPaused || isCompleted || !questions.length) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isCompleted, questions.length]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Scroll to bottom of chat transcript when new turns arrive
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, isAiThinking]);

  // Load questions
  const loadQuestions = useCallback(async () => {
    if (Array.isArray(initialCache?.questions) && initialCache.questions.length > 0) {
      setQuestions(initialCache.questions);
      setIsQuestionsLoading(false);
      return;
    }
    setQuestionLoadError('');
    setIsQuestionsLoading(true);
    try {
      if (Array.isArray(round?.interview_questions) && round.interview_questions.length > 0) {
        setQuestions(round.interview_questions);
        setIsQuestionsLoading(false);
        return;
      }
      const data = await interviewApi.getAssessmentQuestions(round?.id, round?.candidate_token || round?.interviewer_token);
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setQuestions(data.questions);
        setIsQuestionsLoading(false);
        return;
      }
      throw new Error('Interview questions format invalid');
    } catch (error) {
      console.warn('Applying role-aligned questions:', error);
      const fallback = [
        {
          id: 'q1_technical_delivery',
          competency: 'technical_delivery',
          category: 'Technical delivery',
          phase: 'Phase 1 of 4',
          title: 'Technical Delivery',
          prompt: `In your role as ${requisitionTitle}, describe a key technical system or application you personally designed, built, and delivered. Walk me through the architecture, your personal contributions, and how you validated the outcome.`,
          hint: 'Use STAR: Situation, Task, Action, Result. Highlight direct contributions.',
        },
        {
          id: 'q2_problem_solving',
          competency: 'problem_solving',
          category: 'Problem solving',
          phase: 'Phase 2 of 4',
          title: 'Problem Solving & Debugging',
          prompt: 'Describe a difficult technical bottleneck, latency issue, or system bug you solved. What diagnostic approaches did you test, and why did you settle on your eventual solution?',
          hint: 'Detail trade-offs, root cause isolation, and verification metrics.',
        },
        {
          id: 'q3_collaboration',
          competency: 'collaboration',
          category: 'Collaboration',
          phase: 'Phase 3 of 4',
          title: 'Stakeholder Collaboration',
          prompt: 'Tell me about a conflicting technical priority or disagreement you experienced with a team member or product stakeholder. How did you resolve it constructively?',
          hint: 'Focus on communication, data-driven reasoning, and shared alignment.',
        },
        {
          id: 'q4_ownership',
          competency: 'ownership',
          category: 'Ownership',
          phase: 'Phase 4 of 4',
          title: 'Engineering Ownership & Reliability',
          prompt: 'Describe a production release risk, deadline shift, or unexpected failure you took personal responsibility for. What immediate steps did you execute, and what preventative measures were adopted?',
          hint: 'Highlight proactive ownership and post-incident improvements.',
        },
      ];
      setQuestions(fallback);
    } finally {
      setIsQuestionsLoading(false);
    }
  }, [round?.id, round?.candidate_token, round?.interviewer_token, round?.interview_questions, requisitionTitle, initialCache?.questions]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Persist live interview state (turns, currentStep, secondsRemaining, questions) to sessionStorage
  useEffect(() => {
    if (!cacheKey || isCompleted || !turns || turns.length === 0) return;
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          currentStep,
          turns,
          secondsRemaining,
          questions: questions && questions.length > 0 ? questions : initialCache?.questions || [],
          savedAt: Date.now(),
        })
      );
    } catch (e) {
      console.warn('Failed to cache interview state to sessionStorage', e);
    }
  }, [cacheKey, isCompleted, turns, currentStep, secondsRemaining, questions, initialCache?.questions]);

  // Initialize initial conversation turns once questions are ready
  useEffect(() => {
    if (!questions.length) return;
    if (turns.length === 0) {
      const firstQ = questions[0];
      const firstQText = firstQ.prompt || firstQ.text || `In your role as ${requisitionTitle || 'UI Developer'}, describe a key technical system or application you personally designed, built, and delivered. Walk me through the architecture, your personal contributions, and how you validated the outcome.`;
      const initialTurns = [
        {
          role: 'interviewer',
          kind: 'question',
          text: firstQText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ];
      setTurns(initialTurns);

      // Auto-speak first question in realistic female voice
      setTimeout(() => {
        speakText(firstQText, 0);
      }, 600);
    }
  }, [questions, candidateName, turns.length, speakText]);

  const activeQuestion = questions[currentStep] || {
    id: 'q1',
    prompt: 'Tell me about a key technical project you delivered.',
    title: 'Technical Delivery',
  };

  // Submit Answer & Trigger Azure OpenAI gpt-6-luna adaptive STAR evaluation
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || isAiThinking) return;

    // Invalidate active turn so in-flight Whisper responses cannot spill into next question
    currentTurnIdRef.current += 1;

    // Hard stop and clear all speech chunks
    stopListening(false);
    whisperChunksRef.current = [];

    const answerText = currentAnswer.trim();
    setCurrentAnswer('');
    baseTextRef.current = '';
    currentAnswerRef.current = '';

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    // Append candidate turn
    const updatedTurns = [
      ...turns,
      {
        role: 'candidate',
        text: answerText,
        inputMode,
        timestamp: nowTime,
      },
    ];
    setTurns(updatedTurns);
    setIsAiThinking(true);

    try {
      if (round?.id) {
        const result = await interviewApi.azureAiTurn(round.id, {
          question: activeQuestion,
          candidate_answer: answerText,
          follow_ups_used: followUpsCount,
          max_follow_ups: 1,
          previous_turns: updatedTurns.slice(-4).map((t) => ({
            role: t.role,
            text: t.text,
          })),
        });

        if (result?.star_detected) {
          setLastStar(result.star_detected);
        }

        // Clean composer state for the incoming question/follow-up
        setCurrentAnswer('');
        baseTextRef.current = '';
        currentAnswerRef.current = '';
        whisperChunksRef.current = [];

        const turnTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        // Check if Azure OpenAI asks a targeted follow-up question
        if (result?.next_action === 'follow_up' && result?.follow_up) {
          const followUpTurn = {
            role: 'interviewer',
            kind: 'follow_up',
            text: result.speech_text || result.follow_up,
            timestamp: turnTime,
          };
          setTurns((prev) => [...prev, followUpTurn]);
          setFollowUpQuestion(result.follow_up);
          setFollowUpsCount((prev) => prev + 1);
          speakText(result.speech_text || result.follow_up, updatedTurns.length);
          // Mic remains paused while AI speaks; candidate clicks mic when ready to respond
          return;
        }

        // If no follow-up needed or max follow-up reached -> advance to next question
        const nextIndex = currentStep + 1;
        if (nextIndex >= questions.length) {
          // Finished all questions!
          const concludingText = `${result?.acknowledgement || 'Thank you.'} That concludes all the questions for today. Thank you!`;
          setTurns((prev) => [
            ...prev,
            {
              role: 'interviewer',
              kind: 'notice',
              text: concludingText,
              timestamp: turnTime,
            },
          ]);
          speakText(concludingText, updatedTurns.length);
          await handleFinishInterview();
        } else {
          const nextQ = questions[nextIndex];
          setCurrentStep(nextIndex);
          setFollowUpQuestion(null);
          setFollowUpsCount(0);

          const nextTurnText = `${result?.acknowledgement ? result.acknowledgement + '\n\n' : ''}Next Question: ${nextQ.prompt || nextQ.text}`;
          setTurns((prev) => [
            ...prev,
            {
              role: 'interviewer',
              kind: 'question',
              text: nextTurnText,
              timestamp: turnTime,
            },
          ]);
          speakText(`${result?.acknowledgement ? result.acknowledgement + ' ' : ''}Next Question: ${nextQ.prompt || nextQ.text}`, updatedTurns.length);
          // Mic remains paused while AI speaks; candidate clicks mic when ready to respond
        }
      }
    } catch (err) {
      console.warn('Azure AI Turn exception, applying graceful progression:', err);
      setCurrentAnswer('');
      baseTextRef.current = '';
      currentAnswerRef.current = '';
      whisperChunksRef.current = [];

      const turnTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const nextIndex = currentStep + 1;
      if (nextIndex < questions.length) {
        const nextQ = questions[nextIndex];
        setCurrentStep(nextIndex);
        setFollowUpQuestion(null);
        setFollowUpsCount(0);
        const fallbackText = `Thank you. Next Question: ${nextQ.prompt || nextQ.text}`;
        setTurns((prev) => [
          ...prev,
          {
            role: 'interviewer',
            kind: 'question',
            text: fallbackText,
            timestamp: turnTime,
          },
        ]);
        speakText(fallbackText);
      } else {
        await handleFinishInterview();
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  // Skip current question
  const handleSkipQuestion = () => {
    currentTurnIdRef.current += 1;
    stopListening(false);
    whisperChunksRef.current = [];
    setCurrentAnswer('');
    baseTextRef.current = '';
    currentAnswerRef.current = '';

    const skipTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setTurns((prev) => [
      ...prev,
      {
        role: 'candidate',
        kind: 'skip',
        text: '[Candidate skipped this question]',
        timestamp: skipTime,
      },
    ]);

    const nextIndex = currentStep + 1;
    if (nextIndex >= questions.length) {
      handleFinishInterview();
    } else {
      const nextQ = questions[nextIndex];
      setCurrentStep(nextIndex);
      setFollowUpQuestion(null);
      setFollowUpsCount(0);
      const skipPrompt = `Understood, skipping to the next question:\n\n${nextQ.prompt || nextQ.text}`;
      setTurns((prev) => [
        ...prev,
        {
          role: 'interviewer',
          kind: 'question',
          text: skipPrompt,
          timestamp: skipTime,
        },
      ]);
      speakText(skipPrompt);
    }
  };

  // Repeat current question
  const handleRepeatQuestion = () => {
    const lastInterviewerTurn = [...turns].reverse().find((t) => t.role === 'interviewer');
    if (lastInterviewerTurn) {
      speakText(lastInterviewerTurn.text);
    } else if (activeQuestion.prompt) {
      speakText(activeQuestion.prompt);
    }
  };

  // Finalize interview, generate comprehensive scorecard via gpt-6-luna, and upload video proof in the background
  const handleFinishInterview = async () => {
    if (isCompleted) return;
    // 1. Instantly show Interview Completed screen
    setIsCompleted(true);
    onInterviewComplete?.();
    if (cacheKey) {
      try {
        sessionStorage.removeItem(cacheKey);
      } catch (_) {}
    }
    stopListening();
    if (synthRef.current) synthRef.current.cancel();

    // 2. Perform video upload, Azure AI scorecard, and communication analysis silently in background
    (async () => {
      const callSeconds = recordingStartTimeRef.current
        ? Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000))
        : 30;

      try {
        if (onSaveProofRecording) {
          const saved = recordingUploaded || (await onSaveProofRecording(callSeconds, setUploadProgress));
          if (saved) setRecordingUploaded(true);
        } else if (mediaRecorderRef.current) {
          const recordedBlob = await finalizeRecording(mediaRecorderRef.current, recordedChunksRef.current);
          if (recordedBlob && round?.id) {
            await interviewApi.uploadRecording(
              round.id,
              recordedBlob,
              callSeconds,
              round.candidate_token || round.interviewer_token,
              setUploadProgress
            );
            setRecordingUploaded(true);
          }
        }
      } catch (recErr) {
        console.warn('[RECORDING] Video capture notice:', recErr);
      } finally {
        try {
          if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
          }
        } catch (_) {}
      }

      // Call Azure AI Complete endpoint for comprehensive recruiter evaluation report & scorecard
      try {
        if (round?.id) {
          const azureRes = await interviewApi.azureAiComplete(round.id);
          if (azureRes?.scorecard) {
            onAnalysisReady?.(azureRes.scorecard);
          }
        }
      } catch (azErr) {
        console.warn('[Azure AI Complete notice]', azErr);
      }

      // Submit communication analysis
      try {
        if (round?.id) {
          const turnsToSubmit = turns.map((t) => ({
            speaker: t.role === 'interviewer' ? 'interviewer' : 'candidate',
            speaker_name: t.role === 'interviewer' ? 'Aria (AI Assessor)' : candidateName,
            text: t.text,
            timestamp: new Date().toLocaleTimeString(),
            duration_seconds: 30,
          }));
          await interviewApi.analyzeCommunication(round.id, {
            interview_token: round.candidate_token || round.interviewer_token,
            transcript_turns: turnsToSubmit,
            call_duration_seconds: 20 * 60 - secondsRemaining,
            candidate_name: candidateName,
            role_title: requisitionTitle,
          });
        }
      } catch (commErr) {
        console.warn('[Communication analysis notice]', commErr);
      }
    })();
  };

  // =========================================================================
  // VIEW: INTERVIEW COMPLETED · CANDIDATE CONFIRMATION CARD
  // =========================================================================
  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FAFAFA]">
        <InterviewCompletedCard
          round={{
            ...round,
            candidate_name: candidateName,
            requisition_title: requisitionTitle,
            company_name: companyName,
          }}
          invitationToken={round?.candidate_token}
          candidateName={candidateName}
          onBack={() => {
            navigate('/open-roles');
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW: LIVE INTERACTIVE AI INTERVIEW ROOM (Side Panel)
  // =========================================================================
  return (
    <div className="w-full h-full flex flex-col gap-3 min-h-0 overflow-hidden font-sans">
      {/* 1. Top Role Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs shrink-0">
        {/* Top Row: Position + Candidate + AI Interview badge + Question counter */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {requisitionTitle || 'UI Developer'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                AI Interview
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
              Candidate: <span className="text-slate-700 font-semibold">{candidateName}</span>
            </div>
          </div>

          {/* Question Counter Pill */}
          <div className="px-3.5 py-1 rounded-full text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200/70 shrink-0">
            Question {currentStep + 1} of {questions.length || 6}
          </div>
        </div>
      </div>

      {/* Focus Restored Toast */}
      {showReturnToast && !currentViolation && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-zinc-950 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 border border-zinc-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Focus Restored · Return to Question {currentStep + 1}</span>
        </div>
      )}

      {/* Progressive Focus Loss Violation Modal */}
      {currentViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                currentViolation.violation_level === 'critical_warning'
                  ? 'bg-rose-100 text-rose-600'
                  : currentViolation.violation_level === 'strong_warning'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-zinc-100 text-zinc-800'
              }`}>
                {currentViolation.violation_level === 'critical_warning' ? (
                  <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
                ) : (
                  <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
                )}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {currentViolation.violation_level === 'critical_warning'
                    ? 'Interview Paused: Focus Violations'
                    : currentViolation.violation_level === 'strong_warning'
                    ? 'Repeated Focus Loss Warning'
                    : 'Focus Policy Reminder'}
                </h3>
                <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  currentViolation.violation_level === 'critical_warning'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : currentViolation.violation_level === 'strong_warning'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                }`}>
                  Incident #{currentViolation.incident_sequence} · {currentViolation.event_type === 'tab_hidden' ? 'Tab Switched' : currentViolation.event_type === 'fullscreen_exit' ? 'Fullscreen Exited' : 'Window Lost Focus'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-700">
              <p className="leading-relaxed font-normal">
                {currentViolation.violation_level === 'critical_warning'
                  ? `Repeated focus loss has been recorded across multiple questions (${focusIncidentCount} incidents total, away for ${currentViolation.duration_seconds}s). The interview session has been paused to protect assessment integrity.`
                  : currentViolation.violation_level === 'strong_warning'
                  ? `You left the interview window for ${currentViolation.duration_seconds}s during Question ${currentViolation.question_number}. This incident has been recorded and flagged for recruiter review.`
                  : `Please return to your interview. Switching tabs or leaving this window is not permitted. Focus loss duration (${currentViolation.duration_seconds}s) has been logged.`}
              </p>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                <span>Active Question: {currentViolation.question_number}</span>
                <span>Away Duration: {currentViolation.duration_seconds}s</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Note: Focus changes are reviewed by your recruiter. Accidental brief switches are taken into account alongside your interview recording.
            </p>

            <button
              type="button"
              onClick={handleAcknowledgeViolation}
              className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-white transition shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                currentViolation.violation_level === 'critical_warning'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : currentViolation.violation_level === 'strong_warning'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-zinc-950 hover:bg-zinc-800'
              }`}
            >
              {currentViolation.violation_level === 'critical_warning'
                ? 'Acknowledge & Resume Interview'
                : 'I Understand & Return to Interview'}
            </button>
          </div>
        </div>
      )}

      {/* 2. Conversation Timeline Stream Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 shadow-xs flex-1 min-h-0 overflow-y-auto space-y-5 relative flex flex-col">
        {turns.length === 0 ? (
          <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300 my-auto">
            {/* Pulsing AI Avatar with animated ring */}
            <div className="relative mb-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shadow-lg shadow-zinc-300/60">
                <Sparkles className="w-7 h-7 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div className="absolute -inset-2 rounded-3xl bg-zinc-400/20 animate-ping -z-10" style={{ animationDuration: '2s' }} />
            </div>

            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Preparing Your AI Interview...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
              Analyzing role criteria and your profile to personalize tailored technical questions. Question 1 will start shortly.
            </p>

            {/* Micro status steps */}
            <div className="mt-5 inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Resume matched
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="flex items-center gap-1.5 text-zinc-900 font-semibold animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-zinc-800 animate-spin" />
                Generating question rubrics
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                Voice ready
              </span>
            </div>
          </div>
        ) : (
          turns.map((turn, i) => {
          const isAi = turn.role === 'interviewer';
          const isTurnSpeaking = isSpeakingAi && activeSpeakingTurnIndex === i;
          const displayTimestamp =
            turn.timestamp ||
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

          if (isAi) {
            return (
              <div key={i} className="relative pl-8 flex flex-col gap-1.5">
                {/* Backgroundless TermJobs Logo */}
                <img
                  src={termjobsLogo}
                  alt="TermJobs AI"
                  className="absolute left-0 top-3.5 w-5 h-5 object-contain shrink-0"
                />

                {/* Interviewer Message Card */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-4 sm:p-5 relative space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-zinc-800 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">Interviewer</span>
                      {turn.kind === 'follow_up' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 text-zinc-800">
                          Follow-up
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {displayTimestamp}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                    {turn.text}
                  </p>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => speakText(turn.text, i)}
                      className={`text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer px-2.5 py-1 rounded-lg ${
                        isTurnSpeaking
                          ? 'bg-zinc-200 text-zinc-950 font-bold animate-pulse'
                          : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60'
                      }`}
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isTurnSpeaking ? 'animate-bounce text-zinc-900' : ''}`} />
                      <span>{isTurnSpeaking ? 'Speaking...' : 'Read aloud'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Candidate Turn (aligned to the right)
          return (
            <div key={i} className="flex justify-end items-start gap-2.5">
              {/* Candidate Bubble */}
              <div className="max-w-[85%] rounded-2xl bg-zinc-950 text-white p-4 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{candidateName}</span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-300 font-medium">
                      <AudioLines className="w-3 h-3" />
                      <span>{turn.inputMode === 'voice' ? 'Spoken' : 'Typed'}</span>
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    {displayTimestamp}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-white font-normal leading-relaxed whitespace-pre-line">
                  {turn.text}
                </p>
              </div>

              {/* Candidate Avatar */}
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs border border-zinc-700">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        }))}

        {isAiThinking && (
          <div className="relative pl-8 flex items-center gap-3">
            <img
              src={termjobsLogo}
              alt="TermJobs AI"
              className="absolute left-0 top-3.5 w-5 h-5 object-contain shrink-0 animate-pulse"
            />
            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-700 flex items-center gap-2 shadow-2xs">
              <Sparkles className="w-4 h-4 text-zinc-800 animate-spin" />
              <span>Interviewer is thinking...</span>
            </div>
          </div>
        )}

        <div ref={turnsEndRef} />
      </div>

      {/* 3. Candidate Response Composer Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs shrink-0 space-y-3">
        {micErrorMessage && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{micErrorMessage}</span>
          </div>
        )}

        {/* Header Row: Your Response | Voice Confidence | Microphone status | char count */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-xs sm:text-sm text-slate-900">Your Response</span>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
              <AudioLines className="w-3.5 h-3.5" />
              <span>Voice Confidence: {speechConfidence}%</span>
            </span>
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-slate-500" />
              <span>Microphone: {turns.length === 0 ? 'Standby' : isListening ? 'Active' : 'Paused'}</span>
            </span>
            <span className="text-slate-400">
              {currentAnswer.length} / 6000 characters
            </span>
          </div>
        </div>

        {/* Input Box: Circle Mic on Left + Textarea */}
        <div className="rounded-2xl border border-slate-200 bg-[#F9FAFC] p-3 sm:p-3.5 flex items-start gap-3.5 shadow-2xs">
          <button
            type="button"
            onClick={turns.length > 0 ? toggleListening : undefined}
            disabled={turns.length === 0}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white transition-all shadow-md shrink-0 cursor-pointer active:scale-95 ${
              turns.length === 0
                ? 'bg-slate-300 cursor-not-allowed opacity-60'
                : isListening
                ? 'bg-red-500 animate-pulse ring-4 ring-red-200 hover:bg-red-600'
                : 'bg-zinc-950 hover:bg-zinc-800'
            }`}
            title={turns.length === 0 ? 'Preparing question...' : isListening ? 'Click to Pause Microphone' : 'Click to Speak'}
          >
            {turns.length === 0 ? (
              <Sparkles className="w-5 h-5 animate-spin text-white" />
            ) : isListening ? (
              <Mic className="w-5 h-5 animate-pulse" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>

          <textarea
            rows={2}
            value={currentAnswer}
            disabled={turns.length === 0}
            onChange={(e) => {
              setCurrentAnswer(e.target.value);
              baseTextRef.current = e.target.value;
              currentAnswerRef.current = e.target.value;
            }}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            placeholder={turns.length === 0 ? 'Preparing Question 1...' : 'Spoken words appear here. You can also edit or type directly...'}
            className="flex-1 bg-transparent border-none focus:outline-none text-slate-800 text-xs sm:text-sm resize-none placeholder:text-slate-400 leading-relaxed font-sans mt-1 disabled:opacity-60"
          />
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleSkipQuestion}
              disabled={isAiThinking || turns.length === 0}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Skip Question</span>
            </button>

            <button
              type="button"
              onClick={handleRepeatQuestion}
              disabled={isAiThinking || turns.length === 0}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Repeat Question</span>
            </button>

            {/* Voice / Text Mode Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setInputMode('voice');
                  startListening();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  inputMode === 'voice'
                    ? 'bg-zinc-950 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                }`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                <span>Voice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputMode('text');
                  stopListening();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  inputMode === 'text'
                    ? 'bg-zinc-950 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitAnswer}
            disabled={!currentAnswer.trim() || isAiThinking || turns.length === 0}
            className="px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-40"
          >
            {isAiThinking ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Answer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
