import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Dashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      if (sessionLoading) {
        return; // Still loading session, do nothing yet
      }

      if (!user) {
        toast.error("Anda harus login untuk mengakses dashboard.");
        navigate('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/login');
        return;
      }

      if (profileData?.role === 'satpam') {
        navigate('/satpam-dashboard');
      } else if (profileData?.role === 'atasan') {
        navigate('/supervisor-dashboard');
      } else {
        toast.error("Peran pengguna tidak dikenal atau tidak memiliki akses ke dashboard.");
        navigate('/'); // Redirect to home or login if role is not recognized
      }
      setProfileLoading(false);
    };

    checkUserRoleAndRedirect();
  }, [session, sessionLoading, user, navigate]);

  if (sessionLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <p className="text-xl text-gray-600 dark:text-gray-400">Mengarahkan Anda ke dashboard yang sesuai...</p>
    </div>
  );
};

export default Dashboard;