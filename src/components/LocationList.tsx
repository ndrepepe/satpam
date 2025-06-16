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
import EditLocationModal from './EditLocationModal'; // Import the new modal component

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
}

const LocationList = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string } | null>(null);

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

  const handleEditLocation = (location: { id: string; name: string }) => {
    setSelectedLocation(location);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedLocation(null);
  };

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Daftar Lokasi</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Lokasi</TableHead>
            <TableHead>Data QR Code</TableHead>
            <TableHead>Dibuat Pada</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
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
                  onClick={() => handleEditLocation({ id: loc.id, name: loc.name })}
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

      {selectedLocation && (
        <EditLocationModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          location={selectedLocation}
          onLocationUpdated={fetchLocations} // Pass the fetch function to refresh the list
        />
      )}
    </div>
  );
};

export default LocationList;