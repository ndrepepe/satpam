import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Shield, Search, MapPin, CheckCircle2, AlertCircle, Calendar, ShieldAlert, Flame, Eye } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  isCheckedToday?: boolean;
}

interface AparTask {
  id: string; // schedule id
  apar_location_id: string;
  name: string;
  type: string;
  posisi_gedung: string;
  status: 'pending' | 'completed' | 'overdue';
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  
  // State Patroli
  const [locations, setLocations] = useState<Location[]>([]);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  
  // State APAR
  const [aparTasks, setAparTasks] = useState<AparTask[]>([]);
  const [isAparScheduledToday, setIsAparScheduledToday] = useState(false);

  const [loadingData, setLoadingData] = useState(true);
  const [isSatpam, setIsSatpam] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateString, setCurrentDateString] = useState('');

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchData = async () => {
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

        // Hitung tanggal tugas (GMT+7)
        const now = new Date();
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (7 * 60 * 60 * 1000));
        let targetCalendarDateForSchedule = new Date(currentGMT7Time);
        targetCalendarDateForSchedule.setHours(6, 0, 0, 0);

        if (currentGMT7Time.getHours() < 6) {
          targetCalendarDateForSchedule.setDate(targetCalendarDateForSchedule.getDate() - 1);
        }
        
        const formattedTargetScheduleDate = format(targetCalendarDateForSchedule, 'yyyy-MM-dd');
        setCurrentDateString(format(targetCalendarDateForSchedule, 'EEEE, dd MMMM yyyy'));

        // ================= FETCH JADWAL PATROLI =================
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('location_id')
          .eq('user_id', user.id)
          .eq('schedule_date', formattedTargetScheduleDate);

        if (scheduleError) {
          console.error("Error fetching patrol schedule:", scheduleError);
          toast.error("Gagal memuat jadwal patroli.");
        } else if (scheduleData && scheduleData.length > 0) {
          setIsScheduledToday(true);
          const scheduledLocationIds = scheduleData.map(s => s.location_id);

          const { data: locationsData, error: locationsError } = await supabase
            .from('locations')
            .select('id, name, qr_code_data, created_at')
            .in('id', scheduledLocationIds)
            .order('name', { ascending: true });

          if (!locationsError && locationsData) {
            // Ambil laporan patroli hari ini
            const localStartOfCheckingDayForReports = new Date(targetCalendarDateForSchedule.getFullYear(), targetCalendarDateForSchedule.getMonth(), targetCalendarDateForSchedule.getDate(), 6, 0, 0);
            const startOfCheckingDayUTC = localStartOfCheckingDayForReports.toISOString();
            const endOfCheckingDayUTC = new Date(localStartOfCheckingDayForReports.getTime() + (24 * 60 * 60 * 1000)).toISOString();

            const { data: reportsData } = await supabase
              .from('check_area_reports')
              .select('location_id')
              .eq('user_id', user.id)
              .gte('created_at', startOfCheckingDayUTC)
              .lt('created_at', endOfCheckingDayUTC);

            const checkedLocationIds = new Set(reportsData?.map(report => report.location_id));
            setLocations(locationsData.map(loc => ({
              ...loc,
              isCheckedToday: checkedLocationIds.has(loc.id),
            })));
          }
        } else {
          setIsScheduledToday(false);
          setLocations([]);
        }

        // ================= FETCH JADWAL APAR =================
        const { data: aparScheduleData, error: aparScheduleError } = await supabase
          .from('apar_schedules')
          .select('id, status, apar_location_id')
          .eq('user_id', user.id)
          .eq('schedule_date', formattedTargetScheduleDate);

        if (aparScheduleError) {
          console.error("Error fetching APAR schedule:", aparScheduleError);
          toast.error("Gagal memuat jadwal APAR.");
        } else if (aparScheduleData && aparScheduleData.length > 0) {
          setIsAparScheduledToday(true);
          const aparLocationIds = aparScheduleData.map(s => s.apar_location_id);

          const { data: aparLocationsData, error: aparLocationsError } = await supabase
            .from('apar_locations')
            .select('id, name, type, posisi_gedung')
            .in('id', aparLocationIds);

          if (!aparLocationsError && aparLocationsData) {
            const mappedAparTasks: AparTask[] = aparScheduleData.map(sched => {
              const loc = aparLocationsData.find(l => l.id === sched.apar_location_id);
              return {
                id: sched.id,
                apar_location_id: sched.apar_location_id,
                name: loc?.name || 'APAR Tidak Diketahui',
                type: loc?.type || 'N/A',
                posisi_gedung: loc?.posisi_gedung || 'N/A',
                status: sched.status
              };
            });
            setAparTasks(mappedAparTasks.sort((a, b) => a.name.localeCompare(b.name)));
          }
        } else {
          setIsAparScheduledToday(false);
          setAparTasks([]);
        }

        setLoadingData(false);
      } else {
        toast.error("Akses ditolak. Anda bukan satpam.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchData();
  }, [session, sessionLoading, user, navigate]);

  const handleScanLocation = (locationId: string) => {
    navigate(`/scan-location?id=${locationId}`);
  };

  const handleScanApar = (aparId: string) => {
    navigate(`/scan-apar?id=${aparId}`);
  };

  // Filter pencarian
  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAparTasks = aparTasks.filter(task =>
    task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.posisi_gedung.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Progress Patroli
  const checkedCount = locations.filter(l => l.isCheckedToday).length;
  const totalCount = locations.length;
  const progressPercentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Progress APAR
  const checkedAparCount = aparTasks.filter(t => t.status === 'completed').length;
  const totalAparCount = aparTasks.length;
  const aparProgressPercentage = totalAparCount > 0 ? Math.round((checkedAparCount / totalAparCount) * 100) : 0;

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Shield className="h-6 w-6 text-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isSatpam) return null;

  return (
    <div className="w-full max-w-4xl mx-auto relative group">
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 opacity-20 blur-xl transition duration-1000 group-hover:opacity-30" />

      <Card className="relative rounded-3xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/80 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
                  <Shield className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-extrabold tracking-wider text-white">HUD TAKTIS SATPAM</CardTitle>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">Sistem Pemantauan Area Real-Time</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-4 py-2 text-xs text-slate-300 font-mono">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <span>{currentDateString || 'Hari Ini'}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari area patroli atau kode APAR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-6 rounded-2xl border-slate-800/80 bg-slate-900/40 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all duration-300"
            />
          </div>

          <Tabs defaultValue="patrol" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1.5 mb-6">
              <TabsTrigger value="patrol" className="rounded-xl font-mono text-xs uppercase py-3 data-[state=active]:bg-blue-600">
                <MapPin className="mr-2 h-4 w-4" /> Patroli Area ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="apar" className="rounded-xl font-mono text-xs uppercase py-3 data-[state=active]:bg-orange-600">
                <Flame className="mr-2 h-4 w-4" /> Cek APAR ({totalAparCount})
              </TabsTrigger>
            </TabsList>

            {/* TAB PATROLI AREA */}
            <TabsContent value="patrol" className="space-y-6 animate-fade-in">
              {!isScheduledToday ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <ShieldAlert className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Tidak Ada Jadwal Patroli</h4>
                    <p className="text-sm text-slate-400 mt-1">Anda tidak memiliki jadwal patroli aktif hari ini.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress Bar Patroli */}
                  <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between text-xs font-mono uppercase tracking-wider text-slate-300">
                      <span>Progres Patroli Hari Ini</span>
                      <span className="text-cyan-400">{checkedCount} dari {totalCount} Lokasi ({progressPercentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {filteredLocations.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 font-mono">Tidak ada lokasi patroli yang cocok.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredLocations.map((loc) => (
                        <div 
                          key={loc.id}
                          className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 flex items-center justify-between transition-all duration-200 hover:border-cyan-500/30 hover:bg-slate-900/60"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-xl ${loc.isCheckedToday ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                              <MapPin className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="font-bold text-white text-sm">{loc.name}</h4>
                              <div className="flex items-center">
                                {loc.isCheckedToday ? (
                                  <span className="inline-flex items-center text-xs font-mono text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> SELESAI
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-xs font-mono text-amber-400">
                                    <AlertCircle className="h-3.5 w-3.5 mr-1" /> BELUM DICEK
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleScanLocation(loc.id)}
                            disabled={loc.isCheckedToday}
                            className={`rounded-xl px-4 font-mono text-xs uppercase tracking-wider transition-all duration-200 ${
                              loc.isCheckedToday 
                                ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                            }`}
                          >
                            {loc.isCheckedToday ? "Selesai" : "Mulai Cek"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* TAB CEK APAR */}
            <TabsContent value="apar" className="space-y-6 animate-fade-in">
              {!isAparScheduledToday ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <Flame className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Tidak Ada Jadwal Cek APAR</h4>
                    <p className="text-sm text-slate-400 mt-1">Anda tidak memiliki jadwal pengecekan APAR aktif hari ini.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress Bar APAR */}
                  <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between text-xs font-mono uppercase tracking-wider text-slate-300">
                      <span>Progres Cek APAR Hari Ini</span>
                      <span className="text-orange-400">{checkedAparCount} dari {totalAparCount} APAR ({aparProgressPercentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-600 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                        style={{ width: `${aparProgressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {filteredAparTasks.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 font-mono">Tidak ada tugas APAR yang cocok.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredAparTasks.map((task) => (
                        <div 
                          key={task.id}
                          className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 flex items-center justify-between transition-all duration-200 hover:border-orange-500/30 hover:bg-slate-900/60"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-xl ${task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                              <Flame className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="font-bold text-white text-sm">{task.name}</h4>
                              <p className="text-xs text-slate-400 font-mono">{task.type} • {task.posisi_gedung}</p>
                              <div className="flex items-center">
                                {task.status === 'completed' ? (
                                  <span className="inline-flex items-center text-xs font-mono text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> SELESAI
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-xs font-mono text-amber-400">
                                    <AlertCircle className="h-3.5 w-3.5 mr-1" /> BELUM DICEK
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleScanApar(task.apar_location_id)}
                            disabled={task.status === 'completed'}
                            className={`rounded-xl px-4 font-mono text-xs uppercase tracking-wider transition-all duration-200 ${
                              task.status === 'completed' 
                                ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-400 hover:to-red-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                            }`}
                          >
                            {task.status === 'completed' ? "Selesai" : "Scan APAR"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamDashboard;