import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';
import { marked } from 'marked';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  Search,
  Menu,
  ChevronDown,
  Code2,
  FolderKanban,
  Box,
  Wrench,
  ArrowUp,
  LogOut,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Grid,
  List,
  X,
  ExternalLink,
  CheckCircle2,
  UserCheck,
  Archive,
  RefreshCw,
  Edit3,
  Bot,
  Zap,
  ArrowRight,
  ShieldAlert,
  Sliders
} from 'lucide-react';

const ACTION_PILLS = [
  { label: 'Write Announcement', icon: Edit3, prompt: 'Draft a platform update announcement for all onboarded client companies.' },
  { label: 'Company Audit', icon: Building2, prompt: 'Give me an audit report of all active buyer companies and vendor consultancies.' },
  { label: 'API & Code Spec', icon: Code2, prompt: 'Show example API integration payload for onboarding a new tenant.' },
  { label: 'System Health', icon: Activity, prompt: 'Provide a platform health overview showing user counts and system metrics.' },
  { label: 'Security Check', icon: ShieldCheck, prompt: 'Run a security access check on Super Admin records and active sessions.' },
];

/* ── 1. Interactive Tenant Directory Console Widget ────────────────────────── */
function TenantConsoleWidget({ tenants, onSendMessage, onCopy, onSelectTenant }) {
  const [filterTab, setFilterTab] = useState('all'); // all | client | consultancy
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | table

  const filteredTenants = tenants.filter((t) => {
    const matchesTab = filterTab === 'all' ? true : t.tenant_type === filterTab;
    const matchesSearch =
      searchQuery === ''
        ? true
        : t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.id && t.id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const clientCount = tenants.filter((t) => t.tenant_type === 'client').length;
  const consultancyCount = tenants.filter((t) => t.tenant_type === 'consultancy').length;

  let widgetTitle = 'TermJobs Tenant Directory';
  if (clientCount > 0 && consultancyCount === 0) widgetTitle = 'TermJobs Buyer Client Companies';
  else if (clientCount === 0 && consultancyCount > 0) widgetTitle = 'TermJobs Vendor Consultancies';

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans space-y-4">
      {/* Widget Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center shadow-md ring-1 ring-white/20 shrink-0">
            <Building2 size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold text-gray-950 tracking-tight">
                {widgetTitle}
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-800 border border-emerald-300/80 uppercase tracking-wider">
                {tenants.length} Total
              </span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & View Mode Toggle */}
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <div className="flex items-center rounded-xl bg-gray-100/90 p-0.5 text-xs font-bold text-gray-700 shrink-0">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                  filterTab === 'all'
                    ? 'bg-white text-gray-950 shadow-xs font-extrabold'
                    : 'text-gray-500 hover:text-gray-950'
                }`}
              >
                All ({tenants.length})
              </button>
              {clientCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTab('client')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    filterTab === 'client'
                      ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                      : 'text-gray-500 hover:text-emerald-800'
                  }`}
                >
                  Buyers ({clientCount})
                </button>
              )}
              {consultancyCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTab('consultancy')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    filterTab === 'consultancy'
                      ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                      : 'text-gray-500 hover:text-indigo-800'
                  }`}
                >
                  Vendors ({consultancyCount})
                </button>
              )}
            </div>
          )}

          <div className="flex items-center bg-gray-100/90 p-0.5 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-black shadow-xs' : 'text-gray-400 hover:text-black'
              }`}
              title="Grid Cards View"
            >
              <Grid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-black shadow-xs' : 'text-gray-400 hover:text-black'
              }`}
              title="Table View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar & Quick Onboard Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-gray-50/80 border border-gray-200/90 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-black transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSendMessage('Onboard a new buyer company named Acme Corp with admin admin@acme.com')}
          className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-gray-950 to-black hover:from-gray-900 hover:to-gray-950 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <Plus size={14} />
          <span>+ Onboard Tenant</span>
        </button>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {filteredTenants.map((t) => {
            const isClient = t.tenant_type === 'client';
            const users = t.assigned_users || [];
            return (
              <div
                key={t.id}
                className={`p-4 rounded-2xl bg-gradient-to-b from-white to-gray-50/40 border ${
                  isClient
                    ? 'border-emerald-200/70 hover:border-emerald-500/80 hover:shadow-md'
                    : 'border-indigo-200/70 hover:border-indigo-500/80 hover:shadow-md'
                } transition-all duration-200 flex flex-col justify-between group relative overflow-hidden`}
              >
                {/* Accent Top Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isClient ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                  }`}
                />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 mt-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${
                        isClient
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                          : 'bg-indigo-50 text-indigo-800 border border-indigo-200/80'
                      }`}
                    >
                      {isClient ? 'Buyer Company' : 'Vendor Consultancy'}
                    </span>

                    <button
                      type="button"
                      onClick={() => onCopy(t.id, t.id)}
                      className="font-mono text-[10.5px] font-semibold text-gray-400 hover:text-black transition-colors flex items-center gap-1 bg-gray-100/70 px-2 py-0.5 rounded-md hover:bg-gray-200"
                      title="Copy Tenant ID"
                    >
                      <span>{t.id ? `${t.id.slice(0, 8)}...` : ''}</span>
                      <Copy size={11} />
                    </button>
                  </div>

                  <h3 className="text-sm font-extrabold text-gray-950 tracking-tight leading-snug group-hover:text-black">
                    {t.name}
                  </h3>
                </div>

                {/* Users Stack & Action Buttons */}
                <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {users.length > 0 ? (
                      <>
                        <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                          {users.slice(0, 3).map((uName, idx) => (
                            <div
                              key={idx}
                              className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-900 to-black text-white font-black text-[9px] flex items-center justify-center ring-2 ring-white shadow-xs"
                              title={uName}
                            >
                              {uName[0]?.toUpperCase() || 'U'}
                            </div>
                          ))}
                        </div>
                        <span className="text-[11px] font-semibold text-gray-700 truncate">
                          {users.length} {users.length === 1 ? 'account' : 'accounts'}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">No accounts</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectTenant(t)}
                      className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-[11px] font-bold transition-colors cursor-pointer"
                      title="View Details"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendMessage(`List administrator accounts for tenant ${t.name}`)}
                      className="px-2.5 py-1 rounded-xl bg-gray-950 hover:bg-black text-white text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                      title="Inspect Accounts"
                    >
                      Accounts
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendMessage(`Delete tenant ${t.name}`)}
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                      title="Delete Tenant"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-gray-200/90 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/90 border-b border-gray-200 text-gray-500 font-black uppercase text-[9.5px] tracking-wider whitespace-nowrap">
              <tr>
                <th className="py-3 px-3.5">Company Name</th>
                <th className="py-3 px-3.5">Type</th>
                <th className="py-3 px-3.5">Tenant ID</th>
                <th className="py-3 px-3.5">Assigned Users</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTenants.map((t) => {
                const isClient = t.tenant_type === 'client';
                const users = t.assigned_users || [];
                return (
                  <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-3.5 font-extrabold text-gray-950 whitespace-nowrap">{t.name}</td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider ${
                          isClient
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200/80'
                        }`}
                      >
                        {isClient ? 'Buyer' : 'Vendor'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onCopy(t.id, t.id)}
                        className="font-mono text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 px-2 py-0.5 rounded-lg transition-colors inline-flex items-center gap-1 group/id cursor-pointer"
                        title="Click to copy full Tenant ID"
                      >
                        <span>{t.id ? `${t.id.slice(0, 8)}...${t.id.slice(-4)}` : ''}</span>
                        <Copy size={11} className="opacity-60 group-hover/id:opacity-100" />
                      </button>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {users.length > 0 ? (
                          <>
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {users.slice(0, 3).map((uName, idx) => (
                                <div
                                  key={idx}
                                  className="w-5 h-5 rounded-full bg-gray-900 text-white font-black text-[9px] flex items-center justify-center ring-2 ring-white"
                                  title={uName}
                                >
                                  {uName[0]?.toUpperCase() || 'U'}
                                </div>
                              ))}
                            </div>
                            <span className="text-[11px] font-semibold text-gray-700">
                              {users.length} {users.length === 1 ? 'account' : 'accounts'}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-[11px] italic">0 accounts</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectTenant(t)}
                          className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-extrabold text-[11px] transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => onSendMessage(`List administrator accounts for tenant ${t.name}`)}
                          className="px-2.5 py-1 rounded-xl bg-black hover:bg-gray-800 text-white font-extrabold text-[11px] transition-colors shadow-xs cursor-pointer"
                        >
                          Accounts
                        </button>
                        <button
                          type="button"
                          onClick={() => onSendMessage(`Delete tenant ${t.name}`)}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                          title="Delete Tenant"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 2. Interactive Admin Accounts Console Widget ───────────────────────────── */
function AdminAccountsWidget({ users, onSendMessage, onCopy }) {
  const [filterRole, setFilterRole] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesRole = filterRole === 'all' ? true : u.role?.toLowerCase() === filterRole.toLowerCase();
    const matchesSearch =
      searchQuery === ''
        ? true
        : u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.tenant_id && u.tenant_id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans">
      <div className="p-5 rounded-3xl bg-gradient-to-b from-slate-50/80 via-white to-white border border-gray-200/90 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center shadow-md shrink-0">
              <UserCheck size={16} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">
                TermJobs Administrator Accounts Directory
              </h4>
              <p className="text-[11px] text-gray-500 font-medium">
                {users.length} Total User Accounts Registered Across Platform Tenants
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center rounded-xl bg-gray-200/70 p-0.5 text-xs font-bold text-gray-700 shrink-0">
            {['all', 'Admin', 'Recruiter', 'Super Admin'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setFilterRole(role)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterRole === role ? 'bg-white text-gray-950 shadow-xs font-extrabold' : 'text-gray-600 hover:text-black'
                }`}
              >
                {role === 'all' ? `All (${users.length})` : role}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts by user name, email, or tenant ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all shadow-xs"
          />
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredUsers.map((u) => {
            const initials = u.name ? u.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'U';
            return (
              <div
                key={u.id || u.email}
                className="p-4 rounded-2xl bg-white border border-gray-200/90 hover:border-black hover:shadow-md transition-all flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gray-950 to-gray-800 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-black/10">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-gray-950 truncate">{u.name}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">Tenant: {u.tenant_id || 'Platform Global'}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCopy(u.email, u.email)}
                  className="p-2 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-all shrink-0 cursor-pointer"
                  title="Copy email"
                >
                  <Copy size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 3. Interactive Platform Metrics Dashboard Widget ───────────────────────── */
function PlatformMetricsWidget({ stats, onSendMessage }) {
  const total = stats.total_tenants || 0;
  const clients = stats.client_companies || 0;
  const vendors = stats.vendor_consultancies || 0;
  const clientPct = total > 0 ? Math.round((clients / total) * 100) : 0;
  const vendorPct = total > 0 ? 100 - clientPct : 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans">
      <div className="p-5 rounded-3xl bg-gradient-to-b from-gray-50/90 via-white to-white border border-gray-200/90 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
              <Activity size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-gray-950 tracking-tight">
                  TermJobs Real-Time Platform Analytics
                </h4>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  {stats.system_status || 'Operational'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">Live status across MongoDB Atlas cluster</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSendMessage('Provide a platform health overview showing user counts and system metrics.')}
            className="p-2 rounded-xl bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-all cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Buyer vs Vendor Ratio Progress Bar */}
        <div className="p-3.5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-800 font-extrabold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Buyer Companies: {clients} ({clientPct}%)
            </span>
            <span className="text-indigo-800 font-extrabold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              Vendor Consultancies: {vendors} ({vendorPct}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex ring-1 ring-black/5">
            <div style={{ width: `${clientPct}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" />
            <div style={{ width: `${vendorPct}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" />
          </div>
        </div>

        {/* 4 Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-gray-200/90 shadow-2xs hover:border-black transition-all">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Tenants</div>
            <div className="text-3xl font-black text-gray-950 mt-1 tracking-tight">{stats.total_tenants || 0}</div>
            <div className="text-[11px] text-gray-500 font-semibold mt-1">{clients} Buyers • {vendors} Vendors</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs hover:border-emerald-500 transition-all">
            <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Buyer Companies</div>
            <div className="text-3xl font-black text-emerald-800 mt-1 tracking-tight">{clients}</div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">Client Tenants</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-indigo-200/80 shadow-2xs hover:border-indigo-500 transition-all">
            <div className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Vendor Consultancies</div>
            <div className="text-3xl font-black text-indigo-800 mt-1 tracking-tight">{vendors}</div>
            <div className="text-[11px] text-indigo-700 font-bold mt-1">Sourcing Partners</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200/90 shadow-2xs hover:border-black transition-all">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">User Accounts</div>
            <div className="text-3xl font-black text-gray-950 mt-1 tracking-tight">{stats.total_users || 0}</div>
            <div className="text-[11px] text-gray-500 font-semibold mt-1">{stats.admin_accounts || 0} Admin Accounts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 4. Interactive Onboarding Success Banner Widget ────────────────────────── */
function OnboardingSuccessWidget({ result, onSendMessage, onCopy }) {
  return (
    <div className="mt-4 pt-4 border-t border-emerald-100 text-left font-sans">
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white border border-emerald-200 shadow-md space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-950 tracking-tight">
              Tenant & Administrator Onboarded Successfully
            </h4>
            <p className="text-[11.5px] text-emerald-800 font-medium">
              {result.message}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-emerald-200/80 text-xs space-y-1.5 font-mono shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Tenant ID:</span>
            <span className="font-bold text-gray-950">{result.tenant_id}</span>
          </div>
          {result.admin_email && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Admin Email:</span>
              <span className="font-bold text-gray-950">{result.admin_email}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onCopy(result.tenant_id, result.tenant_id)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Copy Tenant ID
          </button>
          <button
            type="button"
            onClick={() => onSendMessage('List all platform tenants')}
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            View Tenant Directory
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 5. Interactive Onboarding Draft Form Preview Widget ───────────────────── */
function OnboardingDraftPreviewWidget({ draft, onSendMessage }) {
  const isClient = draft.tenant_type === 'client';

  const [formData, setFormData] = useState({
    company_name: draft.company_name || '',
    industry: draft.industry || (isClient ? 'Technology & Enterprise Software' : 'IT Staffing & Executive Sourcing'),
    company_size: draft.company_size || '50-200 employees',
    location: draft.location || 'Bangalore / Remote',
    tech_stack: draft.tech_stack || (isClient ? 'React, Node.js, Python, PostgreSQL, AWS' : 'Talent Sourcing, Executive Search'),
    about: draft.about || (isClient ? `${draft.company_name || 'Organization'} is a technology provider operating enterprise platforms.` : `${draft.company_name || 'Consultancy'} is a specialized recruitment partner.`),
    admin_name: draft.admin_name || '',
    admin_email: draft.admin_email || '',
    password: draft.password || '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isComplete =
    formData.company_name.trim() !== '' &&
    formData.admin_name.trim() !== '' &&
    formData.admin_email.trim() !== '' &&
    formData.password.trim() !== '';

  const handleAutoFill = () => {
    const defaultName = formData.company_name || (isClient ? 'Acme Systems Inc.' : 'Apex Sourcing Partners');
    setFormData((prev) => ({
      ...prev,
      company_name: defaultName,
      industry: 'Technology & Enterprise Software',
      company_size: '50-200 employees',
      location: 'Bangalore / Remote',
      tech_stack: isClient ? 'React, Node.js, Python, PostgreSQL, AWS' : 'Talent Sourcing, Executive Search',
      about: `${defaultName} is an enterprise organization operating scalable digital platforms.`,
    }));
  };

  const handleExecuteConfirmation = () => {
    if (!isComplete) return;
    const actionText = isClient
      ? `CONFIRM_EXECUTE_CLIENT_ONBOARDING: company_name="${formData.company_name}", admin_name="${formData.admin_name}", admin_email="${formData.admin_email}", password="${formData.password}", industry="${formData.industry}", company_size="${formData.company_size}", location="${formData.location}", tech_stack="${formData.tech_stack}", about="${formData.about}"`
      : `CONFIRM_EXECUTE_VENDOR_ONBOARDING: vendor_name="${formData.company_name}", admin_name="${formData.admin_name}", admin_email="${formData.admin_email}", password="${formData.password}", industry="${formData.industry}", company_size="${formData.company_size}", location="${formData.location}", about="${formData.about}"`;
    onSendMessage(actionText);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans">
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-gray-200/90 shadow-xl space-y-5">
        {/* Widget Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-gray-950 tracking-tight">
                {isClient ? 'Onboard Buyer Company Draft' : 'Onboard Vendor Consultancy Draft'}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  isComplete
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {isComplete ? 'Ready for Confirmation' : 'Draft - Details Required'}
              </span>
            </div>
            <p className="text-[11.5px] text-gray-500 mt-1">
              Review and confirm tenant & administrator details before committing to database.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoFill}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-105 active:scale-95 shrink-0"
          >
            <Sparkles size={14} className="text-amber-100" />
            <span>+ Auto-fill with AI</span>
          </button>
        </div>

        {/* Form Fields Grid */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
              {isClient ? 'Company Name *' : 'Vendor Name *'}
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder={isClient ? "e.g. Acme Systems" : "e.g. Apex Sourcing"}
              className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Industry
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                placeholder="Technology / Software"
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Company Size
              </label>
              <input
                type="text"
                value={formData.company_size}
                onChange={(e) => handleChange('company_size', e.target.value)}
                placeholder="50-200"
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Bangalore / Remote"
              className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
            />
          </div>

          {isClient && (
            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Tech Stack
              </label>
              <input
                type="text"
                value={formData.tech_stack}
                onChange={(e) => handleChange('tech_stack', e.target.value)}
                placeholder="React, Node.js, PostgreSQL, AWS"
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
              About the Organization <span className="text-gray-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={formData.about}
              onChange={(e) => handleChange('about', e.target.value)}
              placeholder="Brief description of organization..."
              className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all resize-none"
            />
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 text-[11.5px] font-semibold flex items-center gap-2 shadow-2xs">
            <Sparkles size={16} className="text-amber-600 shrink-0" />
            <span>Company profile metadata auto-filled by AI. Enter <strong>Admin Name</strong>, <strong>Email</strong>, and <strong>Password</strong> below to finish.</span>
          </div>

          <div className="pt-2 border-t border-gray-100 font-black text-gray-950 text-xs tracking-tight">
            Administrator Account Credentials Setup
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Admin Full Name *
              </label>
              <input
                type="text"
                value={formData.admin_name}
                onChange={(e) => handleChange('admin_name', e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
                Admin Email *
              </label>
              <input
                type="email"
                value={formData.admin_email}
                onChange={(e) => handleChange('admin_email', e.target.value)}
                placeholder="admin@company.com"
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-black text-gray-700 uppercase tracking-wider mb-1">
              Admin Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Create a secure password"
                className="w-full pl-3.5 pr-16 py-2.5 bg-gray-50/80 border border-gray-200 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-black focus:ring-2 focus:ring-black/5 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[11px] font-extrabold text-gray-500 hover:text-black cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onSendMessage('Cancel draft')}
            className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel Draft
          </button>

          <button
            type="button"
            disabled={!isComplete}
            onClick={handleExecuteConfirmation}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-gray-950 via-gray-900 to-black hover:from-black hover:to-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-extrabold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2"
          >
            <CheckCircle2 size={15} />
            <span>Confirm & Execute Onboarding</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 6. Interactive Tenant Deletion Preview & Confirmation Widget ──────────── */
function TenantDeleteConfirmWidget({ draft, onSendMessage, onCopy }) {
  const isClient = draft.tenant_type === 'client';
  const users = draft.assigned_users || [];
  const userCount = draft.assigned_users_count || users.length;

  const handleConfirmDelete = () => {
    onSendMessage(`CONFIRM_DELETE_TENANT: tenant_id="${draft.tenant_id}"`);
  };

  return (
    <div className="mt-4 pt-4 border-t border-rose-200/90 text-left font-sans">
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-rose-200 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-gray-950 tracking-tight">
                  Confirm Tenant Deletion & Account Archival
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                  Destructive Action
                </span>
              </div>
              <p className="text-[11.5px] text-gray-500 mt-0.5">
                Review tenant profile details below. Manual administrator confirmation is required before proceeding.
              </p>
            </div>
          </div>
        </div>

        {/* Tenant Profile Preview Card */}
        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-100 pb-2">
            <div>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[9.5px] font-black uppercase ${
                  isClient ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                }`}
              >
                {isClient ? 'Buyer Client Company' : 'Vendor Consultancy'}
              </span>
              <h4 className="text-base font-extrabold text-gray-950 mt-1">{draft.tenant_name}</h4>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-mono">ID:</span>
              <button
                type="button"
                onClick={() => onCopy(draft.tenant_id, draft.tenant_id)}
                className="font-mono text-[11px] font-bold text-gray-900 bg-white border border-rose-200 px-2.5 py-0.5 rounded-lg hover:bg-gray-100 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Copy Tenant ID"
              >
                <span>{draft.tenant_id ? `${draft.tenant_id.slice(0, 10)}...` : ''}</span>
                <Copy size={11} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {draft.industry && (
              <div>
                <span className="font-black text-gray-500 uppercase text-[9.5px]">Industry:</span>
                <p className="font-semibold text-gray-950">{draft.industry}</p>
              </div>
            )}
            {draft.location && (
              <div>
                <span className="font-black text-gray-500 uppercase text-[9.5px]">Location:</span>
                <p className="font-semibold text-gray-950">{draft.location}</p>
              </div>
            )}
            {draft.company_size && (
              <div>
                <span className="font-black text-gray-500 uppercase text-[9.5px]">Company Size:</span>
                <p className="font-semibold text-gray-950">{draft.company_size}</p>
              </div>
            )}
            {draft.tech_stack && (
              <div>
                <span className="font-black text-gray-500 uppercase text-[9.5px]">Tech Stack:</span>
                <p className="font-semibold text-gray-950">{draft.tech_stack}</p>
              </div>
            )}
          </div>

          {draft.about && (
            <div className="pt-1 border-t border-rose-100/80">
              <span className="font-black text-gray-500 uppercase text-[9.5px]">About:</span>
              <p className="text-gray-700 text-[11px] leading-snug">{draft.about}</p>
            </div>
          )}

          {/* Warning Impact Callout */}
          <div className="p-3.5 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-950 space-y-1 shadow-2xs">
            <div className="flex items-center gap-2 font-extrabold text-xs">
              <ShieldAlert size={16} className="text-rose-700" />
              <span>Deletion Impact & Safety Check</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-900 font-semibold">
              Deleting <strong>{draft.tenant_name}</strong> will permanently remove the tenant record and archive all{' '}
              <strong>{userCount} assigned account(s)</strong> from database collections.
            </p>
          </div>

          {/* Assigned Accounts list preview */}
          {users.length > 0 && (
            <div>
              <span className="font-black text-gray-700 text-[10.5px] uppercase tracking-wider block mb-1.5">
                Accounts To Be Archived ({users.length}):
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {users.map((u, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-white border border-rose-200/80 flex items-center justify-between text-[11px] shadow-2xs"
                  >
                    <span className="font-bold text-gray-950">{u.name || u.email}</span>
                    <span className="text-gray-500 font-mono text-[10px]">
                      {u.email} ({u.role || 'User'})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onSendMessage(`Cancel deletion for tenant ${draft.tenant_name}`)}
            className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel / Keep Tenant
          </button>

          <button
            type="button"
            onClick={handleConfirmDelete}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white text-xs font-black flex items-center gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all"
          >
            <Trash2 size={15} />
            <span>Confirm & Delete Tenant</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 7. Interactive Tenant Deleted Success Widget ──────────────────────────── */
function TenantDeletedSuccessWidget({ result, onSendMessage }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-left font-sans">
      <div className="p-5 rounded-3xl bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white border border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold tracking-tight text-white">
              Tenant & Account Records Successfully Removed
            </h4>
            <p className="text-[11.5px] text-gray-300 font-medium">
              {result.message}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-gray-800/90 border border-gray-700 text-xs space-y-1 font-mono text-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Deleted Tenant ID:</span>
            <span className="font-bold text-white">{result.tenant_id}</span>
          </div>
          {result.deleted_user_emails && result.deleted_user_emails.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Archived Accounts:</span>
              <span className="font-bold text-gray-300">{result.deleted_user_emails.length} user(s)</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSendMessage('List all platform tenants')}
            className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-100 text-black text-xs font-black transition-all cursor-pointer shadow-sm"
          >
            View Active Directory
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 8. Tenant Detail Inspection Modal Drawer ─────────────────────────────── */
function TenantDetailModal({ tenant, onClose, onSendMessage, onCopy }) {
  if (!tenant) return null;
  const isClient = tenant.tenant_type === 'client';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center font-bold shadow-md">
              <Building2 size={22} />
            </div>
            <div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isClient
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                }`}
              >
                {isClient ? 'Buyer Client Company' : 'Vendor Consultancy Partner'}
              </span>
              <h2 className="text-xl font-black text-gray-950 tracking-tight mt-1">
                {tenant.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-950 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-gray-500 uppercase text-[10px]">Tenant Unique ID</span>
              <button
                type="button"
                onClick={() => onCopy(tenant.id, tenant.id)}
                className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Copy ID</span>
                <Copy size={12} />
              </button>
            </div>
            <p className="font-mono text-gray-950 font-bold select-all break-all">{tenant.id}</p>
          </div>

          <div>
            <h4 className="font-black text-gray-950 mb-2 text-xs uppercase tracking-wider">
              Assigned Platform Accounts ({tenant.assigned_users?.length || 0})
            </h4>
            {tenant.assigned_users && tenant.assigned_users.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {tenant.assigned_users.map((usr, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white border border-gray-200 flex items-center justify-between font-medium text-gray-800 shadow-2xs"
                  >
                    <span className="font-bold text-gray-950">{usr}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">Account</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">No assigned accounts associated with this tenant.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSendMessage(`List administrator accounts for tenant ${tenant.name}`);
            }}
            className="px-4 py-2.5 rounded-2xl bg-black hover:bg-gray-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            Inspect Accounts
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSendMessage(`Delete tenant ${tenant.name}`);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Delete Tenant"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminChat({ onOpenNavMenu: propsOnOpenNavMenu }) {
  const { token, user, logout } = useAuth();
  const outletContext = useOutletContext();
  const onOpenNavMenu = propsOnOpenNavMenu || outletContext?.onOpenNavMenu;

  const [threads, setThreads] = useState([
    {
      id: 'thread-1',
      title: 'Your first chat with TermJobs AI',
      createdAt: 'Just now',
      messages: [],
    },
  ]);
  const [activeThreadId, setActiveThreadId] = useState('thread-1');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mode, setMode] = useState('Chat');
  const [selectedTenantModal, setSelectedTenantModal] = useState(null);
  const messagesEndRef = useRef(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const userName = user?.name || 'Super Admin';
  const firstName = userName.split(' ')[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages, isGenerating]);

  const handleNewThread = () => {
    const newId = `thread-${Date.now()}`;
    const newThread = {
      id: newId,
      title: 'New conversation',
      createdAt: 'Just now',
      messages: [],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  const handleDeleteThread = (id, e) => {
    e.stopPropagation();
    if (threads.length <= 1) return;
    const filtered = threads.filter((t) => t.id !== id);
    setThreads(filtered);
    if (activeThreadId === id) {
      setActiveThreadId(filtered[0].id);
    }
  };

  const sendMessage = async (textToSend) => {
    const query = textToSend || input.trim();
    if (!query || isGenerating) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThreadId) {
          const isFirstUserMsg = t.messages.length === 0;
          return {
            ...t,
            title: isFirstUserMsg ? (query.length > 26 ? `${query.slice(0, 26)}...` : query) : t.title,
            messages: [...t.messages, userMsg],
          };
        }
        return t;
      })
    );

    if (!textToSend) setInput('');
    setIsGenerating(true);

    const chatHistory = activeThread?.messages ? activeThread.messages.map((m) => ({ sender: m.sender, text: m.text })) : [];

    try {
      let replyText = '';
      let executedActions = [];
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );

        const fetchPromise = request('/api/superadmin/agent/chat', {
          method: 'POST',
          token,
          body: {
            prompt: query,
            history: chatHistory,
            user_role: 'Super Admin',
            user_name: userName,
          },
        });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        replyText = res.reply;
        executedActions = res.executed_actions || [];
      } catch (err) {
        replyText = `Here is the current platform status for TermJobs. How can I assist you with platform companies, vendor consultancies, or admin accounts today?`;
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        executedActions: executedActions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [...t.messages, aiMsg],
            };
          }
          return t;
        })
      );
    } catch (err) {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: `err-${Date.now()}`,
                  sender: 'ai',
                  text: `⚠️ System Warning: Unable to process reasoning stream. ${err.message || ''}`,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ],
            };
          }
          return t;
        })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasMessages = activeThread?.messages && activeThread.messages.length > 0;

  const renderFormattedMessageText = (text, hasGraphicWidget) => {
    if (!text) return '';
    let processedText = text;
    if (hasGraphicWidget) {
      const firstLine = text.split(/\n\n|\n1\.|\n•|\n-/)[0];
      processedText = firstLine.trim();
    }
    return marked.parse(processedText);
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-[#fafafa] text-gray-900 flex overflow-hidden z-30 font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" }}
    >
      {/* Modal Drawer if a Tenant is Selected */}
      {selectedTenantModal && (
        <TenantDetailModal
          tenant={selectedTenantModal}
          onClose={() => setSelectedTenantModal(null)}
          onSendMessage={(txt) => sendMessage(txt)}
          onCopy={copyToClipboard}
        />
      )}

      {/* Sleek Warm Off-White Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'w-64 min-w-[256px]' : 'w-0 min-w-0 overflow-hidden'
        } bg-[#f7f7f5] border-r border-gray-200/80 flex flex-col justify-between transition-all duration-200 shrink-0 relative z-20 shadow-[1px_0_10px_rgba(0,0,0,0.02)]`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Sidebar Top Header */}
          <div className="p-4 flex items-center justify-between gap-2 border-b border-gray-200/60">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenNavMenu}
                className="p-1.5 rounded-xl hover:bg-gray-200/80 text-gray-700 hover:text-black transition-colors cursor-pointer"
                title="Open TermJobs Navigation Drawer"
              >
                <Menu size={18} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs shadow-2xs">
                  TJ
                </div>
                <span className="font-extrabold text-base text-gray-950 tracking-tight">TermJobs</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-xl hover:bg-gray-200/80 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose size={17} />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-3 pt-3.5 pb-1">
            <button
              type="button"
              onClick={handleNewThread}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200/90 text-gray-950 text-xs font-bold flex items-center gap-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            >
              <Plus size={16} className="text-gray-700" />
              <span>New Conversation</span>
            </button>
          </div>

          {/* Quick Menu Items */}
          <div className="px-3 pt-3 pb-1 space-y-0.5 text-xs text-gray-600 font-bold">
            <div className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center gap-2.5 transition-colors">
              <FolderKanban size={15} className="text-gray-500" />
              <span>Workspaces & Projects</span>
            </div>
            <div className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center gap-2.5 transition-colors">
              <Box size={15} className="text-gray-500" />
              <span>Artifacts & Reports</span>
            </div>
            <div className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2.5">
                <Code2 size={15} className="text-gray-500" />
                <span>Code & API</span>
              </div>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-black text-white">PRO</span>
            </div>
            <div className="px-3 py-2 rounded-xl hover:bg-white hover:text-gray-950 cursor-pointer flex items-center gap-2.5 transition-colors">
              <Wrench size={15} className="text-gray-500" />
              <span>Customize TermJobs</span>
            </div>
          </div>

          {/* Chats and Tasks List */}
          <div className="px-3 pt-4 pb-2 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
              <span>Chats & History</span>
              <SlidersHorizontal size={12} className="cursor-pointer hover:text-gray-800" />
            </div>

            <div className="space-y-1">
              {threads.map((t) => {
                const isActive = t.id === activeThreadId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={`group px-3 py-2 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between relative ${
                      isActive
                        ? 'bg-white text-gray-950 font-extrabold shadow-2xs border border-gray-200/90 pl-3.5 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-1 before:bg-black before:rounded-full'
                        : 'text-gray-600 hover:bg-white/80 hover:text-gray-950 font-semibold'
                    }`}
                  >
                    <span className="truncate pr-2">{t.title}</span>

                    {threads.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteThread(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-600 transition-opacity"
                        title="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Bottom User Profile */}
        <div className="p-3 border-t border-gray-200/90 bg-white/70 backdrop-blur-md flex items-center justify-between text-xs text-gray-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-black to-gray-800 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ring-2 ring-black/10">
              {firstName[0]}
            </div>
            <div className="truncate min-w-0">
              <div className="truncate font-extrabold text-xs leading-tight text-gray-950">{userName}</div>
              <div className="text-[10px] text-gray-500 font-semibold">Super Admin Console</div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-[#fafafa] relative min-w-0 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-48 bg-gradient-to-b from-amber-500/5 via-slate-50/20 to-transparent pointer-events-none blur-3xl" />

        {/* Top Navbar */}
        <div className="px-4 py-3 flex items-center justify-between gap-4 z-20 shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNavMenu}
              className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-700 hover:text-black transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
              title="Super Admin Navigation"
            >
              <Menu size={17} />
              <span className="hidden sm:inline text-gray-700">Dashboard Menu</span>
            </button>
          </div>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-extrabold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              TermJobs AI • Super Admin Console
            </span>
          </div>
        </div>

        {/* Center Section: Initial Greeting OR Active Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 flex flex-col relative z-10">
          {!hasMessages ? (
            /* Modern Anthropic Claude 3.5 Style Hero Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md animate-pulse">
                  <Sparkles size={22} />
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl text-gray-950 font-normal tracking-tight">
                  Back at it, {firstName}
                </h1>
              </div>

              {/* Central Elevated Prompt Box */}
              <div className="w-full bg-white border border-gray-200/90 focus-within:border-black rounded-3xl p-5 shadow-[0_10px_35px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between min-h-[160px]">
                <textarea
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can TermJobs AI assist with platform tenants today?"
                  className="w-full bg-transparent text-sm sm:text-base text-gray-950 placeholder-gray-400 focus:outline-none resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                      title="Attach file"
                    >
                      <Plus size={16} />
                    </button>

                    <div className="flex items-center rounded-xl bg-gray-100/80 p-0.5 text-xs font-bold text-gray-800">
                      <button
                        type="button"
                        onClick={() => setMode('Chat')}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          mode === 'Chat' ? 'bg-white text-black shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('Cowork')}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          mode === 'Cowork' ? 'bg-white text-black shadow-xs font-extrabold' : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        Cowork
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!input.trim() || isGenerating}
                      onClick={() => sendMessage()}
                      className="p-2.5 rounded-2xl bg-gradient-to-r from-gray-950 to-black hover:from-black hover:to-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <ArrowUp size={17} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Prompts Pills */}
              <div className="flex items-center justify-center gap-2 flex-wrap mt-6">
                {ACTION_PILLS.map((p) => {
                  const IconComp = p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => sendMessage(p.prompt)}
                      className="px-4 py-2 rounded-full bg-white/90 border border-gray-200/90 hover:border-gray-400 text-xs text-gray-800 hover:text-gray-950 font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                    >
                      <IconComp size={14} className="text-gray-500" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Conversation View */
            <div className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full py-4">
              <div className="space-y-6 pb-48 sm:pb-56">
                {activeThread?.messages.map((msg) => {
                  const isUser = msg.sender === 'user';

                  const hasTenantWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'list_tenants');
                  const tenantAction = msg.executedActions?.find((a) => a.tool === 'list_tenants');
                  const tenantsData = Array.isArray(tenantAction?.result) ? tenantAction.result : [];

                  const hasUserWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'list_admin_accounts');
                  const userAction = msg.executedActions?.find((a) => a.tool === 'list_admin_accounts');
                  const usersData = Array.isArray(userAction?.result) ? userAction.result : [];

                  const hasStatsWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'get_platform_stats');
                  const statsAction = msg.executedActions?.find((a) => a.tool === 'get_platform_stats');
                  const statsData = statsAction?.result || {};

                  const hasOnboardWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'onboard_client_company' || a.tool === 'onboard_vendor_consultancy');
                  const onboardAction = msg.executedActions?.find((a) => a.tool === 'onboard_client_company' || a.tool === 'onboard_vendor_consultancy');
                  const onboardData = onboardAction?.result || {};

                  const hasDraftWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'draft_onboarding_preview');
                  const draftAction = msg.executedActions?.find((a) => a.tool === 'draft_onboarding_preview');
                  const draftData = draftAction?.result || {};

                  const hasDeleteDraftWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'draft_tenant_deletion');
                  const deleteDraftAction = msg.executedActions?.find((a) => a.tool === 'draft_tenant_deletion');
                  const deleteDraftData = deleteDraftAction?.result || {};

                  const hasDeleteSuccessWidget = !isUser && msg.executedActions?.some((a) => a.tool === 'delete_tenant');
                  const deleteSuccessAction = msg.executedActions?.find((a) => a.tool === 'delete_tenant');
                  const deleteSuccessData = deleteSuccessAction?.result || {};

                  const hasGraphicWidget = hasTenantWidget || hasUserWidget || hasStatsWidget || hasOnboardWidget || hasDraftWidget || hasDeleteDraftWidget || hasDeleteSuccessWidget;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1.5">
                        {isUser ? (
                          <span>{userName}</span>
                        ) : (
                          <>
                            <Sparkles size={11} className="text-amber-500" />
                            <span>TermJobs AI</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`p-4 sm:p-5 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white rounded-tr-md max-w-[85%] sm:max-w-[78%] font-medium shadow-md border border-gray-800/80'
                            : 'bg-white border border-gray-200/90 text-gray-950 rounded-tl-md w-full shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
                        }`}
                      >
                        {/* Formatted Text */}
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-sans text-white text-xs sm:text-sm font-medium">
                            {msg.text}
                          </div>
                        ) : (
                          <div
                            className="prose prose-sm max-w-none text-gray-950 font-sans"
                            dangerouslySetInnerHTML={{
                              __html: renderFormattedMessageText(msg.text, hasGraphicWidget),
                            }}
                          />
                        )}

                        {/* 1. Tenant Console Widget */}
                        {hasTenantWidget && (
                          <TenantConsoleWidget
                            tenants={tenantsData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                            onCopy={copyToClipboard}
                            onSelectTenant={(t) => setSelectedTenantModal(t)}
                          />
                        )}

                        {/* 2. Admin Accounts Widget */}
                        {hasUserWidget && (
                          <AdminAccountsWidget
                            users={usersData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {/* 3. Platform Analytics Widget */}
                        {hasStatsWidget && (
                          <PlatformMetricsWidget
                            stats={statsData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                          />
                        )}

                        {/* 4. Onboarding Success Widget */}
                        {hasOnboardWidget && onboardData.tenant_id && (
                          <OnboardingSuccessWidget
                            result={onboardData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {/* 5. Draft Form Preview Widget */}
                        {hasDraftWidget && (
                          <OnboardingDraftPreviewWidget
                            draft={draftData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                          />
                        )}

                        {/* 6. Tenant Deletion Preview Widget */}
                        {hasDeleteDraftWidget && (
                          <TenantDeleteConfirmWidget
                            draft={deleteDraftData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {/* 7. Tenant Deleted Success Widget */}
                        {hasDeleteSuccessWidget && deleteSuccessData.tenant_id && (
                          <TenantDeletedSuccessWidget
                            result={deleteSuccessData}
                            onSendMessage={(promptText) => sendMessage(promptText)}
                            onCopy={copyToClipboard}
                          />
                        )}

                        {/* Deduplicated Executed Action Badges */}
                        {!isUser && msg.executedActions && msg.executedActions.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">EXECUTED ACTIONS:</span>
                            {Array.from(new Set(msg.executedActions.map((a) => a.tool))).map((toolName, idx) => (
                              <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10.5px] font-black flex items-center gap-1">
                                <Zap size={11} className="text-emerald-600" />
                                <span>{toolName}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {!isUser && (
                          <div className="flex items-center justify-end pt-2 mt-3 border-t border-gray-100 text-xs">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(msg.text, msg.id)}
                              className="flex items-center gap-1.5 text-gray-400 hover:text-gray-900 font-bold transition-colors cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check size={13} className="text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copy response</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isGenerating && (
                  <div className="flex flex-col items-start space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-amber-500 animate-spin" />
                      <span>TermJobs AI</span>
                    </div>
                    <div className="p-4 sm:p-5 rounded-3xl bg-white border border-gray-200/90 rounded-tl-md text-xs text-gray-600 font-semibold flex items-center gap-2.5 shadow-sm">
                      <span>Reasoning over platform metrics</span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Centered Floating Input Bar for Active Chat */}
              <div className="sticky bottom-4 left-0 right-0 w-full max-w-2xl mx-auto bg-white/95 backdrop-blur-xl border border-gray-200/90 focus-within:border-black rounded-3xl p-3.5 sm:p-4 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] transition-all">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to TermJobs AI..."
                  className="w-full bg-transparent text-xs sm:text-sm text-gray-950 placeholder-gray-400 focus:outline-none resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-1.5 rounded-xl text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="text-[10.5px] text-gray-400 font-semibold">Press Enter to send</span>
                  </div>

                  <button
                    type="button"
                    disabled={!input.trim() || isGenerating}
                    onClick={() => sendMessage()}
                    className="p-2 rounded-xl bg-gradient-to-r from-gray-950 to-black hover:from-black hover:to-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
