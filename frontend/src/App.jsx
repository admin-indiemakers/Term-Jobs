import InterviewRequests from './pages/recruiter/InterviewRequests';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import JoinHiringManager from './pages/JoinHiringManager';
import JoinDirector from './pages/JoinDirector';
import SuperAdminLogin from './pages/SuperAdminLogin';
import DirectorLogin from './pages/DirectorLogin';
import CandidateLogin from './pages/CandidateLogin';
import DashboardLayout from './pages/DashboardLayout';
import RecruiterDashboard from './pages/RecruiterDashboard';
import HiringManagerDashboard from './pages/HiringManagerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManageDirectors from './pages/ManageDirectors';
import ManageHiringManagers from './pages/ManageHiringManagers';
import ManagePartnerVendors from './pages/ManagePartnerVendors';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import OnboardCompany from './pages/OnboardCompany';
import OnboardVendor from './pages/OnboardVendor';
import ConfigureCompanyAccounts from './pages/ConfigureCompanyAccounts';
import ConfigureVendorAccounts from './pages/ConfigureVendorAccounts';
import HRDashboard from './pages/HRDashboard';
import RequisitionOverview from './pages/requisitions/RequisitionOverview';
import NewRequisition from './pages/requisitions/NewRequisition';
import RequisitionDetail from './pages/requisitions/RequisitionDetail';
import ShortlistedCandidates from './pages/candidates/ShortlistedCandidates';
import RequisitionCandidates from './pages/candidates/RequisitionCandidates';
import CandidateSchedule from './pages/candidates/CandidateSchedule';
import AcceptedCandidates from './pages/candidates/AcceptedCandidates';
import CandidatePortal from './pages/candidates/CandidatePortal';
import CandidateOnboarding from './pages/candidates/CandidateOnboarding';
import OnboardingManagement from './pages/candidates/OnboardingManagement';
import CandidatePortalAccess from './pages/candidates/CandidatePortalAccess';
import ReportedIssues from './pages/candidates/ReportedIssues';
import TeamOverview from './pages/workforce/TeamOverview';
import TimesheetApprovals from './pages/workforce/TimesheetApprovals';
import ExpenseApprovals from './pages/workforce/ExpenseApprovals';
import Archives from './pages/Archives';
import AdminAccounts from './pages/AdminAccounts';


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
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Super Admin') return <Navigate to="/dashboard/superadmin" replace />;
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'Director') return <Navigate to="/dashboard/director" replace />;
  if (user.role === 'HR') return <Navigate to="/dashboard/hr" replace />;
  if (user.role === 'Candidate') return <Navigate to="/candidate/onboarding" replace />;
  return <Navigate to="/dashboard/requisitions" replace />;
}

function DashboardIndex() {
  const { user } = useAuth();
  if (user.role === 'Super Admin') return <Navigate to="/dashboard/superadmin" replace />;
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'Director') return <Navigate to="/dashboard/director" replace />;
  if (user.role === 'HR') return <Navigate to="/dashboard/hr" replace />;
  if (user.role === 'Candidate') return <Navigate to="/candidate/onboarding" replace />;
  return <Navigate to="/dashboard/requisitions" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/join/hiring-manager" element={<JoinHiringManager />} />
        <Route path="/invite/hiring-manager" element={<JoinHiringManager />} />
        <Route path="/join/director" element={<JoinDirector />} />
        <Route path="/invite/director" element={<JoinDirector />} />
        <Route path="/candidate/login" element={<CandidateLogin />} />
        <Route path="/admin/login" element={<SuperAdminLogin />} />
        <Route path="/director/login" element={<DirectorLogin />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardIndex />} />
          <Route path="hiring-manager" element={<HiringManagerDashboard />} />
          <Route path="requisitions" element={<RequisitionOverview />} />
          <Route path="requisitions/drafted" element={<RequisitionOverview section="drafted" />} />
          <Route path="requisitions/published" element={<RequisitionOverview section="published" />} />
          <Route path="requisitions/completed" element={<RequisitionOverview section="completed" />} />
          <Route path="requisitions/history" element={<RequisitionOverview section="history" />} />
          <Route path="requisitions/new" element={<NewRequisition />} />
          <Route path="requisitions/:id" element={<RequisitionDetail />} />
          <Route path="requisitions/:id/candidates" element={<RequisitionCandidates />} />
          <Route path="requisitions/:reqId/candidates/:candidateId" element={<CandidateSchedule />} />
          <Route path="candidates/accepted" element={<AcceptedCandidates />} />
          <Route path="candidates/onboarding" element={<OnboardingManagement />} />
          <Route path="candidates/portal-access" element={<CandidatePortalAccess />} />
          <Route path="candidates/issues" element={<ReportedIssues />} />
          <Route path="candidates" element={<ShortlistedCandidates />} />
          <Route path="workforce/team" element={<TeamOverview />} />
          <Route path="workforce/timesheets" element={<TimesheetApprovals />} />
          <Route path="workforce/expenses" element={<ExpenseApprovals />} />
          <Route path="recruiter" element={<RecruiterDashboard view="dashboard" />} />
          <Route path="recruiter/requisitions" element={<RecruiterDashboard view="requisitions" />} />
          <Route path="recruiter/candidates" element={<RecruiterDashboard view="candidates" />} />
          <Route path="recruiter/shortlisted" element={<RecruiterDashboard view="shortlisted" />} />
          <Route path="recruiter/interviews" element={<InterviewRequests />} />
          <Route path="recruiter/accepted" element={<RecruiterDashboard view="accepted" />} />
          <Route path="recruiter/portal-access" element={<RecruiterDashboard view="portal-access" />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/directors" element={<ManageDirectors />} />
          <Route path="admin/hiring-managers" element={<ManageHiringManagers />} />
          <Route path="admin/partner-vendors" element={<ManagePartnerVendors />} />
          <Route path="admin/vendors" element={<ManagePartnerVendors />} />
          <Route path="director" element={<DirectorDashboard />} />
          <Route path="superadmin" element={<SuperAdminDashboard />} />
          <Route path="superadmin/onboard" element={<OnboardCompany />} />
          <Route path="superadmin/onboard-vendor" element={<OnboardVendor />} />
          <Route path="superadmin/accounts" element={<ConfigureCompanyAccounts />} />
          <Route path="superadmin/vendor-accounts" element={<ConfigureVendorAccounts />} />
          <Route path="superadmin/admin-accounts" element={<AdminAccounts />} />
          <Route path="superadmin/admins" element={<AdminAccounts />} />
          <Route path="superadmin/archives" element={<Archives />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
