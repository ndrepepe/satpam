import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QrReader } from 'react-qr-reader';
import { MapPin, Camera, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

const ScanLocation = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('id');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [expectedQrData, setExpectedQrData] = useState<string | null>(null);
  const [scannedQrData, setScannedQrData] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'mismatch' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLocation = async () => {
      if (locationId) {
        const { data, error } = await supabase
          .from('locations')
          .select('name, qr_code_data')
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
          setScanStatus('scanning');
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
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <Camera className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Menyiapkan kamera...</p>
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
          {locationName && locationName !== "Lokasi Tidak Ditemukan" && locationName !== "ID Lokasi Tidak Disediakan" ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Arahkan kamera ponsel Anda ke stiker QR Code yang tertempel di lokasi ini.
              </p>

              {/* Scanner Container with Overlay */}
              <div className="relative w-full max-w-xs mx-auto aspect-square rounded-2xl overflow-hidden bg-slate-950 shadow-inner border border-slate-800">
                {scanStatus === 'scanning' || scanStatus === 'mismatch' ? (
                  <>
                    <QrReader
                      onResult={handleScan}
                      constraints={{ facingMode: 'environment' }}
                      scanDelay={500}
                      videoContainerStyle={{ width: '100%', paddingTop: '100%' }}
                      videoStyle={{ objectFit: 'cover' }}
                    />
                    {/* Scanning Frame Overlay */}
                    <div className="absolute inset-0 pointer-events-none border-2 border-indigo-500/30 m-8 rounded-xl">
                      {/* Corner Brackets */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1 rounded-tl-md" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1 rounded-tr-md" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1 rounded-bl-md" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1 rounded-br-md" />
                      {/* Laser Line */}
                      <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-lg shadow-indigo-500 animate-pulse top-1/2 -translate-y-1/2" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    {scanStatus === 'success' && (
                      <div className="space-y-3">
                        <div className="mx-auto w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-bold text-emerald-500">QR Code Cocok!</p>
                      </div>
                    )}
                    {scanStatus === 'error' && (
                      <div className="space-y-3">
                        <div className="mx-auto w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-medium text-red-400">Gagal mengakses kamera. Izinkan izin kamera.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {scanStatus === 'mismatch' && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-center">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                    QR Code tidak cocok dengan lokasi ini. Silakan cari stiker QR yang benar.
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleContinueReport}
                  disabled={scanStatus !== 'success'}
                  className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all duration-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Lanjutkan Laporan
                </Button>
                
                <Button 
                  onClick={() => navigate('/satpam-dashboard')} 
                  variant="outline" 
                  className="w-full py-6 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Kembali ke Daftar Lokasi</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <p className="text-sm text-red-500 font-medium">Terjadi kesalahan saat memuat detail lokasi.</p>
              <Button onClick={() => navigate('/satpam-dashboard')} className="w-full">
                Kembali ke Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanLocation;