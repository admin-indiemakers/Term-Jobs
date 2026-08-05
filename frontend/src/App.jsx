import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './pages/DashboardLayout';
import RecruiterDashboard from './pages/RecruiterDashboard';
import AdminDashboard from './pages/AdminDashboard';
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
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  return <Navigate to="/dashboard/requisitions" replace />;
}

function DashboardIndex() {
  const { user } = useAuth();
  if (user.role === 'Recruiter') return <Navigate to="/dashboard/recruiter" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard/admin" replace />;
  return <Navigate to="/dashboard/requisitions" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
