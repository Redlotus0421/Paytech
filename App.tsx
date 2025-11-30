import React, { useState, useEffect } from 'react';
import { User } from './types';
import { storageService } from './services/storageService';
import { supabase } from './services/supabaseClient';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { EntryForm } from './components/EntryForm';
import { AdminSettings } from './components/AdminSettings';
import { Lock, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<string>('dashboard');
  const [usernameInput, setUsernameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const currentUser = storageService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Try to login via Supabase first
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', usernameInput)
        .eq('status', 'active') // Only allow active users
        .maybeSingle(); // Use maybeSingle to avoid 406 error if not found

      if (data) {
        // Map the Supabase user to our App User type
        // Handling dynamic column names for store_id
        const appUser: User = {
          id: data.id,
          username: data.username,
          name: data.name,
          role: data.role,
          storeId: data.store_id || data.storeId || data.storeid,
          status: data.status
        };

        storageService.saveSessionUser(appUser);
        setUser(appUser);
        setView('dashboard');
        return;
      }

      // 2. Fallback to LocalStorage (Legacy/Offline Admin)
      const localUser = storageService.login(usernameInput);
      if (localUser) {
        setUser(localUser);
        setView('dashboard');
      } else {
        alert('User not found. If you created a new account, please check the username.');
      }

    } catch (err) {
      console.error('Login error:', err);
      alert('An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
    setUsernameInput('');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full">
          <div className="text-center mb-8">
            <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">PAYTECH</h1>
            <p className="text-gray-500 mt-2">Sign in to start your shift</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                placeholder="Enter username"
              />
            </div>
            <button 
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors flex justify-center items-center"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2" size={20}/> : null}
              {isLoading ? 'Checking...' : 'Sign In'}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-2">Demo Credentials:</p>
            <div className="flex justify-center gap-4 text-xs font-mono">
              <span className="bg-slate-50 px-2 py-1 rounded border">admin</span>
              <span className="bg-slate-50 px-2 py-1 rounded border">jane</span>
              <span className="bg-slate-50 px-2 py-1 rounded border">john</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} currentView={view} onNavigate={setView} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard user={user} />}
      {view === 'entry' && <EntryForm user={user} onSuccess={() => setView('dashboard')} />}
      {view === 'manage-stores' && <AdminSettings activeTab="stores" />}
      {view === 'manage-users' && <AdminSettings activeTab="users" />}
    </Layout>
  );
};

export default App;