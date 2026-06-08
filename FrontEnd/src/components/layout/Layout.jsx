import Navbar from './Navbar';
import useSocket from '../../hooks/useSocket';
import { useUIStore } from '../../store/uiStore';

const Layout = ({ children }) => {
  useSocket();
  const isVideoCallActive = useUIStore((state) => state.isVideoCallActive);
  
  return (
    <div className="min-h-screen flex flex-col relative" style={{ zIndex: 1 }}>
      {!isVideoCallActive && <Navbar />}
      <main className={`flex-1 w-full mx-auto relative z-10 ${isVideoCallActive ? 'max-w-none p-0' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
