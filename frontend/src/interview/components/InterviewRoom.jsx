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
  MoreHorizontal,
  Smile,
  Hand,
  Settings,
  UserPlus,
  Check,
  Copy,
  Info,
  ShieldCheck,
  Volume2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useInterviewMedia } from '../hooks/useInterviewMedia';
import { useInterviewRoom } from '../hooks/useInterviewRoom';
import { useInterviewChat } from '../hooks/useInterviewChat';
import { EvaluationForm } from './EvaluationForm';
import { interviewApi } from '../services/interviewApi';
import { useAuth } from '../../context/AuthContext';
import termjobsLogo from '../../assets/termjobs-logo.png';

function RemoteParticipantTile({ peer, isInterviewer, round, fallbackStream }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const stream = peer?.stream || fallbackStream;
  const [, setTrackVersion] = useState(0);

  // Monitor tracks to re-evaluate video/audio state dynamically
  useEffect(() => {
    if (!stream) return;
    const update = () => setTrackVersion((v) => v + 1);
    stream.addEventListener('addtrack', update);
    stream.addEventListener('removetrack', update);
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.addEventListener('mute', update);
      track.addEventListener('unmute', update);
      track.addEventListener('ended', update);
    });
    return () => {
      stream.removeEventListener('addtrack', update);
      stream.removeEventListener('removetrack', update);
      videoTracks.forEach((track) => {
        track.removeEventListener('mute', update);
        track.removeEventListener('unmute', update);
        track.removeEventListener('ended', update);
      });
    };
  }, [stream]);

  // Attach stream to video element
  const setVideoNode = useCallback(
    (node) => {
      videoRef.current = node;
      if (node && stream) {
        if (node.srcObject !== stream) {
          node.srcObject = stream;
        }
        node.play?.().catch(() => {});
      }
    },
    [stream]
  );

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play?.().catch(() => {});
    }
  }, [stream]);

  // Attach stream to audio element so remote voice is always heard even if video is off
  const setAudioNode = useCallback(
    (node) => {
      audioRef.current = node;
      if (node && stream) {
        if (node.srcObject !== stream) {
          node.srcObject = stream;
        }
        node.play?.().catch(() => {});
      }
    },
    [stream]
  );

  useEffect(() => {
    const aEl = audioRef.current;
    if (aEl && stream) {
      if (aEl.srcObject !== stream) {
        aEl.srcObject = stream;
      }
      aEl.play?.().catch(() => {});
    }
  }, [stream]);

  const hasVideo = Boolean(
    stream &&
    stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')
  );
  const hasAudio = Boolean(
    stream &&
    stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live')
  );

  // Determine role & name accurately
  const peerRawRole = (peer?.role || '').toLowerCase();
  const peerIsCandidate =
    peerRawRole === 'candidate' ||
    (peer?.name && round?.candidate_name && peer.name.toLowerCase() === round.candidate_name.toLowerCase());
  const peerIsHM =
    peerRawRole === 'hiring manager' ||
    peerRawRole === 'hm' ||
    (peer?.name && (peer.name.toLowerCase().includes('hiring manager') || peer.name.toLowerCase().includes('hm')));
  const peerIsStaff =
    peerRawRole === 'interviewer' ||
    peerRawRole === 'admin' ||
    peerRawRole === 'hr' ||
    peerRawRole === 'director' ||
    peerRawRole === 'recruiter';

  let roleLabel = 'Participant';
  if (peerIsHM) {
    roleLabel = 'Hiring Manager';
  } else if (peerIsCandidate) {
    roleLabel = 'Candidate';
  } else if (peerIsStaff) {
    if (peerRawRole === 'interviewer') roleLabel = 'Interviewer';
    else if (peer?.role) roleLabel = peer.role;
    else roleLabel = 'Interviewer';
  } else {
    roleLabel = isInterviewer ? 'Candidate' : (round?.interviewer_role || 'Interviewer');
  }

  let displayName = peer?.name;
  if (!displayName || displayName === 'Interviewer' || displayName === 'Candidate') {
    if (roleLabel === 'Candidate') {
      displayName = round?.candidate_name || 'Candidate';
    } else if (roleLabel === 'Hiring Manager') {
      displayName = round?.interviewer_role === 'Hiring Manager' ? (round?.interviewer_name || 'Hiring Manager') : 'Hiring Manager';
    } else {
      displayName = round?.interviewer_name || 'Interviewer';
    }
  }

  let roleDescription = '';
  if (roleLabel === 'Candidate') {
    roleDescription = round?.requisition_title || 'Candidate';
  } else if (roleLabel === 'Hiring Manager') {
    roleDescription = 'Hiring Manager';
  } else {
    roleDescription = round?.interviewer_role || 'Interviewer';
  }

  const initials =
    (displayName || 'P')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'P';

  return (
    <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#11141D] border border-white/[0.08] shadow-2xl flex items-center justify-center group min-h-[220px]">
      {/* Background audio element for remote participant audio */}
      {stream && (
        <audio ref={setAudioNode} autoPlay playsInline />
      )}

      {hasVideo ? (
        <video ref={setVideoNode} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        /* Camera Off Fallback */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#141824] to-[#0D1018] text-center select-none relative overflow-hidden">
          <div className="absolute w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

          <div className="relative mb-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-white/15 flex items-center justify-center shadow-2xl text-white text-2xl sm:text-3xl font-black">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#141824] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {displayName}
          </h3>
          <p className="text-xs text-zinc-400 font-medium mt-0.5">
            {roleDescription} &bull; {roleLabel}
          </p>

          <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs text-zinc-400">
            <VideoOff size={13} className="text-rose-400" />
            <span>Camera is off</span>
          </div>
        </div>
      )}

      {/* Top-left: Mic Status Indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white shadow text-xs">
        {hasAudio || stream ? (
          <>
            <Mic size={13} className="text-emerald-400" />
            <span className="text-[10.5px] font-medium text-zinc-300">Connected</span>
          </>
        ) : (
          <>
            <MicOff size={13} className="text-zinc-500" />
            <span className="text-[10.5px] font-medium text-zinc-400">Connected</span>
          </>
        )}
      </div>

      {/* Bottom-left: Participant Label Pill */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow">
        <span>{displayName}</span>
        <span className="text-[10.5px] text-zinc-400 font-normal">&bull; {roleLabel}</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </div>
  );
}

export function InterviewRoom({
  round,
  currentUserRole = 'interviewer',
  currentUserName = 'Rahul',
  onLeave,
  onEvaluationComplete,
}) {
  // Call State - Elapsed time timer
  const [callDuration, setCallDuration] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [postCallEvaluation, setPostCallEvaluation] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Right Sidebar State (Collapsible)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState('chat'); // 'chat' | 'details' | 'notes' | 'feedback'
  const [chatInput, setChatInput] = useState('');
  const [notesContent, setNotesContent] = useState(round?.internal_notes || '');
  const [feedbackVerdict, setFeedbackVerdict] = useState('Hire');

  // LiveKit / WebRTC State
  const [livekitToken, setLivekitToken] = useState('');
  const [livekitUrl, setLivekitUrl] = useState('');

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
    enableCamera,
    toggleMicrophone,
    toggleScreenShare,
  } = useInterviewMedia();

  // Fetch LiveKit Token or graceful WebRTC Direct fallback
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
          setLivekitUrl(res.url || '');
        }
      })
      .catch((err) => {
        console.warn('LiveKit SFU not configured, switching to direct WebRTC mode:', err);
        setLivekitToken(`webrtc_direct_${round.id}`);
        setLivekitUrl('');
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

  // Real Dynamic Metadata derived from actual round and user props
  const isInterviewer = currentUserRole === 'interviewer' || currentUserRole === 'Hiring Manager';

  // Role Display: check authenticated user role first (e.g. "Hiring Manager" for Arjun)
  const { user } = useAuth() || {};
  let activeUser = user;
  if (!activeUser) {
    try {
      const saved = localStorage.getItem('auth_user');
      if (saved) activeUser = JSON.parse(saved);
    } catch {}
  }
  const loggedInRole = activeUser?.role;
  const myRole = isInterviewer
    ? (loggedInRole || round?.interviewer_role || 'Hiring Manager')
    : 'Candidate';

  const myName =
    (currentUserName && currentUserName !== 'Interviewer' && currentUserName !== 'Candidate')
      ? currentUserName
      : (isInterviewer
        ? (activeUser?.name || round?.interviewer_name || 'Interviewer')
        : round?.candidate_name || 'Candidate');
  const myInitials =
    (myName || 'U')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  // LiveKit WebRTC lifecycle hook
  const {
    participants,
    remoteStream,
    disconnect,
  } = useInterviewRoom({
    roundId: round?.id,
    participantName: myName,
    role: myRole || currentUserRole,
    livekitToken,
    livekitUrl,
    isAiInterview: false,
  });

  // Chat hook
  const { messages, sendMessage } = useInterviewChat({
    roundId: round?.id,
    senderName: myName,
    senderRole: myRole || currentUserRole,
    isChatDrawerOpen: isSidebarOpen && activeSideTab === 'chat',
    isAiInterview: false,
  });

  // Attach local video stream via callback ref and effect
  const setLocalVideo = useCallback(
    (node) => {
      localVideoRef.current = node;
      if (node && localStream) {
        if (node.srcObject !== localStream) {
          node.srcObject = localStream;
        }
        node.play?.().catch(() => {});
      }
    },
    [localStream]
  );

  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl) {
      if (localStream && isCameraOn) {
        if (videoEl.srcObject !== localStream) {
          videoEl.srcObject = localStream;
        }
        videoEl.play?.().catch(() => {});
      } else {
        if (videoEl.srcObject) {
          try {
            videoEl.srcObject.getVideoTracks?.()?.forEach((track) => {
              track.enabled = false;
              track.stop();
            });
          } catch (_) {}
          videoEl.srcObject = null;
        }
      }
    }
  }, [localStream, isCameraOn]);

  // Attach remote video stream via callback ref and effect
  const setRemoteVideo = useCallback(
    (node) => {
      remoteVideoRef.current = node;
      if (node && remoteStream) {
        if (node.srcObject !== remoteStream) {
          node.srcObject = remoteStream;
        }
        node.play?.().catch(() => {});
      }
    },
    [remoteStream]
  );

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
    if (isSidebarOpen && activeSideTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeSideTab, isSidebarOpen]);

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
    setShowEmojiPicker(false);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Dynamic remote participant detection & deduplication (prevents duplicate tiles on reload or multiple tabs)
  const uniqueParticipants = [];
  const seenKeys = new Set();
  for (const p of participants || []) {
    const pName = (p.name || '').trim().toLowerCase();
    const pRole = (p.role || '').trim().toLowerCase();
    const isLocal = (pName && myName && pName === myName.trim().toLowerCase()) &&
      (!pRole || !myRole || pRole === myRole.trim().toLowerCase());
    if (isLocal) continue;

    // A candidate is always unique in an interview room; staff are unique by name
    const dedupKey = pRole === 'candidate' ? 'candidate_slot' : (pName ? `${pName}_${pRole}` : p.identity);
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      uniqueParticipants.push(p);
    }
  }

  const effectiveParticipants = uniqueParticipants.length > 0
    ? uniqueParticipants
    : (remoteStream ? [{
        identity: 'remote_peer_default',
        name: isInterviewer ? round?.candidate_name : round?.interviewer_name,
        role: isInterviewer ? 'candidate' : (round?.interviewer_role || 'interviewer'),
        stream: remoteStream,
      }] : []);

  const totalPeopleCount = effectiveParticipants.length + 1;
  const hasRemoteParticipant = effectiveParticipants.length > 0;
  const primaryRemotePeer = effectiveParticipants[0] || null;

  // Accurately determine the primary remote peer's role and label (for sidebar fallback)
  const peerRawRole = (primaryRemotePeer?.role || '').toLowerCase();
  const peerIsCandidate =
    peerRawRole === 'candidate' ||
    (primaryRemotePeer?.name && round?.candidate_name && primaryRemotePeer.name.toLowerCase() === round.candidate_name.toLowerCase());
  const peerIsHM =
    peerRawRole === 'hiring manager' ||
    peerRawRole === 'hm' ||
    (primaryRemotePeer?.name && (primaryRemotePeer.name.toLowerCase().includes('hiring manager') || primaryRemotePeer.name.toLowerCase().includes('hm')));
  const peerIsStaff =
    peerRawRole === 'interviewer' ||
    peerRawRole === 'admin' ||
    peerRawRole === 'hr' ||
    peerRawRole === 'director' ||
    peerRawRole === 'recruiter';

  let otherPersonRoleLabel = 'Participant';
  if (peerIsHM) {
    otherPersonRoleLabel = 'Hiring Manager';
  } else if (peerIsCandidate) {
    otherPersonRoleLabel = 'Candidate';
  } else if (peerIsStaff) {
    if (peerRawRole === 'interviewer') otherPersonRoleLabel = 'Interviewer';
    else if (primaryRemotePeer?.role) otherPersonRoleLabel = primaryRemotePeer.role;
    else otherPersonRoleLabel = 'Interviewer';
  } else {
    otherPersonRoleLabel = isInterviewer ? 'Candidate' : (round?.interviewer_role || 'Interviewer');
  }

  let otherPersonName = primaryRemotePeer?.name;
  if (!otherPersonName || otherPersonName === 'Interviewer' || otherPersonName === 'Candidate') {
    if (otherPersonRoleLabel === 'Candidate') {
      otherPersonName = round?.candidate_name || 'Candidate';
    } else if (otherPersonRoleLabel === 'Hiring Manager') {
      otherPersonName = round?.interviewer_role === 'Hiring Manager' ? (round?.interviewer_name || 'Hiring Manager') : 'Hiring Manager';
    } else {
      otherPersonName = round?.interviewer_name || 'Interviewer';
    }
  }

  let otherPersonRole = round?.requisition_title || 'Candidate';
  if (otherPersonRoleLabel !== 'Candidate') {
    otherPersonRole = round?.interviewer_role || otherPersonRoleLabel;
  }

  const otherPersonInitials =
    (otherPersonName || 'C')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'C';

  const candidateName = round?.candidate_name || (isInterviewer ? otherPersonName : myName) || 'Candidate';
  const candidateRole = round?.requisition_title || 'Candidate Role';
  const candidateInitials =
    (candidateName || 'C')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'C';

  const requisitionCode = round?.requisition_id
    ? `REQ #${String(round.requisition_id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`
    : 'REQ #INTERVIEW';

  const roundTitle = round?.round_name || (round?.round_type ? `${round.round_type} Round` : 'Technical Round');
  const companyName = round?.company_name || 'Bearitt';
  const scheduleTiming = round?.scheduled_date
    ? `${round.scheduled_date}${round.scheduled_time ? ` • ${round.scheduled_time}` : ''}`
    : round?.duration_minutes
    ? `${round.duration_minutes} Mins Session`
    : 'Live Session';

  const participantCount = totalPeopleCount;

  return (
    <div className="relative w-full h-screen h-[100dvh] bg-[#090B10] text-zinc-100 flex flex-col overflow-hidden font-sans select-none">
      {/* Ambient background subtle lighting */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────────────
          TOP NAVBAR: Modern, sleek, uncluttered Dark Studio header
          ───────────────────────────────────────────────────────────────── */}
      <header className="relative z-20 h-14 px-4 sm:px-6 flex items-center justify-between bg-[#0E1118]/90 backdrop-blur-xl border-b border-white/[0.08] shrink-0">
        {/* Left: TermJobs Logo + Interview Title & Live Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-black/80 border border-white/10 flex items-center justify-center p-1.5 shadow-sm shrink-0">
            <img src={termjobsLogo} alt="TermJobs" className="w-full h-full object-contain" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-xs sm:text-sm tracking-tight text-white truncate">
                {candidateRole} Interview
              </h1>
              {/* Pulsing Live Badge */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10.5px] font-bold tracking-wide shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE</span>
                <span className="font-mono text-zinc-300 font-semibold pl-1 border-l border-emerald-500/30">
                  {formatCallTime(callDuration)}
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 truncate">
              <span className="text-zinc-300 font-medium">{roundTitle}</span>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-zinc-400">{companyName}</span>
              <span className="text-zinc-600">&bull;</span>
              <span className="font-mono text-zinc-400">{requisitionCode}</span>
            </div>
          </div>
        </div>

        {/* Right Actions: Clean, Minimal, Highly Functional */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Copy Meeting Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-200 border border-white/10 transition cursor-pointer active:scale-95"
            title="Copy encrypted interview link"
          >
            {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-zinc-400" />}
            <span className="hidden md:inline">{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
          </button>

          {/* People Count Badge */}
          <button
            type="button"
            onClick={() => setShowPeopleModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-200 border border-white/10 transition cursor-pointer active:scale-95"
            title="View participants"
          >
            <Users size={14} className="text-zinc-400" />
            <span className="hidden sm:inline">People</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10.5px] font-bold text-emerald-400">
              {participantCount}
            </span>
          </button>

          {/* Toggle Sidebar (Chat / Info) */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 ${
              isSidebarOpen
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 border-white/10'
            }`}
            title="Toggle panel"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Panel</span>
            {messages.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            )}
          </button>

          {/* Settings button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 border border-white/10 transition cursor-pointer active:scale-95"
            title="Settings"
          >
            <Settings size={14} />
          </button>

          <div className="w-[1px] h-6 bg-white/10 mx-0.5 hidden sm:block" />

          {/* End Call Button */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-950/40 transition active:scale-95 cursor-pointer shrink-0"
          >
            <PhoneOff size={14} className="text-white" />
            <span className="whitespace-nowrap">{isInterviewer ? 'End Interview' : 'Leave Call'}</span>
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          MAIN WORKSPACE LAYOUT: Clean Multi-Tile Stage + Optional Sidebar
          ───────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-row p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
        {/* ============================================================== */}
        {/* LEFT COLUMN: MULTI-TILE VIDEO GRID + FLOATING CONTROL DOCK    */}
        {/* ============================================================== */}
        <div className="flex-1 min-w-0 h-full flex flex-col gap-3 overflow-hidden">
          {/* VIDEO GRID AREA: Dynamic Multi-Participant Grid */}
          <div className={`flex-1 min-h-0 grid gap-3 sm:gap-4 overflow-y-auto [scrollbar-width:thin] ${
            totalPeopleCount === 1
              ? 'grid-cols-1 max-w-4xl mx-auto w-full'
              : totalPeopleCount === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : totalPeopleCount === 3
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-2 md:grid-cols-2'
          }`}>
            {/* Remote Participants */}
            {effectiveParticipants.map((peer) => (
              <RemoteParticipantTile
                key={peer.identity}
                peer={peer}
                isInterviewer={isInterviewer}
                round={round}
                fallbackStream={remoteStream}
              />
            ))}

            {/* Local Participant (You) */}
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#11141D] border border-white/[0.08] shadow-2xl flex items-center justify-center group min-h-[220px]">
              {isCameraOn && localStream ? (
                <video
                  ref={setLocalVideo}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                /* Camera Turned Off Screen */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#141824] to-[#0D1018] text-center select-none">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-white/15 flex items-center justify-center shadow-2xl text-white text-2xl sm:text-3xl font-black mb-3">
                    {myInitials}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {myName} (You)
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">{myRole}</p>

                  <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs text-zinc-400">
                    <VideoOff size={13} className="text-rose-400" />
                    <span>Camera is off</span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer active:scale-95 shadow-lg shadow-emerald-950/40"
                  >
                    <Video size={13} />
                    <span>Turn On Camera</span>
                  </button>
                </div>
              )}

              {/* Bottom-left: Participant Label Pill */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow">
                <span>{myName} (You)</span>
                <span className="text-[10.5px] text-zinc-400 font-normal">&bull; {myRole}</span>
              </div>

              {/* Bottom-right: Audio Visualizer Waves / Mute Indicator */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-emerald-400 shadow">
                {isMicOn ? (
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-2 bg-emerald-400 rounded-full" />
                    <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="w-1 h-2 bg-emerald-400 rounded-full" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-rose-400">
                    <MicOff size={13} />
                    <span className="text-[10px] font-semibold">Muted</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              BOTTOM FLOATING CONTROL BAR: Intuitive, Clean & Modern Dock
              ───────────────────────────────────────────────────────────── */}
          <div className="h-16 shrink-0 flex items-center justify-center">
            <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 rounded-full bg-[#141722]/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  isMicOn
                    ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
                }`}
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {isMicOn ? <Mic size={17} /> : <MicOff size={17} />}
              </button>

              {/* Camera Toggle */}
              <button
                type="button"
                onClick={toggleCamera}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  isCameraOn
                    ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
                }`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? <Video size={17} /> : <VideoOff size={17} />}
              </button>

              {/* Screen Share */}
              <button
                type="button"
                onClick={toggleScreenShare}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  isScreenSharing
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                }`}
                title="Share Screen"
              >
                <Monitor size={17} />
              </button>

              {/* Raise Hand */}
              <button
                type="button"
                onClick={() => setIsHandRaised(!isHandRaised)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  isHandRaised
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                }`}
                title="Raise Hand"
              >
                <Hand size={17} />
              </button>

              {/* Reactions Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                    showEmojiPicker
                      ? 'bg-white/20 text-white border border-white/20'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  }`}
                  title="Send Reaction"
                >
                  <Smile size={17} />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-[#1A1E2B] border border-white/15 shadow-2xl flex items-center gap-1.5 z-50 animate-in fade-in">
                    {['👏', '👍', '❤️', '🎉', '💡', '🔥'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => triggerEmoji(emoji)}
                        className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-lg transition active:scale-125 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-white/15 mx-0.5" />

              {/* Leave Call (Mobile Quick Red Button) */}
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition active:scale-95 shadow-md shadow-rose-950/40 cursor-pointer"
                title="Leave interview"
              >
                <PhoneOff size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: COLLAPSIBLE SIDEBAR (CHAT / DETAILS / NOTES)    */}
        {/* ============================================================== */}
        {isSidebarOpen && (
          <aside className="w-[320px] sm:w-[350px] xl:w-[380px] shrink-0 h-full flex flex-col gap-3 overflow-hidden animate-in fade-in duration-200">
            {/* CARD 1: PARTICIPANT SUMMARY (Candidate info if interviewer; Interviewer info if candidate) */}
            <div className="p-3.5 rounded-2xl bg-[#11141D] border border-white/[0.08] shadow-xl text-zinc-100 shrink-0">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {isInterviewer ? 'Candidate Profile' : 'Interview Session'}
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Close sidebar"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/15 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-inner">
                  {isInterviewer ? candidateInitials : otherPersonInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white truncate">
                      {isInterviewer ? candidateName : otherPersonName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      In Room
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 truncate mt-0.5">
                    {isInterviewer ? `${candidateRole} • ${requisitionCode}` : `${companyName} • ${otherPersonRole}`}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Interviewer */}
              {isInterviewer ? (
                <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold border border-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <User size={13} className="text-zinc-400" />
                    <span>Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResumeModal(true)}
                    className="px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold border border-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={13} className="text-zinc-400" />
                    <span>Resume</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/[0.06] text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <ShieldCheck size={12} className="text-emerald-400" />
                    Verified Encrypted Call
                  </span>
                  <span className="font-mono text-zinc-400">{requisitionCode}</span>
                </div>
              )}
            </div>

            {/* CARD 2: CHAT / DETAILS / NOTES TABS */}
            <div className="flex-1 min-h-0 p-3.5 rounded-2xl bg-[#11141D] border border-white/[0.08] shadow-xl flex flex-col justify-between overflow-hidden text-zinc-100">
              {/* Tab Header */}
              <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/[0.08] text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSideTab('chat')}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                    activeSideTab === 'chat'
                      ? 'bg-white/15 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSideTab('details')}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                    activeSideTab === 'details'
                      ? 'bg-white/15 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Details
                </button>
                {isInterviewer && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveSideTab('notes')}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                        activeSideTab === 'notes'
                          ? 'bg-white/15 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSideTab('feedback')}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                        activeSideTab === 'feedback'
                          ? 'bg-white/15 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Score
                    </button>
                  </>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 1: LIVE CHAT FEED
                  ───────────────────────────────────────────────────────────── */}
              {activeSideTab === 'chat' && (
                <div className="flex-1 flex flex-col justify-between min-h-0 pt-3">
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs [scrollbar-width:thin]">
                    {messages.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-zinc-500 select-none">
                        <MessageSquare size={24} className="mb-2 opacity-30 text-zinc-400" />
                        <p className="text-xs text-zinc-300 font-medium">No messages yet</p>
                        <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px] leading-tight">
                          Chat in real time with the interviewer during your call.
                        </p>
                      </div>
                    ) : (
                      messages.map((m, idx) => {
                        const isMe = m.sender_name === myName;
                        return (
                          <div
                            key={m.id || idx}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1 px-1">
                              <span className="font-semibold text-zinc-300">{isMe ? 'You' : m.sender_name}</span>
                              <span className="text-zinc-500">&bull; {m.sender_role}</span>
                            </div>
                            <div
                              className={`p-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                                isMe
                                  ? 'bg-emerald-600/90 text-white rounded-br-sm'
                                  : 'bg-white/10 text-zinc-100 rounded-bl-sm border border-white/5'
                              }`}
                            >
                              {m.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Message Input Box */}
                  <form onSubmit={handleSendChat} className="pt-3 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus-within:border-emerald-500/50 transition">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer shrink-0 shadow-md"
                      title="Send message"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 2: INTERVIEW DETAILS & GUIDELINES
                  ───────────────────────────────────────────────────────────── */}
              {activeSideTab === 'details' && (
                <div className="flex-1 overflow-y-auto pt-3 space-y-3 min-h-0 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Position Overview
                    </div>
                    <div className="text-sm font-bold text-white">{candidateRole}</div>
                    <div className="text-xs text-zinc-400">
                      Company: <strong className="text-zinc-200">{companyName}</strong>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Stage: <strong className="text-zinc-200">{roundTitle}</strong>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Schedule: <strong className="text-zinc-200">{scheduleTiming}</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Session Guidelines
                    </div>
                    <ul className="text-xs text-zinc-400 space-y-1.5 list-disc pl-4">
                      <li>Keep your camera turned on and centered.</li>
                      <li>Use earphones or a quiet environment to avoid echo.</li>
                      <li>You can share your screen during code walkthroughs.</li>
                      <li>Use the chat panel if you need to paste links or snippets.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3: NOTES (Interviewer only)
                  ───────────────────────────────────────────────────────────── */}
              {activeSideTab === 'notes' && isInterviewer && (
                <div className="flex-1 flex flex-col justify-between pt-3 min-h-0">
                  <textarea
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    placeholder="Private interviewer evaluation notes..."
                    className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
                  />
                  <div className="text-[10px] text-emerald-400 pt-2 flex items-center gap-1 font-medium">
                    <Check size={11} />
                    <span>Auto-saved to interview audit ledger</span>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: FEEDBACK / SCORECARD (Interviewer only)
                  ───────────────────────────────────────────────────────────── */}
              {activeSideTab === 'feedback' && isInterviewer && (
                <div className="flex-1 flex flex-col justify-between pt-3 text-xs space-y-3 min-h-0">
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-zinc-300">Quick Verdict Recommendation:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Strong Hire', 'Hire', 'Re-evaluate', 'Reject'].map((verdict) => (
                        <button
                          key={verdict}
                          type="button"
                          onClick={() => setFeedbackVerdict(verdict)}
                          className={`p-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                            feedbackVerdict === verdict
                              ? verdict === 'Reject'
                                ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-300'
                                : 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300'
                              : 'bg-white/[0.04] border border-white/10 text-zinc-400 hover:bg-white/[0.08]'
                          }`}
                        >
                          {verdict}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5 text-xs">
                    <div className="text-white font-semibold">Post-Interview Scorecard</div>
                    <p className="text-[11px] leading-relaxed text-zinc-400">
                      Submit formal competency scores across Problem Solving, Technical Skills, and Communication.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPostCallEvaluation(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/40"
                  >
                    Open Full Scorecard Form
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#141722] border border-white/15 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
              <PhoneOff size={22} />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {isInterviewer ? 'End Interview Session?' : 'Leave Interview Room?'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1.5 mb-6 leading-relaxed">
              Camera and audio feeds will disconnect immediately.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 text-xs font-semibold border border-white/10 transition cursor-pointer"
              >
                Stay in Room
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-rose-950/50"
              >
                {isInterviewer ? 'End Call' : 'Leave Call'}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() => setShowResumeModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#141722] border border-white/15 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">Resume &bull; {candidateName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-zinc-200 bg-black/40 p-4 rounded-xl border border-white/10 whitespace-pre-wrap leading-relaxed [scrollbar-width:thin]">
              {round?.resume_text ||
                `CANDIDATE: ${candidateName}
TARGET ROLE: ${candidateRole}
REQUISITION: ${requisitionCode}
ROUND: ${roundTitle}
SCHEDULED: ${scheduleTiming}
STATUS: ${round?.status || 'In Progress'}

CANDIDATE DETAILS:
- Name: ${candidateName}
- Email: ${round?.candidate_email || 'Verified Candidate'}
- Interview Stage: ${roundTitle}
- Submission ID: ${round?.candidate_submission_id || 'Active'}
`}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile Modal */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#141722] border border-white/15 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Candidate Details</h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-500">Candidate</span>
                <span className="font-bold text-white">{candidateName}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-500">Target Role</span>
                <span className="font-bold text-white">{candidateRole}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-zinc-500">Requisition</span>
                <span className="font-mono text-zinc-300">{requisitionCode}</span>
              </div>
              {round?.candidate_email && (
                <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-zinc-500">Email</span>
                  <span className="text-zinc-300">{round.candidate_email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="font-bold text-emerald-400">{roundTitle} &bull; Live Now</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* People / Participants Modal */}
      {showPeopleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() => setShowPeopleModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141722] border border-white/15 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-emerald-400" />
                <span>Participants ({participantCount})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPeopleModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs max-h-80 overflow-y-auto [scrollbar-width:thin]">
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">{myName} (You)</div>
                  <div className="text-[10.5px] text-zinc-400">{myRole} &bull; {isInterviewer ? 'Host' : 'Participant'}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  In Room
                </span>
              </div>

              {effectiveParticipants.length === 0 ? (
                <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-zinc-500 text-center text-xs">
                  Waiting for other participants to join...
                </div>
              ) : (
                effectiveParticipants.map((p) => {
                  const pRawRole = (p.role || '').toLowerCase();
                  const pIsHM = pRawRole === 'hiring manager' || pRawRole === 'hm' || (p.name && (p.name.toLowerCase().includes('hiring manager') || p.name.toLowerCase().includes('hm')));
                  const pIsCand = pRawRole === 'candidate' || (p.name && round?.candidate_name && p.name.toLowerCase() === round.candidate_name.toLowerCase());
                  const pRoleLabel = pIsHM ? 'Hiring Manager' : (pIsCand ? 'Candidate' : (p.role || 'Interviewer'));
                  let pName = p.name;
                  if (!pName || pName === 'Interviewer' || pName === 'Candidate') {
                    pName = pIsCand ? (round?.candidate_name || 'Candidate') : (round?.interviewer_name || pRoleLabel);
                  }
                  const hasStream = Boolean(p.stream);

                  return (
                    <div key={p.identity || pName} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{pName}</div>
                        <div className="text-[10.5px] text-zinc-400">{pRoleLabel}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          hasStream
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {hasStream ? 'Active' : 'Connecting'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141722] border border-white/15 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings size={16} className="text-emerald-400" />
                <span>Audio & Video Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3.5 text-xs text-zinc-300">
              <div>
                <label className="text-zinc-400 block mb-1.5 font-medium flex items-center gap-1.5">
                  <Mic size={13} className="text-emerald-400" />
                  <span>Microphone</span>
                </label>
                <select className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500/60">
                  <option>Default - System Microphone</option>
                  <option>Built-in Audio Device</option>
                </select>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1.5 font-medium flex items-center gap-1.5">
                  <Video size={13} className="text-emerald-400" />
                  <span>Camera</span>
                </label>
                <select className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500/60">
                  <option>Default - Integrated Camera (HD)</option>
                  <option>USB Video Device</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-950/40"
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
