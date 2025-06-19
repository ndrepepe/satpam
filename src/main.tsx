import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionContextProvider } from '@/integrations/supabase/SessionContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SessionContextProvider>
      <App />
    </SessionContextProvider>
  </BrowserRouter>
);