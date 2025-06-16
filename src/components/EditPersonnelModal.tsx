import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const editPersonnelSchema = z.object({
  first_name: z.string().min(1, "Nama depan wajib diisi"),
  last_name: z.string().min(1, "Nama belakang wajib diisi"),
  id_number: z.string().optional(),
});

type EditPersonnelFormValues = z.infer<typeof editPersonnelSchema>;

interface EditPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  personnel: { id: string; first_name: string; last_name: string; id_number?: string | null } | null;
  onPersonnelUpdated: () => void;
}

const EditPersonnelModal: React.FC<EditPersonnelModalProps> = ({ isOpen, onClose, personnel, onPersonnelUpdated }) => {
  const form = useForm<EditPersonnelFormValues>({
    resolver: zodResolver(editPersonnelSchema),
    defaultValues: {
      first_name: personnel?.first_name || '',
      last_name: personnel?.last_name || '',
      id_number: personnel?.id_number || '',
    },
  });

  useEffect(() => {
    if (personnel) {
      form.reset({
        first_name: personnel.first_name,
        last_name: personnel.last_name,
        id_number: personnel.id_number || '',
      });
    }
  }, [personnel, form]);

  const onSubmit = async (values: EditPersonnelFormValues) => {
    if (!personnel) {
      console.error("No personnel selected for update.");
      toast.error("Tidak ada personel yang dipilih untuk diperbarui.");
      return;
    }

    console.log("Attempting to update personnel with ID:", personnel.id);
    console.log("New values to send:", values);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          id_number: values.id_number,
        })
        .eq('id', personnel.id);

      if (error) {
        console.error("Supabase update error:", error); // Log the actual error
        toast.error(`Gagal memperbarui profil: ${error.message}`);
        return;
      }

      console.log("Supabase update successful (no error returned).");
      toast.success(`Profil ${values.first_name} ${values.last_name} berhasil diperbarui.`);
      onPersonnelUpdated(); // Panggil callback untuk refresh daftar
      console.log("onPersonnelUpdated called.");
      onClose(); // Tutup modal
    } catch (error: any) {
      toast.error(`Gagal memperbarui profil: ${error.message}`);
      console.error("Error updating personnel profile (catch block):", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Personel</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
              <Button type="submit">Simpan Perubahan</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPersonnelModal;