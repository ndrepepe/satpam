import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Toaster } from '@/components/ui/sonner';
import { SessionContextProvider } from '@/integrations/supabase/SessionContext';

// Regular imports
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import AdminDashboard from '@/pages/AdminDashboard';
import SatpamDashboard from '@/pages/SatpamDashboard';
import SupervisorDashboard from '@/pages/SupervisorDashboard';
import PrintQRCode from '@/pages/PrintQRCode';
import NotFound from '@/pages/NotFound';

// Lazy-loaded components
const CheckAreaReport = React.lazy(() => import('@/pages/CheckAreaReport'));
const ScanLocation = React.lazy(() => import('@/pages/ScanLocation'));

function App() {
  return (
    <Router>
      <SessionContextProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
              <Routes>
                <Route path="/" element={<SatpamDashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/supervisor" element={<SupervisorDashboard />} />
                <Route path="/satpam-dashboard" element={<SatpamDashboard />} />
                <Route path="/scan-location" element={<ScanLocation />} />
                <Route path="/check-area-report" element={<CheckAreaReport />} />
                <Route path="/print-qr/:id" element={<PrintQRCode />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </React.Suspense>
          </main>
        </div>
        <Toaster position="top-center" />
      </SessionContextProvider>
    </Router>
  );
}

export default App;