import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Navbar = () => {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Gagal logout: " + error.message);
    } else {
      toast.success("Berhasil logout!");
      navigate('/login');
    }
  };

  if (loading) {
    return null;
  }

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Satpam App</Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              {/* Tautan Profil dihapus sesuai permintaan */}
              <Button onClick={handleLogout} variant="ghost" className="text-white hover:bg-gray-700">Logout</Button>
            </>
          ) : (
            location.pathname !== '/login' && (
              <Link to="/login" className="hover:underline">Login</Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;