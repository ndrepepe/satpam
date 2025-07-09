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
import { Calendar as CalendarIcon } from 'lucide-react';
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
  profiles: { first_name: string; last_name: string; id_number?: string } | null;
  locations: { name: string; posisi_gedung?: string | null } | null;
}

interface SatpamTab {
  satpamId: string;
  satpamName: string;
  locationDisplay: string;
  locationsStatus: {
    location: Location;
    isCheckedToday: boolean;
    lastCheckedAt: string | null;
    photoUrl: string | null; // Menambahkan photoUrl di sini
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
        // Fetch all locations first, needed for locationDisplay logic
        const { data: locData, error: locError } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, posisi_gedung');
        if (locError) throw locError;
        setLocationList(locData);

        const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        // Fetch schedules for the selected date
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select(`
            id,
            schedule_date,
            user_id,
            location_id,
            profiles (first_name, last_name, id_number),
            locations (name, posisi_gedung)
          `)
          .eq('schedule_date', formattedDate);

        if (scheduleError) throw scheduleError;
        setSchedules(scheduleData);

        // Calculate the "checking day" based on 06:00 AM GMT+7 for reports
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

        // Fetch reports for the determined "checking day"
        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select('location_id, user_id, created_at, photo_url')
          .gte('created_at', startOfCheckingDayUTC) // Filter by date range
          .lt('created_at', endOfCheckingDayUTC); // Filter by date range

        if (reportsError) throw reportsError;
        setReports(reportsData);

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
        photoUrl: string | null; // Menambahkan photoUrl di sini
      }[];
    }>();

    schedules.forEach(schedule => {
      const satpamId = schedule.user_id;
      const satpamName = schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'N/A';
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
        // Find the report for this specific user and location on the selected date
        const report = reports.find(r => r.user_id === satpamId && r.location_id === location.id);
        
        satpamEntry.locationsStatus.push({
          location: location,
          isCheckedToday: !!report,
          lastCheckedAt: report ? format(new Date(report.created_at), 'HH:mm', { locale: idLocale }) : null,
          photoUrl: report?.photo_url || null, // Ambil photo_url dari laporan
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
        locationDisplay = "Beberapa Lokasi"; // Mixed or partial assignment
      } else {
        locationDisplay = "Tidak Ditugaskan"; // No locations assigned for this satpam on this date
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard supervisor...</p>
      </div>
    );
  }

  if (!isSupervisor) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Supervisor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {satpamTabs.length === 0 ? (
            <p className="text-center text-lg text-gray-600 dark:text-gray-400">
              Tidak ada jadwal yang ditetapkan untuk tanggal {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : 'ini'}.
            </p>
          ) : (
            <Tabs defaultValue={satpamTabs[0]?.satpamId} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {satpamTabs.map((satpamTab) => (
                  <TabsTrigger key={satpamTab.satpamId} value={satpamTab.satpamId}>
                    {satpamTab.satpamName}
                  </TabsTrigger>
                ))}
              </TabsList>
              {satpamTabs.map((satpamTab) => (
                <TabsContent key={satpamTab.satpamId} value={satpamTab.satpamId} className="mt-4">
                  <h4 className="text-lg font-semibold mb-3">
                    Lokasi Tugas {satpamTab.satpamName} ({satpamTab.locationDisplay})
                  </h4>
                  {satpamTab.locationsStatus.length === 0 ? (
                    <p className="text-center text-gray-600 dark:text-gray-400">
                      Tidak ada lokasi yang ditugaskan untuk personel ini pada tanggal ini.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center">Nama Lokasi</TableHead>
                            <TableHead className="text-center">Posisi Gedung</TableHead>
                            <TableHead className="text-center">Status Cek</TableHead>
                            <TableHead className="text-center">Terakhir Dicek</TableHead>
                            <TableHead className="text-center">Foto</TableHead> {/* Kolom Foto baru */}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {satpamTab.locationsStatus.map((status) => (
                            <TableRow key={status.location.id}>
                              <TableCell className="font-medium text-center">{status.location.name}</TableCell>
                              <TableCell className="text-center">{status.location.posisi_gedung || 'N/A'}</TableCell>
                              <TableCell className="text-center">
                                {status.isCheckedToday ? (
                                  <Badge className="bg-green-500 hover:bg-green-500">Sudah Dicek</Badge>
                                ) : (
                                  <Badge variant="destructive">Belum Dicek</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">{status.lastCheckedAt || '-'}</TableCell>
                              <TableCell className="text-center">
                                {status.photoUrl ? (
                                  <a 
                                    href={status.photoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline"
                                  >
                                    Lihat Foto
                                  </a>
                                ) : (
                                  '-'
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