import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const profileSchema = z.object({
  first_name: z.string().min(1, "Nama depan wajib diisi"),
  last_name: z.string().min(1, "Nama belakang wajib diisi"),
  id_number: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const Profile = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileFormValues & { role?: string } | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      id_number: '',
    },
  });

  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user) {
        setProfileLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, id_number, role')
          .eq('id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST204') { // PGRST204 means no rows found
          console.error("Error fetching profile:", error);
          toast.error("Gagal memuat profil.");
          setProfileLoading(false);
          return;
        }

        if (data) {
          setProfile(data);
          form.reset(data); // Set form default values
        } else {
          // No profile found, attempt to create one
          console.log("No profile found for user, attempting to create one.");
          const { first_name, last_name, id_number } = session.user.user_metadata || {};
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              first_name: first_name || '',
              last_name: last_name || '',
              id_number: id_number || '',
            });

          if (insertError) {
            console.error("Error creating new profile:", insertError);
            toast.error("Gagal membuat profil baru.");
          } else {
            toast.success("Profil baru berhasil dibuat.");
            // Re-fetch the newly created profile to populate the form
            const { data: newData, error: newError } = await supabase
              .from('profiles')
              .select('first_name, last_name, id_number, role')
              .eq('id', session.user.id)
              .single();
            if (newError) {
              console.error("Error re-fetching profile after creation:", newError);
              toast.error("Gagal memuat profil setelah pembuatan.");
            } else if (newData) {
              setProfile(newData);
              form.reset(newData);
            }
          }
        }
        setProfileLoading(false);
      }
    };

    if (session) {
      fetchProfile();
    }
  }, [session, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!session?.user) {
      toast.error("Anda harus login untuk memperbarui profil.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          id_number: values.id_number,
        })
        .eq('id', session.user.id);

      if (error) {
        throw error;
      }
      toast.success("Profil berhasil diperbarui!");
    } catch (error: any) {
      toast.error(`Gagal memperbarui profil: ${error.message}`);
      console.error("Error updating profile:", error);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat profil...</p>
      </div>
    );
  }

  if (!session) {
    return null; // Akan dialihkan oleh useEffect
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Profil Pengguna</CardTitle>
        </CardHeader>
        <CardContent>
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
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={session.user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Peran</Label>
                <Input value={profile?.role || 'Tidak Diketahui'} disabled />
              </div>
              <Button type="submit" className="w-full">Simpan Perubahan</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;