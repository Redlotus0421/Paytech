import React, { useState, useEffect } from 'react';
import { User } from './types';
import { storageService } from './services/storageService';
import { supabase } from './services/supabaseClient';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { EntryForm } from './components/EntryForm';
import { AdminSettings } from './components/AdminSettings';
import { Inventory } from './components/Inventory';
import { POS } from './components/POS';
import { Reports } from './components/Reports'; // Verified Import
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { Loader2 } from 'lucide-react';
import { PaytechLogo } from './components/PaytechLogo';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<string>('dashboard');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
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
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', usernameInput)
        .eq('status', 'active')
        .maybeSingle();

      if (data) {
        const appUser: User = {
          id: data.id,
          username: data.username,
          name: data.name,
          role: data.role,
          storeId: data.store_id || data.storeId || data.storeid,
          status: data.status,
          password: data.password,
          permissions: data.permissions || [], 
        };

        if (appUser.password && appUser.password !== passwordInput) {
            alert("Invalid password");
            setIsLoading(false);
            return;
        }

        storageService.saveSessionUser(appUser);
        setUser(appUser);
        setView('dashboard');
        return;
      }

      const localUser = storageService.login(usernameInput, passwordInput);
      if (localUser) {
        setUser(localUser);
        setView('dashboard');
      } else {
        alert('User not found. If you created a new account, please check the username and password.');
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
    setPasswordInput('');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#153968] to-[#58A6DF] flex items-center justify-center p-4">
        <div className="bg-white px-8 pb-8 pt-2 rounded-xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-1 flex flex-col items-center w-full">
            <PaytechLogo className="h-64 w-auto -mt-10 -mb-6" />
            <p className="text-gray-500 text-sm font-medium">Sign in to start your shift</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="Enter password" />
            </div>
            <button disabled={isLoading} className="w-full bg-[#58A6DF] text-white py-3 rounded-lg font-bold hover:bg-[#4a90c5] flex justify-center items-center">
              {isLoading ? <Loader2 className="animate-spin mr-2" size={20}/> : null}
              {isLoading ? 'Checking...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} currentView={view} onNavigate={setView} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard user={user} />}
      {view === 'analytics' && <Analytics />}
      {view === 'reports' && <Reports user={user} />}
      {view === 'entry' && <EntryForm user={user} onSuccess={() => setView('dashboard')} />}
      {view === 'pos' && <POS user={user} />}
      {view === 'inventory' && <Inventory user={user} />}
      {view === 'manage-stores' && <AdminSettings activeTab="stores" />}
      {view === 'manage-users' && <AdminSettings activeTab="users" />}
      {view === 'settings' && <Settings user={user} onLogout={handleLogout} />} 
    </Layout>
  );
};

export default App;