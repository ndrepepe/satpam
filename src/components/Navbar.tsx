import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, LogOut, User } from 'lucide-react';

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
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800 transition-all duration-300">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none group-hover:scale-105 transition-transform duration-200">
            <Shield className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Satpam App
          </span>
        </Link>

        <div className="flex items-center space-x-4">
          {!sessionLoading && user && (
            <div className="hidden md:flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {user.email}
              </span>
            </div>
          )}
          
          {session ? (
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              className="text-gray-600 hover:text-red-600 hover:bg-red-50 dark:text-gray-300 dark:hover:bg-red-950/30 rounded-xl flex items-center space-x-2 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          ) : (
            <Link to="/login">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all duration-200">
                Masuk
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;