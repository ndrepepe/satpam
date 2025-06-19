import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const CheckAreaReport = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('locationId');
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();

  const [locationName, setLocationName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      setError("Anda harus login untuk membuat laporan.");
      navigate('/login');
      return;
    }

    const fetchLocation = async () => {
      try {
        if (!locationId) {
          throw new Error("ID Lokasi tidak ditemukan");
        }

        const { data, error: fetchError } = await supabase
          .from('locations')
          .select('name')
          .eq('id', locationId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Lokasi tidak ditemukan");

        setLocationName(data.name);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Gagal memuat detail lokasi");
        toast.error(err.message || "Gagal memuat detail lokasi");
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [locationId, navigate, user, sessionLoading]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (event.target.files?.[0]) {
        const file = event.target.files[0];
        
        // Validasi file
        if (file.size > 5 * 1024 * 1024) { // 5MB
          throw new Error("Ukuran foto maksimal 5MB");
        }
        if (!file.type.startsWith('image/')) {
          throw new Error("File harus berupa gambar");
        }

        setPhotoFile(file);
        setPhotoPreviewUrl(URL.createObjectURL(file));
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTakePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmitReport = async () => {
    if (!user || !locationId || !photoFile || !locationName) {
      const errorMsg = "Data tidak lengkap. Pastikan: " + 
        (!user ? "Anda sudah login" : 
         !locationId ? "Lokasi terdeteksi" : 
         !photoFile ? "Foto sudah diambil" : "");
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Upload ke Supabase Storage sementara
      const fileExtension = photoFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('check-area-photos')
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      // 2. Panggil Edge Function untuk upload ke R2
      const { data, error: edgeError } = await supabase.functions.invoke('upload-to-r2', {
        body: {
          supabasePhotoUrl: supabase.storage
            .from('check-area-photos')
            .getPublicUrl(filePath).data.publicUrl,
          userId: user.id,
          locationName,
          supabaseFilePath: filePath
        },
      });

      if (edgeError) throw edgeError;
      if (data?.error) throw new Error(data.error);

      toast.success("Laporan berhasil dikirim!");
      navigate('/satpam-dashboard');
    } catch (err: any) {
      console.error("Error submitting report:", err);
      setError(err.message || "Gagal mengirim laporan");
      toast.error(err.message || "Gagal mengirim laporan");
    } finally {
      setLoading(false);
    }
  };

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat halaman laporan...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Laporan Cek Area
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {locationName ? (
            <p className="text-lg text-center">
              Lokasi: <span className="font-semibold">{locationName}</span>
            </p>
          ) : (
            <p className="text-lg text-red-500 text-center">
              Lokasi tidak valid
            </p>
          )}

          <div className="flex flex-col items-center space-y-4">
            {photoPreviewUrl ? (
              <div className="relative">
                <img 
                  src={photoPreviewUrl} 
                  alt="Preview Foto" 
                  className="w-full max-w-xs h-auto rounded-md shadow-md"
                />
                <button
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="w-full max-w-xs h-48 bg-gray-200 dark:bg-gray-700 rounded-md flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Belum ada foto</span>
              </div>
            )}
            
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhotoChange}
              ref={fileInputRef}
              className="hidden"
            />
            <Button 
              onClick={handleTakePhotoClick} 
              className="w-full"
              disabled={loading}
            >
              {photoPreviewUrl ? "Ambil Foto Baru" : "Ambil Foto"}
            </Button>
          </div>

          <div className="flex flex-col space-y-2">
            <Button
              onClick={handleSubmitReport}
              className="w-full"
              disabled={!locationId || !photoFile || loading}
            >
              {loading ? "Mengirim..." : "Kirim Laporan"}
            </Button>
            <Button 
              onClick={() => navigate('/satpam-dashboard')} 
              variant="outline" 
              className="w-full"
              disabled={loading}
            >
              Kembali
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckAreaReport;