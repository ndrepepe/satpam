import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LocationForm from '@/components/LocationForm';
import LocationList from '@/components/LocationList';
import SatpamSchedule from '@/components/SatpamSchedule';
import { MapPin, Calendar } from 'lucide-react';

const PatrolAdmin = () => {
  const [locationRefreshKey, setLocationRefreshKey] = useState(0);

  const handleLocationCreated = () => {
    setLocationRefreshKey(prev => prev + 1);
  };

  return (
    <div className="w-full space-y-6">
      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1.5">
          <TabsTrigger value="locations" className="rounded-xl font-mono text-xs uppercase py-3 data-[state=active]:bg-blue-600">
            <MapPin className="mr-2 h-4 w-4" /> Manajemen Area
          </TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-xl font-mono text-xs uppercase py-3 data-[state=active]:bg-blue-600">
            <Calendar className="mr-2 h-4 w-4" /> Jadwal Patroli
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-6 space-y-6 animate-fade-in">
          <LocationForm onLocationCreated={handleLocationCreated} />
          <LocationList refreshKey={locationRefreshKey} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6 animate-fade-in">
          <SatpamSchedule />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatrolAdmin;