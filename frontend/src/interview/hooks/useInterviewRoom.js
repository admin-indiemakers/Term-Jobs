import { useState, useEffect, useCallback } from 'react';
import { livekitService } from '../services/livekitService';

export function useInterviewRoom({ roundId, participantName, role, livekitToken, livekitUrl, isAiInterview = false }) {
  const [connectionState, setConnectionState] = useState('connecting'); // 'connecting' | 'connected' | 'fallback_preview' | 'permission_denied' | 'disconnected'
  const [participants, setParticipants] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);

  const connectRoom = useCallback(async () => {
    setConnectionState('connecting');
    if (!roundId) return;
    const result = await livekitService.connect({
      url: livekitUrl || '',
      token: livekitToken || '',
      participantName,
      role,
      roundId,
      isAiInterview,
    });

    if (result.mode === 'livekit') {
      setConnectionState('connected');
    } else if (result.mode === 'fallback') {
      setConnectionState('connected');
    } else if (result.mode === 'denied') {
      setConnectionState('permission_denied');
    }
  }, [livekitUrl, livekitToken, participantName, role, roundId, isAiInterview]);

  useEffect(() => {
    connectRoom();

    const handleConnState = (state) => setConnectionState(state);

    const handleRemoteTrack = (stream) => {
      setRemoteStream(stream);
    };

    const handleRemoteScreenTrack = (stream) => {
      console.log('useInterviewRoom: remoteScreenTrackReceived', stream);
      setRemoteScreenStream(stream);
    };

    const handleRemoteScreenShare = ({ isSharing }) => {
      console.log('useInterviewRoom: remoteScreenShareChanged', isSharing);
      setIsRemoteScreenSharing(!!isSharing);
      if (!isSharing) {
        setRemoteScreenStream(null);
      }
    };

    const handleParticipantConnected = (participant) => {
      setParticipants((prev) => {
        const idx = prev.findIndex((p) => p.identity === participant.identity);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...participant };
          return next;
        }
        return [...prev, participant];
      });
    };

    const handleParticipantDisconnected = (participant) => {
      setParticipants((prev) => prev.filter((p) => p.identity !== participant.identity));
    };

    const handleParticipantsUpdated = (peerList) => {
      if (Array.isArray(peerList)) {
        setParticipants(peerList);
      }
    };

    const handleParticipantStreamChanged = ({ peerId, stream }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.identity === peerId ? { ...p, stream } : p))
      );
      if (stream) {
        setRemoteStream(stream);
      }
    };

    const handleActiveSpeakers = (speakers) => {
      if (speakers && speakers.length > 0) {
        setActiveSpeaker(speakers[0].identity);
      } else {
        setActiveSpeaker(null);
      }
    };

    livekitService.on('connectionStateChanged', handleConnState);
    livekitService.on('remoteTrackReceived', handleRemoteTrack);
    livekitService.on('remoteScreenTrackReceived', handleRemoteScreenTrack);
    livekitService.on('remoteScreenShareChanged', handleRemoteScreenShare);
    livekitService.on('participantConnected', handleParticipantConnected);
    livekitService.on('participantDisconnected', handleParticipantDisconnected);
    livekitService.on('participantsUpdated', handleParticipantsUpdated);
    livekitService.on('participantStreamChanged', handleParticipantStreamChanged);
    livekitService.on('activeSpeakersChanged', handleActiveSpeakers);

    return () => {
      livekitService.off('connectionStateChanged', handleConnState);
      livekitService.off('remoteTrackReceived', handleRemoteTrack);
      livekitService.off('remoteScreenTrackReceived', handleRemoteScreenTrack);
      livekitService.off('remoteScreenShareChanged', handleRemoteScreenShare);
      livekitService.off('participantConnected', handleParticipantConnected);
      livekitService.off('participantDisconnected', handleParticipantDisconnected);
      livekitService.off('participantsUpdated', handleParticipantsUpdated);
      livekitService.off('participantStreamChanged', handleParticipantStreamChanged);
      livekitService.off('activeSpeakersChanged', handleActiveSpeakers);
    };
  }, [connectRoom]);

  // Guaranteed unmount cleanup
  useEffect(() => {
    return () => {
      livekitService.disconnect();
    };
  }, []);

  const disconnect = useCallback(() => {
    livekitService.disconnect();
    setConnectionState('disconnected');
    setRemoteStream(null);
    setRemoteScreenStream(null);
    setIsRemoteScreenSharing(false);
  }, []);

  return {
    connectionState,
    participants,
    remoteStream,
    remoteScreenStream,
    isRemoteScreenSharing,
    activeSpeaker,
    disconnect,
  };
}
