import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Navbar = () => {
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!sessionLoading && user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching user role for Navbar:", error);
          setUserRole(null);
        } else if (data) {
          setUserRole(data.role);
        }
      } else if (!sessionLoading && !user) {
        setUserRole(null);
      }
      setProfileLoading(false);
    };

    fetchUserRole();
  }, [user, sessionLoading]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Gagal logout: " + error.message);
    } else {
      toast.success("Berhasil logout!");
      navigate('/login');
    }
  };

  if (sessionLoading || profileLoading) {
    return null; // Jangan render navbar sampai sesi dan peran dimuat
  }

  let dashboardPath = '/dashboard'; // Default path
  if (userRole === 'admin') {
    dashboardPath = '/admin';
  } else if (userRole === 'satpam') {
    dashboardPath = '/satpam-dashboard';
  } else if (userRole === 'atasan') {
    dashboardPath = '/supervisor-dashboard';
  }

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Satpam App</Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link to={dashboardPath} className="hover:underline">Dashboard</Link>
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