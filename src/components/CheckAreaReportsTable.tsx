import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale'; // Import Indonesian locale

interface CheckAreaReport {
  id: string;
  created_at: string;
  location_id: string;
  photo_url: string; 
  locations: {
    name: string;
  } | null;
}

interface CheckAreaReportsTableProps {
  reports: CheckAreaReport[];
}

const CheckAreaReportsTable: React.FC<CheckAreaReportsTableProps> = ({ reports }) => {
  return (
    <div className="mt-4">
      <h4 className="text-lg font-semibold mb-3">Laporan Cek Area</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu Cek</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Foto</TableHead> {/* Kolom baru untuk foto */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                Belum ada laporan cek area untuk satpam ini.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  {format(new Date(report.created_at), 'dd MMMM yyyy HH:mm', { locale: id })}
                </TableCell>
                <TableCell>{report.locations?.name || 'Lokasi Tidak Diketahui'}</TableCell>
                <TableCell>
                  {report.photo_url ? (
                    <a 
                      href={report.photo_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline"
                    >
                      Lihat Foto
                    </a>
                  ) : (
                    'Tidak Ada Foto'
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CheckAreaReportsTable;