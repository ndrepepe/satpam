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
import EditLocationModal from './EditLocationModal';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton component

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
  posisi_gedung?: string | null;
}

interface LocationListProps {
  refreshKey: number;
}

const LocationList: React.FC<LocationListProps> = ({ refreshKey }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; posisi_gedung?: string | null } | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, qr_code_data, created_at, posisi_gedung')
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
  }, [refreshKey]);

  const handleDeleteLocation = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus lokasi "${name}"?`)) {
      setLoading(true); // Set loading true during deletion
      try {
        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', id);

        if (error) {
          throw error;
        }
        toast.success(`Lokasi "${name}" berhasil dihapus.`);
        fetchLocations();
      } catch (error: any) {
        toast.error(`Gagal menghapus lokasi: ${error.message}`);
        console.error("Error deleting location:", error);
      } finally {
        setLoading(false); // Reset loading after deletion attempt
      }
    }
  };

  const handleEditLocation = (location: { id: string; name: string; posisi_gedung?: string | null }) => {
    setSelectedLocation(location);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedLocation(null);
    fetchLocations(); // Refresh list after modal closes, in case of update
  };

  const handlePrintQrCode = (locationId: string) => {
    window.open(`/print-qr/${locationId}`, '_blank', 'width=600,height=700,resizable=yes,scrollbars=yes');
  };

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Daftar Lokasi</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Lokasi</TableHead>
              <TableHead>Posisi Gedung</TableHead>
              <TableHead>QR Code</TableHead>
              <TableHead>Dibuat Pada</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">{loc.name}</TableCell>
                <TableCell>{loc.posisi_gedung || '-'}</TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handlePrintQrCode(loc.id)}
                    className="p-0 h-auto text-blue-500 hover:underline"
                    disabled={loading}
                  >
                    Lihat/Cetak QR
                  </Button>
                </TableCell>
                <TableCell>{new Date(loc.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditLocation({ id: loc.id, name: loc.name, posisi_gedung: loc.posisi_gedung })}
                    className="mr-2"
                    disabled={loading}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteLocation(loc.id, loc.name)}
                    disabled={loading}
                  >
                    Hapus
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedLocation && (
        <EditLocationModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          location={selectedLocation}
          onLocationUpdated={fetchLocations}
        />
      )}
    </div>
  );
};

export default LocationList;