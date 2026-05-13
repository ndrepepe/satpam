import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(), file.type, quality);
        };
      };
    });
  };

  const handleSubmitReport = async () => {
    if (!user || !locationId || !photoFile) return;
    setLoading(true);
    try {
      const compressedBlob = await compressImage(photoFile, 1024, 1024, 0.7);
      const arrayBuffer = await compressedBlob.arrayBuffer();
      const photoData = Array.from(new Uint8Array(arrayBuffer));

      const { data, error } = await supabase.functions.invoke('https://gxbzdhrhlhrjdgzcfzbw.supabase.co/functions/v1/upload-selfie-to-supabase', {
        body: {
          userId: user.id,
          locationId: locationId,
          photoData: photoData,
          contentType: compressedBlob.type
        },
      });

      if (error || !data?.publicUrl) throw new Error(error?.message || "Gagal upload");

      const { error: insertError } = await supabase.from('check_area_reports').insert({
        user_id: user.id,
        location_id: locationId,
        photo_url: data.publicUrl,
      });

      if (insertError) throw insertError;
      toast.success("Laporan terkirim!");
      navigate('/satpam-dashboard');
    } catch (error: any) {
      toast.error(`Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Memuat...</div>;

  return (
    <div className="p-4 flex justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader><CardTitle>Laporan Cek Area</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="font-semibold">Lokasi: {locationName}</p>
          {photoPreviewUrl && <img src={photoPreviewUrl} className="w-full rounded shadow" />}
          <input type="file" accept="image/*" capture="user" onChange={handlePhotoChange} ref={fileInputRef} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} className="w-full">Ambil Foto</Button>
          <Button onClick={handleSubmitReport} className="w-full" disabled={!photoFile || loading}>Kirim Laporan</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckAreaReport;