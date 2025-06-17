import React, { useEffect, useState } from 'react';
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
import { Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  profiles: { first_name: string; last_name: string } | null;
  locations: { name: string } | null;
}

const SatpamSchedule: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [satpamList, setSatpamList] = useState<SatpamProfile[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]); // Tetap diperlukan untuk iterasi
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [selectedSatpamId, setSelectedSatpamId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch Satpam personnel
      const { data: satpamData, error: satpamError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('role', 'satpam');

      if (satpamError) throw satpamError;
      setSatpamList(satpamData);

      // Fetch Locations (still needed to assign satpam to all locations)
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
          profiles (first_name, last_name),
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
      setSchedules([]); // Clear schedules if no date is selected
    }
  }, [selectedDate]);

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
      const schedulesToInsert = [];
      const existingSchedulesForSatpam = schedules.filter(s => 
        s.user_id === selectedSatpamId && 
        format(new Date(s.schedule_date), 'yyyy-MM-dd') === formattedDate
      );
      const existingLocationIdsForSatpam = new Set(existingSchedulesForSatpam.map(s => s.location_id));

      for (const location of locationList) {
        if (!existingLocationIdsForSatpam.has(location.id)) {
          schedulesToInsert.push({
            schedule_date: formattedDate,
            user_id: selectedSatpamId,
            location_id: location.id,
          });
        }
      }

      if (schedulesToInsert.length === 0) {
        toast.warning("Satpam ini sudah dijadwalkan untuk semua lokasi pada tanggal ini.");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('schedules')
        .insert(schedulesToInsert);

      if (error) throw error;

      toast.success("Jadwal berhasil ditambahkan untuk semua lokasi!");
      setSelectedSatpamId(undefined);
      if (selectedDate) {
        fetchSchedules(selectedDate); // Refresh the list
      }
    } catch (error: any) {
      toast.error(`Gagal menambahkan jadwal: ${error.message}`);
      console.error("Error saving schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast.success("Jadwal berhasil dihapus.");
        if (selectedDate) {
          fetchSchedules(selectedDate); // Refresh the list
        }
      } catch (error: any) {
        toast.error(`Gagal menghapus jadwal: ${error.message}`);
        console.error("Error deleting schedule:", error);
      } finally {
        setLoading(false);
      }
    }
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
            {/* Pilihan Lokasi dihapus karena satpam akan dijadwalkan untuk semua lokasi */}
          </div>
          <Button onClick={handleSaveSchedule} className="w-full" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Jadwal untuk Semua Lokasi"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jadwal untuk {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale }) : 'Tanggal Dipilih'}</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Tidak ada jadwal untuk tanggal ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{format(new Date(schedule.schedule_date), 'dd MMMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell>{schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'N/A'}</TableCell>
                    <TableCell>{schedule.locations ? schedule.locations.name : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamSchedule;