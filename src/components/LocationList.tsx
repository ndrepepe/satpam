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
import { Button } from '@/components/ui/button'; // Import Button component
import { toast } from 'sonner';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
}

const LocationList = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, qr_code_data, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching locations:", error);
      toast.error("Gagal memuat daftar lokasi.");
    } else if (data) {
      setLocations(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleDeleteLocation = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus lokasi "${name}"?`)) {
      try {
        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', id);

        if (error) {
          throw error;
        }
        toast.success(`Lokasi "${name}" berhasil dihapus.`);
        fetchLocations(); // Refresh the list after deletion
      } catch (error: any) {
        toast.error(`Gagal menghapus lokasi: ${error.message}`);
        console.error("Error deleting location:", error);
      }
    }
  };

  const handleEditLocation = (id: string, name: string) => {
    toast.info(`Fungsionalitas edit untuk lokasi "${name}" (ID: ${id}) akan segera hadir!`);
    // Implement actual edit logic here (e.g., open a modal with a form)
  };

  if (loading) {
    return <p className="text-center text-gray-600 dark:text-gray-400">Memuat daftar lokasi...</p>;
  }

  if (locations.length === 0) {
    return <p className="text-center text-gray-600 dark:text-gray-400">Belum ada lokasi yang terdaftar.</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Daftar Lokasi</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Lokasi</TableHead>
            <TableHead>Data QR Code</TableHead>
            <TableHead>Dibuat Pada</TableHead>
            <TableHead className="text-right">Aksi</TableHead> {/* New column for actions */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((loc) => (
            <TableRow key={loc.id}>
              <TableCell className="font-medium">{loc.name}</TableCell>
              <TableCell>
                <a 
                  href={loc.qr_code_data} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:underline break-all"
                >
                  {loc.qr_code_data}
                </a>
              </TableCell>
              <TableCell>{new Date(loc.created_at).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEditLocation(loc.id, loc.name)}
                  className="mr-2"
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleDeleteLocation(loc.id, loc.name)}
                >
                  Hapus
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LocationList;