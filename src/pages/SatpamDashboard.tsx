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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Shield, Search, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  isCheckedToday?: boolean;
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [isSatpam, setIsSatpam] = useState(false);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

        const now = new Date();
        const currentGMT7Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (7 * 60 * 60 * 1000));

        let targetCalendarDateForSchedule = new Date(currentGMT7Time);
        targetCalendarDateForSchedule.setHours(6, 0, 0, 0);

        if (currentGMT7Time.getHours() < 6) {
          targetCalendarDateForSchedule.setDate(targetCalendarDateForSchedule.getDate() - 1);
        }
        
        const formattedTargetScheduleDate = format(targetCalendarDateForSchedule, 'yyyy-MM-dd');

        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('location_id')
          .eq('user_id', user.id)
          .eq('schedule_date', formattedTargetScheduleDate);

        if (scheduleError) {
          console.error("SatpamDashboard: Error fetching schedule for user:", scheduleError);
          toast.error("Gagal memuat jadwal Anda.");
          setLoadingLocations(false);
          return;
        }

        if (!scheduleData || scheduleData.length === 0) {
          setIsScheduledToday(false);
          setLoadingLocations(false);
          setLocations([]);
          return;
        }
        setIsScheduledToday(true);

        const scheduledLocationIds = scheduleData.map(s => s.location_id);

        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, created_at')
          .in('id', scheduledLocationIds)
          .order('name', { ascending: true });

        if (locationsError) {
          console.error("Error fetching locations:", locationsError);
          toast.error("Gagal memuat daftar lokasi.");
          setLoadingLocations(false);
          return;
        }

        const localStartOfCheckingDayForReports = new Date(targetCalendarDateForSchedule.getFullYear(), targetCalendarDateForSchedule.getMonth(), targetCalendarDateForSchedule.getDate(), 6, 0, 0);
        const startOfCheckingDayUTC = localStartOfCheckingDayForReports.toISOString();
        const endOfCheckingDayUTC = new Date(localStartOfCheckingDayForReports.getTime() + (24 * 60 * 60 * 1000)).toISOString();

        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select('location_id, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startOfCheckingDayUTC)
          .lt('created_at', endOfCheckingDayUTC);

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

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (sessionLoading || loadingLocations) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Shield className="h-6 w-6 text-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isSatpam) return null;

  return (
    <div className="w-full max-w-4xl mx-auto relative group">
      {/* Glowing background aura */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 opacity-20 blur-xl transition duration-1000 group-hover:opacity-30" />

      <Card className="relative rounded-3xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/80 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
                  <Shield className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-extrabold tracking-wider text-white">HUD TAKTIS SATPAM</CardTitle>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">Sistem Pemantauan Area Real-Time</p>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          {!isScheduledToday ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Tidak Ada Jadwal Tugas</h4>
                <p className="text-sm text-slate-400 mt-1">Anda tidak memiliki jadwal tugas aktif untuk hari ini.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cari lokasi patroli..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 pr-4 py-6 rounded-2xl border-slate-800/80 bg-slate-900/40 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all duration-300"
                />
              </div>

              {filteredLocations.length === 0 ? (
                <p className="text-center py-12 text-slate-400 font-mono">
                  {searchQuery ? "Tidak ada lokasi yang cocok." : "Belum ada lokasi terdaftar hari ini."}
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/20">
                  <Table>
                    <TableHeader className="bg-slate-900/50">
                      <TableRow className="border-b border-slate-800/80 hover:bg-transparent">
                        <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center">Lokasi Patroli</TableHead>
                        <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center w-[180px]">Status</TableHead>
                        <TableHead className="text-slate-300 font-mono uppercase tracking-wider text-center w-[150px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLocations.map((loc) => (
                        <TableRow key={loc.id} className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors duration-200">
                          <TableCell className="font-medium text-white text-center py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <MapPin className="h-4 w-4 text-cyan-400" />
                              <span>{loc.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            {loc.isCheckedToday ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-mono text-xs">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5 inline" />
                                SELESAI
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-mono text-xs">
                                <AlertCircle className="mr-1 h-3.5 w-3.5 inline" />
                                BELUM DICEK
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Button
                              size="sm"
                              onClick={() => handleScanLocation(loc.id)}
                              disabled={loc.isCheckedToday}
                              className={`rounded-xl font-mono text-xs px-4 py-2 transition-all duration-300 ${
                                loc.isCheckedToday 
                                  ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed" 
                                  : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                              }`}
                            >
                              {loc.isCheckedToday ? "COMPLETED" : "SCAN QR"}
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