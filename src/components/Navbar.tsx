import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
        <Link to="/" className="text-xl font-bold mb-2 sm:mb-0">Satpam App</Link>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          {!sessionLoading && user && (
            <span className="text-sm text-gray-300 text-center sm:text-left">
              {user.email}
            </span>
          )}
          {session ? (
            <Button onClick={handleLogout} variant="ghost" className="text-white hover:bg-gray-700 w-full sm:w-auto">
              Logout
            </Button>
          ) : (
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="ghost" className="text-white hover:bg-gray-700 w-full">
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;