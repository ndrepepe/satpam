import { Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import Layout from './components/Layout';

// Import komponen halaman
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));

function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;