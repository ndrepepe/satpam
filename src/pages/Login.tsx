import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/integrations/supabase/SessionContext';
import { ShieldAlert, Cpu, Shield } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && session) {
      navigate('/');
    }
  }, [session, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Cpu className="h-6 w-6 text-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto my-8 relative group">
      {/* Glowing background aura */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 opacity-30 blur-xl transition duration-1000 group-hover:opacity-40 group-hover:duration-200" />
      
      <div className="relative rounded-3xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center space-y-4 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
              <ShieldAlert className="h-7 w-7 text-cyan-400" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-wider text-white">PORTAL OTENTIKASI</h2>
            <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">Sistem Keamanan Terintegrasi</p>
          </div>
        </div>

        <div className="supabase-auth-spatial">
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#06b6d4',
                    brandAccent: '#0891b2',
                    inputBackground: 'rgba(15, 23, 42, 0.6)',
                    inputBorder: 'rgba(51, 65, 85, 0.8)',
                    inputText: '#f8fafc',
                    inputPlaceholder: '#64748b',
                  },
                  radii: {
                    buttonBorderRadius: '12px',
                    inputBorderRadius: '12px',
                  }
                },
              },
            }}
            theme="dark"
            redirectTo={window.location.origin}
            view="sign_in"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;