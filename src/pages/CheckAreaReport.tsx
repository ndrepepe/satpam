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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk membuat laporan.");
      navigate('/login');
      return;
    }

    const fetchLocation = async () => {
      if (!locationId) {
        toast.error("ID Lokasi tidak ditemukan. Kembali ke beranda.");
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .eq('id', locationId)
        .single();

      if (error) {
        console.error("Error fetching location for report:", error);
        toast.error("Gagal memuat detail lokasi.");
        navigate('/');
      } else if (data) {
        setLocationName(data.name);
      }
      setLoading(false);
    };

    fetchLocation();
  }, [locationId, navigate, user, sessionLoading]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleTakePhotoClick = () => {
    fileInputRef.current?.click();
  };

  // Fungsi untuk mengompres gambar
  const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Sesuaikan ukuran jika melebihi maxWidth atau maxHeight
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error("Could not get canvas context"));
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          }, file.type, quality); // Gunakan tipe file asli dan kualitas yang ditentukan
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmitReport = async () => {
    if (!user || !locationId || !photoFile || !locationName) {
      toast.error("Data laporan tidak lengkap. Pastikan Anda sudah mengambil foto dan lokasi terdeteksi.");
      return;
    }

    setLoading(true);

    try {
      // Kompres gambar sebelum diunggah
      const compressedBlob = await compressImage(photoFile, 1024, 1024, 0.8); // Max 1024px, kualitas 80%
      
      // Jika ukuran file masih terlalu besar, coba kompres lagi dengan kualitas lebih rendah
      let finalBlob = compressedBlob;
      let currentQuality = 0.8;
      const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 KB

      while (finalBlob.size > MAX_FILE_SIZE_BYTES && currentQuality > 0.1) {
        currentQuality -= 0.1;
        finalBlob = await compressImage(photoFile, 1024, 1024, currentQuality);
      }

      // Konversi Blob ke ArrayBuffer
      const arrayBuffer = await finalBlob.arrayBuffer();
      // Konversi ke array number untuk JSON
      const photoData = Array.from(new Uint8Array(arrayBuffer));

      // Panggil Edge Function yang benar
      const { data, error } = await supabase.functions.invoke('upload-selfie-to-supabase', {
        body: {
          userId: user.id,
          locationId: locationId,
          photoData: photoData,
          contentType: finalBlob.type // Gunakan tipe konten dari blob yang sudah dikompres
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.publicUrl) {
        throw new Error("Gagal mendapatkan URL publik foto dari Supabase Storage.");
      }

      // Simpan report ke database
      const { error: insertError } = await supabase
        .from('check_area_reports')
        .insert({
          user_id: user.id,
          location_id: locationId,
          photo_url: data.publicUrl,
        });

      if (insertError) {
        throw insertError;
      }

      toast.success("Laporan cek area berhasil dikirim dan foto disimpan di Supabase Storage!");
      navigate('/satpam-dashboard');
    } catch (error: any) {
      toast.error(`Gagal mengirim laporan: ${error.message}`);
      console.error("Error submitting report:", error);
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
      <Card className="w-full max-w-md mx-auto text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Cek Area</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {locationName ? (
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Lokasi: <span className="font-semibold">{locationName}</span>
            </p>
          ) : (
            <p className="text-lg text-red-500 dark:text-red-400">Lokasi tidak valid.</p>
          )}

          <div className="flex flex-col items-center space-y-4">
            {photoPreviewUrl ? (
              <img src={photoPreviewUrl} alt="Selfie Preview" className="w-full max-w-xs h-auto rounded-md shadow-md object-cover" />
            ) : (
              <div className="w-full max-w-xs h-48 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-500 dark:text-gray-400">
                Tidak ada foto
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
            <Button onClick={handleTakePhotoClick} className="w-full">
              Ambil Foto Selfie
            </Button>
          </div>

          <Button
            onClick={handleSubmitReport}
            className="w-full"
            disabled={!locationId || !photoFile || loading}
          >
            {loading ? "Mengirim Laporan..." : "Kirim Laporan"}
          </Button>
          <Button onClick={() => navigate('/satpam-dashboard')} variant="outline" className="w-full">
            Batal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckAreaReport;