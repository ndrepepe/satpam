import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Shield } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && session) {
      navigate('/');
    }
  }, [session, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
            <Shield className="h-8 w-8 text-indigo-600 animate-bounce" />
          </div>
          <p className="text-sm font-medium text-slate-500">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 transition-all duration-300">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner">
            <Shield className="h-10 w-10" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Selamat Datang Kembali
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Masuk untuk mengakses sistem patroli Satpam
            </p>
          </div>
        </div>

        <div className="auth-container">
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                    inputBackground: 'transparent',
                    inputText: 'inherit',
                    inputBorder: '#e2e8f0',
                    inputBorderFocus: '#4f46e5',
                  },
                  radii: {
                    buttonBorderRadius: '12px',
                    inputBorderRadius: '12px',
                  }
                },
              },
            }}
            theme="light"
            redirectTo={window.location.origin}
            view="sign_in"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;