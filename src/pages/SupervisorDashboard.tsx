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
import { Calendar as CalendarIcon, Shield, CheckCircle2, AlertCircle, Eye, MapPin } from 'lucide-react';
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

  // Calculate overall stats for the selected date
  const totalAssignedLocations = schedules.length;
  const totalCheckedLocations = reports.length;
  const totalUncheckedLocations = Math.max(0, totalAssignedLocations - totalCheckedLocations);

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <Shield className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Memuat data supervisor...</p>
        </div>
      </div>
    );
  }

  if (!isSupervisor) return null;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header & Date Picker */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-md shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Supervisor</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pantau aktivitas patroli Satpam secara real-time</p>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-semibold py-6 rounded-2xl border-slate-200 dark:border-slate-800",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-indigo-600" />
                {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-none shadow-md shadow-slate-100 dark:shadow-none rounded-2xl bg-white dark:bg-slate-900">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tugas</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalAssignedLocations}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md shadow-slate-100 dark:shadow-none rounded-2xl bg-white dark:bg-slate-900">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sudah Dicek</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalCheckedLocations}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md shadow-slate-100 dark:shadow-none rounded-2xl bg-white dark:bg-slate-900">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Belum Dicek</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalUncheckedLocations}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card className="border-none shadow-xl shadow-slate-100 dark:shadow-none rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            {satpamTabs.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto stroke-[1.5]" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Tidak ada jadwal patroli yang ditetapkan untuk tanggal ini.
                </p>
              </div>
            ) : (
              <Tabs defaultValue={satpamTabs[0]?.satpamId} className="w-full space-y-6">
                <TabsList className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl h-auto">
                  {satpamTabs.map((satpamTab) => (
                    <TabsTrigger 
                      key={satpamTab.satpamId} 
                      value={satpamTab.satpamId}
                      className="rounded-xl px-4 py-2.5 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
                    >
                      {satpamTab.satpamName}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {satpamTabs.map((satpamTab) => (
                  <TabsContent key={satpamTab.satpamId} value={satpamTab.satpamId} className="space-y-4 outline-none">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Lokasi Tugas: {satpamTab.satpamName}
                      </h4>
                      <Badge className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 hover:bg-indigo-50 border-none rounded-lg px-3 py-1 text-xs font-bold">
                        {satpamTab.locationDisplay}
                      </Badge>
                    </div>

                    {satpamTab.locationsStatus.length === 0 ? (
                      <p className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                        Tidak ada lokasi yang ditugaskan untuk personel ini.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-slate-950">
                            <TableRow>
                              <TableHead className="font-bold text-slate-700 dark:text-slate-300">Nama Lokasi</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">Posisi Gedung</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">Status Cek</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">Waktu Cek</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 dark:text-slate-300">Foto Bukti</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {satpamTab.locationsStatus.map((status) => (
                              <TableRow key={status.location.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <TableCell className="font-semibold text-slate-900 dark:text-white">{status.location.name}</TableCell>
                                <TableCell className="text-center text-slate-600 dark:text-slate-400 text-sm">{status.location.posisi_gedung || '-'}</TableCell>
                                <TableCell className="text-center">
                                  {status.isCheckedToday ? (
                                    <Badge className="bg-emerald-500 hover:bg-emerald-500 border-none rounded-lg px-2.5 py-1 text-xs font-bold">
                                      Sudah Dicek
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="border-none rounded-lg px-2.5 py-1 text-xs font-bold">
                                      Belum Dicek
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-slate-600 dark:text-slate-400 text-sm font-medium">
                                  {status.lastCheckedAt || '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {status.photoUrl ? (
                                    <a 
                                      href={status.photoUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      <span>Lihat Foto</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 text-xs">-</span>
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
    </div>
  );
};

export default SupervisorDashboard;