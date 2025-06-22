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

interface ReportEntry {
  id: string;
  location_id: string;
  photo_url: string;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
  locations: { name: string } | null;
}

interface GroupedReports {
  [userId: string]: {
    satpamName: string;
    reports: ReportEntry[];
  };
}

const SupervisorDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [groupedReports, setGroupedReports] = useState<GroupedReports>({});
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

        if (!selectedDate) {
          setLoadingReports(false);
          setGroupedReports({});
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

        // Fetch all reports for the selected "checking day"
        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select(`
            id,
            location_id,
            photo_url,
            created_at,
            profiles (first_name, last_name),
            locations (name)
          `)
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC)
          .order('created_at', { ascending: false }); // Order by latest report first

        if (reportsError) {
          console.error("Error fetching reports for selected date:", reportsError);
          toast.error(`Gagal memuat laporan untuk tanggal ini: ${reportsError.message}`);
          setLoadingReports(false);
          return;
        }

        // Group reports by user
        const newGroupedReports: GroupedReports = {};
        reportsData.forEach(report => {
          const userId = report.profiles?.id || 'unknown'; // Assuming profiles has an id
          const satpamName = report.profiles ? `${report.profiles.first_name} ${report.profiles.last_name}` : 'Satpam Tidak Dikenal';

          if (!newGroupedReports[userId]) {
            newGroupedReports[userId] = {
              satpamName: satpamName,
              reports: [],
            };
          }
          newGroupedReports[userId].reports.push(report);
        });

        setGroupedReports(newGroupedReports);
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

  const satpamIds = Object.keys(groupedReports);

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-5xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Atasan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <h3 className="text-xl font-semibold">Laporan Cek Area per Satpam</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
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
          
          {satpamIds.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">
              Tidak ada laporan cek area untuk tanggal {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: id }) : 'yang dipilih'}.
            </p>
          ) : (
            <div className="space-y-8">
              {satpamIds.map(userId => {
                const satpamGroup = groupedReports[userId];
                return (
                  <Card key={userId} className="border-2 border-gray-200 dark:border-gray-700">
                    <CardHeader className="bg-gray-50 dark:bg-gray-700 py-3 px-4 rounded-t-lg">
                      <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        Personel: {satpamGroup.satpamName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lokasi</TableHead>
                            <TableHead>Waktu Laporan</TableHead>
                            <TableHead>Foto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {satpamGroup.reports.map(report => (
                            <TableRow key={report.id}>
                              <TableCell className="font-medium">{report.locations?.name || 'N/A'}</TableCell>
                              <TableCell>
                                {format(new Date(report.created_at), 'dd MMMM yyyy HH:mm', { locale: id })}
                              </TableCell>
                              <TableCell>
                                {report.photo_url ? (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => handleViewPhoto(report.photo_url!)}
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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