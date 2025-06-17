import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useSession();

  useEffect(() => {
    console.log('Login Page useEffect: session:', session, 'loading:', loading, 'Path:', location.pathname);
    if (!loading && session) {
      console.log('Login Page useEffect: Session exists and not loading, navigating to /');
      navigate('/');
    }
  }, [session, loading, navigate, location.pathname]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Login ke Aplikasi Satpam</h2>
        <Auth
          supabaseClient={supabase}
          providers={[]}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light"
          redirectTo={window.location.origin}
          localization={{
            variables: {
              sign_in: {
                link_text: {
                  no_account: '', // Mengatur teks ini menjadi kosong
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;