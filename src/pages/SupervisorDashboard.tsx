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
import { id } from 'date-fns/locale'; // Import locale for Indonesian date formatting
import { Badge } from '@/components/ui/badge'; // Import Badge component

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

        // 2. Calculate the "checking day" based on 06:00 AM GMT+7
        const now = new Date();
        const offsetGMT7ToUTC = 7; // GMT+7 is 7 hours ahead of UTC

        const currentGMT7Date = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (offsetGMT7ToUTC * 60 * 60 * 1000));

        let startOfCheckingDayGMT7 = new Date(currentGMT7Date);
        startOfCheckingDayGMT7.setHours(6, 0, 0, 0);

        if (currentGMT7Date.getHours() < 6) {
          startOfCheckingDayGMT7.setDate(startOfCheckingDayGMT7.getDate() - 1);
        }

        const startOfCheckingDayUTC = new Date(startOfCheckingDayGMT7.getTime() - (offsetGMT7ToUTC * 60 * 60 * 1000));
        const endOfCheckingDayUTC = new Date(startOfCheckingDayUTC.getTime() + (24 * 60 * 60 * 1000));

        // 3. Fetch reports for the current "checking day"
        const { data: reportsTodayData, error: reportsTodayError } = await supabase
          .from('check_area_reports')
          .select(`
            id,
            location_id,
            photo_url,
            created_at,
            profiles (first_name, last_name)
          `)
          .gte('created_at', startOfCheckingDayUTC.toISOString())
          .lt('created_at', endOfCheckingDayUTC.toISOString())
          .order('created_at', { ascending: false }); // Order to get the latest report if multiple

        if (reportsTodayError) {
          console.error("Error fetching reports for today:", reportsTodayError);
          toast.error(`Gagal memuat laporan hari ini: ${reportsTodayError.message}`);
          setLoadingReports(false);
          return;
        }

        // 4. Process and combine data
        const reportsMap = new Map<string, { reporter: string; time: string; photo: string }>();
        reportsTodayData.forEach(report => {
          // Only store the latest report for each location if multiple exist
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
  }, [session, sessionLoading, user, navigate]);

  const handleViewPhoto = (url: string) => {
    setSelectedPhotoUrl(url);
    setIsPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    setIsPhotoModalOpen(false);
    setSelectedPhotoUrl(null);
  };

  if (sessionLoading || loadingReports) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard atasan...</p>
      </div>
    );
  }

  if (!isSupervisor) {
    return null; // Akan dialihkan oleh useEffect jika bukan atasan
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-5xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Atasan</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="text-xl font-semibold mb-4">Daftar Laporan Cek Area</h3>
          {locationsWithStatus.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Belum ada lokasi yang terdaftar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lokasi</TableHead>
                  <TableHead>Status Cek Hari Ini</TableHead>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Foto Laporan</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedPhotoUrl && (
              <img src={selectedPhotoUrl} alt="Laporan Cek Area" className="max-w-full h-auto rounded-md" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorDashboard;