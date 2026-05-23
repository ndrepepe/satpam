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
import { Calendar as CalendarIcon, Trash2, Edit, Upload, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

interface SummarizedRangeScheduleEntry {
  schedule_date: string;
  user_id: string;
  profileName: string;
  idNumber?: string;
  locationDisplay: string;
}

const SatpamSchedule: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [satpamList, setSatpamList] = useState<SatpamProfile[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [selectedSatpamId, setSelectedSatpamId] = useState<string | undefined>(undefined);
  const [selectedBuildingPosition, setSelectedBuildingPosition] = useState<string | undefined>('Semua Gedung');
  const [loading, setLoading] = useState(true);

  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [originalUserId, setOriginalUserId] = useState<string | null>(null);
  const [originalScheduleDate, setOriginalScheduleDate] = useState<string | null>(null);
  const [originalLocationAssignmentType, setOriginalLocationAssignmentType] = useState<string | undefined>(undefined);
  const [newSelectedSatpamId, setNewSelectedSatpamId] = useState<string | undefined>(undefined);
  const [newSelectedBuildingPosition, setNewSelectedBuildingPosition] = useState<string | undefined>(undefined);

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [rangeSchedules, setRangeSchedules] = useState<ScheduleEntry[]>([]);

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

  const fetchRangeSchedules = async () => {
    if (!startDate || !endDate) {
      toast.error("Harap pilih tanggal mulai dan tanggal akhir.");
      return;
    }
    setLoading(true);
    try {
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');

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
        .gte('schedule_date', formattedStartDate)
        .lte('schedule_date', formattedEndDate)
        .order('schedule_date', { ascending: true }); 

      if (error) throw error;
      setRangeSchedules(data as unknown as ScheduleEntry[]);
    } catch (error: any) {
      toast.error(`Gagal memuat jadwal dalam rentang: ${error.message}`);
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

      if (assignedCount === locationList.length) entry.locationDisplay = "Semua Gedung";
      else if (assignedCount === gedungBaratCount) entry.locationDisplay = "Gedung Barat";
      else if (assignedCount === gedungTimurCount) entry.locationDisplay = "Gedung Timur";
      else entry.locationDisplay = "Beberapa Lokasi";

      return entry;
    });
  }, [schedules, locationList]);

  const processedRangeSchedules = useMemo(() => {
    const grouped = new Map<string, SummarizedRangeScheduleEntry>();
    rangeSchedules.forEach(schedule => {
      const key = `${schedule.schedule_date}-${schedule.user_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          schedule_date: schedule.schedule_date,
          user_id: schedule.user_id,
          profileName: schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'N/A',
          idNumber: schedule.profiles?.id_number || 'N/A',
          locationDisplay: 'Ditugaskan',
        });
      }
    });
    return Array.from(grouped.values());
  }, [rangeSchedules]);

  const handleSaveSchedule = async () => {
    if (!selectedDate || !selectedSatpamId || !selectedBuildingPosition) {
      toast.error("Harap lengkapi semua bidang.");
      return;
    }
    
    let locationsToAssign = selectedBuildingPosition === 'Semua Gedung' 
      ? locationList 
      : locationList.filter(loc => loc.posisi_gedung === selectedBuildingPosition);

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
        toast.success("Jadwal dihapus.");
        if (selectedDate) fetchSchedules(selectedDate);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
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
        const nameColIndex = headers.indexOf('Nama');
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
        toast.success("Jadwal diimpor!");
        if (selectedDate) fetchSchedules(selectedDate);
      } catch (error: any) {
        toast.error(`Gagal: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Tambah Jadwal Baru</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} /></PopoverContent>
            </Popover>
            <Select onValueChange={setSelectedSatpamId} value={selectedSatpamId}>
              <SelectTrigger><SelectValue placeholder="Pilih Satpam" /></SelectTrigger>
              <SelectContent>{satpamList.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={setSelectedBuildingPosition} value={selectedBuildingPosition}>
              <SelectTrigger><SelectValue placeholder="Pilih Gedung" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua Gedung">Semua Gedung</SelectItem>
                <SelectItem value="Gedung Barat">Gedung Barat</SelectItem>
                <SelectItem value="Gedung Timur">Gedung Timur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveSchedule} className="w-full" disabled={loading}>Simpan Jadwal</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Impor XLSX</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadTemplate}
            className="text-indigo-600 hover:text-indigo-700 border-indigo-200 hover:bg-indigo-50 rounded-xl flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Unduh Template Excel</span>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={loading} className="rounded-xl" />
          <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl"><Upload className="mr-2 h-4 w-4" /> Proses</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Daftar Jadwal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Personel</TableHead><TableHead>Lokasi</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {dailySchedulesSummary.map(s => (
                <TableRow key={`${s.user_id}-${s.schedule_date}`}>
                  <TableCell>{format(new Date(s.schedule_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{s.profileName}</TableCell>
                  <TableCell>{s.locationDisplay}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteGroupedSchedule(s.user_id, s.schedule_date)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamSchedule;