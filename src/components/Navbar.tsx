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
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Satpam App</Link>
        <div className="flex items-center space-x-4">
          {!sessionLoading && user && (
            <span className="text-sm text-gray-300">
              {user.email}
            </span>
          )}
          {session ? (
            <Button onClick={handleLogout} variant="ghost" className="text-white hover:bg-gray-700">
              Logout
            </Button>
          ) : (
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:bg-gray-700">
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