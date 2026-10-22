import { financeRedirect } from './utils/financeAccess';
import { canCreateRequisition, requisitionWorkflowRedirect } from './utils/requisitionPermissions';
import CandidateTelegramLogin from './pages/CandidateTelegramLogin';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import { CandidateAuthProvider } from './context/CandidateAuthContext';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import OpenRolesPage from './pages/OpenRolesPage';
import DashboardLayout from './pages/DashboardLayout';
import { directorRedirect } from './utils/directorAccess';
import FieldRequirementIndicators from './components/FieldRequirementIndicators';
import { TermJobsLoader } from './components/TermJobsLoader';
import { lazyWithRetry } from './utils/chunkRecovery';

// Lazy-loaded routes with auto-retry and chunk error recovery (prevents chunk load failure after deployments)
const CandidatePoolAdded = lazyWithRetry(() => import('./pages/CandidatePoolAdded'));
const LegalPage = lazyWithRetry(() => import('./pages/LegalPage'));
const InterviewRequests = lazyWithRetry(() => import('./pages/recruiter/InterviewRequests'));
const VendorAgreements = lazyWithRetry(() => import('./pages/recruiter/VendorAgreements'));
const VendorBilling = lazyWithRetry(() => import('./pages/recruiter/VendorBilling'));
const TenantDashboard = lazyWithRetry(() => import('./pages/TenantDashboard'));
const AdminTeamMembers = lazyWithRetry(() => import('./pages/AdminTeamMembers'));
const JoinHiringManager = lazyWithRetry(() => import('./pages/JoinHiringManager'));
const JoinDirector = lazyWithRetry(() => import('./pages/JoinDirector'));
const JoinProcurement = lazyWithRetry(() => import('./pages/JoinProcurement'));
const JoinFinance = lazyWithRetry(() => import('./pages/JoinFinance'));
const SuperAdminLogin = lazyWithRetry(() => import('./pages/SuperAdminLogin'));
const HiringManagerTelegramLogin = lazyWithRetry(() => import('./pages/HiringManagerTelegramLogin'));
const DirectorLogin = lazyWithRetry(() => import('./pages/DirectorLogin'));
const RecruiterDashboard = lazyWithRetry(() => import('./pages/RecruiterDashboard'));
const HiringManagerDashboard = lazyWithRetry(() => import('./pages/HiringManagerDashboard'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const ManageDirectors = lazyWithRetry(() => import('./pages/ManageDirectors'));
const ManageHiringManagers = lazyWithRetry(() => import('./pages/ManageHiringManagers'));
const ManageProcurement = lazyWithRetry(() => import('./pages/ManageProcurement'));
const ManageFinance = lazyWithRetry(() => import('./pages/ManageFinance'));
const ManagePartnerVendors = lazyWithRetry(() => import('./pages/ManagePartnerVendors'));
const CompanyAdminProfile = lazyWithRetry(() => import('./pages/CompanyAdminProfile'));
const SuperAdminDashboard = lazyWithRetry(() => import('./pages/SuperAdminDashboard'));
const AiChat = lazyWithRetry(() => import('./pages/AiChat'));
const HiringManagerChat = lazyWithRetry(() => import('./pages/HiringManagerChat'));
const DirectorDashboard = lazyWithRetry(() => import('./pages/DirectorDashboard'));
const DirectorAgreements = lazyWithRetry(() => import('./pages/DirectorAgreements'));
const DirectorWorkOrders = lazyWithRetry(() => import('./pages/DirectorWorkOrders'));
const DirectorRoleTemplates = lazyWithRetry(() => import('./pages/DirectorRoleTemplates'));
const ProcurementDashboard = lazyWithRetry(() => import('./pages/ProcurementDashboard'));
const FinanceApprovals = lazyWithRetry(() => import('./pages/FinanceApprovals'));
const FinanceDashboard = lazyWithRetry(() => import('./pages/FinanceDashboard'));
const UserProfileSettings = lazyWithRetry(() => import('./pages/UserProfileSettings'));
const OnboardCompany = lazyWithRetry(() => import('./pages/OnboardCompany'));
const OnboardVendor = lazyWithRetry(() => import('./pages/OnboardVendor'));
const ConfigureCompanyAccounts = lazyWithRetry(() => import('./pages/ConfigureCompanyAccounts'));
const ConfigureVendorAccounts = lazyWithRetry(() => import('./pages/ConfigureVendorAccounts'));
const HRDashboard = lazyWithRetry(() => import('./pages/HRDashboard'));
const RequisitionOverview = lazyWithRetry(() => import('./pages/requisitions/RequisitionOverview'));
const NewRequisition = lazyWithRetry(() => import('./pages/requisitions/NewRequisition'));
const RequisitionDetail = lazyWithRetry(() => import('./pages/requisitions/RequisitionDetail'));
const RequisitionCandidates = lazyWithRetry(() => import('./pages/candidates/RequisitionCandidates'));
const CandidateSchedule = lazyWithRetry(() => import('./pages/candidates/CandidateSchedule'));
const CandidateInterviewPanel = lazyWithRetry(() => import('./pages/candidates/CandidateInterviewPanel'));
const AcceptedCandidates = lazyWithRetry(() => import('./pages/candidates/AcceptedCandidates'));
const CandidatePortal = lazyWithRetry(() => import('./pages/candidates/CandidatePortal'));
const CandidateOnboarding = lazyWithRetry(() => import('./pages/candidates/CandidateOnboarding'));
const OnboardingManagement = lazyWithRetry(() => import('./pages/candidates/OnboardingManagement'));
const CandidatePortalAccess = lazyWithRetry(() => import('./pages/candidates/CandidatePortalAccess'));
const ReportedIssues = lazyWithRetry(() => import('./pages/candidates/ReportedIssues'));
const TeamOverview = lazyWithRetry(() => import('./pages/workforce/TeamOverview'));
const TimesheetApprovals = lazyWithRetry(() => import('./pages/workforce/TimesheetApprovals'));
const ExpenseApprovals = lazyWithRetry(() => import('./pages/workforce/ExpenseApprovals'));
const Workers = lazyWithRetry(() => import('./pages/workforce/Workers'));
const AdminAccounts = lazyWithRetry(() => import('./pages/AdminAccounts'));
const SuperAdminCandidatePool = lazyWithRetry(() => import('./pages/SuperAdminCandidatePool'));
const SuperAdminCandidateManagement = lazyWithRetry(() => import('./pages/SuperAdminCandidateManagement'));
const SuperAdminOutreachControl = lazyWithRetry(() => import('./pages/SuperAdminOutreachControl'));

// LiveKit & Video Interview components (isolated 1MB chunk loaded strictly on-demand)
const CandidateInterviewLogin = lazyWithRetry(() => import('./interview/pages/CandidateInterviewLogin').then(m => ({ default: m.CandidateInterviewLogin })));
const CandidateInterviewPortal = lazyWithRetry(() => import('./interview/pages/CandidateInterviewPortal').then(m => ({ default: m.CandidateInterviewPortal })));
const InterviewerStaffPortal = lazyWithRetry(() => import('./interview/pages/InterviewerStaffPortal').then(m => ({ default: m.InterviewerStaffPortal })));
const InterviewMeetingRoomPage = lazyWithRetry(() => import('./interview/pages/InterviewMeetingRoomPage').then(m => ({ default: m.InterviewMeetingRoomPage })));
const HiringManagerInterviews = lazyWithRetry(() => import('./interview/pages/HiringManagerInterviews').then(m => ({ default: m.HiringManagerInterviews })));

function FullScreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <TermJobsLoader size={38} ariaLabel="Loading workspace..." />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, token, initializing } = useAuth();
  const { pathname } = useLocation();
  if (initializing) return <FullScreenLoader />;
  if (!token || !user) return <Navigate to="/login" replace />;
  const redirect = financeRedirect(user.role, pathname);
  return redirect ? <Navigate to={redirect} replace /> : children;
}

function HomeRedirect() {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role === 'Super Admin') return <Navigate to="/dashboard/superadmin" replace />;
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'Director') return <Navigate to="/dashboard/director" replace />;
  if (user.role === 'Procurement' || user.role === 'Procurement Team') return <Navigate to="/dashboard/procurement" replace />;
  if (user.role === 'Finance' || user.role === 'Finance Team') return <Navigate to="/dashboard/finance" replace />;
  if (user.role === 'HR' || user.role === 'Hiring Manager') return <Navigate to="/dashboard/hiring-manager" replace />;
  if (user.role === 'Candidate') return <Navigate to="/dashboard/candidate" replace />;
  return <Navigate to="/dashboard/hiring-manager" replace />;
}

function DashboardIndex() {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role === 'Super Admin') return <Navigate to="/dashboard/superadmin" replace />;
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'Director') return <Navigate to="/dashboard/director" replace />;
  if (user.role === 'Procurement' || user.role === 'Procurement Team') return <Navigate to="/dashboard/procurement" replace />;
  if (user.role === 'Finance' || user.role === 'Finance Team') return <Navigate to="/dashboard/finance" replace />;
  if (user.role === 'HR' || user.role === 'Hiring Manager') return <Navigate to="/dashboard/hiring-manager" replace />;
  if (user.role === 'Candidate') return <Navigate to="/dashboard/candidate" replace />;
  return <Navigate to="/dashboard/hiring-manager" replace />;
}

function CandidateRouteDispatcher() {
  const { user } = useAuth();
  if (user?.role === 'Super Admin' || user?.role?.toLowerCase() === 'super admin') {
    return <SuperAdminCandidatePool />;
  }
  return <Navigate to="/dashboard/candidates/accepted" replace />;
}

function DashboardAccessGuard({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const redirect = requisitionWorkflowRedirect(user?.role, pathname) || directorRedirect(user?.role, pathname);
  return redirect ? <Navigate to={redirect} replace /> : children;
}

function SuperAdminRouteGuard({ children }) {
  const { user } = useAuth();
  return user?.role === 'Super Admin' ? children : <Navigate to="/dashboard" replace />;
}

function RequisitionRouteGuard({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const params = useParams();
  if (pathname.replace(/\/$/, '') === '/dashboard/requisitions/new' && !canCreateRequisition(user?.role)) {
    return <Navigate to={['Procurement', 'Procurement Team', 'Employee'].includes(user?.role) ? '/dashboard/procurement' : '/dashboard'} replace />;
  }
  const role = user?.role?.toLowerCase() || '';
  if (role === 'director') {
    if (params?.id) {
      return <Navigate to={`/dashboard/director/requisitions?reqId=${encodeURIComponent(params.id)}`} replace />;
    }
    return <Navigate to="/dashboard/director/requisitions" replace />;
  }
  if (role === 'admin') {
    return <Navigate to="/dashboard/admin" replace />;
  }
  return children;
}

function HorizontalTransitionLayout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isLogin = location.pathname === '/login' || location.pathname === '/signin';
  const isRoles = !isLanding && !isLogin;
  const rolesScrollRef = useRef(null);
  const authScrollRef = useRef(null);

  // Defer mounting until the user navigates to the respective subpage
  const [hasVisitedRoles, setHasVisitedRoles] = useState(isRoles);
  const [hasVisitedLogin, setHasVisitedLogin] = useState(isLogin);

  useEffect(() => {
    if (isRoles && !hasVisitedRoles) {
      setHasVisitedRoles(true);
    }
  }, [isRoles, hasVisitedRoles]);

  useEffect(() => {
    if (isLogin && !hasVisitedLogin) {
      setHasVisitedLogin(true);
    }
  }, [isLogin, hasVisitedLogin]);

  // When returning to Landing page, reset subpage scrolls to top so they are clean on return
  useEffect(() => {
    if (isLanding) {
      if (rolesScrollRef.current) {
        rolesScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
      if (authScrollRef.current) {
        authScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  }, [isLanding]);

  const targetX = isLogin ? '100vw' : isLanding ? '0vw' : '-100vw';

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#08090b]">
      <motion.div
        className="relative h-dvh w-screen"
        initial={{ x: targetX }}
        animate={{ x: targetX }}
        transition={{
          duration: 1.15,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {/* Left Slot: Sign In / Auth Page (at -100vw, slides in from the left) */}
        <div
          ref={authScrollRef}
          className="absolute inset-0 w-screen h-dvh overflow-y-auto overflow-x-hidden"
          style={{ left: '-100vw' }}
        >
          {hasVisitedLogin && <AuthPage />}
        </div>

        {/* Center Slot: Landing Page (at 0vw) */}
        <div
          className="absolute inset-0 w-screen h-dvh overflow-hidden"
          style={{ left: '0vw' }}
        >
          <LandingPage enabled={isLanding} />
        </div>

        {/* Right Slot: Open Roles Page (at +100vw, slides in from the right) */}
        <div
          ref={rolesScrollRef}
          className="absolute inset-0 w-screen h-dvh overflow-y-auto overflow-x-hidden"
          style={{ left: '100vw' }}
        >
          {hasVisitedRoles && <OpenRolesPage enabled={isRoles} />}
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CandidateAuthProvider>
        <FieldRequirementIndicators />
        <Suspense fallback={<FullScreenLoader />}>
          <Routes>
          <Route path="/candidate-pool/added" element={<CandidatePoolAdded />} />
          <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
          <Route path="/terms-and-conditions" element={<LegalPage type="terms" />} />
          <Route path="/platform-rules" element={<LegalPage type="rules" />} />
          <Route path="/join/hiring-manager" element={<JoinHiringManager />} />
          <Route path="/invite/hiring-manager" element={<JoinHiringManager />} />
          <Route path="/join/director" element={<JoinDirector />} />
          <Route path="/invite/director" element={<JoinDirector />} />
          <Route path="/join/procurement" element={<JoinProcurement />} />
          <Route path="/invite/procurement" element={<JoinProcurement />} />
          <Route path="/join/finance" element={<JoinFinance />} />
          <Route path="/invite/finance" element={<JoinFinance />} />
          <Route element={<HorizontalTransitionLayout />}>
            <Route path="/" element={null} />
            <Route path="/open-roles" element={null} />
            <Route path="/openroles" element={null} />
            <Route path="/jobs" element={null} />
            <Route path="/careers" element={null} />
            <Route path="/apply" element={null} />
            <Route path="/candidate/login" element={null} />
            <Route path="/candidate-login" element={null} />
            <Route path="/candidate/profile-login" element={null} />
            <Route path="/login" element={null} />
            <Route path="/signin" element={null} />
          </Route>
          <Route path="/candidate/telegram-login" element={<CandidateTelegramLogin />} />
          <Route path="/hiring-manager/telegram-login" element={<HiringManagerTelegramLogin />} />
          <Route path="/interview/login" element={<CandidateInterviewLogin />} />
          <Route path="/interview/candidate/login" element={<CandidateInterviewLogin />} />
          <Route path="/interview/candidate" element={<CandidateInterviewPortal />} />
          <Route path="/interview/staff" element={<InterviewerStaffPortal />} />
          <Route path="/interview/room/:roundId" element={<InterviewMeetingRoomPage />} />
          <Route path="/interview/ai/:roundId" element={<InterviewMeetingRoomPage />} />
          <Route path="/interview-panel/:candidateId" element={<RequireAuth><CandidateInterviewPanel /></RequireAuth>} />
          <Route path="/interview-panel" element={<RequireAuth><CandidateInterviewPanel /></RequireAuth>} />
          <Route path="/requisitions/:reqId/candidates/:candidateId/interview" element={<RequireAuth><CandidateInterviewPanel /></RequireAuth>} />
          <Route path="/admin/login" element={<SuperAdminLogin />} />
          <Route path="/director/login" element={<DirectorLogin />} />
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardAccessGuard><DashboardLayout /></DashboardAccessGuard>
              </RequireAuth>
            }
          >
            <Route index element={<DashboardIndex />} />
            <Route path="interviews" element={<HiringManagerInterviews />} />
            <Route path="hiring-manager" element={<HiringManagerDashboard />} />
            <Route path="hiring-manager/chat" element={<HiringManagerChat />} />
            <Route path="requisitions" element={<RequisitionRouteGuard><RequisitionOverview /></RequisitionRouteGuard>} />
            <Route path="requisitions/published" element={<RequisitionRouteGuard><RequisitionOverview section="published" /></RequisitionRouteGuard>} />
            <Route path="requisitions/pending-approval" element={<RequisitionRouteGuard><RequisitionOverview section="pending_approval" /></RequisitionRouteGuard>} />
            <Route path="requisitions/pending" element={<RequisitionRouteGuard><RequisitionOverview section="pending_approval" /></RequisitionRouteGuard>} />
            <Route path="requisitions/drafted" element={<RequisitionRouteGuard><RequisitionOverview section="drafted" /></RequisitionRouteGuard>} />
            <Route path="requisitions/completed" element={<RequisitionRouteGuard><RequisitionOverview section="completed" /></RequisitionRouteGuard>} />
            <Route path="requisitions/history" element={<RequisitionRouteGuard><RequisitionOverview section="history" /></RequisitionRouteGuard>} />
            <Route path="requisitions/new" element={<RequisitionRouteGuard><NewRequisition /></RequisitionRouteGuard>} />
            <Route path="requisitions/:id" element={<RequisitionRouteGuard><RequisitionDetail /></RequisitionRouteGuard>} />
            <Route path="requisitions/:id/candidates" element={<RequisitionRouteGuard><RequisitionCandidates /></RequisitionRouteGuard>} />
            <Route path="requisitions/:reqId/candidates/:candidateId" element={<RequisitionRouteGuard><CandidateSchedule /></RequisitionRouteGuard>} />
            <Route path="candidates/accepted" element={<AcceptedCandidates />} />
            <Route path="candidates/onboarding" element={<OnboardingManagement />} />
            <Route path="candidates/portal-access" element={<CandidatePortalAccess />} />
            <Route path="candidates/issues" element={<ReportedIssues />} />
            <Route path="candidates" element={<CandidateRouteDispatcher />} />
            <Route path="candidatepool" element={<SuperAdminCandidatePool />} />
            <Route path="candidate-pool" element={<SuperAdminCandidatePool />} />
            <Route path="candidatespool" element={<SuperAdminCandidatePool />} />
            <Route path="candidates-pool" element={<SuperAdminCandidatePool />} />
            <Route path="outreach" element={<SuperAdminOutreachControl />} />
            <Route path="candidate-outreach" element={<SuperAdminOutreachControl />} />
            <Route path="workforce/team" element={<TeamOverview />} />
            <Route path="workforce/timesheets" element={<TimesheetApprovals />} />
            <Route path="workforce/expenses" element={<ExpenseApprovals />} />
            <Route path="workforce/workers" element={<Workers />} />
            <Route path="recruiter/workers" element={<Workers />} />
            <Route path="recruiter" element={<RecruiterDashboard view="dashboard" />} />
            <Route path="recruiter/requisitions" element={<RecruiterDashboard view="requisitions" />} />
            <Route path="recruiter/candidates" element={<RecruiterDashboard view="candidates" />} />
            <Route path="recruiter/shortlisted" element={<RecruiterDashboard view="shortlisted" />} />
            <Route path="recruiter/interviews" element={<InterviewRequests />} />
            <Route path="recruiter/agreements" element={<VendorAgreements />} />
            <Route path="recruiter/accepted" element={<RecruiterDashboard view="accepted" />} />
            <Route path="recruiter/portal-access" element={<RecruiterDashboard view="portal-access" />} />
            <Route path="recruiter/billing" element={<Navigate to="/dashboard/superadmin/candidate-management?tab=billing" replace />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/chat" element={<AiChat />} />
            <Route path="admin/directors" element={<ManageDirectors />} />
            <Route path="admin/hiring-managers" element={<ManageHiringManagers />} />
            <Route path="admin/team" element={<AdminTeamMembers />} />
            <Route path="admin/procurement" element={<ManageProcurement />} />
            <Route path="admin/finance" element={<ManageFinance />} />
            <Route path="admin/profile" element={<CompanyAdminProfile />} />
            <Route path="admin/partner-vendors" element={<ManagePartnerVendors />} />
            <Route path="admin/vendors" element={<ManagePartnerVendors />} />
            <Route path="director" element={<DirectorDashboard view="overview" />} />
            <Route path="director/approvals" element={<DirectorDashboard view="approvals" />} />
            <Route path="director/requisitions" element={<DirectorDashboard view="requisitions" />} />
            <Route path="director/requisitions/:id" element={<DirectorDashboard view="requisitions" />} />
            <Route path="director/templates" element={<DirectorRoleTemplates />} />
            <Route path="director/role-templates" element={<DirectorRoleTemplates />} />
            <Route path="director/work-orders" element={<DirectorWorkOrders />} />
            <Route path="director/agreements" element={<DirectorAgreements />} />
            <Route path="director/finance-approvals" element={<FinanceApprovals />} />
            <Route path="director/profile" element={<UserProfileSettings portalTitle="Executive Director Profile" />} />
            <Route path="procurement" element={<ProcurementDashboard />} />
            <Route path="procurement/finance-approvals" element={<FinanceApprovals />} />
            <Route path="procurement/sow" element={<ProcurementDashboard />} />
            <Route path="procurement/profile" element={<UserProfileSettings portalTitle="Procurement Officer Profile" />} />
            <Route path="finance" element={<FinanceDashboard />} />
            <Route path="finance/work-orders" element={<FinanceDashboard />} />
            <Route path="finance/approvals" element={<FinanceApprovals />} />
            <Route path="finance/profile" element={<UserProfileSettings portalTitle="Finance Officer Profile" />} />
            <Route path="superadmin" element={<SuperAdminDashboard />} />
            <Route path="superadmin/chat" element={<AiChat />} />
            <Route path="superadmin/onboard" element={<OnboardCompany />} />
            <Route path="superadmin/onboard-vendor" element={<OnboardVendor />} />
            <Route path="superadmin/accounts" element={<ConfigureCompanyAccounts />} />
            <Route path="superadmin/tenants/:tenantId" element={<SuperAdminRouteGuard><TenantDashboard /></SuperAdminRouteGuard>} />
            <Route path="superadmin/vendor-accounts" element={<ConfigureVendorAccounts />} />
            <Route path="superadmin/admin-accounts" element={<AdminAccounts />} />
            <Route path="superadmin/admins" element={<AdminAccounts />} />
            <Route path="superadmin/candidate-management" element={<SuperAdminCandidateManagement />} />
            <Route path="candidate-management" element={<SuperAdminCandidateManagement />} />
            <Route path="superadmin/billing" element={<Navigate to="/dashboard/superadmin/candidate-management?tab=billing" replace />} />
            <Route path="superadmin/candidate-billing" element={<Navigate to="/dashboard/superadmin/candidate-management?tab=billing" replace />} />
            <Route path="superadmin/candidates" element={<SuperAdminCandidatePool />} />
            <Route path="superadmin/candidate-pool" element={<SuperAdminCandidatePool />} />
            <Route path="superadmin/candidatepool" element={<SuperAdminCandidatePool />} />
            <Route path="superadmin/candidates-pool" element={<SuperAdminCandidatePool />} />
            <Route path="superadmin/outreach" element={<SuperAdminOutreachControl />} />
            <Route path="superadmin/candidate-outreach" element={<SuperAdminOutreachControl />} />
            <Route path="superadmin/archives" element={<Navigate to="/dashboard/superadmin" replace />} />
            <Route path="hr" element={<HRDashboard />} />
          </Route>
          <Route
            path="/dashboard/candidate"
            element={
              <RequireAuth>
                <CandidatePortal />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate/onboarding"
            element={
              <RequireAuth>
                <CandidateOnboarding />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate/portal"
            element={
              <RequireAuth>
                <CandidatePortal />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate/dashboard"
            element={
              <RequireAuth>
                <CandidatePortal />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate/assignment"
            element={
              <RequireAuth>
                <CandidatePortal />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate/timesheet"
            element={
              <RequireAuth>
                <CandidatePortal />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate/attendance"
            element={
              <RequireAuth>
                <CandidatePortal />
              </RequireAuth>
            }
          />
          <Route
            path="/candidatepool"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/candidate-pool"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/candidatespool"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/candidates-pool"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/superadmin/candidates"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/superadmin/candidate-pool"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/superadmin/candidatepool"
            element={
              <RequireAuth>
                <Navigate to="/dashboard/superadmin/candidates" replace />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </CandidateAuthProvider>
    </BrowserRouter>
  );
}
