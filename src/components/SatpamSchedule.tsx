import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Calendar as CalendarIcon, Trash2, Upload, RefreshCw, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';

interface SatpamProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  id_number?: string;
}

interface Location {
  id: string;
  name: string;
  posisi_gedung?: string | null;
}

interface ScheduleEntry {
  id: string;
  schedule_date: string;
  user_id: string;
  location_id: string;
  profiles: { first_name: string; last_name: string; id_number?: string } | null;
  locations: { name: string; posisi_gedung?: string | null } | null;
}

interface DailyScheduleSummaryEntry {
  user_id: string;
  schedule_date: string;
  profileName: string;
  idNumber?: string;
  locationDisplay: string;
  assignedLocationIds: Set<string>;
}

const SatpamSchedule: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [satpamList, setSatpamList] = useState<SatpamProfile[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [selectedSatpamId, setSelectedSatpamId] = useState<string | undefined>(undefined);
  const [selectedBuildingPosition, setSelectedBuildingPosition] = useState<string | undefined>('Semua Gedung');
  const [loading, setLoading] = useState(true);

  const idNumberToUserIdMap = useMemo(() => {
    const map = new Map<string, string>();
    satpamList.forEach(s => {
      if (s.id_number) {
        map.set(s.id_number, s.id);
      }
    });
    return map;
  }, [satpamList]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: satpamData, error: satpamError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, id_number')
        .eq('role', 'satpam');

      if (satpamError) throw satpamError;
      setSatpamList(satpamData as SatpamProfile[]);

      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id, name, posisi_gedung');

      if (locationError) throw locationError;
      setLocationList(locationData as Location[]);

    } catch (error: any) {
      toast.error(`Gagal memuat data awal: ${error.message}`);
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async (date: Date) => {
    setLoading(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          schedule_date,
          user_id,
          location_id,
          profiles (first_name, last_name, id_number),
          locations (name, posisi_gedung)
        `)
        .eq('schedule_date', formattedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data as unknown as ScheduleEntry[]);
    } catch (error: any) {
      toast.error(`Gagal memuat jadwal: ${error.message}`);
      console.error("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchSchedules(selectedDate);
    }
  }, [selectedDate]);

  const dailySchedulesSummary = useMemo(() => {
    const grouped = new Map<string, DailyScheduleSummaryEntry>();
    schedules.forEach(schedule => {
      const key = `${schedule.user_id}-${schedule.schedule_date}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          user_id: schedule.user_id,
          schedule_date: schedule.schedule_date,
          profileName: schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'N/A',
          idNumber: schedule.profiles?.id_number || 'N/A',
          locationDisplay: '',
          assignedLocationIds: new Set(),
        });
      }
      grouped.get(key)!.assignedLocationIds.add(schedule.location_id);
    });

    return Array.from(grouped.values()).map(entry => {
      const gedungBaratCount = locationList.filter(l => l.posisi_gedung === 'Gedung Barat').length;
      const gedungTimurCount = locationList.filter(l => l.posisi_gedung === 'Gedung Timur').length;
      const assignedCount = entry.assignedLocationIds.size;

      if (assignedCount === locationList.length && locationList.length > 0) entry.locationDisplay = "Semua Gedung";
      else if (assignedCount === gedungBaratCount && gedungBaratCount > 0) entry.locationDisplay = "Gedung Barat";
      else if (assignedCount === gedungTimurCount && gedungTimurCount > 0) entry.locationDisplay = "Gedung Timur";
      else entry.locationDisplay = "Beberapa Lokasi";

      return entry;
    });
  }, [schedules, locationList]);

  const handleSaveSchedule = async () => {
    if (!selectedDate || !selectedSatpamId || !selectedBuildingPosition) {
      toast.error("Harap lengkapi semua bidang.");
      return;
    }
    
    let locationsToAssign = selectedBuildingPosition === 'Semua Gedung' 
      ? locationList 
      : locationList.filter(loc => loc.posisi_gedung === selectedBuildingPosition);

    if (locationsToAssign.length === 0) {
      toast.error("Tidak ada lokasi yang cocok dengan posisi gedung yang dipilih.");
      return;
    }

    setLoading(true);
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const schedulesToInsert = locationsToAssign.map(loc => ({
        schedule_date: formattedDate,
        user_id: selectedSatpamId,
        location_id: loc.id,
      }));

      const { error } = await supabase.from('schedules').insert(schedulesToInsert);
      if (error) throw error;

      toast.success("Jadwal berhasil ditambahkan!");
      fetchSchedules(selectedDate);
    } catch (error: any) {
      toast.error(`Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroupedSchedule = async (userId: string, scheduleDate: string) => {
    if (window.confirm("Hapus jadwal ini?")) {
      setLoading(true);
      try {
        const { error } = await supabase.from('schedules').delete().eq('user_id', userId).eq('schedule_date', scheduleDate);
        if (error) throw error;
        toast.success("Jadwal berhasil dihapus.");
        if (selectedDate) fetchSchedules(selectedDate);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownloadTemplate = () => {
    try {
      // Generate headers: Nama, No ID, and next 7 days
      const headers = ['Nama', 'No ID'];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        headers.push(format(addDays(today, i), 'yyyy-MM-dd'));
      }

      // Create sample data using existing satpam list
      const sampleRows = satpamList.map(s => {
        const row: Record<string, string> = {
          'Nama': `${s.first_name} ${s.last_name}`,
          'No ID': s.id_number || '',
        };
        // Fill first date with sample position
        headers.slice(2).forEach((date, idx) => {
          row[date] = idx === 0 ? 'Semua Gedung' : ''; // sample value
        });
        return row;
      });

      // If no satpam list, add a dummy row
      if (sampleRows.length === 0) {
        const dummyRow: Record<string, string> = {
          'Nama': 'Contoh Satpam',
          'No ID': 'SP001',
        };
        headers.slice(2).forEach((date, idx) => {
          dummyRow[date] = idx === 0 ? 'Semua Gedung' : '';
        });
        sampleRows.push(dummyRow);
      }

      const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Jadwal');

      // Write and download
      XLSX.writeFile(workbook, 'Template_Jadwal_Satpam.xlsx');
      toast.success("Template Excel berhasil diunduh!");
    } catch (error: any) {
      toast.error(`Gagal mengunduh template: ${error.message}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        const headers = rawData[0];
        const idColIndex = headers.indexOf('No ID');
        const dateColumns = headers.map((h, i) => ({ header: h, index: i })).filter(h => !isNaN(new Date(h.header).getTime()));

        const schedulesToProcess = [];
        for (const row of rawData.slice(1)) {
          const userId = idNumberToUserIdMap.get(row[idColIndex]?.toString().trim());
          if (!userId) continue;

          for (const dateCol of dateColumns) {
            const pos = row[dateCol.index]?.toString().trim();
            if (pos) schedulesToProcess.push({ date: dateCol.header, userId, buildingPosition: pos });
          }
        }

        const { data: res, error } = await supabase.functions.invoke('bulk-insert-schedules', {
          body: { schedulesData: schedulesToProcess },
        });

        if (error || res?.error) throw new Error(error?.message || res?.error);
        toast.success("Jadwal berhasil diimpor!");
        if (selectedDate) fetchSchedules(selectedDate);
      } catch (error: any) {
        toast.error(`Gagal mengimpor jadwal: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Tambah Jadwal Baru */}
      <Card className="border border-slate-800/60 bg-slate-950/40 backdrop-blur-md rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/40 bg-slate-900/20 py-4 px-6">
          <CardTitle className="text-base font-bold text-white font-mono uppercase tracking-wider">Tambah Jadwal Baru</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-start bg-slate-900/80 border-slate-800 text-white hover:bg-slate-800 hover:text-white rounded-xl py-5 font-mono text-xs"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400" />
                  {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-950 border-slate-800">
                <Calendar 
                  mode="single" 
                  selected={selectedDate} 
                  onSelect={setSelectedDate} 
                  className="bg-slate-950 text-white"
                />
              </PopoverContent>
            </Popover>

            <Select onValueChange={setSelectedSatpamId} value={selectedSatpamId}>
              <SelectTrigger className="bg-slate-900/80 border-slate-800 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5 font-mono text-xs">
                <SelectValue placeholder="Pilih Satpam" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-white">
                {satpamList.map(s => (
                  <SelectItem key={s.id} value={s.id} className="focus:bg-slate-900 focus:text-white">
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={setSelectedBuildingPosition} value={selectedBuildingPosition}>
              <SelectTrigger className="bg-slate-900/80 border-slate-800 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5 font-mono text-xs">
                <SelectValue placeholder="Pilih Gedung" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-white">
                <SelectItem value="Semua Gedung" className="focus:bg-slate-900 focus:text-white">Semua Gedung</SelectItem>
                <SelectItem value="Gedung Barat" className="focus:bg-slate-900 focus:text-white">Gedung Barat</SelectItem>
                <SelectItem value="Gedung Timur" className="focus:bg-slate-900 focus:text-white">Gedung Timur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSaveSchedule} 
            className="w-full py-5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-mono uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all duration-300" 
            disabled={loading}
          >
            Simpan Jadwal
          </Button>
        </CardContent>
      </Card>

      {/* Card 2: Impor XLSX */}
      <Card className="border border-slate-800/60 bg-slate-950/40 backdrop-blur-md rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/40 bg-slate-900/20 py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-white font-mono uppercase tracking-wider">Impor XLSX</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDownloadTemplate}
            className="rounded-lg border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all duration-200 font-mono text-xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Unduh Template
          </Button>
        </CardHeader>
        <CardContent className="p-6 flex flex-col sm:flex-row gap-3">
          <Input 
            type="file" 
            accept=".xlsx" 
            onChange={handleFileUpload} 
            disabled={loading} 
            className="bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-2.5"
          />
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="rounded-xl border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30 transition-all duration-200 py-5 px-5 font-mono text-xs uppercase tracking-wider"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-cyan-400" /> 
            Proses
          </Button>
        </CardContent>
      </Card>

      {/* Card 3: Daftar Jadwal */}
      <Card className="border border-slate-800/60 bg-slate-950/40 backdrop-blur-md rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/40 bg-slate-900/20 py-4 px-6">
          <CardTitle className="text-base font-bold text-white font-mono uppercase tracking-wider">Daftar Jadwal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900/80 border-b border-slate-800/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Tanggal</TableHead>
                  <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Personel</TableHead>
                  <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Lokasi</TableHead>
                  <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailySchedulesSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-400 font-mono text-sm">
                      Belum ada jadwal untuk tanggal ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailySchedulesSummary.map(s => (
                    <TableRow key={`${s.user_id}-${s.schedule_date}`} className="border-b border-slate-800/40 hover:bg-slate-900/40 transition-colors duration-200">
                      <TableCell className="font-mono text-slate-300 py-4 px-6 text-sm">
                        {format(new Date(s.schedule_date), 'dd MMM yyyy', { locale: idLocale })}
                      </TableCell>
                      <TableCell className="font-semibold text-white py-4 px-6 text-sm">
                        {s.profileName}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          {s.locationDisplay}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteGroupedSchedule(s.user_id, s.schedule_date)}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamSchedule;