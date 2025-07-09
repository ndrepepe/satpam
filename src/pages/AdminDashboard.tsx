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
import { Trash2, Edit, PlusCircle, QrCode } from 'lucide-react';

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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, id_number, email, role')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonnelList(data as Profile[]);
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

        // Delete the location itself
        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', id);

        if (error) throw error;
        toast.success("Lokasi berhasil dihapus.");
        fetchLocations();
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
      <Card className="max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-center">Dashboard Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personnel" className="w-full">
            <TabsList className="grid w-full grid-cols-4"> {/* Ubah grid-cols-3 menjadi grid-cols-4 */}
              <TabsTrigger value="personnel">Kelola Personel</TabsTrigger>
              <TabsTrigger value="locations">Kelola Lokasi</TabsTrigger>
              <TabsTrigger value="apar-check">Cek APAR</TabsTrigger> {/* Menu baru */}
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

            {/* Tab Content for APAR Check */}
            <TabsContent value="apar-check" className="mt-4">
              <h3 className="text-xl font-semibold mb-4">Manajemen Cek APAR</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Fitur untuk mengelola dan melihat laporan cek APAR akan segera hadir di sini.
              </p>
              {/* Anda bisa menambahkan komponen atau tabel di sini nanti */}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Personnel Dialog */}
      <Dialog open={isPersonnelDialogOpen} onOpenChange={setIsPersonnelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentPersonnel ? 'Edit Personel' : 'Tambah Personel Baru'}</DialogTitle>
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
            <DialogTitle>{currentLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</DialogTitle>
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
    </div>
  );
};

export default AdminDashboard;