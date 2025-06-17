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
  const [isSatpam, setIsSatpam] = useState(false);

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
      console.log("Profile Page: No session, navigating to /login");
      navigate('/login');
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) {
        console.log("Profile Page: No user in session, cannot fetch profile.");
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        console.log("Profile Page: Attempting to fetch profile for user ID:", session.user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, id_number, role')
          .eq('id', session.user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST204') { // No rows found
            console.warn("Profile Page: No profile found for user ID:", session.user.id, "Attempting to create one.");
            // No profile found, attempt to create one
            const { first_name, last_name, id_number } = session.user.user_metadata || {};
            console.log("Profile Page: User metadata for new profile:", { first_name, last_name, id_number });

            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                first_name: first_name || '',
                last_name: last_name || '',
                id_number: id_number || '',
              });

            if (insertError) {
              console.error("Profile Page: Error creating new profile:", insertError);
              toast.error("Gagal membuat profil baru.");
            } else {
              console.log("Profile Page: New profile successfully created. Re-fetching profile.");
              toast.success("Profil baru berhasil dibuat.");
              // Re-fetch the newly created profile to populate the form
              const { data: newData, error: newError } = await supabase
                .from('profiles')
                .select('first_name, last_name, id_number, role')
                .eq('id', session.user.id)
                .single();
              if (newError) {
                console.error("Profile Page: Error re-fetching profile after creation:", newError);
                toast.error("Gagal memuat profil setelah pembuatan.");
              } else if (newData) {
                setProfile(newData);
                form.reset(newData);
                setIsSatpam(newData.role === 'satpam');
                console.log("Profile Page: Profile re-fetched and form reset with new data.");
              }
            }
          } else {
            console.error("Profile Page: Error fetching profile:", error);
            toast.error("Gagal memuat profil.");
          }
        } else if (data) {
          setProfile(data);
          form.reset(data); // Set form default values
          setIsSatpam(data.role === 'satpam');
          console.log("Profile Page: Profile fetched successfully and form reset.");
        }
      } catch (error: any) {
        console.error("Profile Page: Unexpected error in fetchProfile:", error);
        toast.error(`Terjadi kesalahan: ${error.message}`);
      } finally {
        setProfileLoading(false);
        console.log("Profile Page: profileLoading set to false.");
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
    if (isSatpam) {
      toast.error("Pengguna dengan peran 'satpam' tidak diizinkan untuk memperbarui profil.");
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
                      <Input placeholder="Nama Depan" {...field} disabled={isSatpam} />
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
                      <Input placeholder="Nama Belakang" {...field} disabled={isSatpam} />
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
                      <Input placeholder="Nomor ID" {...field} disabled={isSatpam} />
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
              {isSatpam && (
                <p className="text-red-500 text-sm text-center">
                  Anda tidak dapat mengubah profil karena peran Anda adalah 'satpam'.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSatpam}>Simpan Perubahan</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;