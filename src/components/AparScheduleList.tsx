"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, AlertTriangle, Trash2, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Schedule {
  id: string;
  aparId: string;
  aparName?: string;
  location?: string;
  dueDate: string;
  assignedTo: string;
  status: 'pending' | 'completed' | 'overdue';
  notes?: string;
}

interface AparScheduleListProps {
  refreshKey: number;
}

const AparScheduleList: React.FC<AparScheduleListProps> = ({ refreshKey }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    // Load schedules from localStorage
    const storedSchedules = localStorage.getItem('apar_schedules');
    if (storedSchedules) {
      try {
        setSchedules(JSON.parse(storedSchedules));
      } catch (e) {
        console.error("Error parsing schedules", e);
      }
    } else {
      // Fallback mock data if empty
      const mockSchedules: Schedule[] = [
        {
          id: '1',
          aparId: 'APAR-001',
          aparName: 'APAR Powder 6kg',
          location: 'Lobby Utama - Lantai 1',
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
          assignedTo: 'Budi Santoso',
          status: 'pending',
          notes: 'Pengecekan rutin bulanan tekanan & segel'
        },
        {
          id: '2',
          aparId: 'APAR-002',
          aparName: 'APAR CO2 5kg',
          location: 'Ruang Server - Lantai 2',
          dueDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], // 3 days ago
          assignedTo: 'Andi Wijaya',
          status: 'overdue',
          notes: 'Segera cek kondisi tabung dan nozzle'
        },
        {
          id: '3',
          aparId: 'APAR-003',
          aparName: 'APAR Foam 9L',
          location: 'Kantin Belakang',
          dueDate: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
          assignedTo: 'Budi Santoso',
          status: 'completed',
          notes: 'Selesai diperiksa, kondisi prima'
        }
      ];
      localStorage.setItem('apar_schedules', JSON.stringify(mockSchedules));
      setSchedules(mockSchedules);
    }
  }, [refreshKey]);

  const handleDelete = (id: string) => {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    localStorage.setItem('apar_schedules', JSON.stringify(updated));
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
    const matchesSearch = 
      (schedule.aparId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (schedule.location?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (schedule.assignedTo?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
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
              Daftar Jadwal Pemeriksaan APAR
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">Memantau jadwal pengecekan aktif dan riwayat pemeriksaan</p>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('overdue')}
                className={`h-7 px-2.5 text-xs rounded-lg font-mono uppercase ${statusFilter === 'overdue' ? 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30' : 'text-slate-400 hover:text-white'}`}
              >
                Terlambat
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredSchedules.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">
            Tidak ada jadwal pemeriksaan yang ditemukan.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredSchedules.map((schedule) => (
              <div key={schedule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/20 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-orange-400">{schedule.aparId}</span>
                    {schedule.aparName && (
                      <span className="text-xs text-slate-300 font-medium">({schedule.aparName})</span>
                    )}
                    {getStatusBadge(schedule.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                    {schedule.location && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">Lokasi:</span>
                        <span className="text-slate-300">{schedule.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Petugas:</span>
                      <span className="text-slate-300 font-medium">{schedule.assignedTo}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Batas Waktu:</span>
                      <span className="text-slate-300 font-mono">{schedule.dueDate}</span>
                    </div>
                  </div>

                  {schedule.notes && (
                    <p className="text-xs text-slate-500 italic mt-1">
                      Catatan: {schedule.notes}
                    </p>
                  )}
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