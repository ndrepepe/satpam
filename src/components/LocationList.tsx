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

  useEffect(() => {
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

    fetchLocations();
  }, []);

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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LocationList;