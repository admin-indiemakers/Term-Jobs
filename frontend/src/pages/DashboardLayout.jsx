import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems =
    user.role === 'Hiring Manager'
      ? [
          { to: '/dashboard/requisitions', label: 'Requisitions', end: false },
          { to: '/dashboard/requisitions/new', label: 'New Requisition', end: true },
          { to: '/dashboard/candidates', label: 'Shortlisted Candidates', end: false },
        ]
      : user.role === 'Recruiter'
        ? [{ to: '/dashboard/recruiter', label: 'Dashboard', end: true }]
        : [{ to: '/dashboard/admin', label: 'Dashboard', end: true }];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">TJ</div>
          <div className="brand-text">
            <span className="brand-name">Term Jobs</span>
            <span className="brand-sub">Workforce Platform</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {navItems.map((item) =>
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
            )
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
          <div>
            <span className="topbar-org">{user.tenant_name}</span>
            <span className="topbar-divider">/</span>
            <span className="topbar-page">Dashboard</span>
          </div>
          <div className="topbar-right">
            <span className="session-pill">Verified Session</span>
          </div>
        </header>
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
