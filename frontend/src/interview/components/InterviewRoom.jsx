import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  MessageSquare,
  Users,
  Award,
  Send,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useInterviewMedia } from '../hooks/useInterviewMedia';
import { useInterviewRoom } from '../hooks/useInterviewRoom';
import { useInterviewChat } from '../hooks/useInterviewChat';
import { EvaluationForm } from './EvaluationForm';
import { interviewApi } from '../services/interviewApi';

export function InterviewRoom({
  round,
  currentUserRole = 'candidate', // 'candidate' | 'interviewer'
  currentUserName = 'Participant',
  onLeave,
  onEvaluationComplete,
}) {
  const [activeTab, setActiveTab] = useState(null); // 'chat' | 'participants' | 'evaluation' | null
  const [livekitToken, setLivekitToken] = useState('');
  const [livekitUrl, setLivekitUrl] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [postCallEvaluation, setPostCallEvaluation] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Fetch LiveKit access token on mount
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
        if (res && res.token) {
          setLivekitToken(res.token);
          setLivekitUrl(res.url);
        }
      })
      .catch((err) => {
        console.warn('Could not retrieve livekit token, using in-browser media preview:', err);
      });

    // Mark round In Progress if not already completed
    if (round.status === 'Scheduled') {
      interviewApi.updateRoundStatus(round.id, 'In Progress').catch(() => {});
    }
  }, [round?.id, currentUserName, currentUserRole, round?.status]);

  // Call duration counter
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

  // Media hooks
  const {
    isCameraOn,
    isMicOn,
    isScreenSharing,
    localStream,
    screenStream,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
  } = useInterviewMedia();

  // Room lifecycle hook
  const {
    connectionState,
    participants,
    remoteStream,
    remoteScreenStream,
    isRemoteScreenSharing,
    disconnect,
  } = useInterviewRoom({
    roundId: round?.id,
    participantName: currentUserName,
    role: currentUserRole,
    livekitToken,
    livekitUrl,
  });

  // Chat hook
  const { messages, unreadCount, sendMessage } = useInterviewChat({
    roundId: round?.id,
    senderName: currentUserName,
    senderRole: currentUserRole,
    isChatDrawerOpen: activeTab === 'chat',
  });

  const hasActiveScreenShare = isScreenSharing || isRemoteScreenSharing;
  const remoteParticipantName =
    currentUserRole === 'candidate'
      ? round?.interviewer_name || 'Interviewer'
      : round?.candidate_name || 'Candidate';
  const remoteParticipantRole =
    currentUserRole === 'candidate'
      ? round?.interviewer_role || 'Interviewer'
      : 'Candidate';

  // Attach local stream (local camera face)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOn, hasActiveScreenShare]);

  // Attach remote stream (remote peer camera face)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, hasActiveScreenShare]);

  // Attach screen share stream (either local screen capture or incoming remote screen track)
  useEffect(() => {
    if (screenVideoRef.current) {
      if (isScreenSharing && screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      } else if (isRemoteScreenSharing && remoteScreenStream) {
        screenVideoRef.current.srcObject = remoteScreenStream;
      }
    }
  }, [screenStream, remoteScreenStream, isScreenSharing, isRemoteScreenSharing, hasActiveScreenShare]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput('');
  };

  const handleEndCall = () => {
    disconnect();
    if (currentUserRole === 'interviewer') {
      setPostCallEvaluation(true);
    } else {
      if (onLeave) onLeave();
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#0A0A0A] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* Top Floating Control Bar */}
      <header className="h-16 px-6 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white text-zinc-950 font-black text-xs flex items-center justify-center tracking-tighter">
            TJ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-zinc-100">{round?.round_name || 'Interview Session'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              {round?.requisition_title || 'Position'} · Candidate: <span className="text-zinc-200">{round?.candidate_name}</span>
            </div>
          </div>
        </div>

        {/* Timer & Connection Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs font-mono font-medium text-zinc-300">
            <Clock size={13} className="text-zinc-400" />
            <span>{formatCallTime(callDuration)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Encrypted Room</span>
          </div>
        </div>
      </header>

      {/* Main Video & Stage Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 overflow-hidden">
        {hasActiveScreenShare ? (
          /* ============================================================ */
          /* SCREEN SHARE MODE: BIG MAIN STAGE (~75%) + SIDEBAR CAMERAS   */
          /* ============================================================ */
          <div className="w-full h-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 min-h-0">
            {/* BIG PRESENTATION STAGE */}
            <div className="flex-1 relative rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-2xl min-h-0">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />

              {/* Stage Top Badge */}
              <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-xs font-semibold text-white border border-white/10 flex items-center gap-2.5 shadow-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Monitor size={15} className="text-emerald-400" />
                <span>
                  {isScreenSharing
                    ? 'You are sharing your screen'
                    : `${remoteParticipantName} is sharing screen`}
                </span>
              </div>

              {/* Quick Stop Sharing Button (for local presenter) */}
              {isScreenSharing && (
                <div className="absolute bottom-4 right-4">
                  <button
                    type="button"
                    onClick={toggleScreenShare}
                    className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <X size={14} />
                    <span>Stop Sharing</span>
                  </button>
                </div>
              )}
            </div>

            {/* SIDEBAR CAMERAS: BOTH FACES ARE VISIBLE ON THE SIDE! */}
            <div className="w-full lg:w-72 xl:w-80 flex flex-row lg:flex-col gap-3 shrink-0 h-44 sm:h-52 lg:h-full justify-start overflow-x-auto lg:overflow-y-auto">
              {/* Local Participant Face Tile */}
              <div className="relative flex-1 lg:flex-none lg:h-1/2 rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800/90 flex items-center justify-center shadow-lg group shrink-0 min-w-[200px]">
                {isCameraOn ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 text-white font-black text-lg flex items-center justify-center shadow border border-zinc-600 mb-2">
                      {(currentUserName || 'Me').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="font-semibold text-xs text-zinc-200">{currentUserName} (You)</div>
                    <div className="text-[10px] text-zinc-500 capitalize">{currentUserRole}</div>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white flex items-center gap-1.5">
                  <span>{currentUserName} (You)</span>
                  {isScreenSharing && (
                    <span className="text-[9px] px-1 py-0.2 bg-emerald-500/30 text-emerald-300 rounded font-semibold">
                      Presenter
                    </span>
                  )}
                  {!isMicOn && <MicOff size={11} className="text-rose-400" />}
                </div>
              </div>

              {/* Remote Participant Face Tile */}
              <div className="relative flex-1 lg:flex-none lg:h-1/2 rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800/90 flex items-center justify-center shadow-lg shrink-0 min-w-[200px]">
                {remoteStream || (participants.length > 0 && participants[0].videoTrack) ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 text-white font-black text-lg flex items-center justify-center shadow border border-zinc-600 mb-2 relative">
                      {remoteParticipantName.slice(0, 2).toUpperCase()}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900" />
                    </div>
                    <div className="font-semibold text-xs text-zinc-200">{remoteParticipantName}</div>
                    <div className="text-[10px] text-zinc-500 capitalize">{remoteParticipantRole}</div>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white flex items-center gap-1.5">
                  <span>{remoteParticipantName}</span>
                  {isRemoteScreenSharing && (
                    <span className="text-[9px] px-1 py-0.2 bg-emerald-500/30 text-emerald-300 rounded font-semibold">
                      Presenter
                    </span>
                  )}
                  <span className="text-[9px] px-1 py-0.2 bg-zinc-800 rounded text-zinc-400 capitalize">
                    {remoteParticipantRole}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* NORMAL 2-PARTICIPANT GRID (Local & Remote camera side-by-side)*/
          /* ============================================================ */
          <div className="w-full h-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Participant Tile */}
            <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800/80 flex items-center justify-center shadow-lg group">
              {isCameraOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 text-white font-black text-2xl flex items-center justify-center shadow-inner border border-zinc-600 mb-3">
                    {(currentUserName || 'Me').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="font-semibold text-sm text-zinc-200">{currentUserName} (You)</div>
                  <div className="text-xs text-zinc-500 mt-0.5 capitalize">{currentUserRole}</div>
                </div>
              )}

              {/* Local Badge & Mic Status */}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white flex items-center gap-2">
                <span>{currentUserName} (You)</span>
                {!isMicOn && <MicOff size={13} className="text-rose-400" />}
              </div>
            </div>

            {/* Remote Participant Tile */}
            <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800/80 flex items-center justify-center shadow-lg">
              {remoteStream || (participants.length > 0 && participants[0].videoTrack) ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 text-white font-black text-2xl flex items-center justify-center shadow-inner border border-zinc-600 mb-3 relative">
                    {remoteParticipantName.slice(0, 2).toUpperCase()}
                    <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-900" />
                  </div>
                  <div className="font-semibold text-sm text-zinc-200">
                    {remoteParticipantName}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {remoteParticipantRole}
                  </div>
                  <div className="mt-3 px-3 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-[11px] text-zinc-400">
                    Connected · Ready for stream
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white flex items-center gap-2">
                <span>{remoteParticipantName}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 rounded-md text-zinc-300 capitalize">
                  {remoteParticipantRole}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sliding Right Drawer for Chat / Participants / Evaluation */}
        {activeTab && (
          <aside className="absolute top-4 right-4 bottom-4 w-80 sm:w-96 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white capitalize">
                  {activeTab === 'chat'
                    ? 'In-Meeting Chat'
                    : activeTab === 'participants'
                    ? 'Participants'
                    : 'Candidate Evaluation'}
                </span>
                {activeTab === 'chat' && (
                  <span className="text-xs text-zinc-400">({messages.length})</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full justify-between gap-4">
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs">
                        <MessageSquare size={28} className="mb-2 opacity-50" />
                        Messages sent here are visible to all participants in this interview.
                      </div>
                    ) : (
                      messages.map((m, idx) => {
                        const isMe = m.sender_name === currentUserName || m.sender_role === currentUserRole;
                        const timeStr = m.created_at
                          ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '';
                        return (
                          <div
                            key={m.id || idx}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1">
                              <span className="font-semibold text-zinc-300">
                                {isMe ? `${m.sender_name} (You)` : m.sender_name}
                              </span>
                              <span>·</span>
                              <span className="capitalize">{m.sender_role}</span>
                              {timeStr && (
                                <>
                                  <span>·</span>
                                  <span>{timeStr}</span>
                                </>
                              )}
                              {m.pending && (
                                <>
                                  <span>·</span>
                                  <span className="text-zinc-500 italic">Sending...</span>
                                </>
                              )}
                            </div>
                            <div
                              className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                                isMe
                                  ? 'bg-white text-zinc-950 font-medium rounded-tr-xs shadow'
                                  : 'bg-zinc-800 text-zinc-100 rounded-tl-xs shadow'
                              } ${m.pending ? 'opacity-70' : ''}`}
                            >
                              {m.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Send a message to everyone..."
                      className="flex-1 px-3.5 py-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2.5 rounded-xl bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition disabled:opacity-40 cursor-pointer"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'participants' && (
                <div className="space-y-3">
                  {/* Current User */}
                  <div className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white text-zinc-950 font-bold text-xs flex items-center justify-center">
                        {currentUserName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{currentUserName} (You)</div>
                        <div className="text-[11px] text-zinc-400 capitalize">{currentUserRole}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      {isMicOn ? <Mic size={14} className="text-emerald-400" /> : <MicOff size={14} className="text-rose-400" />}
                      {isCameraOn ? <Video size={14} /> : <VideoOff size={14} className="text-rose-400" />}
                    </div>
                  </div>

                  {/* Other Participant */}
                  <div className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 text-white font-bold text-xs flex items-center justify-center">
                        {(currentUserRole === 'candidate' ? round?.interviewer_name || 'Interviewer' : round?.candidate_name || 'Candidate').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {currentUserRole === 'candidate' ? round?.interviewer_name || 'Interviewer' : round?.candidate_name || 'Candidate'}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {currentUserRole === 'candidate' ? round?.interviewer_role || 'Interviewer' : 'Candidate'}
                        </div>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                </div>
              )}

              {activeTab === 'evaluation' && currentUserRole === 'interviewer' && (
                <div className="text-zinc-900">
                  <EvaluationForm
                    round={round}
                    defaultEvaluator={currentUserName}
                    onSuccess={(updated) => {
                      if (onEvaluationComplete) onEvaluationComplete(updated);
                      setActiveTab(null);
                    }}
                    onCancel={() => setActiveTab(null)}
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Bottom Dock Control Bar */}
      <footer className="h-20 px-4 flex items-center justify-center z-20 pb-2">
        <div className="px-4 py-2.5 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/90 rounded-full flex items-center gap-3 shadow-2xl">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={toggleMicrophone}
            title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              isMicOn
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
            }`}
          >
            {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            onClick={toggleCamera}
            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              isCameraOn
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
            }`}
          >
            {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>

          {/* Screen Share Toggle */}
          <button
            type="button"
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              isScreenSharing
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            <Monitor size={18} />
          </button>

          <div className="w-[1px] h-6 bg-zinc-700 mx-1" />

          {/* Chat Drawer Toggle */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            title="Meeting Chat"
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            <MessageSquare size={18} />
            {unreadCount > 0 && activeTab !== 'chat' && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse shadow-md">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Participants Toggle */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
            title="View Participants"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
              activeTab === 'participants'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            <Users size={18} />
          </button>

          {/* Interviewer Evaluation Trigger (Interviewer Only) */}
          {currentUserRole === 'interviewer' && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'evaluation' ? null : 'evaluation')}
              title="Evaluate Candidate"
              className={`px-4 h-11 rounded-full flex items-center gap-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'evaluation'
                  ? 'bg-amber-500 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400'
              }`}
            >
              <Award size={16} />
              <span className="hidden sm:inline">Evaluation</span>
            </button>
          )}

          <div className="w-[1px] h-6 bg-zinc-700 mx-1" />

          {/* End Call Button */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            title="Leave Meeting"
            className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-lg cursor-pointer"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </footer>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <PhoneOff size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">Leave Interview Room?</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-6">
              Are you sure you want to disconnect? You can rejoin while this round is active.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
              >
                Stay in Call
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Call Evaluation Modal for Interviewer */}
      {postCallEvaluation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="max-w-2xl w-full my-8">
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
    </div>
  );
}
