import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';

const locationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
});

type LocationFormValues = z.infer<typeof locationSchema>;

const LocationForm = () => {
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (values: LocationFormValues) => {
    try {
      const uniqueId = uuidv4();
      // The QR code will point to a hypothetical scan page with the unique ID
      const qrData = `${window.location.origin}/scan-location?id=${uniqueId}`;

      const { data, error } = await supabase
        .from('locations')
        .insert({ name: values.name, qr_code_data: qrData })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setQrCodeValue(qrData);
      setLocationName(values.name);
      toast.success(`Lokasi "${values.name}" berhasil dibuat dengan QR Code.`);
      form.reset();
    } catch (error: any) {
      toast.error(`Gagal membuat lokasi: ${error.message}`);
      console.error("Error creating location:", error);
    }
  };

  const downloadQRCode = () => {
    if (qrCodeValue && locationName) {
      const canvas = document.getElementById('qrcode-canvas') as HTMLCanvasElement;
      if (canvas) {
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `QR_Code_${locationName.replace(/\s/g, '_')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Lokasi</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Pos Utama, Gudang A" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Buat Lokasi & QR Code</Button>
      </form>

      {qrCodeValue && (
        <Card className="mt-6 p-4 text-center">
          <CardHeader>
            <CardTitle>QR Code untuk {locationName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <QRCode
              id="qrcode-canvas"
              value={qrCodeValue}
              size={256}
              level="H"
              includeMargin={true}
              className="mb-4"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 break-all">
              URL: <a href={qrCodeValue} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{qrCodeValue}</a>
            </p>
            <Button onClick={downloadQRCode}>Unduh QR Code</Button>
          </CardContent>
        </Card>
      )}
    </Form>
  );
};

export default LocationForm;