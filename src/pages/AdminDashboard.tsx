import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonnelForm from '@/components/PersonnelForm';
import PersonnelList from '@/components/PersonnelList';
import LocationForm from '@/components/LocationForm';
import LocationList from '@/components/LocationList';
import SatpamSchedule from '@/components/SatpamSchedule';
import { toast } from 'sonner';
import { Shield, Users, MapPin, Calendar } from 'lucide-react';

const AdminDashboard = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [locationListRefreshKey, setLocationListRefreshKey] = useState(0);
  const [personnelListRefreshKey, setPersonnelListRefreshKey] = useState(0);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!loading && session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST204') {
            console.warn("No profile found for user, redirecting from Admin Dashboard.");
            toast.error("Akses ditolak. Profil tidak ditemukan atau Anda bukan admin.");
          } else {
            console.error("Error fetching profile role:", error);
            toast.error("Gagal memuat peran pengguna.");
          }
          navigate('/');
        } else if (data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          toast.error("Akses ditolak. Anda bukan admin.");
          navigate('/');
        }
        setProfileLoading(false);
      } else if (!loading && !session) {
        navigate('/login');
      }
    };

    checkAdminStatus();
  }, [session, loading, navigate]);

  const handleLocationCreated = () => {
    setLocationListRefreshKey(prevKey => prevKey + 1);
  };

  const handlePersonnelAdded = () => {
    setPersonnelListRefreshKey(prevKey => prevKey + 1);
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <Shield className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Memuat dashboard admin...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-md shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Admin</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kelola personel, lokasi patroli, dan penjadwalan Satpam</p>
        </div>

        {/* Main Content Card */}
        <Card className="border-none shadow-xl shadow-slate-100 dark:shadow-none rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <Tabs defaultValue="personnel" className="w-full space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl h-auto">
                <TabsTrigger 
                  value="personnel"
                  className="rounded-xl py-3 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center justify-center space-x-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Kelola Personel</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="locations"
                  className="rounded-xl py-3 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center justify-center space-x-2"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Kelola Lokasi</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="schedule"
                  className="rounded-xl py-3 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center justify-center space-x-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Penjadwalan Satpam</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personnel" className="space-y-6 outline-none">
                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tambah Personel Satpam Baru</h3>
                  <PersonnelForm onPersonnelAdded={handlePersonnelAdded} />
                </div>
                <PersonnelList isAdmin={isAdmin} refreshKey={personnelListRefreshKey} />
              </TabsContent>

              <TabsContent value="locations" className="space-y-6 outline-none">
                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Buat Lokasi Baru</h3>
                  <LocationForm onLocationCreated={handleLocationCreated} />
                </div>
                <LocationList refreshKey={locationListRefreshKey} />
              </TabsContent>

              <TabsContent value="schedule" className="space-y-6 outline-none">
                <SatpamSchedule />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;