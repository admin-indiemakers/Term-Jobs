import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AssistantWidget from '../components/AssistantWidget';
import OnboardCompanyModal from '../components/OnboardCompanyModal';
import OnboardVendorModal from '../components/OnboardVendorModal';
import {
  Sparkles,
  Menu,
  X,
  Building2,
  Users,
  Bell,
  UserCheck,
  Search,
  ChevronDown,
  LayoutDashboard,
  Briefcase,
  Layers,
  BarChart3,
  LogOut,
  User,
  KeyRound,
  FileText,
  Clock,
  Shield,
  CreditCard,
  MoreHorizontal
} from 'lucide-react';
import { request } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Backdrop } from '../components/landing/Backdrop';

function initials(name) {
  if (!name) return 'AM';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

const CONSOLE_CLASS = {
  'Super Admin': 'console-superadmin',
  Admin: 'console-admin',
  HR: 'console-hr',
  'Hiring Manager': 'console-hiringmanager',
  Recruiter: 'console-recruiter',
  Director: 'console-director',
};

/* Exact SVGs matching user's reference design */
const Icons = {
  Logout: (props) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Dashboard: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Requisitions: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <rect width="6" height="6" x="9" y="9" />
    </svg>
  ),
  Plus: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Diamond: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z" />
    </svg>
  ),
  CandidatesBank: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  ),
  Shortlisted: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Interviews: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    </svg>
  ),
  Accepted: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  ),
  PortalAccess: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    </svg>
  ),
  Flag: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Team: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Timesheet: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Receipt: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M14 8H8" />
      <path d="M16 12H8" />
      <path d="M13 16H8" />
    </svg>
  ),
  Agreements: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Chat: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Mail: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  OnboardCompany: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  ),
  OnboardVendor: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="7" r="4" />
      <path d="M17 11v6" />
      <path d="M14 14h6" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </svg>
  ),
};

export default function DashboardLayout() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isOnboardCompanyModalOpen, setIsOnboardCompanyModalOpen] = useState(false);
  const [isOnboardVendorModalOpen, setIsOnboardVendorModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Dynamic live count badges for Hiring Manager
  const [hmCounts, setHmCounts] = useState({ requisitions: 0, candidates: 0, openIssues: 0, pendingTimesheets: 0, pendingExpenses: 0 });

  useEffect(() => {
    if (user?.role === 'Hiring Manager' && token) {
      Promise.all([
        request('/requisitions', { token }).catch(() => []),
        request('/candidates/shortlisted', { token }).catch(() => []),
        request('/candidates?status=Accepted', { token }).catch(() => []),
        request('/api/onboarding/issues', { token }).catch(() => []),
        request('/api/workforce/stats', { token }).catch(() => null),
      ]).then(([reqs, shortlisted, accepted, issuesData, wfStats]) => {
        const rCount = Array.isArray(reqs) ? reqs.length : 0;
        const sList = Array.isArray(shortlisted) ? shortlisted : (shortlisted?.shortlisted_candidates || []);
        const aList = Array.isArray(accepted) ? accepted : (accepted?.candidates || []);
        const issueList = Array.isArray(issuesData) ? issuesData : issuesData?.issues || [];
        const openIssues = issueList.filter((i) => i.status === 'open').length;
        const pendingTs = wfStats?.stats?.pending_timesheets || 0;
        const pendingExp = wfStats?.stats?.pending_expenses || 0;
        setHmCounts({
          requisitions: rCount,
          candidates: sList.length + aList.length,
          openIssues: openIssues,
          pendingTimesheets: pendingTs,
          pendingExpenses: pendingExp,
        });
      }).catch(() => { });
    }
  }, [user?.role, token]);

  // Dynamic live count for Director pending agreements and work orders
  const [directorPendingAgreements, setDirectorPendingAgreements] = useState(0);
  const [directorPendingWorkOrders, setDirectorPendingWorkOrders] = useState(0);

  useEffect(() => {
    if (user?.role === 'Director' && token) {
      request('/api/work-orders/director-agreements', { token })
        .then((res) => {
          if (Array.isArray(res)) {
            const pending = res.filter(
              (a) => a.status === 'Pending Director Approval' || a.status === 'Submitted'
            ).length;
            setDirectorPendingAgreements(pending);
          }
        })
        .catch(() => { });

      request('/api/workforce/director/work-orders', { token })
        .then((res) => {
          setDirectorPendingWorkOrders(res?.pending_director_count || 0);
        })
        .catch(() => { });
    }
  }, [user?.role, token, location.pathname]);

  // Dynamic live count for Procurement SOW billing orders
  const [procurementPendingSows, setProcurementPendingSows] = useState(0);

  useEffect(() => {
    if ((user?.role === 'Procurement' || user?.role === 'Procurement Team') && token) {
      request('/api/workforce/procurement/sow-agreements', { token })
        .then((res) => {
          if (Array.isArray(res?.sow_agreements)) {
            const pending = res.sow_agreements.filter(
              (s) => s.status === 'Sent to Procurement' || s.status === 'Submitted'
            ).length;
            setProcurementPendingSows(pending);
          }
        })
        .catch(() => { });
    }
  }, [user?.role, token, location.pathname]);

  // Dynamic live count for Finance pending work order payments
  const [financePendingPayments, setFinancePendingPayments] = useState(0);

  useEffect(() => {
    if ((user?.role === 'Finance' || user?.role === 'Finance Team') && token) {
      request('/api/workforce/finance/work-orders', { token })
        .then((res) => {
          setFinancePendingPayments(res?.ready_for_payment_count || 0);
        })
        .catch(() => { });
    }
  }, [user?.role, token, location.pathname]);

  // Dynamic live count for Super Admin candidate pool
  const [superAdminCandidateCount, setSuperAdminCandidateCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'Super Admin' && token) {
      request('/api/superadmin/candidate-pool', { token })
        .then((res) => {
          setSuperAdminCandidateCount(res?.total_count || 0);
        })
        .catch(() => { });
    }
  }, [user?.role, token, location.pathname]);

  // Dynamic live count for Super Admin candidate management selections
  const [superAdminSelectedCount, setSuperAdminSelectedCount] = useState(0);

  useEffect(() => {
    if ((user?.role === 'Super Admin' || user?.role?.toLowerCase() === 'super admin') && token) {
      request('/api/superadmin/candidate-management', { token })
        .then((res) => {
          setSuperAdminSelectedCount(res?.total_count || 0);
        })
        .catch(() => { });
    }
  }, [user?.role, token, location.pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowMoreMenu(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  // Modal event listeners for AI Chat quick dock
  useEffect(() => {
    const handleOpenCompany = () => setIsOnboardCompanyModalOpen(true);
    const handleOpenVendor = () => setIsOnboardVendorModalOpen(true);
    window.addEventListener('open-onboard-company-modal', handleOpenCompany);
    window.addEventListener('open-onboard-vendor-modal', handleOpenVendor);
    return () => {
      window.removeEventListener('open-onboard-company-modal', handleOpenCompany);
      window.removeEventListener('open-onboard-vendor-modal', handleOpenVendor);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8F9FA]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8F9FA]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  const userRole = (user?.role || '').trim();
  const consoleClass = CONSOLE_CLASS[userRole] || 'console-default';
  const isCompanyAdmin = userRole === 'Admin' || userRole.toLowerCase() === 'admin';
  const isSuperAdminChat = location.pathname === '/dashboard/superadmin/chat' || location.pathname.endsWith('/superadmin/chat');
  const isHiringManagerChat = location.pathname === '/dashboard/hiring-manager/chat' || location.pathname.endsWith('/hiring-manager/chat');
  const isAiChatPage = isSuperAdminChat || isHiringManagerChat;

  // ==========================================
  // COMPANY ADMIN DEDICATED LAYOUT (TOP BAR + FULL CANVAS)
  // ==========================================
  if (isCompanyAdmin) {
    const companyName = user?.tenant_name || 'TCS';
    const adminNavLinks = [
      { to: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/dashboard/admin/hiring-managers', label: 'Hiring', icon: Users, end: false },
      { to: '/dashboard/requisitions', label: 'Requisitions', icon: Briefcase, end: false },
      { to: '/dashboard/admin/directors', label: 'Team', icon: UserCheck, end: false },
      { to: '/dashboard/admin/procurement', label: 'Procurement', icon: Building2, end: false },
      { to: '/dashboard/admin/finance', label: 'Finance', icon: CreditCard, end: false },
      { to: '/dashboard/admin/profile', label: 'Profile', icon: User, end: false },
    ];

    return (
      <div className="min-h-screen w-full bg-paper text-ink flex flex-col antialiased relative selection:bg-black selection:text-white font-sans overflow-x-hidden">
        {/* Landing Page Background System (radial light, 96px grid layer, blurred radial light orbs, animated bezier ribbons & grain layer) */}
        <Backdrop tone="light" fixed />

        {/* Top Navigation Bar - Completely Transparent with Floating Glassmorphic Elements */}
        <header className="sticky top-0 z-40 w-full bg-transparent border-b border-transparent px-4 sm:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-4">
          {/* Left: Logo & Company Name */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-1.5 text-gray-500 hover:text-black rounded-lg hover:bg-white/60 cursor-pointer"
            >
              <Menu size={18} />
            </button>

            <div
              onClick={() => navigate('/dashboard/admin')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-black text-white font-black text-sm flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                {companyName.charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight text-left">
                <div className="text-[14px] font-extrabold text-gray-900 tracking-tight flex items-center gap-1">
                  {companyName}
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  Admin Console
                </div>
              </div>
            </div>
          </div>

          {/* Center: Horizontal Navigation Items (Glassmorphic Floating Pill) */}
          <nav className="hidden lg:flex items-center gap-1 bg-white/40 hover:bg-white/50 backdrop-blur-2xl p-1 rounded-full border border-white/70 shadow-[0_4px_24px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.8)] transition-all">
            {adminNavLinks.map((item) => {
              const IconComp = item.icon;
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
                    isActive
                      ? 'text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                  }`}
                  title={item.label}
                >
                  {isActive && (
                    <motion.div
                      layoutId="adminNavActivePill"
                      className="absolute inset-0 bg-white/90 backdrop-blur-md rounded-full border border-white/90 shadow-xs"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <IconComp
                    size={14}
                    className={`relative z-10 shrink-0 transition-colors duration-200 ${
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  />
                  <span className="relative z-10 whitespace-nowrap">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}


          </nav>

          {/* Right: Notifications & User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                className="w-8 h-8 rounded-full border border-white/60 bg-white/35 hover:bg-white/60 backdrop-blur-xl flex items-center justify-center text-gray-600 hover:text-black transition-all shadow-2xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] cursor-pointer relative"
                title="Notifications"
              >
                <Bell size={14} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
              </button>
            </div>

            {/* User Profile Pill (Compact icon-only by default, smoothly expands on active/open) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                className={`relative flex items-center rounded-full text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                  showUserMenu
                    ? 'bg-white/90 backdrop-blur-md text-gray-900 shadow-xs border border-white/90 pl-1 pr-2.5 py-1 gap-2'
                    : 'border border-white/60 bg-white/35 hover:bg-white/60 backdrop-blur-xl p-0.5 shadow-2xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]'
                }`}
                title={user?.name || 'Admin Profile'}
              >
                <div className="w-7 h-7 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                  {initials(user?.name)}
                </div>
                <AnimatePresence initial={false}>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, width: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 'auto' }}
                      exit={{ opacity: 0, scale: 0.92, width: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap"
                    >
                      <div className="text-left hidden sm:block leading-tight pr-0.5">
                        <div className="text-xs font-bold text-gray-900 truncate">{user?.name || 'Arjun M'}</div>
                        <div className="text-[10px] text-gray-400 font-medium">Admin</div>
                      </div>
                      <ChevronDown size={12} className="text-gray-400 shrink-0" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 mt-2 w-52 bg-white/85 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/80 py-2 z-50 text-left"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-100/80">
                      <div className="text-xs font-bold text-gray-900">{user?.name || 'Arjun M'}</div>
                      <div className="text-[11px] text-gray-400 truncate">{user?.email || 'admin@tcs.com'}</div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/admin/profile')}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-white/60 hover:text-black text-left cursor-pointer"
                      >
                        <User size={14} className="text-gray-400" />
                        <span>Company Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/interviews')}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-white/60 hover:text-black text-left cursor-pointer"
                      >
                        <BarChart3 size={14} className="text-gray-400" />
                        <span>Interviews & Reports</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-gray-100/80">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50/80 text-left cursor-pointer"
                      >
                        <LogOut size={14} className="text-red-500" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer for Admin */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-64 max-w-[80vw] h-full bg-white border-r border-gray-200 p-5 flex flex-col z-60 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center">
                    {companyName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-sm text-gray-900">{companyName} Admin</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-1.5 py-4 flex-1 overflow-y-auto">
                {adminNavLinks.concat(moreLinks).map((link) => {
                  const LIcon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <NavLink
                      key={link.label}
                      to={link.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <LIcon size={16} />
                      <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Area for Company Admin */}
        <main className="flex-1 w-full max-w-[1580px] mx-auto px-4 sm:px-8 pt-4 sm:pt-6 pb-4 z-10 flex flex-col justify-start">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full h-full flex-1 flex flex-col"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  // ==========================================
  // OTHER ROLES (SUPER ADMIN, RECRUITER, HM, DIRECTOR, ETC.)
  // (PRESERVED EXACTLY AS BEFORE)
  // ==========================================
  const isModernLayout = userRole === 'Recruiter' || userRole === 'Hiring Manager' || userRole === 'Super Admin' || userRole.toLowerCase() === 'super admin';

  const navItems =
    userRole === 'Hiring Manager'
      ? [
        { to: '/dashboard/hiring-manager', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: Icons.Dashboard },
        { to: '/dashboard/hiring-manager/chat', label: 'Hiring AI Chat', end: true, section: 'WORKSPACE', icon: Icons.Chat },
        { to: '/dashboard/requisitions', label: 'Requisitions', end: false, section: 'HIRING', icon: Icons.Requisitions, count: hmCounts.requisitions },
        { to: '/dashboard/requisitions/new', label: 'New Requisition', end: true, section: 'HIRING', icon: Icons.Plus },
        { to: '/dashboard/candidates', label: 'Candidates', end: false, section: 'CANDIDATES', icon: Icons.Diamond, count: hmCounts.candidates },
        { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, section: 'CANDIDATES', icon: Icons.Interviews },
        { to: '/dashboard/candidates/issues', label: 'Reported Issues', end: true, section: 'CANDIDATES', icon: Icons.Flag, badge: hmCounts.openIssues },
        { to: '/dashboard/candidates/portal-access', label: 'Portal Access', end: true, section: 'CANDIDATES', icon: Icons.PortalAccess },
        { to: '/dashboard/workforce/team', label: 'Team Overview', end: false, section: 'WORKFORCE', icon: Icons.Team },
        { to: '/dashboard/workforce/timesheets', label: 'Timesheets', end: false, section: 'WORKFORCE', icon: Icons.Timesheet, badge: hmCounts.pendingTimesheets },
        { to: '/dashboard/workforce/expenses', label: 'Expenses', end: false, section: 'WORKFORCE', icon: Icons.Receipt, badge: hmCounts.pendingExpenses },
      ]
      : userRole === 'Recruiter'
        ? [
          { to: '/dashboard/recruiter', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: Icons.Dashboard },
          { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, section: 'WORKSPACE', icon: Icons.Interviews },
          { to: '/dashboard/recruiter/requisitions', label: 'Requisitions', end: true, section: 'WORKSPACE', icon: Icons.Requisitions },
          { to: '/dashboard/recruiter/candidates', label: 'Candidates Bank', end: true, section: 'WORKSPACE', icon: Icons.CandidatesBank },
          { to: '/dashboard/recruiter/shortlisted', label: 'Shortlisted Candidates', end: true, section: 'WORKSPACE', icon: Icons.Shortlisted },
          { to: '/dashboard/recruiter/interviews', label: 'Interview Requests', end: true, section: 'WORKSPACE', icon: Icons.Interviews },
          { to: '/dashboard/recruiter/agreements', label: 'Agreements', end: true, section: 'WORKSPACE', icon: Icons.Agreements },
          { to: '/dashboard/recruiter/accepted', label: 'Accepted Candidates', end: true, section: 'CANDIDATE MANAGEMENT', icon: Icons.Accepted },
          { to: '/dashboard/recruiter/portal-access', label: 'Portal Access', end: true, section: 'CANDIDATE MANAGEMENT', icon: Icons.PortalAccess },
          { to: '/dashboard/recruiter/workers', label: 'Workers', end: true, section: 'CANDIDATE MANAGEMENT', icon: Icons.Team },
        ]
        : userRole === 'Director'
          ? [
            { to: '/dashboard/director', label: 'Executive Overview', end: true, icon: Icons.Dashboard },
            { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, icon: Icons.Interviews },
            { to: '/dashboard/director/work-orders', label: 'Work Orders', end: true, icon: Icons.Receipt, badge: directorPendingWorkOrders },
            { to: '/dashboard/director/agreements', label: 'Agreements', end: true, icon: Icons.Agreements, badge: directorPendingAgreements }
          ]
          : (userRole === 'Procurement' || userRole === 'Procurement Team')
            ? [
              { to: '/dashboard/procurement', label: 'Work Orders', end: true, icon: Icons.Agreements, badge: procurementPendingSows },
              { to: '/dashboard/requisitions', label: 'Requisitions', end: false, icon: Icons.Requisitions },
              { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, icon: Icons.Interviews },
            ]
            : (userRole === 'Finance' || userRole === 'Finance Team')
              ? [
                { to: '/dashboard/finance', label: 'Work Orders & Payments', end: true, icon: Icons.Receipt, badge: financePendingPayments },
                { to: '/dashboard/requisitions', label: 'Requisitions', end: false, icon: Icons.Requisitions },
                { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, icon: Icons.Interviews },
              ]
              : (userRole === 'Super Admin' || userRole.toLowerCase() === 'super admin')
                ? [
                  { to: '/dashboard/superadmin', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: Icons.Dashboard },
                  { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, section: 'WORKSPACE', icon: Icons.Interviews },
                  { to: '/dashboard/superadmin/chat', label: 'AI Chat', end: true, section: 'WORKSPACE', icon: Icons.Chat },
                  { to: '/dashboard/superadmin/candidate-management', label: 'Candidate Management', end: false, section: 'CANDIDATE MANAGEMENT', icon: Icons.Accepted, badge: superAdminSelectedCount },
                  { to: '/dashboard/superadmin/candidate-management?tab=billing', label: 'Candidate Billing', end: false, section: 'CANDIDATE MANAGEMENT', icon: Icons.Receipt },
                  { to: '/dashboard/superadmin/candidates', label: 'Candidate Pool', end: false, section: 'CANDIDATE MANAGEMENT', icon: Icons.Diamond, count: superAdminCandidateCount },
                  { to: '/dashboard/superadmin/outreach', label: 'AI Email Outreach', end: false, section: 'CANDIDATE MANAGEMENT', icon: Icons.Mail },
                  { action: () => setIsOnboardCompanyModalOpen(true), label: 'Onboard Company', section: 'PLATFORM ONBOARDING', icon: Icons.Plus },
                  { action: () => setIsOnboardVendorModalOpen(true), label: 'Onboard Vendor', section: 'PLATFORM ONBOARDING', icon: Icons.Plus },
                  { to: '/dashboard/superadmin/accounts', label: 'Buyer Accounts', end: false, section: 'ACCOUNTS & ADMIN', icon: Icons.Requisitions },
                  { to: '/dashboard/superadmin/admin-accounts', label: 'Admin Accounts', end: false, section: 'ACCOUNTS & ADMIN', icon: Icons.PortalAccess },
                ]
                : [
                  { to: '/dashboard/hr', label: 'Dashboard', end: true, icon: Icons.Dashboard },
                  { to: '/dashboard/interviews', label: 'Interviews & AI Scores', end: false, icon: Icons.Interviews },
                ];

  const renderSidebarContent = (onLinkClick) => (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Brand Header */}
      <div className="sidebar-brand shrink-0 pb-3.5 border-b border-[#EAEAE6] mb-3">
        {userRole === 'Recruiter' ? (
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
              }}
              className="flex items-center justify-center font-extrabold text-[14px] shrink-0 shadow-xs"
            >
              TJ
            </div>
            <div className="leading-tight">
              <div className="text-[15.5px] font-extrabold text-[#0A0A0A] tracking-tight">Term Jobs</div>
              <div className="text-[11.5px] text-[#8A8A85] font-medium mt-0.5">Vendor Portal</div>
            </div>
          </div>
        ) : userRole === 'Hiring Manager' ? (
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
              }}
              className="flex items-center justify-center font-extrabold text-[16px] shrink-0 shadow-xs uppercase"
            >
              {(user?.tenant_name || 'Bearitt').trim().charAt(0)}
            </div>
            <div className="leading-tight">
              <div className="text-[15.5px] font-extrabold text-[#0A0A0A] tracking-tight">{user?.tenant_name || 'Bearitt'}</div>
              <div className="text-[11.5px] text-[#8A8A85] font-medium mt-0.5">Hiring Manager</div>
            </div>
          </div>
        ) : userRole === 'Super Admin' ? (
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
              }}
              className="flex items-center justify-center font-extrabold text-[14px] shrink-0 shadow-xs"
            >
              SA
            </div>
            <div className="leading-tight">
              <div className="text-[15.5px] font-extrabold text-[#0A0A0A] tracking-tight">Term Jobs</div>
              <div className="text-[11.5px] text-[#8A8A85] font-medium mt-0.5">Super Admin</div>
            </div>
          </div>
        ) : (
          <div className="brand-text">
            <span className="brand-name">{user?.tenant_name || 'Term Jobs'}</span>
            <span className="brand-sub">{userRole}</span>
          </div>
        )}
      </div>

      {/* Navigation list */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
        <nav className="flex flex-col gap-1 pb-2">
          {(() => {
            let lastSection = null;
            return navItems.map((item) => {
              const showSection = item.section && item.section !== lastSection;
              if (item.section) lastSection = item.section;
              const IconComp = item.icon;

              const isCandidateMgmtPath = location.pathname.startsWith('/dashboard/superadmin/candidate-management') || location.pathname.startsWith('/dashboard/candidate-management');

              const isItemActive = item.to === '/dashboard/requisitions'
                ? location.pathname.startsWith('/dashboard/requisitions') && location.pathname !== '/dashboard/requisitions/new'
                : item.to === '/dashboard/superadmin/candidate-management?tab=billing'
                  ? isCandidateMgmtPath && location.search.includes('tab=billing')
                  : item.to === '/dashboard/superadmin/candidate-management'
                    ? isCandidateMgmtPath && !location.search.includes('tab=billing')
                    : (item.to === '/dashboard/candidates' || item.to === '/dashboard/superadmin/candidates')
                      ? ((location.pathname.startsWith('/dashboard/candidates') || location.pathname.startsWith('/dashboard/superadmin/candidates') || location.pathname.includes('candidate-pool') || location.pathname.includes('candidatepool')) && !isCandidateMgmtPath)
                      : item.to === '/dashboard/director'
                        ? location.pathname === '/dashboard/director' || location.pathname.startsWith('/dashboard/director/approvals') || location.pathname.startsWith('/dashboard/director/requisitions')
                        : item.end
                          ? location.pathname === item.to
                          : item.to ? location.pathname.startsWith(item.to) : false;

              return (
                <React.Fragment key={item.label}>
                  {showSection && (
                    <div className="text-[10px] font-extrabold tracking-wider text-[#8A8A85] uppercase px-3 pt-3 pb-1">
                      {item.section}
                    </div>
                  )}
                  {item.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        item.action();
                        if (onLinkClick) onLinkClick();
                      }}
                      className="nav-link sidebar-nav-btn text-left w-full flex items-center justify-between"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <div className="flex items-center gap-2.5">
                        {IconComp && <IconComp className="shrink-0" size={15} />}
                        <span className="font-semibold text-[13px]">{item.label}</span>
                      </div>
                    </button>
                  ) : item.to ? (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onLinkClick}
                      className={`nav-link ${isItemActive ? 'active-nav-tab' : 'sidebar-nav-btn'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        {IconComp && <IconComp className="shrink-0" size={15} />}
                        <span className="font-semibold text-[13px]">{item.label}</span>
                        {item.badge > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[9.5px] font-black leading-none">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.count !== undefined && (
                        <span
                          className={`text-[11px] font-bold ${isItemActive ? 'text-white' : 'text-[#8A8A85]'} ml-auto pr-1`}
                        >
                          {item.count}
                        </span>
                      )}
                    </NavLink>
                  ) : (
                    <span className="nav-link sidebar-nav-btn">
                      <div className="flex items-center gap-2.5">
                        {IconComp && <IconComp className="shrink-0" size={15} />}
                        <span className="font-semibold text-[13px]">{item.label}</span>
                      </div>
                    </span>
                  )}
                </React.Fragment>
              );
            });
          })()}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer shrink-0 pt-3.5 border-t border-[#EAEAE6] mt-auto">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
              }}
              className="flex items-center justify-center font-bold text-[14px] shrink-0 shadow-2xs overflow-hidden"
            >
              {user?.logo_url ? (
                <img src={user.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                initials(user?.name)
              )}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[13.5px] font-extrabold text-[#0A0A0A] tracking-tight truncate">
                {user?.name || userRole}
              </div>
              <div className="text-[11px] text-[#8A8A85] font-medium mt-0.5 truncate">
                {userRole}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            title="Sign out"
            className="p-1.5 text-[#8A8A85] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Icons.Logout />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${consoleClass} ${isAiChatPage ? 'ai-chat-mode' : ''}`}>
      <style>{`
        .sidebar a,
        .sidebar button,
        .nav-link,
        .sidebar-nav-btn,
        .active-nav-tab {
          outline: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .sidebar-nav-btn {
          background-color: transparent !important;
          color: #4A4A45 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          border-radius: 12px !important;
          padding: 8.5px 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          transition: all 0.15s ease-in-out !important;
        }
        .sidebar-nav-btn:hover {
          background-color: #EAEAE6 !important;
          color: #0A0A0A !important;
          font-weight: 600 !important;
        }
        .active-nav-tab {
          background-color: #0A0A0A !important;
          color: #FFFFFF !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          border-radius: 14px !important;
          padding: 10px 14px 10px 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18) !important;
        }
        .active-nav-tab * {
          color: #FFFFFF !important;
        }
        .app-shell {
          background-color: #E8EBF0 !important;
          min-height: 100vh !important;
          width: 100% !important;
          display: flex !important;
          align-items: flex-start !important;
        }
        .sidebar {
          width: 272px !important;
          min-width: 272px !important;
          max-width: 272px !important;
          background-color: #FFFFFF !important;
          border-radius: 30px !important;
          border: 1px solid #E2E2DC !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02) !important;
          height: calc(100vh - 32px) !important;
          position: sticky !important;
          top: 16px !important;
          margin-left: 16px !important;
          margin-top: 16px !important;
          margin-bottom: 16px !important;
          padding: 24px 20px 20px 20px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }
        @media (max-width: 1023px) {
          .sidebar {
            display: none !important;
          }
        }
      `}</style>

      {/* Desktop Floating Sidebar */}
      {!isHiringManagerChat && (
        <aside className="sidebar hidden lg:flex">
          {renderSidebarContent()}
        </aside>
      )}

      {/* Main Area */}
      <div className="main-area min-w-0 flex-1 flex flex-col">
        {!isAiChatPage && (
          <header className="topbar flex items-center justify-between mx-3 sm:mx-5 py-3.5 border-b border-[#E2E2DC] bg-transparent static min-w-0">
            <div className="topbar-breadcrumb flex items-center gap-2 text-[12.5px] sm:text-[13px] min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-1.5 text-black hover:bg-white rounded-xl cursor-pointer"
              >
                <Menu size={20} />
              </button>
              <span className="font-extrabold text-[#0A0A0A] tracking-tight truncate">
                {userRole === 'Super Admin' ? 'Platform' : (user?.tenant_name || 'Term Jobs')}
              </span>
              <span className="text-[#8A8A85] font-normal">/</span>
              <span className="text-[#0A0A0A] font-semibold truncate">
                {userRole === 'Super Admin' ? 'Super Admin Console' : 'Dashboard'}
              </span>
            </div>

            <div className="topbar-right flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsAssistantOpen((prev) => !prev)}
                className="w-8.5 h-8.5 rounded-full bg-white border border-[#E2E2DC] flex items-center justify-center text-black hover:bg-black hover:text-white transition-colors cursor-pointer shadow-2xs"
              >
                <Sparkles size={15} />
              </button>
              <span className="px-3 py-1 text-[11px] font-bold text-black bg-white border border-[#E2E2DC] rounded-full flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                SECURE SESSION
              </span>
              <button
                onClick={handleLogout}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E2DC] bg-white hover:bg-red-50 hover:text-red-600 text-gray-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Icons.Logout width={14} height={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>
        )}

        <main className="content-area pt-1.5 px-3 sm:px-5 pb-4 w-full max-w-none min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <AssistantWidget isOpen={isAssistantOpen} setIsOpen={setIsAssistantOpen} />
      {userRole === 'Super Admin' && (
        <>
          <OnboardVendorModal
            isOpen={isOnboardVendorModalOpen}
            onClose={() => setIsOnboardVendorModalOpen(false)}
            onSuccess={() => window.dispatchEvent(new CustomEvent('refresh-superadmin-data'))}
          />
          <OnboardCompanyModal
            isOpen={isOnboardCompanyModalOpen}
            onClose={() => setIsOnboardCompanyModalOpen(false)}
            onSuccess={() => window.dispatchEvent(new CustomEvent('refresh-superadmin-data'))}
          />
        </>
      )}
    </div>
  );
}
