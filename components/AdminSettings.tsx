import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { Store, User, UserRole, InventoryItem, ReportData } from '../types';
import { Store as StoreIcon, User as UserIcon, Pencil, Trash2, X, RefreshCw, Loader2, Lock, Ban } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface AdminSettingsProps {
  activeTab: 'stores' | 'users';
}

// FIX: Added 'transactions' and 'expenses' to the list of available permissions
const ALL_PERMISSIONS = ['dashboard', 'analytics', 'transactions', 'expenses', 'reports', 'entry', 'pos', 'inventory', 'daily-time-record', 'activity-logs'];

export const AdminSettings: React.FC<AdminSettingsProps> = ({ activeTab }) => {
  const [stores, setStores] = useState<Store[]>([]);
  // Start with empty, will fetch from Supabase
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  
  const [dbStoreColumn, setDbStoreColumn] = useState<string>('store_id');

  // --- Security / Auth Modal State ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [authError, setAuthError] = useState('');

  // --- Form Validation State ---
  const [formError, setFormError] = useState<{ field: string; message: string } | null>(null);

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
    } catch (e) {
      console.error("Failed to load stores", e);
    } finally {
      setIsStoreLoading(false);
    }
  };

  const fetchSupabaseUsers = async () => {
      setIsLoading(true);
      try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('status', 'active');
            
          if (error) throw error;

          if (data && data.length > 0) {
            const firstRow = data[0];
            if (Object.prototype.hasOwnProperty.call(firstRow, 'store_id')) {
                setDbStoreColumn('store_id');
            } else if (Object.prototype.hasOwnProperty.call(firstRow, 'storeId')) {
                setDbStoreColumn('storeId');
            } else if (Object.prototype.hasOwnProperty.call(firstRow, 'storeid')) {
                setDbStoreColumn('storeid');
            }
          }

          const mappedUsers: User[] = (data || []).map((u: any) => ({
              id: u.id,
              username: u.username,
              name: u.name,
              role: u.role,
              storeId: u.store_id || u.storeId || u.storeid, 
              status: u.status,
              password: u.password,
              permissions: u.permissions || [] // Load permissions
          }));

          // Fetch local admin from localStorage
          const localUsersStr = localStorage.getItem('cfs_users');
          if (localUsersStr) {
              const localUsers = JSON.parse(localUsersStr);
              const localAdmin = localUsers.find((u: any) => u.id === 'u_admin' || u.username === 'admin');
              
              // Only add if not already in DB list (to avoid duplicates if migrated)
              if (localAdmin && !mappedUsers.some(u => u.id === localAdmin.id || u.username === localAdmin.username)) {
                  mappedUsers.unshift(localAdmin);
              }
          }
          
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
  
  // Salary/Hourly Rate State
  const [newUserSalary, setNewUserSalary] = useState<string>('');
  const [newUserHourlyRate, setNewUserHourlyRate] = useState<string>('');
  const [autoCalculateRate, setAutoCalculateRate] = useState<boolean>(true);
  
  // Permission State
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>(ALL_PERMISSIONS);

  // --- Store Handlers ---
  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName) return;
    setIsStoreLoading(true);
    try {
        const store: Store = { id: uuidv4(), name: newStoreName, location: newStoreLoc };
        await storageService.addStore(store);
        await storageService.logActivity('Add Store', `Added new store: ${store.name}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
        await loadStores(); // Refresh list
        setNewStoreName('');
        setNewStoreLoc('');
    } catch (e) {
        alert("Error saving store");
        console.error(e);
    } finally {
        setIsStoreLoading(false);
    }
  };

  // Security Wrapper for Store Deletion
  const initiateDeleteStore = (storeId: string) => {
      console.log('Initiating delete for store:', storeId);
      setPendingAction(() => async () => executeDeleteStore(storeId));
      setIsAuthModalOpen(true);
  };

  const executeDeleteStore = async (storeId: string) => {
    if (!confirm("WARNING: This will permanently delete the store and ALL associated data (users, inventory, reports, transactions). This action cannot be undone.\n\nAre you sure you want to proceed?")) {
        return;
    }

    setIsStoreLoading(true);
    try {
        await storageService.deleteStoreAndData(storeId);
        await storageService.logActivity('Delete Store', `Deleted store: ${stores.find(s => s.id === storeId)?.name}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
        await loadStores();
        alert("Store and all associated data deleted successfully.");
    } catch (e: any) {
        console.error(e);
        alert("Error deleting store: " + (e.message || "Unknown error"));
    } finally {
        setIsStoreLoading(false);
    }
  };

  // --- Security Logic ---
  const confirmAuthAction = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Verify password against current logged in admin
      if (authPassword !== currentUser?.password) {
          setAuthError('Incorrect Admin Password');
          return;
      }

      setAuthError('');
      setIsAuthModalOpen(false);
      setAuthPassword('');
      
      if (pendingAction) {
          console.log('Executing pending action...');
          await pendingAction();
          setPendingAction(null);
      }
  };

  const closeAuthModal = () => {
      setIsAuthModalOpen(false);
      setAuthPassword('');
      setAuthError('');
      setPendingAction(null);
  }

  // --- User Handlers ---
  
  // EDIT: Require password to start editing
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
    // Load existing permissions or default to all if undefined
    setNewUserPermissions(user.permissions || ALL_PERMISSIONS);
    
    // Load salary data from employee_details table
    try {
      const { data } = await supabase
        .from('employee_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setNewUserSalary(data.monthly_salary?.toString() || '');
        setNewUserHourlyRate(data.hourly_rate?.toString() || '');
        setAutoCalculateRate(data.auto_calculate_rate !== false);
      } else {
        setNewUserSalary('');
        setNewUserHourlyRate('');
        setAutoCalculateRate(true);
      }
    } catch (err) {
      console.error('Error loading employee details:', err);
      setNewUserSalary('');
      setNewUserHourlyRate('');
      setAutoCalculateRate(true);
    }
  };

  const cancelEditUser = () => {
    setFormError(null);
    setEditingUser(null);
    setNewUserName('');
    setNewUserUser('');
    setNewUserRole(UserRole.EMPLOYEE);
    setNewUserStore('');
    setNewUserPassword('');
    setNewUserPermissions(ALL_PERMISSIONS);
    setNewUserSalary('');
    setNewUserHourlyRate('');
    setAutoCalculateRate(true);
  };

  // DEACTIVATE: Require password to deactivate
  const initiateDeactivateUser = (userId: string) => {
      console.log('Initiating deactivate for user:', userId);
      setPendingAction(() => async () => executeDeactivateUser(userId));
      setIsAuthModalOpen(true);
  };

  const executeDeactivateUser = async (userId: string) => {
    console.log('Executing deactivate for user:', userId);
    // Optimistic update
    setUsers(prev => prev.filter(u => u.id !== userId));

    try {
        const { error } = await supabase
            .from('users')
            .update({ status: 'inactive' })
            .eq('id', userId);

        if (error) throw error;
        await storageService.logActivity('Deactivate User', `Deactivated user: ${users.find(u => u.id === userId)?.username}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
        await fetchSupabaseUsers();

        if (editingUser?.id === userId) {
            cancelEditUser();
        }
    } catch (err: any) {
        console.error('Error deactivating user:', err);
        const msg = formatError(err);
        alert(`Failed to deactivate user: ${msg}`);
        fetchSupabaseUsers();
    }
  };

  // DELETE: Require password to delete (Hard Delete)
  const initiateDeleteUser = (userId: string) => {
      console.log('Initiating delete for user:', userId);
      setPendingAction(() => async () => executeDeleteUser(userId));
      setIsAuthModalOpen(true);
  };

  const executeDeleteUser = async (userId: string) => {
    console.log('Executing hard delete for user:', userId);
    if (!confirm("WARNING: This will PERMANENTLY delete the user. This action cannot be undone.\n\nAre you sure you want to proceed?")) {
        return;
    }
    
    // Optimistic update
    setUsers(prev => prev.filter(u => u.id !== userId));

    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;
        await storageService.logActivity('Delete User', `Permanently deleted user: ${users.find(u => u.id === userId)?.username}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
        await fetchSupabaseUsers();

        if (editingUser?.id === userId) {
            cancelEditUser();
        }
    } catch (err: any) {
        console.error('Error deleting user:', err);
        const msg = formatError(err);
        alert(`Failed to delete user: ${msg}`);
        fetchSupabaseUsers();
    }
  };

  const formatError = (err: any): string => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err.message) return err.message;
    if (err.error_description) return err.error_description;
    if (err.details) return err.details;
    if (err.hint) return `${err.message || 'Error'} (${err.hint})`;
    try {
        const json = JSON.stringify(err, null, 2);
        if (json === '{}') return String(err);
        return json;
    } catch (e) {
        return String(err);
    }
  };

  // SAVE: Require password to save (Add or Update)
  const initiateSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null); // Clear previous errors
      if(!newUserName || !newUserUser) return;
      
      setIsLoading(true);
      // --- VALIDATION CHECK FOR DUPLICATE USERNAME ---
      try {
        let userCheckQuery = supabase.from('users').select('id').eq('username', newUserUser);

        // If editing, exclude the current user from the check
        if (editingUser) {
            userCheckQuery = userCheckQuery.not('id', 'eq', editingUser.id);
        }

        const { data: existingUser, error } = await userCheckQuery.maybeSingle();

        if (error) {
            throw new Error('Error checking username: ' + error.message);
        }

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
      // --- END VALIDATION ---
      
      setIsLoading(false);
      setPendingAction(() => async () => handleSaveUser());
      setIsAuthModalOpen(true);
  }

  const handleSaveUser = async () => {
    setIsLoading(true);

    const storeIdValue = (newUserRole === UserRole.EMPLOYEE && newUserStore && newUserStore.trim() !== '') 
        ? newUserStore 
        : null;

    const userData: any = {
        username: newUserUser,
        name: newUserName,
        role: newUserRole,
        status: 'active',
        password: newUserPassword,
        permissions: newUserPermissions // Save permissions to DB
    };
    
    userData[dbStoreColumn] = storeIdValue;
    
    try {
        // Special handling for local admin user
        if (editingUser && (editingUser.id === 'u_admin' || editingUser.username === 'admin')) {
             const localUsersStr = localStorage.getItem('cfs_users');
             const localUsers: User[] = localUsersStr ? JSON.parse(localUsersStr) : [];
             const updatedUsers = localUsers.map(u => {
                 if (u.id === 'u_admin' || u.username === 'admin') {
                     // Update everything except ID
                     return { ...u, ...userData, id: u.id }; 
                 }
                 return u;
             });
             localStorage.setItem('cfs_users', JSON.stringify(updatedUsers));
             
             await storageService.logActivity('Update User', `Updated local admin: ${userData.username}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
             
             // Refresh list and close form
             await fetchSupabaseUsers();
             cancelEditUser();
             setIsLoading(false);
             return; 
        }

        if (editingUser) {
            const { error } = await supabase
                .from('users')
                .update(userData)
                .eq('id', editingUser.id);
            if (error) throw error;
            await storageService.logActivity('Update User', `Updated user: ${userData.username}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
            
            // Save employee details (salary/hourly rate) for updates
            if (newUserRole === UserRole.EMPLOYEE) {
              await saveEmployeeDetails(editingUser.id);
            }
        } else {
            const newUserId = uuidv4();
            const { error } = await supabase
                .from('users')
                .insert([{ ...userData, id: newUserId }]);
            if (error) throw error;
            await storageService.logActivity('Add User', `Added new user: ${userData.username}`, currentUser?.id || 'admin', currentUser?.name || 'Admin');
            
            // Save employee details (salary/hourly rate) for new employee
            if (newUserRole === UserRole.EMPLOYEE) {
              await saveEmployeeDetails(newUserId);
            }
        }
        await fetchSupabaseUsers();
        cancelEditUser();

    } catch (err: any) {
        console.error('Error saving user (Full details):', JSON.stringify(err, null, 2));
        const message = formatError(err);
        alert(`Error saving user:\n${message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
      setNewUserPermissions(prev => 
          checked ? [...prev, permission] : prev.filter(p => p !== permission)
      );
  };

  // Calculate hourly rate from monthly salary (assuming 22 working days * 8 hours = 176 hours/month)
  const calculateHourlyRate = (monthlySalary: number): number => {
    if (monthlySalary <= 0) return 0;
    return Math.round((monthlySalary / 176) * 100) / 100;
  };

  // Handle salary change and auto-calculate hourly rate
  const handleSalaryChange = (value: string) => {
    setNewUserSalary(value);
    if (autoCalculateRate && value) {
      const salary = parseFloat(value);
      if (!isNaN(salary)) {
        setNewUserHourlyRate(calculateHourlyRate(salary).toString());
      }
    }
  };

  // Save employee salary/hourly rate details
  const saveEmployeeDetails = async (userId: string) => {
    const salary = parseFloat(newUserSalary) || 0;
    const hourlyRate = autoCalculateRate 
      ? calculateHourlyRate(salary) 
      : (parseFloat(newUserHourlyRate) || 0);

    if (salary > 0 || hourlyRate > 0) {
      try {
        // First try to update, if not exists then insert
        const { data: existing } = await supabase
          .from('employee_details')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('employee_details')
            .update({
              monthly_salary: salary,
              hourly_rate: hourlyRate,
              auto_calculate_rate: autoCalculateRate,
              updated_at: Date.now()
            })
            .eq('user_id', userId);
        } else {
          await supabase
            .from('employee_details')
            .insert([{
              id: uuidv4(),
              user_id: userId,
              monthly_salary: salary,
              hourly_rate: hourlyRate,
              auto_calculate_rate: autoCalculateRate,
              created_at: Date.now(),
              updated_at: Date.now()
            }]);
        }
      } catch (err) {
        console.error('Error saving employee details:', err);
      }
    }
  };

  return (
    <div className="space-y-8 relative">
      
      {/* Password Confirmation Modal */}
      {isAuthModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Lock size={20} className="text-red-600"/> Security Check
                      </h3>
                      <button onClick={closeAuthModal} className="text-gray-400 hover:text-gray-600">
                          <X size={20}/>
                      </button>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">
                      Please enter your <strong>Admin Password</strong> to confirm this action.
                  </p>

                  <form onSubmit={confirmAuthAction}>
                      <input 
                          type="password"
                          autoFocus
                          placeholder="Enter Admin Password"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:ring-red-500 focus:border-red-500 outline-none"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                      />
                      {authError && <p className="text-xs text-red-600 font-semibold mb-3">{authError}</p>}
                      
                      <div className="flex gap-2 justify-end mt-4">
                          <button 
                              type="button" 
                              onClick={closeAuthModal}
                              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                          >
                              Cancel
                          </button>
                          <button 
                              type="submit"
                              className="px-4 py-2 text-sm bg-red-600 text-white font-bold rounded hover:bg-red-700"
                          >
                              Confirm
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Stores */}
      {activeTab === 'stores' && (
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <StoreIcon className="mr-2" size={20}/> Manage Stores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex justify-between">
                  Existing Stores
                  <button onClick={loadStores} className="text-blue-500" title="Refresh"><RefreshCw size={14}/></button>
              </h3>
              {isStoreLoading ? (
                  <div className="text-center py-4"><Loader2 className="animate-spin inline"/> Loading...</div>
              ) : (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {stores.map(s => (
                    <li key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                        <div>
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.location}</div>
                        </div>
                        <button onClick={() => initiateDeleteStore(s.id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={16} />
                        </button>
                    </li>
                    ))}
                    {stores.length === 0 && <li className="text-sm text-gray-400 p-2">No stores found.</li>}
                </ul>
              )}
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
                <button disabled={isStoreLoading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-medium disabled:opacity-50">
                    {isStoreLoading ? 'Adding...' : 'Add Store'}
                </button>
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
                                onClick={() => initiateEditUser(u)} 
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                title="Edit User"
                            >
                                <Pencil size={16}/>
                            </button>
                            {/* Allow actions if NOT the seed admin AND NOT the current user */}
                            {(u.id !== 'u_admin' && u.id !== currentUser?.id) && (
                                <>
                                    <button 
                                        type="button"
                                        onClick={() => initiateDeactivateUser(u.id)}
                                        className="p-1.5 text-orange-600 hover:bg-orange-100 rounded transition-colors"
                                        title="Deactivate User"
                                    >
                                        <Ban size={16}/>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => initiateDeleteUser(u.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                        title="Delete User (Permanent)"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </>
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
              <form onSubmit={initiateSaveUser} className="space-y-3">
                <input 
                  placeholder="Full Name" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  required
                />
                <div>
                    <input 
                        placeholder="Username (for login)" 
                        className={`w-full px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500 ${
                            formError && formError.field === 'username' ? 'border-red-500' : 'border-gray-300'
                        }`}
                        value={newUserUser}
                        onChange={e => {
                            setNewUserUser(e.target.value);
                            if (formError && formError.field === 'username') setFormError(null);
                        }}
                        required
                    />
                    {formError && formError.field === 'username' && (
                        <p className="text-xs text-red-600 mt-1">{formError.message}</p>
                    )}
                </div>
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
                
                {/* --- SALARY & HOURLY RATE --- */}
                {newUserRole === UserRole.EMPLOYEE && (
                  <div className="pt-2 space-y-3 border-t border-gray-200">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Salary Information</label>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Monthly Salary (₱)</label>
                      <input 
                        type="number"
                        placeholder="e.g., 15000" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                        value={newUserSalary}
                        onChange={e => handleSalaryChange(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        id="autoCalculate"
                        checked={autoCalculateRate}
                        onChange={e => setAutoCalculateRate(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="autoCalculate" className="text-xs text-gray-600">Auto-calculate hourly rate from salary</label>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Hourly Rate (₱)</label>
                      <input 
                        type="number"
                        placeholder={autoCalculateRate ? "Auto-calculated" : "e.g., 85.23"} 
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500 ${autoCalculateRate ? 'bg-gray-100' : 'bg-white'}`}
                        value={newUserHourlyRate}
                        onChange={e => setNewUserHourlyRate(e.target.value)}
                        disabled={autoCalculateRate}
                        min="0"
                        step="0.01"
                      />
                      {autoCalculateRate && newUserSalary && (
                        <p className="text-xs text-gray-400 mt-1">Based on 176 hours/month (22 days × 8 hrs)</p>
                      )}
                    </div>
                  </div>
                )}
                
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