import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Navbar = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      toast.success("Berhasil logout!");
      navigate('/login');
    } catch (error: any) {
      toast.error(`Gagal logout: ${error.message}`);
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return null; // Atau tampilkan skeleton loading jika diinginkan
  }

  return (
    <nav className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Aplikasi Satpam</Link>
        <div className="space-x-4">
          {session ? (
            <>
              <Link to="/" className="hover:underline">Beranda</Link>
              <Link to="/profile" className="hover:underline">Profil</Link>
              <Button onClick={handleLogout} variant="secondary" className="bg-red-500 hover:bg-red-600 text-white">
                Logout
              </Button>
            </>
          ) : (
            <Link to="/login" className="hover:underline">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;