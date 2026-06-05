import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Flame, MapPin, Calendar } from 'lucide-react';
import AparLocationForm from '@/components/AparLocationForm';
import AparLocationList from '@/components/AparLocationList';
import AparScheduleForm from '@/components/AparScheduleForm';
import AparBulkUpload from '@/components/AparBulkUpload'; // Import baru
import AparScheduleList from '@/components/AparScheduleList'; // Import list jadwal

const AparAdmin = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="rounded-3xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/80">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-red-400 p-[1px] shadow-[0_0_15px_rgba(234,88,12,0.3)]">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
                <Flame className="h-6 w-6 text-orange-400" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold tracking-wider text-white uppercase">Sistem Manajemen APAR</CardTitle>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">Fire Safety Control Center</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <Tabs defaultValue="locations" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1.5">
              <TabsTrigger value="locations" className="rounded-xl font-mono text-xs uppercase py-3 data-[state=active]:bg-orange-600">
                <MapPin className="mr-2 h-4 w-4" /> Registrasi APAR
              </TabsTrigger>
              <TabsTrigger value="schedules" className="rounded-xl font-mono text-xs uppercase py-3 data-[state=active]:bg-orange-600">
                <Calendar className="mr-2 h-4 w-4" /> Jadwal Cek
              </TabsTrigger>
            </TabsList>

            <TabsContent value="locations" className="mt-6 space-y-6 animate-fade-in">
              <AparLocationForm onLocationCreated={handleRefresh} />
              <AparLocationList refreshKey={refreshKey} />
            </TabsContent>

            <TabsContent value="schedules" className="mt-6 space-y-6 animate-fade-in">
              <AparScheduleForm onScheduleCreated={handleRefresh} />
              <AparBulkUpload onUploadSuccess={handleRefresh} /> {/* Komponen Baru */}
              <AparScheduleList refreshKey={refreshKey} /> {/* Menampilkan daftar jadwal cek APAR */}
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 font-mono text-sm">
                Sistem penjadwalan APAR aktif. Petugas akan menerima daftar tugas di Dashboard Satpam.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AparAdmin;