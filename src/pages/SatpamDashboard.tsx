import React, { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge'; // Import Badge component
import { Input } from '@/components/ui/input'; // Import Input component
import { format } from 'date-fns'; // Import format from date-fns

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  isCheckedToday?: boolean; // Menambahkan properti baru
}

interface CheckAreaReport {
  location_id: string;
  created_at: string;
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [isSatpam, setIsSatpam] = useState(false);
  const [isScheduledToday, setIsScheduledToday] = useState(false); // State baru untuk status jadwal
  const [searchQuery, setSearchQuery] = useState(''); // State baru untuk query pencarian

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchLocations = async () => {
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

        // Calculate the "checking day" based on 06:00 AM GMT+7
        const now = new Date();
        const offsetGMT7ToUTC = 7; // GMT+7 is 7 hours ahead of UTC

        // Get current time in GMT+7
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (offsetGMT7ToUTC * 60 * 60 * 1000));

        let targetScheduleDate = new Date(currentGMT7Time);
        // If current GMT+7 time is before 6 AM, the schedule for "today" actually refers to yesterday's calendar date
        if (currentGMT7Time.getHours() < 6) {
          targetScheduleDate.setDate(targetScheduleDate.getDate() - 1);
        }
        
        // Format this target date to YYYY-MM-DD for the database query
        const formattedTargetScheduleDate = format(targetScheduleDate, 'yyyy-MM-dd');
        console.log("SatpamDashboard: Checking schedule for user", user.id, "on date (GMT+7 adjusted):", formattedTargetScheduleDate);

        // --- NEW: Check if the user is scheduled for today ---
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('id')
          .eq('user_id', user.id)
          .eq('schedule_date', formattedTargetScheduleDate) // Directly query the date
          .limit(1);

        if (scheduleError) {
          console.error("SatpamDashboard: Error fetching schedule for user:", scheduleError);
          toast.error("Gagal memuat jadwal Anda.");
          setLoadingLocations(false);
          return;
        }

        console.log("SatpamDashboard: Schedule data for user", user.id, "on", formattedTargetScheduleDate, ":", scheduleData);

        if (!scheduleData || scheduleData.length === 0) {
          setIsScheduledToday(false);
          setLoadingLocations(false);
          toast.info("Anda tidak memiliki jadwal tugas untuk hari ini.");
          return; // Stop here if not scheduled
        }
        setIsScheduledToday(true); // User is scheduled, proceed to fetch locations

        // Fetch locations
        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, created_at')
          .order('name', { ascending: true });

        if (locationsError) {
          console.error("Error fetching locations:", locationsError);
          toast.error("Gagal memuat daftar lokasi.");
          setLoadingLocations(false);
          return;
        }

        // Fetch reports for the current user within the defined "checking day"
        // For reports, we still need the full timestamp range
        const startOfCheckingDayUTC = new Date(startOfCheckingDayGMT7.getTime() - (offsetGMT7ToUTC * 60 * 60 * 1000));
        const endOfCheckingDayUTC = new Date(startOfCheckingDayUTC.getTime() + (24 * 60 * 60 * 1000));

        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select('location_id, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startOfCheckingDayUTC.toISOString())
          .lt('created_at', endOfCheckingDayUTC.toISOString());

        if (reportsError) {
          console.error("Error fetching reports:", reportsError);
          toast.error("Gagal memuat laporan cek area.");
          setLoadingLocations(false);
          return;
        }

        const checkedLocationIds = new Set(reportsData?.map(report => report.location_id));

        const locationsWithStatus = locationsData.map(loc => ({
          ...loc,
          isCheckedToday: checkedLocationIds.has(loc.id),
        }));

        setLocations(locationsWithStatus);
        setLoadingLocations(false);
      } else {
        toast.error("Akses ditolak. Anda bukan satpam.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchLocations();
  }, [session, sessionLoading, user, navigate]);

  const handleScanLocation = (locationId: string) => {
    navigate(`/scan-location?id=${locationId}`);
  };

  // Filtered locations based on search query
  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (sessionLoading || loadingLocations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard satpam...</p>
      </div>
    );
  }

  if (!isSatpam) {
    return null; // Akan dialihkan oleh useEffect jika bukan satpam
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-3xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Satpam</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="text-xl font-semibold mb-4 text-center">Daftar Lokasi Cek Area</h3>
          {!isScheduledToday ? (
            <p className="text-center text-lg text-red-500 dark:text-red-400">
              Anda tidak memiliki jadwal tugas untuk hari ini.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Cari lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              {filteredLocations.length === 0 ? (
                <p className="text-center text-gray-600 dark:text-gray-400">
                  {searchQuery ? "Tidak ada lokasi yang cocok dengan pencarian Anda." : "Belum ada lokasi yang terdaftar."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">Nama Lokasi</TableHead>
                        <TableHead className="w-[150px] text-center">Status Cek Hari Ini</TableHead>
                        <TableHead className="text-center w-[120px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLocations.map((loc) => (
                        <TableRow key={loc.id}>
                          <TableCell className="font-medium text-center">{loc.name}</TableCell>
                          <TableCell className="w-[150px] text-center">
                            {loc.isCheckedToday ? (
                              <Badge className="bg-green-500 hover:bg-green-500">Sudah Dicek</Badge>
                            ) : (
                              <Badge variant="destructive">Belum Dicek</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center w-[120px]">
                            <Button
                              size="sm"
                              onClick={() => handleScanLocation(loc.id)}
                              disabled={loc.isCheckedToday}
                            >
                              {loc.isCheckedToday ? "Sudah Dicek" : "Cek Lokasi"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamDashboard;