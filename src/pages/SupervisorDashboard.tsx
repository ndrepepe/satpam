import React, { useEffect, useState, useMemo } from 'react';
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
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReportEntry {
  id: string;
  location_id: string;
  photo_url: string;
  created_at: string;
  user_id: string; // Tambahkan user_id untuk filtering
  profiles: { id: string; first_name: string; last_name: string } | null; // Tambahkan id di profiles
  locations: { name: string } | null;
}

interface SatpamOnDuty {
  id: string;
  name: string;
}

const SupervisorDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [allReports, setAllReports] = useState<ReportEntry[]>([]); // Semua laporan untuk tanggal yang dipilih
  const [loadingReports, setLoadingReports] = useState(true);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState<string>('all'); // 'all' atau user_id satpam
  const [satpamOnDuty, setSatpamOnDuty] = useState<SatpamOnDuty[]>([]); // Daftar satpam yang bertugas

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
          setAllReports([]);
          setSatpamOnDuty([]);
          return;
        }

        const localStartOfCheckingDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 6, 0, 0);
        const startOfCheckingDayUTC = localStartOfCheckingDay.toISOString();
        const endOfCheckingDayUTC = new Date(localStartOfCheckingDay.getTime() + (24 * 60 * 60 * 1000)).toISOString();

        setLoadingReports(true);
        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select(`
            id,
            location_id,
            photo_url,
            created_at,
            user_id,
            profiles (id, first_name, last_name),
            locations (name)
          `)
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC)
          .order('created_at', { ascending: false });

        if (reportsError) {
          console.error("Error fetching reports for selected date:", reportsError);
          toast.error(`Gagal memuat laporan untuk tanggal ini: ${reportsError.message}`);
          setLoadingReports(false);
          return;
        }

        setAllReports(reportsData);

        // Extract unique satpam who made reports
        const uniqueSatpam = new Map<string, SatpamOnDuty>();
        reportsData.forEach(report => {
          if (report.profiles && !uniqueSatpam.has(report.profiles.id)) {
            uniqueSatpam.set(report.profiles.id, {
              id: report.profiles.id,
              name: `${report.profiles.first_name} ${report.profiles.last_name}`,
            });
          }
        });
        setSatpamOnDuty(Array.from(uniqueSatpam.values()));
        setLoadingReports(false);
      } else {
        toast.error("Akses ditolak. Anda bukan atasan.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchReports();
  }, [session, sessionLoading, user, navigate, selectedDate]);

  const handleViewPhoto = (url: string) => {
    setSelectedPhotoUrl(url);
    setIsPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    setSelectedPhotoUrl(null);
    setIsPhotoModalOpen(false);
  };

  const filteredReports = useMemo(() => {
    if (activeTab === 'all') {
      return allReports;
    }
    return allReports.filter(report => report.user_id === activeTab);
  }, [allReports, activeTab]);

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
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <h3 className="text-xl font-semibold">Laporan Cek Area</h3>
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
          
          {allReports.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">
              Tidak ada laporan cek area untuk tanggal {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: id }) : 'yang dipilih'}.
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                <TabsTrigger value="all">Semua Laporan</TabsTrigger>
                {satpamOnDuty.map(satpam => (
                  <TabsTrigger key={satpam.id} value={satpam.id}>
                    {satpam.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personel</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Waktu Laporan</TableHead>
                      <TableHead>Foto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map(report => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.profiles ? `${report.profiles.first_name} ${report.profiles.last_name}` : 'N/A'}
                        </TableCell>
                        <TableCell>{report.locations?.name || 'N/A'}</TableCell>
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
              </TabsContent>
            </Tabs>
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
              <img 
                src={selectedPhotoUrl} 
                alt="Laporan Cek Area" 
                className="max-w-full max-h-[70vh] h-auto rounded-md object-contain" 
              />
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