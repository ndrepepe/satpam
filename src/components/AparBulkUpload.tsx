import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, addDays } from 'date-fns';

const AparBulkUpload: React.FC<{ onUploadSuccess: () => void }> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [satpamList, setSatpamList] = useState<{ id: string; id_number: string; name: string }[]>([]);

  useEffect(() => {
    const fetchSatpam = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, id_number, first_name, last_name')
        .eq('role', 'satpam');
      
      if (data) {
        setSatpamList(data.map(d => ({
          id: d.id,
          id_number: d.id_number || '',
          name: `${d.first_name} ${d.last_name}`
        })));
      }
    };
    fetchSatpam();
  }, []);

  const handleDownloadTemplate = () => {
    try {
      const headers = ['No ID', 'Nama Satpam', 'Tanggal (YYYY-MM-DD)', 'Gedung (Gedung Barat / Gedung Timur / Semua Gedung)'];
      
      const sampleData = satpamList.map(s => [
        s.id_number,
        s.name,
        format(new Date(), 'yyyy-MM-dd'),
        'Semua Gedung'
      ]);

      if (sampleData.length === 0) {
        sampleData.push(['SP001', 'Contoh Nama', format(new Date(), 'yyyy-MM-dd'), 'Semua Gedung']);
      }

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Jadwal APAR');

      XLSX.writeFile(workbook, 'Template_Jadwal_APAR.xlsx');
      toast.success("Template Excel berhasil diunduh.");
    } catch (error: any) {
      toast.error("Gagal mengunduh template.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Skip header
        const rows = rawData.slice(1);
        const schedulesToInsert: any[] = [];

        // Ambil semua lokasi APAR untuk pencocokan gedung
        const { data: allApars } = await supabase.from('apar_locations').select('id, posisi_gedung');
        if (!allApars) throw new Error("Gagal mengambil data lokasi APAR.");

        for (const row of rows) {
          const idNumber = row[0]?.toString().trim();
          const dateStr = row[2]?.toString().trim();
          const buildingPos = row[3]?.toString().trim();

          if (!idNumber || !dateStr || !buildingPos) continue;

          const satpam = satpamList.find(s => s.id_number === idNumber);
          if (!satpam) {
            console.warn(`Satpam dengan ID ${idNumber} tidak ditemukan.`);
            continue;
          }

          let filteredApars = allApars;
          if (buildingPos !== 'Semua Gedung') {
            filteredApars = allApars.filter(a => a.posisi_gedung === buildingPos);
          }

          filteredApars.forEach(apar => {
            schedulesToInsert.push({
              user_id: satpam.id,
              apar_location_id: apar.id,
              schedule_date: dateStr,
              status: 'pending'
            });
          });
        }

        if (schedulesToInsert.length === 0) {
          toast.warning("Tidak ada data valid untuk diimpor.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.from('apar_schedules').insert(schedulesToInsert);
        if (error) throw error;

        toast.success(`Berhasil mengimpor ${schedulesToInsert.length} jadwal pengecekan APAR.`);
        onUploadSuccess();
        // Reset input
        event.target.value = '';
      } catch (error: any) {
        toast.error(`Gagal mengimpor: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Impor Jadwal Massal</h4>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDownloadTemplate}
          className="border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 rounded-xl"
        >
          <Download className="mr-2 h-4 w-4" /> Unduh Template
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input 
          type="file" 
          accept=".xlsx, .xls" 
          onChange={handleFileUpload}
          disabled={loading}
          className="bg-slate-950 border-slate-800 text-white rounded-xl focus:ring-emerald-500/50"
        />
        {loading && (
          <Button disabled className="bg-slate-800 rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Memproses...
          </Button>
        )}
      </div>
      <p className="text-[10px] text-slate-500 font-mono italic">
        * Pastikan No ID satpam sesuai dengan yang terdaftar di sistem.
      </p>
    </div>
  );
};

export default AparBulkUpload;