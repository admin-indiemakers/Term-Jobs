import { useState, useEffect, useCallback, useRef } from 'react';
import { livekitService } from '../services/livekitService';

export function useInterviewMedia() {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [permissionError, setPermissionError] = useState(null);

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    const handleLocalTrack = ({ stream, hasVideo, hasAudio }) => {
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsCameraOn(hasVideo);
      setIsMicOn(hasAudio);
    };

    livekitService.on('localTrackChanged', handleLocalTrack);

    const handleScreenShareEnded = () => {
      setIsScreenSharing(false);
      setScreenStream(null);
      screenStreamRef.current = null;
    };
    livekitService.on('screenShareEnded', handleScreenShareEnded);

    return () => {
      livekitService.off('localTrackChanged', handleLocalTrack);
      livekitService.off('screenShareEnded', handleScreenShareEnded);

      // Cleanly stop all tracks when hook unmounts so camera hardware shuts off
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });
      }
    };
  }, []);

  const stopMediaTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setScreenStream(null);
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
    livekitService.disconnect();
  }, []);

  const toggleCamera = useCallback(async () => {
    try {
      const nextState = !isCameraOn;
      if (!nextState && localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
            localStreamRef.current.removeTrack(track);
          } catch (_) {}
        });
      }
      await livekitService.toggleCamera(nextState);
      setIsCameraOn(nextState);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
      setPermissionError('Could not toggle camera.');
    }
  }, [isCameraOn]);

  const enableCamera = useCallback(async () => {
    try {
      await livekitService.toggleCamera(true);
      setIsCameraOn(true);
      setPermissionError(null);
    } catch (err) {
      const message = err.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow Camera in the browser site permissions and your system privacy settings, then retry.'
        : err.name === 'NotFoundError'
        ? 'No camera was found. Connect a camera, then retry.'
        : err.name === 'NotReadableError'
        ? 'Your camera is busy or unavailable. Close other apps using it, then retry.'
        : 'Camera could not start. Check the camera connection and browser permissions, then retry.';
      setPermissionError(message);
    }
  }, []);

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
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      } else {
        const resStream = await livekitService.toggleScreenShare(true);
        if (resStream) {
          setScreenStream(resStream);
          screenStreamRef.current = resStream;
          setIsScreenSharing(true);
        } else {
          setScreenStream(null);
          screenStreamRef.current = null;
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
    stopMediaTracks,
    toggleCamera,
    enableCamera,
    toggleMicrophone,
    toggleScreenShare,
  };
}
