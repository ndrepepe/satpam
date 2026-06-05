import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QrReader } from 'react-qr-reader';
import { Flame, Camera, ArrowLeft, CheckCircle2 } from 'lucide-react';

const AparScan = () => {
  const [searchParams] = useSearchParams();
  const aparId = searchParams.get('id');
  const [aparName, setAparName] = useState<string | null>(null);
  const [expectedQr, setExpectedQr] = useState<string | null>(null);
  const [status, setStatus] = useState<'scanning' | 'success' | 'error'>('scanning');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApar = async () => {
      if (!aparId) return;
      const { data } = await supabase.from('apar_locations').select('name, qr_code_data').eq('id', aparId).single();
      if (data) {
        setAparName(data.name);
        setExpectedQr(data.qr_code_data);
      }
    };
    fetchApar();
  }, [aparId]);

  // Fungsi pembantu untuk mengekstrak UUID dari teks apa pun
  const extractUUID = (text: string): string | null => {
    const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match ? match[0].toLowerCase() : null;
  };

  const handleScan = (result: any, error: any) => {
    // Jika sudah sukses, abaikan frame pemindaian berikutnya
    if (status === 'success') return;

    if (result) {
      const scannedText = result.text || result.getText?.();
      if (!scannedText) return;

      const scannedUuid = extractUUID(scannedText);
      const targetUuid = extractUUID(aparId || '') || aparId?.toLowerCase().trim();

      if (!targetUuid) return;

      // Verifikasi super tangguh menggunakan UUID hasil ekstraksi
      if (scannedUuid === targetUuid || scannedText.toLowerCase().includes(targetUuid)) {
        setStatus('success');
        toast.success("QR Code Valid! APAR terverifikasi.");
      } else {
        console.log("Scan Mismatch Details:", { scannedText, scannedUuid, targetUuid });
        toast.error("QR Code tidak cocok dengan APAR ini.");
      }
    }

    if (error) {
      if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
        toast.error("Akses kamera ditolak atau tidak ditemukan.");
      }
    }
  };

  const handleProceed = () => {
    navigate(`/apar-report?id=${aparId}`);
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md bg-slate-950/80 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <CardHeader className="text-center">
          <Flame className="h-10 w-10 text-orange-500 mx-auto mb-2" />
          <CardTitle className="text-xl text-white">Scan QR APAR</CardTitle>
          <p className="text-sm text-slate-400 font-mono">{aparName || 'Memuat...'}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
            {status === 'scanning' ? (
              <QrReader
                onResult={handleScan}
                constraints={{ facingMode: 'environment' }}
                scanDelay={500}
                videoContainerStyle={{ width: '100%', paddingTop: '100%' }}
                videoStyle={{ objectFit: 'cover' }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <p className="text-emerald-500 font-bold uppercase tracking-widest">Verifikasi Berhasil</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleProceed} 
              disabled={status !== 'success'}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-xl py-6 font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20"
            >
              Lanjutkan Laporan
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-slate-400">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AparScan;