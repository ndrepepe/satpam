import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ClipboardCheck, Building2 } from 'lucide-react';
import { format } from 'date-fns';

const AparScheduleForm: React.FC<{ onScheduleCreated: () => void }> = ({ onScheduleCreated }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('Semua Gedung');
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
    if (!selectedUser || !selectedDate || !selectedBuilding) {
      toast.error("Harap lengkapi semua pilihan.");
      return;
    }

    setLoading(true);
    try {
      // Ambil lokasi APAR berdasarkan filter gedung
      let query = supabase.from('apar_locations').select('id');
      
      if (selectedBuilding !== 'Semua Gedung') {
        query = query.eq('posisi_gedung', selectedBuilding);
      }

      const { data: apars, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      if (!apars || apars.length === 0) {
        toast.error(`Tidak ada APAR yang terdaftar di ${selectedBuilding}.`);
        setLoading(false);
        return;
      }

      const schedules = apars.map(apar => ({
        user_id: selectedUser,
        apar_location_id: apar.id,
        schedule_date: selectedDate,
        status: 'pending'
      }));

      const { error: insertError } = await supabase.from('apar_schedules').insert(schedules);
      if (insertError) throw insertError;

      toast.success(`Jadwal pengecekan APAR di ${selectedBuilding} berhasil dibuat.`);
      onScheduleCreated();
    } catch (error: any) {
      toast.error(`Gagal membuat jadwal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Tanggal Pengecekan</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-950 border-slate-800 text-white rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Posisi Gedung</label>
          <select 
            value={selectedBuilding} 
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="w-full bg-slate-950 border-slate-800 text-white rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
          >
            <option value="Semua Gedung">Semua Gedung</option>
            <option value="Gedung Barat">Gedung Barat</option>
            <option value="Gedung Timur">Gedung Timur</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Petugas Satpam</label>
          <select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-slate-950 border-slate-800 text-white rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
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
        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl py-6 font-bold uppercase tracking-widest shadow-lg shadow-orange-900/20 transition-all duration-300"
      >
        <ClipboardCheck className="mr-2 h-5 w-5" /> Buat Jadwal Pengecekan
      </Button>
    </form>
  );
};

export default AparScheduleForm;