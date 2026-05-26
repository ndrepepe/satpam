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
import { MapPin, QrCode, Trash2, Edit3 } from 'lucide-react';

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
  };

  const handlePrintQrCode = (locationId: string) => {
    window.open(`/print-qr/${locationId}`, '_blank', 'width=600,height=700,resizable=yes,scrollbars=yes');
  };

  return (
    <div className="mt-2">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400" />
        </div>
      ) : locations.length === 0 ? (
        <p className="text-center py-8 text-slate-400 font-mono text-sm">Belum ada lokasi yang terdaftar.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/40">
          <Table>
            <TableHeader className="bg-slate-900/80 border-b border-slate-800/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Nama Lokasi</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Posisi Gedung</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">QR Code</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6">Dibuat Pada</TableHead>
                <TableHead className="text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold py-4 px-6 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.id} className="border-b border-slate-800/40 hover:bg-slate-900/40 transition-colors duration-200">
                  <TableCell className="font-semibold text-white py-4 px-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>{loc.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-200 py-4 px-6 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {loc.posisi_gedung || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-sm">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handlePrintQrCode(loc.id)}
                      className="p-0 h-auto text-cyan-400 hover:text-cyan-300 font-mono text-xs uppercase tracking-wider flex items-center space-x-1"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Lihat/Cetak QR</span>
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-slate-300 py-4 px-6 text-xs">
                    {new Date(loc.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditLocation({ id: loc.id, name: loc.name, posisi_gedung: loc.posisi_gedung })}
                        className="rounded-lg border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/30 transition-all duration-200"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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