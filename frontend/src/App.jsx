import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import { CandidateAuthProvider } from './context/CandidateAuthContext';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import OpenRolesPage from './pages/OpenRolesPage';
import DashboardLayout from './pages/DashboardLayout';

// Lazy-loaded routes for code splitting (reduces initial bundle from 4.15MB down to ~250KB)
const InterviewRequests = lazy(() => import('./pages/recruiter/InterviewRequests'));
const VendorAgreements = lazy(() => import('./pages/recruiter/VendorAgreements'));
const VendorBilling = lazy(() => import('./pages/recruiter/VendorBilling'));
const JoinHiringManager = lazy(() => import('./pages/JoinHiringManager'));
const JoinDirector = lazy(() => import('./pages/JoinDirector'));
const JoinProcurement = lazy(() => import('./pages/JoinProcurement'));
const JoinFinance = lazy(() => import('./pages/JoinFinance'));
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
const DirectorLogin = lazy(() => import('./pages/DirectorLogin'));
const RecruiterDashboard = lazy(() => import('./pages/RecruiterDashboard'));
const HiringManagerDashboard = lazy(() => import('./pages/HiringManagerDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ManageDirectors = lazy(() => import('./pages/ManageDirectors'));
const ManageHiringManagers = lazy(() => import('./pages/ManageHiringManagers'));
const ManageProcurement = lazy(() => import('./pages/ManageProcurement'));
const ManageFinance = lazy(() => import('./pages/ManageFinance'));
const ManagePartnerVendors = lazy(() => import('./pages/ManagePartnerVendors'));
const CompanyAdminProfile = lazy(() => import('./pages/CompanyAdminProfile'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const AiChat = lazy(() => import('./pages/AiChat'));
const HiringManagerChat = lazy(() => import('./pages/HiringManagerChat'));
const DirectorDashboard = lazy(() => import('./pages/DirectorDashboard'));
const DirectorAgreements = lazy(() => import('./pages/DirectorAgreements'));
const DirectorWorkOrders = lazy(() => import('./pages/DirectorWorkOrders'));
const ProcurementDashboard = lazy(() => import('./pages/ProcurementDashboard'));
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'));
const OnboardCompany = lazy(() => import('./pages/OnboardCompany'));
const OnboardVendor = lazy(() => import('./pages/OnboardVendor'));
const ConfigureCompanyAccounts = lazy(() => import('./pages/ConfigureCompanyAccounts'));
const ConfigureVendorAccounts = lazy(() => import('./pages/ConfigureVendorAccounts'));
const HRDashboard = lazy(() => import('./pages/HRDashboard'));
const RequisitionOverview = lazy(() => import('./pages/requisitions/RequisitionOverview'));
const NewRequisition = lazy(() => import('./pages/requisitions/NewRequisition'));
const RequisitionDetail = lazy(() => import('./pages/requisitions/RequisitionDetail'));
const ShortlistedCandidates = lazy(() => import('./pages/candidates/ShortlistedCandidates'));
const RequisitionCandidates = lazy(() => import('./pages/candidates/RequisitionCandidates'));
const CandidateSchedule = lazy(() => import('./pages/candidates/CandidateSchedule'));
const AcceptedCandidates = lazy(() => import('./pages/candidates/AcceptedCandidates'));
const CandidatePortal = lazy(() => import('./pages/candidates/CandidatePortal'));
const CandidateOnboarding = lazy(() => import('./pages/candidates/CandidateOnboarding'));
const OnboardingManagement = lazy(() => import('./pages/candidates/OnboardingManagement'));
const CandidatePortalAccess = lazy(() => import('./pages/candidates/CandidatePortalAccess'));
const ReportedIssues = lazy(() => import('./pages/candidates/ReportedIssues'));
const TeamOverview = lazy(() => import('./pages/workforce/TeamOverview'));
const TimesheetApprovals = lazy(() => import('./pages/workforce/TimesheetApprovals'));
const ExpenseApprovals = lazy(() => import('./pages/workforce/ExpenseApprovals'));
const Workers = lazy(() => import('./pages/workforce/Workers'));
const AdminAccounts = lazy(() => import('./pages/AdminAccounts'));
const SuperAdminCandidatePool = lazy(() => import('./pages/SuperAdminCandidatePool'));
const SuperAdminCandidateManagement = lazy(() => import('./pages/SuperAdminCandidateManagement'));
const SuperAdminOutreachControl = lazy(() => import('./pages/SuperAdminOutreachControl'));

// LiveKit & Video Interview components (isolated 1MB chunk loaded strictly on-demand)
const CandidateInterviewLogin = lazy(() => import('./interview/pages/CandidateInterviewLogin').then(m => ({ default: m.CandidateInterviewLogin })));
const CandidateInterviewPortal = lazy(() => import('./interview/pages/CandidateInterviewPortal').then(m => ({ default: m.CandidateInterviewPortal })));
const InterviewerStaffPortal = lazy(() => import('./interview/pages/InterviewerStaffPortal').then(m => ({ default: m.InterviewerStaffPortal })));
const InterviewMeetingRoomPage = lazy(() => import('./interview/pages/InterviewMeetingRoomPage').then(m => ({ default: m.InterviewMeetingRoomPage })));
const HiringManagerInterviews = lazy(() => import('./interview/pages/HiringManagerInterviews').then(m => ({ default: m.HiringManagerInterviews })));

function FullScreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
      Loading workspace...
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, token, initializing } = useAuth();
  if (initializing) return <FullScreenLoader />;
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
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
  return <ShortlistedCandidates />;
}

function RequisitionRouteGuard({ children }) {
  const { user } = useAuth();
  if (user?.role === 'Admin' || user?.role?.toLowerCase() === 'admin') {
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
        <Suspense fallback={<FullScreenLoader />}>
          <Routes>
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
          <Route path="/interview/login" element={<CandidateInterviewLogin />} />
          <Route path="/interview/candidate/login" element={<CandidateInterviewLogin />} />
          <Route path="/interview/candidate" element={<CandidateInterviewPortal />} />
          <Route path="/interview/staff" element={<InterviewerStaffPortal />} />
          <Route path="/interview/room/:roundId" element={<InterviewMeetingRoomPage />} />
          <Route path="/admin/login" element={<SuperAdminLogin />} />
          <Route path="/director/login" element={<DirectorLogin />} />
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
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
            <Route path="admin/directors" element={<ManageDirectors />} />
            <Route path="admin/hiring-managers" element={<ManageHiringManagers />} />
            <Route path="admin/procurement" element={<ManageProcurement />} />
            <Route path="admin/finance" element={<ManageFinance />} />
            <Route path="admin/profile" element={<CompanyAdminProfile />} />
            <Route path="admin/partner-vendors" element={<ManagePartnerVendors />} />
            <Route path="admin/vendors" element={<ManagePartnerVendors />} />
            <Route path="director" element={<DirectorDashboard view="overview" />} />
            <Route path="director/approvals" element={<DirectorDashboard view="approvals" />} />
            <Route path="director/requisitions" element={<DirectorDashboard view="requisitions" />} />
            <Route path="director/work-orders" element={<DirectorWorkOrders />} />
            <Route path="director/agreements" element={<DirectorAgreements />} />
            <Route path="procurement" element={<ProcurementDashboard />} />
            <Route path="procurement/sow" element={<ProcurementDashboard />} />
            <Route path="finance" element={<FinanceDashboard />} />
            <Route path="finance/work-orders" element={<FinanceDashboard />} />
            <Route path="superadmin" element={<SuperAdminDashboard />} />
            <Route path="superadmin/chat" element={<AiChat />} />
            <Route path="superadmin/onboard" element={<OnboardCompany />} />
            <Route path="superadmin/onboard-vendor" element={<OnboardVendor />} />
            <Route path="superadmin/accounts" element={<ConfigureCompanyAccounts />} />
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
