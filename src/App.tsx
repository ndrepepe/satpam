import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SatpamDashboard from './pages/SatpamDashboard'; // Import SatpamDashboard
import Profile from './pages/Profile';
import Schedule from './pages/Schedule';
import Locations from './pages/Locations';
import CheckArea from './pages/CheckArea';
import CheckAreaReports from './pages/CheckAreaReports';
import PrintQRCode from './pages/PrintQRCode'; // Import PrintQRCode
import ScanLocation from './pages/ScanLocation'; // Import ScanLocation
import CheckAreaReport from './pages/CheckAreaReport'; // Import CheckAreaReport
import { SessionProvider } from './integrations/supabase/SessionContext';
import { Toaster } from 'sonner';
import Layout from './components/Layout';

function App() {
  return (
    <SessionProvider>
      <Toaster />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/supervisor-dashboard" element={<SupervisorDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/satpam-dashboard" element={<SatpamDashboard />} /> {/* Rute baru untuk SatpamDashboard */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/check-area" element={<CheckArea />} />
            <Route path="/check-area-reports" element={<CheckAreaReports />} />
            <Route path="/print-qr/:id" element={<PrintQRCode />} /> {/* Rute untuk PrintQRCode */}
            <Route path="/scan-location" element={<ScanLocation />} /> {/* Rute untuk ScanLocation */}
            <Route path="/check-area-report" element={<CheckAreaReport />} /> {/* Rute untuk CheckAreaReport */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;