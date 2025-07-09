import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider, useSession } from './integrations/supabase/SessionContext';
import Index from './pages/Index';
import Login from './pages/Login';
import Private from './pages/Private';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Toaster } from 'sonner';

function App() {
  return (
    <SessionProvider>
      <Toaster />
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/private"
            element={
              <PrivateRoute>
                <Private />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/supervisor-dashboard"
            element={
              <PrivateRoute>
                <SupervisorDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  }

  return session ? <>{children}</> : <Navigate to="/login" />;
};

export default App;