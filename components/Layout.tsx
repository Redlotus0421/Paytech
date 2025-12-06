import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, LayoutDashboard, PlusCircle, Store, Users, Menu, ChevronLeft, ChevronRight, X, Package, ShoppingCart, FileText } from 'lucide-react';
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
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'entry', label: 'New Report', icon: PlusCircle },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory', icon: Package },
    // Admin Only Tabs
    { id: 'manage-stores', label: 'Stores', icon: Store, role: UserRole.ADMIN },
    { id: 'manage-users', label: 'Users', icon: Users, role: UserRole.ADMIN },
  ];

  const visibleNavItems = navItems.filter(item => !item.role || item.role === user.role);

  // BRAND COLORS:
  // Dark Navy: #153968
  // Sky Blue: #58A6DF

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
        {/* Sidebar Header - Aligned to h-16 to match dashboard header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#2a558c] shrink-0 relative">
          {!isCollapsed && (
            <div className="flex items-center justify-center w-full">
               <PaytechLogo className="w-full h-auto max-w-[200px]" />
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center font-extrabold text-xl mx-auto">
                <span className="text-white">P</span>
                <span className="text-[#58A6DF]">T</span>
            </div>
          )}
          
          {/* Mobile Close Button */}
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-300 hover:text-white absolute right-4 top-1/2 -translate-y-1/2">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
                  w-full flex items-center p-3 rounded-lg transition-all duration-200
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

        {/* Sidebar Footer (Collapse Toggle) */}
        <div className="p-4 border-t border-[#2a558c] hidden md:flex justify-end shrink-0">
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
            {/* Mobile Logo */}
            <div className="flex items-center md:hidden">
                 <PaytechLogo className="h-10 w-auto" />
            </div>
            {/* Desktop View Title */}
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};