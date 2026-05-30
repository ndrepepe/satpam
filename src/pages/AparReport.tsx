import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Flame, CheckCircle, AlertTriangle, XCircle, Camera } from 'lucide-react';

const AparReport = () => {
  const [searchParams] = useSearchParams();
  const aparId = searchParams.get('id');
  const navigate = useNavigate();
  const { user } = useSession();
  const [status, setStatus] = useState<'baik' | 'perlu_perbaikan' | 'rusak' | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!status || !user || !aparId) {
      toast.error("Harap pilih status APAR.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('apar_reports').insert({
        apar_location_id: aparId,
        user_id: user.id,
        status: status,
        notes: notes,
      });

      if (error) throw error;

      // Update status jadwal jika ada
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('apar_schedules')
        .update({ status: 'completed' })
        .eq('apar_location_id', aparId)
        .eq('user_id', user.id)
        .eq('schedule_date', today);

      toast.success("Laporan APAR berhasil dikirim!");
      navigate('/satpam-dashboard');
    } catch (error: any) {
      toast.error(`Gagal mengirim laporan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md bg-slate-950/80 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <CardHeader className="text-center border-b border-slate-800/50">
          <Flame className="h-8 w-8 text-orange-500 mx-auto mb-2" />
          <CardTitle className="text-white uppercase tracking-widest font-bold">Laporan Kondisi APAR</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Kondisi Fisik & Tekanan</label>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setStatus('baik')}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${status === 'baik' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}
              >
                <div className="flex items-center"><CheckCircle className="mr-3 h-5 w-5" /> <span>Kondisi Baik</span></div>
                {status === 'baik' && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />}
              </button>
              <button 
                onClick={() => setStatus('perlu_perbaikan')}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${status === 'perlu_perbaikan' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}
              >
                <div className="flex items-center"><AlertTriangle className="mr-3 h-5 w-5" /> <span>Perlu Perbaikan</span></div>
                {status === 'perlu_perbaikan' && <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />}
              </button>
              <button 
                onClick={() => setStatus('rusak')}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${status === 'rusak' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}
              >
                <div className="flex items-center"><XCircle className="mr-3 h-5 w-5" /> <span>Rusak / Kosong</span></div>
                {status === 'rusak' && <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Catatan Tambahan (Opsional)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan detail jika ada temuan..."
              className="w-full bg-slate-900/80 border-slate-800 text-white rounded-xl p-4 h-24 outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={loading || !status}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-xl py-6 font-bold uppercase tracking-widest"
          >
            Kirim Laporan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AparReport;