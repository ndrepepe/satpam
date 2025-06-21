import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Index = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const handleRedirect = async () => {
      console.log("Index.tsx: sessionLoading:", sessionLoading, "session:", session, "user:", user);

      if (sessionLoading) {
        // Still loading session, do nothing yet
        return;
      }

      if (!session) {
        // No session, redirect to login
        console.log("Index.tsx: No session, redirecting to /login");
        navigate('/login');
        return;
      }

      // Session exists, fetch user role
      console.log("Index.tsx: Session exists, fetching profile for user ID:", user?.id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST204') { // No rows found
          console.error("Index.tsx: No profile found for user ID:", user?.id, "Error:", profileError);
          toast.error("Akses ditolak. Profil tidak ditemukan atau Anda bukan admin.");
        } else {
          console.error("Index.tsx: Error fetching profile role:", profileError);
          toast.error("Gagal memuat peran pengguna.");
        }
        navigate('/login'); // Redirect to login on profile error
        return;
      }

      console.log("Index.tsx: Fetched profile data:", profileData);

      if (profileData?.role === 'admin') {
        console.log("Index.tsx: User is admin, navigating to /admin");
        navigate('/admin');
      } else if (profileData?.role === 'satpam' || profileData?.role === 'atasan') {
        console.log("Index.tsx: User is satpam or atasan, navigating to /dashboard");
        navigate('/dashboard'); // Dashboard handles further redirection for satpam/atasan
      } else {
        console.log("Index.tsx: Unknown or unauthorized role:", profileData?.role, "redirecting to /login");
        toast.error("Peran pengguna tidak dikenal atau tidak memiliki akses.");
        navigate('/login'); // Redirect to login if role is not recognized
      }
      setProfileLoading(false);
    };

    handleRedirect();
  }, [session, sessionLoading, user, navigate]);

  if (sessionLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <p className="text-xl text-gray-600 dark:text-gray-400">Mengarahkan Anda...</p>
    </div>
  );
};

export default Index;