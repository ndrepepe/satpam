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
      console.log("Photo selected:", file.name, "Size:", file.size); // Log saat foto dipilih
    }
  };

  const handleTakePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmitReport = async () => {
    console.log("handleSubmitReport called."); // Log saat fungsi dipanggil
    console.log("Current state - user:", !!user, "locationId:", locationId, "photoFile:", !!photoFile, "locationName:", locationName);

    if (!user || !locationId || !photoFile || !locationName) {
      toast.error("Data laporan tidak lengkap. Pastikan Anda sudah mengambil foto dan lokasi terdeteksi.");
      console.error("Missing data for report submission:", { user: !!user, locationId, photoFile: !!photoFile, locationName });
      return;
    }

    setLoading(true);
    let supabasePhotoPublicUrl: string | null = null;
    let supabasePhotoFilePath: string | null = null;

    try {
      // 1. Upload photo to Supabase Storage temporarily
      const fileExtension = photoFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      supabasePhotoFilePath = `${user.id}/${fileName}`; // Store in user's folder

      console.log("Attempting to upload to Supabase Storage:", supabasePhotoFilePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('check-area-photos')
        .upload(supabasePhotoFilePath, photoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading to Supabase Storage:", uploadError);
        throw uploadError;
      }
      console.log("Successfully uploaded to Supabase Storage. Data:", uploadData);

      const { data: publicUrlData } = supabase.storage
        .from('check-area-photos')
        .getPublicUrl(supabasePhotoFilePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Gagal mendapatkan URL publik foto dari Supabase Storage.");
      }
      supabasePhotoPublicUrl = publicUrlData.publicUrl;
      console.log("Supabase Public URL:", supabasePhotoPublicUrl);

      // 2. Invoke Edge Function to move photo to R2 and get R2 URL
      console.log("Invoking upload-to-r2 Edge Function with:", {
        supabasePhotoUrl: supabasePhotoPublicUrl,
        userId: user.id,
        locationName: locationName,
        supabaseFilePath: supabasePhotoFilePath, // Pass original path for deletion
      });
      const { data: r2Data, error: r2Error } = await supabase.functions.invoke('upload-to-r2', {
        body: {
          supabasePhotoUrl: supabasePhotoPublicUrl,
          userId: user.id,
          locationName: locationName,
          supabaseFilePath: supabasePhotoFilePath, // Pass original path for deletion
        },
      });

      if (r2Error) {
        console.error("Error invoking upload-to-r2 Edge Function:", r2Error);
        throw new Error(`Gagal memindahkan foto ke R2: ${r2Error.message}`);
      }
      
      if (r2Data && r2Data.error) {
        console.error("Edge Function returned an error:", r2Data.error);
        throw new Error(`Edge Function returned error: ${r2Data.error}`);
      }
      console.log("Edge Function response (r2Data):", r2Data);

      const r2PhotoUrl = r2Data?.r2Url;
      if (!r2PhotoUrl) {
        throw new Error("URL R2 tidak diterima dari Edge Function.");
      }
      console.log("Final R2 Photo URL:", r2PhotoUrl);

      // 3. Save report to database with R2 URL
      console.log("Attempting to insert report into database with R2 URL:", r2PhotoUrl);
      const { error: insertError } = await supabase
        .from('check_area_reports')
        .insert({
          user_id: user.id,
          location_id: locationId,
          photo_url: r2PhotoUrl, // Save the R2 URL
        });

      if (insertError) {
        console.error("Error inserting report into database:", insertError);
        throw insertError;
      }
      console.log("Report successfully inserted into database.");

      toast.success("Laporan cek area berhasil dikirim dan foto disimpan di Cloudflare R2!");
      navigate('/satpam-dashboard', { state: { refresh: true } }); // Redirect to satpam dashboard and trigger refresh
    } catch (error: any) {
      toast.error(`Gagal mengirim laporan: ${error.message}`);
      console.error("Error submitting report (catch block):", error);
    } finally {
      setLoading(false);
      console.log("Loading set to false.");
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
              capture="user" // Mengaktifkan kamera depan
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
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Batal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckAreaReport;