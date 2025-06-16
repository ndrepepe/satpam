import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const ScanLocation = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('id');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocation = async () => {
      if (locationId) {
        const { data, error } = await supabase
          .from('locations')
          .select('name')
          .eq('id', locationId)
          .single();

        if (error) {
          console.error("Error fetching location:", error);
          toast.error("Lokasi tidak ditemukan atau terjadi kesalahan.");
          setLocationName("Lokasi Tidak Ditemukan");
        } else if (data) {
          setLocationName(data.name);
          toast.success(`Berhasil memindai lokasi: ${data.name}`);
        }
      } else {
        setLocationName("ID Lokasi Tidak Disediakan");
      }
      setLoading(false);
    };

    fetchLocation();
  }, [locationId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memindai lokasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Card className="max-w-md mx-auto p-8 text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
            {locationName || "Memuat Lokasi..."}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locationName && locationName !== "Lokasi Tidak Ditemukan" && locationName !== "ID Lokasi Tidak Disediakan" ? (
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Anda telah berhasil memindai lokasi ini.
            </p>
          ) : (
            <p className="text-lg text-red-500 dark:text-red-400">
              Terjadi kesalahan saat memuat detail lokasi.
            </p>
          )}
          <Button onClick={() => window.history.back()} className="mt-6">
            Kembali
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanLocation;