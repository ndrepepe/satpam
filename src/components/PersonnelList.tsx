import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client'; // Hanya import supabase
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
  email?: string;
}

interface PersonnelListProps {
  isAdmin: boolean;
  refreshKey: number; // New prop for refresh
}

const PersonnelList: React.FC<PersonnelListProps> = ({ isAdmin, refreshKey }) => {
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Profile | null>(null);

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      // Invoke Edge Function to list users with profiles
      const { data, error } = await supabase.functions.invoke('list-users-with-profiles');

      if (error) {
        console.error("Error invoking list-users-with-profiles Edge Function:", error);
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (data && data.personnel) {
        setPersonnel(data.personnel);
      } else if (data && data.error) {
        throw new Error(`Edge Function returned error: ${data.error}`);
      } else {
        throw new Error("Unexpected response from list-users-with-profiles Edge Function.");
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
  }, [refreshKey]); // Add refreshKey to dependencies

  const handleDeletePersonnel = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error("Anda tidak memiliki izin untuk menghapus personel.");
      return;
    }
    if (window.confirm(`Apakah Anda yakin ingin menghapus personel "${name}"?`)) {
      try {
        // Invoke Edge Function to delete user and profile
        const { data, error } = await supabase.functions.invoke('delete-user-and-profile', {
          body: { userId: id },
        });

        if (error) {
          console.error("Error invoking delete-user-and-profile Edge Function:", error);
          throw new Error(`Edge Function error: ${error.message}`);
        }

        if (data && data.error) {
          throw new Error(`Edge Function returned error: ${data.error}`);
        }

        toast.success(`Personel "${name}" berhasil dihapus.`);
        fetchPersonnel(); // Refresh the list after deletion
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

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Daftar Personel</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Depan</TableHead>
            <TableHead>Nama Belakang</TableHead>
            <TableHead>Nomor ID</TableHead>
            <TableHead>Email</TableHead>
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
              <TableCell>{p.email || '-'}</TableCell>
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