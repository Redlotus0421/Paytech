import React, { useState, useEffect } from 'react';
import { User, Store, InventoryItem, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Package, Plus, X, Check, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface InventoryProps {
  user: User;
}

export const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for adding/editing item
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('');
  const [newItemStoreId, setNewItemStoreId] = useState('');

  // Filtering
  const [filterStoreId, setFilterStoreId] = useState('');

  useEffect(() => {
    const loadData = async () => {
        const allStores = await storageService.fetchStores();
        setStores(allStores);
        if (user.role === UserRole.EMPLOYEE && user.storeId) {
            setNewItemStoreId(user.storeId);
            setFilterStoreId(user.storeId);
        } else if (allStores.length > 0) {
            setNewItemStoreId(allStores[0].id);
            setFilterStoreId(allStores[0].id);
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
    setIsLoading(true);

    let result;
    if (editingItem) {
        const updatedItem: InventoryItem = {
            ...editingItem,
            storeId: newItemStoreId,
            name: newItemName,
            cost: parseFloat(newItemCost),
            price: parseFloat(newItemPrice),
            stock: parseInt(newItemStock)
        };
        result = await storageService.updateInventoryItem(updatedItem);
    } else {
        const item: InventoryItem = {
            id: uuidv4(),
            storeId: newItemStoreId,
            name: newItemName,
            cost: parseFloat(newItemCost),
            price: parseFloat(newItemPrice),
            stock: parseInt(newItemStock)
        };
        result = await storageService.addInventoryItem(item);
    }

    if (!result.success) {
        const msg = result.error?.message || JSON.stringify(result.error) || "Unknown error";
        alert(`Failed to save item: ${msg}`);
    } else {
        await refreshInventory();
        handleCancelEdit();
    }
    setIsLoading(false);
  };

  const handleEditClick = (item: InventoryItem) => {
      setEditingItem(item);
      setNewItemName(item.name);
      setNewItemCost(item.cost.toString());
      setNewItemPrice(item.price.toString());
      setNewItemStock(item.stock.toString());
      setNewItemStoreId(item.storeId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      setEditingItem(null);
      setNewItemName('');
      setNewItemCost('');
      setNewItemPrice('');
      setNewItemStock('');
      if (user.role === UserRole.ADMIN && stores.length > 0) {
          setNewItemStoreId(stores[0].id);
      }
  };

  const filteredItems = items.filter(i => 
      (!filterStoreId || i.storeId === filterStoreId)
  );

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
            <div className="text-sm text-gray-500 text-right">
                <div className="font-semibold">{new Date().toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</div>
                <div>{stores.length} Active Store(s)</div>
            </div>
        </div>

        {/* Add/Edit Item Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             {/* Filter Bar */}
            {user.role === UserRole.ADMIN && (
                <div className="p-4 border-b border-gray-100 flex items-center gap-4">
                    <span className="text-sm text-gray-500">View Store:</span>
                    <select 
                        value={filterStoreId}
                        onChange={e => setFilterStoreId(e.target.value)}
                        className="p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                    >
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-6 py-4">Item</th>
                            <th className="px-6 py-4">Store</th>
                            <th className="px-6 py-4">Cost</th>
                            <th className="px-6 py-4">Price</th>
                            <th className="px-6 py-4">Margin</th>
                            <th className="px-6 py-4">Stock</th>
                            <th className="px-6 py-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading && filteredItems.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading inventory...</td></tr>
                        ) : (
                            filteredItems.map(item => (
                                <tr key={item.id} className={`hover:bg-gray-50 text-gray-900 ${editingItem?.id === item.id ? 'bg-blue-50' : ''}`}>
                                    <td className="px-6 py-4 font-medium">{item.name}</td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {stores.find(s => s.id === item.storeId)?.name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">₱{item.cost.toFixed(2)}</td>
                                    <td className="px-6 py-4 font-semibold">₱{item.price.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-green-600">₱{(item.price - item.cost).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {item.stock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => handleEditClick(item)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1 hover:bg-blue-100 rounded transition-colors"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!isLoading && filteredItems.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-400">No items found for this store.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};