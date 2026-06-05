"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Flame, QrCode, Trash2, Printer, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface AparLocation {
  id: string;
  name: string;
  type: string;
  posisi_gedung: string;
  created_at: string;
  qr_code_data?: string;
}

const AparLocationList: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [apars, setApars] = useState<AparLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApar, setSelectedApar] = useState<AparLocation | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const fetchApars = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('apar_locations').select('*').order('created_at', { ascending: false });
    if (error) toast.error("Gagal memuat daftar APAR.");
    else if (data) setApars(data);
    setLoading(false);
  };

  useEffect(() => { fetchApars(); }, [refreshKey]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Hapus data APAR "${name}"?`)) {
      const { error } = await supabase.from('apar_locations').delete().eq('id', id);
      if (error) toast.error("Gagal menghapus.");
      else {
        toast.success("Berhasil dihapus.");
        fetchApars();
      }
    }
  };

  const handleShowQr = (apar: AparLocation) => {
    setSelectedApar(apar);
    setIsQrOpen(true);
  };

  const getQrDataValue = (apar: AparLocation) => {
    if (apar.qr_code_data) return apar.qr_code_data;
    return `${window.location.origin}/scan-apar?id=${apar.id}`;
  };

  const handlePrint = () => {
    if (!selectedApar) return;
    const qrData = getQrDataValue(selectedApar);

    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const printWindow = window.open(windowUrl, uniqueName.toString(), 'left=50,top=50,width=600,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak QR Code - ${selectedApar.name}</title>
            <style>
              body {
                font-family: monospace;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: white;
                color: black;
              }
              .qr-container {
                border: 3px double black;
                padding: 30px;
                text-align: center;
                border-radius: 10px;
              }
              .title {
                font-size: 22px;
                font-weight: bold;
                margin-bottom: 5px;
                text-transform: uppercase;
              }
              .subtitle {
                font-size: 14px;
                color: #555;
                margin-bottom: 20px;
              }
              .info {
                margin-top: 20px;
                font-size: 14px;
                border-top: 1px dashed black;
                padding-top: 15px;
              }
              img {
                width: 220px;
                height: 220px;
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="title">APAR SAFETY QR</div>
              <div class="subtitle">SCAN UNTUK PEMERIKSAAN</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}" />
              <div class="info">
                <strong>KODE:</strong> ${selectedApar.name}<br/>
                <strong>JENIS:</strong> ${selectedApar.type}<br/>
                <strong>LOKASI:</strong> ${selectedApar.posisi_gedung}
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/40">
      <Table>
        <TableHeader className="bg-slate-900/80">
          <TableRow>
            <TableHead className="text-orange-400 font-mono text-xs uppercase">Nama/Kode</TableHead>
            <TableHead className="text-orange-400 font-mono text-xs uppercase">Jenis</TableHead>
            <TableHead className="text-orange-400 font-mono text-xs uppercase">Gedung</TableHead>
            <TableHead className="text-orange-400 font-mono text-xs uppercase text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8">Memuat...</TableCell></TableRow>
          ) : apars.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Belum ada APAR terdaftar.</TableCell></TableRow>
          ) : (
            apars.map((apar) => (
              <TableRow key={apar.id} className="border-b border-slate-800/40">
                <TableCell className="font-semibold text-white flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" /> {apar.name}
                </TableCell>
                <TableCell className="text-slate-300">{apar.type}</TableCell>
                <TableCell className="text-slate-300">{apar.posisi_gedung}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleShowQr(apar)} className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"><QrCode className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(apar.id, apar.name)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Dialog QR Code */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-md border border-slate-800 bg-slate-950 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-orange-400 flex items-center gap-2">
              <QrCode className="h-5 w-5" /> QR Code APAR
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Gunakan QR Code ini untuk ditempelkan pada tabung APAR fisik.
            </DialogDescription>
          </DialogHeader>

          {selectedApar && (
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              {/* Tampilan QR Code */}
              <div id="printable-qr-area" className="bg-white p-6 rounded-2xl shadow-lg flex flex-col items-center border-4 border-orange-500">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getQrDataValue(selectedApar))}`} 
                  alt={`QR Code ${selectedApar.name}`}
                  className="w-48 h-48"
                />
                <div className="mt-4 text-center text-slate-950 font-mono">
                  <p className="text-lg font-extrabold tracking-wider">{selectedApar.name}</p>
                  <p className="text-xs font-semibold text-slate-600">{selectedApar.type}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{selectedApar.posisi_gedung}</p>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex w-full gap-3">
                <Button 
                  onClick={handlePrint} 
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-mono text-xs uppercase py-5 rounded-xl"
                >
                  <Printer className="mr-2 h-4 w-4" /> Cetak QR Code
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsQrOpen(false)}
                  className="border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 font-mono text-xs uppercase py-5 rounded-xl"
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AparLocationList;