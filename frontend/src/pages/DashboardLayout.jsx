import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AssistantWidget from '../components/AssistantWidget';

function initials(name) {
  if (!name) return 'TJ';
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

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const consoleClass = CONSOLE_CLASS[user.role] || 'console-default';
  const highlightRole = user.role === 'Super Admin';
  const highlightOrg = ['Admin', 'Hiring Manager', 'HR', 'Director'].includes(user.role);

  const navItems =
    user.role === 'Hiring Manager'
      ? [
        { to: '/dashboard/requisitions', label: 'Requisitions', end: false },
        { to: '/dashboard/requisitions/new', label: 'New Requisition', end: true },
        { to: '/dashboard/candidates', label: 'Shortlisted Candidates', end: false },
      ]
      : user.role === 'Recruiter'
        ? [
          { to: '/dashboard/recruiter', label: 'Dashboard', end: true, section: 'Workspace' },
          { to: '/dashboard/recruiter/requisitions', label: 'Requisitions', end: true, section: 'Workspace' },
          { to: '/dashboard/recruiter/candidates', label: 'Candidates Bank', end: true, section: 'Workspace' },
          { to: '/dashboard/recruiter/shortlisted', label: 'Shortlisted Candidates', end: true, section: 'Workspace' },
          { to: '/dashboard/recruiter/interviews', label: 'Interview Requests', end: true, section: 'Workspace' },
          { to: '/dashboard/recruiter/accepted', label: 'Accepted Candidates', end: true, section: 'Candidate Management' },
          { to: '/dashboard/recruiter/portal-access', label: 'Portal Access', end: true, section: 'Candidate Management' },
        ]
        : user.role === 'Director'
          ? [{ to: '/dashboard/director', label: 'Executive Overview', end: true }]
          : user.role === 'Super Admin'
            ? [
              { to: '/dashboard/superadmin', label: 'Dashboard', end: true },
              { to: '/dashboard/superadmin/onboard', label: 'Onboard Company', end: true },
              { to: '/dashboard/superadmin/onboard-vendor', label: 'Onboard Vendor', end: true },
              { to: '/dashboard/superadmin/accounts', label: 'Company Accounts', end: true },
              { to: '/dashboard/superadmin/archives', label: 'Archives', end: true },
            ]
            : [{ to: '/dashboard/hr', label: 'Dashboard', end: true }];

  return (
    <div className={`app-shell ${consoleClass}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          {['Admin', 'Hiring Manager', 'HR', 'Director'].includes(user.role) ? (
            <>
              <div className="brand-mark">{user.tenant_name ? user.tenant_name.trim().charAt(0).toUpperCase() : 'TJ'}</div>
              <div className="brand-text">
                <span className="brand-name">{user.tenant_name || 'Term Jobs'}</span>
                <span className="brand-sub">{user.role}</span>
              </div>
            </>
          ) : (
            <>
              <div className="brand-mark">TJ</div>
              <div className="brand-text">
                <span className="brand-name">Term Jobs</span>
                <span className="brand-sub">Workforce Platform</span>
              </div>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          {user.role === 'Hiring Manager' ? (
            <>
              <div className="nav-section-label">Requisitions</div>
              <NavLink
                to="/dashboard/requisitions/drafted"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Drafted
              </NavLink>
              <NavLink
                to="/dashboard/requisitions/published"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Published
              </NavLink>
              <NavLink
                to="/dashboard/requisitions/completed"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Completed
              </NavLink>
              <NavLink
                to="/dashboard/requisitions/history"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Requisition History
              </NavLink>
              <NavLink
                to="/dashboard/requisitions/new"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                New Requisition
              </NavLink>
              <div className="nav-section-label">Candidates</div>
              <NavLink
                to="/dashboard/candidates"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Shortlisted Candidates              </NavLink>
              <NavLink
                to="/dashboard/candidates/accepted"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Accepted Candidates
              </NavLink>
              <NavLink
                to="/dashboard/candidates/onboarding"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Onboarding Management
              </NavLink>
            </>
          ) : user.role === 'Super Admin' ? (
            <>
              <div className="nav-section-label">Overview</div>
              <NavLink
                to="/dashboard/superadmin"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>
              <div className="nav-section-label">Companies</div>
              <NavLink
                to="/dashboard/superadmin/onboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Onboard Company
              </NavLink>
              <NavLink
                to="/dashboard/superadmin/accounts"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Company Accounts
              </NavLink>
              <div className="nav-section-label">Vendors</div>
              <NavLink
                to="/dashboard/superadmin/onboard-vendor"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Onboard Vendor
              </NavLink>
              <NavLink
                to="/dashboard/superadmin/vendor-accounts"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Vendor Accounts
              </NavLink>
              <div className="nav-section-label">Archives</div>
              <NavLink
                to="/dashboard/superadmin/archives"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                View All Archives
              </NavLink>
            </>
          ) : user.role === 'Admin' ? (
            <>
              <div className="nav-section-label">Workspace</div>
              <NavLink
                to="/dashboard/admin"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/dashboard/admin/hiring-managers"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Hiring Managers
              </NavLink>
              <NavLink
                to="/dashboard/admin/directors"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Directors
              </NavLink>
              <NavLink
                to="/dashboard/admin/partner-vendors"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Partner Vendors
              </NavLink>
            </>
          ) : (
            <>
              {(() => {
                let lastSection = '';
                return navItems.map((item) => {
                  const section = item.section || 'Workspace';
                  const sectionLabel = section !== lastSection ? (
                    <div key={`section-${section}`} className="nav-section-label">{section}</div>
                  ) : null;
                  if (section !== lastSection) lastSection = section;
                  return [
                    sectionLabel,
                    item.to ? (
                      <NavLink
                        key={item.label}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    ) : (
                      <span key={item.label} className="nav-link locked">
                        {item.label}
                        <span className="soon-tag">Soon</span>
                      </span>
                    ),
                  ];
                }).flat();
              })()}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials(user.name)}</div>
            <div className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          <button className="ghost-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            {highlightRole ? (
              <span className="topbar-org topbar-highlight">{user.role}</span>
            ) : (
              <span className={`topbar-org ${highlightOrg ? 'topbar-highlight' : ''}`}>{user.tenant_name}</span>
            )}
            <span className="topbar-divider">/</span>
            <span className="topbar-page">Dashboard</span>
            {!highlightRole && <span className="topbar-org-label">· {user.role}</span>}
          </div>
          <div className="topbar-right">
            <NotificationBell />
            <span className="session-pill">Verified Session</span>
          </div>
        </header>
        <main className="content-area">
          <div key={location.pathname} className="page-motion">
            <Outlet />
          </div>
        </main>
        <AssistantWidget />
      </div>
    </div>
  );
}
