import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import SuperAdminLogin from './pages/SuperAdminLogin';
import DirectorLogin from './pages/DirectorLogin';
import DashboardLayout from './pages/DashboardLayout';
import RecruiterDashboard from './pages/RecruiterDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManageDirectors from './pages/ManageDirectors';
import ManageHiringManagers from './pages/ManageHiringManagers';
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
  return <Navigate to="/dashboard/requisitions" replace />;
}

function DashboardIndex() {
  const { user } = useAuth();
  if (user.role === 'Super Admin') return <Navigate to="/dashboard/superadmin" replace />;
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'Director') return <Navigate to="/dashboard/director" replace />;
  if (user.role === 'HR') return <Navigate to="/dashboard/hr" replace />;
  return <Navigate to="/dashboard/requisitions" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
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
          <Route path="requisitions" element={<RequisitionOverview />} />
          <Route path="requisitions/new" element={<NewRequisition />} />
          <Route path="requisitions/:id" element={<RequisitionDetail />} />
          <Route path="candidates" element={<ShortlistedCandidates />} />
          <Route path="recruiter" element={<RecruiterDashboard />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/directors" element={<ManageDirectors />} />
          <Route path="admin/hiring-managers" element={<ManageHiringManagers />} />
          <Route path="director" element={<DirectorDashboard />} />
          <Route path="superadmin" element={<SuperAdminDashboard />} />
          <Route path="superadmin/onboard" element={<OnboardCompany />} />
          <Route path="superadmin/onboard-vendor" element={<OnboardVendor />} />
          <Route path="superadmin/accounts" element={<ConfigureCompanyAccounts />} />
          <Route path="superadmin/vendor-accounts" element={<ConfigureVendorAccounts />} />
          <Route path="hr" element={<HRDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
