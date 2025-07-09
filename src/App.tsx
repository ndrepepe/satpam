import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout"; // Mengubah dari named import menjadi default import
import { SessionProvider } from "./integrations/supabase/SessionContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CheckAreaReport from "./pages/CheckAreaReport";
import Schedules from "./pages/Schedules";
import Admin from "./pages/Admin";
import PrivateRoute from "./components/PrivateRoute";
import NotFound from "./pages/NotFound";
import SatpamDashboard from "./pages/SatpamDashboard";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import PrintQRCode from "./pages/PrintQRCode";
import ScanLocation from "./pages/ScanLocation";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <Toaster />
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/satpam-dashboard" element={<PrivateRoute roles={['satpam']}><SatpamDashboard /></PrivateRoute>} />
              <Route path="/supervisor-dashboard" element={<PrivateRoute roles={['atasan']}><SupervisorDashboard /></PrivateRoute>} />
              <Route path="/check-area-report" element={<PrivateRoute roles={['satpam']}><CheckAreaReport /></PrivateRoute>} />
              <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute roles={['admin']}><Admin /></PrivateRoute>} />
              <Route path="/print-qr/:id" element={<PrivateRoute roles={['admin']}><PrintQRCode /></PrivateRoute>} />
              <Route path="/scan-location" element={<PrivateRoute roles={['satpam']}><ScanLocation /></PrivateRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}

export default App;