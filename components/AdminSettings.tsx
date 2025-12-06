import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { Store, User, UserRole } from '../types';
import { Store as StoreIcon, User as UserIcon, Pencil, Trash2, X, RefreshCw, Loader2, Lock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AdminSettingsProps {
  activeTab: 'stores' | 'users';
}

const ALL_PERMISSIONS = ['dashboard', 'analytics', 'reports', 'entry', 'pos', 'inventory'];

export const AdminSettings: React.FC<AdminSettingsProps> = ({ activeTab }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [dbStoreColumn, setDbStoreColumn] = useState<string>('store_id');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [authError, setAuthError] = useState('');
  const [formError, setFormError] = useState<{ field: string; message: string } | null>(null);
  
  // User Form State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserUser, setNewUserUser] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [newUserStore, setNewUserStore] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>(ALL_PERMISSIONS);

  useEffect(() => {
    setCurrentUser(storageService.getCurrentUser());
    loadStores();
    if (activeTab === 'users') {
        fetchSupabaseUsers();
    }
  }, [activeTab]);

  const loadStores = async () => {
    setIsStoreLoading(true);
    try {
      const data = await storageService.fetchStores();
      setStores(data);
    } catch (e) { console.error("Failed to load stores", e); } 
    finally { setIsStoreLoading(false); }
  };

  const fetchSupabaseUsers = async () => {
      setIsLoading(true);
      try {
          const { data, error } = await supabase.from('users').select('*').eq('status', 'active');
          if (error) throw error;
          if (data && data.length > 0) {
            const firstRow = data[0];
            if (Object.prototype.hasOwnProperty.call(firstRow, 'store_id')) setDbStoreColumn('store_id');
            else if (Object.prototype.hasOwnProperty.call(firstRow, 'storeId')) setDbStoreColumn('storeId');
            else if (Object.prototype.hasOwnProperty.call(firstRow, 'storeid')) setDbStoreColumn('storeid');
          }
          const mappedUsers: User[] = (data || []).map((u: any) => ({
              id: u.id,
              username: u.username,
              name: u.name,
              role: u.role,
              storeId: u.store_id || u.storeId || u.storeid, 
              status: u.status,
              password: u.password,
              permissions: u.permissions || []
          }));
          setUsers(mappedUsers);
      } catch (err) { console.error('Error fetching users:', err); } 
      finally { setIsLoading(false); }
  };

  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreLoc, setNewStoreLoc] = useState('');

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName) return;
    setIsStoreLoading(true);
    try {
        await storageService.addStore({ id: uuidv4(), name: newStoreName, location: newStoreLoc });
        await loadStores();
        setNewStoreName(''); setNewStoreLoc('');
    } catch (e) {
        alert("Error saving store");
        console.error(e);
    } finally { setIsStoreLoading(false); }
  };

  const initiateDeleteStore = (storeId: string) => {
      setPendingAction(() => async () => executeDeleteStore(storeId));
      setIsAuthModalOpen(true);
  };

  const executeDeleteStore = async (storeId: string) => {
    setIsStoreLoading(true);
    try {
        await storageService.deleteStore(storeId);
        await loadStores();
    } catch (e) {
        alert("Error deleting store");
        console.error(e);
    } finally { setIsStoreLoading(false); }
  };

  const confirmAuthAction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (authPassword !== currentUser?.password) {
          setAuthError('Incorrect Admin Password');
          return;
      }
      setAuthError(''); setIsAuthModalOpen(false); setAuthPassword('');
      if (pendingAction) {
          await pendingAction();
          setPendingAction(null);
      }
  };

  const closeAuthModal = () => {
      setIsAuthModalOpen(false); setAuthPassword(''); setAuthError(''); setPendingAction(null);
  };
  
  const initiateEditUser = (user: User) => {
      setPendingAction(() => async () => startEditUser(user));
      setIsAuthModalOpen(true);
  };

  const startEditUser = async (user: User) => {
    setFormError(null);
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserUser(user.username);
    setNewUserRole(user.role);
    setNewUserStore(user.storeId || '');
    setNewUserPassword(user.password || '');
    setNewUserPermissions(user.permissions || ALL_PERMISSIONS);
  };

  const cancelEditUser = () => {
    setFormError(null); setEditingUser(null); setNewUserName(''); setNewUserUser('');
    setNewUserRole(UserRole.EMPLOYEE); setNewUserStore(''); setNewUserPassword('');
    setNewUserPermissions(ALL_PERMISSIONS);
  };

  const initiateDeleteUser = (userId: string) => {
      setPendingAction(() => async () => executeDeleteUser(userId));
      setIsAuthModalOpen(true);
  };

  const executeDeleteUser = async (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    try {
        const { error } = await supabase.from('users').update({ status: 'inactive' }).eq('id', userId);
        if (error) throw error;
        await fetchSupabaseUsers();
        if (editingUser?.id === userId) cancelEditUser();
    } catch (err: any) {
        alert(`Failed to delete user: ${formatError(err)}`);
        fetchSupabaseUsers();
    }
  };

  const formatError = (err: any): string => {
    if (!err) return 'Unknown error'; if (typeof err === 'string') return err;
    if (err.message) return err.message; if (err.error_description) return err.error_description;
    if (err.details) return err.details; if (err.hint) return `${err.message || 'Error'} (${err.hint})`;
    try { return JSON.stringify(err, null, 2); } catch (e) { return String(err); }
  };

  const initiateSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      if(!newUserName || !newUserUser) return;
      
      setIsLoading(true);
      try {
        let userCheckQuery = supabase.from('users').select('id').eq('username', newUserUser);
        if (editingUser) userCheckQuery = userCheckQuery.not('id', 'eq', editingUser.id);
        const { data: existingUser, error } = await userCheckQuery.maybeSingle();
        if (error) throw new Error('Error checking username: ' + error.message);
        if (existingUser) {
            setFormError({ field: 'username', message: 'Username already taken. Please choose another.' });
            setIsLoading(false);
            return;
        }
      } catch (err: any) {
        alert(err.message);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      setPendingAction(() => async () => handleSaveUser());
      setIsAuthModalOpen(true);
  };

  const handleSaveUser = async () => {
    setIsLoading(true);
    const storeIdValue = (newUserRole === UserRole.EMPLOYEE && newUserStore && newUserStore.trim() !== '') ? newUserStore : null;

    const userData: any = {
        username: newUserUser, name: newUserName, role: newUserRole,
        status: 'active', password: newUserPassword,
        permissions: newUserPermissions // Save permissions
    };
    userData[dbStoreColumn] = storeIdValue;
    
    try {
        if (editingUser) {
            const { error } = await supabase.from('users').update(userData).eq('id', editingUser.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('users').insert([{ ...userData, id: uuidv4() }]);
            if (error) throw error;
        }
        await fetchSupabaseUsers();
        cancelEditUser();
    } catch (err: any) {
        alert(`Error saving user:\n${formatError(err)}`);
    } finally { setIsLoading(false); }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
      setNewUserPermissions(prev => 
          checked ? [...prev, permission] : prev.filter(p => p !== permission)
      );
  };

  return (
    <div className="space-y-8 relative">
      
      {isAuthModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Lock size={20} className="text-red-600"/> Security Check
                      </h3>
                      <button onClick={closeAuthModal} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Please enter your <strong>Admin Password</strong> to confirm this action.</p>
                  <form onSubmit={confirmAuthAction}>
                      <input type="password" autoFocus placeholder="Enter Admin Password"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:ring-red-500 focus:border-red-500 outline-none"
                          value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                      {authError && <p className="text-xs text-red-600 font-semibold mb-3">{authError}</p>}
                      <div className="flex gap-2 justify-end mt-4">
                          <button type="button" onClick={closeAuthModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                          <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white font-bold rounded hover:bg-red-700">Confirm</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {activeTab === 'stores' && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><StoreIcon className="mr-2" size={20}/> Manage Stores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex justify-between">Existing Stores <button onClick={loadStores} className="text-blue-500" title="Refresh"><RefreshCw size={14}/></button></h3>
              {isStoreLoading ? <div className="text-center py-4"><Loader2 className="animate-spin inline"/> Loading...</div> : 
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {stores.map(s => <li key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                        <div><div className="font-medium text-gray-900">{s.name}</div><div className="text-xs text-gray-500">{s.location}</div></div>
                        <button onClick={() => initiateDeleteStore(s.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                    </li>)}
                    {stores.length === 0 && <li className="text-sm text-gray-400 p-2">No stores found.</li>}
                </ul>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Add New Store</h3>
              <form onSubmit={handleAddStore} className="space-y-3">
                <input placeholder="Store Name" className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} required />
                <input placeholder="Location" className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900" value={newStoreLoc} onChange={e => setNewStoreLoc(e.target.value)} required />
                <button disabled={isStoreLoading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-medium disabled:opacity-50">{isStoreLoading ? 'Adding...' : 'Add Store'}</button>
              </form>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'users' && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center"><UserIcon className="mr-2" size={20}/> Manage Users</h2>
            <button onClick={fetchSupabaseUsers} className="text-gray-500 hover:text-blue-600 transition-colors" title="Refresh List" disabled={isLoading}><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Team Members (Active)</h3>
              {isLoading && users.length === 0 ? <div className="p-4 text-center text-gray-500 text-sm">Loading users...</div> : 
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map(u => <li key={u.id} className={`flex justify-between items-center p-3 rounded border ${editingUser?.id === u.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div><div className="font-medium text-gray-900">{u.name} <span className="text-xs text-gray-500">({u.username})</span></div><div className="text-xs text-gray-600">{u.role} {u.storeId ? `- ${stores.find(s => s.id === u.storeId)?.name}` : ''}</div></div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => initiateEditUser(u)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Edit User"><Pencil size={16}/></button>
                            {(u.id !== 'u_admin' && u.id !== currentUser?.id) && <button type="button" onClick={() => initiateDeleteUser(u.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Delete User"><Trash2 size={16}/></button>}
                        </div>
                    </li>)}
                    {users.length === 0 && !isLoading && <li className="p-4 text-center text-gray-400 text-sm">No active users found.</li>}
                </ul>}
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{editingUser ? 'Edit User' : 'Add New Employee'}</h3>
                {editingUser && <button type="button" onClick={cancelEditUser} className="text-xs flex items-center text-gray-500 hover:text-gray-700"><X size={14} className="mr-1"/> Cancel</button>}
              </div>
              <form onSubmit={initiateSaveUser} className="space-y-3">
                <input placeholder="Full Name" className="w-full px-3 py-2 border border-gray-300 rounded-md" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
                <div>
                    <input placeholder="Username (for login)" className={`w-full px-3 py-2 border rounded-md ${formError?.field === 'username' ? 'border-red-500' : 'border-gray-300'}`}
                        value={newUserUser} onChange={e => { setNewUserUser(e.target.value); if (formError) setFormError(null); }} required />
                    {formError?.field === 'username' && <p className="text-xs text-red-600 mt-1">{formError.message}</p>}
                </div>
                <input type="password" placeholder="Password" className="w-full px-3 py-2 border border-gray-300 rounded-md" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}>
                  <option value={UserRole.EMPLOYEE}>Employee</option><option value={UserRole.ADMIN}>Admin</option>
                </select>
                {newUserRole === UserRole.EMPLOYEE && <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={newUserStore} onChange={e => setNewUserStore(e.target.value)} required>
                      <option value="">Select Assignment...</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>}
                
                {/* --- TAB ACCESS CHECKLIST --- */}
                <div className="pt-2">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Tab Access</label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {ALL_PERMISSIONS.map(p => (
                            <label key={p} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-100">
                                <input type="checkbox" className="rounded"
                                    checked={newUserPermissions.includes(p)}
                                    onChange={e => handlePermissionChange(p, e.target.checked)}
                                />
                                <span className="capitalize text-gray-800">{p}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button disabled={isLoading} className={`w-full text-white p-2 rounded font-medium transition-colors ${editingUser ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'} ${isLoading ? 'opacity-50' : ''}`}>
                    {isLoading ? 'Saving...' : (editingUser ? 'Update User' : 'Add User')}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};