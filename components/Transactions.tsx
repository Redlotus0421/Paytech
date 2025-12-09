// HELLO TEST
import React, { useState, useEffect } from 'react';
import { User, Store, PosTransaction, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Receipt, Search, Trash2, AlertTriangle, CheckCircle, X, Loader2, Database } from 'lucide-react';

interface TransactionsProps {
  user: User;
}

export const Transactions: React.FC<TransactionsProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<any[]>([]); // Using any for status ext
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [filterStoreId, setFilterStoreId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Voiding State
  const [voidingId, setVoidingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const [allStores, allTxs] = await Promise.all([
            storageService.fetchStores(),
            storageService.fetchTransactions()
        ]);
        setStores(allStores);
        
        // Initial filter setup: Only set default filter if user is an employee
        if (user.role === UserRole.EMPLOYEE && user.storeId) {
            setFilterStoreId(user.storeId);
        }
        // Admins start with NO filter (filterStoreId = '') so they see everything

        // Sort by timestamp desc
        console.log("Fetched transactions:", allTxs);
        setTransactions(allTxs.sort((a: any, b: any) => b.timestamp - a.timestamp));

    } catch (e: any) {
        console.error("Failed to load transactions", e);
        // Alert the user if the fetch fails (likely RLS or network issue)
        alert(`Failed to load transactions: ${e.message || "Unknown error"}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleVoid = async (tx: any) => {
      if (!window.confirm("Are you sure you want to VOID this transaction? This will return items to inventory.")) return;
      
      setVoidingId(tx.id);
      try {
          await storageService.voidTransaction(tx.id);
          alert("Transaction voided successfully. Stock has been returned.");
          await loadData(); // Refresh list
      } catch (e: any) {
          console.error(e);
          alert("Failed to void transaction: " + e.message);
      } finally {
          setVoidingId(null);
      }
  };

  const handleCreateTestTransaction = async () => {
      if (stores.length === 0) {
          alert("No stores available. Please add a store first.");
          return;
      }
      try {
          const testTx = {
              id: `test_${Date.now()}`,
              storeId: stores[0].id,
              date: new Date().toISOString().split('T')[0],
              timestamp: Date.now(),
              items: [{ id: '1', name: 'Test Item', quantity: 1, price: 100, cost: 50, stock: 10, storeId: stores[0].id }],
              totalAmount: 100,
              paymentAmount: 100,
              cashierName: user.name
          };
          console.log("📝 Creating test transaction:", testTx);
          await storageService.savePosTransaction(testTx);
          console.log("✅ Test transaction created successfully!");
          alert("Test transaction created! Refreshing...");
          await loadData();
      } catch (e: any) {
          console.error("❌ Error creating test transaction:", e);
          console.error("Full error:", e.message, e);
          alert("Failed to create test transaction:\n" + (e.message || JSON.stringify(e)));
      }
  };

  const filteredTransactions = transactions.filter(t => {
      // Employees can only see their own store's transactions
      if (user.role === UserRole.EMPLOYEE && user.storeId && t.storeId !== user.storeId) return false;
      
      // Filter by selected store (if admin selects one, or employee default)
      if (filterStoreId && t.storeId !== filterStoreId) return false;
      
      // Filter by date
      if (filterDate && t.date !== filterDate) return false;
      
      return true;
  });

  const getStoreName = (id: string) => stores.find(s => s.id === id)?.name || 'Unknown Store';
  const formatMoney = (amount: number) => `₱${amount.toFixed(2)}`;

    return (
        <div className="space-y-6 min-h-0 w-full min-w-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm gap-4 relative z-30 w-full min-w-0">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={24} className="text-blue-600"/> Transaction History
                {/* Debug Indicator: Shows raw count from DB to verify data exists */}
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex items-center gap-1">
                    <Database size={10}/> Total: {transactions.length}
                </span>
                {/* Admin Debug Badge */}
                {user.role === UserRole.ADMIN && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        ADMIN MODE
                    </span>
                )}
            </h2>
            
            <div className="flex flex-wrap gap-3 relative z-50 w-full md:w-auto">
                {user.role === UserRole.ADMIN && (
                    <select 
                        value={filterStoreId} 
                        onChange={e => setFilterStoreId(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900 cursor-pointer"
                    >
                        <option value="">All Stores</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}
                <input 
                    type="date" 
                    value={filterDate} 
                    onChange={e => setFilterDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900 cursor-pointer"
                />
                {(filterStoreId || filterDate) && (
                    <button 
                        onClick={() => { setFilterStoreId(''); setFilterDate(''); }}
                        className="text-gray-500 hover:text-red-500 text-sm flex items-center"
                    >
                        <X size={16}/> Clear
                    </button>
                )}
                <button 
                    onClick={loadData}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 border border-blue-200 px-3 py-2 rounded hover:bg-blue-50 transition-colors"
                >
                    Refresh
                </button>
                {user.role === UserRole.ADMIN && (
                    <button 
                        onClick={handleCreateTestTransaction}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center gap-1 px-4 py-2 rounded transition-colors shadow-md"
                    >
                        + Test Tx
                    </button>
                )}
            </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative z-0 w-full min-w-0">
            <div className="overflow-x-auto min-w-0">
                <table className="w-full min-w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Time</th>
                            <th className="px-6 py-4">Store</th>
                            <th className="px-6 py-4">Items</th>
                            <th className="px-6 py-4 text-right">Total</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/>Loading...</td></tr>
                        ) : filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                            <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${tx.status === 'VOIDED' ? 'bg-red-50 opacity-75' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{tx.date}</div>
                                    <div className="text-xs text-gray-500">{tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4">{getStoreName(tx.storeId)}</td>
                                <td className="px-6 py-4">
                                    <div className="text-xs text-gray-600 max-w-xs">
                                        {tx.items && tx.items.length > 0 
                                            ? tx.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')
                                            : <span className="text-gray-400">No items data</span>
                                        }
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold">
                                    {formatMoney(tx.totalAmount)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {tx.status === 'VOIDED' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                            <AlertTriangle size={12}/> VOIDED
                                        </span>
                                    ) : tx.reportId ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                            <CheckCircle size={12}/> REPORTED
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                            PENDING
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {tx.status !== 'VOIDED' && (
                                        <button 
                                            onClick={() => handleVoid(tx)}
                                            disabled={!!voidingId}
                                            className="text-red-600 hover:text-red-800 text-xs font-bold uppercase border border-red-200 hover:bg-red-50 px-3 py-1 rounded transition-colors disabled:opacity-50"
                                        >
                                            {voidingId === tx.id ? '...' : 'VOID'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">No transactions found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};