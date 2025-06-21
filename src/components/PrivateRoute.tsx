import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrivateRouteProps {
  children: React.ReactNode;
  roles?: string[]; // Opsional: array peran yang diizinkan
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, roles }) => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (sessionLoading) {
        return; // Still loading session, wait
      }

      if (!session || !user) {
        // No session, redirect to login
        toast.error("Anda harus login untuk mengakses halaman ini.");
        navigate('/login');
        return;
      }

      if (!roles || roles.length === 0) {
        // No specific roles required, just authenticated
        setIsAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // Check user role if roles are specified
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role for PrivateRoute:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/login'); // Redirect to login on profile error
        return;
      }

      if (profileData && roles.includes(profileData.role)) {
        setIsAuthorized(true);
      } else {
        toast.error("Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini.");
        navigate('/'); // Redirect to home or a forbidden page
      }
      setCheckingAuth(false);
    };

    checkAuthorization();
  }, [session, sessionLoading, user, roles, navigate]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memeriksa otorisasi...</p>
      </div>
    );
  }

  return isAuthorized ? <>{children}</> : null;
};

export default PrivateRoute;