import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, LayoutDashboard, PlusCircle, Store, Users, Menu, ChevronLeft, ChevronRight, X, Package, ShoppingCart, FileText } from 'lucide-react';

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
          bg-slate-900 text-white
          transition-all duration-300 ease-in-out
          flex flex-col
          ${isMobileOpen ? 'translate-x-0 w-64 shadow-xl' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          {!isCollapsed && <span className="font-bold text-lg tracking-tight whitespace-nowrap">PAYTECH</span>}
          {isCollapsed && <span className="font-bold text-lg mx-auto">PT</span>}
          
          {/* Mobile Close Button */}
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white">
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
                  ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
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
        <div className="p-4 border-t border-slate-800 hidden md:flex justify-end shrink-0">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
            <h2 className="text-xl font-bold text-gray-800 md:hidden">PAYTECH</h2>
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