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
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type PersonnelFormValues = z.infer<typeof personnelSchema>;

interface PersonnelFormProps {
  onPersonnelAdded: () => void; // New prop for callback
}

const PersonnelForm: React.FC<PersonnelFormProps> = ({ onPersonnelAdded }) => {
  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      id_number: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: PersonnelFormValues) => {
    try {
      const { data: _data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.first_name,
            last_name: values.last_name,
            id_number: values.id_number,
          },
        },
      });

      if (error) {
        throw error;
      }

      toast.success(`Personel ${values.first_name} ${values.last_name} berhasil ditambahkan!`);
      form.reset();
      onPersonnelAdded(); // Call the callback to refresh the list
    } catch (error: any) {
      toast.error(`Gagal menambahkan personel: ${error.message}`);
      console.error("Error adding personnel:", error);
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
                <Input placeholder="Nomor ID" {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Email" {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Password" {...field} autoComplete="new-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Tambah Personel</Button>
      </form>
    </Form>
  );
};

export default PersonnelForm;