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
    const [users, setUsers] = useState<any[]>([]);
  
  // Filters
  const [filterStoreId, setFilterStoreId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Voiding State
  const [voidingId, setVoidingId] = useState<string | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
        const [allStores, allTxs, allUsers] = await Promise.all([
            storageService.fetchStores(),
            storageService.fetchTransactions(),
            storageService.fetchUsers()
        ]);
        setStores(allStores);
        setUsers(allUsers || []);
        
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
      // ask for a void note first
      const note = window.prompt('Enter a brief note/reason for voiding this transaction (required):');
      if (note === null) return; // cancelled
      if (!note.trim()) { alert('Void note is required.'); return; }

      // Ask for admin credentials to authorize the void
      const adminUser = window.prompt('Admin username to authorize void:');
      if (!adminUser) { alert('Admin username required to authorize void.'); return; }
      const adminPass = window.prompt('Admin password:');
      if (adminPass === null) return;

      setVoidingId(tx.id);
      try {
          const auth = await storageService.login(adminUser, adminPass);
          if (!auth || auth.role !== UserRole.ADMIN) {
              alert('Admin authorization failed. Void aborted.');
              return;
          }

          // final confirmation
          if (!window.confirm('Confirm void. This will return items to inventory and cannot be undone.')) return;

          await storageService.voidTransaction(tx.id, auth.id, note.trim());
          alert('Transaction voided successfully. Stock has been returned.');
          await loadData(); // Refresh list
      } catch (e: any) {
          console.error(e);
          alert('Failed to void transaction: ' + (e?.message || e));
      } finally {
          setVoidingId(null);
      }
  };

  const viewReceipt = (tx: any) => setSelectedReceipt(tx);
  const closeReceipt = () => setSelectedReceipt(null);

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
    const getUserName = (id?: string | null) => {
        if (!id) return null;
        const u = users.find((x: any) => x.id === id);
        return u ? (u.name || u.username || id) : id;
    };

    const formatMoney = (amount: number) => `₱${amount.toFixed(2)}`;

    return (
        <div className="flex flex-col gap-6 min-h-0 w-full min-w-0 h-full overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm gap-4 relative z-30 w-full min-w-0 flex-shrink-0">
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
            <div className="overflow-x-auto overflow-y-auto min-w-0 max-h-[70vh]">
                <table className="w-full min-w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 sticky top-0">
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
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                              <AlertTriangle size={12}/> VOIDED
                                          </span>
                                                                                    {tx.voidNote && <div className="text-xs text-gray-500">Note: {tx.voidNote}</div>}
                                                                                    {tx.voidedBy && <div className="text-xs text-gray-500">By: {getUserName(tx.voidedBy)}</div>}
                                        </div>
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
                                <td className="px-6 py-4 text-center space-x-2">
                                    <button onClick={() => viewReceipt(tx)} className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase border border-blue-200 hover:bg-blue-50 px-3 py-1 rounded transition-colors">VIEW</button>
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
        {selectedReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold">Receipt</h3>
                                <p className="text-sm text-gray-500">{getStoreName(selectedReceipt.storeId)} • {selectedReceipt.date} {selectedReceipt.timestamp ? new Date(selectedReceipt.timestamp).toLocaleTimeString() : ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify(selectedReceipt)); alert('Receipt copied'); }} className="text-sm text-gray-500">Copy</button>
                                <button onClick={closeReceipt} className="bg-gray-100 px-3 py-1 rounded text-sm">Close</button>
                            </div>
                        </div>
                        <div className="mb-4">
                            <div className="text-sm text-gray-700 font-medium">Cashier: {selectedReceipt.cashierName || 'N/A'}</div>
                            <div className="mt-2">
                                {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                                    <ul className="text-sm divide-y divide-gray-100">
                                        {selectedReceipt.items.map((it: any, idx: number) => (
                                            <li key={idx} className="py-2 flex justify-between">
                                                <div>{it.quantity} x {it.name}</div>
                                                <div className="font-mono">₱{(it.price * it.quantity).toFixed(2)}</div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-sm text-gray-400">No items available</div>
                                )}
                            </div>
                            {selectedReceipt.status === 'VOIDED' && (
                                <div className="mt-3 text-xs text-red-600">
                                    <div className="font-semibold">VOIDED</div>
                                    {selectedReceipt.voidNote && <div>Note: {selectedReceipt.voidNote}</div>}
                                    {selectedReceipt.voidedBy && <div>Voided by: {getUserName(selectedReceipt.voidedBy)}</div>}
                                    {selectedReceipt.voidedAt && <div>At: {new Date(selectedReceipt.voidedAt).toLocaleString()}</div>}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <div className="text-right">
                                <div className="font-bold text-lg">Total: {formatMoney(selectedReceipt.totalAmount || 0)}</div>
                            </div>
                        </div>
                    </div>
                </div>
        )}
    </div>
  );
};