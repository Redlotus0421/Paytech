import React, { useState, useEffect, useMemo } from 'react';
import { User, Store, GeneralExpense, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Plus, Trash2, Search, Filter, DollarSign, Calendar, Building2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ExpensesProps {
  user: User;
}

export const Expenses: React.FC<ExpensesProps> = ({ user }) => {
  const [expenses, setExpenses] = useState<GeneralExpense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  // Filter State
  const [filterStoreId, setFilterStoreId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Auth State
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allStores, allExpenses] = await Promise.all([
        storageService.fetchStores(),
        storageService.fetchGeneralExpenses()
      ]);
      const cats = storageService.getExpenseCategories();
      setCategories(cats);
      setStores(allStores);
      setExpenses(allExpenses);

      // Set default category if not set
      if (!category && cats.length > 0) {
        setCategory(cats[0]);
      }

      // Set default store for form
      if (user.role === UserRole.EMPLOYEE && user.storeId) {
        setSelectedStoreId(user.storeId);
        setFilterStoreId(user.storeId);
      } else if (allStores.length > 0) {
        if (!selectedStoreId) setSelectedStoreId(allStores[0].id);
        setFilterStoreId(''); // Admin sees all by default
      }
    } catch (error) {
      console.error("Error loading expenses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !selectedStoreId) return;

    setIsLoading(true);
    try {
      const newExpense: GeneralExpense = {
        id: uuidv4(),
        storeId: selectedStoreId,
        date,
        category,
        amount: parseFloat(amount),
        description,
        recordedBy: user.id
      };

      await storageService.addGeneralExpense(newExpense);
      await loadData(); // Refresh list
      
      // Reset form
      setAmount('');
      setDescription('');
      // Keep last used category or reset to first? Usually keeping last used is better UX, or reset to first.
      // Code previously reset to first.
      setCategory(categories[0] || '');
    } catch (error) {
      alert("Failed to save expense");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const initiateDeleteCategory = (cat: string) => {
    setCategoryToDelete(cat);
    setAdminPassword('');
    setShowAdminAuth(true);
  };

  const confirmDeleteCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToDelete) return;

    try {
        const auth = await storageService.login('admin', adminPassword);
        if (auth && auth.role === UserRole.ADMIN) {
            const updatedCats = storageService.removeExpenseCategory(categoryToDelete);
            setCategories(updatedCats);
            setCategory(updatedCats[0] || '');
            setShowAdminAuth(false);
            setCategoryToDelete(null);
        } else {
            alert("Invalid admin password");
        }
    } catch (error) {
        console.error(error);
        alert("Authentication failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await storageService.deleteGeneralExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      alert("Failed to delete expense");
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesStore = !filterStoreId || e.storeId === filterStoreId;
      const matchesCategory = !filterCategory || e.category === filterCategory;
      const matchesSearch = !searchQuery || 
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.amount.toString().includes(searchQuery);
      return matchesStore && matchesCategory && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filterStoreId, filterCategory, searchQuery]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
            <h2 className="text-xl font-bold text-gray-900">General Expenses</h2>
            <p className="text-sm text-gray-500">Manage payroll, rent, and other operational costs</p>
        </div>
        <div className="text-right">
            <div className="text-sm text-gray-500">Total Selected Expenses</div>
            <div className="text-2xl font-bold text-red-600">₱{totalExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Expense Form */}
        <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-blue-600"/>
                    Record New Expense
                </h3>
                <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Store</label>
                        <select
                            value={selectedStoreId}
                            onChange={e => setSelectedStoreId(e.target.value)}
                            disabled={user.role === UserRole.EMPLOYEE}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        >
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        <div className="flex gap-2">
                            <select
                                value={category}
                                onChange={e => {
                                    if (e.target.value === 'NEW_CATEGORY') {
                                        const newCat = prompt("Enter new expense category:");
                                        if (newCat) {
                                            const updatedCats = storageService.addExpenseCategory(newCat);
                                            setCategories(updatedCats);
                                            setCategory(newCat);
                                        }
                                    } else {
                                        setCategory(e.target.value);
                                    }
                                }}
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="NEW_CATEGORY" className="font-bold text-blue-600">+ Add New Category</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!category || category === 'NEW_CATEGORY') return;
                                    initiateDeleteCategory(category);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded border border-gray-200"
                                title="Remove selected category"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full pl-8 p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                            rows={3}
                            placeholder="Details about the expense..."
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Saving...' : 'Record Expense'}
                    </button>
                </form>
            </div>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                    />
                </div>
                
                <select
                    value={filterStoreId}
                    onChange={e => setFilterStoreId(e.target.value)}
                    className="p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                >
                    <option value="">All Stores</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                >
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Store</th>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                                <th className="px-6 py-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No expenses found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map(expense => {
                                    const storeName = stores.find(s => s.id === expense.storeId)?.name || 'Unknown Store';
                                    return (
                                        <tr key={expense.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                {new Date(expense.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                {storeName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                    ${expense.category === 'Payroll' ? 'bg-purple-100 text-purple-800' :
                                                      expense.category === 'Rent' ? 'bg-orange-100 text-orange-800' :
                                                      expense.category === 'Utilities' ? 'bg-yellow-100 text-yellow-800' :
                                                      'bg-gray-100 text-gray-800'}`}>
                                                    {expense.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                                                {expense.description}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-600">
                                                ₱{expense.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                    title="Delete Expense"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* Admin Auth Modal */}
      {showAdminAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Admin Authentication</h3>
            <p className="text-sm text-gray-600 mb-4">Please enter admin password to delete category "{categoryToDelete}".</p>
            <form onSubmit={confirmDeleteCategory}>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded mb-4"
                placeholder="Admin Password"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminAuth(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
