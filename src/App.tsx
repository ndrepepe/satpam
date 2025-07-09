import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AdminDashboard from './pages/AdminDashboard'; // Diperbarui
import Profile from './pages/Profile';
import Schedule from './pages/Schedule';
import Locations from './pages/Locations';
import CheckArea from './pages/CheckArea';
import CheckAreaReports from './pages/CheckAreaReports';
import { SessionProvider } from './integrations/supabase/SessionContext';
import { Toaster } from 'sonner';
import Layout from './components/Layout'; // Import Layout component

function App() {
  return (
    <SessionProvider>
      <Toaster />
      <BrowserRouter>
        <Layout> {/* Wrap routes with Layout */}
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/supervisor-dashboard" element={<SupervisorDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/check-area" element={<CheckArea />} />
            <Route path="/check-area-reports" element={<CheckAreaReports />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;