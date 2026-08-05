import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function NewRequisition() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [mode, setMode] = useState('guided');
  const [title, setTitle] = useState('');
  const [techStackHint, setTechStackHint] = useState('');
  const [prompt, setPrompt] = useState('');
  const [companyProfileId, setCompanyProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/company-profiles', { token })
      .then((profiles) => {
        const own = (profiles || []).filter((p) => p.tenant_id === user.tenant_id);
        const list = own.length ? own : profiles || [];
        setProfiles(list);
        if (list.length) setCompanyProfileId(list[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, user.tenant_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyProfileId) {
      setError('No company profile available. Please register a company workspace first.');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        company_profile_id: companyProfileId,
        title,
        created_by: user.id,
      };
      if (mode === 'guided') {
        body.tech_stack_hint = techStackHint
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        body.prompt = '';
      } else {
        body.prompt = prompt;
        body.tech_stack_hint = [];
      }
      const req = await request('/requisitions', { method: 'POST', body, token });
      navigate(`/dashboard/requisitions/${req.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Requisition</h1>
          <p className="page-subtitle">Tell us the role you need — the AI will structure it and draft the JD.</p>
        </div>
        <Link to="/dashboard/requisitions" className="ghost-btn-link">← Back to list</Link>
      </div>

      {loading ? (
        <p className="muted">Loading company profile...</p>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel form-card">
          {error && <div className="alert alert-error">{error}</div>}

          <div>
            <label className="form-label">Company / Profile</label>
            <select
              className="auth-input"
              value={companyProfileId}
              onChange={(e) => setCompanyProfileId(e.target.value)}
              required
            >
              {profiles.length === 0 && <option value="">No profile available</option>}
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.location || 'Location TBD'}
                </option>
              ))}
            </select>
            {profiles.length === 0 && (
              <p className="field-hint">
                A company profile is created when you register a workspace. Re-register your workspace to continue.
              </p>
            )}
          </div>

          <div>
            <label className="form-label">Role Title <span className="required">*</span></label>
            <input
              className="auth-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              required
            />
          </div>

          <div>
            <label className="form-label">How should the AI work?</label>
            <div className="mode-tabs">
              <button type="button" className={`mode-tab ${mode === 'guided' ? 'active' : ''}`} onClick={() => setMode('guided')}>
                Guided intake
              </button>
              <button type="button" className={`mode-tab ${mode === 'prompt' ? 'active' : ''}`} onClick={() => setMode('prompt')}>
                Paste JD directly
              </button>
            </div>
          </div>

          {mode === 'guided' ? (
            <div>
              <label className="form-label">Tech Stack Hint (comma-separated, optional)</label>
              <input
                className="auth-input"
                value={techStackHint}
                onChange={(e) => setTechStackHint(e.target.value)}
                placeholder="Python, FastAPI, PostgreSQL"
              />
              <p className="field-hint">The agent will ask targeted questions to fill any gaps before generating the role.</p>
            </div>
          ) : (
            <div>
              <label className="form-label">Full Job Description / Requirements</label>
              <textarea
                className="auth-input"
                rows="10"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste the raw JD text — the agent parses the whole role from it in one pass."
                required
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}

          <button type="submit" className="glow-btn" disabled={submitting || profiles.length === 0}>
            {submitting ? 'Creating...' : 'Create & Start Agent'}
          </button>
        </form>
      )}
    </div>
  );
}
