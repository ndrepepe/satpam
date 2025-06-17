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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Perbaikan di sini
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
import * as XLSX from 'xlsx'; // Import xlsx

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
  id: string;
  schedule_date: string;
  user_id: string;
  location_id: string;
  profiles: { first_name: string; last_name: string; id_number?: string } | null; // Added id_number
  locations: { name: string } | null;
}

interface GroupedScheduleEntry {
  user_id: string;
  schedule_date: string;
  profileName: string;
  idNumber?: string; // Added idNumber
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

  // Maps for quick lookup during XLSX processing
  const [satpamNameMap, setSatpamNameMap] = useState<Map<string, string>>(new Map()); // Full name -> ID

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: satpamData, error: satpamError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, id_number') // Fetch id_number
        .eq('role', 'satpam');

      if (satpamError) throw satpamError;
      setSatpamList(satpamData);
      const newSatpamMap = new Map<string, string>();
      satpamData.forEach(s => {
        newSatpamMap.set(`${s.first_name} ${s.last_name}`.trim(), s.id);
      });
      setSatpamNameMap(newSatpamMap);

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
          idNumber: schedule.profiles?.id_number || 'N/A', // Include idNumber
        });
      }
    });
    return Array.from(grouped.values());
  }, [schedules]);

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
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          toast.error("File XLSX kosong atau tidak memiliki data.");
          setLoading(false);
          return;
        }

        const schedulesToProcess: { date: string; userId: string }[] = [];
        let hasError = false;

        for (const row of json as any[]) {
          const rawDate = row['Tanggal']; // Assuming 'Tanggal' column
          const satpamFullName = row['Nama Satpam']; // Assuming 'Nama Satpam' column

          if (!rawDate || !satpamFullName) {
            toast.error("File XLSX harus memiliki kolom 'Tanggal' dan 'Nama Satpam'.");
            hasError = true;
            break;
          }

          // Date parsing: handle various formats, assuming Excel date number or string
          let formattedDate: string;
          if (typeof rawDate === 'number') {
            // Excel date number (days since 1900-01-01)
            const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's epoch is Dec 30, 1899
            const dateObj = new Date(excelEpoch.getTime() + rawDate * 24 * 60 * 60 * 1000);
            formattedDate = format(dateObj, 'yyyy-MM-dd');
          } else {
            // Assume string format like YYYY-MM-DD or DD-MM-YYYY
            try {
              formattedDate = format(new Date(rawDate), 'yyyy-MM-dd');
            } catch (dateError) {
              toast.error(`Format tanggal tidak valid: ${rawDate}. Gunakan YYYY-MM-DD.`);
              hasError = true;
              break;
            }
          }

          const userId = satpamNameMap.get(satpamFullName.trim());

          if (!userId) {
            toast.error(`Personel "${satpamFullName}" tidak ditemukan di daftar satpam.`);
            hasError = true;
            break;
          }

          schedulesToProcess.push({ date: formattedDate, userId });
        }

        if (hasError) {
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
    const ws_data = [
      ["Tanggal", "Nama Satpam"], // Headers
      ["2023-10-26", "Budi Santoso"],
      ["2023-10-27", "Siti Aminah"],
    ];
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
            Unggah file XLSX Anda. Pastikan file memiliki kolom 'Tanggal' (misal: YYYY-MM-DD) dan 'Nama Satpam' (nama lengkap personel).
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
                  <TableHead>No. ID</TableHead> {/* New Table Head */}
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedSchedules.map((schedule) => (
                  <TableRow key={`${schedule.user_id}-${schedule.schedule_date}`}>
                    <TableCell>{format(new Date(schedule.schedule_date), 'dd MMMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell>{schedule.profileName}</TableCell>
                    <TableCell>{schedule.idNumber}</TableCell> {/* Display idNumber */}
                    <TableCell>Semua Lokasi</TableCell>
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