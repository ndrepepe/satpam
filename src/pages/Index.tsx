import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSession } from "@/integrations/supabase/SessionContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
    }
  }, [session, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Memuat sesi pengguna...</p>
      </div>
    );
  }

  if (!session) {
    return null; // Akan dialihkan oleh useEffect
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Selamat Datang di Aplikasi Satpam Anda</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Anda telah berhasil login.
        </p>
        <p className="text-md text-gray-500 dark:text-gray-300 mt-2">
          Kunjungi halaman profil Anda untuk melihat atau memperbarui detail Anda.
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;