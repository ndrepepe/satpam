import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Camera, MapPin, UploadCloud, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { uploadToSupabase } from '@/utils/supabaseStorage';

const CheckAreaReport = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('locationId');
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();

  const [locationName, setLocationName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { navigate('/login'); return; }

    const fetchLocation = async () => {
      if (!locationId) { navigate('/'); return; }
      const { data, error } = await supabase.from('locations').select('name').eq('id', locationId).single();
      if (data) setLocationName(data.name);
      setLoading(false);
    };
    fetchLocation();
  }, [locationId, navigate, user, sessionLoading]);

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
          if (width > height) {
            if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
          } else {
            if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(), 'image/jpeg', quality);
        };
      };
    });
  };

  const handleSubmitReport = async () => {
    if (!user || !locationId) return;
    setLoading(true);
    try {
      let publicUrl = null;

      // Jika ada foto, lakukan proses upload
      if (photoFile) {
        const compressedBlob = await compressImage(photoFile, 640, 640, 0.5);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `uploads/${user.id}/${locationId}-${timestamp}.jpg`;
        publicUrl = await uploadToSupabase(compressedBlob, filename, 'image/jpeg');
      }

      const { error: insertError } = await supabase.from('check_area_reports').insert({
        user_id: user.id,
        location_id: locationId,
        photo_url: publicUrl, // Bisa null jika tidak ada foto
      });

      if (insertError) throw insertError;
      toast.success("Laporan patroli berhasil dikirim!");
      navigate('/satpam-dashboard');
    } catch (error: any) {
      toast.error(`Gagal mengirim laporan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <UploadCloud className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Menyiapkan formulir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 dark:bg-slate-950 py-8 px-4 flex flex-col justify-center">
      <Card className="w-full max-w-md mx-auto border-none shadow-xl shadow-slate-100 dark:shadow-none rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 mb-2">
            <MapPin className="h-5 w-5" />
            <span className="text-xs font-bold tracking-wider uppercase">Lokasi Patroli</span>
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {locationName || "Memuat Lokasi..."}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tekan tombol kirim di bawah untuk menyelesaikan laporan patroli. Anda juga dapat menyertakan foto (opsional).
          </p>

          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shadow-inner">
            {photoPreviewUrl ? (
              <img src={photoPreviewUrl} alt="Pratinjau" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6 space-y-2 text-slate-400">
                <Camera className="h-12 w-12 mx-auto stroke-[1.5]" />
                <p className="text-xs font-medium">Foto Bukti (Opsional)</p>
              </div>
            )}
          </div>

          <input 
            type="file" accept="image/*" capture="environment" 
            onChange={handlePhotoChange} ref={fileInputRef} className="hidden" 
          />

          <div className="space-y-3">
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline"
              className="w-full py-6 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl flex items-center justify-center space-x-2"
            >
              <Camera className="h-5 w-5" />
              <span>{photoFile ? "Ganti Foto" : "Ambil Foto (Opsional)"}</span>
            </Button>

            <Button 
              onClick={handleSubmitReport} 
              disabled={loading}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Kirim Laporan Sekarang</span>
            </Button>

            <Button 
              onClick={() => navigate('/satpam-dashboard')} 
              variant="ghost" 
              className="w-full py-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-2xl flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Batal</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckAreaReport;