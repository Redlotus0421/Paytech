import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, LayoutDashboard, PlusCircle, Store, Users, Menu, ChevronLeft, ChevronRight, X, Package, ShoppingCart, FileText, BarChart } from 'lucide-react';
import { PaytechLogo } from './PaytechLogo';

interface LayoutProps {
  user: User;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, currentView, onNavigate, onLogout, children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'entry', label: 'New Report', icon: PlusCircle },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'manage-stores', label: 'Stores', icon: Store, role: UserRole.ADMIN },
    { id: 'manage-users', label: 'Users', icon: Users, role: UserRole.ADMIN },
  ];

  // Filter nav items based on user role and permissions
  const visibleNavItems = navItems.filter(item => {
    // Admins always see admin tabs
    if (item.role === UserRole.ADMIN) {
        return user.role === UserRole.ADMIN;
    }
    
    // For non-admin tabs, check the permissions array
    // If the user has a defined (even empty) permissions array, we MUST check against it
    if (user.permissions) {
        return user.permissions.includes(item.id);
    }

    // Fallback for older users without a permissions array: show all non-admin tabs
    return true; 
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {isMobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileOpen(false)} />}

      <aside className={`fixed md:static inset-y-0 left-0 z-50 bg-[#153968] text-white transition-all duration-300 flex flex-col ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#2a558c] shrink-0 relative z-20 overflow-hidden">
          {!isCollapsed && <div className="flex items-center justify-center w-full relative pointer-events-none mb-4"><PaytechLogo className="h-32 w-auto max-w-full" /></div>}
          {isCollapsed && <div className="flex items-center font-extrabold text-xl mx-auto"><span className="text-white">P</span><span className="text-[#58A6DF]">T</span></div>}
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-300 hover:text-white absolute right-4 top-6 z-30 pointer-events-auto"><X size={20} /></button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto relative z-30">
          {visibleNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button key={item.id} onClick={() => { onNavigate(item.id); setIsMobileOpen(false); }}
                className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-[#58A6DF] text-white' : 'text-slate-300 hover:bg-[#2a558c]'} ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? item.label : ''}>
                <item.icon size={20} className={isCollapsed ? '' : 'mr-3'} />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#2a558c] hidden md:flex justify-end shrink-0 relative z-20">
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg bg-[#2a558c] text-slate-300 hover:text-white"><ChevronLeft size={20} className={isCollapsed ? 'rotate-180' : ''} /></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full w-full min-w-0">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setIsMobileOpen(true)} className="mr-4 p-2 text-gray-600 md:hidden"><Menu size={24} /></button>
            <div className="flex items-center md:hidden"><PaytechLogo className="h-10 w-auto" /></div>
            <h2 className="text-lg font-semibold text-gray-700 hidden md:block">{visibleNavItems.find(i => i.id === currentView)?.label || 'Dashboard'}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</div>
            </div>
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <button onClick={onLogout} className="flex items-center text-gray-500 hover:text-red-600"><LogOut size={20} /><span className="ml-2 text-sm font-medium hidden sm:inline">Logout</span></button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};