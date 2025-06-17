import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const personnelSchema = z.object({
  first_name: z.string().min(1, "Nama depan wajib diisi"),
  last_name: z.string().min(1, "Nama belakang wajib diisi"),
  id_number: z.string().min(1, "Nomor ID wajib diisi"),
  // Email dan password dihapus karena pendaftaran dilakukan secara manual
});

type PersonnelFormValues = z.infer<typeof personnelSchema>;

const PersonnelForm = () => {
  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      id_number: '',
    },
  });

  const onSubmit = async (values: PersonnelFormValues) => {
    try {
      // Karena pendaftaran dilakukan secara manual di Supabase,
      // kita hanya perlu menambahkan profil ke tabel 'profiles' jika diperlukan.
      // Namun, karena ada trigger `handle_new_user` yang otomatis membuat profil
      // saat user baru ditambahkan di `auth.users`, kita tidak perlu insert manual di sini.
      // Cukup tampilkan pesan sukses bahwa personel akan ditambahkan secara manual.

      toast.success(`Personel ${values.first_name} ${values.last_name} akan ditambahkan secara manual melalui Supabase.`);
      form.reset();
    } catch (error: any) {
      // Ini seharusnya tidak tercapai jika tidak ada operasi Supabase di sini
      toast.error(`Terjadi kesalahan: ${error.message}`);
      console.error("Error adding personnel (form only):", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Depan</FormLabel>
              <FormControl>
                <Input placeholder="Nama Depan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Belakang</FormLabel>
              <FormControl>
                <Input placeholder="Nama Belakang" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="id_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nomor ID</FormLabel>
              <FormControl>
                <Input placeholder="Nomor ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Bidang email dan password dihapus */}
        <Button type="submit" className="w-full">Tambahkan Detail Personel</Button>
      </form>
    </Form>
  );
};

export default PersonnelForm;