import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, LayoutDashboard, PlusCircle, Store, Users, Menu, ChevronLeft, ChevronRight, X, Package, ShoppingCart, FileText, BarChart, Settings as SettingsIcon, Receipt } from 'lucide-react';
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
    { id: 'transactions', label: 'Transactions', icon: Receipt }, // NEW TAB
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'entry', label: 'New Report', icon: PlusCircle },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory', icon: Package },
    // Admin Only Tabs
    { id: 'manage-stores', label: 'Stores', icon: Store, role: UserRole.ADMIN },
    { id: 'manage-users', label: 'Users', icon: Users, role: UserRole.ADMIN },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, role: UserRole.ADMIN },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (item.role === UserRole.ADMIN) {
        return user.role === UserRole.ADMIN;
    }
    if (user.permissions) {
        return user.permissions.includes(item.id);
    }
    return true; 
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-[#153968] text-white
          transition-all duration-300 ease-in-out
          flex flex-col
          ${isMobileOpen ? 'translate-x-0 w-64 shadow-xl' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Sidebar Header - Fixed height h-16 to align with dashboard header */}
        <div className="h-16 flex items-center justify-between px-4 py-2 border-b border-[#2a558c] shrink-0 relative z-20 overflow-hidden">
          {!isCollapsed && (
            // FIX: Maximize logo height to fill the container (h-full) while maintaining aspect ratio (w-auto)
            // Removed fixed pixel height constraints.
            <div className="flex items-center justify-center w-full h-full relative pointer-events-none">
               <PaytechLogo className="h-full w-auto max-w-full object-contain" />
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center font-extrabold text-xl mx-auto">
                <span className="text-white">P</span>
                <span className="text-[#58A6DF]">T</span>
            </div>
          )}
          
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-300 hover:text-white absolute right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto relative z-30">
          {visibleNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMobileOpen(false);
                }}
                className={`
                  w-full flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer relative
                  ${isActive ? 'bg-[#58A6DF] text-white shadow-md' : 'text-slate-300 hover:bg-[#2a558c] hover:text-white'}
                  ${isCollapsed ? 'justify-center' : 'justify-start'}
                `}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={20} className={`${isCollapsed ? '' : 'mr-3'} min-w-[20px]`} />
                {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#2a558c] hidden md:flex justify-end shrink-0 relative z-20">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg bg-[#2a558c] text-slate-300 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileOpen(true)}
              className="mr-4 p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md md:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center md:hidden">
                 <PaytechLogo className="h-10 w-auto" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 hidden md:block">
              {visibleNavItems.find(i => i.id === currentView)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</div>
            </div>
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <button 
              onClick={onLogout}
              className="flex items-center text-gray-500 hover:bg-red-50 hover:text-red-600 px-3 py-2 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
              <span className="ml-2 text-sm font-medium hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
          {/* Content of the current view */}
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
              {children}
            </div>
        </main>
      </div>
    </div>
  );
};