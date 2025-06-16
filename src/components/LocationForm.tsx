import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

const locationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface LocationFormProps {
  onLocationCreated: () => void;
}

const LocationForm: React.FC<LocationFormProps> = ({ onLocationCreated }) => {
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (values: LocationFormValues) => {
    try {
      const uniqueId = uuidv4();
      const qrData = `${window.location.origin}/scan-location?id=${uniqueId}`;

      const { data, error } = await supabase
        .from('locations')
        .insert({ name: values.name, qr_code_data: qrData })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success(`Lokasi "${values.name}" berhasil dibuat.`);
      form.reset();
      onLocationCreated(); // Panggil callback untuk memberitahu bahwa lokasi baru telah dibuat
    } catch (error: any) {
      toast.error(`Gagal membuat lokasi: ${error.message}`);
      console.error("Error creating location:", error);
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
    </Form>
  );
};

export default LocationForm;