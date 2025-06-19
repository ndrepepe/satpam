import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from '@/components/Layout';
import { useSession } from '@/integrations/supabase/SessionContext';

// Lazy load components
const Login = lazy(() => import('@/pages/Login'));
const SatpamDashboard = lazy(() => import('@/pages/SatpamDashboard'));

function HomeRedirect() {
  const { session } = useSession();
  return session ? <Navigate to="/satpam-dashboard" /> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/satpam-dashboard" element={<SatpamDashboard />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;