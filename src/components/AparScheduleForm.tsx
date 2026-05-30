import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const AparScheduleForm: React.FC<{ onScheduleCreated: () => void }> = ({ onScheduleCreated }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState<{ id: string, first_name: string, last_name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name').eq('role', 'satpam');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedDate) {
      toast.error("Harap pilih petugas dan tanggal.");
      return;
    }

    setLoading(true);
    try {
      // Ambil semua lokasi APAR untuk dijadwalkan secara masal
      const { data: apars } = await supabase.from('apar_locations').select('id');
      
      if (!apars || apars.length === 0) {
        toast.error("Tidak ada lokasi APAR terdaftar.");
        return;
      }

      const schedules = apars.map(apar => ({
        user_id: selectedUser,
        apar_location_id: apar.id,
        schedule_date: selectedDate,
        status: 'pending'
      }));

      const { error } = await supabase.from('apar_schedules').insert(schedules);
      if (error) throw error;

      toast.success("Jadwal pengecekan APAR berhasil dibuat.");
      onScheduleCreated();
    } catch (error: any) {
      toast.error(`Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase">Tanggal Pengecekan</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-950 border-slate-800 text-white rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase">Petugas Satpam</label>
          <select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-slate-950 border-slate-800 text-white rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="">Pilih Petugas</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>
      </div>
      <Button 
        type="submit" 
        disabled={loading}
        className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-xl py-6 font-bold uppercase tracking-widest"
      >
        <ClipboardCheck className="mr-2 h-4 w-4" /> Buat Jadwal Pengecekan
      </Button>
    </form>
  );
};

export default AparScheduleForm;