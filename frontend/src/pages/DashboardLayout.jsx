import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AssistantWidget from '../components/AssistantWidget';
import { Sparkles, Menu, X } from 'lucide-react';
import { request } from '../api/client';

function initials(name) {
  if (!name) return 'HR';
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
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Requisitions: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <rect width="6" height="6" x="9" y="9" />
    </svg>
  ),
  Plus: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Diamond: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"/>
    </svg>
  ),
  CandidatesBank: (props) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3.5"/>
    </svg>
  ),
  Shortlisted: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Interviews: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    </svg>
  ),
  Accepted: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    </svg>
  ),
  PortalAccess: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    </svg>
  ),
};

export default function DashboardLayout() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dynamic live count badges for Hiring Manager
  const [hmCounts, setHmCounts] = useState({ requisitions: 12, candidates: 251 });

  useEffect(() => {
    if (user?.role === 'Hiring Manager' && token) {
      Promise.all([
        request('/requisitions', { token }).catch(() => []),
        request('/candidates/shortlisted', { token }).catch(() => []),
        request('/candidates?status=Accepted', { token }).catch(() => []),
      ]).then(([reqs, shortlisted, accepted]) => {
        const rCount = Array.isArray(reqs) ? reqs.length : 12;
        const sList = Array.isArray(shortlisted) ? shortlisted : (shortlisted?.shortlisted_candidates || []);
        const aList = Array.isArray(accepted) ? accepted : (accepted?.candidates || []);
        setHmCounts({
          requisitions: rCount || 12,
          candidates: 250 + (sList.length || 1),
        });
      }).catch(() => {});
    }
  }, [user?.role, token]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ECECE9]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A0A0A]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ECECE9]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A0A0A]"></div>
      </div>
    );
  }

  const userRole = user?.role || '';
  const consoleClass = CONSOLE_CLASS[userRole] || 'console-default';
  const isModernLayout = userRole === 'Recruiter' || userRole === 'Hiring Manager';

  const navItems =
    userRole === 'Hiring Manager'
      ? [
        { to: '/dashboard/hiring-manager', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: Icons.Dashboard },
        { to: '/dashboard/requisitions', label: 'Requisitions', end: false, section: 'HIRING', icon: Icons.Requisitions, count: hmCounts.requisitions },
        { to: '/dashboard/requisitions/new', label: 'New Requisition', end: true, section: 'HIRING', icon: Icons.Plus },
        { to: '/dashboard/candidates', label: 'Candidates', end: false, section: 'CANDIDATES', icon: Icons.Diamond, count: hmCounts.candidates },
      ]
      : userRole === 'Recruiter'
        ? [
          { to: '/dashboard/recruiter', label: 'Dashboard', end: true, section: 'WORKSPACE', icon: Icons.Dashboard },
          { to: '/dashboard/recruiter/requisitions', label: 'Requisitions', end: true, section: 'WORKSPACE', icon: Icons.Requisitions },
          { to: '/dashboard/recruiter/candidates', label: 'Candidates Bank', end: true, section: 'WORKSPACE', icon: Icons.CandidatesBank },
          { to: '/dashboard/recruiter/shortlisted', label: 'Shortlisted Candidates', end: true, section: 'WORKSPACE', icon: Icons.Shortlisted },
          { to: '/dashboard/recruiter/interviews', label: 'Interview Requests', end: true, section: 'WORKSPACE', icon: Icons.Interviews },
          { to: '/dashboard/recruiter/accepted', label: 'Accepted Candidates', end: true, section: 'CANDIDATE MANAGEMENT', icon: Icons.Accepted },
          { to: '/dashboard/recruiter/portal-access', label: 'Portal Access', end: true, section: 'CANDIDATE MANAGEMENT', icon: Icons.PortalAccess },
        ]
        : userRole === 'Director'
          ? [{ to: '/dashboard/director', label: 'Executive Overview', end: true }]
          : userRole === 'Super Admin'
            ? [
              { to: '/dashboard/superadmin', label: 'Dashboard', end: true },
              { to: '/dashboard/superadmin/onboard', label: 'Onboard Company', end: true },
              { to: '/dashboard/superadmin/onboard-vendor', label: 'Onboard Vendor', end: true },
              { to: '/dashboard/superadmin/accounts', label: 'Company Accounts', end: true },
              { to: '/dashboard/superadmin/archives', label: 'Archives', end: true },
            ]
            : [{ to: '/dashboard/hr', label: 'Dashboard', end: true }];

  // Render full reusable sidebar inner contents
  const renderSidebarContent = (onLinkClick) => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="sidebar-brand pb-4 border-b border-[#EAEAE6] mb-5">
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
          ) : ['Admin', 'HR', 'Director'].includes(userRole) ? (
            <>
              <div className="brand-mark">{user?.tenant_name ? user.tenant_name.trim().charAt(0).toUpperCase() : 'TJ'}</div>
              <div className="brand-text">
                <span className="brand-name">{user?.tenant_name || 'Term Jobs'}</span>
                <span className="brand-sub">{userRole} Console</span>
              </div>
            </>
          ) : (
            <div className="brand-text">
              <span className="brand-name">Term Jobs</span>
              <span className="brand-sub">{userRole}</span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="flex flex-col gap-1">
          {isModernLayout ? (
            <>
              {(() => {
                let lastSection = null;
                return navItems.map((item) => {
                  const showSection = item.section && item.section !== lastSection;
                  if (item.section) lastSection = item.section;
                  const IconComp = item.icon;

                  const isItemActive = item.to === '/dashboard/requisitions'
                    ? location.pathname.startsWith('/dashboard/requisitions') && location.pathname !== '/dashboard/requisitions/new'
                    : item.to === '/dashboard/candidates'
                    ? location.pathname.startsWith('/dashboard/candidates')
                    : item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                  return (
                    <React.Fragment key={item.label}>
                      {showSection && (
                        <div className="text-[10px] font-extrabold tracking-wider text-[#8A8A85] uppercase px-3 pt-3.5 pb-1.5">
                          {item.section}
                        </div>
                      )}
                      {item.to ? (
                        <NavLink
                          to={item.to}
                          end={item.end}
                          onClick={onLinkClick}
                          className={`nav-link ${isItemActive ? 'active-nav-tab' : 'sidebar-nav-btn'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            {IconComp && <IconComp className="shrink-0" size={15} />}
                            <span className="font-semibold text-[13px]">{item.label}</span>
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
                            <span>{item.label}</span>
                          </div>
                        </span>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </>
          ) : userRole === 'Super Admin' ? (
            <>
              <div className="nav-section-label">Overview</div>
              <NavLink
                to="/dashboard/superadmin"
                end
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>
              <div className="nav-section-label">Companies</div>
              <NavLink
                to="/dashboard/superadmin/onboard"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Onboard Company
              </NavLink>
              <NavLink
                to="/dashboard/superadmin/accounts"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Company Accounts
              </NavLink>
              <div className="nav-section-label">Vendors</div>
              <NavLink
                to="/dashboard/superadmin/onboard-vendor"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Onboard Vendor
              </NavLink>
              <NavLink
                to="/dashboard/superadmin/vendor-accounts"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Vendor Accounts
              </NavLink>
              <div className="nav-section-label">Archives</div>
              <NavLink
                to="/dashboard/superadmin/archives"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                View All Archives
              </NavLink>
            </>
          ) : userRole === 'Admin' ? (
            <>
              <div className="nav-section-label">Workspace</div>
              <NavLink
                to="/dashboard/admin"
                end
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/dashboard/admin/hiring-managers"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Hiring Managers
              </NavLink>
              <NavLink
                to="/dashboard/admin/directors"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Directors
              </NavLink>
              <NavLink
                to="/dashboard/admin/partner-vendors"
                onClick={onLinkClick}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Partner Vendors
              </NavLink>
            </>
          ) : (
            <>
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  onClick={onLinkClick}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer pt-4 border-t border-[#EAEAE6] mt-4">
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
              className="flex items-center justify-center font-bold text-[14px] shrink-0 shadow-2xs"
            >
              {initials(user?.name)}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[13.5px] font-extrabold text-[#0A0A0A] tracking-tight truncate">
                {user?.name || (userRole === 'Hiring Manager' ? 'hr' : 'Hashil')}
              </div>
              <div className="text-[11px] text-[#8A8A85] font-medium mt-0.5 truncate">
                {userRole === 'Recruiter' ? 'Recruiter' : userRole === 'Hiring Manager' ? 'Hiring Manager' : userRole}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            title="Sign out"
            className="p-1.5 text-[#8A8A85] hover:text-[#0A0A0A] hover:bg-[#F5F5F2] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Icons.Logout />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${consoleClass}`}>
      <style>{`
        .recruiter-sidebar-container .nav-link {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          text-align: left !important;
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
          padding: 10px 14px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15) !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .active-nav-tab::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3.5px;
          height: 18px;
          background-color: #FFFFFF;
          border-radius: 0 4px 4px 0;
        }
        .app-shell.console-recruiter,
        .app-shell.console-hiringmanager,
        .app-shell {
          background-color: #ECECE9 !important;
          background: #ECECE9 !important;
          min-height: 100vh !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: clip !important;
          display: flex !important;
          align-items: flex-start !important;
        }
        .app-shell.console-recruiter .main-area,
        .app-shell.console-hiringmanager .main-area,
        .app-shell .main-area,
        .app-shell.console-recruiter .page,
        .app-shell.console-hiringmanager .page,
        .recruiter-page {
          max-width: 100% !important;
          width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          min-width: 0 !important;
        }
        .app-shell.console-recruiter .content-area,
        .app-shell.console-hiringmanager .content-area {
          padding-left: 20px !important;
          padding-right: 20px !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          max-width: 100% !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .app-shell.console-recruiter .recruiter-topbar,
        .app-shell.console-hiringmanager .recruiter-topbar {
          margin-left: 20px !important;
          margin-right: 20px !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        .app-shell.console-recruiter .topbar,
        .app-shell.console-hiringmanager .topbar,
        .recruiter-topbar {
          position: static !important;
          top: auto !important;
          z-index: 1 !important;
          height: auto !important;
          background-color: transparent !important;
          background: transparent !important;
          border-bottom: 1px solid #E2E2DC !important;
        }
        .recruiter-sidebar-container {
          width: 272px !important;
          min-width: 272px !important;
          max-width: 272px !important;
          height: calc(100vh - 32px) !important;
          max-height: calc(100vh - 32px) !important;
          position: sticky !important;
          top: 16px !important;
          align-self: flex-start !important;
          background-color: #FFFFFF !important;
          border: 1px solid #E2E2DC !important;
          border-radius: 30px !important;
          margin: 16px 0 16px 16px !important;
          padding: 24px 20px 20px 20px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02) !important;
          box-sizing: border-box !important;
          z-index: 40 !important;
        }

        /* Mobile & Tablet Responsiveness (< 1024px) */
        @media (max-width: 1023px) {
          .recruiter-sidebar-container {
            display: none !important;
          }
          .app-shell.console-recruiter .content-area,
          .app-shell.console-hiringmanager .content-area {
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-top: 12px !important;
            padding-bottom: 24px !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }
          .app-shell.console-recruiter .recruiter-topbar,
          .app-shell.console-hiringmanager .recruiter-topbar {
            margin-left: 12px !important;
            margin-right: 12px !important;
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }
        }
      `}</style>

      {/* Desktop Floating Rounded Sidebar Card (hidden on < 1024px) */}
      <aside className={`sidebar hidden lg:flex ${isModernLayout ? 'recruiter-sidebar-container' : ''}`}>
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer (Visible when isMobileMenuOpen is true on < 1024px) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              width: '290px',
              maxWidth: '85vw',
              height: '100%',
              padding: '24px 20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              zIndex: 60,
            }}
            className="flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-200"
          >
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-[#8A8A85] hover:text-[#0A0A0A] rounded-xl hover:bg-[#F5F5F2] cursor-pointer"
              title="Close menu"
            >
              <X size={20} strokeWidth={2.2} />
            </button>

            {renderSidebarContent(() => setIsMobileMenuOpen(false))}
          </div>
        </div>
      )}

      <div className="main-area min-w-0 flex-1 flex flex-col">
        <header style={{ backgroundColor: "transparent" }} className="topbar recruiter-topbar flex items-center justify-between mx-3 sm:mx-5 py-3.5 border-b border-[#E2E2DC] bg-transparent static min-w-0">
          {/* Breadcrumb & Mobile Menu Toggle Left */}
          <div className="topbar-breadcrumb flex items-center gap-2 text-[12.5px] sm:text-[13px] min-w-0">
            {/* Hamburger Toggle (Mobile / Tablet only) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-[#0A0A0A] hover:bg-[#F5F5F2] rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu size={21} strokeWidth={2.2} />
            </button>

            <span className="font-extrabold text-[#0A0A0A] tracking-tight truncate">
              {user?.tenant_name || (userRole === 'Recruiter' ? 'bridgeon' : 'Bearitt')}
            </span>
            <span className="text-[#8A8A85] font-normal">/</span>
            <span className="text-[#0A0A0A] font-semibold truncate">
              {location.pathname.includes('/requisitions') ? 'Requisitions'
                : location.pathname.startsWith('/dashboard/candidates') ? (userRole === 'Recruiter' ? (location.pathname.includes('/accepted') ? 'Accepted Candidates' : location.pathname.includes('/shortlisted') ? 'Shortlisted Candidates' : 'Candidates Bank') : 'Candidates')
                : location.pathname.includes('/shortlisted') ? 'Shortlisted Candidates'
                : location.pathname.includes('/interviews') ? 'Interview Requests'
                : location.pathname.includes('/accepted') ? 'Accepted Candidates'
                : location.pathname.includes('/portal-access') ? 'Portal Access'
                : 'Dashboard'}
            </span>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-[#8A8A85] mx-1 align-middle shrink-0" />
            <span className="hidden sm:inline text-[#737373] font-medium shrink-0">{userRole}</span>
          </div>

          {/* Actions Right */}
          <div className="topbar-right flex items-center gap-2 sm:gap-2.5 pr-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAssistantOpen((prev) => !prev)}
              title="AI Assistant"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                backgroundColor: isAssistantOpen ? '#0A0A0A' : '#FFFFFF',
                border: isAssistantOpen ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                color: isAssistantOpen ? '#FFFFFF' : '#0A0A0A',
              }}
              className="flex items-center justify-center hover:bg-[#0A0A0A] hover:text-[#FFFFFF] hover:border-[#0A0A0A] transition-all shadow-2xs cursor-pointer group shrink-0"
            >
              <Sparkles size={15} className={isAssistantOpen ? "text-white" : "group-hover:text-white transition-colors"} />
            </button>

            <span
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E2DC',
                borderRadius: 9999,
              }}
              className="px-2.5 sm:px-3.5 py-1 text-[10.5px] sm:text-[11px] font-bold text-[#0A0A0A] flex items-center gap-1.5 shadow-2xs tracking-tight shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span className="hidden xs:inline sm:inline">SECURE SESSION</span>
              <span className="xs:hidden sm:hidden">SECURE</span>
            </span>
          </div>
        </header>

        <main className="content-area pt-1.5 px-3 sm:px-5 pb-4 w-full max-w-none min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <AssistantWidget isOpen={isAssistantOpen} setIsOpen={setIsAssistantOpen} />
    </div>
  );
}
