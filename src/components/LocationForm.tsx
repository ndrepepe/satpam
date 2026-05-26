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
      posisi_gedung: undefined,
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
      onLocationCreated();
    } catch (error: any) {
      toast.error(`Gagal membuat lokasi: ${error.message}`);
      console.error("Error creating location:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Nama Lokasi</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Contoh: Pos Utama, Gudang A" 
                  {...field} 
                  className="bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs font-mono" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="posisi_gedung"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Posisi Gedung</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-slate-900/80 border-slate-800 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5">
                    <SelectValue placeholder="Pilih posisi gedung" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-slate-950 border-slate-800 text-white">
                  <SelectItem value="Gedung Barat" className="focus:bg-slate-900 focus:text-white">Gedung Barat</SelectItem>
                  <SelectItem value="Gedung Timur" className="focus:bg-slate-900 focus:text-white">Gedung Timur</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage className="text-red-400 text-xs font-mono" />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full py-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-mono uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all duration-300"
        >
          Buat Lokasi & QR Code
        </Button>
      </form>
    </Form>
  );
};

export default LocationForm;