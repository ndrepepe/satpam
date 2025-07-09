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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, PlusCircle, QrCode, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import SatpamSchedule from '@/components/SatpamSchedule'; // Import SatpamSchedule component

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string;
  email: string;
  role: string;
}

interface Location {
  id: string;
  name: string;
  qr_code_data: string;
  posisi_gedung?: string | null;
}

interface Apar {
  id: string;
  location_id: string;
  locations: {
    name: string;
    posisi_gedung: string | null;
  };
  qr_code_data: string;
  expired_date: string; // Stored as string (YYYY-MM-DD)
  created_at: string;
}

const AdminDashboard = () => {
  const { session, loading: sessionLoading, user } = useSession();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Personnel Management States
  const [personnelList, setPersonnelList] = useState<Profile[]>([]);
  const [isPersonnelDialogOpen, setIsPersonnelDialogOpen] = useState(false);
  const [currentPersonnel, setCurrentPersonnel] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('satpam'); // Default role for new personnel

  // Location Management States
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationName, setLocationName] = useState('');
  const [posisiGedung, setPosisiGedung] = useState<string | undefined>(undefined);

  // APAR Management States
  const [aparList, setAparList] = useState<Apar[]>([]);
  const [isAparDialogOpen, setIsAparDialogOpen] = useState(false);
  const [currentApar, setCurrentApar] = useState<Apar | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined); // Reverted to using selectedLocationId
  const [aparExpiredDate, setAparExpiredDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      toast.error("Anda harus login untuk mengakses halaman ini.");
      navigate('/login');
      return;
    }

    const checkUserRole = async () => {
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

      if (profileData?.role === 'admin') {
        setIsAdmin(true);
        fetchPersonnel();
        fetchLocations();
        fetchApars(); // Fetch APARs when admin dashboard loads
      } else {
        toast.error("Akses ditolak. Anda bukan admin.");
        navigate('/');
      }
    };

    checkUserRole();
  }, [session, sessionLoading, user, navigate]);

  const fetchPersonnel = async () => {
    setLoadingData(true);
    try {
      // Invoke Edge Function to list users with profiles
      const { data, error } = await supabase.functions.invoke('list-users-with-profiles');

      if (error) {
        console.error("Error invoking list-users-with-profiles Edge Function:", error);
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (data && data.personnel) {
        setPersonnelList(data.personnel);
      } else if (data && data.error) {
        throw new Error(`Edge Function returned error: ${data.error}`);
      } else {
        throw new Error("Unexpected response from list-users-with-profiles Edge Function.");
      }
    } catch (error: any) {
      toast.error(`Gagal memuat daftar personel: ${error.message}`);
      console.error("Error fetching personnel:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchLocations = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, qr_code_data, posisi_gedung')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocationList(data as Location[]);
    } catch (error: any) {
      toast.error(`Gagal memuat daftar lokasi: ${error.message}`);
      console.error("Error fetching locations:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchApars = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('apars')
        .select('*, locations(name, posisi_gedung)') // Select location details
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAparList(data as Apar[]);
    } catch (error: any) {
      toast.error(`Gagal memuat daftar APAR: ${error.message}`);
      console.error("Error fetching APARs:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Personnel Management Handlers
  const handleAddPersonnelClick = () => {
    setCurrentPersonnel(null);
    setFirstName('');
    setLastName('');
    setIdNumber('');
    setEmail('');
    setPassword('');
    setRole('satpam');
    setIsPersonnelDialogOpen(true);
  };

  const handleEditPersonnelClick = (personnel: Profile) => {
    setCurrentPersonnel(personnel);
    setFirstName(personnel.first_name);
    setLastName(personnel.last_name);
    setIdNumber(personnel.id_number || '');
    setEmail(personnel.email);
    setPassword(''); // Password should not be pre-filled for security
    setRole(personnel.role);
    setIsPersonnelDialogOpen(true);
  };

  const handleSavePersonnel = async () => {
    setLoadingData(true);
    try {
      if (currentPersonnel) {
        // Update existing personnel
        const updates: { first_name: string; last_name: string; id_number?: string; email: string; role: string; } = {
          first_name: firstName,
          last_name: lastName,
          id_number: idNumber,
          email: email,
          role: role,
        };

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', currentPersonnel.id);

        if (error) throw error;
        toast.success("Data personel berhasil diperbarui.");
      } else {
        // Add new personnel
        const { data: newUser, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              id_number: idNumber,
              role: role,
            },
          },
        });

        if (authError) throw authError;
        if (!newUser.user) throw new Error("Gagal membuat pengguna baru.");

        toast.success("Personel baru berhasil ditambahkan.");
      }
      setIsPersonnelDialogOpen(false);
      fetchPersonnel();
    } catch (error: any) {
      toast.error(`Gagal menyimpan personel: ${error.message}`);
      console.error("Error saving personnel:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeletePersonnel = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus personel ini? Tindakan ini tidak dapat dibatalkan.")) {
      setLoadingData(true);
      try {
        // First, delete associated schedules
        const { error: scheduleError } = await supabase
          .from('schedules')
          .delete()
          .eq('user_id', id);
        if (scheduleError) {
          console.error("Error deleting associated schedules:", scheduleError);
          // Don't throw, try to delete profile anyway
        }

        // Then, delete the profile (which should cascade to auth.users if RLS is set up correctly)
        // Note: Supabase recommends handling user deletion via Auth Admin API or a server-side function
        // For simplicity in a client-side app, we'll try to delete the profile.
        // If the user is deleted from auth.users, the profile will automatically be removed if linked by foreign key.
        // If not, you might need a separate admin action or a Supabase Edge Function.
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (profileError) throw profileError;

        toast.success("Personel berhasil dihapus.");
        fetchPersonnel();
      } catch (error: any) {
        toast.error(`Gagal menghapus personel: ${error.message}`);
        console.error("Error deleting personnel:", error);
      } finally {
        setLoadingData(false);
      }
    }
  };

  // Location Management Handlers
  const handleAddLocationClick = () => {
    setCurrentLocation(null);
    setLocationName('');
    setPosisiGedung(undefined);
    setIsLocationDialogOpen(true);
  };

  const handleEditLocationClick = (location: Location) => {
    setCurrentLocation(location);
    setLocationName(location.name);
    setPosisiGedung(location.posisi_gedung || undefined);
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    setLoadingData(true);
    try {
      if (currentLocation) {
        // Update existing location
        const updates = {
          name: locationName,
          posisi_gedung: posisiGedung || null,
        };
        const { error } = await supabase
          .from('locations')
          .update(updates)
          .eq('id', currentLocation.id);

        if (error) throw error;
        toast.success("Lokasi berhasil diperbarui.");
      } else {
        // Add new location
        const { data, error } = await supabase
          .from('locations')
          .insert({ name: locationName, posisi_gedung: posisiGedung || null })
          .select(); // Select the inserted data to get the ID for QR code generation

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Gagal menambahkan lokasi baru.");

        const newLocationId = data[0].id;
        // Generate QR code data (e.g., a URL pointing to the scan page with location ID)
        const qrCodeData = `${window.location.origin}/scan-location?locationId=${newLocationId}`;

        // Update the newly created location with the QR code data
        const { error: updateError } = await supabase
          .from('locations')
          .update({ qr_code_data: qrCodeData })
          .eq('id', newLocationId);

        if (updateError) throw updateError;

        toast.success("Lokasi baru berhasil ditambahkan.");
      }
      setIsLocationDialogOpen(false);
      fetchLocations();
    } catch (error: any) {
      toast.error(`Gagal menyimpan lokasi: ${error.message}`);
      console.error("Error saving location:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus lokasi ini? Semua laporan dan jadwal terkait juga akan dihapus.")) {
      setLoadingData(true);
      try {
        // Delete associated check area reports
        const { error: reportError } = await supabase
          .from('check_area_reports')
          .delete()
          .eq('location_id', id);
        if (reportError) console.error("Error deleting associated reports:", reportError);

        // Delete associated schedules
        const { error: scheduleError } = await supabase
          .from('schedules')
          .delete()
          .eq('location_id', id);
        if (scheduleError) console.error("Error deleting associated schedules:", scheduleError);

        // Delete associated apars
        const { error: aparError } = await supabase
          .from('apars')
          .delete()
          .eq('location_id', id);
        if (aparError) console.error("Error deleting associated apars:", aparError);

        // Delete the location itself
        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', id);

        if (error) throw error;
        toast.success("Lokasi berhasil dihapus.");
        fetchLocations();
        fetchApars(); // Re-fetch apars as well
      } catch (error: any) {
        toast.error(`Gagal menghapus lokasi: ${error.message}`);
        console.error("Error deleting location:", error);
      } finally {
        setLoadingData(false);
      }
    }
  };

  const handlePrintQRCode = (locationId: string) => {
    navigate(`/print-qr/${locationId}`);
  };

  // APAR Management Handlers
  const handleAddAparClick = () => {
    setCurrentApar(null);
    setSelectedLocationId(undefined); // Reset selected location ID
    setAparExpiredDate(undefined);
    setIsAparDialogOpen(true);
  };

  const handleEditAparClick = (apar: Apar) => {
    setCurrentApar(apar);
    setSelectedLocationId(apar.location_id); // Set selected location ID from existing APAR
    setAparExpiredDate(new Date(apar.expired_date));
    setIsAparDialogOpen(true);
  };

  const handleSaveApar = async () => {
    setLoadingData(true);
    try {
      if (!selectedLocationId || !aparExpiredDate) { // Check for selectedLocationId
        toast.error("Lokasi APAR dan Tanggal Kedaluwarsa harus diisi.");
        return;
      }

      const formattedExpiredDate = format(aparExpiredDate, 'yyyy-MM-dd');
      
      if (currentApar) {
        // Update existing APAR
        const updates = {
          location_id: selectedLocationId,
          expired_date: formattedExpiredDate,
        };
        const { error } = await supabase
          .from('apars')
          .update(updates)
          .eq('id', currentApar.id);

        if (error) throw error;
        toast.success("Data APAR berhasil diperbarui.");
      } else {
        // Add new APAR
        const { data, error } = await supabase
          .from('apars')
          .insert({
            location_id: selectedLocationId, // Use selectedLocationId directly
            expired_date: formattedExpiredDate,
            qr_code_data: 'temp_qr_data', // Placeholder, will be updated
          })
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error("Gagal menambahkan APAR baru.");

        const newAparId = data.id;
        const qrCodeData = `${window.location.origin}/scan-apar?aparId=${newAparId}`;

        const { error: updateError } = await supabase
          .from('apars')
          .update({ qr_code_data: qrCodeData })
          .eq('id', newAparId);

        if (updateError) throw updateError;

        toast.success("APAR baru berhasil ditambahkan.");
      }
      setIsAparDialogOpen(false);
      fetchApars();
    } catch (error: any) {
      toast.error(`Gagal menyimpan APAR: ${error.message}`);
      console.error("Error saving APAR:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteApar = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus APAR ini?")) {
      setLoadingData(true);
      try {
        const { error } = await supabase
          .from('apars')
          .delete()
          .eq('id', id);

        if (error) throw error;
        toast.success("APAR berhasil dihapus.");
        fetchApars();
      } catch (error: any) {
        toast.error(`Gagal menghapus APAR: ${error.message}`);
        console.error("Error deleting APAR:", error);
      } finally {
        setLoadingData(false);
      }
    }
  };

  const handlePrintAparQRCode = (aparId: string) => {
    navigate(`/print-apar-qr/${aparId}`);
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat dashboard admin...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-5xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personnel" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personnel">Kelola Personel</TabsTrigger>
              <TabsTrigger value="locations">Kelola Lokasi</TabsTrigger>
              <TabsTrigger value="apar-management">Kelola APAR</TabsTrigger>
              <TabsTrigger value="satpam-schedule">Penjadwalan Satpam</TabsTrigger>
            </TabsList>

            {/* Tab Content for Personnel Management */}
            <TabsContent value="personnel" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Daftar Personel</h3>
                <Button onClick={handleAddPersonnelClick}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Tambah Personel
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Depan</TableHead>
                      <TableHead>Nama Belakang</TableHead>
                      <TableHead>No. ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Peran</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personnelList.map((personnel) => (
                      <TableRow key={personnel.id}>
                        <TableCell>{personnel.first_name}</TableCell>
                        <TableCell>{personnel.last_name}</TableCell>
                        <TableCell>{personnel.id_number || '-'}</TableCell>
                        <TableCell>{personnel.email}</TableCell>
                        <TableCell>{personnel.role}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditPersonnelClick(personnel)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeletePersonnel(personnel.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab Content for Location Management */}
            <TabsContent value="locations" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Daftar Lokasi</h3>
                <Button onClick={handleAddLocationClick}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Tambah Lokasi
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Lokasi</TableHead>
                      <TableHead>Posisi Gedung</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locationList.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell>{location.name}</TableCell>
                        <TableCell>{location.posisi_gedung || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditLocationClick(location)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handlePrintQRCode(location.id)}>
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteLocation(location.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab Content for APAR Management */}
            <TabsContent value="apar-management" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Daftar APAR</h3>
                <Button onClick={handleAddAparClick}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Tambah APAR
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lokasi APAR</TableHead>
                      <TableHead>Gedung</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Expired Date</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aparList.map((apar) => (
                      <TableRow key={apar.id}>
                        <TableCell>{apar.locations?.name || 'N/A'}</TableCell>
                        <TableCell>{apar.locations?.posisi_gedung || 'N/A'}</TableCell>
                        <TableCell>
                          <a href={apar.qr_code_data} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Lihat QR
                          </a>
                        </TableCell>
                        <TableCell>{format(new Date(apar.expired_date), 'dd MMMM yyyy')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditAparClick(apar)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handlePrintAparQRCode(apar.id)}>
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteApar(apar.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab Content for Satpam Schedule */}
            <TabsContent value="satpam-schedule" className="mt-4">
              <h3 className="text-xl font-semibold mb-4">Penjadwalan Satpam</h3>
              <SatpamSchedule /> {/* Render the SatpamSchedule component here */}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Personnel Dialog */}
      <Dialog open={isPersonnelDialogOpen} onOpenChange={setIsPersonnelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentPersonnel ? 'Edit Personel' : 'Tambah Personel Baru'}
            </DialogTitle>
            <DialogDescription>
              {currentPersonnel ? 'Ubah detail personel.' : 'Isi detail untuk personel baru.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">
                Nama Depan
              </Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Nama Belakang
              </Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="idNumber" className="text-right">
                No. ID
              </Label>
              <Input id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
            </div>
            {!currentPersonnel && ( // Only show password for new personnel
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Password
                </Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="col-span-3" />
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Peran
              </Label>
              <Select onValueChange={setRole} value={role}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Pilih Peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satpam">Satpam</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="atasan">Atasan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSavePersonnel} disabled={loadingData}>
              {loadingData ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}
            </DialogTitle>
            <DialogDescription>
              {currentLocation ? 'Ubah detail lokasi.' : 'Isi detail untuk lokasi baru.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="locationName" className="text-right">
                Nama Lokasi
              </Label>
              <Input id="locationName" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="posisiGedung" className="text-right">
                Posisi Gedung
              </Label>
              <Select onValueChange={setPosisiGedung} value={posisiGedung}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Pilih Posisi Gedung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gedung Barat">Gedung Barat</SelectItem>
                  <SelectItem value="Gedung Timur">Gedung Timur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveLocation} disabled={loadingData}>
              {loadingData ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APAR Dialog */}
      <Dialog open={isAparDialogOpen} onOpenChange={setIsAparDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentApar ? 'Edit APAR' : 'Tambah APAR Baru'}</DialogTitle>
            <DialogDescription>
              {currentApar ? 'Ubah detail APAR.' : 'Isi detail untuk APAR baru.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="aparLocation" className="text-right">
                Lokasi APAR
              </Label>
              <Select onValueChange={setSelectedLocationId} value={selectedLocationId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Pilih Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  {locationList.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.posisi_gedung})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="aparExpiredDate" className="text-right">
                Expired Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !aparExpiredDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {aparExpiredDate ? format(aparExpiredDate, "PPP") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={aparExpiredDate}
                    onSelect={setAparExpiredDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveApar} disabled={loadingData}>
              {loadingData ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;