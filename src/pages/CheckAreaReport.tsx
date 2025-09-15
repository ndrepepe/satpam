import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Helper function to resize and compress image
const resizeAndCompressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const MAX_DIMENSION = 1280; // Max width or height for the image
        const JPEG_QUALITY = 0.8; // JPEG quality (0.0 - 1.0)

        let width = img.width;
        let height = img.height;

        // Resize logic: scale down if either dimension exceeds MAX_DIMENSION
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          } else {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              // Fallback to original file if blob creation fails
              reject(new Error("Failed to create blob from canvas."));
            }
          }, 'image/jpeg', JPEG_QUALITY); // Convert to JPEG with specified quality
        } else {
          reject(new Error("Failed to get 2D context from canvas."));
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for processing."));
      };
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };
  });
};

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

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const originalFile = event.target.files[0];
      setLoading(true);
      try {
        const processedBlob = await resizeAndCompressImage(originalFile);
        // Create a new File object from the processed Blob
        const processedFile = new File([processedBlob], originalFile.name.replace(/\.[^/.]+$/, "") + '.jpeg', {
          type: 'image/jpeg', // Force type to JPEG as we are converting to JPEG
          lastModified: Date.now(),
        });

        setPhotoFile(processedFile);
        setPhotoPreviewUrl(URL.createObjectURL(processedFile));
        toast.success("Foto berhasil dioptimalkan!");
      } catch (error: any) {
        toast.error(`Gagal mengoptimalkan foto: ${error.message}. Menggunakan foto asli.`);
        console.error("Error optimizing image:", error);
        setPhotoFile(originalFile); // Fallback to original file
        setPhotoPreviewUrl(URL.createObjectURL(originalFile));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTakePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmitReport = async () => {
    if (!user || !locationId || !photoFile || !locationName) {
      toast.error("Data laporan tidak lengkap. Pastikan Anda sudah mengambil foto dan lokasi terdeteksi.");
      return;
    }

    setLoading(true);

    try {
      // Convert Blob to ArrayBuffer and then to a plain array of numbers for JSON transfer
      const arrayBuffer = await photoFile.arrayBuffer();
      const photoDataArray = Array.from(new Uint8Array(arrayBuffer));

      // Invoke Edge Function to upload photo to Supabase Storage
      const { data, error } = await supabase.functions.invoke('upload-photo', { // Mengganti nama fungsi
        body: {
          userId: user.id,
          locationId: locationId,
          photoData: photoDataArray, // Send as array of numbers
          contentType: photoFile.type
        },
      });

      if (error) {
        console.error("Error invoking upload-photo Edge Function:", error);
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (data && data.error) {
        throw new Error(`Edge Function returned error: ${data.error}`);
      }

      if (!data?.publicUrl) {
        throw new Error("Gagal mendapatkan URL publik foto dari Supabase Storage.");
      }

      // Simpan report ke database Supabase
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
            <Button onClick={handleTakePhotoClick} className="w-full" disabled={loading}>
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