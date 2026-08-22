import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

export default function AssistantWidget() {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: '👋 Hello! I am your AI Hiring & Onboarding Assistant powered by Groq. Ask me about candidate onboarding, open issues, or tell me to fix/rectify an issue (e.g. "I fixed Hashil\'s VPN access").',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [openIssues, setOpenIssues] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const messagesEndRef = useRef(null);

  // Poll for open onboarding issues
  const fetchIssues = async () => {
    try {
      const data = await request('/api/onboarding/issues', { token });
      if (Array.isArray(data)) {
        const openList = data.filter((i) => i.status === 'open');
        setOpenIssues(openList);
        setBadgeCount(openList.length);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchIssues();
    const interval = setInterval(fetchIssues, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (user?.role !== 'Hiring Manager' && user?.role !== 'Admin') {
    return null;
  }

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsgText = input.trim();
    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: userMsgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await request('/api/onboarding/assistant', {
        method: 'POST',
        token,
        body: { message: userMsgText },
      });

      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: res.reply || 'Request processed.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resolvedIssues: res.resolved_issues || [],
      };

      setMessages((prev) => [...prev, aiMsg]);
      fetchIssues();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'ai',
          text: `Error connecting to AI Assistant: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bottom Right Floating Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#0f172a',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title="AI Assistant & Onboarding Notifications"
      >
        <span style={{ fontSize: '1.5rem' }}>✨</span>

        {/* Issue Notification Badge */}
        {badgeCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '999px',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
              animation: 'bounce 1s infinite alternate',
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            zIndex: 9999,
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            height: 520,
            maxHeight: 'calc(100vh - 120px)',
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Widget Header */}
          <div
            style={{
              padding: '16px 20px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                🤖
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>AI Onboarding Assistant</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Powered by Groq LLM</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Active Issues Banner */}
          {openIssues.length > 0 && (
            <div
              style={{
                background: '#fff7ed',
                borderBottom: '1px solid #fed7aa',
                padding: '10px 16px',
                fontSize: '0.78rem',
                color: '#9a3412',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🚩</span>
                <span>
                  <strong>{openIssues.length} candidate issue{openIssues.length > 1 ? 's' : ''}</strong> needing attention
                </span>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '84%',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: m.sender === 'user' ? '#0f172a' : '#ffffff',
                    color: m.sender === 'user' ? '#ffffff' : '#0f172a',
                    border: m.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                    fontSize: '0.84rem',
                    lineHeight: '1.45',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  {m.text}

                  {m.resolvedIssues && m.resolvedIssues.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0', color: '#059669', fontWeight: 700, fontSize: '0.76rem' }}>
                      ✓ Auto-rectified issue #{m.resolvedIssues.join(', #')}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    marginTop: 3,
                    textAlign: m.sender === 'user' ? 'right' : 'left',
                    padding: '0 4px',
                  }}
                >
                  {m.time}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: 12, fontSize: '0.8rem', color: '#64748b' }}>
                ✨ Thinking & processing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div style={{ padding: '8px 12px', background: '#ffffff', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 6, overflowX: 'auto' }}>
            <button
              type="button"
              onClick={() => setInput('What candidate issues are open right now?')}
              style={{ whiteSpace: 'nowrap', fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer' }}
            >
              ❓ Show open issues
            </button>
            {openIssues[0] && (
              <button
                type="button"
                onClick={() => setInput(`Rectified issue for ${openIssues[0].candidate_name}`)}
                style={{ whiteSpace: 'nowrap', fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', cursor: 'pointer' }}
              >
                ✅ Mark {openIssues[0].candidate_name} issue fixed
              </button>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={handleSend} style={{ display: 'flex', padding: 12, background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI or type e.g. 'Fixed VPN issue for Hashil'..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.83rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                marginLeft: 8,
                padding: '8px 16px',
                borderRadius: 8,
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.83rem',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: !input.trim() || loading ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
