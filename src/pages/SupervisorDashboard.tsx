import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface LocationWithStatus {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  isCheckedToday: boolean;
  lastReportedBy?: string;
  lastReportedTime?: string;
  lastReportPhotoUrl?: string;
}

const SupervisorDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [locationsWithStatus, setLocationsWithStatus] = useState<LocationWithStatus[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchReports = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role for Supervisor Dashboard:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/');
        return;
      }

      if (profileData?.role === 'atasan') {
        setIsSupervisor(true);

        // 1. Fetch all locations
        const { data: allLocationsData, error: allLocationsError } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, created_at')
          .order('name', { ascending: true });

        if (allLocationsError) {
          console.error("Error fetching all locations:", allLocationsError);
          toast.error(`Gagal memuat daftar lokasi: ${allLocationsError.message}`);
          setLoadingReports(false);
          return;
        }

        // 2. Calculate the "checking day" based on 06:00 AM GMT+7 for the selected date
        if (!selectedDate) {
          setLoadingReports(false);
          setLocationsWithStatus([]);
          return;
        }

        // Create a Date object representing 06:00 AM on the selected calendar date, in the *local* timezone.
        // The .toISOString() method will then correctly convert this local time to its UTC equivalent.
        const localStartOfCheckingDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 6, 0, 0);

        // The UTC start time for the "checking day" (06:00 AM GMT+7)
        const startOfCheckingDayUTC = localStartOfCheckingDay.toISOString();

        // The UTC end time for the "checking day" (24 hours after the start)
        const endOfCheckingDayUTC = new Date(localStartOfCheckingDay.getTime() + (24 * 60 * 60 * 1000)).toISOString();

        console.log(`SupervisorDashboard: Selected Date (Calendar): ${format(selectedDate, 'yyyy-MM-dd')}`);
        console.log(`SupervisorDashboard: Local Start of Checking Day (06:00 AM): ${localStartOfCheckingDay.toLocaleString()}`);
        console.log(`SupervisorDashboard: Supabase Query UTC Range: GTE ${startOfCheckingDayUTC} AND LT ${endOfCheckingDayUTC}`);


        // 3. Fetch reports for the selected "checking day"
        const { data: reportsTodayData, error: reportsTodayError } = await supabase
          .from('check_area_reports')
          .select(`
            id,
            location_id,
            photo_url,
            created_at,
            profiles (first_name, last_name)
          `)
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC)
          .order('created_at', { ascending: false });

        if (reportsTodayError) {
          console.error("Error fetching reports for selected date:", reportsTodayError);
          toast.error(`Gagal memuat laporan untuk tanggal ini: ${reportsTodayError.message}`);
          setLoadingReports(false);
          return;
        }

        // 4. Process and combine data
        const reportsMap = new Map<string, { reporter: string; time: string; photo: string }>();
        reportsTodayData.forEach(report => {
          console.log(`SupervisorDashboard: Fetched Report - Location ID: ${report.location_id}, Created At (UTC): ${report.created_at}`);
          if (!reportsMap.has(report.location_id) || new Date(report.created_at) > new Date(reportsMap.get(report.location_id)!.time)) {
            reportsMap.set(report.location_id, {
              reporter: report.profiles ? `${report.profiles.first_name} ${report.profiles.last_name}` : 'N/A',
              time: report.created_at,
              photo: report.photo_url,
            });
          }
        });

        const combinedLocations: LocationWithStatus[] = allLocationsData.map(loc => {
          const reportDetails = reportsMap.get(loc.id);
          return {
            ...loc,
            isCheckedToday: !!reportDetails,
            lastReportedBy: reportDetails?.reporter,
            lastReportedTime: reportDetails?.time,
            lastReportPhotoUrl: reportDetails?.photo,
          };
        });

        setLocationsWithStatus(combinedLocations);
        setLoadingReports(false);
      } else {
        toast.error("Akses ditolak. Anda bukan atasan.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchReports();
  }, [session, sessionLoading, user, navigate, selectedDate]);

  const handleViewPhoto = (url: string) => {
    console.log("SupervisorDashboard: Opening photo modal. URL:", url);
    setSelectedPhotoUrl(url);
    setIsPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    setSelectedPhotoUrl(null);
    setIsPhotoModalOpen(false);
  };

  if (sessionLoading || loadingReports) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard atasan...</p>
      </div>
    );
  }

  if (!isSupervisor) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-5xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Atasan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Daftar Laporan Cek Area</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: id }) : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
              </PopoverContent>
            </Popover>
          </div>
          {locationsWithStatus.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Belum ada lokasi yang terdaftar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lokasi</TableHead>
                  <TableHead>Status Cek {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: id }) : 'Hari Ini'}</TableHead>
                  <TableHead>Dilaporkan Oleh</TableHead>
                  <TableHead>Waktu Laporan Terakhir</TableHead>
                  <TableHead>Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationsWithStatus.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>
                      {loc.isCheckedToday ? (
                        <Badge className="bg-green-500 hover:bg-green-500">Sudah Dilaporkan</Badge>
                      ) : (
                        <Badge variant="destructive">Belum Dilaporkan</Badge>
                      )}
                    </TableCell>
                    <TableCell>{loc.lastReportedBy || '-'}</TableCell>
                    <TableCell>
                      {loc.lastReportedTime ? format(new Date(loc.lastReportedTime), 'dd MMMM yyyy HH:mm', { locale: id }) : '-'}
                    </TableCell>
                    <TableCell>
                      {loc.lastReportPhotoUrl ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleViewPhoto(loc.lastReportPhotoUrl!)}
                          className="p-0 h-auto text-blue-500 hover:underline"
                        >
                          Lihat Foto
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPhotoModalOpen} onOpenChange={handleClosePhotoModal}>
        <DialogContent className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Foto Laporan</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedPhotoUrl ? (
              <>
                <img 
                  src={selectedPhotoUrl} 
                  alt="Laporan Cek Area" 
                  className="max-w-full max-h-[70vh] h-auto rounded-md object-contain" 
                />
                {console.log("SupervisorDashboard: Image source in modal:", selectedPhotoUrl)}
              </>
            ) : (
              <p>Tidak ada foto untuk ditampilkan.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorDashboard;