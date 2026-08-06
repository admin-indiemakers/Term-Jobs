import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [jdText, setJdText] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [error, setError] = useState('');
  const [screeningResult, setScreeningResult] = useState(null);
  const [shortlistedList, setShortlistedList] = useState([]);

  useEffect(() => {
    loadPublishedRequisitions();
    loadShortlistedCandidates();
  }, []);

  const formatJdText = (r) => {
    if (r.jd_text) return r.jd_text;
    if (r.generated_jd_markdown) {
      if (typeof r.generated_jd_markdown === 'string') return r.generated_jd_markdown;
      return JSON.stringify(r.generated_jd_markdown, null, 2);
    }
    if (r.structured_role) {
      return JSON.stringify(r.structured_role, null, 2);
    }
    if (r.description) return r.description;
    return `Role Title: ${r.title || 'Untitled Role'}\nStatus: ${r.status || 'Active'}`;
  };

  const loadPublishedRequisitions = async () => {
    setDbLoading(true);
    let list = [];

    try {
      // 1. Try Candidate Screening Agent API
      const data = await request('/api/requisitions');
      if (data && data.requisitions && data.requisitions.length > 0) {
        list = data.requisitions;
      } else if (Array.isArray(data) && data.length > 0) {
        list = data;
      }
    } catch {
      console.warn('API /api/requisitions failed, trying /requisitions...');
    }

    if (list.length === 0) {
      try {
        // 2. Try Core Backend Requisition API
        const raw = await request('/requisitions');
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
      setJdText(formatJdText(selected));
    }

    setDbLoading(false);
  };

  const loadShortlistedCandidates = async () => {
    try {
      const data = await request('/api/candidates/shortlisted');
      if (data && data.shortlisted_candidates) {
        setShortlistedList(data.shortlisted_candidates);
      }
    } catch (err) {
      console.error('Failed to load shortlisted candidates', err);
    }
  };

  const handleReqSelect = (e) => {
    const id = e.target.value;
    setSelectedReqId(id);
    const req = requisitions.find((r) => r.id === id);
    if (req) {
      setJdText(formatJdText(req));
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 className="page-title" style={{ color: '#0f172a', fontWeight: 800 }}>Recruiter Consultancy Dashboard</h1>
            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
              Consultancy Partner
            </span>
          </div>
          <p className="page-subtitle" style={{ color: '#475569' }}>
            Logged in as <strong>{user?.name}</strong> ({user?.email}) &bull; Agency: <strong>{user?.tenant_name || 'Vendor Agency'}</strong>
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Published Requisitions Card */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏢</span> Select Published Requisition (Client Company X)
          </h2>

          {dbLoading ? (
            <p style={{ color: '#64748b' }}>Loading active requisitions from PostgreSQL database...</p>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: '0.88rem', color: '#1e293b', marginBottom: '8px', fontWeight: 700 }}>
                Select Active Job Position ({requisitions.length} Available)
              </label>
              <select
                value={selectedReqId}
                onChange={handleReqSelect}
                style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px', cursor: 'pointer' }}
              >
                {requisitions.length === 0 ? (
                  <option value="">-- No Requisitions in Database --</option>
                ) : (
                  requisitions.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.status || 'Active'}] {r.title || 'Untitled Role'} (ID: {String(r.id).substring(0, 8)}...)
                    </option>
                  ))
                )}
              </select>

              <label style={{ display: 'block', fontSize: '0.88rem', color: '#1e293b', marginBottom: '8px', fontWeight: 700 }}>
                Job Description & Tech Requirements
              </label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Select a requisition above or paste job requirements here..."
                rows={7}
                style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '10px', color: '#0f172a', fontSize: '0.92rem', fontWeight: 500, resize: 'vertical' }}
              />
            </>
          )}
        </div>

        {/* Upload Resumes & Screen Card */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📄</span> Candidate Resume Upload & Intake
          </h2>

          <form onSubmit={handleScreenSubmit}>
            <label style={{ display: 'block', fontSize: '0.88rem', color: '#1e293b', marginBottom: '8px', fontWeight: 700 }}>
              Upload Candidate Resume PDF(s)
            </label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '2px dashed #6366f1', borderRadius: '10px', color: '#0f172a', fontWeight: 600, marginBottom: '16px', cursor: 'pointer' }}
            />

            {files.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {files.map((f, i) => (
                  <span key={i} style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#4f46e5', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 700 }}>
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
              style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', background: 'linear-gradient(135deg, #6366f1, #38bdf8)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {loading ? 'AI Screening in Progress...' : '⚡ Screen & Match Candidate Resumes'}
            </button>
          </form>
        </div>
      </div>

      {/* Screening Results Spotlight */}
      {screeningResult && (
        <div style={{ background: '#ffffff', border: '2px solid #6366f1', padding: '28px', borderRadius: '20px', marginBottom: '32px', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.12)' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px', color: '#4f46e5' }}>
            🎯 AI Candidate Match Leaderboard
          </h2>

          {screeningResult.ranked_candidates.map((cand, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', marginBottom: '12px', border: '1px solid #cbd5e1' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    #{cand.rank} {cand.candidate_name}
                  </span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {cand.recommendation}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                  Email: {cand.candidate_email || 'No email extracted'} &bull; File: {cand.filename}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7' }}>{cand.match_score}%</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Match Score</div>
                </div>

                <button
                  onClick={() => handleShortlistCandidate(cand.submission_id)}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Submit to Company X HR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Already Shortlisted Submissions in PostgreSQL */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏆</span> Shortlisted Submissions Sent to Company X HR ({shortlistedList.length})
        </h2>

        {shortlistedList.length === 0 ? (
          <p style={{ color: '#64748b' }}>No candidates submitted yet.</p>
        ) : (
          <div>
            {shortlistedList.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #cbd5e1' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{c.candidate_name}</strong>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Agency: <strong>{c.vendor_name || 'Vendor Partner'}</strong> &bull; Email: {c.candidate_email}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: '#0284c7', fontWeight: 800, fontSize: '1.05rem' }}>{c.match_score}%</span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                    Shortlisted in Postgres
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
