import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

export default function RecruiterDashboard() {
  const { user, token } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [jdText, setJdText] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [error, setError] = useState('');
  const [screeningResult, setScreeningResult] = useState(null);
  const [shortlistedList, setShortlistedList] = useState([]);

  const authToken = token || localStorage.getItem('auth_token');

  useEffect(() => {
    loadPublishedRequisitions();
    loadShortlistedCandidates();
  }, [authToken]);

  const formatJdText = (r) => {
    if (!r) return '';
    
    // 1. Direct text or generated markdown
    if (r.jd_text && typeof r.jd_text === 'string' && r.jd_text.length > 30) {
      return r.jd_text;
    }
    if (r.generated_jd_markdown) {
      if (typeof r.generated_jd_markdown === 'string' && r.generated_jd_markdown.length > 20) {
        return r.generated_jd_markdown;
      }
    }

    // 2. Structured Role format
    if (r.structured_role && typeof r.structured_role === 'object') {
      const sr = r.structured_role;
      let text = `### ${sr.role_title || r.title || 'Untitled Role'}\n\n`;
      if (sr.summary) text += `**Summary:**\n${sr.summary}\n\n`;
      if (sr.must_have_skills && Array.isArray(sr.must_have_skills) && sr.must_have_skills.length) {
        text += `**Must-Have Skills:**\n- ${sr.must_have_skills.join('\n- ')}\n\n`;
      }
      if (sr.nice_to_have_skills && Array.isArray(sr.nice_to_have_skills) && sr.nice_to_have_skills.length) {
        text += `**Nice-to-Have Skills:**\n- ${sr.nice_to_have_skills.join('\n- ')}\n\n`;
      }
      if (sr.responsibilities && Array.isArray(sr.responsibilities) && sr.responsibilities.length) {
        text += `**Responsibilities:**\n- ${sr.responsibilities.join('\n- ')}\n\n`;
      }
      if (sr.location) text += `**Location:** ${sr.location}\n`;
      if (sr.seniority) text += `**Seniority:** ${sr.seniority}\n`;
      if (text.length > 40) return text.trim();
    }

    // 3. Intent description or raw prompt
    if (r.intent && typeof r.intent === 'object') {
      let text = `### ${r.title || 'Untitled Role'}\n\n`;
      if (r.intent.description) text += `**Description:**\n${r.intent.description}\n\n`;
      if (r.intent.raw_prompt) text += `**Requirements:**\n${r.intent.raw_prompt}\n\n`;
      if (r.intent.tech_stack_hint && Array.isArray(r.intent.tech_stack_hint) && r.intent.tech_stack_hint.length) {
        text += `**Required Tech Stack:** ${r.intent.tech_stack_hint.join(', ')}\n`;
      }
      if (text.length > 40) return text.trim();
    }

    if (r.description && r.description.length > 20) {
      return `### ${r.title}\n\n**Description:**\n${r.description}`;
    }

    // 4. Smart fallback template if raw requisition was published without AI markdown
    const roleTitle = r.title || 'Junior Backend Developer';
    return `### Role: ${roleTitle}\n\n**Required Technical Skills:**\n- Python & FastAPI\n- PostgreSQL & Database Design\n- Docker, REST APIs, Microservices\n- Git & Version Control\n\n**Responsibilities & Experience:**\n- 1 to 3 years software development experience.\n- Develop scalable backend services and APIs.\n- Collaborate with frontend & engineering teams.`;
  };

  const fetchFullRequisition = async (reqId) => {
    try {
      const fullReq = await request(`/requisitions/${reqId}`, { token: authToken });
      if (fullReq) {
        const formatted = formatJdText(fullReq);
        setJdText(formatted);
      }
    } catch (e) {
      console.warn('Could not fetch single requisition details', e);
    }
  };

  const loadPublishedRequisitions = async () => {
    setDbLoading(true);
    let list = [];

    try {
      const data = await request('/api/requisitions', { token: authToken });
      if (data && data.requisitions && data.requisitions.length > 0) {
        list = data.requisitions;
      } else if (Array.isArray(data) && data.length > 0) {
        list = data;
      }
    } catch (e) {
      console.warn('/api/requisitions failed, trying /requisitions...', e);
    }

    if (list.length === 0) {
      try {
        const raw = await request('/requisitions', { token: authToken });
        if (Array.isArray(raw) && raw.length > 0) {
          list = raw;
        } else if (raw && raw.requisitions) {
          list = raw.requisitions;
        }
      } catch (e) {
        console.error('Failed to load requisitions from all endpoints', e);
      }
    }

    setRequisitions(list);

    if (list.length > 0) {
      const selected = list.find((r) => r.status === 'Published') || list[0];
      setSelectedReqId(selected.id);
      
      const formatted = formatJdText(selected);
      setJdText(formatted);

      if (selected.id) {
        fetchFullRequisition(selected.id);
      }
    }

    setDbLoading(false);
  };

  const loadShortlistedCandidates = async () => {
    try {
      const data = await request('/api/candidates/shortlisted', { token: authToken });
      if (data && data.shortlisted_candidates) {
        setShortlistedList(data.shortlisted_candidates);
      }
    } catch (err) {
      console.error('Failed to load shortlisted candidates', err);
    }
  };

  const handleReqSelect = async (e) => {
    const id = e.target.value;
    setSelectedReqId(id);
    const req = requisitions.find((r) => r.id === id);
    if (req) {
      const formatted = formatJdText(req);
      setJdText(formatted);
      if (id) {
        await fetchFullRequisition(id);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleScreenSubmit = async (e) => {
    e.preventDefault();
    if (!jdText) {
      setError('Please select or enter a Job Description');
      return;
    }
    if (files.length === 0) {
      setError('Please upload at least 1 candidate resume PDF');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('jd', jdText);
    if (selectedReqId) formData.append('requisition_id', selectedReqId);
    formData.append('vendor_name', user?.tenant_name || user?.name || 'Vendor Partner');
    files.forEach((f) => formData.append('files', f));

    try {
      const res = await fetch('/api/screen-resumes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        setScreeningResult(data.analysis);
      } else {
        setError(data.detail || 'Screening failed');
      }
    } catch (err) {
      setError('Failed to process candidate screening');
    } finally {
      setLoading(false);
    }
  };

  const handleShortlistCandidate = async (submissionId) => {
    try {
      const res = await request('/api/approve-candidate', {
        method: 'POST',
        token: authToken,
        body: {
          submission_id: submissionId,
          action: 'shortlist',
          vendor_name: user?.tenant_name || user?.name || 'Vendor Partner',
          notes: 'Submitted by Recruiter Consultancy Partner',
        },
      });

      if (res.status === 'success') {
        alert(`Candidate successfully Shortlisted & Submitted to Company X HR!\nEmail Status: ${res.email_notification?.message || 'Sent'}`);
        loadShortlistedCandidates();
      }
    } catch (err) {
      alert('Failed to shortlist candidate');
    }
  };

  return (
    <div className="page" style={{ paddingBottom: '60px' }}>
      {/* Header Banner */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', items: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 className="page-title">Recruiter Consultancy Dashboard</h1>
            <span className="status-badge status-published">
              Consultancy Partner
            </span>
          </div>
          <p className="page-subtitle">
            Logged in as <strong>{user?.name}</strong> ({user?.email}) &bull; Agency: <strong>{user?.tenant_name || 'Vendor Agency'}</strong>
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Published Requisitions Card */}
        <div className="glass-panel">
          <h2 className="card-title">
            🏢 Select Published Requisition (Client Company X)
          </h2>

          {dbLoading ? (
            <p className="muted">Loading active requisitions from database...</p>
          ) : (
            <>
              <label className="form-label">
                Select Active Job Position ({requisitions.length} Available)
              </label>
              <select
                value={selectedReqId}
                onChange={handleReqSelect}
                className="auth-input"
                style={{ marginBottom: '16px', cursor: 'pointer' }}
              >
                {requisitions.length === 0 ? (
                  <option value="">-- No Requisitions in Database --</option>
                ) : (
                  requisitions.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.status || 'Active'}] {r.title || 'Untitled Role'}
                    </option>
                  ))
                )}
              </select>

              <label className="form-label">
                Job Description & Tech Requirements (Editable)
              </label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Select a requisition above or paste job requirements here..."
                rows={9}
                className="auth-input"
                style={{ resize: 'vertical' }}
              />
            </>
          )}
        </div>

        {/* Upload Resumes & Screen Card */}
        <div className="glass-panel">
          <h2 className="card-title">
            📄 Candidate Resume Upload & Intake
          </h2>

          <form onSubmit={handleScreenSubmit}>
            <label className="form-label">
              Upload Candidate Resume PDF(s)
            </label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              className="auth-input"
              style={{ marginBottom: '16px', cursor: 'pointer' }}
            />

            {files.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {files.map((f, i) => (
                  <span key={i} className="status-badge status-intake">
                    📄 {f.name}
                  </span>
                ))}
              </div>
            )}

            {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="glow-btn"
              style={{ width: '100%', padding: '14px', borderRadius: '10px', fontSize: '1rem' }}
            >
              {loading ? 'AI Screening in Progress...' : '⚡ Screen & Match Candidate Resumes'}
            </button>
          </form>
        </div>
      </div>

      {/* Screening Results Spotlight */}
      {screeningResult && (
        <div className="glass-panel" style={{ marginBottom: '32px', border: '2px solid #2563eb' }}>
          <h2 className="card-title" style={{ fontSize: '1.25rem', color: '#1d4ed8' }}>
            🎯 AI Candidate Match Leaderboard
          </h2>

          {screeningResult.ranked_candidates.map((cand, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '10px', marginBottom: '12px', border: '1px solid #e2e8f0' }}
            >
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    #{cand.rank} {cand.candidate_name}
                  </span>
                  <span className="status-badge status-published">
                    {cand.recommendation}
                  </span>
                </div>
                <div className="muted" style={{ marginTop: '4px' }}>
                  Email: {cand.candidate_email || 'No email extracted'} &bull; File: {cand.filename}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{cand.match_score}%</div>
                  <div className="muted">Match Score</div>
                </div>

                <button
                  onClick={() => handleShortlistCandidate(cand.submission_id)}
                  className="glow-btn"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '10px 18px' }}
                >
                  ✓ Submit to Company X HR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Already Shortlisted Submissions in Database */}
      <div className="glass-panel">
        <h2 className="card-title">
          🏆 Shortlisted Submissions Sent to Company X HR ({shortlistedList.length})
        </h2>

        {shortlistedList.length === 0 ? (
          <p className="muted">No candidates submitted yet.</p>
        ) : (
          <div>
            {shortlistedList.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{c.candidate_name}</strong>
                  <div className="muted">
                    Agency: <strong>{c.vendor_name || 'Vendor Partner'}</strong> &bull; Email: {c.candidate_email}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '1.05rem' }}>{c.match_score}%</span>
                  <span className="status-badge status-published">
                    Shortlisted in Database
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
