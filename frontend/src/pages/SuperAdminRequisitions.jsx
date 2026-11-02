import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Building2, Plus, Users, FileText, X, RefreshCw, ExternalLink } from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ResumePreviewModal from '../components/ResumePreviewModal';

const emptyForm = () => ({ client_request_id: crypto.randomUUID(), company_name: '', title: '', department: '', location: '', work_mode: '', experience: '', duration: '', headcount: 1, start_date: '', submission_deadline: '', skills: '', job_description: '' });
const fields = [
  ['company_name', 'Company name', 'Company you are hiring for'], ['title', 'Job title', 'e.g. Digital Marketing Specialist'],
  ['department', 'Department', 'e.g. Sales'], ['location', 'Location', 'e.g. Kozhikode'],
  ['experience', 'Experience', 'e.g. Mid (3–5 years)'], ['duration', 'Contract period', 'e.g. 6 months'],
  ['start_date', 'Target start date', 'e.g. November 2026 or 2026-11-15'],
];
const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15';

export default function SuperAdminRequisitions() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantError, setApplicantError] = useState('');
  const [preview, setPreview] = useState(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await request('/api/superadmin/requisitions', { token, noCache: true })); }
    catch (err) { setError(err.message || 'Could not load requisitions.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { if (token) load(); }, [token, load]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingApplicants(true);
    setApplicants([]);
    setApplicantError('');
    request(`/api/superadmin/requisitions/${selected.id}/applicants`, { token, noCache: true })
      .then(data => { if (!cancelled) setApplicants(data); })
      .catch(err => { if (!cancelled) setApplicantError(err.message || 'Could not load applicants.'); })
      .finally(() => { if (!cancelled) setLoadingApplicants(false); });
    return () => { cancelled = true; };
  }, [selected, token]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const publish = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const result = await request('/api/superadmin/requisitions', {
        method: 'POST', token, body: { ...form, headcount: Number(form.headcount), skills: form.skills.split(',').map(s => s.trim()).filter(Boolean) },
      });
      setSuccess(`${result.title} for ${result.company_name} is published on Open Roles.`);
      setShowForm(false); setForm(emptyForm()); setSelected(result);
      await load();
    } catch (err) { setError(err.message || 'Could not publish requisition.'); }
    finally { setSaving(false); }
  };
  const closePosting = async () => {
    setClosing(true); setError('');
    try {
      await request(`/api/superadmin/requisitions/${selected.id}/close`, { method: 'POST', token });
      setSelected(prev => ({ ...prev, status: 'Closed' }));
      setSuccess('Requisition closed. Existing applicants remain available.');
      await load();
    } catch (err) { setError(err.message || 'Could not close requisition.'); }
    finally { setClosing(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase size={25} /> Company Requisitions</h1>
            <p className="mt-2 text-sm text-gray-500">Post contract roles on behalf of companies and review their applicants.</p></div>
          <div className="flex gap-2">
            <button type="button" aria-label="Refresh requisitions" onClick={load} disabled={loading} className="rounded-xl border bg-white p-3"><RefreshCw size={18} /></button>
            <button type="button" onClick={() => setShowForm(prev => !prev)} className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17} /> Post Requisition</button>
          </div>
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}
        {showForm && (
          <form onSubmit={publish} className="rounded-2xl border bg-white p-5 sm:p-7 space-y-5">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Post a company requisition</h2><button type="button" aria-label="Close posting form" disabled={saving} onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <p className="text-sm text-gray-500">All fields are required. Publishing makes this role available on the public Open Roles page.</p>
            <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
              {fields.map(([key, label, placeholder]) => <label key={key} className="space-y-1.5 text-sm font-medium"><span>{label}</span><input className={inputClass} required maxLength={key === 'start_date' || key === 'experience' || key === 'department' ? 100 : 200} value={form[key]} placeholder={placeholder} onChange={e => update(key, e.target.value)} /></label>)}
              <label className="space-y-1.5 text-sm font-medium"><span>Work mode</span><select required className={inputClass} value={form.work_mode} onChange={e => update('work_mode', e.target.value)}><option value="">Choose work mode</option>{['On-site', 'Hybrid', 'Remote'].map(mode => <option key={mode}>{mode}</option>)}</select></label>
              <label className="space-y-1.5 text-sm font-medium"><span>Number of openings</span><input required type="number" min="1" max="10000" className={inputClass} value={form.headcount} onChange={e => update('headcount', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm font-medium"><span>Application due date</span><input required type="date" className={inputClass} value={form.submission_deadline} onChange={e => update('submission_deadline', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Required skills (comma separated)</span><input required className={inputClass} value={form.skills} onChange={e => update('skills', e.target.value)} placeholder="e.g. SEO, Google Ads, Analytics" /></label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Role summary / job description</span><textarea required maxLength={30000} rows={7} className={inputClass} value={form.job_description} onChange={e => update('job_description', e.target.value)} placeholder="Describe the role, responsibilities, and requirements candidates should see." /></label>
            </fieldset>
            <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2.5 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-gray-900 px-5 py-2.5 font-semibold text-sm text-white disabled:opacity-50">{saving ? 'Publishing…' : 'Publish Requisition'}</button></div>
          </form>
        )}
        <section className="rounded-2xl border bg-white overflow-hidden" aria-label="Posted requisitions">
          <div className="border-b px-5 py-4 font-semibold">Posted requisitions ({rows.length})</div>
          {loading ? <p className="p-8 text-gray-500">Loading requisitions…</p> : !rows.length ? <div className="p-10 text-center text-gray-500"><Building2 className="mx-auto mb-3" /><p>No company requisitions posted yet.</p><p className="text-sm mt-1">Use Post Requisition to publish your first role.</p></div> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-500"><tr>{['Role / company', 'Work mode / location', 'Due date', 'Status', 'Applicants'].map(label => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id} className={selected?.id === row.id ? 'bg-gray-50' : ''}><td className="px-5 py-4"><p className="font-semibold">{row.title}</p><p className="mt-1 text-gray-500">{row.company_name}</p></td><td className="px-5 py-4">{row.structured_role.work_mode}<p className="text-gray-500">{row.structured_role.location}</p></td><td className="px-5 py-4">{row.structured_role.submission_deadline}</td><td className="px-5 py-4">{row.status}</td><td className="px-5 py-4"><button onClick={() => setSelected({ ...row })} className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-100"><Users size={16} /> {row.applicants_count} · View</button></td></tr>)}</tbody></table></div>}
        </section>
        {selected && <section className="rounded-2xl border bg-white p-5 sm:p-7 space-y-4">
          <header className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-lg">Applicants · {selected.title}</h2><p className="text-sm text-gray-500 mt-1">{selected.company_name} · All applicants are automatically included in Candidate Pool.</p></div><div className="flex items-center gap-3"><Link to="/dashboard/superadmin/candidates" className="text-sm font-semibold underline underline-offset-4">Candidate Pool</Link>{selected.status === 'Published' && <><a target="_blank" rel="noreferrer" href="/open-roles" className="text-sm inline-flex gap-1 items-center">Open Roles <ExternalLink size={14} /></a><button type="button" disabled={closing} onClick={closePosting} className="border rounded-lg px-3 py-2 text-sm">{closing ? 'Closing…' : 'Close posting'}</button></>}</div></header>
          {applicantError && <p role="alert" className="text-red-700 text-sm">{applicantError}</p>}
          {loadingApplicants ? <p className="text-sm text-gray-500 py-4">Loading applicants…</p> : !applicantError && !applicants.length ? <p className="text-sm text-gray-500 py-6">No applications yet. Applicants will appear here after submitting through Open Roles.</p> : <div className="divide-y">{applicants.map(person => <article key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="font-semibold">{person.candidate_name}</h3><p className="text-sm text-gray-500">{person.candidate_email}{person.candidate_phone ? ` · ${person.candidate_phone}` : ''}</p><p className="text-xs text-gray-500 mt-1">{person.status} · Applied {person.applied_at ? new Date(person.applied_at).toLocaleDateString() : '—'}</p></div><button disabled={!person.has_resume} onClick={() => setPreview(person)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"><FileText size={16} /> {person.has_resume ? 'View resume' : 'No resume uploaded'}</button></article>)}</div>}
        </section>}
      </div>
      {preview && <ResumePreviewModal token={token} candidateId={preview.id} filename={preview.filename} onClose={() => setPreview(null)} />}
    </div>
  );
}
