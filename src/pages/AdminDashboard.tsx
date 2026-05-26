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
import { Cpu, Users, MapPin, CalendarRange } from 'lucide-react';

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
            toast.error("Akses ditolak. Profil tidak ditemukan atau Anda bukan admin.");
          } else {
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Cpu className="h-6 w-6 text-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="w-full max-w-6xl mx-auto relative group">
      {/* Glowing background aura */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 opacity-20 blur-xl transition duration-1000 group-hover:opacity-30" />

      <Card className="relative rounded-3xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/80 pb-6">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
                <Cpu className="h-6 w-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold tracking-wider text-white">PUSAT KONTROL ADMIN</CardTitle>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">Sistem Manajemen Keamanan Spasial</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <Tabs defaultValue="personnel" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1.5">
              <TabsTrigger 
                value="personnel" 
                className="rounded-xl font-mono text-xs uppercase tracking-wider py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all duration-300"
              >
                <Users className="mr-2 h-4 w-4 inline" />
                Personel
              </TabsTrigger>
              <TabsTrigger 
                value="locations" 
                className="rounded-xl font-mono text-xs uppercase tracking-wider py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all duration-300"
              >
                <MapPin className="mr-2 h-4 w-4 inline" />
                Lokasi
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="rounded-xl font-mono text-xs uppercase tracking-wider py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all duration-300"
              >
                <CalendarRange className="mr-2 h-4 w-4 inline" />
                Penjadwalan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personnel" className="mt-6 space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-inner">
                <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase tracking-wider border-b border-slate-800/50 pb-2">Tambah Personel Satpam Baru</h3>
                <PersonnelForm onPersonnelAdded={handlePersonnelAdded} />
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-inner">
                <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase tracking-wider border-b border-slate-800/50 pb-2">Daftar Personel Aktif</h3>
                <PersonnelList isAdmin={isAdmin} refreshKey={personnelListRefreshKey} />
              </div>
            </TabsContent>

            <TabsContent value="locations" className="mt-6 space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-inner">
                <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase tracking-wider border-b border-slate-800/50 pb-2">Buat Lokasi Baru</h3>
                <LocationForm onLocationCreated={handleLocationCreated} />
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-inner">
                <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase tracking-wider border-b border-slate-800/50 pb-2">Daftar Lokasi Terdaftar</h3>
                <LocationList refreshKey={locationListRefreshKey} />
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="mt-6 animate-fade-in">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-inner">
                <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase tracking-wider border-b border-slate-800/50 pb-2">Penjadwalan Satpam Cek Area</h3>
                <SatpamSchedule />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;