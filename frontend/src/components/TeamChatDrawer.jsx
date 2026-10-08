import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  X,
  Search,
  SlidersHorizontal,
  Phone,
  Video,
  MoreVertical,
  Mic,
  ArrowRight,
  Plus,
  Users,
  Check,
  CheckCheck,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

export default function TeamChatDrawer({ isOpen, onClose, currentUserName }) {
  const { user, token } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatPermissions, setChatPermissions] = useState({
    enabled: true,
    current_user_can_chat: true,
  });
  const [errorMessage, setErrorMessage] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Fetch real chat metadata & contacts from backend
  const fetchChatMetadata = useCallback(async () => {
    if (!token) return;
    try {
      const permRes = await request('/api/team-chat/permissions', { token, noCache: true, forceRefresh: true }).catch(() => null);
      if (permRes) {
        setChatPermissions(permRes);
      }

      const contactsRes = await request('/api/team-chat/contacts', { token, noCache: true, forceRefresh: true }).catch(() => null);
      if (Array.isArray(contactsRes)) {
        setContacts(contactsRes);
        setActiveContactId((prev) => {
          if (prev && contactsRes.some((c) => c.id === prev)) {
            return prev;
          }
          return contactsRes[0]?.id || null;
        });
      }
    } catch (err) {
      console.warn('Failed to load team chat metadata:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [token]);

  // 2. Fetch real message history for active contact
  const fetchActiveMessages = useCallback(async (peerId, isBackground = false) => {
    if (!token || !peerId) return;
    if (!isBackground) setLoadingMessages(true);

    try {
      const msgs = await request(`/api/team-chat/messages?peer_id=${peerId}`, {
        token,
        noCache: true,
        forceRefresh: true
      });
      if (Array.isArray(msgs)) {
        setMessages((prev) => {
          // Keep any optimistic in-flight messages so they never disappear during polling
          const pending = prev.filter(
            (m) => m.status === 'sending' || (m.id && String(m.id).startsWith('temp-'))
          );
          if (pending.length === 0) return msgs;

          const serverIds = new Set(msgs.map((m) => String(m.id)));
          const remainingPending = pending.filter((p) => {
            if (serverIds.has(String(p.id))) return false;
            // Check if server already has this exact text from current user sent within last 15s
            const alreadyInServer = msgs.some(
              (s) =>
                (s.sender === 'me' || s.sender_id === user?.id) &&
                s.text === p.text &&
                Math.abs(new Date(s.created_at || Date.now()) - new Date(p.created_at || Date.now())) < 15000
            );
            return !alreadyInServer;
          });

          return [...msgs, ...remainingPending];
        });
        if (!isBackground) {
          setTimeout(() => scrollToBottom('auto'), 50);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch messages for peer:', err);
    } finally {
      if (!isBackground) setLoadingMessages(false);
    }
  }, [token, user?.id]);

  // Load metadata on open
  useEffect(() => {
    if (isOpen) {
      fetchChatMetadata();
    }
  }, [isOpen, fetchChatMetadata]);

  // Load messages when active contact changes
  useEffect(() => {
    if (isOpen && activeContactId) {
      fetchActiveMessages(activeContactId, false);
    } else {
      setMessages([]);
    }
  }, [isOpen, activeContactId, fetchActiveMessages]);

  // Real-time polling loop (every 3.5s while open)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      if (activeContactId) {
        fetchActiveMessages(activeContactId, true);
      }
      request('/api/team-chat/contacts', { token, noCache: true, forceRefresh: true })
        .then((freshContacts) => {
          if (Array.isArray(freshContacts)) {
            setContacts(freshContacts);
          }
        })
        .catch(() => {});
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen, activeContactId, token, fetchActiveMessages]);

  // Send real message to backend
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !activeContactId || sendingMessage) return;

    if (!chatPermissions.enabled || !chatPermissions.current_user_can_chat) {
      setErrorMessage('Your team messaging access is restricted by Company Admin.');
      return;
    }

    setErrorMessage('');
    setInputText('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: user?.id,
      sender_name: currentUserName || user?.name || 'Me',
      sender: 'me',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    setContacts((prev) =>
      prev.map((c) => (c.id === activeContactId ? { ...c, last_message: textToSend, last_time: 'Just now' } : c))
    );

    try {
      setSendingMessage(true);
      const res = await request('/api/team-chat/messages', {
        method: 'POST',
        token,
        noCache: true,
        forceRefresh: true,
        body: {
          peer_id: activeContactId,
          text: textToSend
        }
      });

      if (res && res.id) {
        setMessages((prev) => {
          // If server message is already in state from background poll, remove temp
          const existsById = prev.some((m) => String(m.id) === String(res.id));
          if (existsById) {
            return prev.filter((m) => m.id !== tempId);
          }
          // Otherwise smoothly replace tempId with confirmed server message
          const hasTemp = prev.some((m) => m.id === tempId);
          if (hasTemp) {
            return prev.map((m) => (m.id === tempId ? { ...res, sender: 'me', status: 'sent' } : m));
          }
          return [...prev, { ...res, sender: 'me', status: 'sent' }];
        });
        setTimeout(() => scrollToBottom('smooth'), 40);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setErrorMessage(err.message || 'Failed to send message.');
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setSendingMessage(false);
      inputRef.current?.focus();
    }
  };

  const activeContact = contacts.find((c) => c.id === activeContactId) || contacts[0] || null;

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q) ||
      (c.last_message || '').toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden text-left font-sans select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-2xs cursor-pointer"
          />

          {/* Sliding Drawer Container matching user reference card layout */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute top-0 right-0 bottom-0 w-full sm:w-[410px] sm:max-w-[420px] sm:m-3 sm:h-[calc(100%-24px)] bg-[#FAFBFD] sm:rounded-3xl border border-gray-200/90 shadow-2xl flex flex-col z-10 overflow-hidden"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {/* ── TOP HEADER (Exact Image Match) ───────────────────────── */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 bg-transparent shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-2xl bg-white border border-gray-200/90 shadow-3xs flex items-center justify-center text-gray-900">
                  <MessageSquare size={16} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-gray-950 tracking-tight leading-none">
                    Team Chat
                  </h2>
                  <p className="text-[10.5px] text-gray-500 mt-0.5">
                    Chat with company admins and hiring managers
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-xl hover:bg-gray-200/70 text-gray-600 hover:text-gray-950 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── RESTRICTION NOTICE IF CHAT PAUSED ────────────────────── */}
            {(!chatPermissions.enabled || !chatPermissions.current_user_can_chat) && (
              <div className="mx-3.5 mb-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-2 shrink-0">
                <ShieldAlert size={13} className="shrink-0 text-amber-600" />
                <span>
                  {!chatPermissions.enabled
                    ? 'Team chat has been paused by Company Administration.'
                    : 'Your messaging access has been restricted by your Company Admin.'}
                </span>
              </div>
            )}

            {/* ── SEARCH & FILTER BAR (Exact Image Match) ──────────────── */}
            <div className="px-3.5 pb-2.5 bg-transparent shrink-0 flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search size={13.5} className="absolute left-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-8.5 pr-3 py-2 bg-[#F1F3F6] focus:bg-white rounded-2xl border border-transparent focus:border-gray-300 text-xs text-gray-900 placeholder-gray-400 focus:outline-none transition-all shadow-inner-xs"
                />
              </div>

              <button
                type="button"
                className="w-8.5 h-8.5 rounded-2xl bg-white border border-gray-200/90 shadow-3xs hover:bg-gray-50 text-gray-700 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Filter conversations"
              >
                <SlidersHorizontal size={13.5} />
              </button>
            </div>

            {/* ── CONVERSATIONS LIST (Top Half - Exact Image Match) ────── */}
            <div className="h-[210px] sm:h-[220px] overflow-y-auto px-2 space-y-1 divide-y divide-transparent shrink-0 custom-scrollbar">
              {loadingContacts ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs gap-2">
                  <Loader2 size={14} className="animate-spin text-gray-500" />
                  <span>Loading team directory...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-3 text-gray-400 text-xs">
                  <Users size={20} className="text-gray-300 mb-1" />
                  <p className="font-semibold text-gray-700">No colleagues found</p>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">
                    {searchQuery ? `No matches for "${searchQuery}"` : 'Team members in your company will appear here'}
                  </p>
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const isSelected = c.id === activeContactId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveContactId(c.id)}
                      className={`px-2.5 py-2 rounded-2xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EFF2F6]' : 'hover:bg-gray-100/70'
                      }`}
                    >
                      {/* Avatar with Green Online Dot */}
                      <div className="relative shrink-0">
                        {c.avatar ? (
                          <img src={c.avatar} alt={c.name} className="w-8.5 h-8.5 rounded-full object-cover" />
                        ) : c.role?.toLowerCase().includes('admin') ? (
                          <div className="w-8.5 h-8.5 rounded-full bg-black text-white font-black text-xs flex items-center justify-center shadow-3xs">
                            {c.initials || (c.name || 'A').charAt(0)}
                          </div>
                        ) : (
                          <div className="w-8.5 h-8.5 rounded-full bg-gray-200 text-gray-800 font-bold text-xs flex items-center justify-center">
                            {c.initials || (c.name || 'U').charAt(0)}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                      </div>

                      {/* Contact Info & Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-gray-900 truncate">{c.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono shrink-0">{c.last_time || ''}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-500 truncate mt-0.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0 text-center text-[7px] leading-tight text-gray-300">○</span>
                          <span className="truncate">{c.last_message || 'No messages yet'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── ACTIVE CHAT THREAD (Bottom Half - Exact Image Match) ─── */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#FAFBFD] border-t border-gray-200/70">
              {/* Active Contact Header */}
              {activeContact && (
                <div className="px-4 py-2 bg-transparent flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {activeContact.avatar ? (
                        <img src={activeContact.avatar} alt={activeContact.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center">
                          {activeContact.initials || (activeContact.name || 'U').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-950 leading-tight truncate">
                        {activeContact.name}
                      </h4>
                      <div className="flex items-center gap-1 text-[10.5px] text-gray-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Online</span>
                      </div>
                    </div>
                  </div>

                  {/* Header Quick Action Icons (Phone, Video, Options) */}
                  <div className="flex items-center gap-1 text-gray-600">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-xl hover:bg-gray-100 flex items-center justify-center transition cursor-pointer text-gray-700"
                      title="Call"
                    >
                      <Phone size={13.5} />
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-xl hover:bg-gray-100 flex items-center justify-center transition cursor-pointer text-gray-700"
                      title="Video Call"
                    >
                      <Video size={13.5} />
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-xl hover:bg-gray-100 flex items-center justify-center transition cursor-pointer text-gray-700"
                      title="More Options"
                    >
                      <MoreVertical size={13.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* Error Toast */}
              {errorMessage && (
                <div className="mx-3 mt-1 p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-1.5">
                  <span className="truncate">{errorMessage}</span>
                  <button type="button" onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700">
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 custom-scrollbar select-text">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs gap-2">
                    <Loader2 size={14} className="animate-spin text-gray-500" />
                    <span>Loading conversation...</span>
                  </div>
                ) : !activeContact ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs">
                    <MessageSquare size={24} className="text-gray-300 mb-1" />
                    <p className="font-semibold text-gray-700">Select a colleague above</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs p-4">
                    <p className="font-bold text-gray-800">No messages yet</p>
                    <p className="text-[11px] text-gray-500 mt-1 max-w-[220px]">
                      Send a message to start communicating with {activeContact.name}
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender === 'me' || m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Bubble */}
                        <div
                          className={`max-w-[85%] px-3.5 py-2 text-xs leading-relaxed break-words shadow-3xs select-text ${
                            isMe
                              ? 'bg-[#0B0D11] text-white rounded-2xl rounded-tr-xs'
                              : 'bg-[#E5E9EE] text-gray-900 rounded-2xl rounded-tl-xs'
                          }`}
                        >
                          {m.text}
                        </div>

                        {/* Timestamp & Status Icon */}
                        <div className="flex items-center gap-1 text-[9.5px] text-gray-400 font-mono mt-1 px-1">
                          <span>{m.time}</span>
                          {isMe && (
                            m.status === 'read' ? (
                              <CheckCheck size={11} className="text-emerald-500" />
                            ) : m.status === 'failed' ? (
                              <span className="text-red-500 text-[9px] font-sans">Failed</span>
                            ) : (
                              <Check size={11} className="text-gray-400" />
                            )
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── BOTTOM INPUT DOCK (Exact Image Match) ────────────────── */}
              <form onSubmit={handleSendMessage} className="p-3 bg-transparent flex items-center gap-2 shrink-0">
                {/* Plus (+) Button on the left */}
                <button
                  type="button"
                  className="w-9 h-9 rounded-2xl bg-white border border-gray-200/90 shadow-3xs hover:bg-gray-50 text-gray-700 flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Add Attachment"
                >
                  <Plus size={16} />
                </button>

                {/* Main Input Pill with Mic on the right */}
                <div className="flex-1 relative flex items-center bg-white border border-gray-200/90 rounded-full px-3.5 py-1.5 shadow-3xs">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      !activeContact
                        ? 'Select a colleague above...'
                        : !chatPermissions.enabled || !chatPermissions.current_user_can_chat
                        ? 'Messaging is currently restricted...'
                        : 'Type a message...'
                    }
                    disabled={!activeContact || !chatPermissions.enabled || !chatPermissions.current_user_can_chat}
                    className="w-full text-xs text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent pr-6 disabled:opacity-50"
                  />

                  {/* Mic icon inside the pill on right */}
                  <button
                    type="button"
                    className="absolute right-3 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                    title="Voice input"
                  >
                    <Mic size={14} />
                  </button>
                </div>

                {/* Send Button on far right (Circle with Right Arrow) */}
                <button
                  type="submit"
                  disabled={!inputText.trim() || !activeContact || sendingMessage || !chatPermissions.enabled || !chatPermissions.current_user_can_chat}
                  className="w-9 h-9 rounded-full bg-gray-400 disabled:opacity-40 enabled:bg-[#0B0D11] text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95"
                  title="Send message"
                >
                  {sendingMessage ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ArrowRight size={15} />
                  )}
                </button>
              </form>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
