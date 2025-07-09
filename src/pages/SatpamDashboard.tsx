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
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  posisi_gedung: string | null; // Diperbarui: Tidak lagi opsional, tetapi bisa null
}

interface ScheduleEntry {
  id: string;
  schedule_date: string;
  user_id: string;
  location_id: string;
  profiles: { first_name: string; last_name: string; id_number?: string }[] | null;
  locations: Location[] | null;
}

interface CheckAreaReport {
  location_id: string;
  created_at: string;
  user_id: string;
  photo_url: string;
}

interface LocationStatus {
  location: Location;
  isCheckedToday: boolean;
  lastCheckedAt: string | null;
  photoUrl: string | null;
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSatpam, setIsSatpam] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [assignedLocations, setAssignedLocations] = useState<Location[]>([]);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [reports, setReports] = useState<CheckAreaReport[]>([]);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchData = async () => {
      setLoadingData(true);
      try {
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

        if (profileData?.role === 'satpam') {
          setIsSatpam(true);
          await fetchSatpamData(user.id);
        } else {
          toast.error("Akses ditolak. Anda bukan satpam.");
          navigate('/');
        }
      } catch (error: any) {
        toast.error(`Terjadi kesalahan: ${error.message}`);
        console.error("Error in checkUserRoleAndFetchData:", error);
      } finally {
        setLoadingData(false);
      }
    };

    const fetchSatpamData = async (userId: string) => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch schedules for the current user for today
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select(`
          id,
          schedule_date,
          user_id,
          location_id,
          locations (id, name, qr_code_data, posisi_gedung)
        `)
        .eq('user_id', userId)
        .eq('schedule_date', today);

      if (scheduleError) throw scheduleError;

      if (scheduleData && scheduleData.length > 0) {
        setIsScheduledToday(true);
        // Menggunakan type predicate yang lebih sederhana karena `locations` sekarang sudah bertipe `Location[]`
        const locations = scheduleData.map(s => s.locations?.[0]).filter((loc): loc is Location => loc !== null && loc !== undefined);
        setAssignedLocations(locations);

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

        // Fetch reports for the determined "checking day" and current user
        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select('location_id, user_id, created_at, photo_url')
          .eq('user_id', userId)
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC);

        if (reportsError) throw reportsError;
        setReports(reportsData as CheckAreaReport[]);

      } else {
        setIsScheduledToday(false);
        setAssignedLocations([]);
        setReports([]);
      }
    };

    checkUserRoleAndFetchData();
  }, [session, sessionLoading, user, navigate]);

  const locationsStatus: LocationStatus[] = useMemo(() => {
    if (!user || !assignedLocations || assignedLocations.length === 0) {
      return [];
    }

    const todayReports = reports.filter(r => r.user_id === user.id);

    return assignedLocations.map(assignedLoc => {
      const report = todayReports.find(r => r.location_id === assignedLoc.id);
      return {
        location: assignedLoc,
        isCheckedToday: !!report,
        lastCheckedAt: report ? format(new Date(report.created_at), 'HH:mm', { locale: idLocale }) : null,
        photoUrl: report?.photo_url || null,
      };
    }).sort((a, b) => a.location.name.localeCompare(b.location.name));
  }, [assignedLocations, reports, user]);

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard satpam...</p>
      </div>
    );
  }

  if (!isSatpam) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Satpam</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="text-xl font-semibold mb-4 text-center">Daftar Lokasi Cek Area</h3>
          {!isScheduledToday ? (
            <p className="text-center text-lg text-red-500 dark:text-red-400">
              Anda tidak memiliki jadwal tugas hari ini.
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
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationsStatus.map((status) => (
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
                      <TableCell className="text-right">
                        <Button
                          onClick={() => navigate('/scan-location', { state: { locationId: status.location.id } })}
                          disabled={status.isCheckedToday}
                        >
                          {status.isCheckedToday ? 'Sudah Dicek' : 'Cek Lokasi'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamDashboard;