import React, { useState, useEffect, useMemo } from 'react';
import { User, Store, InventoryItem, UserRole, ReportData } from '../types';
import { storageService } from '../services/storageService';
import { Package, Plus, X, Check, Loader2, Search, TrendingUp, DollarSign, ShoppingCart, BarChart3, Trash2, Lock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface InventoryProps {
  user: User;
}

export const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // State for adding/editing item
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('');
  const [newItemStoreId, setNewItemStoreId] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('');

  // Filtering
  const [filterStoreId, setFilterStoreId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [authError, setAuthError] = useState('');
  const [authTitle, setAuthTitle] = useState('');

  useEffect(() => {
    const loadData = async () => {
        const [allStores, allReports] = await Promise.all([
            storageService.fetchStores(),
            storageService.fetchReports()
        ]);
        setStores(allStores);
        setReports(allReports);
        setCurrentUser(storageService.getCurrentUser());

        if (user.role === UserRole.EMPLOYEE && user.storeId) {
            setNewItemStoreId(user.storeId);
            setFilterStoreId(user.storeId);
        } else if (allStores.length > 0) {
            setNewItemStoreId(allStores[0].id);
            setFilterStoreId(''); // Default to All Stores for Admin
        }
        refreshInventory();
    };
    loadData();
  }, [user]);

  const refreshInventory = async () => {
      setIsLoading(true);
      const data = await storageService.getInventory();
      setItems(data);
      setIsLoading(false);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemStoreId) return alert("Select a store");
    if (!newItemName.trim()) return alert("Enter item name");
    if (!newItemCategory.trim()) return alert("Enter category");
    if (!newItemCost || parseFloat(newItemCost) < 0) return alert("Enter valid cost");
    if (!newItemPrice || parseFloat(newItemPrice) < 0) return alert("Enter valid price");
    if (!newItemStock || parseInt(newItemStock) < 0) return alert("Enter valid stock");
    
    setIsLoading(true);

    let result;
    if (editingItem) {
        const updatedItem: InventoryItem = {
            ...editingItem,
            storeId: newItemStoreId,
            name: newItemName,
            cost: parseFloat(newItemCost),
            price: parseFloat(newItemPrice),
            stock: parseInt(newItemStock),
            category: newItemCategory
        };
        result = await storageService.updateInventoryItem(updatedItem);
        await storageService.logActivity('Update Inventory', `Updated item: ${updatedItem.name} (Stock: ${updatedItem.stock}, Price: ${updatedItem.price})`, user.id, user.name);
    } else {
        const item: InventoryItem = {
            id: uuidv4(),
            storeId: newItemStoreId,
            name: newItemName,
            cost: parseFloat(newItemCost),
            price: parseFloat(newItemPrice),
            stock: parseInt(newItemStock),
            category: newItemCategory
        };
        result = await storageService.addInventoryItem(item);
        await storageService.logActivity('Add Inventory', `Added new item: ${item.name} to ${stores.find(s => s.id === newItemStoreId)?.name}`, user.id, user.name);
    }

    if (!result.success) {
        const errorMsg = result.error?.message || result.error?.details || JSON.stringify(result.error) || "Unknown error";
        console.error('❌ Save failed:', result.error);
        alert(`Failed to save item:\n${errorMsg}`);
    } else {
        // Set filter to show the store we just added/edited the item for
        setFilterStoreId(newItemStoreId);
        await refreshInventory();
        handleCancelEdit();
    }
    setIsLoading(false);
  };

  const handleEditClick = (item: InventoryItem) => {
      setAuthTitle('Admin Authentication Required to Edit');
      setPendingAction(() => () => {
          setEditingItem(item);
          setNewItemName(item.name);
          setNewItemCost(item.cost.toString());
          setNewItemPrice(item.price.toString());
          setNewItemStock(item.stock.toString());
          setNewItemStoreId(item.storeId);
          setNewItemCategory(item.category || '');
          window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      setIsAuthModalOpen(true);
  };

  const handleDeleteClick = (item: InventoryItem) => {
      setAuthTitle('Admin Authentication Required to Delete');
      setPendingAction(() => async () => {
          if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
              setIsLoading(true);
              try {
                  await storageService.deleteInventoryItem(item.id);
                  await storageService.logActivity('Delete Inventory', `Deleted item: ${item.name}`, user.id, user.name);
                  await refreshInventory();
              } catch (e) {
                  console.error(e);
                  alert('Failed to delete item');
              } finally {
                  setIsLoading(false);
              }
          }
      });
      setIsAuthModalOpen(true);
  };

  const confirmAuthAction = (e: React.FormEvent) => {
      e.preventDefault();
      // Verify password against current logged in admin (or any admin logic)
      // Assuming currentUser has the correct password if they are logged in, 
      // but here we are re-verifying.
      // If the user is an employee, they shouldn't know the admin password.
      // We need to check against the admin user's password.
      // Since we don't have a list of all users here easily accessible with passwords (security risk usually),
      // we will check if the entered password matches the CURRENT user's password IF they are admin.
      // OR, we can fetch the admin user specifically.
      
      // For this app's context (local storage/simple auth):
      // We will check if the entered password matches the 'admin' user password.
      // We need to fetch users to find the admin.
      
      verifyAdminPassword();
  };

  const verifyAdminPassword = async () => {
      const users = await storageService.fetchUsers();
      const admin = users.find(u => u.role === UserRole.ADMIN);
      
      if (admin && authPassword === admin.password) {
          setAuthError('');
          setIsAuthModalOpen(false);
          setAuthPassword('');
          if (pendingAction) {
              pendingAction();
              setPendingAction(null);
          }
      } else {
          setAuthError('Incorrect Admin Password');
      }
  };

  const closeAuthModal = () => {
      setIsAuthModalOpen(false);
      setAuthPassword('');
      setAuthError('');
      setPendingAction(null);
  };

  const handleCancelEdit = () => {
      setEditingItem(null);
      setNewItemName('');
      setNewItemCost('');
      setNewItemPrice('');
      setNewItemStock('');
      setNewItemCategory('');
      if (user.role === UserRole.ADMIN && stores.length > 0) {
          setNewItemStoreId(stores[0].id);
      }
  };

  const filteredItems = useMemo(() => items.filter(i => 
      (!filterStoreId || i.storeId === filterStoreId) &&
      (!filterCategory || i.category === filterCategory) &&
      (!searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.category && i.category.toLowerCase().includes(searchQuery.toLowerCase())))
  ), [items, filterStoreId, filterCategory, searchQuery]);

  const uniqueCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean))) as string[];

  // Metrics Calculations
  const metrics = useMemo(() => {
      const totalCost = filteredItems.reduce((acc, item) => acc + (item.cost * item.stock), 0);
      const totalValue = filteredItems.reduce((acc, item) => acc + (item.price * item.stock), 0);
      const potentialProfit = totalValue - totalCost;

      const totalSold = reports
        .filter(r => !filterStoreId || r.storeId === filterStoreId)
        .reduce((acc, report) => {
            const reportSold = (report.posSalesDetails || []).reduce((rAcc, item) => {
                if (filterCategory && item.category !== filterCategory) return rAcc;
                if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return rAcc;
                return rAcc + item.quantity;
            }, 0);
            return acc + reportSold;
        }, 0);

      return { totalCost, totalValue, potentialProfit, totalSold };
  }, [filteredItems, reports, filterStoreId, filterCategory, searchQuery]);

    return (
        <div className="flex flex-col gap-6 w-full">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
            <div className="text-sm text-gray-500 text-right">
                <div className="font-semibold">{new Date().toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</div>
                <div>{stores.length} Active Store(s)</div>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-full text-blue-600"><DollarSign size={24}/></div>
                <div>
                    <div className="text-xs text-gray-500 font-bold uppercase">Total Inventory Cost</div>
                    <div className="text-xl font-bold text-gray-900">₱{metrics.totalCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-full text-green-600"><TrendingUp size={24}/></div>
                <div>
                    <div className="text-xs text-gray-500 font-bold uppercase">Total Selling Value</div>
                    <div className="text-xl font-bold text-gray-900">₱{metrics.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-purple-50 rounded-full text-purple-600"><BarChart3 size={24}/></div>
                <div>
                    <div className="text-xs text-gray-500 font-bold uppercase">Potential Profit</div>
                    <div className="text-xl font-bold text-gray-900">₱{metrics.potentialProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-orange-50 rounded-full text-orange-600"><ShoppingCart size={24}/></div>
                <div>
                    <div className="text-xs text-gray-500 font-bold uppercase">Total Items Sold</div>
                    <div className="text-xl font-bold text-gray-900">{metrics.totalSold.toLocaleString()}</div>
                </div>
            </div>
        </div>

        {/* Add/Edit Item Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 w-full min-w-0">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-700 font-semibold">
                    <Package size={20}/>
                    <h3>{editingItem ? 'Edit Item' : 'Inventory Management'}</h3>
                </div>
                {editingItem && (
                    <button onClick={handleCancelEdit} className="text-sm text-gray-500 hover:text-gray-700 flex items-center">
                        <X size={16} className="mr-1"/> Cancel Edit
                    </button>
                )}
            </div>
            
            <form onSubmit={handleSaveItem} className={`p-4 rounded border ${editingItem ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                <h4 className="text-sm font-medium text-gray-700 mb-3">{editingItem ? 'Update Item Details' : 'Add New Item'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 block mb-1">Item Name</label>
                        <input 
                            required
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            placeholder="Robot Toy"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-xs text-gray-500 block mb-1">Store</label>
                        <select 
                            value={newItemStoreId}
                            onChange={e => setNewItemStoreId(e.target.value)}
                            disabled={user.role === UserRole.EMPLOYEE}
                            className={`w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900 ${user.role === UserRole.EMPLOYEE ? 'bg-gray-100' : ''}`}
                        >
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-xs text-gray-500 block mb-1">Category</label>
                        <input
                            required
                            value={newItemCategory}
                            onChange={e => setNewItemCategory(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            placeholder="Category"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Cost</label>
                        <input 
                            required type="number" step="0.01"
                            value={newItemCost}
                            onChange={e => setNewItemCost(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Price</label>
                        <input 
                            required type="number" step="0.01"
                            value={newItemPrice}
                            onChange={e => setNewItemPrice(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            placeholder="0.00"
                        />
                    </div>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">Qty</label>
                            <input 
                                required type="number"
                                value={newItemStock}
                                onChange={e => setNewItemStock(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                                placeholder="0"
                            />
                        </div>
                        <button 
                            disabled={isLoading}
                            className={`text-white p-2 rounded h-[38px] w-[38px] flex items-center justify-center ${editingItem ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : (editingItem ? <Check size={20}/> : <Plus size={20}/>)}
                        </button>
                    </div>
                </div>
            </form>
        </div>

        {/* Inventory List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full min-w-0">
             {/* Filter Bar */}
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 whitespace-nowrap">Store:</span>
                        <select 
                            value={filterStoreId}
                            onChange={e => setFilterStoreId(e.target.value)}
                            className="p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        >
                            <option value="">All Stores</option>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 whitespace-nowrap">Category:</span>
                        <select 
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        >
                            <option value="">All Categories</option>
                            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-6 py-4">Item</th>
                            <th className="px-6 py-4">Store</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Cost</th>
                            <th className="px-6 py-4">Price</th>
                            <th className="px-6 py-4">Margin</th>
                            <th className="px-6 py-4">Stock</th>
                            <th className="px-6 py-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading && filteredItems.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading inventory...</td></tr>
                        ) : (
                            filteredItems.map(item => (
                                <tr key={item.id} className={`hover:bg-gray-50 text-gray-900 ${editingItem?.id === item.id ? 'bg-blue-50' : ''}`}>
                                    <td className="px-6 py-4 font-medium">{item.name}</td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {stores.find(s => s.id === item.storeId)?.name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{item.category || '-'}</td>
                                    <td className="px-6 py-4 text-gray-500">₱{item.cost.toFixed(2)}</td>
                                    <td className="px-6 py-4 font-semibold">₱{item.price.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-green-600">₱{(item.price - item.cost).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {item.stock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => handleEditClick(item)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1 hover:bg-blue-100 rounded transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteClick(item)}
                                            className="text-red-600 hover:text-red-800 text-xs font-medium px-3 py-1 hover:bg-red-100 rounded transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!isLoading && filteredItems.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-gray-400">No items found for this store.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Auth Modal */}
        {isAuthModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center gap-3 mb-4 text-red-600">
                        <div className="p-2 bg-red-100 rounded-full">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">{authTitle}</h3>
                    </div>
                    
                    <p className="text-gray-600 mb-6">
                        Please enter the Admin password to proceed with this action.
                    </p>

                    <form onSubmit={confirmAuthAction}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                            <input 
                                type="password" 
                                autoFocus
                                value={authPassword}
                                onChange={e => setAuthPassword(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="Enter password"
                            />
                            {authError && <p className="text-red-600 text-sm mt-1">{authError}</p>}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                type="button"
                                onClick={closeAuthModal}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                            >
                                Confirm
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};