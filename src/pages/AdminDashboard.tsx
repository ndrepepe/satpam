import React, { useEffect, useState } => {
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonnelForm from '@/components/PersonnelForm';
import PersonnelList from '@/components/PersonnelList';
import LocationForm from '@/components/LocationForm';
import LocationList from '@/components/LocationList';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!loading && session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST204') { // No rows found
            console.warn("No profile found for user, redirecting from Admin Dashboard.");
            toast.error("Akses ditolak. Profil tidak ditemukan atau Anda bukan admin.");
          } else {
            console.error("Error fetching profile role:", error);
            toast.error("Gagal memuat peran pengguna.");
          }
          navigate('/'); // Redirect in case of error or no profile
        } else if (data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          toast.error("Akses ditolak. Anda bukan admin.");
          navigate('/'); // Redirect if not admin
        }
        setProfileLoading(false);
      } else if (!loading && !session) {
        navigate('/login'); // Redirect to login if not authenticated
      }
    };

    checkAdminStatus();
  }, [session, loading, navigate]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard admin...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will be redirected by useEffect
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-3xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personnel" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personnel">Kelola Personel</TabsTrigger>
              <TabsTrigger value="locations">Kelola Lokasi</TabsTrigger>
            </TabsList>
            <TabsContent value="personnel" className="mt-4">
              <h3 className="text-xl font-semibold mb-4">Tambah Personel Satpam Baru</h3>
              <PersonnelForm />
              <PersonnelList isAdmin={isAdmin} /> {/* Meneruskan prop isAdmin */}
            </TabsContent>
            <TabsContent value="locations" className="mt-4">
              <h3 className="text-xl font-semibold mb-4">Buat Lokasi Baru</h3>
              <LocationForm />
              <LocationList />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;