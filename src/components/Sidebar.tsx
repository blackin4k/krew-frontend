import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Search,
  Library,
  Plus,
  Heart,
  ListMusic,
  LogOut,
  Disc3,
  Users,
  Radio,
  Upload,
  Music,
  Sparkles,
  FlaskConical,
  Orbit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';

// Reusable Content Component
export const SidebarContent = ({ onNavigate, mode = 'desktop' }: { onNavigate?: () => void, mode?: 'desktop' | 'mobile' }) => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    if (onNavigate) onNavigate();
    navigate('/auth');
  };

  const handleClick = (to: string) => {
    if (onNavigate) onNavigate();
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/library', icon: Library, label: 'Library' },
    { to: '/radio', icon: Radio, label: 'Radio' },
    { to: '/upload', icon: Upload, label: 'Upload' },
    { to: '/jam', icon: Users, label: 'Jam' },

  ].filter(item => {
    if (mode === 'mobile') {
      // Hide Search, Library, and The Lab on mobile
      return !['Search', 'Library', 'The Lab'].includes(item.label);
    }
    return true;
  });

  const libraryItems = [
    { to: '/library/liked', icon: Heart, label: 'Liked Songs' },
    { to: '/library/playlists', icon: ListMusic, label: 'Playlists' },
    { to: '/albums', icon: Disc3, label: 'Albums' },
    { to: '/artists', icon: Users, label: 'Artists' },
    { to: '/queue', icon: Music, label: 'Queue' },
  ].filter(item => {
    if (mode === 'mobile') {
      return !['Liked Songs', 'Playlists'].includes(item.label);
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar relative bg-black text-[#B3B3B3]">
      {/* Profile Header - Compact & Clean */}
      <div className="pt-8 px-6 pb-6">
        <NavLink
          to="/profile"
          onClick={() => handleClick('/profile')}
          className="flex items-center gap-4 group"
        >
          <div className="h-10 w-10 rounded-full bg-[#282828] flex items-center justify-center overflow-hidden">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[16px] text-white leading-tight">
              {useAuthStore(state => state.user?.username || 'Guest')}
            </span>
            <span className="text-[12px] text-[#B3B3B3] group-hover:text-white transition-colors">
              View profile
            </span>
          </div>
        </NavLink>
      </div>

      {/* Main nav - Dense, Bold, White Active */}
      <nav className="px-2 space-y-1 mb-6">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => handleClick(item.to)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-4 px-4 py-3 rounded-[4px] transition-colors duration-200 font-bold', // Spotify uses bold for main nav
                isActive
                  ? 'text-white bg-[#282828]'
                  : 'text-[#B3B3B3] hover:text-white hover:bg-[#121212]'
              )
            }
          >
            <item.icon className={cn("h-6 w-6")} strokeWidth={2.5} /> {/* Thicker icons */}
            <span className="text-[16px] tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Library section - Less prominent */}
      <div className="mt-2 px-2">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[12px] font-bold text-[#B3B3B3] uppercase tracking-wider">
            Your Library
          </span>
          <button className="p-1 rounded-full hover:bg-[#282828] hover:text-white transition-colors text-[#B3B3B3]">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {libraryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => handleClick(item.to)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-[4px] transition-colors',
                  isActive
                    ? 'text-white bg-[#282828]'
                    : 'text-[#B3B3B3] hover:text-white hover:bg-[#121212]'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[14px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* Bottom Actions */}
      <div className="px-4 pb-6 space-y-1 pt-4 border-t border-[#282828]">
        <NavLink
          to="/capsule"
          onClick={() => handleClick('/capsule')}
          className={({ isActive }) => cn(
            "w-full flex items-center px-4 py-3 rounded-[4px] transition-colors text-[14px] font-medium",
            isActive
              ? "text-white"
              : "text-[#B3B3B3] hover:text-white"
          )}
        >
          <Sparkles className="h-5 w-5 mr-3" />
          Your Capsule
        </NavLink>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-[#B3B3B3] hover:text-white pl-4 h-auto py-3 text-[14px] font-medium hover:bg-transparent"
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

const Sidebar = () => {
  return (
    <div className="hidden md:flex flex-col w-64 fixed left-0 top-0 bottom-0 z-30 bg-black border-r border-[#121212]">
      <SidebarContent />
    </div>
  );
};

export default Sidebar;
