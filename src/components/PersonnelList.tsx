import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
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

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string | null;
  role?: string;
  email?: string; // Menambahkan properti email
}

interface PersonnelListProps {
  isAdmin: boolean;
}

const PersonnelList: React.FC<PersonnelListProps> = ({ isAdmin }) => {
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Profile | null>(null);

  const fetchPersonnel = async () => {
    setLoading(true);
    // Mengambil data email dari auth.users melalui join atau dengan mengambil user_metadata
    // Supabase RLS pada public.profiles tidak mengizinkan akses ke email secara langsung
    // Kita perlu mengambil email dari auth.users secara terpisah atau melalui fungsi admin
    // Untuk tujuan tampilan di admin dashboard, kita bisa mencoba mengambil dari auth.users
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users for personnel list:", usersError);
      toast.error("Gagal memuat daftar personel (data pengguna).");
      setLoading(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, id_number, role');

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      toast.error("Gagal memuat daftar personel (data profil).");
      setLoading(false);
      return;
    }

    if (profilesData && usersData) {
      const combinedPersonnel = profilesData.map(profile => {
        const user = usersData.users.find(u => u.id === profile.id);
        return {
          ...profile,
          email: user?.email || 'N/A', // Menambahkan email dari data pengguna
        };
      });
      setPersonnel(combinedPersonnel);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const handleDeletePersonnel = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error("Anda tidak memiliki izin untuk menghapus personel.");
      return;
    }
    if (window.confirm(`Apakah Anda yakin ingin menghapus personel "${name}"?`)) {
      try {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (authError) {
          throw authError;
        }

        toast.success(`Personel "${name}" berhasil dihapus.`);
        fetchPersonnel();
      } catch (error: any) {
        toast.error(`Gagal menghapus personel: ${error.message}`);
        console.error("Error deleting personnel:", error);
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
            <TableHead>Email</TableHead> {/* Kolom baru untuk Email */}
            <TableHead>Peran</TableHead>
            {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {personnel.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.first_name}</TableCell>
              <TableCell>{p.last_name}</TableCell>
              <TableCell>{p.id_number || '-'}</TableCell>
              <TableCell>{p.email || '-'}</TableCell> {/* Menampilkan Email */}
              <TableCell>{p.role || 'Tidak Diketahui'}</TableCell>
              {isAdmin && (
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
              )}
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