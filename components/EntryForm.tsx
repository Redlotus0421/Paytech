import React, { useState, useEffect, useMemo } from 'react';
import { User, ReportData, Store, UserRole, CartItem } from '../types';
import { storageService } from '../services/storageService';
import { AlertTriangle, CheckCircle, Trash2, Plus, Save, Lock, ShoppingBag, BookOpen, Loader2, Tags, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface EntryFormProps {
  user: User;
  onSuccess: () => void;
}

interface InputRowProps {
  label: string;
  value: string | number;
  setter: (value: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
}

const InputRow = ({ label, value, setter, placeholder = "0", type = "number", prefix }: InputRowProps) => (
  <div className="mb-3">
    <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
    <div className="relative">
        {prefix && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">{prefix}</span>
            </div>
        )}
        <input
        type={type}
        step="0.01"
        value={value}
        onChange={(e) => setter(e.target.value)}
        className={`w-full py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 ${prefix ? 'pl-7 pr-3' : 'px-3'}`}
        placeholder={placeholder}
        />
    </div>
  </div>
);

// Extracted component to prevent re-rendering focus loss
interface ExpensesInputSectionProps {
    bankFees: string;
    setBankFees: (val: string) => void;
    expenses: { id: string, amount: string, description: string }[];
    setExpenses: React.Dispatch<React.SetStateAction<{ id: string, amount: string, description: string }[]>>;
}

const ExpensesInputSection: React.FC<ExpensesInputSectionProps> = ({ 
    bankFees, setBankFees, expenses, setExpenses 
}) => {
    const addExpense = () => {
        setExpenses([...expenses, { id: uuidv4(), amount: '', description: '' }]);
    };

    const updateExpense = (id: string, field: 'amount' | 'description', value: string) => {
        setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const removeExpense = (id: string) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputRow label="Bank Fees" value={bankFees} setter={setBankFees} prefix="₱" />
            </div>
            
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Other Expenses</label>
                    <button type="button" onClick={addExpense} className="text-blue-600 text-xs font-bold flex items-center hover:bg-blue-50 px-2 py-1 rounded">
                        <Plus size={14} className="mr-1"/> ADD EXPENSE
                    </button>
                </div>
                
                {expenses.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200 text-sm italic">
                        No other expenses recorded.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {expenses.map((item) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <div className="relative w-full">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">₱</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={item.amount}
                                        onChange={(e) => updateExpense(item.id, 'amount', e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateExpense(item.id, 'description', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                        placeholder="Description (e.g. Food, Supplies)"
                                    />
                                    <button type="button" onClick={() => removeExpense(item.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const EntryForm: React.FC<EntryFormProps> = ({ user, onSuccess }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'sod' | 'eod'>('sod');
  const [isSodSaved, setIsSodSaved] = useState(false);

  // Basic State
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Section 1: Start of Day
  const [sodGpo, setSodGpo] = useState<string>('');
  const [sodGcash, setSodGcash] = useState<string>('');
  const [sodPettyCash, setSodPettyCash] = useState<string>('');
  const [sodPettyCashNote, setSodPettyCashNote] = useState<string>('');
  // New split fields
  const [fundIn, setFundIn] = useState<string>('');
  const [cashAtm, setCashAtm] = useState<string>('');

  // Section 2: Sales (Manual Generic)
  const [salesTransactions, setSalesTransactions] = useState<{id: string, name: string, amount: string, cost: string, category: string}[]>([]);
  const [transactionCategories, setTransactionCategories] = useState<string[]>([]);
  
  // Section 2B: POS Sales (Auto-Loaded)
  const [posAggregated, setPosAggregated] = useState<CartItem[]>([]);

  // Section 3: Expenses (Shared state for SOD and EOD)
  const [bankFees, setBankFees] = useState<string>('');
  const [expenses, setExpenses] = useState<{id: string, amount: string, description: string}[]>([]);

  // Section 4: End of Day Assets
  const [eodGpo, setEodGpo] = useState<string>('');
  const [eodGcash, setEodGcash] = useState<string>('');
  const [eodActual, setEodActual] = useState<string>('');
  
  // Section 5: Manual Override
  const [gcashNotebook, setGcashNotebook] = useState<string>('');

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Refresh categories when modal opens
  useEffect(() => {
    if (isCategoryModalOpen) {
        storageService.fetchTransactionCategories().then(setTransactionCategories);
    }
  }, [isCategoryModalOpen]);

  // Load stores and categories asynchronously
  useEffect(() => {
    storageService.fetchStores().then(data => {
        setStores(data);
        if (user.storeId) {
            setSelectedStoreId(user.storeId);
        } else if (data.length > 0) {
            setSelectedStoreId(data[0].id);
        }
    });
    // Load saved transaction categories
    storageService.fetchTransactionCategories().then(setTransactionCategories);
  }, [user.storeId]);

  // --- AUTO LOAD POS DATA ---
  useEffect(() => {
    const loadPosData = async () => {
        if (selectedStoreId && date) {
            try {
                const posTxs = await storageService.getPosTransactions(selectedStoreId, date);
                if (Array.isArray(posTxs)) {
                    const aggregated: Record<string, CartItem> = {};
                    posTxs.forEach(tx => {
                        if (tx.items && Array.isArray(tx.items)) {
                            tx.items.forEach(item => {
                                if (aggregated[item.id]) {
                                    aggregated[item.id].quantity += item.quantity;
                                } else {
                                    aggregated[item.id] = { ...item };
                                }
                            });
                        }
                    });
                    setPosAggregated(Object.values(aggregated));
                }
            } catch (error) { console.error("Failed to load POS transactions:", error); }
        }
    };
    loadPosData();
  }, [selectedStoreId, date, activeTab]); 

  // --- RESTORE DRAFT IF EXISTS ---
  // Draft restoration removed to clear data on refresh
  /*
  useEffect(() => {
    const draftKey = `cfs_draft_${user.id}_${selectedStoreId}`;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
        try {
            const data = JSON.parse(draft);
            // Allow loading draft from any date
            if (data.date) {
                setDate(data.date);
                setSodGpo(data.sodGpo);
                setSodGcash(data.sodGcash);
                setSodPettyCash(data.sodPettyCash);
                setSodPettyCashNote(data.sodPettyCashNote || '');
                // Restore new fields
                setFundIn(data.fundIn || '');
                setCashAtm(data.cashAtm || '');
                setBankFees(data.bankFees || '');
                if (data.expenses) {
                    setExpenses(data.expenses);
                } else if (data.opExpenses) {
                    // Migrate old draft format
                    setExpenses([{ id: uuidv4(), amount: data.opExpenses, description: data.opExpensesNote || '' }]);
                }
                if (data.salesTransactions) setSalesTransactions(data.salesTransactions);
                setIsSodSaved(true);
            }
        } catch (e) { console.error("Failed to parse draft", e); }
    }
  }, [user.id, selectedStoreId]);
  */

  // --- HELPERS ---
  const num = (val: string) => parseFloat(val) || 0;
  
  const addTransaction = () => setSalesTransactions([...salesTransactions, { id: uuidv4(), name: '', amount: '', cost: '', category: '' }]);
  const removeTransaction = (id: string) => setSalesTransactions(salesTransactions.filter(t => t.id !== id));
  const updateTransaction = (id: string, field: 'name' | 'amount' | 'cost' | 'category', val: string) => {
    setSalesTransactions(salesTransactions.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const handleCategoryBlur = async (val: string) => {
    if (val && !transactionCategories.includes(val)) {
        const updated = await storageService.addTransactionCategory(val);
        setTransactionCategories(updated);
    }
  };

  const handleAddCategory = async () => {
    if (newCategoryInput.trim()) {
        const updated = await storageService.addTransactionCategory(newCategoryInput);
        setTransactionCategories(updated);
        setNewCategoryInput('');
    }
  };

  const handleRemoveCategory = async (cat: string) => {
    if (confirm(`Are you sure you want to remove category "${cat}"?`)) {
        const updated = await storageService.removeTransactionCategory(cat);
        setTransactionCategories(updated);
    }
  };

  // --- CALCULATIONS ---
  const calculations = useMemo(() => {
    // FIX: Include fundIn and cashAtm in calculation
    const totalStartFund = Number(sodGpo || 0) + Number(sodGcash || 0) + Number(sodPettyCash || 0) + Number(fundIn || 0) + Number(cashAtm || 0);
    const totalEndAssets = Number(eodGpo || 0) + Number(eodGcash || 0) + Number(eodActual || 0);
    
    const manualRevenue = salesTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const manualCost = salesTransactions.reduce((acc, t) => acc + Number(t.cost || 0), 0);
    const manualNet = manualRevenue - manualCost;
    
    const posRevenue = posAggregated.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0);
    const posCost = posAggregated.reduce((acc, item) => acc + (Number(item.cost) * Number(item.quantity)), 0);
    const posNet = posRevenue - posCost;

    const totalSalesRevenue = manualRevenue + posRevenue;
    const totalSalesNet = manualNet + posNet;
    const totalSalesCost = manualCost + posCost;
    const operationalExpensesOnly = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const totalExpenses = Number(bankFees || 0) + operationalExpensesOnly;
    const actualCashSales = totalEndAssets - totalStartFund;
    
    // Derived GCash Net = Growth (Actual Cash Sales) - Total Sales Revenue
    const rawDerivedGcashNet = actualCashSales - totalSalesRevenue;
    const derivedGcashNet = Math.abs(rawDerivedGcashNet) < 0.005 ? 0 : rawDerivedGcashNet;
    
    const notebookGcashVal = gcashNotebook ? Number(gcashNotebook) : 0;
    const hasNotebookEntry = gcashNotebook !== '';
    const effectiveGcashNet = hasNotebookEntry ? notebookGcashVal : derivedGcashNet;
    
    // Total EOD Sales (Actual Total EOD Sale) = Effective GCash Net + Total Sales Revenue
    // This represents the Total Asset Growth (adjusted by Notebook if present)
    const totalEodSales = effectiveGcashNet + totalSalesRevenue;
    
    // Notebook Difference = Derived Net - Notebook Value
    // Note: Operational/other expenses should NOT affect this variance.
    const rawNotebookDifference = hasNotebookEntry ? (derivedGcashNet - notebookGcashVal) : 0;
    // Fix negative zero display issue by treating very small differences as 0
    const notebookDifference = Math.abs(rawNotebookDifference) < 0.005 ? 0 : rawNotebookDifference;
    
    // Profit Calculation: Effective Net + Sales Net - Expenses
    const eodNetSales = effectiveGcashNet + totalSalesNet - totalExpenses;

    return {
      totalStartFund, totalEndAssets, totalSalesRevenue, totalExpenses, actualCashSales,
      derivedGcashNet, effectiveGcashNet, eodNetSales, hasNotebookEntry, notebookDifference, totalEodSales
    };
  }, [sodGpo, sodGcash, sodPettyCash, fundIn, cashAtm, eodGpo, eodGcash, eodActual, salesTransactions, posAggregated, bankFees, expenses, gcashNotebook]);

  // --- SAVE HANDLERS ---
  const handleSaveSod = () => {
    if (!selectedStoreId) return alert("Please select a store");
    // Draft saving removed
    /*
    const draftData = {
        date, sodGpo, sodGcash, sodPettyCash, sodPettyCashNote, fundIn, cashAtm, bankFees, expenses,
        salesTransactions 
    };
    const draftKey = `cfs_draft_${user.id}_${selectedStoreId}`;
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    */
    setIsSodSaved(true);
    setActiveTab('eod');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return alert("Please select a store");
    if (!isSodSaved) return alert("Please save Start of Day first");

    setIsSubmitting(true);
    const reportId = uuidv4();
    const report: ReportData = {
      id: reportId,
      storeId: selectedStoreId,
      userId: user.id,
      date,
      timestamp: Date.now(),
      sodGpo: num(sodGpo),
      sodGcash: num(sodGcash),
      sodPettyCash: num(sodPettyCash),
      sodPettyCashNote: sodPettyCashNote,
      fundIns: 0, // Deprecated
      fundIn: num(fundIn),
      cashAtm: num(cashAtm),
      
      customSales: salesTransactions.map(t => ({ id: t.id, name: t.name, amount: num(t.amount), cost: num(t.cost), category: t.category || 'Uncategorized' })),
      posSalesDetails: posAggregated,
      bankTransferFees: num(bankFees),
      operationalExpenses: expenses.reduce((acc, e) => acc + num(e.amount), 0),
      operationalExpensesNote: expenses.map(e => e.description).filter(Boolean).join(', '), 
      expenses: expenses.map(e => ({ id: e.id, amount: num(e.amount), description: e.description })),
      eodGpo: num(eodGpo),
      eodGcash: num(eodGcash),
      eodActualCash: num(eodActual),
      gcashNotebook: calculations.hasNotebookEntry ? num(gcashNotebook) : undefined,
      totalStartFund: calculations.totalStartFund,
      totalEndAssets: calculations.totalEndAssets,
      totalNetSales: calculations.totalSalesRevenue,
      totalExpenses: calculations.totalExpenses,
      theoreticalGrowth: calculations.actualCashSales,
      recordedProfit: calculations.eodNetSales,
      discrepancy: calculations.effectiveGcashNet, 
      status: Math.abs(calculations.effectiveGcashNet) < 1 ? 'BALANCED' : (calculations.effectiveGcashNet < 0 ? 'SHORTAGE' : 'SURPLUS')
    };

    try {
        await storageService.saveReport(report);
        await storageService.markPosTransactionsAsReported(selectedStoreId, date, reportId);
        await storageService.logActivity('Report Submitted', `Daily report submitted for ${selectedStoreName} (${date})`, user.id, user.name);
        // const draftKey = `cfs_draft_${user.id}_${selectedStoreId}`;
        // localStorage.removeItem(draftKey);
        onSuccess();
    } catch (error: any) {
        console.error("Failed to save report:", error);
        const errorMessage = error?.message || "Unknown error";
        const errorDetails = error?.details || "";
        alert(`Failed to save report to database.\nError: ${errorMessage}\n${errorDetails}\nPlease check your connection and try again.`);
    } finally {
        setIsSubmitting(false);
    }
  };

    const selectedStoreName = stores.find(s => s.id === selectedStoreId)?.name;

    return (
        <div className="space-y-6 min-h-0 w-full min-w-0">
      
      {/* Date Selection */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
          <label className="text-sm font-bold text-gray-700">Report Date:</label>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            className="border border-gray-300 rounded px-3 py-2 text-sm font-medium text-gray-900"
          />
          <span className="text-xs text-gray-500 italic">Changing this will load POS data for the selected date.</span>
      </div>

      {/* TABS HEADER */}
      <div className="flex rounded-lg bg-gray-200 p-1 mb-6">
          <button onClick={() => setActiveTab('sod')} className={`flex-1 py-3 text-sm font-bold rounded-md transition-all ${activeTab === 'sod' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            1. Start of Day (SOD) {selectedStoreName && <span className="ml-1 font-normal">({selectedStoreName})</span>}
          </button>
          <button onClick={() => isSodSaved && setActiveTab('eod')} disabled={!isSodSaved} className={`flex-1 py-3 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'eod' ? 'bg-white text-blue-600 shadow-sm' : !isSodSaved ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}>
            {!isSodSaved && <Lock size={14} />} 2. End of Day (EOD) {selectedStoreName && <span className="ml-1 font-normal">({selectedStoreName})</span>}
          </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* --- TAB 1: START OF DAY --- */}
        <div className={activeTab === 'sod' ? 'block' : 'hidden'}>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6 mb-20"> {/* Added mb-20 for spacing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Store</label>
                        <select value={selectedStoreId} onChange={e => { setSelectedStoreId(e.target.value); setIsSodSaved(false); }} disabled={user.role === UserRole.EMPLOYEE} className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 ${user.role === UserRole.EMPLOYEE ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <InputRow label="Date" value={date} setter={setDate} type="date" />
                </div>
                <hr className="border-gray-100" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InputRow label="GPO Start" value={sodGpo} setter={setSodGpo} prefix="₱" />
                    <InputRow label="GCash Start" value={sodGcash} setter={setSodGcash} prefix="₱" />
                    <div>
                        <InputRow label="Petty Cash" value={sodPettyCash} setter={setSodPettyCash} prefix="₱" />
                        <input 
                            type="text" 
                            value={sodPettyCashNote} 
                            onChange={e => setSodPettyCashNote(e.target.value)} 
                            placeholder="Note (Optional)" 
                            className="w-full -mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* SPLIT FIELDS */}
                    <InputRow label="GPO FUNDIN" value={fundIn} setter={setFundIn} prefix="₱" />
                    <InputRow label="Additional Cash (ATM)" value={cashAtm} setter={setCashAtm} prefix="₱" />
                </div>
                <div className="pt-4 border-t border-gray-100 text-right">
                    <p className="text-sm text-gray-500">Total Start Fund</p>
                    <p className="text-2xl font-bold text-gray-900">₱{calculations.totalStartFund.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
            <div className="mt-6">
                <button type="button" onClick={handleSaveSod} className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <Save size={20} /> Save Start of Day
                </button>
            </div>
        </div>

        {/* --- TAB 2: END OF DAY --- */}
        <div className={activeTab === 'eod' ? 'flex flex-col' : 'hidden'} style={{ height: 'calc(100vh - 128px)' }}>
            <div className="flex-1 overflow-y-auto pr-4 space-y-6 pb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">End of Day (Assets)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <InputRow label="GPO End" value={eodGpo} setter={setEodGpo} prefix="₱" />
                    <InputRow label="GCash End" value={eodGcash} setter={setEodGcash} prefix="₱" />
                    <InputRow label="Actual Cash Count" value={eodActual} setter={setEodActual} prefix="₱" />
                </div>
            </div>

             {/* ... POS and Manual Sales sections remain the same ... */}
             <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                 <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ShoppingBag size={20} className="text-blue-600"/> POS Sales Summary</h2>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Auto-loaded from POS</span>
                </div>
                {posAggregated.length === 0 ? <div className="text-center py-6 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200 italic">No pending POS transactions found for {date}.</div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Net</th></tr></thead><tbody className="divide-y divide-gray-100 text-gray-900">{posAggregated.map(item => (<tr key={item.id}><td className="px-3 py-2 font-medium">{item.name}</td><td className="px-3 py-2 text-center">{item.quantity}</td><td className="px-3 py-2 text-right text-gray-500">₱{(item.cost * item.quantity).toFixed(2)}</td><td className="px-3 py-2 text-right font-medium">₱{(item.price * item.quantity).toFixed(2)}</td><td className="px-3 py-2 text-right text-green-600 font-bold">₱{((item.price - item.cost) * item.quantity).toFixed(2)}</td></tr>))}<tr className="bg-blue-50 font-bold border-t border-blue-100"><td className="px-3 py-2 text-blue-900">TOTAL POS</td><td className="px-3 py-2 text-center text-blue-900">{posAggregated.reduce((a, b) => a + b.quantity, 0)}</td><td className="px-3 py-2 text-right text-blue-900">₱{posAggregated.reduce((a, b) => a + (b.cost * b.quantity), 0).toFixed(2)}</td><td className="px-3 py-2 text-right text-blue-900">₱{posAggregated.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</td><td className="px-3 py-2 text-right text-blue-900">₱{posAggregated.reduce((a, b) => a + ((b.price - b.cost) * b.quantity), 0).toFixed(2)}</td></tr></tbody></table>
                    </div>
                )}
             </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-gray-900">Other Transactions</h2>
                        <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="text-gray-500 hover:text-blue-600 text-xs flex items-center gap-1 bg-gray-100 px-2 py-1 rounded transition-colors">
                            <Tags size={12} /> Manage Categories
                        </button>
                    </div>
                    <button type="button" onClick={addTransaction} className="text-blue-600 text-sm font-bold flex items-center hover:bg-blue-50 px-3 py-1 rounded"><Plus size={16} className="mr-1"/> ADD TRANSACTION</button>
                </div>
                {salesTransactions.length === 0 ? <div className="text-center py-6 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200">No manual transactions recorded.</div> : (
                    <div className="space-y-3">{salesTransactions.map((item) => (
                      <div key={item.id} className="flex gap-3 items-end flex-wrap">
                        <div className="flex-[2] min-w-[150px]">
                          <label className="text-xs text-gray-500 mb-1 block">Name</label>
                          <input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" value={item.name} onChange={e => updateTransaction(item.id, 'name', e.target.value)} placeholder="Services/Others"/>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="text-xs text-gray-500 mb-1 block">Category</label>
                          <select 
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" 
                            value={item.category} 
                            onChange={e => updateTransaction(item.id, 'category', e.target.value)} 
                          >
                            <option value="" disabled>Select...</option>
                            {transactionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            {item.category && !transactionCategories.includes(item.category) && (
                                <option value={item.category}>{item.category}</option>
                            )}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="text-xs text-gray-500 mb-1 block">Cost (Optional)</label>
                          <div className="relative"><span className="absolute left-2 top-2 text-gray-400 text-xs">₱</span><input placeholder="0.00" type="number" className="w-full pl-6 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" value={item.cost} onChange={e => updateTransaction(item.id, 'cost', e.target.value)} /></div>
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="text-xs text-gray-500 mb-1 block">Amount</label>
                          <div className="relative"><span className="absolute left-2 top-2 text-gray-400 text-xs">₱</span><input placeholder="0.00" type="number" className="w-full pl-6 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" value={item.amount} onChange={e => updateTransaction(item.id, 'amount', e.target.value)} /></div>
                        </div>
                        <button type="button" onClick={() => removeTransaction(item.id)} className="text-red-400 hover:text-red-600 p-2 mb-0.5 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                      </div>
                    ))}</div>
                )}
            </div>

             <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6 border-l-4 border-l-purple-500">
                <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b flex items-center gap-2"><BookOpen size={20} className="text-purple-600"/> GCash Notebook Verification</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><InputRow label="Gcash Net from Notebook" value={gcashNotebook} setter={setGcashNotebook} prefix="₱" /><p className="text-xs text-gray-500 mt-1">Entering a value here will <strong>override</strong> the system-derived GCash Net in the final EOD Net Sales calculation.</p></div>
                    <div className="bg-purple-50 p-4 rounded-lg flex flex-col justify-center"><div className="text-xs font-bold text-gray-500 uppercase mb-1">System Derived GCash Net</div><div className={`text-xl font-bold ${calculations.derivedGcashNet < 0 ? 'text-red-600' : 'text-green-600'}`}>₱{calculations.derivedGcashNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>{calculations.hasNotebookEntry && (<div className="mt-2 text-xs text-purple-700 font-semibold">Note: This value is currently ignored in favor of the Notebook entry.</div>)}</div>
                </div>
             </div>

            {/* Expenses now here in EOD, removed from SOD */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">Expenses & Fees</h2>
                <ExpensesInputSection bankFees={bankFees} setBankFees={setBankFees} expenses={expenses} setExpenses={setExpenses}/>
            </div>
            </div>

            {/* Sticky Footer */}
            <div className="border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                 <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                         <div className={`bg-gray-50 p-2 rounded border border-gray-100 ${calculations.hasNotebookEntry ? 'opacity-50' : ''}`}><div className="text-green-700 text-xs font-bold uppercase">GCash Net (Derived)</div><div className="text-green-700 font-bold">₱{calculations.derivedGcashNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                         <div className={`p-2 rounded border ${calculations.hasNotebookEntry ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'}`}><div className={`text-xs font-bold uppercase ${calculations.hasNotebookEntry ? 'text-purple-700' : 'text-gray-500'}`}>GCash Notebook</div><div className={`font-bold ${calculations.hasNotebookEntry ? 'text-purple-900' : 'text-gray-400'}`}>{calculations.hasNotebookEntry ? `₱${Number(gcashNotebook).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}</div></div>
                         <div className="bg-gray-50 p-2 rounded border border-gray-100"><div className="text-gray-900 text-xs font-bold uppercase">TOTAL EOD SALES</div><div className="text-gray-900 font-bold">₱{calculations.actualCashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                         <div className="bg-blue-50 border-blue-100 border p-2 rounded"><div className="text-blue-600 text-xs font-bold uppercase">EOD Net Sales</div><div className="text-blue-900 font-bold">₱{calculations.eodNetSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-stretch">
                        <div className={`col-span-2 p-4 rounded-lg border flex justify-between items-center ${calculations.effectiveGcashNet >= 0 ? 'bg-green-500/10 border-green-200' : 'bg-red-500/10 border-red-200' }`}><div className="flex flex-col justify-center"><div className={`text-xs font-bold uppercase mb-1 ${calculations.effectiveGcashNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>Total Gcash NET</div><div className={`text-3xl font-extrabold ${calculations.effectiveGcashNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>{calculations.effectiveGcashNet > 0 ? '+' : ''}₱{calculations.effectiveGcashNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div><div className="text-right flex items-center h-full">{Math.abs(calculations.effectiveGcashNet) < 1 ? (<span className="text-green-700 font-bold flex items-center gap-2 text-lg"><CheckCircle size={24}/> BALANCED</span>) : (<span className={`${calculations.effectiveGcashNet >= 0 ? 'text-green-700' : 'text-red-700'} font-bold flex items-center gap-2 text-lg`}><AlertTriangle size={24}/> {calculations.effectiveGcashNet < 0 ? 'SHORTAGE' : 'SURPLUS'}</span>)}</div></div>
                        <div className={`col-span-1 border p-4 rounded-lg flex flex-col justify-center shadow-sm ${calculations.hasNotebookEntry ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'}`}>
                            <div className={`text-xs font-bold uppercase mb-1 ${calculations.hasNotebookEntry ? 'text-purple-700' : 'text-gray-500'}`}>Difference</div>
                            <div className={`text-2xl font-bold ${!calculations.hasNotebookEntry ? 'text-gray-400' : calculations.notebookDifference > 0 ? 'text-green-600' : (calculations.notebookDifference < 0 ? 'text-red-600' : 'text-black')}`}>
                                {calculations.hasNotebookEntry ? (
                                    <>
                                        {calculations.notebookDifference > 0 ? '+' : ''}₱{calculations.notebookDifference.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </>
                                ) : (
                                    '---'
                                )}
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className={`col-span-1 w-full h-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}>{isSubmitting ? (<><Loader2 className="animate-spin mr-2" size={20}/> Submitting...</>) : ('Submit Final Report')}</button>
                    </div>
                 </div>
            </div>
        </div>
      
      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Tags size={18}/> Manage Categories
                    </h3>
                    <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={20}/></button>
                </div>
                <div className="p-4">
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={newCategoryInput}
                            onChange={(e) => setNewCategoryInput(e.target.value)}
                            placeholder="New category name..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                        />
                        <button 
                            type="button"
                            onClick={handleAddCategory}
                            disabled={!newCategoryInput.trim()}
                            className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add
                        </button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
                        {transactionCategories.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm italic">No categories found.</div>
                        ) : (
                            transactionCategories.map(cat => (
                                <div key={cat} className="flex justify-between items-center p-3 hover:bg-gray-50">
                                    <span className="text-sm text-gray-700">{cat}</span>
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveCategory(cat)}
                                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                        title="Remove category"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
      </form>
    </div>
  );
};