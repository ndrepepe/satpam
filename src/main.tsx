import ReactDOM from 'react-dom/client';
import App from './App';
import { SessionContextProvider } from '@/integrations/supabase/SessionContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SessionContextProvider>
    <App />
  </SessionContextProvider>
);