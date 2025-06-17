import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale'; // Import locale for Indonesian date formatting

interface Report {
  id: string;
  photo_url: string;
  created_at: string;
  locations: { name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
}

const SupervisorDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRoleAndFetchReports = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile role for Supervisor Dashboard:", profileError);
        toast.error("Gagal memuat peran pengguna.");
        navigate('/');
        return;
      }

      if (profileData?.role === 'atasan') {
        setIsSupervisor(true);
        // Fetch all check area reports, joining with locations and profiles
        const { data: reportsData, error: reportsError } = await supabase
          .from('check_area_reports')
          .select(`
            id,
            photo_url,
            created_at,
            locations (name),
            profiles (first_name, last_name)
          `)
          .order('created_at', { ascending: false });

        if (reportsError) {
          console.error("Error fetching reports:", reportsError);
          // Mengubah pesan toast agar lebih spesifik
          toast.error(`Gagal memuat daftar laporan: ${reportsError.message}`);
        } else if (reportsData) {
          setReports(reportsData as Report[]);
        }
        setLoadingReports(false);
      } else {
        toast.error("Akses ditolak. Anda bukan atasan.");
        navigate('/');
      }
    };

    checkUserRoleAndFetchReports();
  }, [session, sessionLoading, user, navigate]);

  const handleViewPhoto = (url: string) => {
    setSelectedPhotoUrl(url);
    setIsPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    setIsPhotoModalOpen(false);
    setSelectedPhotoUrl(null);
  };

  if (sessionLoading || loadingReports) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard atasan...</p>
      </div>
    );
  }

  if (!isSupervisor) {
    return null; // Akan dialihkan oleh useEffect jika bukan atasan
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-5xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Atasan</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="text-xl font-semibold mb-4">Daftar Laporan Cek Area</h3>
          {reports.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Belum ada laporan cek area.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Dilaporkan Oleh</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Waktu Laporan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.locations?.name || 'N/A'}</TableCell>
                    <TableCell>
                      {report.profiles ? `${report.profiles.first_name} ${report.profiles.last_name}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleViewPhoto(report.photo_url)}
                        className="p-0 h-auto text-blue-500 hover:underline"
                      >
                        Lihat Foto
                      </Button>
                    </TableCell>
                    <TableCell>
                      {format(new Date(report.created_at), 'dd MMMM yyyy HH:mm', { locale: id })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPhotoModalOpen} onOpenChange={handleClosePhotoModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Foto Laporan</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedPhotoUrl && (
              <img src={selectedPhotoUrl} alt="Laporan Cek Area" className="max-w-full h-auto rounded-md" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorDashboard;