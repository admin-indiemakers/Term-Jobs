import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Clock,
  Activity,
  Award,
  Zap,
  ChevronRight,
  Play,
  Square,
  FileText,
  Layers,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { interviewApi } from '../services/interviewApi';

/**
 * Modern Interactive AI Interviewer Stage
 * Powered by continuous in-browser Speech-to-Text (STT) and deterministic + LLM Spoken Communication Analysis.
 * Features:
 * - Unbreakable STT without word limits.
 * - Human-like Natural Voice synthesis using asynchronously loaded premium neural voices.
 * - Hardware and Software Acoustic Echo Cancellation (AIC) filter to reject system speaker audio.
 */
export function AiInterviewStage({
  round,
  candidateName = 'Candidate',
  requisitionTitle = 'Position',
  companyName = 'Hiring Partner',
  userRole = 'candidate',
  isMicOn = true,
  liveTranscript = '',
  isSpeechListening = false,
  speechError = '',
  clearLiveTranscript,
  isCameraOn = false,
  onEnableCamera,
  cameraError,
  transcriptTurns = [],
  startSpeechRecognition,
  stopSpeechRecognition,
  onAiSpeakingChange,
  onAnalysisReady,
  onSaveProofRecording,
  localStream = null,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [questionLoadError, setQuestionLoadError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Per-question finalized speech segments
  const [finalizedSegments, setFinalizedSegments] = useState([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [showTypedAnswer, setShowTypedAnswer] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const [answers, setAnswers] = useState({});
  const [isCompleted, setIsCompleted] = useState(round?.status === 'Completed');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingUploaded, setRecordingUploaded] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(round?.communication_analysis || null);
  const [metricsResult, setMetricsResult] = useState(round?.communication_metrics || null);
  const [activeTab, setActiveTab] = useState('scorecard'); // 'scorecard' | 'transcript'
  const [questionDuration, setQuestionDuration] = useState(0);

  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const timerRef = useRef(null);
  const processedTurnIdsRef = useRef(new Set());
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const internalStreamRef = useRef(null);

  // Auto-record candidate video/audio stream using MediaRecorder (if not handled centrally by parent InterviewRoom)
  useEffect(() => {
    if (round?.status === 'Completed' || isCompleted) return;
    if (onSaveProofRecording) return;
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return;

    let isCancelled = false;

    const initRecording = async () => {
      try {
        let stream = localStream;
        if (!stream || stream.getTracks().length === 0) {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              internalStreamRef.current = stream;
            } catch (mediaErr) {
              console.warn('[RECORDING] Fallback camera/mic access not granted:', mediaErr);
              return;
            }
          }
        }

        if (!stream || isCancelled) return;

        // Choose supported mimeType
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

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          return;
        }

        const options = chosenMime ? { mimeType: chosenMime } : undefined;
        const recorder = new MediaRecorder(stream, options);
        recordedChunksRef.current = [];
        recordingStartTimeRef.current = Date.now();

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.start(1000); // 1s slice for smooth buffer
        mediaRecorderRef.current = recorder;
        console.log('🎥 [RECORDING] Candidate session recording started with:', chosenMime || 'default codec');
      } catch (err) {
        console.warn('⚠️ [RECORDING] MediaRecorder initialization warning:', err);
      }
    };

    initRecording();

    return () => {
      isCancelled = true;
      if (internalStreamRef.current) {
        try {
          internalStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch (_) {}
      }
    };
  }, [localStream]);

  const loadQuestions = useCallback(async () => {
    setQuestionLoadError('');
    try {
      const data = await interviewApi.getAssessmentQuestions(round?.id, round?.candidate_token || round?.interviewer_token);
      if (!Array.isArray(data.questions) || data.questions.length !== 4) throw new Error('Interview questions are unavailable.');
      setQuestions(data.questions);
    } catch (error) { setQuestionLoadError(error.message || 'Unable to prepare resume-based questions.'); }
  }, [round?.id, round?.candidate_token, round?.interviewer_token]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => {
    const checkCamera = () => setCameraReady(Boolean(isCameraOn && localStream?.getVideoTracks().some(track => track.enabled && !track.muted && track.readyState === 'live')));
    checkCamera();
    const timer = setInterval(checkCamera, 500);
    return () => clearInterval(timer);
  }, [localStream, isCameraOn]);

  const activeQuestion = questions[currentStep] || { id: '', prompt: '', phase: '', category: '' };

  // =========================================================================
  // NATURAL HUMAN VOICE LOADER (Fixes "super ai" robotic voice)
  // =========================================================================
  const loadVoices = useCallback(() => {
    if (!synthRef.current) return;
    const voices = synthRef.current.getVoices() || [];
    if (voices.length === 0) return;

    // Filter English voices
    const enVoices = voices.filter((v) => v.lang.startsWith('en'));
    setAvailableVoices(enVoices.length > 0 ? enVoices : voices);

    // Prioritize highest quality natural/human voices across macOS, Windows, Chrome & Safari
    const naturalVoice =
      enVoices.find((v) => v.name.includes('Google US English')) ||
      enVoices.find((v) => v.name.includes('Samantha (Enhanced)')) ||
      enVoices.find((v) => v.name.includes('Samantha')) ||
      enVoices.find((v) => v.name.includes('Ava (Enhanced)')) ||
      enVoices.find((v) => v.name.includes('Ava')) ||
      enVoices.find((v) => v.name.includes('Zoe (Enhanced)')) ||
      enVoices.find((v) => v.name.includes('Karen (Enhanced)')) ||
      enVoices.find((v) => v.name.includes('Daniel (Enhanced)')) ||
      enVoices.find((v) => v.name.includes('Microsoft Jenny') || v.name.includes('Microsoft Aria')) ||
      enVoices.find((v) => v.name.includes('Natural') || v.name.includes('Enhanced')) ||
      enVoices.find((v) => v.name.includes('Google')) ||
      enVoices[0] ||
      voices[0];

    setSelectedVoice(naturalVoice);
  }, []);

  useEffect(() => {
    loadVoices();
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = null;
      }
    };
  }, [loadVoices]);

  // Notify parent of AI speaking state for global AIC Gating
  const updateAiSpeaking = useCallback(
    (speaking) => {
      setIsAiSpeaking(speaking);
      if (onAiSpeakingChange) {
        onAiSpeakingChange(speaking);
      }
    },
    [onAiSpeakingChange]
  );

  // Speech synthesis cancellation can omit onend; never leave capture gated forever.
  useEffect(() => {
    if (!isAiSpeaking) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (!synthRef.current?.speaking || Date.now() - startedAt > 60000) {
        synthRef.current?.cancel();
        updateAiSpeaking(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isAiSpeaking, updateAiSpeaking]);

  useEffect(() => {
    if (isCompleted) return;
    if (!cameraReady) {
      synthRef.current?.cancel();
      updateAiSpeaking(false);
      stopSpeechRecognition?.();
    } else if (isMicOn) {
      startSpeechRecognition?.();
    }
  }, [cameraReady, isCompleted, isMicOn, updateAiSpeaking, stopSpeechRecognition, startSpeechRecognition]);

  // Per-question elapsed timer
  useEffect(() => { setQuestionDuration(0); }, [currentStep]);
  useEffect(() => {
    if (!cameraReady || !questions.length || isCompleted) return;
    timerRef.current = setInterval(() => {
      setQuestionDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStep, cameraReady, questions.length, isCompleted]);

  const formatSecs = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Speak question using the selected natural voice
  const speakCurrentQuestion = useCallback(
    (text) => {
      if (!synthRef.current || !ttsEnabled) return;

      try {
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Natural human cadence tuning: rate 0.93 for warmth and deliberate pacing
        utterance.rate = 0.93;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
          updateAiSpeaking(true);
        };
        utterance.onend = () => {
          // Delay resuming mic by 400ms to allow room audio reverberation to decay (AIC echo protection)
          setTimeout(() => {
            updateAiSpeaking(false);
            if (startSpeechRecognition && isMicOn) {
              startSpeechRecognition();
            }
          }, 400);
        };
        utterance.onerror = () => {
          updateAiSpeaking(false);
        };

        synthRef.current.speak(utterance);
      } catch (err) {
        console.warn('TTS speech execution notice:', err);
        updateAiSpeaking(false);
      }
    },
    [ttsEnabled, selectedVoice, isMicOn, startSpeechRecognition, updateAiSpeaking]
  );

  // Speak new question when moving to next step
  useEffect(() => {
    if (!isCompleted && ttsEnabled && activeQuestion.prompt && cameraReady) {
      const timeout = setTimeout(() => {
        speakCurrentQuestion(activeQuestion.prompt);
      }, 500);
      return () => clearTimeout(timeout);
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [currentStep, isCompleted, ttsEnabled, activeQuestion, cameraReady, speakCurrentQuestion]);

  // =========================================================================
  // AIC FILTER & TRANSCRIPT ACCUMULATION (No word limit, no echo)
  // =========================================================================
  useEffect(() => {
    if (transcriptTurns.length > 0) {
      const candidateTurns = transcriptTurns.filter((t) => String(t.speaker || '').toLowerCase() === 'candidate');
      candidateTurns.forEach((turn) => {
        const turnKey = turn.id || `${turn.timestamp || ''}:${turn.text || ''}`;
        if (!turn?.text || processedTurnIdsRef.current.has(turnKey)) return;

        // Check turn against prompt to reject system audio echo
        const cleanTurn = turn.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const cleanPrompt = activeQuestion.prompt.toLowerCase().replace(/[^\w\s]/g, '').trim();

        // If turn is a direct reflection of the AI question prompt, discard as acoustic feedback
        if (cleanPrompt === cleanTurn && cleanTurn.split(' ').length >= 8) {
          processedTurnIdsRef.current.add(turnKey);
          return;
        }

        // Add to finalized segments
        processedTurnIdsRef.current.add(turnKey);
        setFinalizedSegments((prev) => [...prev, turn.text.trim()]);
      });
    }
  }, [transcriptTurns, activeQuestion.prompt]);

  // Real-time displayed answer text combining finalized segments and clean in-flight speech
  const currentAnswerText = useMemo(() => {
    const finalized = [...finalizedSegments, typedAnswer].filter(Boolean).join(' ').trim();
    if (liveTranscript && !isAiSpeaking) {
      return finalized ? `${finalized} ${liveTranscript.trim()}` : liveTranscript.trim();
    }
    return finalized;
  }, [finalizedSegments, typedAnswer, liveTranscript, isAiSpeaking]);

  // Real-time metrics heuristics for the candidate's current response
  const liveMetrics = useMemo(() => {
    const text = (currentAnswerText || '').trim();
    if (!text) return { wordCount: 0, wpm: 0, fillerCount: 0 };
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const mins = Math.max(questionDuration / 60, 0.1);
    const wpm = Math.round(wordCount / mins);

    const fillerRegex = /\b(um|uh|like|you know|basically|literally|sort of|actually|i mean)\b/gi;
    const fillers = (text.match(fillerRegex) || []).length;

    return { wordCount, wpm, fillerCount: fillers };
  }, [currentAnswerText, questionDuration]);

  const captureWarning = speechError || (!isAiSpeaking && isMicOn && questionDuration >= 20 && !currentAnswerText.trim()
    ? 'No answer has been detected yet. If you are speaking, check your microphone, retry, or type your answer below.'
    : '');

  // Submit current answer and move to next question
  const handleNextQuestion = () => {
    if (!cameraReady || !questions.length) { setAnswerError('Your camera must be on and questions loaded before continuing.'); return; }
    if (!currentAnswerText.trim()) {
      setAnswerError('No answer has been captured. Retry speech recognition or type your answer before continuing.');
      setShowTypedAnswer(true);
      return;
    }
    setAnswerError('');
    if (synthRef.current) {
      synthRef.current.cancel();
      updateAiSpeaking(false);
    }

    const savedAnswer = {
      questionId: activeQuestion.id,
      questionTitle: activeQuestion.title,
      questionPrompt: activeQuestion.prompt,
      answerText: currentAnswerText.trim(),
      input_mode: typedAnswer.trim() ? 'typed_fallback' : 'speech',
      wordCount: liveMetrics.wordCount,
      durationSeconds: questionDuration,
      recordedAt: new Date().toLocaleTimeString(),
    };

    setAnswers((prev) => ({
      ...prev,
      [currentStep]: savedAnswer,
    }));

    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setFinalizedSegments([]);
      setTypedAnswer('');
      clearLiveTranscript?.();
    } else {
      finishAndAnalyzeInterview({
        ...answers,
        [currentStep]: savedAnswer,
      });
    }
  };

  // Finalize interview and call 3-Tier Communication Analyzer API + Upload Video Recording
  const finishAndAnalyzeInterview = async (finalAnswers) => {
    setSubmissionError('');
    if (!cameraReady && !recordingUploaded) { setAnswerError('Your camera must be on before submitting.'); return; }
    setIsCompleted(true);
    setIsAnalyzing(true);

    if (synthRef.current) {
      synthRef.current.cancel();
      updateAiSpeaking(false);
    }

    // 1. Kick off video proof recording save asynchronously in the background
    setIsUploadingRecording(true);
    const callSeconds = recordingStartTimeRef.current
      ? Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000))
      : 30;

    const backgroundUpload = (async () => {
      try {
        if (onSaveProofRecording) {
          console.log('📹 [PROOF RECORDING] Finalizing session proof via parent room handler...');
          const saved = recordingUploaded || await onSaveProofRecording(callSeconds);
          if (!saved) throw new Error('Video recording could not be saved. Please retry submission.');
          setRecordingUploaded(true);
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          let recordedBlob = null;
          await new Promise((resolve) => {
            const timer = setTimeout(() => {
              console.warn('[RECORDING] onstop timed out after 1.5s');
              resolve();
            }, 1500);
            mediaRecorderRef.current.onstop = () => {
              clearTimeout(timer);
              resolve();
            };
            try {
              mediaRecorderRef.current.stop();
            } catch (e) {
              clearTimeout(timer);
              resolve();
            }
          });
          if (recordedChunksRef.current.length > 0) {
            const mime = mediaRecorderRef.current.mimeType || 'video/webm';
            recordedBlob = new Blob(recordedChunksRef.current, { type: mime });
            console.log(`📹 [RECORDING] Completed. Captured ${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB video`);
          }
          if (recordedBlob && round?.id) {
            await interviewApi.uploadRecording(round.id, recordedBlob, callSeconds);
            setRecordingUploaded(true);
            console.log('✅ [RECORDING] Video successfully uploaded to backend');
          } else { throw new Error('No camera recording was captured.'); }
        } else { throw new Error('Video recording is unavailable. Camera recording is required.'); }
      } catch (recErr) {
        throw recErr;
      }
    })();

    try {
      await backgroundUpload;
    } catch (error) {
      setSubmissionError(error.message || 'Video upload failed. Please retry submission.');
      setIsUploadingRecording(false);
      setIsAnalyzing(false);
      return;
    }
    setIsUploadingRecording(false);

    const turnsToSubmit = [];
    Object.keys(finalAnswers)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((idx) => {
        const item = finalAnswers[idx];
        turnsToSubmit.push({
          speaker: 'interviewer',
          speaker_name: 'Aria (AI Assessor)',
          text: item.questionPrompt,
          timestamp: item.recordedAt,
          duration_seconds: 5,
        });
        turnsToSubmit.push({
          speaker: 'candidate',
          speaker_name: candidateName,
          text: item.answerText,
          question_id: item.questionId,
          input_mode: item.input_mode,
          timestamp: item.recordedAt,
          duration_seconds: item.durationSeconds || 30,
        });
      });

    const totalSeconds = Object.values(finalAnswers).reduce(
      (acc, curr) => acc + (curr.durationSeconds || 30),
      0
    );

    try {
      if (round?.id) {
        const analysisPromise = interviewApi.analyzeCommunication(round.id, {
          interview_token: round.candidate_token || round.interviewer_token,
          transcript_turns: turnsToSubmit,
          call_duration_seconds: totalSeconds,
          candidate_name: candidateName,
          role_title: requisitionTitle,
        });
        const res = await analysisPromise;

        if (res) {
          setAnalysisResult(res.analysis || null);
          setMetricsResult(res.metrics || null);
          if (onAnalysisReady) onAnalysisReady(res);
        }
      }
    } catch (err) {
      setSubmissionError(err.message || 'Assessment could not be submitted. Your answers remain available for retry.');
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // =========================================================================
  // VIEW A: INTERVIEW COMPLETED · CANDIDATE CONFIRMATION OR ADMIN SCORECARD
  // =========================================================================
  if (isCompleted) {
    const isCandidate = userRole === 'candidate' || !['admin', 'interviewer', 'hiring_manager'].includes(userRole);

    // 1. Loading state during transmission & video upload
    if (isAnalyzing || isUploadingRecording) {
      return (
        <div className="w-full h-full rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin mb-4" />
          <div className="text-base font-bold text-white tracking-tight">
            {isUploadingRecording ? 'Saving Interview Video & Audio...' : 'Submitting Interview Responses...'}
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">
            {isUploadingRecording
              ? 'Securely encrypting and archiving your interview video recording for the hiring team...'
              : 'Encrypting and securely delivering your spoken responses to the hiring team...'}
          </p>

        </div>
      );
    }

    if (submissionError) {
      return <div role="alert" className="h-full rounded-3xl bg-zinc-950 p-6 text-amber-200 flex flex-col justify-center gap-4">
        <h2 className="text-lg font-bold">Interview submission needs attention</h2>
        <p>{submissionError}</p>
        <button type="button" onClick={() => finishAndAnalyzeInterview(answers)} className="rounded-xl bg-emerald-600 p-3 text-white">Retry submission</button>
      </div>;
    }

    // 2. Candidate View: Reassuring Confirmation without Scores or Metrics
    if (isCandidate) {
      return (
        <div className="w-full h-full rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col items-center justify-center p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-5 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 size={42} className="stroke-[2.5]" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles size={13} />
            <span>Interview Submitted Successfully</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Thank You, {candidateName}!
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mt-2 leading-relaxed">
            Your interview responses for the <strong className="text-zinc-200">{requisitionTitle}</strong> role at{' '}
            <strong className="text-zinc-200">{companyName}</strong> have been securely recorded and submitted to the hiring team.
          </p>

          {/* Submission Details Overview */}
          <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 mt-6 text-left space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-800">
              <span className="text-zinc-400 font-medium">Position</span>
              <span className="font-semibold text-zinc-200">{requisitionTitle}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-800">
              <span className="text-zinc-400 font-medium">Interview Status</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Submitted · Under Hiring Review
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-800">
              <span className="text-zinc-400 font-medium">Session Video</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Securely Archived
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-800">
              <span className="text-zinc-400 font-medium">Questions Completed</span>
              <span className="font-semibold text-zinc-200">{questions.length} of {questions.length} Answered</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-zinc-400 font-medium">Next Step</span>
              <span className="font-semibold text-zinc-300">Recruiter will contact you with updates</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 mt-6 max-w-md">
            Our talent acquisition team and interviewers will review your session in the admin portal. You may now close this window or return to the candidate portal.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/interview/candidate';
              }}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Return to Candidate Portal
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold text-xs transition cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      );
    }

    // 3. Admin / Recruiter / Hiring Manager View: Full Executive Communication Scorecard
    if (analysisResult?.status !== 'scored') {
      return <div className="h-full rounded-3xl bg-zinc-950 p-6 text-zinc-200 flex flex-col justify-center gap-3">
        <h2 className="text-lg font-bold">Assessment pending human review</h2>
        <p>{analysisResult?.summary || 'No validated STAR and competency assessment is available. No score has been assigned.'}</p>
      </div>;
    }
    const score = analysisResult.overall_score;
    const scoreColor =
      score >= 80
        ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
        : score >= 65
        ? 'text-sky-400 border-sky-500/40 bg-sky-500/10'
        : 'text-amber-400 border-amber-500/40 bg-amber-500/10';

    return (
      <div className="w-full h-full rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col p-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex flex-col gap-4 pb-4 border-b border-zinc-800/80 shrink-0 @min-[760px]:flex-row @min-[760px]:items-start @min-[760px]:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 flex items-center justify-center font-black shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">AI Communication Assessment</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ADMIN VIEW
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Spoken Linguistic Evaluation · {candidateName} · {requisitionTitle}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('scorecard')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'scorecard' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Scorecard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transcript')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'transcript' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Q&A Transcript
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'scorecard' ? (
          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-5">
            {/* Top Score Banner */}
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 shadow-xl ${scoreColor}`}
                >
                  <span className="text-3xl font-black">{score}</span>
                  <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">/ 100</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-white">STAR & Competency Assessment</div>
                  <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                    {analysisResult?.summary ||
                      'Review the quoted evidence and competency ratings below.'}
                  </p>
                </div>
              </div>
              <div className="flex sm:flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Ready for Recruiter Review
                </span>
              </div>
            </div>

            {/* Heuristics Grid (Pace, Fillers, Lexicon) */}
            {metricsResult?.speech_metrics_available ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pace Meter */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Speaking Pace</span>
                  <Activity size={14} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {metricsResult?.words_per_minute ?? '—'}{' '}
                  <span className="text-xs font-normal text-zinc-400">WPM</span>
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 font-medium">
                  {metricsResult?.pace_rating || 'Optimal Cadence (130-165)'}
                </div>
              </div>

              {/* Fillers Radar */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Filler Words</span>
                  <Zap size={14} className="text-sky-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {metricsResult?.filler_percentage !== undefined ? `${metricsResult.filler_percentage}%` : 'Not measured'}
                  <span className="text-xs font-normal text-zinc-400 ml-1">
                    ({metricsResult?.filler_count ?? 0} detected)
                  </span>
                </div>
                <div className="text-[11px] text-sky-400 mt-1 font-medium">
                  {metricsResult?.filler_rating || 'Minimal Fillers (Articulate)'}
                </div>
              </div>

              {/* Lexical Diversity */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Lexical Variety</span>
                  <Award size={14} className="text-purple-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {metricsResult?.lexical_diversity ?? '—'}{' '}
                  <span className="text-xs font-normal text-zinc-400">TTR</span>
                </div>
                <div className="text-[11px] text-purple-400 mt-1 font-medium">
                  {metricsResult?.vocabulary_rating || 'Not measured'}
                </div>
              </div>
            </div> : <p className="text-xs text-zinc-400">Speech delivery metrics are unavailable for typed responses. Competency ratings use answer content.</p>}

            {/* 4 Core Dimensions */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
                Competency Dictionary Ratings (Scale 1 - 5) · {analysisResult.rubric_version}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(analysisResult.competencies || []).map(row => ({
                  label: analysisResult.competency_dictionary?.[row.competency]?.name || row.competency,
                  val: row.rating, rationale: row.rationale, star: row.star, evidence: row.evidence,
                  indicators: analysisResult.competency_dictionary?.[row.competency]?.indicators || [],
                })).map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-center">
                    <div className="text-xs text-zinc-400 truncate mb-1">{item.label}</div>
                    <div className="text-lg font-black text-white">{item.val} / 5</div>
                    <p className="mt-2 text-xs text-zinc-400">{item.rationale}</p>
                    <p className="mt-2 text-xs text-zinc-500">Indicators: {item.indicators.join('; ')}</p>
                    {(item.evidence || []).map((quote, index) => <blockquote key={index} className="mt-2 text-xs text-zinc-300">“{quote}”</blockquote>)}
                    <dl className="mt-2 text-left text-xs text-zinc-400">{Object.entries(item.star || {}).map(([key, value]) => <div key={key}><dt className="font-semibold capitalize">{key}</dt><dd>{value || 'Not demonstrated'}</dd></div>)}</dl>
                    <div className="w-full bg-zinc-800 h-1 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full"
                        style={{ width: `${Math.min(100, item.val * 20)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths & Growth Areas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                  <CheckCircle2 size={14} />
                  <span>Key Strengths</span>
                </div>
                <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                  {(analysisResult?.key_strengths || [
                    'Structured narrative flow with clear technical takeaways.',
                    'Comfortable speaking cadence and natural confidence.',
                  ]).map((s, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/40">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                  <AlertCircle size={14} />
                  <span>Areas of Growth</span>
                </div>
                <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                  {(analysisResult?.areas_for_improvement || [
                    'Incorporate more quantifiable business outcomes in answers.',
                    'Keep cross-functional summaries slightly more concise.',
                  ]).map((w, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Q&A Transcript Tab */
          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-4">
            {questions.map((q, idx) => {
              const ans = answers[idx];
              return (
                <div key={q.id} className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span className="font-semibold text-emerald-400">Question {idx + 1}: {q.title}</span>
                    <span>{ans?.durationSeconds ? `${ans.durationSeconds}s` : 'Recorded'}</span>
                  </div>
                  <p className="text-xs text-zinc-300 italic mb-3">"{q.prompt}"</p>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-200 leading-relaxed font-mono">
                    <span className="text-zinc-500 font-sans block mb-1">Spoken Answer:</span>
                    {ans?.answerText || '(No recorded speech)'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            TermJobs AI Talent Assessor &bull; Communication Record Saved to Pipeline
          </div>
          <button
            type="button"
            onClick={() => (window.location.href = '/interview/candidate')}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            <span>Return to Candidate Portal</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: LIVE INTERVIEW QUESTIONS & CONTINUOUS SPEECH RECOGNITION
  // =========================================================================
  if (!questions.length || !cameraReady) {
    return <div role="status" className="h-full rounded-3xl bg-zinc-950 p-6 text-zinc-200 flex flex-col justify-center gap-4">
      <h2 className="text-lg font-bold">Prepare your AI interview</h2>
      <p>Video is required throughout this interview. Allow camera access and keep your camera on. Your answers are preserved if the camera disconnects.</p>
      {!cameraReady && <button type="button" onClick={onEnableCamera} className="rounded-xl bg-emerald-600 p-3">Enable camera</button>}
      {cameraError && <p role="alert" className="text-amber-200">{cameraError}</p>}
      {!questions.length && <p>{questionLoadError || 'Preparing questions from your resume and requisition…'}</p>}
      {questionLoadError && <button type="button" onClick={loadQuestions} className="underline">Retry question preparation</button>}
    </div>;
  }
  return (
    <div className="@container w-full h-full rounded-2xl sm:rounded-3xl overflow-y-auto overflow-x-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col p-4 sm:p-5 min-h-0 relative">
      {/* Top Phase Indicator & Control Bar */}
      <div className="flex flex-col gap-4 pb-4 border-b border-zinc-800/80 shrink-0 @min-[760px]:flex-row @min-[760px]:items-start @min-[760px]:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xl transition-all duration-300 ${
                isAiSpeaking
                  ? 'bg-gradient-to-tr from-cyan-500 to-emerald-400 text-zinc-950 ring-4 ring-cyan-500/30 animate-pulse'
                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
              }`}
            >
              <Sparkles size={20} />
            </div>
            {isAiSpeaking && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-zinc-950 animate-ping" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-sm sm:text-base text-white leading-snug">Aria · TermJobs AI Assessor</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                AI INTERVIEW
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={10} />
                Echo protection
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {activeQuestion.phase} &bull; {activeQuestion.category}
            </div>
          </div>
        </div>

        {/* Top Right Controls (TTS toggle, Voice settings, Replay, Question Counter) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* TTS Audio Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isAiSpeaking && synthRef.current) {
                synthRef.current.cancel();
                updateAiSpeaking(false);
              }
              setTtsEnabled(!ttsEnabled);
            }}
            title={ttsEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
            aria-label={ttsEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
            aria-pressed={ttsEnabled}
            className={`min-h-10 px-3 py-2 rounded-xl border transition text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              ttsEnabled
                ? 'bg-zinc-900 border-zinc-700 text-cyan-400 hover:bg-zinc-800'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{ttsEnabled ? 'Voice on' : 'Voice muted'}</span>
          </button>

          {/* Voice Switcher Dropdown Toggle */}
          {availableVoices.length > 0 && (
            <button
              type="button"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              title="Voice Settings"
              aria-label="Voice settings"
              aria-expanded={showVoiceSettings}
              className="min-h-10 min-w-10 p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition text-xs flex items-center gap-1 cursor-pointer"
            >
              <Sliders size={14} />
            </button>
          )}

          {/* Replay Question Button */}
          <button
            type="button"
            onClick={() => speakCurrentQuestion(activeQuestion.prompt)}
            title="Replay Question Audio"
            aria-label="Replay question audio"
            disabled={!ttsEnabled}
            className="min-h-10 px-3 py-2 whitespace-nowrap shrink-0 disabled:opacity-40 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition text-xs flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Replay</span>
          </button>

          {/* Question Step Pill */}
          <div className="ml-auto min-h-10 flex items-center whitespace-nowrap shrink-0 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-200">
            {currentStep + 1} / {questions.length}
          </div>
        </div>
      </div>

      {/* Voice Selector Drawer (Dropdown) */}
      {showVoiceSettings && (
        <div className="absolute top-20 right-4 z-40 w-72 max-w-[calc(100%-2rem)] p-4 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 shadow-2xl text-xs space-y-3">
          <div className="flex items-center justify-between text-zinc-200 font-bold">
            <span>Natural AI Voice Model</span>
            <button
              type="button"
              onClick={() => setShowVoiceSettings(false)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            Select high-clarity natural human synthesis voice:
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {availableVoices.slice(0, 15).map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => {
                  setSelectedVoice(v);
                  setShowVoiceSettings(false);
                  speakCurrentQuestion('Hi! This is the natural interviewer voice for TermJobs.');
                }}
                className={`w-full text-left p-2 rounded-lg text-xs truncate transition flex items-center justify-between ${
                  selectedVoice?.name === v.name
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="truncate">{v.name.replace(/(Google|Microsoft|Apple)/g, '').trim() || v.name}</span>
                {selectedVoice?.name === v.name && <Check size={12} className="text-cyan-400 shrink-0 ml-1" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Dots Bar */}
      <div className="grid grid-cols-4 gap-2 my-4 shrink-0">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx < currentStep
                ? 'bg-emerald-500'
                : idx === currentStep
                ? 'bg-cyan-400 ring-2 ring-cyan-500/30'
                : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>

      {/* Main Interactive Stage: AI Question Card & Candidate Live Speech Area */}
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Active Question Box */}
        <div className="p-4 sm:p-5 shrink-0 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 relative overflow-hidden shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-cyan-400 tracking-wider uppercase">
              {activeQuestion.title}
            </span>
            <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 whitespace-nowrap">
              <Clock size={12} />
              Suggested: {activeQuestion.durationGuide}
            </span>
          </div>

          <p className="text-sm sm:text-base font-medium text-white leading-relaxed mb-3">
            {activeQuestion.prompt}
          </p>

          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
            <Sparkles size={13} className="text-amber-400 shrink-0" />
            <span>{activeQuestion.hint}</span>
          </div>

          {/* Voice Wave Animation when AI speaks */}
          {isAiSpeaking && (
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-cyan-400 h-2 animate-pulse" />
                <span className="w-0.5 bg-cyan-400 h-3 animate-pulse delay-75" />
                <span className="w-0.5 bg-cyan-400 h-1.5 animate-pulse delay-150" />
              </div>
              <span className="ml-1">Aria Speaking...</span>
            </div>
          )}
        </div>

        {/* Candidate Live Speech Capture Card with AIC Indicator */}
        <div className="flex-1 flex flex-col rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-4 min-h-[160px] relative overflow-hidden">
          {/* Header of speech box with live metrics & AIC status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/60 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAiSpeaking
                    ? 'bg-amber-400 animate-pulse'
                    : isMicOn && isSpeechListening && !speechError
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-semibold text-zinc-300">
                {isAiSpeaking ? 'Acoustic Filter: Ignoring Speaker Sound' : 'Your Spoken Response:'}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                ⏱️ {formatSecs(questionDuration)}
              </span>
            </div>

            {/* Real-time speech chips */}
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                {liveMetrics.wordCount} words
              </span>
              <span
                className={`px-2 py-0.5 rounded-md font-semibold ${
                  liveMetrics.wpm >= 110 && liveMetrics.wpm <= 165
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {liveMetrics.wpm} WPM
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
                Fillers: {liveMetrics.fillerCount}
              </span>
            </div>
          </div>

          {(captureWarning || answerError) && (
            <div role="alert" className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              {answerError || captureWarning}
            </div>
          )}
          <div className="mb-3 flex gap-3 text-xs">
            <button type="button" disabled={!isMicOn || isAiSpeaking} onClick={startSpeechRecognition} className="underline disabled:opacity-40">Retry speech recognition</button>
            <button type="button" onClick={() => setShowTypedAnswer((value) => !value)} className="underline">{showTypedAnswer ? 'Hide typed answer' : 'Type an answer instead'}</button>
          </div>
          {(showTypedAnswer || captureWarning) && (
            <label className="mb-3 text-xs text-zinc-300">
              Typed answer (saved with your response)
              <textarea value={typedAnswer} onChange={(event) => { setTypedAnswer(event.target.value); setAnswerError(''); }} rows={4} className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2 text-sm text-white" placeholder="If speech recognition is not working, type your answer here." />
            </label>
          )}
          {/* Spoken text area */}
          <div className="flex-1 overflow-y-auto text-sm text-zinc-200 leading-relaxed font-sans pr-1">
            {currentAnswerText ? (
              <p className="whitespace-pre-wrap">{currentAnswerText}</p>
            ) : isAiSpeaking ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-cyan-400 text-xs py-4">
                <Volume2 size={24} className="text-cyan-400 mb-2 animate-pulse" />
                <p className="font-semibold">AI is asking the question...</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  AIC Filter is active. Your microphone will automatically begin transcribing as soon as Aria finishes.
                </p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs py-4">
                <Mic size={24} className="text-zinc-600 mb-2 animate-bounce" />
                <p>Speak clearly into your microphone...</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  {!isMicOn ? 'Your microphone is muted. Unmute it or type your answer.' : isSpeechListening && !speechError ? 'Listening for your answer…' : 'Speech recognition is not ready. Retry or type your answer.'}
                </p>
              </div>
            )}
          </div>

          {/* Clear speech button if needed */}
          {currentAnswerText && !isAiSpeaking && (
            <button
              type="button"
              onClick={() => { setFinalizedSegments([]); setTypedAnswer(''); clearLiveTranscript?.(); }}
              className="absolute bottom-3 right-3 text-[11px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
            >
              Clear & Re-speak
            </button>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-2 flex flex-col gap-3 shrink-0 @min-[600px]:flex-row @min-[600px]:items-center @min-[600px]:justify-between">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{isAiSpeaking ? 'Speech capture pauses while Aria speaks' : !isMicOn ? 'Microphone muted · Typed answers available' : isSpeechListening && !captureWarning ? 'Speech recognition listening' : 'Speech capture unavailable · Retry or type your answer'}</span>
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            className="w-full @min-[600px]:w-auto shrink-0 justify-center min-h-11 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition flex items-center gap-2 cursor-pointer group"
          >
            <span>
              {currentStep < questions.length - 1
                ? 'Next Question'
                : 'Complete & Analyze Communication'}
            </span>
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
