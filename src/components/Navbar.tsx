import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, LogOut, User as UserIcon } from 'lucide-react';

const Navbar = () => {
  const { session, user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Gagal logout: " + error.message);
    } else {
      toast.success("Berhasil logout!");
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-3 md:px-8">
      <div className="mx-auto max-w-7xl rounded-2xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-xl shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all duration-300 hover:border-blue-500/30">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-transform duration-300 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-950">
                <Shield className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              ANDI <span className="text-cyan-400 font-extrabold">OFFSET</span>
            </span>
          </Link>

          {/* Navigation Actions */}
          <div className="flex items-center space-x-4">
            {!sessionLoading && user && (
              <div className="hidden md:flex items-center space-x-2 rounded-full border border-slate-800/80 bg-slate-900/50 px-4 py-1.5 text-xs text-slate-300">
                <UserIcon className="h-3.5 w-3.5 text-cyan-400" />
                <span className="font-mono">{user.email}</span>
              </div>
            )}
            
            {session ? (
              <Button 
                onClick={handleLogout} 
                variant="ghost" 
                className="rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Link to="/login">
                <Button 
                  variant="ghost" 
                  className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all duration-300"
                >
                  Login Portal
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;