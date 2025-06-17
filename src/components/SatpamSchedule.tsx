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
import { Popover, PopoverContent, PopoverTrigger } => '@/components/ui/popover';
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
}

interface ScheduleEntry {
  id: string;
  schedule_date: string;
  user_id: string;
  location_id: string;
  profiles: { first_name: string; last_name: string; id_number?: string } | null;
  locations: { name: string } | null;
}

interface GroupedScheduleEntry {
  user_id: string;
  schedule_date: string;
  profileName: string;
  idNumber?: string;
}

interface SummarizedRangeScheduleEntry {
  schedule_date: string;
  user_id: string; // Added user_id for actions
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
  const [loading, setLoading] = useState(true);

  // State for Reassign Dialog
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [originalUserId, setOriginalUserId] = useState<string | null>(null);
  const [originalScheduleDate, setOriginalScheduleDate] = useState<string | null>(null);
  const [newSelectedSatpamId, setNewSelectedSatpamId] = useState<string | undefined>(undefined);

  // New states for date range filtering
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [rangeSchedules, setRangeSchedules] = useState<ScheduleEntry[]>([]);


  // Maps for quick lookup during XLSX processing
  const satpamNameMap = useMemo(() => {
    const map = new Map<string, string>();
    satpamList.forEach(s => {
      map.set(`${s.first_name} ${s.last_name}`.trim(), s.id);
    });
    return map;
  }, [satpamList]);

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
      setSatpamList(satpamData);

      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id, name');

      if (locationError) throw locationError;
      setLocationList(locationData);

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
          locations (name)
        `)
        .eq('schedule_date', formattedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data);
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
    if (startDate > endDate) {
      toast.error("Tanggal mulai tidak boleh lebih lambat dari tanggal akhir.");
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
          locations (name)
        `)
        .gte('schedule_date', formattedStartDate)
        .lte('schedule_date', formattedEndDate)
        .order('schedule_date', { ascending: true }); 

      if (error) throw error;
      
      // Lakukan pengurutan tambahan di sisi klien berdasarkan nama personel
      const sortedData = data.sort((a, b) => {
        const nameA = a.profiles?.first_name || '';
        const nameB = b.profiles?.first_name || '';
        return nameA.localeCompare(nameB);
      });

      setRangeSchedules(sortedData);
      toast.success(`Jadwal untuk rentang ${format(startDate, 'dd MMM', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })} berhasil dimuat.`);
    } catch (error: any) {
      toast.error(`Gagal memuat jadwal dalam rentang: ${error.message}`);
      console.error("Error fetching range schedules:", error);
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
    } else {
      setSchedules([]);
    }
  }, [selectedDate]);

  const groupedSchedules = useMemo(() => {
    const grouped = new Map<string, GroupedScheduleEntry>();
    schedules.forEach(schedule => {
      const key = `${schedule.user_id}-${schedule.schedule_date}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          user_id: schedule.user_id,
          schedule_date: schedule.schedule_date,
          profileName: schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'N/A',
          idNumber: schedule.profiles?.id_number || 'N/A',
        });
      }
    });
    return Array.from(grouped.values());
  }, [schedules]);

  // New useMemo for summarizing range schedules
  const processedRangeSchedules = useMemo(() => {
    const grouped = new Map<string, {
      user_id: string;
      schedule_date: string;
      profileName: string;
      idNumber?: string;
      assignedLocationIds: Set<string>;
      locations: string[]; // To store names of assigned locations if not 'All'
    }>();

    rangeSchedules.forEach(schedule => {
      const key = `${schedule.schedule_date}-${schedule.user_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          user_id: schedule.user_id,
          schedule_date: schedule.schedule_date,
          profileName: schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'N/A',
          idNumber: schedule.profiles?.id_number || 'N/A',
          assignedLocationIds: new Set(),
          locations: []
        });
      }
      const entry = grouped.get(key)!;
      entry.assignedLocationIds.add(schedule.location_id);
      if (schedule.locations?.name) {
        entry.locations.push(schedule.locations.name);
      }
    });

    const result: SummarizedRangeScheduleEntry[] = [];
    grouped.forEach(entry => {
      let locationDisplay: string;
      if (locationList.length > 0 && entry.assignedLocationIds.size === locationList.length) {
        locationDisplay = "Semua Lokasi";
      } else if (entry.assignedLocationIds.size === 1) {
        locationDisplay = entry.locations[0] || 'N/A'; 
      } else if (entry.assignedLocationIds.size > 1) {
        locationDisplay = "Beberapa Lokasi"; 
      } else {
        locationDisplay = 'N/A';
      }

      result.push({
        schedule_date: entry.schedule_date,
        user_id: entry.user_id,
        profileName: entry.profileName,
        idNumber: entry.idNumber,
        locationDisplay: locationDisplay
      });
    });

    // Sort the summarized results
    result.sort((a, b) => {
      const dateComparison = new Date(a.schedule_date).getTime() - new Date(b.schedule_date).getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.profileName.localeCompare(b.profileName);
    });

    return result;
  }, [rangeSchedules, locationList]);


  const handleSaveSchedule = async () => {
    if (!selectedDate || !selectedSatpamId) {
      toast.error("Harap lengkapi semua bidang: Tanggal dan Personel.");
      return;
    }
    if (locationList.length === 0) {
      toast.error("Tidak ada lokasi yang terdaftar untuk dijadwalkan.");
      return;
    }

    setLoading(true);
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      
      // Check if the selected satpam is already scheduled for this date
      const { data: existingSchedules, error: existingSchedulesError } = await supabase
        .from('schedules')
        .select('id')
        .eq('user_id', selectedSatpamId)
        .eq('schedule_date', formattedDate);

      if (existingSchedulesError) throw existingSchedulesError;

      if (existingSchedules && existingSchedules.length > 0) {
        toast.error("Personel ini sudah memiliki jadwal tugas di tanggal yang sama.");
        setLoading(false);
        return;
      }

      const schedulesToInsert = [];
      for (const location of locationList) {
        schedulesToInsert.push({
          schedule_date: formattedDate,
          user_id: selectedSatpamId,
          location_id: location.id,
        });
      }

      const { error } = await supabase
        .from('schedules')
        .insert(schedulesToInsert);

      if (error) throw error;

      toast.success("Jadwal berhasil ditambahkan untuk semua lokasi!");
      setSelectedSatpamId(undefined);
      if (selectedDate) {
        fetchSchedules(selectedDate);
      }
    } catch (error: any) {
      toast.error(`Gagal menambahkan jadwal: ${error.message}`);
      console.error("Error saving schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroupedSchedule = async (userId: string, scheduleDate: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus semua jadwal untuk personel ini pada tanggal ${format(new Date(scheduleDate), 'dd MMMM yyyy', { locale: idLocale })}?`)) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('user_id', userId)
          .eq('schedule_date', scheduleDate);

        if (error) throw error;

        toast.success("Semua jadwal terkait berhasil dihapus.");
        if (selectedDate) {
          fetchSchedules(selectedDate);
        }
        // Also refresh range schedules if they are currently displayed
        if (startDate && endDate) {
          fetchRangeSchedules();
        }
      } catch (error: any) {
        toast.error(`Gagal menghapus jadwal: ${error.message}`);
        console.error("Error deleting grouped schedule:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditScheduleAssignmentClick = (userId: string, scheduleDate: string) => {
    setOriginalUserId(userId);
    setOriginalScheduleDate(scheduleDate);
    setNewSelectedSatpamId(userId); // Pre-select current satpam in dropdown
    setIsReassignDialogOpen(true);
  };

  const handleSaveScheduleAssignment = async () => {
    if (!originalUserId || !originalScheduleDate || !newSelectedSatpamId) {
      toast.error("Data tidak lengkap untuk mengubah penugasan.");
      return;
    }

    if (originalUserId === newSelectedSatpamId) {
      toast.info("Personel yang dipilih sama dengan personel saat ini. Tidak ada perubahan yang disimpan.");
      setIsReassignDialogOpen(false);
      return;
    }

    setLoading(true);
    try {
      // VALIDATION: Check if the new selected satpam is already assigned on the original schedule date
      const { data: existingAssignment, error: existingAssignmentError } = await supabase
        .from('schedules')
        .select('id')
        .eq('user_id', newSelectedSatpamId)
        .eq('schedule_date', originalScheduleDate)
        .limit(1); // Only need to know if at least one exists

      if (existingAssignmentError) throw existingAssignmentError;

      if (existingAssignment && existingAssignment.length > 0) {
        const newSatpamName = satpamList.find(s => s.id === newSelectedSatpamId)?.first_name || 'Personel ini';
        toast.error(`${newSatpamName} sudah memiliki jadwal tugas di tanggal ${format(new Date(originalScheduleDate), 'dd MMMM yyyy', { locale: idLocale })}.`);
        setLoading(false);
        return;
      }

      // Update all schedule entries for the original user on the original date
      const { error } = await supabase
        .from('schedules')
        .update({ user_id: newSelectedSatpamId })
        .eq('user_id', originalUserId)
        .eq('schedule_date', originalScheduleDate);

      if (error) throw error;

      toast.success("Penugasan personel berhasil diperbarui.");
      setIsReassignDialogOpen(false);
      setOriginalUserId(null);
      setOriginalScheduleDate(null);
      setNewSelectedSatpamId(undefined);
      
      if (selectedDate) {
        await fetchSchedules(selectedDate); // Re-fetch schedules to update the table
      }
      // Also refresh range schedules if they are currently displayed
      if (startDate && endDate) {
        fetchRangeSchedules();
      }
    } catch (error: any) {
      toast.error(`Gagal memperbarui penugasan personel: ${error.message}`);
      console.error("Error updating schedule assignment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("Tidak ada file yang dipilih.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read data as array of arrays to get headers and rows
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        if (rawData.length === 0) {
          toast.error("File XLSX kosong atau tidak memiliki data.");
          setLoading(false);
          return;
        }

        const headers = rawData[0];
        const dataRows = rawData.slice(1);

        const nameColIndex = headers.indexOf('Nama');
        const idColIndex = headers.indexOf('No ID');

        if (nameColIndex === -1 || idColIndex === -1) {
          toast.error("File XLSX harus memiliki kolom 'Nama' dan 'No ID'.");
          setLoading(false);
          return;
        }

        const dateColumns: { header: string; index: number }[] = [];
        for (let i = 0; i < headers.length; i++) {
          if (i !== nameColIndex && i !== idColIndex) {
            try {
              // Attempt to parse header as a date (YYYY-MM-DD)
              const parsedDate = new Date(headers[i]);
              if (!isNaN(parsedDate.getTime())) { // Check if it's a valid date
                dateColumns.push({ header: format(parsedDate, 'yyyy-MM-dd'), index: i });
              }
            } catch (e) {
              // Not a date column, ignore
            }
          }
        }

        if (dateColumns.length === 0) {
          toast.error("File XLSX tidak memiliki kolom tanggal yang valid (misal: YYYY-MM-DD).");
          setLoading(false);
          return;
        }

        const schedulesToProcess: { date: string; userId: string }[] = [];
        let hasError = false;

        for (const row of dataRows) {
          const satpamName = row[nameColIndex]?.toString().trim();
          const satpamIdNumber = row[idColIndex]?.toString().trim();

          if (!satpamName || !satpamIdNumber) {
            // Skip rows with missing name or ID, or show a warning
            console.warn("Skipping row due to missing Nama or No ID:", row);
            continue;
          }

          const userId = idNumberToUserIdMap.get(satpamIdNumber);

          if (!userId) {
            toast.error(`Personel dengan No ID "${satpamIdNumber}" tidak ditemukan di daftar satpam.`);
            hasError = true;
            break;
          }

          for (const dateCol of dateColumns) {
            const cellValue = row[dateCol.index]?.toString().trim();
            if (cellValue && cellValue !== '') { // If cell has any value, consider it assigned
              schedulesToProcess.push({ date: dateCol.header, userId: userId });
            }
          }
        }

        if (hasError) {
          setLoading(false);
          return;
        }

        if (schedulesToProcess.length === 0) {
          toast.info("Tidak ada jadwal yang ditemukan dalam file yang diunggah.");
          setLoading(false);
          return;
        }

        // Send to Edge Function for bulk insertion
        const { data: edgeFunctionResponse, error: edgeFunctionError } = await supabase.functions.invoke('bulk-insert-schedules', {
          body: { schedulesData: schedulesToProcess },
        });

        if (edgeFunctionError) {
          console.error("Error invoking bulk-insert-schedules Edge Function:", edgeFunctionError);
          throw new Error(`Edge Function error: ${edgeFunctionError.message}`);
        }

        if (edgeFunctionResponse && edgeFunctionResponse.error) {
          throw new Error(`Edge Function returned error: ${edgeFunctionResponse.error}`);
        }

        toast.success("Jadwal berhasil diimpor dari file XLSX!");
        if (selectedDate) {
          fetchSchedules(selectedDate); // Refresh current view
        }
        // Also refresh range schedules if they are currently displayed
        if (startDate && endDate) {
          fetchRangeSchedules();
        }
      } catch (error: any) {
        toast.error(`Gagal memproses file: ${error.message}`);
        console.error("Error processing XLSX file:", error);
      } finally {
        setLoading(false);
        // Clear the file input
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Nama", "No ID"];
    const today = new Date();
    // Add next 30 days as date headers
    for (let i = 0; i < 30; i++) { 
      headers.push(format(addDays(today, i), 'yyyy-MM-dd'));
    }

    const ws_data: (string | null)[][] = [headers];

    // Add some example data rows
    if (satpamList.length > 0) {
      const exampleSatpam1 = satpamList[0];
      const row1: (string | null)[] = [
        `${exampleSatpam1.first_name} ${exampleSatpam1.last_name}`,
        exampleSatpam1.id_number || 'ID001'
      ];
      for (let i = 0; i < 30; i++) { 
        row1.push(i === 0 || i === 2 ? 'X' : null); 
      }
      ws_data.push(row1);

      if (satpamList.length > 1) {
        const exampleSatpam2 = satpamList[1];
        const row2: (string | null)[] = [
          `${exampleSatpam2.first_name} ${exampleSatpam2.last_name}`,
          exampleSatpam2.id_number || 'ID002'
        ];
        for (let i = 0; i < 30; i++) { 
          row2.push(i === 1 || i === 3 ? 'X' : null); 
        }
        ws_data.push(row2);
      }
    } else {
      // Fallback if no satpam data
      const row1: (string | null)[] = ["Budi Santoso", "ID001"];
      for (let i = 0; i < 30; i++) row1.push(null); 
      ws_data.push(row1);
      const row2: (string | null)[] = ["Siti Aminah", "ID002"];
      for (let i = 0; i < 30; i++) row2.push(null); 
      ws_data.push(row2);
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal_Template");
    XLSX.writeFile(wb, "jadwal_template.xlsx");
    toast.info("Format file XLSX berhasil diunduh.");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tambah Jadwal Baru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pilih Tanggal</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pilih Personel Satpam</label>
              <Select onValueChange={setSelectedSatpamId} value={selectedSatpamId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Satpam" />
                </SelectTrigger>
                <SelectContent>
                  {satpamList.map((satpam) => (
                    <SelectItem key={satpam.id} value={satpam.id}>
                      {satpam.first_name} {satpam.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSaveSchedule} className="w-full" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Jadwal untuk Semua Lokasi"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Impor Jadwal dari File XLSX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Unggah file XLSX Anda. Pastikan file memiliki kolom 'Nama' (nama lengkap personel) dan 'No ID' (nomor ID personel) di awal, diikuti oleh kolom-kolom tanggal (misal: YYYY-MM-DD). Isi sel dengan nilai apa pun (misal: 'X') untuk menandakan personel bertugas pada tanggal tersebut.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Input
              id="xlsx-file-upload"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="flex-grow"
              disabled={loading}
            />
            <Button
              onClick={() => document.getElementById('xlsx-file-upload')?.click()}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" /> Unggah & Proses
            </Button>
            <Button
              onClick={handleDownloadTemplate}
              disabled={loading}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" /> Unduh Format
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Card for Date Range Schedule View */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Lihat Jadwal Berdasarkan Rentang Tanggal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal mulai</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Akhir</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd MMMM yyyy", { locale: idLocale }) : <span>Pilih tanggal akhir</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Button onClick={fetchRangeSchedules} className="w-full" disabled={loading || !startDate || !endDate}>
            {loading ? "Memuat..." : "Tampilkan Jadwal"}
          </Button>
        </CardContent>
      </Card>

      {processedRangeSchedules.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Jadwal dalam Rentang Tanggal</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>No. ID</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead> {/* Added Aksi column */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRangeSchedules.map((schedule) => (
                  <TableRow key={`${schedule.schedule_date}-${schedule.user_id}`}>
                    <TableCell>{format(new Date(schedule.schedule_date), 'dd MMMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell>{schedule.profileName}</TableCell>
                    <TableCell>{schedule.idNumber}</TableCell>
                    <TableCell>{schedule.locationDisplay}</TableCell>
                    <TableCell className="text-right"> {/* Added action buttons */}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditScheduleAssignmentClick(schedule.user_id, schedule.schedule_date)}
                          disabled={loading}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteGroupedSchedule(schedule.user_id, schedule.schedule_date)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Jadwal untuk {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : 'Tanggal Dipilih'}</CardTitle>
        </CardHeader>
        <CardContent>
          {groupedSchedules.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Tidak ada jadwal untuk tanggal ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>No. ID</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedSchedules.map((schedule) => (
                  <TableRow key={`${schedule.user_id}-${schedule.schedule_date}`}>
                    <TableCell>{format(new Date(schedule.schedule_date), 'dd MMMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell>{schedule.profileName}</TableCell>
                    <TableCell>{schedule.idNumber}</TableCell>
                    <TableCell>Semua Lokasi</TableCell> {/* This already says "Semua Lokasi" */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditScheduleAssignmentClick(schedule.user_id, schedule.schedule_date)}
                          disabled={loading}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteGroupedSchedule(schedule.user_id, schedule.schedule_date)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reassign Personel Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Ubah Penugasan Personel</DialogTitle>
            <DialogDescription>
              Pilih personel satpam baru untuk jadwal ini.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newSatpam" className="text-right">
                Personel Baru
              </Label>
              <Select onValueChange={setNewSelectedSatpamId} value={newSelectedSatpamId} disabled={loading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Pilih Satpam Baru" />
                </SelectTrigger>
                <SelectContent>
                  {satpamList.map((satpam) => (
                    <SelectItem key={satpam.id} value={satpam.id}>
                      {satpam.first_name} {satpam.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveScheduleAssignment} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SatpamSchedule;