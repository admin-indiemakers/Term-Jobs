import { Room, RoomEvent } from 'livekit-client';
import { API_BASE_URL } from '../../api/client';

export class LiveKitService {
  constructor() {
    this.room = null;
    this.isLiveKitConnected = false;
    this.fallbackLocalStream = null;
    this.fallbackScreenStream = null;
    this.peerConnection = null;
    this.screenSender = null;
    this.signalingSocket = null;
    this.remoteStream = null;
    this.remoteScreenStream = null;
    this.isRemoteSharingScreen = false;
    this.remoteScreenTrackId = null;
    this.remoteScreenStreamId = null;
    this.myId = Math.random().toString(36).substring(2, 9);
    this.currentRole = '';
    this.currentRoundId = '';
    this.listeners = {
      participantConnected: [],
      participantDisconnected: [],
      trackSubscribed: [],
      trackUnsubscribed: [],
      activeSpeakersChanged: [],
      dataReceived: [],
      connectionStateChanged: [],
      localTrackChanged: [],
      remoteTrackReceived: [],
      remoteScreenTrackReceived: [],
      remoteScreenShareChanged: [],
      screenShareEnded: [],
      chatMessageReceived: [],
    };
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  _emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[LiveKitService error in ${event} callback]`, err);
        }
      });
    }
  }

  async connect({ url, token, participantName, role, roundId }) {
    this.currentRole = role;
    this.currentRoundId = roundId;

    // Try LiveKit SFU server connection first
    if (url && token && !url.includes('example.com') && !token.includes('mock') && !url.includes('termjobs-livekit.livekit.cloud')) {
      try {
        console.log('Connecting to LiveKit SFU room...', { url, role });
        this.room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        this._setupRoomListeners();

        await this.room.connect(url, token);
        this.isLiveKitConnected = true;
        this._emit('connectionStateChanged', 'connected');

        // Enable default camera & mic
        try {
          await this.room.localParticipant.setCameraEnabled(true);
          await this.room.localParticipant.setMicrophoneEnabled(true);
        } catch (mediaErr) {
          console.warn('Initial media enable warning:', mediaErr);
        }

        return {
          mode: 'livekit',
          room: this.room,
        };
      } catch (err) {
        console.warn('LiveKit SFU connection failed or server unreachable, falling back to WebRTC P2P:', err);
      }
    }

    // Resilient Direct WebRTC P2P Fallback Mode
    console.log('Initializing WebRTC direct P2P mode for interview room...', { roundId, role });
    try {
      this.fallbackLocalStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.isLiveKitConnected = false;
      this._emit('connectionStateChanged', 'connected');
      this._emit('localTrackChanged', {
        stream: this.fallbackLocalStream,
        hasVideo: true,
        hasAudio: true,
      });

      // Start P2P WebRTC Signaling via the room WebSocket
      this.initP2PConnection(roundId, role, participantName);

      return {
        mode: 'fallback',
        stream: this.fallbackLocalStream,
      };
    } catch (localMediaErr) {
      console.warn('Browser camera/microphone permission not granted:', localMediaErr);
      this._emit('connectionStateChanged', 'permission_denied');
      return {
        mode: 'denied',
        error: localMediaErr,
      };
    }
  }

  initP2PConnection(roundId, role, participantName) {
    if (!roundId) return;
    this._isDestroyed = false;
    this.closeP2PConnection();
    this._isDestroyed = false;

    try {
      let wsBase = (API_BASE_URL || '').replace(/^http/, 'ws');
      if (!wsBase.startsWith('ws')) {
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
        wsBase = `${protocol}//${host}`;
      }
      const wsUrl = `${wsBase}/api/interviews/rounds/${roundId}/ws`;

      const socket = new WebSocket(wsUrl);
      this.signalingSocket = socket;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });
      this.peerConnection = pc;

      // Add local media tracks to peer connection
      if (this.fallbackLocalStream) {
        this.fallbackLocalStream.getTracks().forEach((track) => {
          pc.addTrack(track, this.fallbackLocalStream);
        });
      }

      // Handle remote media track arrival (camera, mic, or screen share)
      pc.ontrack = (event) => {
        console.log('🎥 WebRTC Remote track received:', event.track.kind, event.streams);
        const incomingStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);

        // Detect if this incoming track is the remote screen share
        const isScreen =
          (this.remoteScreenTrackId && event.track.id === this.remoteScreenTrackId) ||
          (this.remoteScreenStreamId && incomingStream.id === this.remoteScreenStreamId) ||
          (this.isRemoteSharingScreen && event.track.kind === 'video' && this.remoteStream && this.remoteStream.getVideoTracks().length > 0);

        if (isScreen) {
          console.log('🖥️ Remote Screen track received:', incomingStream);
          this.remoteScreenStream = incomingStream;
          this._emit('remoteScreenTrackReceived', this.remoteScreenStream);
        } else {
          console.log('👤 Remote Camera/Audio track received:', incomingStream);
          if (!this.remoteStream) {
            this.remoteStream = incomingStream;
          } else if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
            this.remoteStream.addTrack(event.track);
          }
          this._emit('remoteTrackReceived', this.remoteStream);
          this._emit('participantConnected', {
            identity: 'remote_peer',
            name: role === 'candidate' ? 'Interviewer' : 'Candidate',
            role: role === 'candidate' ? 'interviewer' : 'candidate',
            videoTrack: true,
          });
        }
      };

      // Send local ICE candidates to peer
      pc.onicecandidate = (event) => {
        if (event.candidate && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'signal',
            action: 'ice-candidate',
            sender_id: this.myId,
            sender_role: role,
            candidate: event.candidate,
          }));
        }
      };

      socket.onopen = () => {
        console.log('📡 P2P Signaling connected to room WebSocket');
        // Announce presence in room
        socket.send(JSON.stringify({
          type: 'signal',
          action: 'join',
          sender_id: this.myId,
          sender_role: role,
          sender_name: participantName,
        }));

        // Interviewer initiates offer when socket is ready
        if (role === 'interviewer') {
          setTimeout(() => this._initiateP2POffer(pc, socket, role), 600);
        }
      };

      socket.onclose = () => {
        console.warn('⚠️ P2P Signaling WebSocket disconnected.');
        if (this._isDestroyed) return;
        setTimeout(() => {
          if (!this._isDestroyed && (!this.signalingSocket || this.signalingSocket.readyState === WebSocket.CLOSED)) {
            console.log('🔄 Reconnecting P2P signaling WebSocket...');
            this.initP2PConnection(roundId, role, participantName);
          }
        }, 2000);
      };

      socket.onerror = (err) => {
        console.warn('P2P Signaling WebSocket notice:', err);
      };

      socket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle in-meeting chat message
          if (data.type === 'chat' && data.message) {
            this._emit('chatMessageReceived', data.message);
            return;
          }

          if (data.type !== 'signal' || data.sender_id === this.myId) return;

          console.log('📥 P2P Signal received:', data.action, 'from role:', data.sender_role);

          if (data.action === 'join') {
            // Another peer arrived; if we are the interviewer, make an offer
            if (role === 'interviewer') {
              await this._initiateP2POffer(pc, socket, role);
            }
            // If we are currently sharing screen, let the newcomer know
            if (this.fallbackScreenStream) {
              const screenTrack = this.fallbackScreenStream.getVideoTracks()[0];
              socket.send(JSON.stringify({
                type: 'signal',
                action: 'screen-share-state',
                sender_id: this.myId,
                sender_role: role,
                isSharing: true,
                stream_id: this.fallbackScreenStream.id,
                track_id: screenTrack?.id,
              }));
            }
          } else if (data.action === 'offer' && data.sdp) {
            if (pc.signalingState !== 'stable') {
              await Promise.all([
                pc.setLocalDescription({ type: 'rollback' }),
                pc.setRemoteDescription(new RTCSessionDescription(data.sdp)),
              ]);
            } else {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.send(JSON.stringify({
              type: 'signal',
              action: 'answer',
              sender_id: this.myId,
              sender_role: role,
              sdp: answer,
            }));
          } else if (data.action === 'answer' && data.sdp) {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
          } else if (data.action === 'ice-candidate' && data.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (iceErr) {
              console.warn('Error adding received ICE candidate:', iceErr);
            }
          } else if (data.action === 'screen-share-state') {
            console.log('Remote screen share state changed:', data.isSharing);
            this.isRemoteSharingScreen = !!data.isSharing;
            this.remoteScreenTrackId = data.track_id || null;
            this.remoteScreenStreamId = data.stream_id || null;
            if (!data.isSharing) {
              this.remoteScreenStream = null;
              this._emit('remoteScreenTrackReceived', null);
            }
            this._emit('remoteScreenShareChanged', {
              isSharing: !!data.isSharing,
              sender_role: data.sender_role,
            });
          }
        } catch (err) {
          console.warn('Error processing signaling message:', err);
        }
      };
    } catch (err) {
      console.warn('Failed to initialize P2P WebRTC connection:', err);
    }
  }

  async _initiateP2POffer(pc = this.peerConnection, socket = this.signalingSocket, role = this.currentRole) {
    try {
      if (!pc || !socket || socket.readyState !== WebSocket.OPEN) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.send(JSON.stringify({
        type: 'signal',
        action: 'offer',
        sender_id: this.myId,
        sender_role: role,
        sdp: offer,
      }));
    } catch (err) {
      console.warn('Error creating WebRTC offer:', err);
    }
  }

  closeP2PConnection() {
    this._isDestroyed = true;
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    if (this.signalingSocket) {
      try {
        this.signalingSocket.onclose = null;
        this.signalingSocket.close();
      } catch (e) {}
      this.signalingSocket = null;
    }
    this.remoteStream = null;
  }

  _setupRoomListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      this._emit('participantConnected', participant);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this._emit('participantDisconnected', participant);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      this._emit('trackSubscribed', { track, publication, participant });
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      this._emit('trackUnsubscribed', { track, publication, participant });
    });

    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      this._emit('activeSpeakersChanged', speakers);
    });

    this.room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);
        this._emit('dataReceived', data, participant);
      } catch (e) {
        console.warn('Error parsing data packet:', e);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.isLiveKitConnected = false;
      this._emit('connectionStateChanged', 'disconnected');
    });
  }

  async toggleCamera(enabled) {
    if (this.room && this.isLiveKitConnected) {
      return await this.room.localParticipant.setCameraEnabled(enabled);
    }
    if (this.fallbackLocalStream) {
      const videoTrack = this.fallbackLocalStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
        this._emit('localTrackChanged', {
          stream: this.fallbackLocalStream,
          hasVideo: enabled,
          hasAudio: this.fallbackLocalStream.getAudioTracks()[0]?.enabled ?? false,
        });
      }
    }
  }

  async toggleMicrophone(enabled) {
    if (this.room && this.isLiveKitConnected) {
      return await this.room.localParticipant.setMicrophoneEnabled(enabled);
    }
    if (this.fallbackLocalStream) {
      const audioTrack = this.fallbackLocalStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
        this._emit('localTrackChanged', {
          stream: this.fallbackLocalStream,
          hasVideo: this.fallbackLocalStream.getVideoTracks()[0]?.enabled ?? false,
          hasAudio: enabled,
        });
      }
    }
  }

  async toggleScreenShare(enabled) {
    if (this.room && this.isLiveKitConnected) {
      return await this.room.localParticipant.setScreenShareEnabled(enabled);
    }
    if (enabled) {
      try {
        this.fallbackScreenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        });

        const screenTrack = this.fallbackScreenStream.getVideoTracks()[0];

        // Add screen track as a separate WebRTC video sender so camera remains active!
        if (this.peerConnection && screenTrack) {
          try {
            this.screenSender = this.peerConnection.addTrack(screenTrack, this.fallbackScreenStream);
            console.log('🖥️ Added dedicated WebRTC screen share sender, camera track remains streaming');
            await this._initiateP2POffer();
          } catch (trackErr) {
            console.warn('Could not add separate screen track, falling back to replaceTrack:', trackErr);
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(screenTrack);
            }
          }
        }

        // Broadcast screen share state to room with stream & track ID
        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
          this.signalingSocket.send(JSON.stringify({
            type: 'signal',
            action: 'screen-share-state',
            sender_id: this.myId,
            sender_role: this.currentRole,
            isSharing: true,
            stream_id: this.fallbackScreenStream.id,
            track_id: screenTrack?.id,
          }));
        }

        // Auto revert when user clicks browser's native "Stop sharing"
        if (screenTrack) {
          screenTrack.onended = () => {
            console.log('Native screen share track ended');
            this.toggleScreenShare(false);
          };
        }

        return this.fallbackScreenStream;
      } catch (e) {
        console.warn('Screen share canceled or denied:', e);
        return null;
      }
    } else {
      // Stopping screen share: remove separate screen sender
      if (this.screenSender && this.peerConnection) {
        try {
          this.peerConnection.removeTrack(this.screenSender);
          console.log('🖥️ Removed screen share sender, renegotiating WebRTC');
          await this._initiateP2POffer();
        } catch (err) {
          console.warn('Error removing screen sender:', err);
        }
        this.screenSender = null;
      }

      // If camera was replaced as fallback, restore camera track
      if (this.peerConnection && this.fallbackLocalStream) {
        const cameraTrack = this.fallbackLocalStream.getVideoTracks()[0] || null;
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && cameraTrack && videoSender.track !== cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
          console.log('🔄 Reverted videoSender to camera track');
        }
      }

      if (this.fallbackScreenStream) {
        this.fallbackScreenStream.getTracks().forEach((t) => t.stop());
        this.fallbackScreenStream = null;
      }

      // Broadcast screen share stopped
      if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
        this.signalingSocket.send(JSON.stringify({
          type: 'signal',
          action: 'screen-share-state',
          sender_id: this.myId,
          sender_role: this.currentRole,
          isSharing: false,
        }));
      }

      this._emit('screenShareEnded');
      return null;
    }
  }

  sendChatMessage(msg) {
    let sent = false;
    const msgId = msg.id || msg.message_id || `msg_${Date.now()}`;
    // 1. Send via signaling WebSocket
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      try {
        this.signalingSocket.send(JSON.stringify({
          type: 'chat',
          id: msgId,
          message_id: msgId,
          sender_name: msg.sender_name,
          sender_role: msg.sender_role,
          message: msg.message,
          sender_identity: msg.sender_identity || this.myId,
        }));
        sent = true;
      } catch (e) {
        console.warn('Failed to send chat message over signaling socket:', e);
      }
    }

    // 2. Also send over LiveKit room data channel if connected
    if (this.room && this.isLiveKitConnected) {
      try {
        this.sendDataPacket({ type: 'chat', message: { ...msg, id: msgId, message_id: msgId } });
        sent = true;
      } catch (e) {
        console.warn('Failed to send chat message over LiveKit data channel:', e);
      }
    }

    return sent;
  }

  sendDataPacket(data) {
    if (this.room && this.isLiveKitConnected) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify(data));
        this.room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.warn('Failed to publish data packet over LiveKit:', err);
      }
    }
  }

  disconnect() {
    if (this.room) {
      try {
        this.room.disconnect();
      } catch (e) {}
      this.room = null;
    }
    if (this.fallbackLocalStream) {
      this.fallbackLocalStream.getTracks().forEach((t) => t.stop());
      this.fallbackLocalStream = null;
    }
    if (this.fallbackScreenStream) {
      this.fallbackScreenStream.getTracks().forEach((t) => t.stop());
      this.fallbackScreenStream = null;
    }
    this.closeP2PConnection();
    this.isLiveKitConnected = false;
    this._emit('connectionStateChanged', 'disconnected');
  }
}

export const livekitService = new LiveKitService();
