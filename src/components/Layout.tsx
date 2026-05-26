import React from 'react';
import Navbar from './Navbar';
import SpatialBackground from './SpatialBackground';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col text-slate-100 relative overflow-x-hidden font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Generative 3D/WebGL Background */}
      <SpatialBackground />
      
      {/* Futuristic HUD Navbar */}
      <Navbar />
      
      {/* Main Content Area with Spatial Perspective */}
      <main className="flex-1 w-full relative z-10 flex flex-col justify-start items-center px-4 py-6 md:py-12">
        <div className="w-full max-w-7xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;