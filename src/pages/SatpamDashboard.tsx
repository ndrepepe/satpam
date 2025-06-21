import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
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
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  isCheckedToday?: boolean;
}

interface CheckAreaReport {
  location_id: string;
  created_at: string;
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const location = useLocation(); // Initialize useLocation
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [isSatpam, setIsSatpam] = useState(false);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0); // New state for refresh

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    // Check if navigated from CheckAreaReport with refresh state
    if (location.state?.refresh) {
      setRefreshTrigger(prev => prev + 1);
      // Clear the state so it doesn't trigger on subsequent visits without a new report
      navigate(location.pathname, { replace: true, state: {} }); 
    }

    const checkUserRoleAndFetchLocations = async () => {
      setLoadingLocations(true); // Set loading true at the start of fetch
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/');
        setLoadingLocations(false); // Ensure loading is false on error
        return;
      }

      if (profileData?.role === 'satpam') {
        setIsSatpam(true);

        const now = new Date();
        const offsetGMT7ToUTC = 7; 
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (offsetGMT7ToUTC * 60 * 60 * 1000));

        let startOfCheckingDayGMT7 = new Date(currentGMT7Time);
        startOfCheckingDayGMT7.setHours(6, 0, 0, 0);

        if (currentGMT7Time.getHours() < 6) {
          startOfCheckingDayGMT7.setDate(startOfCheckingDayGMT7.getDate() - 1);
        }
        
        const formattedTargetScheduleDate = format(startOfCheckingDayGMT7, 'yyyy-MM-dd');
        console.log("SatpamDashboard: Checking schedule for user", user.id, "on date (GMT+7 adjusted):", formattedTargetScheduleDate);

        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('id')
          .eq('user_id', user.id)
          .eq('schedule_date', formattedTargetScheduleDate)
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
          return;
        }
        setIsScheduledToday(true);

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
        setLoadingLocations(false); // Ensure loading is false on unauthorized access
      }
    };

    checkUserRoleAndFetchLocations();
  }, [session, sessionLoading, user, navigate, location.state, refreshTrigger]); // Add refreshTrigger to dependencies

  const handleScanLocation = (locationId: string) => {
    navigate(`/scan-location?id=${locationId}`);
  };

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
    return null;
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