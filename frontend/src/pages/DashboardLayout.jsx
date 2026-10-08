import React, { useState, useEffect, useRef } from 'react';
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
  Layers,
  BarChart3,
  LogOut,
  User,
  KeyRound,
  FileText,
  Clock,
  Shield,
  CreditCard,
  MoreHorizontal,
  Settings
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
  Admin: 'console-hiringmanager',
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
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    try {
      return localStorage.getItem('hm_sidebar_minimized') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hm_sidebar_minimized', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Dynamic live count badges for Hiring Manager
  const [hmCounts, setHmCounts] = useState({ requisitions: 0, candidates: 0, openIssues: 0, pendingTimesheets: 0, pendingExpenses: 0 });
  const hasFetchedHmCountsRef = useRef(false);

  useEffect(() => {
    if (user?.role === 'Hiring Manager' && token && !hasFetchedHmCountsRef.current) {
      hasFetchedHmCountsRef.current = true;
      // Defer badge polling by 2.5s so active page loads with maximum network bandwidth and zero delay
      const timer = setTimeout(() => {
        Promise.all([
          request('/api/requisitions', { token }).catch(() => []),
          request('/api/candidates/shortlisted', { token }).catch(() => []),
          request('/api/candidates?status=Accepted', { token }).catch(() => []),
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
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [user?.role, token]);

  // Global mobile sidebar drawer listener
  useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen((prev) => !prev);
    const handleOpen = () => setIsMobileMenuOpen(true);
    const handleClose = () => setIsMobileMenuOpen(false);
    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('open-mobile-sidebar', handleOpen);
    window.addEventListener('close-mobile-sidebar', handleClose);
    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('open-mobile-sidebar', handleOpen);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

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
  }, [user?.role, token]);

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
  }, [user?.role, token]);

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
  }, [user?.role, token]);

  // Load Super Admin sidebar counts only on the pages that display the corresponding
  // data. Fetching both large lists on every Super Admin route was competing with the
  // page's own API calls (notably the outreach dashboard).
  const [superAdminCandidateCount, setSuperAdminCandidateCount] = useState(0);
  const [superAdminSelectedCount, setSuperAdminSelectedCount] = useState(0);

  useEffect(() => {
    const isSuperAdmin = user?.role === 'Super Admin' || user?.role?.toLowerCase() === 'super admin';
    if (!isSuperAdmin || !token) return;

    const isCandidatePoolRoute = location.pathname.includes('/candidate-pool');
    const isCandidateManagementRoute = location.pathname.includes('/candidate-management');
    if (!isCandidatePoolRoute && !isCandidateManagementRoute) return;

    const timer = setTimeout(() => {
      if (isCandidatePoolRoute) {
        request('/api/superadmin/candidate-pool', { token })
          .then((res) => {
            setSuperAdminCandidateCount(res?.total_count || 0);
          })
          .catch(() => { });
      }

      if (isCandidateManagementRoute) {
        request('/api/superadmin/candidate-management', { token })
          .then((res) => {
            setSuperAdminSelectedCount(res?.total_count || 0);
          })
          .catch(() => { });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [user?.role, token, location.pathname]);

  // Listen to refresh-superadmin-data to refresh Super Admin sidebar badges dynamically
  useEffect(() => {
    const handleRefreshSuperAdminBadges = () => {
      const isSuperAdmin = user?.role === 'Super Admin' || user?.role?.toLowerCase() === 'super admin';
      const isCandidatePoolRoute = location.pathname.includes('/candidate-pool');
      const isCandidateManagementRoute = location.pathname.includes('/candidate-management');
      if (isSuperAdmin && token && isCandidatePoolRoute) {
        request('/api/superadmin/candidate-pool', { token, forceRefresh: true })
          .then((res) => setSuperAdminCandidateCount(res?.total_count || 0))
          .catch(() => { });
      }
      if (isSuperAdmin && token && isCandidateManagementRoute) {
        request('/api/superadmin/candidate-management', { token, forceRefresh: true })
          .then((res) => setSuperAdminSelectedCount(res?.total_count || 0))
          .catch(() => { });
      }
    };
    window.addEventListener('refresh-superadmin-data', handleRefreshSuperAdminBadges);
    return () => window.removeEventListener('refresh-superadmin-data', handleRefreshSuperAdminBadges);
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
  const isHiringManager = userRole === 'Hiring Manager' || userRole.toLowerCase() === 'hiring manager' || userRole === 'HR';
  const isSuperAdminChat = location.pathname === '/dashboard/superadmin/chat' || location.pathname.endsWith('/superadmin/chat');
  const isHiringManagerChat = location.pathname === '/dashboard/hiring-manager/chat' || location.pathname.endsWith('/hiring-manager/chat');
  const isAdminChat = location.pathname === '/dashboard/admin/chat' || location.pathname.endsWith('/admin/chat');
  const isAiChatPage = isSuperAdminChat || isHiringManagerChat || isAdminChat;

  // ==========================================
  // COMPANY ADMIN DEDICATED LAYOUT (TOP BAR + FULL CANVAS)
  // ==========================================
  if (isCompanyAdmin) {
    const companyName = user?.tenant_name || 'TCS';
    const adminNavLinks = [
      { to: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/dashboard/admin/hiring-managers', label: 'Hiring', icon: Users, end: false },
      { to: '/dashboard/admin/directors', label: 'Directors', icon: UserCheck, end: false },
      { to: '/dashboard/admin/procurement', label: 'Procurement', icon: Building2, end: false },
      { to: '/dashboard/admin/finance', label: 'Finance', icon: CreditCard, end: false },
      { to: '/dashboard/admin/profile', label: 'Profile', icon: User, end: false },
    ];

    return (
      <div className={`w-full bg-paper text-ink flex flex-col antialiased relative selection:bg-black selection:text-white font-sans ${isAiChatPage ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'}`}>
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
              <div className="w-9 h-9 rounded-xl bg-black text-white font-black text-sm flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform overflow-hidden p-1">
                {user?.logo_url ? (
                  <img src={user.logo_url} alt={companyName} className="w-full h-full object-contain" />
                ) : (
                  companyName.charAt(0).toUpperCase()
                )}
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

            {/* User Profile Pill (Profile Icon Button, smoothly expands on active/open) */}
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
                <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shadow-2xs shrink-0">
                  <User size={13} className="text-white" />
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
                    <div className="px-4 py-2 border-b border-gray-100/80 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <User size={15} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{user?.name || 'Arjun M'}</div>
                        <div className="text-[11px] text-gray-400 truncate">{user?.email || 'admin@tcs.com'}</div>
                      </div>
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
                  <div className="w-8 h-8 rounded-xl bg-black text-white font-bold text-xs flex items-center justify-center overflow-hidden p-1">
                    {user?.logo_url ? (
                      <img src={user.logo_url} alt={companyName} className="w-full h-full object-contain" />
                    ) : (
                      companyName.charAt(0).toUpperCase()
                    )}
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
                {adminNavLinks.map((link) => {
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
        <main className={`flex-1 w-full min-h-0 ${isAiChatPage ? 'h-[calc(100vh-62px)] max-h-[calc(100vh-62px)] px-3 sm:px-6 pt-1 pb-3 max-w-[1760px]' : 'max-w-[1580px] px-4 sm:px-8 pt-4 sm:pt-6 pb-4 justify-start'} mx-auto z-10 flex flex-col overflow-hidden`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ height: '100%' }}
              className="w-full h-full flex-1 flex flex-col min-h-0"
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
    isCompanyAdmin
      ? [
        { to: '/dashboard/admin', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: LayoutDashboard },
        { to: '/dashboard/admin/chat', label: 'AI Chat', end: true, section: 'WORKSPACE', icon: Sparkles },
        { to: '/dashboard/admin/hiring-managers', label: 'Hiring', end: false, section: 'MANAGEMENT', icon: Users },
        { to: '/dashboard/admin/directors', label: 'Directors', end: false, section: 'MANAGEMENT', icon: UserCheck },
        { to: '/dashboard/admin/procurement', label: 'Procurement', end: false, section: 'GOVERNANCE', icon: Building2 },
        { to: '/dashboard/admin/finance', label: 'Finance', end: false, section: 'GOVERNANCE', icon: CreditCard },
        { to: '/dashboard/admin/profile', label: 'Profile', end: false, section: 'ACCOUNT', icon: User },
      ]
      : userRole === 'Hiring Manager'
      ? [
        { to: '/dashboard/hiring-manager', label: 'AI Chat', end: true, section: 'WORKSPACE', icon: Icons.Chat },
        { to: '/dashboard/hiring-manager/chat', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: Icons.Dashboard },
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

  const renderSidebarContent = (onLinkClick) => {
    const isMinimized = (userRole === 'Hiring Manager' || isCompanyAdmin) && isSidebarMinimized;

    if (isMinimized) {
      return (
        <div className="flex flex-col h-full min-h-0 select-none items-center relative overflow-visible w-full">
          {/* Brand Header */}
          <div className="sidebar-brand shrink-0 pb-2.5 border-b border-white/10 mb-2 flex flex-col items-center relative w-full">
            <div className="relative group/brand flex items-center justify-center">
              <div
                onClick={toggleSidebar}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
                className="flex items-center justify-center font-extrabold text-[14px] shrink-0 shadow-xs uppercase cursor-pointer hover:border-white/50 hover:scale-105 transition-all overflow-hidden p-0.5"
                title="Click to expand sidebar"
              >
                {user?.logo_url ? (
                  <img src={user.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  (user?.tenant_name || 'Term Jobs').trim().charAt(0)
                )}
              </div>
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0A0A0A] text-white text-[11.5px] font-semibold rounded-lg shadow-xl border border-white/10 pointer-events-none whitespace-nowrap opacity-0 group-hover/brand:opacity-100 transition-opacity duration-150 z-50">
                Expand sidebar
              </div>
            </div>
          </div>

          {/* Navigation list in Minimized mode - Clean, streamlined, no dividers */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible custom-scrollbar py-1 flex flex-col items-center w-full">
            <nav className="flex flex-col items-center gap-1.5 pb-2 w-full">
              {navItems.map((item) => {
                const IconComp = item.icon;
                const isItemActive = item.to === '/dashboard/requisitions'
                  ? location.pathname.startsWith('/dashboard/requisitions') && location.pathname !== '/dashboard/requisitions/new'
                  : item.end
                    ? location.pathname === item.to
                    : item.to ? location.pathname.startsWith(item.to) : false;

                return (
                  <div key={item.label} className="relative group/item flex items-center justify-center w-full">
                    {item.action ? (
                      <button
                        type="button"
                        onClick={() => {
                          item.action();
                          if (onLinkClick) onLinkClick();
                        }}
                        className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        title={item.label}
                      >
                        {IconComp && <IconComp size={15} />}
                      </button>
                    ) : (
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onLinkClick}
                        title={item.label}
                        className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all relative ${
                          isItemActive
                            ? 'bg-white text-black shadow-xs'
                            : 'text-[#94A3B8] hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {IconComp && <IconComp size={15} className={isItemActive ? 'text-black' : ''} />}
                        {item.badge > 0 && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-[#0c0f17]" />
                        )}
                      </NavLink>
                    )}

                    {/* Sleek Dark Tooltip matching Image 2 */}
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0A0A0A] text-white text-[11.5px] font-semibold rounded-lg shadow-xl border border-white/10 pointer-events-none whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 z-50 flex items-center gap-1.5">
                      <span>{item.label}</span>
                      {item.count !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[9.5px] text-gray-200 font-mono">
                          {item.count}
                        </span>
                      )}
                      {item.badge > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-[9.5px] text-white font-mono">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer in Minimized mode - Cleanly separated, never overlapping */}
          <div className="sidebar-footer shrink-0 pt-2.5 mt-auto border-t border-white/10 flex flex-col items-center gap-1.5 w-full bg-transparent z-10">
            <div className="relative group/user flex items-center justify-center">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
                className="flex items-center justify-center font-bold text-[12px] shrink-0 shadow-2xs overflow-hidden p-0.5 uppercase cursor-pointer"
              >
                {user?.logo_url ? (
                  <img src={user.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  initials(user?.name)
                )}
              </div>
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0A0A0A] text-white text-[11.5px] font-semibold rounded-lg shadow-xl border border-white/10 pointer-events-none whitespace-nowrap opacity-0 group-hover/user:opacity-100 transition-opacity duration-150 z-50">
                <div className="font-bold">{user?.name || userRole}</div>
                <div className="text-[10px] text-gray-400 font-normal">{userRole}</div>
              </div>
            </div>

            <div className="relative group/logout flex items-center justify-center">
              <button
                onClick={handleLogout}
                type="button"
                title="Sign out"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Icons.Logout width={15} height={15} />
              </button>
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#0A0A0A] text-white text-[11.5px] font-semibold rounded-lg shadow-xl border border-white/10 pointer-events-none whitespace-nowrap opacity-0 group-hover/logout:opacity-100 transition-opacity duration-150 z-50">
                Sign out
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
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
          ) : (userRole === 'Hiring Manager' || isCompanyAdmin) ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                  className="flex items-center justify-center font-extrabold text-[16px] shrink-0 shadow-xs uppercase overflow-hidden p-1"
                >
                  {user?.logo_url ? (
                    <img src={user.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    (user?.tenant_name || 'Term Jobs').trim().charAt(0)
                  )}
                </div>
                <div className="leading-tight text-left min-w-0">
                  <div className="text-[15.5px] font-extrabold text-white tracking-tight truncate">{user?.tenant_name || 'Term Jobs'}</div>
                  <div className="text-[11.5px] text-[#94A3B8] font-medium mt-0.5 truncate">{isCompanyAdmin ? 'Admin Console' : 'Hiring Manager'}</div>
                </div>
              </div>
              {/* Minimize toggle button matching Image 2 left side */}
              <button
                type="button"
                onClick={toggleSidebar}
                title="Minimize sidebar"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs group"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-95 transition-transform">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <path d="m15 10-2 2 2 2" />
                </svg>
              </button>
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
                backgroundColor: '#000000',
                color: '#FFFFFF',
                border: (userRole === 'Hiring Manager' || isCompanyAdmin) ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
              }}
              className="flex items-center justify-center font-bold text-[14px] shrink-0 shadow-2xs overflow-hidden p-1 uppercase"
            >
              {user?.logo_url ? (
                <img src={user.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                initials(user?.name)
              )}
            </div>
            <div className="leading-tight min-w-0 text-left">
              <div className={`text-[13.5px] font-extrabold tracking-tight truncate ${(userRole === 'Hiring Manager' || isCompanyAdmin) ? 'text-white' : 'text-[#0A0A0A]'}`}>
                {user?.name || userRole}
              </div>
              <div className={`text-[11px] font-medium mt-0.5 truncate ${(userRole === 'Hiring Manager' || isCompanyAdmin) ? 'text-[#94A3B8]' : 'text-[#8A8A85]'}`}>
                {isCompanyAdmin ? 'Admin' : userRole}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            title="Sign out"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              (userRole === 'Hiring Manager' || isCompanyAdmin)
                ? 'text-[#94A3B8] hover:text-[#DC2626] hover:bg-white/5'
                : 'text-[#8A8A85] hover:text-[#DC2626] hover:bg-[#FEE2E2]'
            }`}
          >
            <Icons.Logout />
          </button>
        </div>
      </div>
    </div>
  );
};

  const isHiringManagerDashboard = location.pathname === '/dashboard/hiring-manager' || location.pathname === '/dashboard/hiring-manager/';
  const isFixedMode = isHiringManagerDashboard || isAiChatPage;

  return (
    <div className={`app-shell ${consoleClass} ${isAiChatPage ? 'ai-chat-mode' : ''} ${isFixedMode ? 'ai-fixed-mode h-screen max-h-screen overflow-hidden' : ''}`}>
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
        /* Hiring Manager Dark Sidebar & Clean Proportional Layout */
        .console-hiringmanager.app-shell {
          background-color: transparent !important;
          width: 100% !important;
          max-width: 100vw !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
          position: relative !important;
        }
        .console-hiringmanager .sidebar {
          width: 240px !important;
          min-width: 240px !important;
          max-width: 240px !important;
          background: 
            radial-gradient(130% 90% at 15% 5%, rgba(30, 41, 59, 0.85) 0%, transparent 60%),
            radial-gradient(110% 80% at 90% 95%, rgba(15, 23, 42, 0.95) 0%, transparent 65%),
            radial-gradient(circle at 45% 20%, rgba(56, 189, 248, 0.08), transparent 50%),
            linear-gradient(175deg, #131722 0%, #0c0f17 40%, #06080d 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 
            0 20px 50px -10px rgba(0, 0, 0, 0.65),
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.22),
            inset 0 0 24px rgba(255, 255, 255, 0.02) !important;
          position: sticky !important;
          top: 14px !important;
          margin: 14px 0 14px 14px !important;
          overflow: visible !important;
          padding: 16px 12px 14px 12px !important;
          height: calc(100vh - 28px) !important;
          border-radius: 24px !important;
          transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1), padding 0.2s ease !important;
        }
        .console-hiringmanager .sidebar.minimized {
          width: 68px !important;
          min-width: 68px !important;
          max-width: 68px !important;
          padding: 14px 6px 12px 6px !important;
          align-items: center !important;
        }
        .console-hiringmanager .sidebar.minimized *::-webkit-scrollbar {
          display: none !important;
        }
        .console-hiringmanager .sidebar.minimized * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .console-hiringmanager .sidebar.minimized::after {
          display: none !important;
        }
        .console-hiringmanager .sidebar::before {
          content: '' !important;
          position: absolute !important;
          inset: 0 !important;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px) !important;
          background-size: 32px 32px !important;
          pointer-events: none !important;
          opacity: 0.6 !important;
          border-radius: 24px !important;
          mask-image: radial-gradient(ellipse 90% 70% at 50% 25%, black 40%, transparent 100%) !important;
          -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 25%, black 40%, transparent 100%) !important;
          z-index: 0 !important;
        }
        .console-hiringmanager .sidebar::after {
          content: '' !important;
          position: absolute !important;
          top: -40px !important;
          left: -30px !important;
          width: 160px !important;
          height: 160px !important;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%) !important;
          filter: blur(24px) !important;
          pointer-events: none !important;
          z-index: 0 !important;
        }
        .console-hiringmanager .sidebar > * {
          position: relative !important;
          z-index: 1 !important;
        }
        .console-hiringmanager .sidebar .custom-scrollbar {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .console-hiringmanager .sidebar .custom-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .console-hiringmanager .sidebar-brand {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding-bottom: 12px !important;
          margin-bottom: 6px !important;
        }
        .console-hiringmanager .sidebar-nav-btn {
          color: #94A3B8 !important;
          padding: 7px 11px !important;
          font-size: 12.5px !important;
          border-radius: 10px !important;
        }
        .console-hiringmanager .sidebar-nav-btn:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #FFFFFF !important;
        }
        .console-hiringmanager .active-nav-tab {
          background-color: #FFFFFF !important;
          color: #0A0A0A !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3) !important;
          padding: 8px 12px !important;
          font-size: 12.5px !important;
          border-radius: 12px !important;
        }
        .console-hiringmanager .active-nav-tab * {
          color: #0A0A0A !important;
        }
        .console-hiringmanager .sidebar-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding-top: 10px !important;
          margin-top: auto !important;
        }
        .console-hiringmanager .sidebar .text-\[\#8A8A85\] {
          color: #64748B !important;
        }
        .console-hiringmanager .sidebar .text-\[\#0A0A0A\] {
          color: #FFFFFF !important;
        }
        .app-shell.ai-fixed-mode {
          height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
        }
        .app-shell.ai-fixed-mode .main-area {
          height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
        }
        .app-shell.ai-fixed-mode .content-area {
          height: calc(100vh - 28px) !important;
          max-height: calc(100vh - 28px) !important;
          min-height: calc(100vh - 28px) !important;
          width: calc(100% - 28px) !important;
          max-width: calc(100% - 28px) !important;
          margin: 14px 14px 14px 14px !important;
          padding: 0 !important;
          overflow: hidden !important;
          flex: none !important;
          box-sizing: border-box !important;
        }
        @media (max-width: 1023px) {
          .sidebar {
            display: none !important;
          }
          .app-shell.ai-fixed-mode {
            height: 100dvh !important;
            max-height: 100dvh !important;
          }
          .app-shell.ai-fixed-mode .content-area {
            height: calc(100dvh - 16px) !important;
            max-height: calc(100dvh - 16px) !important;
            width: calc(100% - 16px) !important;
            max-width: calc(100% - 16px) !important;
            margin: 8px !important;
          }
        }
      `}</style>

      {/* Landing Page Background System for Hiring Manager & Company Admin */}
      {(userRole === 'Hiring Manager' || isCompanyAdmin) && <Backdrop tone="light" fixed />}

      {/* Desktop Floating Sidebar */}
      {!isHiringManagerChat && (
        <aside className={`sidebar hidden lg:flex ${isSidebarMinimized && (userRole === 'Hiring Manager' || isCompanyAdmin) ? 'minimized' : ''}`}>
          {renderSidebarContent()}
        </aside>
      )}

      {/* Main Area */}
      <div className={`main-area min-w-0 flex-1 flex flex-col relative z-10 ${isFixedMode ? 'h-screen max-h-screen overflow-hidden' : ''}`}>
        {!isAiChatPage && !isCompanyAdmin && !isHiringManager && (
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
                {userRole === 'Super Admin' ? 'Super Admin Console' : isCompanyAdmin ? 'Admin Console' : 'Dashboard'}
              </span>
            </div>

            <div className="topbar-right flex items-center gap-2.5">
              <NotificationBell />
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

        {/* Mobile hamburger header for Company Admin & Hiring Manager on small devices */}
        {(isCompanyAdmin || isHiringManager) && !location.pathname.endsWith('/hiring-manager') && (
          <div className="lg:hidden flex items-center justify-between mx-3 py-2 border-b border-black/[0.06] bg-transparent shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 text-black hover:bg-white rounded-xl cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="text-xs font-bold text-gray-900">
              {user?.tenant_name || 'TCS'} {isCompanyAdmin ? 'Admin' : 'Hiring'}
            </div>
            <NotificationBell />
          </div>
        )}

        <main className={`content-area ${isFixedMode ? 'p-0 h-full max-h-full overflow-hidden' : `${(isCompanyAdmin || isHiringManager) ? 'pt-6 sm:pt-8 lg:pt-9' : 'pt-1.5'} px-3 sm:px-6 pb-6 w-full max-w-none min-w-0 flex-1`}`}>
          <Outlet />
        </main>
      </div>

      {/* Global Mobile Drawer for Hiring Manager, Recruiter, etc. */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-[#0c0f17] text-white p-4 flex flex-col z-60 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Navigation</span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {renderSidebarContent(() => setIsMobileMenuOpen(false))}
            </div>
          </div>
        </div>
      )}

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
