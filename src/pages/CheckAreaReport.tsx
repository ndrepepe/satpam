import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, UploadCloud, ArrowLeft, CheckCircle2 } from 'lucide-react';

const CheckAreaReport = () => {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('locationId');
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();

  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSubmitReport = async () => {
    if (!user || !locationId) return;
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('check_area_reports').insert({
        user_id: user.id,
        location_id: locationId,
        photo_url: null,
      });

      if (insertError) throw insertError;
      toast.success("Laporan patroli berhasil dikirim!");
      navigate('/satpam-dashboard');
    } catch (error: any) {
      toast.error(`Gagal mengirim laporan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <UploadCloud className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Menyiapkan formulir...</p>
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
            <span className="text-xs font-bold tracking-wider uppercase">Konfirmasi Lokasi</span>
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {locationName || "Memuat Lokasi..."}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-indigo-500 mx-auto" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              QR Code Terverifikasi. Silakan tekan tombol di bawah untuk mengirim laporan kehadiran Anda.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleSubmitReport} 
              disabled={loading}
              className="w-full py-7 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all duration-200 flex items-center justify-center space-x-2 text-lg"
            >
              <UploadCloud className="h-6 w-6" />
              <span>Kirim Laporan</span>
            </Button>

            <Button 
              onClick={() => navigate('/satpam-dashboard')} 
              variant="ghost" 
              className="w-full py-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-2xl flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Batal</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckAreaReport;