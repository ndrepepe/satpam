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
// Hapus import Tabs, TabsContent, TabsList, TabsTrigger
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
// Import komponen Select baru
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface SatpamDisplayData { // Mengganti nama interface agar lebih jelas
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
  const [selectedSatpamIdForDisplay, setSelectedSatpamIdForDisplay] = useState<string | undefined>(undefined); // State baru untuk dropdown

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
        setLocationList(locData as Location[]);

        const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        // Fetch schedules for the selected date - FILTER SERVER-SIDE
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
          .eq('schedule_date', formattedDate); // <-- SERVER-SIDE FILTERING

        if (scheduleError) throw scheduleError;
        setSchedules(scheduleData as unknown as ScheduleEntry[]); // Cast to unknown first

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

  const allSatpamDisplayData: SatpamDisplayData[] = useMemo(() => {
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
        const report = reports.find(r => r.user_id === satpamId && r.location_id === location.id);
        
        satpamEntry.locationsStatus.push({
          location: location,
          isCheckedToday: !!report,
          lastCheckedAt: report ? format(new Date(report.created_at), 'HH:mm', { locale: idLocale }) : null,
          photoUrl: report?.photo_url || null,
        });
      }
    });

    const result: SatpamDisplayData[] = [];
    groupedBySatpam.forEach(entry => {
      let locationDisplay: string;
      const allLocationsInDb = locationList.map(loc => loc.id);
      const gedungBaratLocationsInDb = locationList.filter(loc => loc.posisi_gedung === 'Gedung Barat').map(loc => loc.id);
      const gedungTimurLocationsInDb = locationList.filter(loc => loc.posisi_gedung === 'Gedung Timur').map(loc => loc.id);

      const assignedIdsArray = Array.from(entry.assignedLocationIds).sort();

      const isAssignedToAllLocations = allLocationsInDb.length > 0 && 
                                       assignedIdsArray.length === allLocationsInDb.length &&
                                       assignedIdsArray.every(id => allLocationsInDb.includes(id));

      const isAssignedToAllGedungBarat = gedungBaratLocationsInDb.length > 0 &&
                                         assignedIdsArray.length === gedungBaratLocationsInDb.length &&
                                         assignedIdsArray.every(id => gedungBaratLocationsInDb.includes(id));

      const isAssignedToAllGedungTimur = gedungTimurLocationsInDb.length > 0 &&
                                         assignedIdsArray.length === gedungTimurLocationsInDb.length &&
                                         assignedIdsArray.every(id => gedungTimurLocationsInDb.includes(id));

      if (isAssignedToAllLocations) {
        locationDisplay = "Semua Gedung";
      } else if (isAssignedToAllGedungBarat) {
        locationDisplay = "Gedung Barat";
      } else if (isAssignedToAllGedungTimur) {
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

    const sortedResult = result.sort((a, b) => a.satpamName.localeCompare(b.satpamName));

    // Set default selected satpam if not already set and there are results
    if (sortedResult.length > 0 && selectedSatpamIdForDisplay === undefined) {
      setSelectedSatpamIdForDisplay(sortedResult[0].satpamId);
    } else if (sortedResult.length === 0 && selectedSatpamIdForDisplay !== undefined) {
      setSelectedSatpamIdForDisplay(undefined); // Clear if no satpam
    } else if (selectedSatpamIdForDisplay && !sortedResult.some(tab => tab.satpamId === selectedSatpamIdForDisplay)) {
      // If the previously selected satpam is no longer in the list, reset to first or undefined
      setSelectedSatpamIdForDisplay(sortedResult.length > 0 ? sortedResult[0].satpamId : undefined);
    }

    return sortedResult;
  }, [schedules, reports, locationList, selectedSatpamIdForDisplay]); // Tambahkan selectedSatpamIdForDisplay sebagai dependensi

  const currentSelectedSatpamTab = useMemo(() => {
    return allSatpamDisplayData.find(tab => tab.satpamId === selectedSatpamIdForDisplay);
  }, [allSatpamDisplayData, selectedSatpamIdForDisplay]);
  
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
          <div className="mb-4 flex flex-col sm:flex-row justify-center items-center gap-4"> {/* Tambahkan gap-4 untuk jarak */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal", // Sesuaikan lebar untuk responsif
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

            {/* Dropdown untuk memilih personel */}
            <Select onValueChange={setSelectedSatpamIdForDisplay} value={selectedSatpamIdForDisplay}>
              <SelectTrigger className="w-full sm:w-[280px]"> {/* Sesuaikan lebar untuk responsif */}
                <SelectValue placeholder="Pilih Personel Satpam" />
              </SelectTrigger>
              <SelectContent>
                {allSatpamDisplayData.map((satpam) => (
                  <SelectItem key={satpam.satpamId} value={satpam.satpamId}>
                    {satpam.satpamName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {allSatpamDisplayData.length === 0 ? (
            <p className="text-center text-lg text-gray-600 dark:text-gray-400">
              Tidak ada jadwal yang ditetapkan untuk tanggal {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : 'ini'}.
            </p>
          ) : (
            currentSelectedSatpamTab ? (
              <div className="mt-4"> {/* Jarak antara dropdown dan konten */}
                <h4 className="text-lg font-semibold mb-3">
                  Lokasi Tugas {currentSelectedSatpamTab.satpamName} ({currentSelectedSatpamTab.locationDisplay})
                </h4>
                {currentSelectedSatpamTab.locationsStatus.length === 0 ? (
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
                          <TableHead className="text-center">Foto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentSelectedSatpamTab.locationsStatus.map((status) => (
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
              </div>
            ) : (
              <p className="text-center text-lg text-gray-600 dark:text-gray-400">
                Pilih personel satpam dari dropdown untuk melihat jadwalnya.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupervisorDashboard;