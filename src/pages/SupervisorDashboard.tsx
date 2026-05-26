import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarIcon, ShieldAlert, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  posisi_gedung?: string | null;
}

interface CheckAreaReport {
  location_id: string;
  created_at: string;
  user_id: string;
  photo_url: string;
}

interface ScheduleEntry {
  id: string;
  schedule_date: string;
  user_id: string;
  location_id: string;
  profiles: { first_name: string; last_name: string; id_number?: string }[] | null;
  locations: { name: string; posisi_gedung?: string | null }[] | null;
}

interface SatpamTab {
  satpamId: string;
  satpamName: string;
  locationDisplay: string;
  locationsStatus: {
    location: Location;
    isCheckedToday: boolean;
    lastCheckedAt: string | null;
    photoUrl: string | null;
  }[];
}

const SupervisorDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [reports, setReports] = useState<CheckAreaReport[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRole = async () => {
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

      if (profileData?.role === 'atasan' || profileData?.role === 'admin') {
        setIsSupervisor(true);
        fetchData();
      } else {
        toast.error("Akses ditolak. Anda bukan atasan atau admin.");
        navigate('/');
      }
    };

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const { data: locData, error: locError } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, posisi_gedung');
        if (locError) throw locError;
        setLocationList(locData as Location[]);

        const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        const { data, error: scheduleError } = await supabase
          .from('schedules')
          .select(`
            id,
            schedule_date,
            user_id,
            location_id,
            profiles (first_name, last_name, id_number),
            locations (name, posisi_gedung)
          `);
        const scheduleData = data?.filter(s => s.schedule_date === formattedDate);

        if (scheduleError) throw scheduleError;
        setSchedules(scheduleData as unknown as ScheduleEntry[]);

        const now = new Date();
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (7 * 60 * 60 * 1000));
        let targetCalendarDateForReports = new Date(currentGMT7Time);
        targetCalendarDateForReports.setHours(6, 0, 0, 0); 
        if (currentGMT7Time.getHours() < 6) {
          targetCalendarDateForReports.setDate(targetCalendarDateForReports.getDate() - 1);
        }
        
        const localStartOfCheckingDayForReports = new Date(targetCalendarDateForReports.getFullYear(), targetCalendarDateForReports.getMonth(), targetCalendarDateForReports.getDate(), 6, 0, 0);
        const startOfCheckingDayUTC = localStartOfCheckingDayForReports.toISOString();
        const endOfCheckingDayUTC = new Date(localStartOfCheckingDayForReports.getTime() + (24 * 60 * 60 * 1000)).toISOString();

        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select('location_id, user_id, created_at, photo_url')
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC);

        if (reportsError) throw reportsError;
        setReports(reportsData as CheckAreaReport[]);

      } catch (error: any) {
        toast.error(`Gagal memuat data: ${error.message}`);
        console.error("Error fetching data for supervisor dashboard:", error);
      } finally {
        setLoadingData(false);
      }
    };

    checkUserRole();
  }, [session, sessionLoading, user, navigate, selectedDate]);

  const satpamTabs: SatpamTab[] = useMemo(() => {
    const groupedBySatpam = new Map<string, {
      satpamId: string;
      satpamName: string;
      assignedLocationIds: Set<string>;
      locationsStatus: {
        location: Location;
        isCheckedToday: boolean;
        lastCheckedAt: string | null;
        photoUrl: string | null;
      }[];
    }>();

    schedules.forEach(schedule => {
      const satpamId = schedule.user_id;
      const satpamName = schedule.profiles?.[0] ? `${schedule.profiles[0].first_name} ${schedule.profiles[0].last_name}` : 'N/A';
      const location = locationList.find(loc => loc.id === schedule.location_id);

      if (!groupedBySatpam.has(satpamId)) {
        groupedBySatpam.set(satpamId, {
          satpamId,
          satpamName,
          assignedLocationIds: new Set(),
          locationsStatus: [],
        });
      }

      const satpamEntry = groupedBySatpam.get(satpamId)!;
      satpamEntry.assignedLocationIds.add(schedule.location_id);

      if (location) {
        const report = reports.find(r => r.user_id === satpamId && r.location_id === location.id);
        
        satpamEntry.locationsStatus.push({
          location: location,
          isCheckedToday: !!report,
          lastCheckedAt: report ? format(new Date(report.created_at), 'HH:mm', { locale: idLocale }) : null,
          photoUrl: report?.photo_url || null,
        });
      }
    });

    const result: SatpamTab[] = [];
    groupedBySatpam.forEach(entry => {
      let locationDisplay: string;
      const allLocationsCount = locationList.length;
      const gedungBaratLocations = locationList.filter(loc => loc.posisi_gedung === 'Gedung Barat');
      const gedungTimurLocations = locationList.filter(loc => loc.posisi_gedung === 'Gedung Timur');

      const assignedToGedungBarat = Array.from(entry.assignedLocationIds).every(locId => 
        gedungBaratLocations.some(gbLoc => gbLoc.id === locId)
      ) && entry.assignedLocationIds.size === gedungBaratLocations.length && gedungBaratLocations.length > 0;

      const assignedToGedungTimur = Array.from(entry.assignedLocationIds).every(locId => 
        gedungTimurLocations.some(gtLoc => gtLoc.id === locId)
      ) && entry.assignedLocationIds.size === gedungTimurLocations.length && gedungTimurLocations.length > 0;

      if (entry.assignedLocationIds.size === allLocationsCount && allLocationsCount > 0) {
        locationDisplay = "Semua Gedung";
      } else if (assignedToGedungBarat) {
        locationDisplay = "Gedung Barat";
      } else if (assignedToGedungTimur) {
        locationDisplay = "Gedung Timur";
      } else if (entry.assignedLocationIds.size > 0) {
        locationDisplay = "Beberapa Lokasi";
      } else {
        locationDisplay = "Tidak Ditugaskan";
      }

      result.push({
        satpamId: entry.satpamId,
        satpamName: entry.satpamName,
        locationDisplay: locationDisplay,
        locationsStatus: entry.locationsStatus.sort((a, b) => a.location.name.localeCompare(b.location.name)),
      });
    });

    return result.sort((a, b) => a.satpamName.localeCompare(b.satpamName));
  }, [schedules, reports, locationList, selectedDate]);

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <ShieldAlert className="h-6 w-6 text-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isSupervisor) return null;

  return (
    <div className="w-full max-w-5xl mx-auto relative group">
      {/* Glowing background aura */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 opacity-20 blur-xl transition duration-1000 group-hover:opacity-30" />

      <Card className="relative rounded-3xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/80 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 p-[1px] shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
                  <ShieldAlert className="h-6 w-6 text-purple-400" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-extrabold tracking-wider text-white">COMMAND CENTER SUPERVISOR</CardTitle>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">Pemantauan & Verifikasi Spasial</p>
              </div>
            </div>

            {/* Date Picker */}
            <div className="flex justify-start md:justify-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[240px] justify-start text-left font-mono text-xs border-slate-800/80 bg-slate-900/40 text-white hover:bg-slate-800/80"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400" />
                    {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-950 border-slate-800" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    className="bg-slate-950 text-white border-slate-800"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {satpamTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
                <AlertCircle className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Tidak Ada Jadwal</h4>
                <p className="text-sm text-slate-400 mt-1">Tidak ada jadwal yang ditetapkan untuk tanggal ini.</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue={satpamTabs[0]?.satpamId} className="w-full">
              <TabsList className="flex flex-wrap gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-1.5 mb-6">
                {satpamTabs.map((satpamTab) => (
                  <TabsTrigger 
                    key={satpamTab.satpamId} 
                    value={satpamTab.satpamId}
                    className="rounded-xl font-mono text-xs uppercase tracking-wider px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white transition-all duration-300"
                  >
                    {satpamTab.satpamName}
                  </TabsTrigger>
                ))}
              </TabsList>

              {satpamTabs.map((satpamTab) => (
                <TabsContent key={satpamTab.satpamId} value={satpamTab.satpamId} className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
                    <h4 className="text-lg font-bold text-white font-mono uppercase tracking-wider">
                      Tugas: {satpamTab.satpamName}
                    </h4>
                    <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono text-xs">
                      {satpamTab.locationDisplay}
                    </Badge>
                  </div>

                  {satpamTab.locationsStatus.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 font-mono">Tidak ada lokasi ditugaskan.</p>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/20">
                      <Table>
                        <TableHeader className="bg-slate-900/50">
                          <TableRow className="border-b border-slate-800/80 hover:bg-transparent">
                            <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center">Lokasi</TableHead>
                            <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center">Gedung</TableHead>
                            <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center">Status</TableHead>
                            <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center">Waktu Cek</TableHead>
                            <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center">Bukti Foto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {satpamTab.locationsStatus.map((status) => (
                            <TableRow key={status.location.id} className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors duration-200">
                              <TableCell className="font-medium text-white text-center py-4">{status.location.name}</TableCell>
                              <TableCell className="text-slate-300 text-center py-4">{status.location.posisi_gedung || 'N/A'}</TableCell>
                              <TableCell className="text-center py-4">
                                {status.isCheckedToday ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-mono text-xs">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5 inline" />
                                    SELESAI
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-mono text-xs">
                                    <AlertCircle className="mr-1 h-3.5 w-3.5 inline" />
                                    BELUM DICEK
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-300 text-center py-4 font-mono">{status.lastCheckedAt || '-'}</TableCell>
                              <TableCell className="text-center py-4">
                                {status.photoUrl ? (
                                  <a 
                                    href={status.photoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-mono text-xs transition-colors duration-200"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>LIHAT FOTO</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-500 font-mono">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupervisorDashboard;