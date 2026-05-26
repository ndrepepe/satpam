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
  onPersonnelAdded: () => void;
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
      const { data, error } = await supabase.auth.signUp({
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
      onPersonnelAdded();
    } catch (error: any) {
      toast.error(`Gagal menambahkan personel: ${error.message}`);
      console.error("Error adding personnel:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Nama Depan</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Masukkan nama depan" 
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
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Nama Belakang</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Masukkan nama belakang" 
                    {...field} 
                    className="bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5"
                  />
                </FormControl>
                <FormMessage className="text-red-400 text-xs font-mono" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="id_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Nomor ID</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Masukkan nomor ID satpam" 
                  {...field} 
                  autoComplete="off" 
                  className="bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs font-mono" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Email</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="contoh@satpam.com" 
                  {...field} 
                  autoComplete="off" 
                  className="bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs font-mono" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-200 font-mono text-xs uppercase tracking-wider font-semibold">Password</FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  placeholder="Minimal 6 karakter" 
                  {...field} 
                  autoComplete="new-password" 
                  className="bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl py-5"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs font-mono" />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full py-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-mono uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all duration-300"
        >
          Tambah Personel
        </Button>
      </form>
    </Form>
  );
};

export default PersonnelForm;