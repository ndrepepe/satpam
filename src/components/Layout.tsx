import React from 'react';
import Navbar from './Navbar';
// import { MadeWithDyad } from './made-with-dyad'; // Dihapus

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      {/* <MadeWithDyad /> Dihapus */}
    </div>
  );
};

export default Layout;