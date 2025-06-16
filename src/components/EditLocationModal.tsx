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

const editLocationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
});

type EditLocationFormValues = z.infer<typeof editLocationSchema>;

interface EditLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { id: string; name: string } | null;
  onLocationUpdated: () => void;
}

const EditLocationModal: React.FC<EditLocationModalProps> = ({ isOpen, onClose, location, onLocationUpdated }) => {
  const form = useForm<EditLocationFormValues>({
    resolver: zodResolver(editLocationSchema),
    defaultValues: {
      name: location?.name || '',
    },
  });

  useEffect(() => {
    if (location) {
      form.reset({ name: location.name });
    }
  }, [location, form]);

  const onSubmit = async (values: EditLocationFormValues) => {
    if (!location) return;

    try {
      const { error } = await supabase
        .from('locations')
        .update({ name: values.name })
        .eq('id', location.id);

      if (error) {
        throw error;
      }

      toast.success(`Lokasi "${values.name}" berhasil diperbarui.`);
      onLocationUpdated(); // Panggil callback untuk refresh daftar
      onClose(); // Tutup modal
    } catch (error: any) {
      toast.error(`Gagal memperbarui lokasi: ${error.message}`);
      console.error("Error updating location:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Lokasi</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lokasi</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama Lokasi" {...field} />
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

export default EditLocationModal;