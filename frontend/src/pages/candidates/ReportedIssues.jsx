import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import { Flag, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ReportedIssues() {
  const { user, token } = useAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState('');

  const greetingText = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const userName = user?.name || 'HR';
  const tenantName = user?.tenant_name || 'Bearitt';

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await request('/api/onboarding/issues', { token }).catch(() => []);
      const list = Array.isArray(data) ? data : data?.issues || [];
      const sorted = [...list].sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return 0;
      });
      setIssues(sorted);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [token]);

  const handleResolveIssue = async (issueId) => {
    setResolvingId(issueId);
    try {
      await request(`/api/onboarding/issues/${issueId}/resolve`, {
        method: 'POST',
        token,
      });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status: 'fixed' } : i)));
    } catch (err) {
      // ignore
    } finally {
      setResolvingId('');
    }
  };

  const openCount = useMemo(() => issues.filter((i) => i.status === 'open').length, [issues]);
  const resolvedCount = useMemo(() => issues.filter((i) => i.status !== 'open').length, [issues]);

  return (
    <div className="flex flex-col space-y-4 md:h-[calc(100vh-86px)] md:max-h-[calc(100vh-86px)] md:overflow-hidden min-h-0">
      <style>{`
        .custom-cand-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-cand-scroll::-webkit-scrollbar-track { background: #FFFFFF; }
        .custom-cand-scroll::-webkit-scrollbar-thumb { background: #E2E2DC; border-radius: 4px; }
        .custom-cand-scroll::-webkit-scrollbar-thumb:hover { background: #A3A39F; }
      `}</style>

      {/* Hero Banner */}
      <div style={{ backgroundColor: '#0A0A0A', borderRadius: 22, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)' }}
        className="shrink-0 p-4 sm:p-6 text-white space-y-2 relative overflow-hidden rounded-[20px] sm:rounded-[22px]">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#A3A3A3]">
          {greetingText}, {userName}
        </div>
        <h1 className="text-[1.8rem] sm:text-[2.2rem] font-extrabold text-white tracking-tight leading-none">
          Candidate Reported Issues
        </h1>
        <p className="text-[13px] text-[#A3A3A3] font-medium pt-0.5">
          Review and resolve issues raised by onboarding hires.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
            className="px-3 py-1 text-[11px] font-bold text-white rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Hiring Manager</span>
          </span>
          <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
            className="px-3 py-1 text-[11px] font-bold text-white rounded-full">
            {tenantName}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="shrink-0 grid grid-cols-3 gap-3 sm:gap-4">
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 22, border: '1px solid #E2E2DC', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}
          className="p-3.5 sm:p-5 space-y-1">
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">{issues.length}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">TOTAL ISSUES</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 22, border: '1px solid #E2E2DC', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}
          className="p-3.5 sm:p-5 space-y-1">
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#DC2626] tracking-tight leading-none">{openCount}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">OPEN</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 22, border: '1px solid #E2E2DC', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}
          className="p-3.5 sm:p-5 space-y-1">
          <div className="text-[1.6rem] sm:text-[2.1rem] font-extrabold text-[#10B981] tracking-tight leading-none">{resolvedCount}</div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A8A85]">RESOLVED</div>
        </div>
      </div>

      {/* Issues List */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 22, border: '1px solid #E2E2DC', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)' }}
        className="flex-1 min-h-[360px] md:min-h-0 flex flex-col p-4 sm:p-6 md:overflow-hidden">
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight flex items-center gap-2">
              <Flag size={16} />
              All Issues
            </h2>
            <p className="text-[12px] text-[#737373] font-medium mt-0.5">
              {openCount > 0 ? `${openCount} open issue${openCount > 1 ? 's' : ''} need attention` : 'All issues resolved'}
            </p>
          </div>
          <button onClick={loadIssues}
            className="px-4 py-1.5 text-[12.5px] font-bold text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors flex items-center gap-1.5 cursor-pointer rounded-xl border border-[#E2E2DC] shadow-2xs">
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-cand-scroll pr-1">
          {loading ? (
            <div className="py-16 text-center text-[#8A8A85] text-[13px] font-medium flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading issues...
            </div>
          ) : issues.length === 0 ? (
            <div className="py-16 px-4 text-center bg-[#FBFBFA] rounded-2xl border border-[#EAEAE6] my-auto">
              <CheckCircle2 size={32} className="mx-auto text-[#10B981] mb-2" />
              <div className="text-[15px] font-extrabold text-[#0A0A0A] mb-1">All resolved!</div>
              <p className="text-[12.5px] text-[#8A8A85] max-w-md mx-auto">
                No candidate onboarding issues have been reported yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id}
                  className="p-4 rounded-2xl border space-y-2.5 transition-all"
                  style={{
                    backgroundColor: issue.status === 'open' ? '#FFFBFB' : '#F8FDF8',
                    borderColor: issue.status === 'open' ? '#FECACA' : '#BBF7D0',
                  }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-extrabold text-[#0A0A0A]">
                          {issue.category_label || issue.category || 'Issue'}
                        </span>
                        <span
                          style={{
                            backgroundColor: issue.status === 'open' ? '#FEF2F2' : '#F0FDF4',
                            color: issue.status === 'open' ? '#DC2626' : '#16A34A',
                          }}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
                        >
                          {issue.status === 'open' ? 'Open' : 'Resolved'}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-[#737373] font-medium">
                        {issue.candidate_name || issue.candidate_id || 'Candidate'}
                        {issue.vendor_name && <span> · {issue.vendor_name}</span>}
                      </div>
                    </div>
                    {issue.status === 'open' && (
                      <button
                        disabled={resolvingId === issue.id}
                        onClick={() => handleResolveIssue(issue.id)}
                        className="px-3.5 py-1.5 text-[11px] font-bold bg-[#0A0A0A] text-white rounded-lg hover:bg-[#262626] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {resolvingId === issue.id ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                  <p className="text-[12px] text-[#52524E] bg-white p-3 rounded-xl border border-[#F2F2EE] leading-relaxed">
                    {issue.description || 'Candidate reported an issue.'}
                  </p>
                  {issue.resolved_at && (
                    <div className="text-[10.5px] text-[#16A34A] font-medium">
                      ✓ Resolved {issue.resolved_at ? new Date(issue.resolved_at).toLocaleDateString() : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
