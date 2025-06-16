import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Navbar = () => {
  const { session, loading, user } = useSession();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSatpam, setIsSatpam] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching user role for Navbar:", error);
          setIsAdmin(false);
          setIsSatpam(false);
        } else if (data) {
          setIsAdmin(data.role === 'admin');
          setIsSatpam(data.role === 'satpam');
        } else {
          setIsAdmin(false);
          setIsSatpam(false);
        }
      } else {
        setIsAdmin(false);
        setIsSatpam(false);
      }
    };

    if (!loading) {
      checkUserRole();
    }
  }, [user, loading]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Jika error adalah 'Auth session missing', anggap sebagai logout berhasil
        if (error.message === 'Auth session missing!') {
          console.warn("Logout attempted but session was already missing. Navigating to login.");
          toast.success("Anda telah berhasil logout.");
          navigate('/login'); // Navigasi manual sebagai fallback
        } else {
          // Untuk error lainnya, lempar error agar ditangkap di blok catch
          throw error;
        }
      } else {
        // Jika tidak ada error, logout berhasil. Navigasi akan ditangani oleh SessionContext
        toast.success("Berhasil logout!");
      }
    } catch (error: any) {
      toast.error(`Gagal logout: ${error.message}`);
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <nav className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Aplikasi Satpam</Link>
        <div className="space-x-4">
          {session ? (
            <>
              <Link to="/profile" className="hover:underline">Profil</Link>
              {isAdmin && (
                <Link to="/admin" className="hover:underline">Admin</Link>
              )}
              {isSatpam && (
                <Link to="/satpam-dashboard" className="hover:underline">Cek Area</Link>
              )}
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