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
import { Badge } from '@/components/ui/badge';

interface SatpamProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Location {
  id: string;
  name: string;
}

interface ScheduleEntry {
  user_id: string;
  location_id: string;
}

interface ReportEntry {
  id: string;
  location_id: string;
  photo_url: string;
  created_at: string;
  user_id: string;
}

interface LocationStatus {
  locationId: string;
  locationName: string;
  status: 'Sudah Dicek' | 'Belum Dicek';
  reportTime: string | null;
  photoUrl: string | null;
}

interface SatpamTabContent {
  satpamId: string;
  satpamName: string;
  locationsStatus: LocationStatus[];
}

const SupervisorDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [satpamTabContents, setSatpamTabContents] = useState<SatpamTabContent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState<string>(''); // Will be set to the first satpam's ID

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
        console.error("Error fetching profile role for Supervisor Dashboard:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/');
        return;
      }

      if (profileData?.role === 'atasan') {
        setIsSupervisor(true);

        if (!selectedDate) {
          setLoadingData(false);
          setSatpamTabContents([]);
          setActiveTab('');
          return;
        }

        setLoadingData(true);
        try {
          // Calculate the "checking day" based on 06:00 AM GMT+7
          const localStartOfCheckingDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 6, 0, 0);
          const startOfCheckingDayUTC = localStartOfCheckingDay.toISOString();
          const endOfCheckingDayUTC = new Date(localStartOfCheckingDay.getTime() + (24 * 60 * 60 * 1000)).toISOString();

          // 1. Fetch all necessary data concurrently
          const [profilesRes, locationsRes, schedulesRes, reportsRes] = await Promise.all([
            supabase.from('profiles').select('id, first_name, last_name, role'),
            supabase.from('locations').select('id, name'),
            supabase.from('schedules').select('user_id, location_id').eq('schedule_date', format(selectedDate, 'yyyy-MM-dd')),
            supabase.from('check_area_reports').select('user_id, location_id, photo_url, created_at')
              .gte('created_at', startOfCheckingDayUTC)
              .lt('created_at', endOfCheckingDayUTC),
          ]);

          if (profilesRes.error) throw profilesRes.error;
          if (locationsRes.error) throw locationsRes.error;
          if (schedulesRes.error) throw schedulesRes.error;
          if (reportsRes.error) throw reportsRes.error;

          const allProfiles: SatpamProfile[] = profilesRes.data;
          const allLocations: Location[] = locationsRes.data;
          const schedulesForDate: ScheduleEntry[] = schedulesRes.data;
          const reportsForDate: ReportEntry[] = reportsRes.data;

          // Create maps for quick lookups
          const profileMap = new Map(allProfiles.map(p => [p.id, p]));
          const locationMap = new Map(allLocations.map(l => [l.id, l.name]));

          // Group reports by user and location for easy lookup
          const checkedStatusMap = new Map<string, { photoUrl: string; reportTime: string }>(); // Key: `${userId}-${locationId}`
          reportsForDate.forEach(report => {
            checkedStatusMap.set(`${report.user_id}-${report.location_id}`, {
              photoUrl: report.photo_url,
              reportTime: report.created_at,
            });
          });

          // Determine unique satpam on duty from schedules
          const satpamOnDutyIds = new Set<string>();
          schedulesForDate.forEach(s => satpamOnDutyIds.add(s.user_id));

          const newSatpamTabContents: SatpamTabContent[] = [];

          satpamOnDutyIds.forEach(satpamId => {
            const satpamProfile = profileMap.get(satpamId);
            if (!satpamProfile || satpamProfile.role !== 'satpam') return; // Ensure it's a satpam profile

            const satpamName = `${satpamProfile.first_name} ${satpamProfile.last_name}`;

            const locationsAssignedToThisSatpam = schedulesForDate.filter(s => s.user_id === satpamId);
            const locationsStatus: LocationStatus[] = [];

            // Get unique locations assigned to this satpam for the day
            const uniqueAssignedLocationIds = new Set(locationsAssignedToThisSatpam.map(s => s.location_id));

            uniqueAssignedLocationIds.forEach(locationId => {
              const locationName = locationMap.get(locationId) || 'Lokasi Tidak Dikenal';
              const checkInfo = checkedStatusMap.get(`${satpamId}-${locationId}`);

              locationsStatus.push({
                locationId,
                locationName,
                status: checkInfo ? 'Sudah Dicek' : 'Belum Dicek',
                reportTime: checkInfo?.reportTime || null,
                photoUrl: checkInfo?.photoUrl || null,
              });
            });

            // Sort locations alphabetically by name
            locationsStatus.sort((a, b) => a.locationName.localeCompare(b.locationName));

            newSatpamTabContents.push({
              satpamId,
              satpamName,
              locationsStatus,
            });
          });

          // Sort satpam tabs by name
          newSatpamTabContents.sort((a, b) => a.satpamName.localeCompare(b.satpamName));

          setSatpamTabContents(newSatpamTabContents);
          // Set active tab to the first satpam if available
          if (newSatpamTabContents.length > 0 && activeTab === '') { // Only set if no tab is active yet
            setActiveTab(newSatpamTabContents[0].satpamId);
          } else if (newSatpamTabContents.length > 0 && !newSatpamTabContents.some(tab => tab.satpamId === activeTab)) {
            // If current active tab is no longer valid (e.g., satpam not on duty today), reset to first
            setActiveTab(newSatpamTabContents[0].satpamId);
          } else if (newSatpamTabContents.length === 0) {
            setActiveTab(''); // No satpam on duty, no active tab
          }

        } catch (error: any) {
          toast.error(`Gagal memuat data: ${error.message}`);
          console.error("Error fetching data for Supervisor Dashboard:", error);
        } finally {
          setLoadingData(false);
        }
      } else {
        toast.error("Akses ditolak. Anda bukan atasan.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchData();
  }, [session, sessionLoading, user, navigate, selectedDate, activeTab]); // Added activeTab to dependencies to re-evaluate tab selection

  const handleViewPhoto = (url: string) => {
    setSelectedPhotoUrl(url);
    setIsPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    setSelectedPhotoUrl(null);
    setIsPhotoModalOpen(false);
  };

  if (sessionLoading || loadingData) {
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
            <h3 className="text-xl font-semibold">Status Cek Area per Personel</h3>
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
          
          {satpamTabContents.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">
              Tidak ada personel yang bertugas atau laporan cek area untuk tanggal {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: id }) : 'yang dipilih'}.
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {satpamTabContents.map(satpamTab => (
                  <TabsTrigger key={satpamTab.satpamId} value={satpamTab.satpamId}>
                    {satpamTab.satpamName}
                  </TabsTrigger>
                ))}
              </TabsList>
              {satpamTabContents.map(satpamTab => (
                <TabsContent key={satpamTab.satpamId} value={satpamTab.satpamId} className="mt-4">
                  <h4 className="text-lg font-semibold mb-3">Lokasi Tugas {satpamTab.satpamName}</h4>
                  {satpamTab.locationsStatus.length === 0 ? (
                    <p className="text-center text-gray-600 dark:text-gray-400">
                      Tidak ada lokasi yang ditugaskan untuk personel ini pada tanggal ini.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lokasi</TableHead>
                          <TableHead>Status Cek</TableHead>
                          <TableHead>Waktu Laporan</TableHead>
                          <TableHead>Foto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {satpamTab.locationsStatus.map(locStatus => (
                          <TableRow key={locStatus.locationId}>
                            <TableCell className="font-medium">{locStatus.locationName}</TableCell>
                            <TableCell>
                              <Badge variant={locStatus.status === 'Sudah Dicek' ? 'default' : 'destructive'}>
                                {locStatus.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {locStatus.reportTime ? format(new Date(locStatus.reportTime), 'HH:mm', { locale: id }) : '-'}
                            </TableCell>
                            <TableCell>
                              {locStatus.photoUrl ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => handleViewPhoto(locStatus.photoUrl!)}
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
                </TabsContent>
              ))}
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