import { useState, useEffect, useCallback } from 'react';
import { livekitService } from '../services/livekitService';

export function useInterviewMedia() {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [permissionError, setPermissionError] = useState(null);

  useEffect(() => {
    const handleLocalTrack = ({ stream, hasVideo, hasAudio }) => {
      setLocalStream(stream);
      setIsCameraOn(hasVideo);
      setIsMicOn(hasAudio);
    };

    livekitService.on('localTrackChanged', handleLocalTrack);

    const handleScreenShareEnded = () => {
      setIsScreenSharing(false);
      setScreenStream(null);
    };
    livekitService.on('screenShareEnded', handleScreenShareEnded);

    return () => {
      livekitService.off('localTrackChanged', handleLocalTrack);
      livekitService.off('screenShareEnded', handleScreenShareEnded);
    };
  }, []);

  const toggleCamera = useCallback(async () => {
    try {
      const nextState = !isCameraOn;
      await livekitService.toggleCamera(nextState);
      setIsCameraOn(nextState);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
      setPermissionError('Could not toggle camera.');
    }
  }, [isCameraOn]);

  const toggleMicrophone = useCallback(async () => {
    try {
      const nextState = !isMicOn;
      await livekitService.toggleMicrophone(nextState);
      setIsMicOn(nextState);
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
      setPermissionError('Could not toggle microphone.');
    }
  }, [isMicOn]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await livekitService.toggleScreenShare(false);
        setScreenStream(null);
        setIsScreenSharing(false);
      } else {
        const resStream = await livekitService.toggleScreenShare(true);
        if (resStream) {
          setScreenStream(resStream);
          setIsScreenSharing(true);
        } else {
          setScreenStream(null);
          setIsScreenSharing(false);
        }
      }
    } catch (err) {
      console.error('Failed to toggle screen share:', err);
    }
  }, [isScreenSharing]);

  return {
    isCameraOn,
    isMicOn,
    isScreenSharing,
    localStream,
    screenStream,
    permissionError,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
  };
}
