import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { SessionContextProvider } from '@/integrations/supabase/SessionContext';

function App() {
  return (
    <BrowserRouter>
      <SessionContextProvider>
        <AppRoutes />
      </SessionContextProvider>
    </BrowserRouter>
  );
}

export default App;