import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Library, MessageSquarePlus, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/library', icon: Library, label: 'Library' },
    { to: '/request', icon: MessageSquarePlus, label: 'Request' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#121212] border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around py-3 w-full">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(`${item.to}/`));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex flex-col items-center gap-1 px-4 py-2 transition-all duration-200',
                isActive
                  ? 'text-white'
                  : 'text-[#b3b3b3]'
              )}
            >
              <item.icon className={cn("h-6 w-6 relative z-10", isActive && "text-white")} />
              <span className={cn("text-[10px] relative z-10", isActive ? "text-white font-medium" : "text-[#b3b3b3]")}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
