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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const editLocationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
  posisi_gedung: z.enum(["Gedung Barat", "Gedung Timur"], {
    required_error: "Posisi gedung wajib dipilih",
  }),
});

type EditLocationFormValues = z.infer<typeof editLocationSchema>;

interface EditLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { id: string; name: string; posisi_gedung?: string | null } | null;
  onLocationUpdated: () => void;
}

const EditLocationModal: React.FC<EditLocationModalProps> = ({ isOpen, onClose, location, onLocationUpdated }) => {
  const form = useForm<EditLocationFormValues>({
    resolver: zodResolver(editLocationSchema),
    defaultValues: {
      name: location?.name || '',
      posisi_gedung: (location?.posisi_gedung as "Gedung Barat" | "Gedung Timur") || undefined,
    },
  });

  useEffect(() => {
    if (location) {
      form.reset({ 
        name: location.name,
        posisi_gedung: (location.posisi_gedung as "Gedung Barat" | "Gedung Timur") || undefined,
      });
    }
  }, [location, form]);

  const onSubmit = async (values: EditLocationFormValues) => {
    if (!location) return;

    try {
      const { error } = await supabase
        .from('locations')
        .update({ name: values.name, posisi_gedung: values.posisi_gedung })
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
            <FormField
              control={form.control}
              name="posisi_gedung"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posisi Gedung</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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