import AdminPageHeader from '../components/admin/AdminPageHeader';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Users, Eye, FileText, X, RefreshCw, ExternalLink, Pencil } from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ResumePreviewModal from '../components/ResumePreviewModal';

const emptyForm = () => ({ client_request_id: crypto.randomUUID(), company_name: '', title: '', department: '', location: '', work_mode: '', experience: '', duration: '', headcount: 1, start_date: '', submission_deadline: '', skills: '', job_description: '', internal_link: '' });
const fields = [
  ['company_name', 'Company name', 'Company you are hiring for'], ['title', 'Job title', 'e.g. Digital Marketing Specialist'],
  ['department', 'Department', 'e.g. Sales'], ['location', 'Location', 'e.g. Kozhikode'],
  ['experience', 'Experience', 'e.g. Mid (3–5 years)'], ['duration', 'Contract period', 'e.g. 6 months'],
  ['start_date', 'Target start date', 'e.g. November 2026 or 2026-11-15'],
];
const requisitionRef = (id) => `REQ-${id.slice(0, 6).toUpperCase()}`;
const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15';

export default function SuperAdminRequisitions() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantError, setApplicantError] = useState('');
  const [preview, setPreview] = useState(null);
  const [closing, setClosing] = useState(false);
  const [reviewTab, setReviewTab] = useState('applicants');
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerData, setViewerData] = useState(null);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const reviewRef = useRef(null);
  const selectedRoleId = selected?.id;
  const openReview = (row, tab = 'applicants') => {
    setSelected({ ...row });
    setReviewTab(tab);
    setViewerPage(1);
  };
  useEffect(() => {
    if (selectedRoleId) reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedRoleId]);
  useEffect(() => {
    if (!selected || reviewTab !== 'viewers') return;
    let cancelled = false;
    setLoadingViewers(true); setViewerData(null); setViewerError('');
    request(`/api/superadmin/requisitions/${selected.id}/viewers?page=${viewerPage}`, { token, noCache: true })
      .then(data => { if (!cancelled) setViewerData(data); })
      .catch(err => { if (!cancelled) setViewerError(err.message || 'Could not load viewers.'); })
      .finally(() => { if (!cancelled) setLoadingViewers(false); });
    return () => { cancelled = true; };
  }, [selected, reviewTab, viewerPage, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextRows = await request('/api/superadmin/requisitions', { token, noCache: true });
      setRows(nextRows);
      setSelected(previous => previous ? nextRows.find(row => row.id === previous.id) || null : null);
    }
    catch (err) { setError(err.message || 'Could not load requisitions.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => {
    if (!token) return;
    load();
    const refresh = () => { if (!document.hidden) load(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [token, load]);
  useEffect(() => {
    if (!selected || reviewTab !== 'applicants') return;
    let cancelled = false;
    setLoadingApplicants(true);
    setApplicants([]);
    setApplicantError('');
    request(`/api/superadmin/requisitions/${selected.id}/applicants`, { token, noCache: true })
      .then(data => { if (!cancelled) setApplicants(data); })
      .catch(err => { if (!cancelled) setApplicantError(err.message || 'Could not load applicants.'); })
      .finally(() => { if (!cancelled) setLoadingApplicants(false); });
    return () => { cancelled = true; };
  }, [selected, reviewTab, token]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const editPosting = (row) => {
    const role = row.structured_role || {};
    const values = emptyForm();
    Object.keys(values).forEach(key => { if (role[key] !== undefined) values[key] = role[key]; });
    setForm({ ...values, internal_link: row.internal_link || '', company_name: row.company_name || '', title: row.title || '', skills: (role.must_have_skills || []).join(', ') });
    setEditingId(row.id); setShowForm(true); setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const publish = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const { client_request_id, ...details } = form;
      const result = await request(editingId ? `/api/superadmin/requisitions/${editingId}` : '/api/superadmin/requisitions', {
        method: editingId ? 'PUT' : 'POST', token, body: { ...details, ...(!editingId ? { client_request_id } : {}), headcount: Number(form.headcount), skills: form.skills.split(',').map(s => s.trim()).filter(Boolean) },
      });
      setSuccess(editingId ? `${result.title} updated. Existing applicants are preserved.` : `${result.title} for ${result.company_name} is published on Open Roles.`);
      setShowForm(false); setEditingId(null); setForm(emptyForm()); setSelected(result);
      await load();
    } catch (err) { setError(err.message || 'Could not save requisition.'); }
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
    <div className="admin-page">
      <div className="w-full min-w-0 space-y-6">
        <AdminPageHeader title="Company requisitions" section="Hiring" description="Post contract roles on behalf of companies and review their applicants.">
          <div className="flex gap-2">
            <button type="button" aria-label="Refresh requisitions" onClick={load} disabled={loading} className="rounded-xl border bg-white p-3"><RefreshCw size={18} /></button>
            <button type="button" disabled={saving} onClick={() => { setEditingId(null); setForm(emptyForm()); setShowForm(true); setError(''); setSuccess(''); }} className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17} /> Post Requisition</button>
          </div>
        </AdminPageHeader>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}
        {showForm && (
          <form onSubmit={publish} className="rounded-2xl border bg-white p-5 sm:p-7 space-y-5">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold">{editingId ? 'Edit company requisition' : 'Post a company requisition'}</h2><button type="button" aria-label="Close posting form" disabled={saving} onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <p className="text-sm text-gray-500">{editingId ? 'Changes update this posting without removing applicants or changing its status.' : 'All fields except the internal link are required. Publishing makes this role available on the public Open Roles page.'}</p>
            <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
              {fields.map(([key, label, placeholder]) => <label key={key} className="space-y-1.5 text-sm font-medium"><span>{label}</span><input className={inputClass} required maxLength={key === 'start_date' || key === 'experience' || key === 'department' ? 100 : 200} value={form[key]} placeholder={placeholder} onChange={e => update(key, e.target.value)} /></label>)}
              <label className="space-y-1.5 text-sm font-medium"><span>Work mode</span><select required className={inputClass} value={form.work_mode} onChange={e => update('work_mode', e.target.value)}><option value="">Choose work mode</option>{['On-site', 'Hybrid', 'Remote'].map(mode => <option key={mode}>{mode}</option>)}</select></label>
              <label className="space-y-1.5 text-sm font-medium"><span>Number of openings</span><input required type="number" min="1" max="10000" className={inputClass} value={form.headcount} onChange={e => update('headcount', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm font-medium"><span>Application due date</span><input required type="date" className={inputClass} value={form.submission_deadline} onChange={e => update('submission_deadline', e.target.value)} /></label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Required skills (comma separated)</span><input required className={inputClass} value={form.skills} onChange={e => update('skills', e.target.value)} placeholder="e.g. SEO, Google Ads, Analytics" /></label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Role summary / job description</span><textarea required maxLength={30000} rows={7} className={inputClass} value={form.job_description} onChange={e => update('job_description', e.target.value)} placeholder="Describe the role, responsibilities, and requirements candidates should see." /></label>
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Internal reference link <span className="font-normal text-gray-500">(optional)</span></span><input type="url" maxLength={2048} className={inputClass} value={form.internal_link} onChange={e => update('internal_link', e.target.value)} placeholder="https://…" /><p className="text-xs font-normal text-gray-500">Visible only in this admin panel. Not included in the public job posting.</p></label>
            </fieldset>
            <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2.5 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-gray-900 px-5 py-2.5 font-semibold text-sm text-white disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Publish Requisition'}</button></div>
          </form>
        )}
        {['Open', 'Closed'].map(sectionName => {
          const sectionRows = rows.filter(row => (row.status === 'Closed') === (sectionName === 'Closed'));
          return (
        <section key={sectionName} className="rounded-2xl border bg-white overflow-hidden" aria-label={`${sectionName} requisitions`}>
          <div className="border-b px-5 py-4 font-semibold">{sectionName} requisitions ({sectionRows.length})</div>
          {loading ? <p className="p-8 text-gray-500">Loading requisitions…</p> : !sectionRows.length ? <div className="p-10 text-center text-gray-500"><Building2 className="mx-auto mb-3" /><p>No {sectionName.toLowerCase()} requisitions.</p><p className="text-sm mt-1">{sectionName === 'Closed' ? 'Expired and manually closed postings appear here. Applicants remain available.' : 'Use Post Requisition to publish a role.'}</p></div> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-500"><tr>{['Role / company', 'Work mode / location', 'Due date', 'Status', 'Viewers', 'Applicants', 'Actions'].map(label => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{sectionRows.map(row => <tr key={row.id} className={selected?.id === row.id ? 'bg-gray-50' : ''}><td className="px-5 py-4"><p className="mb-1.5 font-mono text-xs font-semibold text-gray-500" title={row.id}>{requisitionRef(row.id)}</p><button type="button" onClick={() => openReview(row)} className="text-left font-semibold hover:underline">{row.title}</button><p className="mt-1 text-gray-500">{row.company_name}</p></td><td className="px-5 py-4">{row.structured_role.work_mode}<p className="text-gray-500">{row.structured_role.location}</p></td><td className="px-5 py-4">{row.structured_role.submission_deadline}</td><td className="px-5 py-4">{row.status}</td><td className="px-5 py-4"><button type="button" onClick={() => openReview(row, 'viewers')} aria-label={`View viewers for ${row.title}`} className="flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 hover:bg-gray-100"><Eye size={16} /> {row.viewers_count ?? 0} · View viewers</button></td><td className="px-5 py-4"><button type="button" onClick={() => openReview(row)} aria-label={`View applicants for ${row.title}`} className="flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 hover:bg-gray-100"><Users size={16} /> {row.applicants_count} · View applicants</button></td><td className="px-5 py-4"><button type="button" disabled={saving} onClick={() => editPosting(row)} className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-100"><Pencil size={16} /> Edit</button></td></tr>)}</tbody></table></div>}
        </section>
          );
        })}
        {selected && <section ref={reviewRef} aria-label="Role activity" className="scroll-mt-6 rounded-2xl border bg-white p-5 sm:p-7 space-y-4">
          <header className="flex flex-wrap justify-between gap-3"><div><p className="mb-1.5 font-mono text-xs font-semibold text-gray-500" title={selected.id}>{requisitionRef(selected.id)}</p><h2 className="font-bold text-lg">Role activity · {selected.title}</h2><p className="text-sm text-gray-500 mt-1">{selected.company_name}</p></div><div className="flex items-center gap-3"><Link to="/dashboard/superadmin/candidates" className="text-sm font-semibold underline underline-offset-4">Candidate Pool</Link>{selected.status === 'Published' && <><a target="_blank" rel="noreferrer" href="/open-roles" className="text-sm inline-flex gap-1 items-center">Open Roles <ExternalLink size={14} /></a><button type="button" disabled={closing} onClick={closePosting} className="border rounded-lg px-3 py-2 text-sm">{closing ? 'Closing…' : 'Close posting'}</button></>}<button type="button" aria-label="Close role activity" onClick={() => setSelected(null)} className="rounded-lg border p-2"><X size={18} /></button></div></header>
          {selected.internal_link && <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="mb-1 text-xs font-semibold text-gray-500">Internal reference · Admin only</p><a href={selected.internal_link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 text-sm font-medium underline underline-offset-4"><span className="break-all">{selected.internal_link}</span><ExternalLink size={14} className="shrink-0" /></a></div>}
          <div role="group" aria-label="Activity view" className="flex flex-wrap gap-2 border-b pb-4">
            <button type="button" aria-pressed={reviewTab === 'applicants'} onClick={() => setReviewTab('applicants')} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${reviewTab === 'applicants' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}><Users size={16} /> Applicants ({selected.applicants_count ?? 0})</button>
            <button type="button" aria-pressed={reviewTab === 'viewers'} onClick={() => setReviewTab('viewers')} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${reviewTab === 'viewers' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}><Eye size={16} /> Viewers ({selected.viewers_count ?? 0})</button>
          </div>
          {reviewTab === 'applicants' ? <>
            <p className="text-sm text-gray-500">All applicants are automatically included in Candidate Pool.</p>
          {applicantError && <p role="alert" className="text-red-700 text-sm">{applicantError}</p>}
          {loadingApplicants ? <p className="text-sm text-gray-500 py-4">Loading applicants…</p> : !applicantError && !applicants.length ? <p className="text-sm text-gray-500 py-6">No applications yet. Applicants will appear here after submitting through Open Roles.</p> : <div className="divide-y">{applicants.map(person => <article key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h3 className="font-semibold">{person.candidate_name}</h3><p className="text-sm text-gray-500">{person.candidate_email}{person.candidate_phone ? ` · ${person.candidate_phone}` : ''}</p><p className="text-xs text-gray-500 mt-1">{person.status} · Applied {person.applied_at ? new Date(person.applied_at).toLocaleDateString() : '—'}</p></div><button disabled={!person.has_resume} onClick={() => setPreview(person)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"><FileText size={16} /> {person.has_resume ? 'View resume' : 'No resume uploaded'}</button></article>)}</div>}
          </> : <>
            <p className="text-sm text-gray-500">Signed-in candidates are identified. Other visits appear as anonymous browser sessions. Repeat opens count once per candidate or session. View tracking starts with this update.</p>
            {viewerError && <p role="alert" className="text-sm text-red-700">{viewerError}</p>}
            {loadingViewers ? <p role="status" className="py-4 text-sm text-gray-500">Loading viewers…</p> : viewerData && <>
              <p className="text-sm font-medium text-gray-700">{viewerData.identified_count} identified · {viewerData.anonymous_count} anonymous</p>
              {!viewerData.viewers.length ? <p className="py-6 text-sm text-gray-500">No recorded views yet. Viewers appear after opening this role’s details on Open Roles.</p> : <div className="divide-y">{viewerData.viewers.map(person => <article key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0"><h3 className="font-semibold">{person.candidate_name}</h3>{person.candidate_email && <p className="break-all text-sm text-gray-500">{person.candidate_email}</p>}<p className="mt-1 text-xs text-gray-500">First viewed {person.first_viewed_at ? new Date(person.first_viewed_at).toLocaleString() : '—'}<br />Last viewed {person.last_viewed_at ? new Date(person.last_viewed_at).toLocaleString() : '—'}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${person.has_applied ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{person.has_applied ? 'Applied' : person.candidate_email ? 'Viewed · no application' : 'Anonymous'}</span>
              </article>)}</div>}
              {(viewerPage > 1 || viewerData.has_more) && <div className="flex items-center justify-between gap-3 pt-3 text-sm"><button type="button" disabled={viewerPage === 1} onClick={() => setViewerPage(page => page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {viewerPage}</span><button type="button" disabled={!viewerData.has_more} onClick={() => setViewerPage(page => page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div>}
            </>}
          </>}

        </section>}
      </div>
      {preview && <ResumePreviewModal token={token} candidateId={preview.id} filename={preview.filename} onClose={() => setPreview(null)} />}
    </div>
  );
}
