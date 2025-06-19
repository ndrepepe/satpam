import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/integrations/supabase/SessionContext';

const Home = () => {
  const { session } = useSession();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6">Welcome to Security Check App</h1>
        {session ? (
          <Button onClick={() => navigate('/satpam-dashboard')}>
            Go to Dashboard
          </Button>
        ) : (
          <Button onClick={() => navigate('/login')}>
            Login to Continue
          </Button>
        )}
      </div>
    </div>
  );
};

export default Home;