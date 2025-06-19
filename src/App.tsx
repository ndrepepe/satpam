import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { SessionContextProvider } from '@/integrations/supabase/SessionContext';

function App() {
  return (
    <SessionContextProvider>
      <Router>
        <AppRoutes />
      </Router>
    </SessionContextProvider>
  );
}

export default App;