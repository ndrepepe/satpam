"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, CheckCircle2, Clock, AlertTriangle, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  schedule_date: string;
  status: 'pending' | 'completed' | 'overdue';
  user_id: string;
  apar_location_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
  apar_locations: {
    name: string;
    type: string;
    posisi_gedung: string;
  } | null;
}

interface AparScheduleListProps {
  refreshKey: number;
}

const AparScheduleList: React.FC<AparScheduleListProps> = ({ refreshKey }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      // 1. Ambil data jadwal APAR
      const { data: rawSchedules, error: schedulesError } = await supabase
        .from('apar_schedules')
        .select('id, schedule_date, status, user_id, apar_location_id')
        .order('schedule_date', { ascending: false });

      if (schedulesError) throw schedulesError;

      if (!rawSchedules || rawSchedules.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      // 2. Ambil data profiles satpam
      const { data: rawProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');

      if (profilesError) throw profilesError;

      // 3. Ambil data lokasi APAR
      const { data: rawAparLocations, error: aparLocationsError } = await supabase
        .from('apar_locations')
        .select('id, name, type, posisi_gedung');

      if (aparLocationsError) throw aparLocationsError;

      // Buat map untuk pencarian cepat
      const profilesMap = new Map(rawProfiles?.map(p => [p.id, p]));
      const aparLocationsMap = new Map(rawAparLocations?.map(a => [a.id, a]));

      // 4. Gabungkan data di memori (In-Memory Join)
      const joinedData: Schedule[] = rawSchedules.map(schedule => {
        const profile = profilesMap.get(schedule.user_id);
        const aparLocation = aparLocationsMap.get(schedule.apar_location_id);

        return {
          id: schedule.id,
          schedule_date: schedule.schedule_date,
          status: schedule.status,
          user_id: schedule.user_id,
          apar_location_id: schedule.apar_location_id,
          profiles: profile ? { first_name: profile.first_name, last_name: profile.last_name } : null,
          apar_locations: aparLocation ? { name: aparLocation.name, type: aparLocation.type, posisi_gedung: aparLocation.posisi_gedung } : null
        };
      });

      setSchedules(joinedData);
    } catch (error: any) {
      toast.error(`Gagal memuat jadwal dari database: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus jadwal pemeriksaan ini?")) {
      try {
        const { error } = await supabase
          .from('apar_schedules')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast.success("Jadwal pemeriksaan berhasil dihapus.");
        fetchSchedules();
      } catch (error: any) {
        toast.error(`Gagal menghapus jadwal: ${error.message}`);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs uppercase">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Selesai
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-mono text-xs uppercase">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Terlambat
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-mono text-xs uppercase">
            <Clock className="mr-1 h-3.5 w-3.5" /> Menunggu
          </Badge>
        );
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    const aparName = schedule.apar_locations?.name || '';
    const aparType = schedule.apar_locations?.type || '';
    const location = schedule.apar_locations?.posisi_gedung || '';
    const staffName = schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : '';

    const matchesSearch = 
      aparName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aparType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staffName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || schedule.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="border border-slate-800/80 bg-slate-950/40 backdrop-blur-md rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-slate-800/60 bg-slate-900/20 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              Daftar Jadwal Pemeriksaan APAR (Database)
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">Memantau jadwal pengecekan aktif langsung dari Supabase</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Cari APAR / Petugas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-slate-900/50 border-slate-800 text-xs text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-orange-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={`h-7 px-2.5 text-xs rounded-lg font-mono uppercase ${statusFilter === 'all' ? 'bg-orange-600 text-white hover:bg-orange-600' : 'text-slate-400 hover:text-white'}`}
              >
                Semua
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('pending')}
                className={`h-7 px-2.5 text-xs rounded-lg font-mono uppercase ${statusFilter === 'pending' ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30' : 'text-slate-400 hover:text-white'}`}
              >
                Menunggu
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('completed')}
                className={`h-7 px-2.5 text-xs rounded-lg font-mono uppercase ${statusFilter === 'completed' ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' : 'text-slate-400 hover:text-white'}`}
              >
                Selesai
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm">
            Memuat data jadwal dari Supabase...
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">
            Tidak ada jadwal pemeriksaan yang ditemukan di database.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredSchedules.map((schedule) => (
              <div key={schedule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/20 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-orange-400">
                      {schedule.apar_locations?.name || 'APAR Tidak Diketahui'}
                    </span>
                    {schedule.apar_locations?.type && (
                      <span className="text-xs text-slate-300 font-medium">({schedule.apar_locations.type})</span>
                    )}
                    {getStatusBadge(schedule.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                    {schedule.apar_locations?.posisi_gedung && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">Gedung:</span>
                        <span className="text-slate-300">{schedule.apar_locations.posisi_gedung}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Petugas:</span>
                      <span className="text-slate-300 font-medium">
                        {schedule.profiles ? `${schedule.profiles.first_name} ${schedule.profiles.last_name}` : 'Belum Ditugaskan'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Tanggal Cek:</span>
                      <span className="text-slate-300 font-mono">{schedule.schedule_date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(schedule.id)}
                    className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AparScheduleList;