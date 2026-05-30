import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Flame, QrCode, Trash2 } from 'lucide-react';

interface AparLocation {
  id: string;
  name: string;
  type: string;
  posisi_gedung: string;
  created_at: string;
}

const AparLocationList: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [apars, setApars] = useState<AparLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApars = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('apar_locations').select('*').order('created_at', { ascending: false });
    if (error) toast.error("Gagal memuat daftar APAR.");
    else if (data) setApars(data);
    setLoading(false);
  };

  useEffect(() => { fetchApars(); }, [refreshKey]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Hapus data APAR "${name}"?`)) {
      const { error } = await supabase.from('apar_locations').delete().eq('id', id);
      if (error) toast.error("Gagal menghapus.");
      else {
        toast.success("Berhasil dihapus.");
        fetchApars();
      }
    }
  };

  const handlePrintQr = (id: string) => {
    // Gunakan fungsi print QR yang sudah ada namun disesuaikan untuk APAR jika perlu
    window.open(`/print-qr/${id}`, '_blank');
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/40">
      <Table>
        <TableHeader className="bg-slate-900/80">
          <TableRow>
            <TableHead className="text-orange-400 font-mono text-xs uppercase">Nama/Kode</TableHead>
            <TableHead className="text-orange-400 font-mono text-xs uppercase">Jenis</TableHead>
            <TableHead className="text-orange-400 font-mono text-xs uppercase">Gedung</TableHead>
            <TableHead className="text-orange-400 font-mono text-xs uppercase text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8">Memuat...</TableCell></TableRow>
          ) : apars.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Belum ada APAR terdaftar.</TableCell></TableRow>
          ) : (
            apars.map((apar) => (
              <TableRow key={apar.id} className="border-b border-slate-800/40">
                <TableCell className="font-semibold text-white flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" /> {apar.name}
                </TableCell>
                <TableCell className="text-slate-300">{apar.type}</TableCell>
                <TableCell className="text-slate-300">{apar.posisi_gedung}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handlePrintQr(apar.id)} className="text-cyan-400"><QrCode className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(apar.id, apar.name)} className="text-red-400"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AparLocationList;