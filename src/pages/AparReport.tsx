import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Flame, CheckCircle, AlertTriangle, XCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

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
        photo_url: null,
      });

      if (error) throw error;

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
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md bg-slate-950/80 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <CardHeader className="text-center border-b border-slate-800/50">
          <Flame className="h-8 w-8 text-orange-500 mx-auto mb-2" />
          <CardTitle className="text-white uppercase tracking-widest font-bold">Status Kondisi APAR</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Kondisi Fisik & Tekanan</label>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setStatus('baik')} className={`flex items-center justify-between p-5 rounded-xl border transition-all ${status === 'baik' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                <div className="flex items-center font-bold"><CheckCircle className="mr-3 h-5 w-5" /> <span>Kondisi Baik</span></div>
              </button>
              <button onClick={() => setStatus('perlu_perbaikan')} className={`flex items-center justify-between p-5 rounded-xl border transition-all ${status === 'perlu_perbaikan' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                <div className="flex items-center font-bold"><AlertTriangle className="mr-3 h-5 w-5" /> <span>Perlu Perbaikan</span></div>
              </button>
              <button onClick={() => setStatus('rusak')} className={`flex items-center justify-between p-5 rounded-xl border transition-all ${status === 'rusak' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                <div className="flex items-center font-bold"><XCircle className="mr-3 h-5 w-5" /> <span>Rusak / Kosong</span></div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Catatan (Opsional)</label>
            <textarea 
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Berikan keterangan jika ada kerusakan..."
              className="w-full bg-slate-900/80 border-slate-800 text-white rounded-xl p-4 h-24 outline-none focus:ring-2 focus:ring-orange-500/30 text-sm"
            />
          </div>

          <div className="space-y-3 pt-2">
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !status}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl py-6 font-bold uppercase tracking-widest shadow-lg shadow-orange-900/20 text-lg"
            >
              <CheckCircle2 className="mr-2 h-6 w-6" /> Kirim Laporan
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-slate-400">
              <ArrowLeft className="mr-2 h-4 w-4" /> Batal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AparReport;