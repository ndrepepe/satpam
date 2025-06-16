import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';
import { useNavigate, useLocation } from 'react-router-dom';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('SessionContext: Auth state changed:', event, 'Session:', currentSession, 'Path:', location.pathname);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        console.log('SessionContext: SIGNED_OUT event detected, navigating to /login');
        navigate('/login');
      } else if (currentSession && location.pathname === '/login') {
        console.log('SessionContext: User signed in on login page, navigating to /');
        navigate('/');
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('SessionContext: Initial getSession result:', currentSession, 'Path:', location.pathname);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);
      // Only navigate if there's no session and not already on the login page
      if (!currentSession && location.pathname !== '/login') {
        console.log('SessionContext: No session on non-login page, navigating to /login');
        navigate('/login');
      } else if (currentSession && location.pathname === '/login') {
        // If there's a session and user is on login page, navigate to home
        console.log('SessionContext: Session exists on login page, navigating to /');
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]); // Menghapus location.pathname dari dependensi

  return (
    <SessionContext.Provider value={{ session, user, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};