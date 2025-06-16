import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ScanLocation = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('id');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleContinueReport = () => {
    if (locationId) {
      navigate(`/check-area-report?locationId=${locationId}`);
    } else {
      toast.error("Tidak ada ID lokasi untuk melanjutkan laporan.");
    }
  };

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
            <>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                Anda telah berhasil memindai lokasi ini.
              </p>
              <Button onClick={handleContinueReport} className="mt-6 w-full">
                Lanjutkan Laporan
              </Button>
            </>
          ) : (
            <p className="text-lg text-red-500 dark:text-red-400">
              Terjadi kesalahan saat memuat detail lokasi.
            </p>
          )}
          <Button onClick={() => navigate('/')} variant="outline" className="mt-4 w-full">
            Kembali ke Beranda
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanLocation;