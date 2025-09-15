import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QrReader } from 'react-qr-reader'; // Import QrReader

const ScanLocation = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('id');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [expectedQrData, setExpectedQrData] = useState<string | null>(null); // Untuk menyimpan data QR dari DB
  const [scannedQrData, setScannedQrData] = useState<string | null>(null); // Untuk menyimpan data QR yang dipindai
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'mismatch' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLocation = async () => {
      if (locationId) {
        const { data, error } = await supabase
          .from('locations')
          .select('name, qr_code_data') // Ambil qr_code_data
          .eq('id', locationId)
          .single();

        if (error) {
          console.error("Error fetching location:", error);
          toast.error("Lokasi tidak ditemukan atau terjadi kesalahan.");
          setLocationName("Lokasi Tidak Ditemukan");
          setExpectedQrData(null);
          setScanStatus('error');
        } else if (data) {
          setLocationName(data.name);
          setExpectedQrData(data.qr_code_data);
          setScanStatus('scanning'); // Mulai memindai setelah data dimuat
          toast.info(`Siap memindai QR Code untuk lokasi: ${data.name}`);
        }
      } else {
        setLocationName("ID Lokasi Tidak Disediakan");
        setExpectedQrData(null);
        setScanStatus('error');
        toast.error("ID Lokasi tidak disediakan.");
      }
      setLoading(false);
    };

    fetchLocation();
  }, [locationId]);

  const handleScan = (result: any, error: any) => {
    if (result) {
      const data = result?.text;
      setScannedQrData(data);
      if (data === expectedQrData) {
        setScanStatus('success');
        toast.success(`QR Code cocok! Lokasi: ${locationName}`);
      } else {
        setScanStatus('mismatch');
        toast.error("QR Code tidak cocok dengan lokasi yang dipilih.");
      }
    }

    if (error) {
      // console.error(error); // Log error scanner untuk debugging
      if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
        setScanStatus('error');
        toast.error("Akses kamera ditolak atau tidak ditemukan. Harap izinkan akses kamera.");
      } else if (error.name === 'NotReadableError') {
        setScanStatus('error');
        toast.error("Kamera tidak dapat diakses. Mungkin sedang digunakan oleh aplikasi lain.");
      }
    }
  };

  const handleContinueReport = () => {
    if (locationId && scanStatus === 'success') {
      navigate(`/check-area-report?locationId=${locationId}`);
    } else {
      toast.error("Harap pindai QR Code yang benar terlebih dahulu.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat detail lokasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md mx-auto p-8 text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
            {locationName || "Memuat Lokasi..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {locationName && locationName !== "Lokasi Tidak Ditemukan" && locationName !== "ID Lokasi Tidak Disediakan" ? (
            <>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                Silakan pindai QR Code lokasi ini.
              </p>
              <div className="w-full max-w-xs mx-auto border rounded-lg overflow-hidden">
                {scanStatus === 'scanning' || scanStatus === 'mismatch' ? (
                  <QrReader
                    onResult={handleScan}
                    constraints={{ facingMode: 'environment' }} // Gunakan kamera belakang
                    scanDelay={500} // Jeda antar pemindaian
                    videoContainerStyle={{ width: '100%', paddingTop: '100%' }} // Pertahankan rasio aspek
                    videoStyle={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    {scanStatus === 'success' && <p className="text-green-600 font-bold">QR Code Cocok!</p>}
                    {scanStatus === 'error' && <p className="text-red-600 font-bold">Gagal Memuat Kamera atau Akses Ditolak</p>}
                    {scanStatus === 'idle' && <p>Memuat Scanner...</p>}
                  </div>
                )}
              </div>
              {scannedQrData && (
                <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                  Data Dipindai: {scannedQrData}
                </p>
              )}
              {scanStatus === 'success' && (
                <p className="text-green-600 font-semibold">QR Code berhasil dipindai dan cocok!</p>
              )}
              {scanStatus === 'mismatch' && (
                <p className="text-red-600 font-semibold">QR Code tidak cocok. Harap pindai QR Code yang benar.</p>
              )}
              {scanStatus === 'error' && (
                <p className="text-red-600 font-semibold">Terjadi kesalahan pada scanner atau akses kamera ditolak.</p>
              )}

              <Button
                onClick={handleContinueReport}
                className="mt-6 w-full"
                disabled={scanStatus !== 'success'}
              >
                Lanjutkan Laporan
              </Button>
            </>
          ) : (
            <p className="text-lg text-red-500 dark:text-red-400">
              Terjadi kesalahan saat memuat detail lokasi.
            </p>
          )}
          <Button onClick={() => navigate('/satpam-dashboard')} variant="outline" className="mt-4 w-full">
            Kembali ke Daftar Lokasi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanLocation;