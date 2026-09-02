import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import { Sparkles, X, AlertCircle, CheckCircle2, Send, Bot } from 'lucide-react';

export default function AssistantWidget({ isOpen, setIsOpen }) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your AI Hiring & Onboarding Assistant. Ask me about candidate onboarding, open issues, or tell me to fix/rectify an issue (e.g. "I fixed Hashil\'s VPN access").',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [openIssues, setOpenIssues] = useState([]);
  const messagesEndRef = useRef(null);

  // Poll for open onboarding issues
  const fetchIssues = async () => {
    try {
      const data = await request('/api/onboarding/issues', { token });
      if (Array.isArray(data)) {
        const openList = data.filter((i) => i.status === 'open');
        setOpenIssues(openList);
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
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMsg = {
      id: String(Date.now()),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await request('/api/onboarding/assistant/chat', {
        method: 'POST',
        token,
        body: {
          prompt: userText,
          user_role: user?.role || 'Hiring Manager',
          user_name: user?.name || 'User',
        },
      });

      const aiMsg = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: data.reply || 'I processed your request.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resolvedIssues: data.resolved_issues || [],
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (data.resolved_issues && data.resolved_issues.length > 0) {
        fetchIssues();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'ai',
          text: `Error: ${err.message || 'Could not communicate with the AI assistant.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // If closed, render nothing (no floating button at bottom)
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,
        right: 20,
        zIndex: 9999,
        width: 390,
        maxWidth: 'calc(100vw - 32px)',
        height: 540,
        maxHeight: 'calc(100vh - 84px)',
        background: '#FFFFFF',
        borderRadius: 20,
        border: '1px solid #E2E2DC',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
      className="animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Top Header */}
      <div
        style={{
          padding: '14px 18px',
          background: '#0A0A0A',
          color: '#FFFFFF',
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
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.01em' }}>
              AI Hiring Assistant
            </div>
            <div style={{ fontSize: '0.72rem', color: '#A3A3A3' }}>
              Powered by Groq LLM
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#A3A3A3',
            cursor: 'pointer',
            padding: 4,
          }}
          className="hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Active Issues Banner */}
      {openIssues.length > 0 && (
        <div
          style={{
            background: '#FFF7ED',
            borderBottom: '1px solid #FED7AA',
            padding: '8px 16px',
            fontSize: '0.78rem',
            color: '#9A3412',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} className="text-[#EA580C]" />
            <span>
              <strong>{openIssues.length} candidate issue{openIssues.length > 1 ? 's' : ''}</strong> needing attention
            </span>
          </div>
        </div>
      )}

      {/* Chat Messages List */}
      <div
        style={{
          flex: 1,
          padding: 16,
          overflowY: 'auto',
          background: '#F8FAF9',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: m.sender === 'user' ? '#0A0A0A' : '#FFFFFF',
                color: m.sender === 'user' ? '#FFFFFF' : '#0A0A0A',
                border: m.sender === 'user' ? 'none' : '1px solid #E2E2DC',
                fontSize: '0.84rem',
                lineHeight: '1.45',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
              }}
            >
              {m.text}

              {m.resolvedIssues && m.resolvedIssues.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 6,
                    borderTop: '1px solid #E2E2DC',
                    color: '#059669',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>Auto-rectified issue #{m.resolvedIssues.join(', #')}</span>
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                color: '#8A8A85',
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
          <div
            style={{
              alignSelf: 'flex-start',
              background: '#FFFFFF',
              border: '1px solid #E2E2DC',
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: '0.8rem',
              color: '#737373',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Bot size={14} className="animate-pulse" />
            <span>Thinking & processing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div
        style={{
          padding: '8px 12px',
          background: '#FFFFFF',
          borderTop: '1px solid #F2F2EE',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setInput('What candidate issues are open right now?')}
          style={{
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#F5F5F2',
            color: '#0A0A0A',
            border: '1px solid #E2E2DC',
            cursor: 'pointer',
          }}
          className="hover:bg-[#EAEAE6] transition-colors"
        >
          Show open issues
        </button>
        {openIssues[0] && (
          <button
            type="button"
            onClick={() => setInput(`Rectified issue for ${openIssues[0].candidate_name}`)}
            style={{
              whiteSpace: 'nowrap',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 999,
              background: '#ECFDF5',
              color: '#047857',
              border: '1px solid #A7F3D0',
              cursor: 'pointer',
            }}
          >
            Mark {openIssues[0].candidate_name} fixed
          </button>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          padding: 12,
          background: '#FFFFFF',
          borderTop: '1px solid #E2E2DC',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI e.g. 'Fixed VPN issue for Hashil'..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #E2E2DC',
            fontSize: '0.83rem',
            outline: 'none',
          }}
          className="focus:border-[#0A0A0A] transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{
            marginLeft: 8,
            padding: '8px 14px',
            borderRadius: 10,
            background: '#0A0A0A',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '0.83rem',
            fontWeight: 700,
            cursor: 'pointer',
            opacity: !input.trim() || loading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          className="hover:bg-[#262626] transition-colors"
        >
          <Send size={13} />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
