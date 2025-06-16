import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import ScanLocation from "./pages/ScanLocation";
import PrintQRCode from "./pages/PrintQRCode";
import CheckAreaReport from "./pages/CheckAreaReport"; // Import the new page
import { SessionContextProvider } from "./integrations/supabase/SessionContext";
import Navbar from "./components/Navbar";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isPrintPage = location.pathname.startsWith('/print-qr/');

  return (
    <SessionContextProvider>
      <div className="flex flex-col min-h-screen">
        {!isPrintPage && <Navbar />}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/scan-location" element={<ScanLocation />} />
            <Route path="/print-qr/:id" element={<PrintQRCode />} />
            <Route path="/check-area-report" element={<CheckAreaReport />} /> {/* New route */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </SessionContextProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;