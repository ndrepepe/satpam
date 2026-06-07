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
import { Calendar as CalendarIcon, ShieldAlert, CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
        const { data: locData } = await supabase.from('locations').select('id, name, qr_code_data, posisi_gedung');
        setLocationList(locData as Location[]);

        const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        const { data } = await supabase.from('schedules').select(`
            id, schedule_date, user_id, location_id,
            profiles (first_name, last_name, id_number),
            locations (name, posisi_gedung)
          `);
        const scheduleData = data?.filter(s => s.schedule_date === formattedDate);
        setSchedules(scheduleData as unknown as ScheduleEntry[]);

        const now = new Date();
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (7 * 60 * 60 * 1000));
        let targetCalendarDate = new Date(currentGMT7Time);
        targetCalendarDate.setHours(6, 0, 0, 0); 
        if (currentGMT7Time.getHours() < 6) targetCalendarDate.setDate(targetCalendarDate.getDate() - 1);
        
        const localStartOfCheckingDay = new Date(targetCalendarDate.getFullYear(), targetCalendarDate.getMonth(), targetCalendarDate.getDate(), 6, 0, 0);
        const startOfCheckingDayUTC = localStartOfCheckingDay.toISOString();
        const endOfCheckingDayUTC = new Date(localStartOfCheckingDay.getTime() + (24 * 60 * 60 * 1000)).toISOString();

        const { data: reportsData } = await supabase
          .from('check_area_reports')
          .select('location_id, user_id, created_at')
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC);

        setReports(reportsData as CheckAreaReport[]);

      } catch (error: any) {
        toast.error(`Gagal memuat data: ${error.message}`);
      } finally {
        setLoadingData(false);
      }
    };

    checkUserRole();
  }, [session, sessionLoading, user, navigate, selectedDate]);

  const satpamTabs: SatpamTab[] = useMemo(() => {
    const groupedBySatpam = new Map<string, any>();

    schedules.forEach(schedule => {
      const satpamId = schedule.user_id;
      const satpamName = schedule.profiles?.[0] ? `${schedule.profiles[0].first_name} ${schedule.profiles[0].last_name}` : 'N/A';
      const location = locationList.find(loc => loc.id === schedule.location_id);

      if (!groupedBySatpam.has(satpamId)) {
        groupedBySatpam.set(satpamId, {
          satpamId, satpamName, assignedLocationIds: new Set(), locationsStatus: [],
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
        });
      }
    });

    const result: SatpamTab[] = [];
    groupedBySatpam.forEach(entry => {
      let locationDisplay = "Beberapa Lokasi";
      const gedBaratCount = locationList.filter(l => l.posisi_gedung === 'Gedung Barat').length;
      const gedTimurCount = locationList.filter(l => l.posisi_gedung === 'Gedung Timur').length;

      if (entry.assignedLocationIds.size === locationList.length && locationList.length > 0) locationDisplay = "Semua Gedung";
      else if (entry.assignedLocationIds.size === gedBaratCount) locationDisplay = "Gedung Barat";
      else if (entry.assignedLocationIds.size === gedTimurCount) locationDisplay = "Gedung Timur";

      result.push({
        satpamId: entry.satpamId,
        satpamName: entry.satpamName,
        locationDisplay: locationDisplay,
        locationsStatus: entry.locationsStatus.sort((a: any, b: any) => a.location.name.localeCompare(b.location.name)),
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
    <div className="w-full max-w-5xl mx-auto relative group space-y-6">
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
                <CardTitle className="text-2xl font-extrabold tracking-wider text-white">MONITORING SUPERVISOR</CardTitle>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">Pemantauan Patroli & APAR</p>
              </div>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-mono text-xs border-slate-800/80 bg-slate-900/40 text-white hover:bg-slate-800/80">
                  <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400" />
                  {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-950 border-slate-800" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="bg-slate-950 text-white border-slate-800" />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <Tabs defaultValue={satpamTabs[0]?.satpamId} className="w-full">
            <TabsList className="flex flex-wrap gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-1.5 mb-6">
              {satpamTabs.map((satpamTab) => (
                <TabsTrigger 
                  key={satpamTab.satpamId} 
                  value={satpamTab.satpamId}
                  className="rounded-xl font-mono text-xs uppercase px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white"
                >
                  {satpamTab.satpamName}
                </TabsTrigger>
              ))}
            </TabsList>

            {satpamTabs.map((satpamTab) => (
              <TabsContent key={satpamTab.satpamId} value={satpamTab.satpamId} className="space-y-4 animate-fade-in">
                <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/20">
                  <Table>
                    <TableHeader className="bg-slate-900/50">
                      <TableRow className="border-b border-slate-800/80 hover:bg-transparent">
                        <TableHead className="text-slate-300 font-mono uppercase text-center py-4">Lokasi</TableHead>
                        <TableHead className="text-slate-300 font-mono uppercase text-center py-4">Gedung</TableHead>
                        <TableHead className="text-slate-300 font-mono uppercase text-center py-4">Status</TableHead>
                        <TableHead className="text-slate-300 font-mono uppercase text-center py-4">Waktu Cek</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {satpamTab.locationsStatus.map((status) => (
                        <TableRow key={status.location.id} className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
                          <TableCell className="font-medium text-white text-center py-4">{status.location.name}</TableCell>
                          <TableCell className="text-slate-300 text-center py-4">{status.location.posisi_gedung || '-'}</TableCell>
                          <TableCell className="text-center py-4">
                            <Badge className={status.isCheckedToday ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}>
                              {status.isCheckedToday ? "SELESAI" : "BELUM DICEK"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300 text-center py-4 font-mono">{status.lastCheckedAt || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupervisorDashboard;