import { WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="w-full bg-[#3b82f6] text-black px-4 py-2 flex items-center justify-between z-50 shadow-md">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-semibold">You are currently offline.</span>
      </div>
      <button 
        onClick={() => navigate('/library/offline')}
        className="text-xs bg-black text-white px-3 py-1 rounded-full hover:bg-black/80 transition-colors font-bold"
      >
        Go to Downloads
      </button>
    </div>
  );
};

export default OfflineBanner;
