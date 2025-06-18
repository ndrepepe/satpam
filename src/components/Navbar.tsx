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
  const [isSupervisor, setIsSupervisor] = useState(false); // State baru untuk atasan

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
          setIsSupervisor(false);
        } else if (data) {
          setIsAdmin(data.role === 'admin');
          setIsSatpam(data.role === 'satpam');
          setIsSupervisor(data.role === 'atasan'); // Set state isSupervisor
        } else {
          setIsAdmin(false);
          setIsSatpam(false);
          setIsSupervisor(false);
        }
      } else {
        setIsAdmin(false);
        setIsSatpam(false);
        setIsSupervisor(false);
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
        if (error.message === 'Auth session missing!') {
          console.warn("Logout attempted but session was already missing. SessionContext should handle navigation.");
          toast.success("Anda telah berhasil logout.");
        } else {
          throw error;
        }
      } else {
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
              {/* Tautan Profil hanya ditampilkan jika bukan satpam atau atasan */}
              {!isSatpam && !isSupervisor && (
                <Link to="/profile" className="hover:underline">Profil</Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="hover:underline">Admin</Link>
              )}
              {/* Tautan Cek Area hanya ditampilkan jika bukan satpam (karena tombolnya ada di halaman profil) */}
              {isSatpam && (
                <Link to="/satpam-dashboard" className="hover:underline">Cek Area</Link>
              )}
              {isSupervisor && (
                <Link to="/supervisor" className="hover:underline">Laporan</Link>
              )}
              {/* Tombol Logout hanya ditampilkan jika bukan satpam (karena tombolnya ada di halaman profil) */}
              {!isSatpam && (
                <Button onClick={handleLogout} variant="secondary" className="bg-red-500 hover:bg-red-600 text-white">
                  Logout
                </Button>
              )}
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