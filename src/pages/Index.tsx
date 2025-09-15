import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner'; // Perbaikan: Menghapus 's' yang tidak perlu

const Index = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const handleRedirect = async () => {
      if (sessionLoading) {
        // Still loading session, do nothing yet
        return;
      }

      if (!session) {
        // No session, redirect to login
        navigate('/login');
        return;
      }

      // Session exists, fetch user role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST204') { // No rows found
          toast.error("Akses ditolak. Profil tidak ditemukan atau Anda bukan admin.");
        } else {
          toast.error("Gagal memuat peran pengguna.");
        }
        navigate('/login'); // Redirect to login on profile error
        return;
      }

      if (profileData?.role === 'admin') {
        navigate('/admin-dashboard'); // Diperbarui
      } else if (profileData?.role === 'satpam' || profileData?.role === 'atasan') {
        navigate('/dashboard'); // Dashboard handles further redirection for satpam/atasan
      } else {
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