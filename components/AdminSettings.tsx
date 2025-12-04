import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { Store, User, UserRole } from '../types';
import { Store as StoreIcon, User as UserIcon, Pencil, Trash2, X, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AdminSettingsProps {
  activeTab: 'stores' | 'users';
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ activeTab }) => {
  const [stores, setStores] = useState<Store[]>(storageService.getStores());
  // Start with empty, will fetch from Supabase
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track the actual DB column name for store ID (e.g., 'store_id' vs 'storeId')
  // Defaulting to 'storeId' since 'store_id' was reported as missing previously.
  const [dbStoreColumn, setDbStoreColumn] = useState<string>('storeId');

  useEffect(() => {
    setCurrentUser(storageService.getCurrentUser());
    setStores(storageService.getStores());
    if (activeTab === 'users') {
        fetchSupabaseUsers();
    }
  }, [activeTab]);

  const fetchSupabaseUsers = async () => {
      setIsLoading(true);
      try {
          // Fetch users where status is active
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('status', 'active');
            
          if (error) throw error;

          if (data && data.length > 0) {
            console.log('Fetched users schema sample:', Object.keys(data[0]));
            // Auto-detect the store column name from the first row
            const firstRow = data[0];
            if (Object.prototype.hasOwnProperty.call(firstRow, 'store_id')) {
                setDbStoreColumn('store_id');
                console.log('Detected DB Column: store_id');
            } else if (Object.prototype.hasOwnProperty.call(firstRow, 'storeId')) {
                setDbStoreColumn('storeId');
                console.log('Detected DB Column: storeId');
            } else if (Object.prototype.hasOwnProperty.call(firstRow, 'storeid')) {
                setDbStoreColumn('storeid');
                console.log('Detected DB Column: storeid');
            }
          }

          // Map snake_case from DB to camelCase for app
          const mappedUsers: User[] = (data || []).map((u: any) => ({
              id: u.id,
              username: u.username,
              name: u.name,
              role: u.role,
              // Handle potential different casing from DB
              storeId: u.store_id || u.storeId || u.storeid, 
              status: u.status,
              password: u.password // Map password if present
          }));
          
          setUsers(mappedUsers);
      } catch (err) {
          console.error('Error fetching users:', err);
      } finally {
          setIsLoading(false);
      }
  };

  // Store Form State
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreLoc, setNewStoreLoc] = useState('');
  
  // User Form State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserUser, setNewUserUser] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [newUserStore, setNewUserStore] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // --- Store Handlers ---
  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    const store: Store = { id: `store_${uuidv4().slice(0,8)}`, name: newStoreName, location: newStoreLoc };
    storageService.addStore(store);
    setStores(storageService.getStores());
    setNewStoreName('');
    setNewStoreLoc('');
  };

  // --- User Handlers ---
  const startEditUser = (user: User) => {
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserUser(user.username);
    setNewUserRole(user.role);
    setNewUserStore(user.storeId || '');
    setNewUserPassword(user.password || '');
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setNewUserName('');
    setNewUserUser('');
    setNewUserRole(UserRole.EMPLOYEE);
    setNewUserStore('');
    setNewUserPassword('');
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? (Soft Delete)')) {
        // Optimistic update
        setUsers(prev => prev.filter(u => u.id !== userId));

        try {
            // Soft delete in Supabase
            const { error } = await supabase
                .from('users')
                .update({ status: 'inactive' })
                .eq('id', userId);

            if (error) throw error;
            
            // Re-fetch to ensure consistency
            await fetchSupabaseUsers();

            if (editingUser?.id === userId) {
                cancelEditUser();
            }
        } catch (err: any) {
            console.error('Error deleting user:', err);
            const msg = formatError(err);
            alert(`Failed to delete user: ${msg}`);
            fetchSupabaseUsers(); // Revert on error
        }
    }
  };

  const formatError = (err: any): string => {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err?.message) return err.message;
    if (err?.error_description) return err.error_description;
    return JSON.stringify(err, null, 2);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Prepare data
    // IMPORTANT: Convert empty strings to null for UUID/Int columns to avoid database errors
    const storeIdValue = (newUserRole === UserRole.EMPLOYEE && newUserStore && newUserStore.trim() !== '') 
        ? newUserStore 
        : null;

    // Construct payload dynamically using the detected column name
    const userData: any = {
        username: newUserUser,
        name: newUserName,
        role: newUserRole,
        status: 'active',
        password: newUserPassword // Send password to DB
    };
    
    // Assign store ID to the detected column
    userData[dbStoreColumn] = storeIdValue;
    
    console.log('Saving user with payload:', userData);

    try {
        if (editingUser) {
            // Update Supabase
            const { error } = await supabase
                .from('users')
                .update(userData)
                .eq('id', editingUser.id);
            
            if (error) throw error;
        } else {
            // Create in Supabase
            const { error } = await supabase
                .from('users')
                .insert([{ ...userData, id: uuidv4() }]);

            if (error) throw error;
        }
        
        await fetchSupabaseUsers();
        cancelEditUser();

    } catch (err: any) {
        console.error('Error saving user (Full details):', err);
        const message = formatError(err);
        alert(`Error saving user:\n${message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Stores */}
      {activeTab === 'stores' && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <StoreIcon className="mr-2" size={20}/> Manage Stores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Stores</h3>
              <ul className="space-y-2">
                {stores.map(s => (
                  <li key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                    <div>
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.location}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Add New Store</h3>
              <form onSubmit={handleAddStore} className="space-y-3">
                <input 
                  placeholder="Store Name" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={newStoreName}
                  onChange={e => setNewStoreName(e.target.value)}
                  required
                />
                <input 
                  placeholder="Location" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={newStoreLoc}
                  onChange={e => setNewStoreLoc(e.target.value)}
                  required
                />
                <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-medium">Add Store</button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <UserIcon className="mr-2" size={20}/> Manage Users
            </h2>
            <button 
                onClick={fetchSupabaseUsers} 
                className="text-gray-500 hover:text-blue-600 transition-colors"
                title="Refresh List"
                disabled={isLoading}
            >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Team Members (Active)</h3>
              {isLoading && users.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Loading users...</div>
              ) : (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map(u => (
                    <li key={u.id} className={`flex justify-between items-center p-3 rounded border ${editingUser?.id === u.id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-100'}`}>
                        <div>
                        <div className="font-medium text-gray-900">{u.name} <span className="text-xs text-gray-500">({u.username})</span></div>
                        <div className="text-xs text-gray-600">
                            {u.role} {u.storeId ? `- ${stores.find(s => s.id === u.storeId)?.name}` : ''}
                        </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                type="button"
                                onClick={() => startEditUser(u)} 
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                title="Edit User"
                            >
                                <Pencil size={16}/>
                            </button>
                            {/* Allow delete if NOT the seed admin AND NOT the current user */}
                            {(u.id !== 'u_admin' && u.id !== currentUser?.id) && (
                                <button 
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                    title="Delete User (Soft Delete)"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            )}
                        </div>
                    </li>
                    ))}
                    {users.length === 0 && !isLoading && (
                        <li className="p-4 text-center text-gray-400 text-sm">No active users found.</li>
                    )}
                </ul>
              )}
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                    {editingUser ? 'Edit User' : 'Add New Employee'}
                </h3>
                {editingUser && (
                    <button type="button" onClick={cancelEditUser} className="text-xs flex items-center text-gray-500 hover:text-gray-700">
                        <X size={14} className="mr-1"/> Cancel
                    </button>
                )}
              </div>
              <form onSubmit={handleSaveUser} className="space-y-3">
                <input 
                  placeholder="Full Name" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  required
                />
                <input 
                  placeholder="Username (for login)" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={newUserUser}
                  onChange={e => setNewUserUser(e.target.value)}
                  required
                />
                <input 
                  type="password"
                  placeholder="Password" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                />
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                >
                  <option value={UserRole.EMPLOYEE}>Employee</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
                
                {newUserRole === UserRole.EMPLOYEE && (
                   <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                      value={newUserStore}
                      onChange={e => setNewUserStore(e.target.value)}
                      required
                   >
                      <option value="">Select Assignment...</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                )}
                
                <button 
                    disabled={isLoading}
                    className={`w-full text-white p-2 rounded font-medium transition-colors ${
                        editingUser ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
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