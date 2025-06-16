import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client'; // Import supabaseAdmin
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
import EditPersonnelModal from './EditPersonnelModal'; // Import the new modal

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string | null;
  role?: string;
}

const PersonnelList = () => {
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Profile | null>(null);

  const fetchPersonnel = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, id_number, role');

    if (error) {
      console.error("Error fetching personnel:", error);
      toast.error("Gagal memuat daftar personel.");
    } else if (data) {
      setPersonnel(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const handleDeletePersonnel = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus personel "${name}"?`)) {
      try {
        // Gunakan supabaseAdmin untuk menghapus pengguna dari auth.users
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (authError) {
          throw authError;
        }

        // Trigger `handle_new_user` akan menangani penghapusan dari tabel `profiles`
        // karena adanya `ON DELETE CASCADE` pada foreign key.
        // Jadi, tidak perlu penghapusan eksplisit dari 'profiles' di sini.

        toast.success(`Personel "${name}" berhasil dihapus.`);
        fetchPersonnel(); // Refresh the list after deletion
      } catch (error: any) {
        toast.error(`Gagal menghapus personel: ${error.message}`);
        console.error("Error deleting personnel:", error);
      }
    }
  };

  const handleEditPersonnel = (person: Profile) => {
    setSelectedPersonnel(person);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedPersonnel(null);
  };

  if (loading) {
    return <p className="text-center text-gray-600 dark:text-gray-400">Memuat daftar personel...</p>;
  }

  if (personnel.length === 0) {
    return <p className="text-center text-gray-600 dark:text-gray-400">Belum ada personel yang terdaftar.</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Daftar Personel</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Depan</TableHead>
            <TableHead>Nama Belakang</TableHead>
            <TableHead>Nomor ID</TableHead>
            <TableHead>Peran</TableHead>
            <TableHead className="text-right">Aksi</TableHead> {/* New column for actions */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {personnel.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.first_name}</TableCell>
              <TableCell>{p.last_name}</TableCell>
              <TableCell>{p.id_number || '-'}</TableCell>
              <TableCell>{p.role || 'Tidak Diketahui'}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditPersonnel(p)}
                  className="mr-2"
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePersonnel(p.id, `${p.first_name} ${p.last_name}`)}
                >
                  Hapus
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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