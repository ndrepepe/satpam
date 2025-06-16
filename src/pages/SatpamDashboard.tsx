import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  created_at: string;
}

const SatpamDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [isSatpam, setIsSatpam] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchLocations = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/');
        return;
      }

      if (profileData?.role === 'satpam') {
        setIsSatpam(true);
        // Fetch locations
        const { data, error } = await supabase
          .from('locations')
          .select('id, name, qr_code_data, created_at')
          .order('name', { ascending: true });

        if (error) {
          console.error("Error fetching locations:", error);
          toast.error("Gagal memuat daftar lokasi.");
        } else if (data) {
          setLocations(data);
        }
        setLoadingLocations(false);
      } else {
        toast.error("Akses ditolak. Anda bukan satpam.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchLocations();
  }, [session, sessionLoading, user, navigate]);

  const handleScanLocation = (locationId: string) => {
    navigate(`/scan-location?id=${locationId}`);
  };

  if (sessionLoading || loadingLocations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard satpam...</p>
      </div>
    );
  }

  if (!isSatpam) {
    return null; // Akan dialihkan oleh useEffect jika bukan satpam
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-3xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Satpam</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="text-xl font-semibold mb-4">Daftar Lokasi Cek Area</h3>
          {locations.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Belum ada lokasi yang terdaftar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleScanLocation(loc.id)}
                      >
                        Pindai Lokasi
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SatpamDashboard;