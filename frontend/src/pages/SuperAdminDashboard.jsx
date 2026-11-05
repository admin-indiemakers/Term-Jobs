import AdminPageHeader, { AdminMetric } from '../components/admin/AdminPageHeader';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { request, clearApiCache } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import OnboardCompanyModal from '../components/OnboardCompanyModal';
import OnboardVendorModal from '../components/OnboardVendorModal';
import { Building2, Users, Layers, Plus, ArrowRight, UserCheck, FileText, Mail, Download, Loader2, LogOut, RefreshCw, ShieldCheck, Activity, Briefcase } from 'lucide-react';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Recent';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recent';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 45) return 'Just now';
  if (diffInSeconds < 90) return '1 min ago';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SuperAdminDashboard() {
  const { token, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const loadVersion = useRef(0);
  const invalidatePendingLoad = useCallback(() => { loadVersion.current++; }, []);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showOnboardVendorModal, setShowOnboardVendorModal] = useState(false);
  const [poolStats, setPoolStats] = useState({ total: 0, portal_applicants: 0, vendor_candidates: 0 });
  const [outreachStats, setOutreachStats] = useState({ total_outreach_sent: 0, interested_count: 0, response_rate_percent: 0 });

  const load = useCallback(async (isManual = false) => {
    if (!token) return;
    const version = ++loadVersion.current;
    setLoading(true);
    if (isManual) clearApiCache();
    try {
      const data = await request(`/api/superadmin/overview${isManual ? '?refresh=true' : ''}`, { token, forceRefresh: isManual });
      if (version !== loadVersion.current) return;
      setStats(data.stats);
      setPoolStats(data.pool_stats);
      setOutreachStats(data.outreach_stats);
      setHasLoaded(true);
      setError('');
    } catch (err) {
      if (version === loadVersion.current) setError(err.message || 'Could not load overview.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [token]);

  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/backup/sql', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to download database backup');
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `termjob_db_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`Database backup successfully downloaded as ${filename}`);
    } catch (err) {
      console.error('Database backup error:', err);
      setError(err.message || 'Failed to download database backup.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  useEffect(() => {
    load();
    const handleRefresh = () => load(true);
    window.addEventListener('refresh-superadmin-data', handleRefresh);
    return () => { invalidatePendingLoad(); window.removeEventListener('refresh-superadmin-data', handleRefresh); };
  }, [load, invalidatePendingLoad]);

  // Auto-dismiss notification after 2 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Generate dynamic platform activity events based on actual DB records
  const platformActivities = useMemo(() => {
    if (stats?.platform_activities && stats.platform_activities.length > 0) {
      return stats.platform_activities.map((act) => {
        let IconComp = Building2;
        if (act.type === 'vendor') IconComp = Layers;
        else if (act.type === 'admin') IconComp = ShieldCheck;
        else if (act.type === 'recruiter') IconComp = Users;
        else if (act.type === 'candidate') IconComp = UserCheck;
        else if (act.type === 'requisition') IconComp = Briefcase;

        return {
          id: act.id,
          icon: IconComp,
          title: act.title,
          desc: act.desc,
          date: formatRelativeTime(act.created_at),
          badge: act.badge || 'Active',
          badgeTone: act.tone === 'green' ? 'green' : act.tone === 'blue' ? 'blue' : act.tone === 'purple' ? 'purple' : 'gray',
        };
      });
    }

    return [];
  }, [stats]);

  const workspaceLinks = [
    { to: '/dashboard/superadmin/requisitions', title: 'Company requisitions', detail: 'Post roles and review applications', icon: Briefcase },
    { to: '/dashboard/superadmin/candidates', title: 'Candidate pool', detail: 'Review resumes, invite and shortlist', icon: Users },
    { to: '/dashboard/interviews', title: 'Interviews & AI scores', detail: 'Track interviews and assessments', icon: Activity },
    { to: '/dashboard/superadmin/outreach', title: 'AI email outreach', detail: 'Match talent and manage responses', icon: Mail },
    { to: '/dashboard/superadmin/candidate-management', title: 'Candidate selections', detail: 'Review manager selections and contracts', icon: UserCheck },
    { to: '/dashboard/superadmin/candidate-management?tab=billing', title: 'Billing & work orders', detail: 'Manage timesheets and payments', icon: FileText },
  ];

  return (
    <div className="admin-page">
      <AdminPageHeader title="Platform overview" section="Workspace" description="Manage hiring, partner accounts, and platform operations from one place.">
        <NotificationBell />
        <button type="button" onClick={() => {
          window.dispatchEvent(new CustomEvent('refresh-superadmin-data'));
          window.dispatchEvent(new CustomEvent('tj-requisitions-updated'));
        }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold flex items-center gap-2" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button type="button" onClick={() => setShowOnboardModal(true)} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white flex items-center gap-2"><Plus size={14} /> Onboard company</button>
        <button type="button" onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"><LogOut size={15} /></button>
      </AdminPageHeader>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}

      <section aria-label="Platform metrics" className="admin-metrics" aria-busy={loading}>
        <AdminMetric label="Buyer companies" value={hasLoaded ? stats.buyer_companies : null} detail="Manage buyer accounts" icon={Building2} href="/dashboard/superadmin/accounts" />
        <AdminMetric label="Vendor agencies" value={hasLoaded ? stats.vendor_consultancies : null} detail="Manage vendor accounts" icon={Layers} href="/dashboard/superadmin/vendor-accounts" />
        <AdminMetric label="Admin accounts" value={hasLoaded ? stats.total_admin_accounts : null} detail="Manage platform access" icon={ShieldCheck} href="/dashboard/superadmin/admin-accounts" />
        <AdminMetric label="Candidate pool" value={hasLoaded ? poolStats.total : null} detail="Across all talent sources" icon={Users} href="/dashboard/superadmin/candidates" />
      </section>

      <div className="admin-overview-grid">
        <div className="space-y-6 min-w-0">
          <section className="admin-panel" aria-labelledby="hiring-workspace-title">
            <div className="admin-section-heading"><div><h2 id="hiring-workspace-title">Hiring workspace</h2><p>Follow each candidate from application to placement.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-x-6">
              {workspaceLinks.map(({ to, title, detail, icon: Icon }) => <Link key={to} to={to} className="admin-shortcut">
                <span className="admin-shortcut-icon"><Icon size={17} /></span>
                <div className="min-w-0 flex-1"><strong>{title}</strong><p>{detail}</p></div><ArrowRight size={14} className="text-gray-400 shrink-0" />
              </Link>)}
            </div>
          </section>

          <section className="admin-panel" aria-labelledby="platform-activity-title">
            <div className="admin-section-heading"><div><h2 id="platform-activity-title">Recent platform activity</h2><p>Account onboarding and hiring updates.</p></div><Link to="/dashboard/superadmin/accounts" className="text-xs font-semibold text-teal-700">View accounts →</Link></div>
            {!hasLoaded && loading ? <p role="status" className="py-8 text-sm text-gray-500">Loading activity…</p> : platformActivities.length === 0 ? <p className="py-8 text-sm text-gray-500">No recent activity. New onboarding and hiring updates will appear here.</p> :
              <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {platformActivities.map(({ id, icon: Icon, title, desc, date, badge, badgeTone }) => <li key={id} className="flex items-start gap-3 py-4">
                  <span className="admin-shortcut-icon"><Icon size={16} /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-800">{title}</p><p className="mt-1 text-xs leading-relaxed text-gray-500 break-words">{desc}</p><p className="mt-2 text-[11px] text-gray-400">{date}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badgeTone === 'green' ? 'bg-emerald-50 text-emerald-700' : badgeTone === 'blue' ? 'bg-blue-50 text-blue-700' : badgeTone === 'purple' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{badge}</span>
                </li>)}
              </ul>}
          </section>
        </div>

        <div className="space-y-6 min-w-0">
          <section className="admin-panel" aria-labelledby="partner-accounts-title">
            <div className="admin-section-heading"><div><h2 id="partner-accounts-title">Partners & access</h2><p>Onboard organizations and manage their accounts.</p></div></div>
            <button type="button" onClick={() => setShowOnboardModal(true)} className="admin-shortcut"><span className="admin-shortcut-icon"><Building2 size={17} /></span><div className="flex-1"><strong>Onboard company</strong><p>Create a buyer organization</p></div><Plus size={15} /></button>
            <button type="button" onClick={() => setShowOnboardVendorModal(true)} className="admin-shortcut"><span className="admin-shortcut-icon"><Layers size={17} /></span><div className="flex-1"><strong>Onboard vendor</strong><p>Set up a staffing partner</p></div><Plus size={15} /></button>
            <Link to="/dashboard/superadmin/admin-accounts" className="admin-shortcut"><span className="admin-shortcut-icon"><ShieldCheck size={17} /></span><div className="flex-1"><strong>Admin accounts</strong><p>Review platform administrators</p></div><ArrowRight size={15} /></Link>
          </section>

          <section className="admin-panel" aria-labelledby="outreach-snapshot-title">
            <div className="admin-section-heading"><div><h2 id="outreach-snapshot-title">Talent & outreach</h2><p>Current sourcing activity across the platform.</p></div></div>
            <dl className="space-y-4 text-xs">
              {[['Portal applicants', poolStats.portal_applicants], ['Vendor candidates', poolStats.vendor_candidates], ['Outreach sent', outreachStats.total_outreach_sent], ['Interested candidates', outreachStats.interested_count], ['Response rate', `${outreachStats.response_rate_percent ?? 0}%`]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="font-semibold text-gray-800">{!hasLoaded ? '—' : value ?? '—'}</dd></div>)}
            </dl>
            <Link to="/dashboard/superadmin/outreach" className="mt-5 block border-t border-gray-100 pt-4 text-xs font-semibold text-teal-700">Manage outreach →</Link>
          </section>

          <section className="admin-panel" aria-labelledby="platform-data-title">
            <div className="admin-section-heading"><div><h2 id="platform-data-title">Platform data</h2><p>Download a complete database backup.</p></div></div>
            <button type="button" onClick={handleDownloadBackup} disabled={downloadingBackup} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold disabled:opacity-60">
              {downloadingBackup ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{downloadingBackup ? 'Preparing backup…' : 'Download backup'}
            </button>
          </section>
        </div>
      </div>

      <OnboardVendorModal isOpen={showOnboardVendorModal} onClose={() => setShowOnboardVendorModal(false)} onSuccess={() => { load(); setSuccess('Vendor onboarded successfully!'); }} />
      <OnboardCompanyModal isOpen={showOnboardModal} onClose={() => setShowOnboardModal(false)} onSuccess={() => { load(); setSuccess('Company onboarded successfully!'); }} />
    </div>
  );
}
