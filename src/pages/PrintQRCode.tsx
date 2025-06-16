import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import QrCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PrintQRCode = () => {
  const { id } = useParams<{ id: string }>();
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQrCodeData = async () => {
      if (id) {
        const { data, error } = await supabase
          .from('locations')
          .select('name, qr_code_data')
          .eq('id', id)
          .single();

        if (error) {
          console.error("Error fetching QR code data:", error);
          toast.error("Gagal memuat data QR Code.");
          setQrCodeValue(null);
          setLocationName("Data Tidak Ditemukan");
        } else if (data) {
          setQrCodeValue(data.qr_code_data);
          setLocationName(data.name);
        }
      } else {
        setQrCodeValue(null);
        setLocationName("ID Lokasi Tidak Disediakan");
      }
      setLoading(false);
    };

    fetchQrCodeData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat QR Code...</p>
      </div>
    );
  }

  if (!qrCodeValue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-red-500 dark:text-red-400">{locationName || "QR Code tidak ditemukan."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white print:p-0 print:m-0 print:shadow-none min-h-screen">
      {/* Teks "CEK AREA" dipindahkan ke atas QR Code */}
      <div className="hidden print:block text-center mb-4">
        <p className="text-lg font-semibold">CEK AREA</p>
      </div>

      <div className="p-4 border border-gray-300 rounded-lg shadow-md print:border-none print:shadow-none">
        <QrCode
          value={qrCodeValue}
          size={384}
          level="H"
          id="qrcode-print-svg"
        />
      </div>

      {/* Nama lokasi ditambahkan di bawah QR Code */}
      {locationName && (
        <div className="hidden print:block text-center mt-4">
          <p className="text-lg font-semibold">{locationName}</p>
        </div>
      )}

      {/* Elemen-elemen yang hanya terlihat di layar, disembunyikan saat cetak */}
      <h1 className="text-2xl font-bold mb-4 print:hidden">QR Code untuk {locationName}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 mb-6 break-all print:hidden">
        URL: <a href={qrCodeValue} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{qrCodeValue}</a>
      </p>
      <Button onClick={handlePrint} className="mt-6 print:hidden">
        Cetak QR Code
      </Button>
    </div>
  );
};

export default PrintQRCode;