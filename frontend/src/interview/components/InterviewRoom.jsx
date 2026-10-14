import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  MessageSquare,
  Users,
  Send,
  X,
  FileText,
  User,
  ExternalLink,
  MoreHorizontal,
  Smile,
  Paperclip,
  Radio,
  Hand,
  Settings,
  UserPlus,
  Check,
} from 'lucide-react';
import { useInterviewMedia } from '../hooks/useInterviewMedia';
import { useInterviewRoom } from '../hooks/useInterviewRoom';
import { useInterviewChat } from '../hooks/useInterviewChat';
import { EvaluationForm } from './EvaluationForm';
import { interviewApi } from '../services/interviewApi';
import termjobsLogo from '../../assets/termjobs-logo.png';

export function InterviewRoom({
  round,
  currentUserRole = 'interviewer',
  currentUserName = 'Rahul',
  onLeave,
  onEvaluationComplete,
}) {
  // Call State
  const [callDuration, setCallDuration] = useState(1980); // ~33:00 matching timer
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [postCallEvaluation, setPostCallEvaluation] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Right Sidebar State
  const [activeSideTab, setActiveSideTab] = useState('chat'); // 'chat' | 'notes' | 'feedback'
  const [chatInput, setChatInput] = useState('');
  const [notesContent, setNotesContent] = useState(
    'Candidate demonstrates good intuition for software architecture and asynchronous workflows.'
  );
  const [feedbackVerdict, setFeedbackVerdict] = useState('Hire');

  // LiveKit / WebRTC State
  const [livekitToken, setLivekitToken] = useState('');
  const [livekitUrl, setLivekitUrl] = useState('');
  const [connectionError, setConnectionError] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Media Controls Hook
  const {
    isCameraOn,
    isMicOn,
    isScreenSharing,
    localStream,
    stopMediaTracks,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
  } = useInterviewMedia();

  // Fetch Token
  useEffect(() => {
    if (!round?.id) return;
    interviewApi
      .getLiveKitToken({
        round_id: round.id,
        participant_name: currentUserName,
        participant_identity: `${currentUserRole}_${round.id.slice(0, 6)}`,
        role: currentUserRole,
      })
      .then((res) => {
        if (res?.token) {
          setLivekitToken(res.token);
          setLivekitUrl(res.url);
        }
      })
      .catch((err) => {
        setConnectionError(err.message || 'Unable to connect to the interview video service.');
      });
  }, [round?.id, currentUserName, currentUserRole]);

  // Call timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // LiveKit WebRTC lifecycle hook
  const {
    connectionState,
    remoteStream,
    disconnect,
  } = useInterviewRoom({
    roundId: round?.id,
    participantName: currentUserName,
    role: currentUserRole,
    livekitToken,
    livekitUrl,
    isAiInterview: false,
  });

  // Chat hook
  const { messages, sendMessage } = useInterviewChat({
    roundId: round?.id,
    senderName: currentUserName,
    senderRole: currentUserRole,
    isChatDrawerOpen: activeSideTab === 'chat',
    isAiInterview: false,
  });

  // Attach local video stream
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl && localStream && isCameraOn) {
      if (videoEl.srcObject !== localStream) {
        videoEl.srcObject = localStream;
      }
      videoEl.play?.().catch(() => {});
    }
  }, [localStream, isCameraOn]);

  // Attach remote video stream
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && remoteStream) {
      if (videoEl.srcObject !== remoteStream) {
        videoEl.srcObject = remoteStream;
      }
      videoEl.play?.().catch(() => {});
    }
  }, [remoteStream]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (activeSideTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeSideTab]);

  // Safe media hardware shutdown
  const shutDownAllMediaHardware = useCallback(() => {
    try {
      if (localVideoRef.current?.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });
        localVideoRef.current.srcObject = null;
      }
    } catch (_) {}

    try {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    } catch (_) {}

    stopMediaTracks();
    disconnect();
  }, [stopMediaTracks, disconnect]);

  const shutDownRef = useRef(shutDownAllMediaHardware);
  useEffect(() => {
    shutDownRef.current = shutDownAllMediaHardware;
  }, [shutDownAllMediaHardware]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shutDownRef.current?.();
    };
  }, []);

  const handleSendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput('');
  };

  const handleEndCall = () => {
    setShowExitConfirm(false);
    shutDownAllMediaHardware();
    if (currentUserRole === 'interviewer') {
      setPostCallEvaluation(true);
    } else {
      if (onLeave) onLeave();
    }
  };

  const triggerEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis((prev) => [...prev, { id, emoji, left: Math.floor(Math.random() * 60) + 20 }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  return (
    <div className="w-full h-screen h-[100dvh] bg-[#07090E] text-zinc-100 flex flex-col overflow-hidden font-sans select-none">
      {connectionError && <div role="alert" className="bg-red-950 p-3 text-sm text-red-100">{connectionError} <button className="underline" onClick={() => window.location.reload()}>Retry connection</button></div>}
      {/* ─────────────────────────────────────────────────────────────────
          TOP NAVBAR
          ───────────────────────────────────────────────────────────────── */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between z-30 bg-[#090C11] border-b border-white/[0.08] shrink-0">
        {/* Left: TermJobs Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-black border border-white/15 flex items-center justify-center p-1.5 shadow-sm">
            <img src={termjobsLogo} alt="TermJobs" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-black text-xs sm:text-sm tracking-wide text-white leading-none">TERM JOBS</div>
            <div className="text-[10px] text-zinc-400 font-medium tracking-tight mt-0.5">Interview Panel</div>
          </div>
        </div>

        {/* Center: Live Round Pill Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3.5 py-1.5 rounded-full bg-[#12151D] border border-white/10 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs sm:text-sm text-white whitespace-nowrap">
              Python Developer Interview
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[11px] font-semibold border border-white/5">
              {formatCallTime(callDuration)}
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-zinc-400 pl-1 border-l border-white/10">
            <span>Technical Round</span>
            <span>&bull;</span>
            <span>REQ #8302C0</span>
            <span>&bull;</span>
            <span>Today, 09:30 AM – 10:15 AM</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-white/5 transition cursor-pointer"
          >
            <UserPlus size={14} className="text-zinc-400" />
            <span>Invite</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPeopleModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-white/5 transition cursor-pointer"
          >
            <Users size={14} className="text-zinc-400" />
            <span>People</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-700 text-[10px] font-bold text-white">3</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSideTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              activeSideTab === 'chat'
                ? 'bg-white text-zinc-950 border-white'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border-white/5'
            }`}
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-white/5 transition cursor-pointer"
          >
            <MoreHorizontal size={15} />
          </button>

          <div className="w-[1px] h-6 bg-zinc-800 mx-1 hidden sm:block" />

          {/* End Interview Button */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm shadow-md transition active:scale-95 cursor-pointer shrink-0"
          >
            <PhoneOff size={15} className="text-zinc-950" />
            <span className="whitespace-nowrap">End Interview</span>
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          MAIN WORKSPACE LAYOUT (2 Columns: Left Main Video / Right Sidebar)
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-row p-3 gap-3 overflow-hidden">
        {/* ============================================================== */}
        {/* LEFT COLUMN: FULL VIDEO GRID + FLOATING BOTTOM TOOLBAR         */}
        {/* ============================================================== */}
        <div className="flex-1 min-w-0 h-full flex flex-col gap-3 overflow-hidden">
          {/* VIDEO GRID AREA */}
          <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
            {/* Primary Candidate Video Tile (Arjun M) */}
            <div className="flex-[1.4] h-full relative rounded-2xl overflow-hidden bg-[#0A0D14] border border-white/10 shadow-xl flex items-center justify-center">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                /* No fake image: sleek black card with profile icon when waiting */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#080B10] text-center select-none">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-white/15 flex items-center justify-center shadow-2xl ring-4 ring-white/5 mb-4">
                    <User size={44} className="text-zinc-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white tracking-tight">Arjun M</h4>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">Candidate &bull; Python Developer</p>
                  <div className="flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-white/10 text-xs text-zinc-300 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Waiting for candidate to join...</span>
                  </div>
                </div>
              )}

              {/* Top-left mic status */}
              <div className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-white shadow">
                {remoteStream ? <Mic size={14} className="text-emerald-400" /> : <MicOff size={14} className="text-zinc-500" />}
              </div>

              {/* Top-right menu */}
              <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-white/80 hover:text-white cursor-pointer transition">
                <MoreHorizontal size={14} />
              </div>

              {/* Bottom-left Candidate Tag */}
              <div className="absolute bottom-3 left-3 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow">
                  <span>Arjun M</span>
                  <span className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400/80'}`} />
                </div>
                <span className="text-[10px] text-zinc-400 px-1 font-medium">Candidate</span>
              </div>
            </div>

            {/* Right Stacked Participant Video Tiles */}
            <div className="flex-1 h-full flex flex-col gap-3 min-w-0">
              {/* Tile 1: Rahul (You) - Hiring Manager */}
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0A0D14] border border-white/10 shadow-md flex items-center justify-center">
                {isCameraOn && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                ) : (
                  /* No fake image: sleek black card with profile icon when camera is off */
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#080B10] text-center select-none">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/15 flex items-center justify-center shadow-lg ring-2 ring-white/5 mb-2.5">
                      <User size={28} className="text-zinc-400" />
                    </div>
                    <div className="text-sm font-bold text-white">Rahul (You)</div>
                    <div className="text-xs text-zinc-400 font-medium">Hiring Manager</div>
                    <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-white/5 text-[11px] text-zinc-500">
                      <VideoOff size={12} />
                      <span>Camera is off</span>
                    </div>
                  </div>
                )}

                <div className="absolute top-2.5 right-2.5 p-1 rounded-md bg-black/65 backdrop-blur-md text-white/70 hover:text-white cursor-pointer">
                  <MoreHorizontal size={13} />
                </div>

                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white">
                  <span>Rahul (You)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">&bull; Hiring Manager</span>
                </div>

                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5 px-1.5 py-1 rounded-md bg-black/60 text-emerald-400">
                  {isMicOn ? (
                    <>
                      <span className="w-1 h-2 bg-emerald-400 rounded-full" />
                      <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="w-1 h-1.5 bg-emerald-400 rounded-full" />
                    </>
                  ) : (
                    <MicOff size={12} className="text-zinc-500" />
                  )}
                </div>
              </div>

              {/* Tile 2: Sneha K - Tech Lead */}
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0A0D14] border border-white/10 shadow-md flex items-center justify-center">
                {/* No fake image: sleek black card with profile icon when not joined */}
                <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#080B10] text-center select-none">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/15 flex items-center justify-center shadow-lg ring-2 ring-white/5 mb-2.5">
                    <User size={28} className="text-zinc-400" />
                  </div>
                  <div className="text-sm font-bold text-white">Sneha K</div>
                  <div className="text-xs text-zinc-400 font-medium">Tech Lead &bull; Panelist</div>
                  <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-white/5 text-[11px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <span>Not in room</span>
                  </div>
                </div>

                <div className="absolute top-2.5 right-2.5 p-1 rounded-md bg-black/65 backdrop-blur-md text-white/70 hover:text-white cursor-pointer">
                  <MoreHorizontal size={13} />
                </div>

                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white">
                  <span>Sneha K</span>
                  <span className="text-[10px] text-zinc-400 font-normal">&bull; Tech Lead</span>
                </div>

                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5 px-1.5 py-1 rounded-md bg-black/60 text-zinc-500">
                  <MicOff size={12} />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM FLOATING CONTROL TOOLBAR */}
          <div className="h-14 shrink-0 flex items-center justify-center">
            <div className="flex items-center gap-4 sm:gap-6 px-6 py-2 rounded-full bg-[#12151D] border border-white/10 shadow-2xl backdrop-blur-xl">
              {/* Mic */}
              <button
                type="button"
                onClick={toggleMicrophone}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow ${
                    isMicOn ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Mic</span>
              </button>

              {/* Camera */}
              <button
                type="button"
                onClick={toggleCamera}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow ${
                    isCameraOn ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Camera</span>
              </button>

              {/* Screen Share */}
              <button
                type="button"
                onClick={toggleScreenShare}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow ${
                    isScreenSharing ? 'bg-emerald-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  <Monitor size={16} />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Screen Share</span>
              </button>

              {/* Record */}
              <button
                type="button"
                onClick={() => setIsRecording(!isRecording)}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow ${
                    isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  <Radio size={16} />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Record</span>
              </button>

              {/* Reactions */}
              <button
                type="button"
                onClick={() => triggerEmoji('👏')}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition shadow">
                  <Smile size={16} />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Reactions</span>
              </button>

              {/* Raise Hand */}
              <button
                type="button"
                onClick={() => setIsHandRaised(!isHandRaised)}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow ${
                    isHandRaised ? 'bg-amber-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  <Hand size={16} />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Raise Hand</span>
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="flex flex-col items-center gap-0.5 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition shadow">
                  <Settings size={16} />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-white font-medium">Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: CANDIDATE CARD + FULL HEIGHT CHAT/NOTES/FEEDBACK */}
        {/* ============================================================== */}
        <div className="w-[330px] xl:w-[360px] shrink-0 h-full flex flex-col gap-3 overflow-hidden">
          {/* CARD 1: CANDIDATE INFO */}
          <div className="p-3.5 rounded-2xl bg-[#0E1118] border border-white/10 shadow-md space-y-2.5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-zinc-850 border border-zinc-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-inner">
                AM
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white truncate">Arjun M</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    In Interview
                  </span>
                </div>
                <div className="text-xs text-zinc-400 truncate mt-0.5">
                  Python Developer &bull; REQ #8302C0
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="px-2 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-white/5 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <User size={13} className="text-zinc-400" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResumeModal(true)}
                className="px-2 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-white/5 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <FileText size={13} className="text-zinc-400" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={() => window.open('https://github.com', '_blank')}
                className="px-2 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-white/5 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <ExternalLink size={13} className="text-zinc-400" />
                <span>Portfolio</span>
              </button>
            </div>
          </div>

          {/* CARD 2: CHAT / NOTES / FEEDBACK TABS (Fills remaining height) */}
          <div className="flex-1 min-h-0 p-3.5 rounded-2xl bg-[#0E1118] border border-white/10 shadow-md flex flex-col justify-between overflow-hidden">
            {/* Header Tabs */}
            <div className="flex items-center gap-2 p-1 bg-zinc-950 rounded-xl border border-white/5 text-xs font-bold text-zinc-400 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSideTab('chat')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  activeSideTab === 'chat' ? 'bg-zinc-800 text-white shadow-xs' : 'hover:text-zinc-200'
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('notes')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  activeSideTab === 'notes' ? 'bg-zinc-800 text-white shadow-xs' : 'hover:text-zinc-200'
                }`}
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('feedback')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  activeSideTab === 'feedback' ? 'bg-zinc-800 text-white shadow-xs' : 'hover:text-zinc-200'
                }`}
              >
                Feedback
              </button>
            </div>

            {/* Tab 1: Chat Feed */}
            {activeSideTab === 'chat' && (
              <div className="flex-1 flex flex-col justify-between min-h-0 pt-2.5">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs custom-scroll">
                  {/* Seed / Default Messages */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-zinc-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      RA
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="font-bold text-zinc-200">Rahul</span>
                        <span>10:02 AM</span>
                      </div>
                      <div className="text-zinc-300 text-xs">Welcome to the interview session, Arjun!</div>
                    </div>
                  </div>

                  {messages.map((m, idx) => (
                    <div key={m.id || idx} className="flex items-start gap-2.5 animate-in fade-in">
                      <div className="w-6 h-6 rounded-full bg-white text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(m.sender_name || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <span className="font-bold text-zinc-200">{m.sender_name || 'Participant'}</span>
                          <span>{m.sender_role}</span>
                        </div>
                        <div className="text-zinc-200 text-xs">{m.message}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendChat} className="pt-2.5 flex items-center gap-1.5">
                  <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => triggerEmoji('👍')}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <Smile size={14} />
                    </button>
                    <button
                      type="button"
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <Paperclip size={14} />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold transition disabled:opacity-40 cursor-pointer shadow"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}

            {/* Tab 2: Notes */}
            {activeSideTab === 'notes' && (
              <div className="flex-1 flex flex-col justify-between pt-2.5 min-h-0">
                <textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Private interviewer notes..."
                  className="flex-1 w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed custom-scroll"
                />
                <div className="text-[10px] text-emerald-400 pt-2 flex items-center gap-1 font-medium">
                  <Check size={11} />
                  <span>Notes auto-saved to interview record</span>
                </div>
              </div>
            )}

            {/* Tab 3: Feedback */}
            {activeSideTab === 'feedback' && (
              <div className="flex-1 flex flex-col justify-between pt-2.5 text-xs space-y-3 min-h-0">
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-zinc-300">Recommendation Verdict:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Strong Hire', 'Hire', 'Re-evaluate', 'Reject'].map((verdict) => (
                      <button
                        key={verdict}
                        type="button"
                        onClick={() => setFeedbackVerdict(verdict)}
                        className={`p-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                          feedbackVerdict === verdict
                            ? verdict === 'Reject'
                              ? 'bg-rose-500/20 border border-rose-500 text-rose-300'
                              : 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                            : 'bg-zinc-950 border border-white/10 text-zinc-400 hover:bg-zinc-850'
                        }`}
                      >
                        {verdict}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-white/5 space-y-1.5 text-zinc-400 text-xs">
                  <div className="text-zinc-200 font-semibold">Post-Interview Evaluation</div>
                  <p className="text-[11px] leading-relaxed">
                    Submit formal competency scorecard and candidate scoring after the call completes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPostCallEvaluation(true)}
                  className="w-full py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition cursor-pointer shadow"
                >
                  Open Scorecard Form
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Animated Emojis */}
      {floatingEmojis.map((item) => (
        <div
          key={item.id}
          style={{ left: `${item.left}%` }}
          className="fixed bottom-24 z-50 text-3xl pointer-events-none animate-bounce"
        >
          {item.emoji}
        </div>
      ))}

      {/* ─────────────────────────────────────────────────────────────────
          MODALS & DIALOGS
          ───────────────────────────────────────────────────────────────── */}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#12151E] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <PhoneOff size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">End Interview Session?</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-6">
              Camera and audio will disconnect immediately. You will be redirected to the evaluation summary.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                Stay in Call
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-lg"
              >
                End Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Call Evaluation Modal */}
      {postCallEvaluation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="max-w-3xl w-full my-8">
            <EvaluationForm
              round={round}
              defaultEvaluator={currentUserName}
              onSuccess={(updated) => {
                if (onEvaluationComplete) onEvaluationComplete(updated);
                if (onLeave) onLeave();
              }}
              onCancel={() => {
                if (onLeave) onLeave();
              }}
            />
          </div>
        </div>
      )}

      {/* Candidate Resume Modal */}
      {showResumeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowResumeModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#12151E] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-white" />
                <h3 className="text-base font-bold text-white">Resume &bull; Arjun M</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed">
              {`CANDIDATE: Arjun M
ROLE: Python Developer
LOCATION: Bangalore, India
EXPERIENCE: 3 Years

PROFESSIONAL SUMMARY:
Backend developer proficient in Python, FastAPI, Django, and scalable cloud systems. Experienced in asynchronous event pipelines, SQL optimization, and clean microservices.

TECHNICAL SKILLS:
- Languages: Python, JavaScript, SQL
- Frameworks: FastAPI, Django, React
- Storage: PostgreSQL, Redis, MongoDB
- Cloud: AWS, Docker, Git, CI/CD`}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile Modal */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#12151E] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Candidate Details</h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex justify-between pb-2 border-b border-white/5">
                <span className="text-zinc-500">Candidate</span>
                <span className="font-bold text-white">Arjun M</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/5">
                <span className="text-zinc-500">Target Role</span>
                <span className="font-bold text-white">Python Developer</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/5">
                <span className="text-zinc-500">Requisition</span>
                <span className="font-mono text-zinc-200">REQ #8302C0</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/5">
                <span className="text-zinc-500">Screening Score</span>
                <span className="font-bold text-emerald-400">92 / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="font-bold text-white">Round 2 &bull; Technical Interview</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* People / Participants Modal */}
      {showPeopleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowPeopleModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#12151E] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Users size={16} />
                <span>Participants (3)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPeopleModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Arjun M</div>
                  <div className="text-[10px] text-zinc-400">Candidate</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Active
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Rahul (You)</div>
                  <div className="text-[10px] text-zinc-400">Hiring Manager &bull; Host</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Host
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Sneha K</div>
                  <div className="text-[10px] text-zinc-400">Tech Lead &bull; Panelist</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 text-[10px] font-bold">
                  Panelist
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#12151E] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <UserPlus size={16} />
                <span>Invite to Interview</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-zinc-400">
                Share this secure interview link with panel co-interviewers or candidates.
              </p>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-white/10 font-mono text-[11px] text-zinc-300">
                <span className="truncate flex-1">{window.location.href}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#12151E] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Settings size={16} />
                <span>Meeting Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-300">
              <div>
                <label className="text-zinc-400 block mb-1">Microphone</label>
                <select className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2 text-white text-xs">
                  <option>Default - Integrated Microphone</option>
                </select>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Camera</label>
                <select className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2 text-white text-xs">
                  <option>Default - Integrated Webcam (HD)</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-1.5 bg-white text-zinc-950 font-bold rounded-xl text-xs hover:bg-zinc-200 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
