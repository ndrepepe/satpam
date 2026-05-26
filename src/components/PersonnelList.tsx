import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import EditPersonnelModal from './EditPersonnelModal';
import { Shield, UserCheck, Trash2, Edit3 } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string | null;
  role?: string;
  email?: string;
}

interface PersonnelListProps {
  isAdmin: boolean;
  refreshKey: number;
}

const PersonnelList: React.FC<PersonnelListProps> = ({ isAdmin, refreshKey }) => {
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Profile | null>(null);

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, id_number, role')
        .order('first_name', { ascending: true });

      if (error) throw error;

      if (data) {
        setPersonnel(data);
      }
    } catch (error: any) {
      toast.error(`Gagal memuat daftar personel: ${error.message}`);
      console.error("Error fetching personnel:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
  }, [refreshKey]);

  const handleDeletePersonnel = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error("Anda tidak memiliki izin untuk menghapus personel.");
      return;
    }
    if (window.confirm(`Apakah Anda yakin ingin menghapus personel "${name}"?`)) {
      try {
        const { error } = await supabase.functions.invoke('delete-user-and-profile', {
          body: { userId: id },
        });

        if (error) {
          const { error: profileError } = await supabase.from('profiles').delete().eq('id', id);
          if (profileError) throw profileError;
          toast.warning(`Profil dihapus, namun akun login mungkin masih ada karena kendala server.`);
        } else {
          toast.success(`Personel "${name}" berhasil dihapus.`);
        }
        
        fetchPersonnel();
      } catch (error: any) {
        toast.error(`Gagal menghapus personel: ${error.message}`);
      }
    }
  };

  const handleEditPersonnel = (person: Profile) => {
    if (!isAdmin) {
      toast.error("Anda tidak memiliki izin untuk mengedit personel.");
      return;
    }
    setSelectedPersonnel(person);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedPersonnel(null);
  };

  return (
    <div className="mt-2">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400" />
        </div>
      ) : personnel.length === 0 ? (
        <p className="text-center py-8 text-slate-400 font-mono text-sm">Belum ada personel yang terdaftar.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/40">
          <Table>
            <TableHeader className="bg-slate-900/80 border-b border-slate-800/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Nama Depan</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Nama Belakang</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Nomor ID</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Peran</TableHead>
                {isAdmin && <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6 text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {personnel.map((p) => (
                <TableRow key={p.id} className="border-b border-slate-800/40 hover:bg-slate-900/40 transition-colors duration-200">
                  <TableCell className="font-semibold text-white py-4 px-6 text-sm">{p.first_name}</TableCell>
                  <TableCell className="text-slate-200 py-4 px-6 text-sm">{p.last_name}</TableCell>
                  <TableCell className="font-mono text-cyan-300 py-4 px-6 text-sm">{p.id_number || '-'}</TableCell>
                  <TableCell className="py-4 px-6 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 capitalize">
                      {p.role || 'Satpam'}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPersonnel(p)}
                          className="rounded-lg border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30 transition-all duration-200"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeletePersonnel(p.id, `${p.first_name} ${p.last_name}`)}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedPersonnel && (
        <EditPersonnelModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          personnel={selectedPersonnel}
          onPersonnelUpdated={fetchPersonnel}
        />
      )}
    </div>
  );
};

export default PersonnelList;