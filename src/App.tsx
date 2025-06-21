import { Toaster } from "@/components/ui/sonner";
import { Layout } from "./components/Layout";
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
              <Route path="/check-area-report" element={<PrivateRoute><CheckAreaReport /></PrivateRoute>} />
              <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute roles={['admin']}><Admin /></PrivateRoute>} />
              {/* Rute /profile dihapus */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}

export default App;