import { useState, useEffect, useCallback, useRef } from 'react';
import { interviewApi } from '../services/interviewApi';
import { livekitService } from '../services/livekitService';
import { API_BASE_URL } from '../../api/client';

export function useInterviewChat({ roundId, senderName, senderRole, isChatDrawerOpen }) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef(null);
  const isChatOpenRef = useRef(isChatDrawerOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatDrawerOpen;
    if (isChatDrawerOpen) {
      setUnreadCount(0);
    }
  }, [isChatDrawerOpen]);

  // Load chat history on mount
  useEffect(() => {
    let isMounted = true;
    if (!roundId) return;

    interviewApi
      .getChatHistory(roundId)
      .then((res) => {
        if (isMounted && res && res.messages) {
          setMessages(res.messages);
        }
      })
      .catch((err) => {
        console.warn('Could not load chat history:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [roundId]);

  const handleIncomingMessage = useCallback(
    (incoming) => {
      if (!incoming || !incoming.message) return;
      const incomingId = incoming.id || incoming.message_id;

      setMessages((prev) => {
        // Avoid duplicate by exact ID
        if (incomingId && prev.some((m) => m.id === incomingId || m.message_id === incomingId)) {
          return prev;
        }

        // If we have an optimistic message matching ID or role & text, confirm it
        const optIndex = prev.findIndex(
          (m) =>
            m.pending &&
            ((incomingId && (m.id === incomingId || m.message_id === incomingId)) ||
              (m.sender_role === incoming.sender_role && m.message === incoming.message))
        );
        if (optIndex !== -1) {
          const next = [...prev];
          next[optIndex] = { ...incoming, pending: false };
          return next;
        }

        // Avoid rapid duplicate echoes
        const isDuplicate = prev.some((m) => {
          if (m.sender_role === incoming.sender_role && m.message === incoming.message) {
            const t1 = new Date(m.created_at || 0).getTime();
            const t2 = new Date(incoming.created_at || 0).getTime();
            return Math.abs(t1 - t2) < 3000;
          }
          return false;
        });
        if (isDuplicate) return prev;

        return [...prev, incoming];
      });

      if (!isChatOpenRef.current && incoming.sender_role !== senderRole) {
        setUnreadCount((c) => c + 1);
      }
    },
    [senderRole]
  );

  // Real-time WebSocket connection with auto-reconnect
  useEffect(() => {
    if (!roundId) return;
    let isMounted = true;
    let reconnectTimer = null;

    // 1. Listen for incoming chat messages via livekitService signaling
    livekitService.on('chatMessageReceived', handleIncomingMessage);

    // 2. Listen to LiveKit data channel packets
    const handleDataPacket = (data) => {
      if (data && data.type === 'chat' && data.message) {
        handleIncomingMessage(data.message);
      }
    };
    livekitService.on('dataReceived', handleDataPacket);

    // 3. Auxiliary WebSocket connection to room endpoint
    const connectWs = () => {
      if (!isMounted || !roundId) return;

      let wsBase = (API_BASE_URL || '').replace(/^http/, 'ws');
      if (!wsBase.startsWith('ws')) {
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = typeof window !== 'undefined'
          ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'localhost:8000' : window.location.host)
          : 'localhost:8000';
        wsBase = `${protocol}//${host}`;
      }
      const wsUrl = `${wsBase}/api/interviews/rounds/${roundId}/ws`;

      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'chat' && payload.message) {
              handleIncomingMessage(payload.message);
            }
          } catch (e) {
            console.warn('Error parsing incoming chat socket packet:', e);
          }
        };

        socket.onclose = () => {
          if (!isMounted) return;
          reconnectTimer = setTimeout(connectWs, 2000);
        };

        socket.onerror = (err) => {
          console.warn('Chat WebSocket notice:', err);
        };
      } catch (wsErr) {
        console.warn('Could not open auxiliary chat WebSocket:', wsErr);
        if (isMounted) {
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      livekitService.off('chatMessageReceived', handleIncomingMessage);
      livekitService.off('dataReceived', handleDataPacket);
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
    };
  }, [roundId, handleIncomingMessage]);

  // Background polling fallback (guarantees zero-loss even if socket drops or browser sleeps)
  useEffect(() => {
    if (!roundId) return;
    let isMounted = true;

    const pollChat = async () => {
      if (!isMounted) return;
      try {
        const res = await interviewApi.getChatHistory(roundId);
        if (!isMounted || !res || !Array.isArray(res.messages)) return;

        setMessages((prev) => {
          let changed = false;
          const merged = [...prev];

          for (const serverMsg of res.messages) {
            const serverId = serverMsg.id || serverMsg.message_id;
            const existingIdx = merged.findIndex(
              (m) => (serverId && (m.id === serverId || m.message_id === serverId))
            );

            if (existingIdx !== -1) {
              if (merged[existingIdx].pending) {
                merged[existingIdx] = { ...serverMsg, pending: false };
                changed = true;
              }
            } else {
              // Check if matching optimistic message
              const optIdx = merged.findIndex(
                (m) =>
                  m.pending &&
                  m.sender_role === serverMsg.sender_role &&
                  m.message === serverMsg.message
              );
              if (optIdx !== -1) {
                merged[optIdx] = { ...serverMsg, pending: false };
                changed = true;
              } else {
                // Check if duplicate of another recent message
                const isDup = merged.some((m) => {
                  if (m.sender_role === serverMsg.sender_role && m.message === serverMsg.message) {
                    const t1 = new Date(m.created_at || 0).getTime();
                    const t2 = new Date(serverMsg.created_at || 0).getTime();
                    return Math.abs(t1 - t2) < 3000;
                  }
                  return false;
                });
                if (!isDup) {
                  merged.push(serverMsg);
                  changed = true;
                  if (!isChatOpenRef.current && serverMsg.sender_role !== senderRole) {
                    setUnreadCount((c) => c + 1);
                  }
                }
              }
            }
          }

          return changed ? merged : prev;
        });
      } catch (err) {
        // Silent poll catch
      }
    };

    const intervalId = setInterval(pollChat, 2500);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [roundId, senderRole]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text || !text.trim()) return;
      const cleanText = text.trim();
      const clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const optimisticMsg = {
        id: clientMsgId,
        message_id: clientMsgId,
        round_id: roundId,
        sender_name: senderName || 'Participant',
        sender_role: senderRole || 'candidate',
        message: cleanText,
        created_at: new Date().toISOString(),
        pending: true,
      };

      // Optimistic update right away
      setMessages((prev) => [...prev, optimisticMsg]);

      // Primary send: Send via REST endpoint (backend saves once and broadcasts to all room WebSockets)
      let sentSuccessfully = false;
      try {
        const saved = await interviewApi.sendChatMessage(roundId, {
          message_id: clientMsgId,
          sender_name: optimisticMsg.sender_name,
          sender_role: optimisticMsg.sender_role,
          message: optimisticMsg.message,
        });
        if (saved) {
          sentSuccessfully = true;
          handleIncomingMessage(saved);
        }
      } catch (err) {
        console.warn('REST sendChatMessage failed, falling back to WebSocket:', err);
      }

      // Secondary fallback: Send via livekitService or auxiliary WebSocket if REST failed
      if (!sentSuccessfully) {
        livekitService.sendChatMessage(optimisticMsg);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'chat', ...optimisticMsg }));
          } catch (e) {
            console.warn('Auxiliary WebSocket send warning:', e);
          }
        }
      }
    },
    [roundId, senderName, senderRole, handleIncomingMessage]
  );

  return {
    messages,
    unreadCount,
    sendMessage,
  };
}
