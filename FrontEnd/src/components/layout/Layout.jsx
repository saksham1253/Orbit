import Navbar from './Navbar';
import Footer from './Footer';
import useSocket from '../../hooks/useSocket';

const Layout = ({ children }) => {
  useSocket();
  return (
    <div className="min-h-screen flex flex-col relative" style={{ zIndex: 1 }}>
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
