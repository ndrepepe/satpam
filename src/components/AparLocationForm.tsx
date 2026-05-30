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
import { Flame } from 'lucide-react';

const aparLocationSchema = z.object({
  name: z.string().min(1, "Nama/Kode APAR wajib diisi"),
  type: z.string().min(1, "Jenis APAR (CO2, Powder, dll) wajib diisi"),
  building_position: z.enum(["Gedung Barat", "Gedung Timur"], {
    required_error: "Posisi gedung wajib dipilih",
  }),
});

type AparLocationFormValues = z.infer<typeof aparLocationSchema>;

interface AparLocationFormProps {
  onLocationCreated: () => void;
}

const AparLocationForm: React.FC<AparLocationFormProps> = ({ onLocationCreated }) => {
  const form = useForm<AparLocationFormValues>({
    resolver: zodResolver(aparLocationSchema),
    defaultValues: {
      name: '',
      type: '',
      building_position: undefined,
    },
  });

  const onSubmit = async (values: AparLocationFormValues) => {
    try {
      const uniqueId = uuidv4();
      const qrData = `${window.location.origin}/scan-apar?id=${uniqueId}`;

      const { error } = await supabase
        .from('apar_locations')
        .insert({ 
          id: uniqueId,
          name: values.name, 
          type: values.type,
          qr_code_data: qrData, 
          posisi_gedung: values.building_position 
        });

      if (error) throw error;

      toast.success(`APAR "${values.name}" berhasil didaftarkan.`);
      form.reset();
      onLocationCreated();
    } catch (error: any) {
      toast.error(`Gagal mendaftarkan APAR: ${error.message}`);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider">Nama / Kode APAR</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: APAR-01-Lantai1" {...field} className="bg-slate-900/80 border-slate-800 text-white rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider">Jenis APAR</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: Powder 6kg" {...field} className="bg-slate-900/80 border-slate-800 text-white rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="building_position"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider">Posisi Gedung</FormLabel>
              <select 
                {...field} 
                className="w-full bg-slate-900/80 border-slate-800 text-white rounded-xl py-2 px-3 focus:ring-2 focus:ring-orange-500/20 outline-none"
              >
                <option value="" disabled>Pilih posisi gedung</option>
                <option value="Gedung Barat">Gedung Barat</option>
                <option value="Gedung Timur">Gedung Timur</option>
              </select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full py-6 rounded-xl bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 text-white font-mono uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(234,88,12,0.3)] transition-all duration-300"
        >
          <Flame className="mr-2 h-4 w-4" /> Daftar APAR Baru
        </Button>
      </form>
    </Form>
  );
};

export default AparLocationForm;