import React, { useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Flame, CheckCircle, AlertTriangle, XCircle, Camera, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { uploadToBackblaze } from '@/utils/backblaze';

const AparReport = () => {
  const [searchParams] = useSearchParams();
  const aparId = searchParams.get('id');
  const navigate = useNavigate();
  const { user } = useSession();
  
  const [status, setStatus] = useState<'baik' | 'perlu_perbaikan' | 'rusak' | null>(null);
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const file = event.target.files[0];
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(), file.type, quality);
        };
      };
    });
  };

  const handleSubmit = async () => {
    if (!status || !user || !aparId) {
      toast.error("Harap pilih status APAR.");
      return;
    }

    if (!photoFile) {
      toast.error("Harap ambil foto selfie bersama APAR terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      // 1. Kompres foto selfie
      const compressedBlob = await compressImage(photoFile, 1024, 1024, 0.7);
      
      const fileExt = compressedBlob.type.split('/')[1] || 'jpg';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `uploads/apar/${user.id}/${aparId}-${timestamp}.${fileExt}`;

      // 2. Unggah foto selfie ke Backblaze B2
      const publicUrl = await uploadToBackblaze(compressedBlob, filename, compressedBlob.type);

      // 3. Simpan laporan ke database (termasuk photo_url Backblaze B2)
      const { error } = await supabase.from('apar_reports').insert({
        apar_location_id: aparId,
        user_id: user.id,
        status: status,
        notes: notes,
        photo_url: publicUrl,
      });

      if (error) throw error;

      // 4. Update status jadwal jika ada
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
          <CardTitle className="text-white uppercase tracking-widest font-bold">Laporan Kondisi APAR</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Pilihan Kondisi */}
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

          {/* Bukti Foto Selfie */}
          <div className="space-y-3">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Foto Selfie Bersama APAR</label>
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col items-center justify-center shadow-inner">
              {photoPreviewUrl ? (
                <img 
                  src={photoPreviewUrl} 
                  alt="Pratinjau Selfie APAR" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-500">
                  <Camera className="h-12 w-12 mx-auto stroke-[1.5]" />
                  <p className="text-xs font-medium">Belum ada foto selfie</p>
                </div>
              )}
            </div>

            <input 
              type="file" 
              accept="image/*" 
              capture="user" 
              onChange={handlePhotoChange} 
              ref={fileInputRef} 
              className="hidden" 
            />

            <Button 
              type="button"
              onClick={() => fileInputRef.current?.click()} 
              className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono text-xs uppercase rounded-xl flex items-center justify-center space-x-2 transition-all duration-200"
            >
              <Camera className="h-4 w-4 text-orange-500" />
              <span>{photoFile ? "Ambil Ulang Foto" : "Ambil Foto Selfie"}</span>
            </Button>
          </div>

          {/* Catatan Tambahan */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Catatan Tambahan (Opsional)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan detail jika ada temuan..."
              className="w-full bg-slate-900/80 border-slate-800 text-white rounded-xl p-4 h-24 outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          {/* Tombol Kirim */}
          <div className="space-y-3 pt-2">
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !status || !photoFile}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl py-6 font-bold uppercase tracking-widest shadow-lg shadow-orange-900/20 disabled:bg-slate-800 disabled:text-slate-500"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" /> Kirim Laporan APAR
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)} 
              className="w-full text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AparReport;