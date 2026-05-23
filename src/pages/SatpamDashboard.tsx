import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { MapPin, CheckCircle2, AlertCircle, Search, Calendar, ShieldAlert } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  isCheckedToday?: boolean;
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [isSatpam, setIsSatpam] = useState(false);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateString, setCurrentDateString] = useState('');

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchLocations = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/');
        return;
      }

      if (profileData?.role === 'satpam') {
        setIsSatpam(true);

        const now = new Date();
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (7 * 60 * 60 * 1000));
        let targetCalendarDateForSchedule = new Date(currentGMT7Time);
        targetCalendarDateForSchedule.setHours(6, 0, 0, 0);

        if (currentGMT7Time.getHours() < 6) {
          targetCalendarDateForSchedule.setDate(targetCalendarDateForSchedule.getDate() - 1);
        }
        
        const formattedTargetScheduleDate = format(targetCalendarDateForSchedule, 'yyyy-MM-dd');
        setCurrentDateString(format(targetCalendarDateForSchedule, 'EEEE, dd MMMM yyyy'));

        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('location_id')
          .eq('user_id', user.id)
          .eq('schedule_date', formattedTargetScheduleDate);

        if (scheduleError) {
          console.error("Error fetching schedule:", scheduleError);
          toast.error("Gagal memuat jadwal Anda.");
          setLoadingLocations(false);
          return;
        }

        if (!scheduleData || scheduleData.length === 0) {
          setIsScheduledToday(false);
          setLoadingLocations(false);
          setLocations([]);
          return;
        }
        setIsScheduledToday(true);

        const scheduledLocationIds = scheduleData.map(s => s.location_id);

        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, created_at')
          .in('id', scheduledLocationIds)
          .order('name', { ascending: true });

        if (locationsError) {
          console.error("Error fetching locations:", locationsError);
          toast.error("Gagal memuat daftar lokasi.");
          setLoadingLocations(false);
          return;
        }

        const localStartOfCheckingDayForReports = new Date(targetCalendarDateForSchedule.getFullYear(), targetCalendarDateForSchedule.getMonth(), targetCalendarDateForSchedule.getDate(), 6, 0, 0);
        const startOfCheckingDayUTC = localStartOfCheckingDayForReports.toISOString();
        const endOfCheckingDayUTC = new Date(localStartOfCheckingDayForReports.getTime() + (24 * 60 * 60 * 1000)).toISOString();

        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select('location_id, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC);

        if (reportsError) {
          console.error("Error fetching reports:", reportsError);
          toast.error("Gagal memuat laporan cek area.");
          setLoadingLocations(false);
          return;
        }

        const checkedLocationIds = new Set(reportsData?.map(report => report.location_id));

        const locationsWithStatus = locationsData.map(loc => ({
          ...loc,
          isCheckedToday: checkedLocationIds.has(loc.id),
        }));

        setLocations(locationsWithStatus);
        setLoadingLocations(false);
      } else {
        toast.error("Akses ditolak. Anda bukan satpam.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchLocations();
  }, [session, sessionLoading, user, navigate]);

  const handleScanLocation = (locationId: string) => {
    navigate(`/scan-location?id=${locationId}`);
  };

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkedCount = locations.filter(l => l.isCheckedToday).length;
  const totalCount = locations.length;
  const progressPercentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  if (sessionLoading || loadingLocations) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <MapPin className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Memuat tugas patroli...</p>
        </div>
      </div>
    );
  }

  if (!isSatpam) return null;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 dark:bg-slate-950 pb-12">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-indigo-600 to-indigo-700 text-white py-8 px-4 rounded-b-[2.5rem] shadow-lg shadow-indigo-100 dark:shadow-none">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-xs font-semibold tracking-wider uppercase">Petugas Patroli</p>
              <h2 className="text-xl font-bold mt-0.5">Halo, Rekan Satpam</h2>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl flex items-center space-x-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              <span>{currentDateString || 'Hari Ini'}</span>
            </div>
          </div>

          {isScheduledToday && totalCount > 0 && (
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Progres Patroli Hari Ini</span>
                <span>{checkedCount} dari {totalCount} Lokasi</span>
              </div>
              <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 -mt-4">
        {!isScheduledToday ? (
          <Card className="border-none shadow-xl shadow-slate-100 dark:shadow-none rounded-3xl overflow-hidden mt-8">
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tidak Ada Jadwal</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Anda tidak memiliki jadwal tugas patroli untuk hari ini. Silakan hubungi atasan jika ini keliru.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 mt-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari lokasi patroli..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-6 bg-white dark:bg-slate-900 border-none shadow-md shadow-slate-100 dark:shadow-none rounded-2xl focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>

            {/* Location Cards */}
            <div className="space-y-3">
              {filteredLocations.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl shadow-md shadow-slate-100 dark:shadow-none">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {searchQuery ? "Lokasi tidak ditemukan." : "Belum ada lokasi patroli."}
                  </p>
                </div>
              ) : (
                filteredLocations.map((loc) => (
                  <div 
                    key={loc.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md shadow-slate-100 dark:shadow-none border border-slate-100/50 dark:border-slate-800/50 flex items-center justify-between transition-all duration-200 hover:shadow-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 rounded-xl ${loc.isCheckedToday ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'}`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{loc.name}</h4>
                        <div className="flex items-center">
                          {loc.isCheckedToday ? (
                            <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Sudah Dicek
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3 mr-1" /> Belum Dicek
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleScanLocation(loc.id)}
                      disabled={loc.isCheckedToday}
                      className={`rounded-xl px-4 font-semibold text-xs transition-all duration-200 ${
                        loc.isCheckedToday 
                          ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                      }`}
                    >
                      {loc.isCheckedToday ? "Selesai" : "Mulai Cek"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SatpamDashboard;