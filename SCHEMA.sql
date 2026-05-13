-- 1. Tabel Profiles (Menyimpan data tambahan pengguna)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  id_number TEXT,
  role TEXT DEFAULT 'satpam' CHECK (role IN ('admin', 'satpam', 'atasan')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS untuk Profiles
CREATE POLICY "Profil dapat dilihat oleh semua pengguna terautentikasi" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pengguna dapat memperbarui profil sendiri" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Sistem dapat memasukkan profil baru" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. Tabel Locations (Daftar titik pengecekan)
CREATE TABLE public.locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  qr_code_data TEXT,
  posisi_gedung TEXT CHECK (posisi_gedung IN ('Gedung Barat', 'Gedung Timur')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS untuk Locations
CREATE POLICY "Lokasi dapat dilihat semua orang" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin dapat mengelola lokasi" ON public.locations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 3. Tabel Schedules (Penugasan satpam ke lokasi)
CREATE TABLE public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_date DATE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS untuk Schedules
CREATE POLICY "Jadwal dapat dilihat semua orang" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin dapat mengelola jadwal" ON public.schedules FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 4. Tabel Check Area Reports (Hasil laporan pengecekan)
CREATE TABLE public.check_area_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.check_area_reports ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS untuk Reports
CREATE POLICY "Laporan dapat dilihat semua orang" ON public.check_area_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Satpam dapat mengirim laporan" ON public.check_area_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5. Fungsi dan Trigger Otomatis (Membuat profil saat user daftar)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, id_number, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'id_number',
    COALESCE(new.raw_user_meta_data ->> 'role', 'satpam')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();