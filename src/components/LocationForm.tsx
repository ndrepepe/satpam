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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const locationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
  posisi_gedung: z.enum(["Gedung Barat", "Gedung Timur"], {
    required_error: "Posisi gedung wajib dipilih",
  }),
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
      posisi_gedung: undefined, // Set to undefined initially
    },
  });

  const onSubmit = async (values: LocationFormValues) => {
    try {
      const uniqueId = uuidv4();
      const qrData = `${window.location.origin}/scan-location?id=${uniqueId}`;

      const { data, error } = await supabase
        .from('locations')
        .insert({ name: values.name, qr_code_data: qrData, posisi_gedung: values.posisi_gedung })
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
        <FormField
          control={form.control}
          name="posisi_gedung"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Posisi Gedung</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih posisi gedung" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Gedung Barat">Gedung Barat</SelectItem>
                  <SelectItem value="Gedung Timur">Gedung Timur</SelectItem>
                </SelectContent>
              </Select>
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