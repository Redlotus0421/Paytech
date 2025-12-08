import React, { useState, useEffect, useMemo } from 'react';
import { User, ReportData, Store, UserRole, CartItem } from '../types';
import { storageService } from '../services/storageService';
import { AlertTriangle, CheckCircle, Trash2, Plus, Save, Lock, ShoppingBag, BookOpen, Loader2 } from 'lucide-react';
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
    opExpenses: string;
    setOpExpenses: (val: string) => void;
    opExpensesNote: string;
    setOpExpensesNote: (val: string) => void;
}

const ExpensesInputSection: React.FC<ExpensesInputSectionProps> = ({ 
    bankFees, setBankFees, opExpenses, setOpExpenses, opExpensesNote, setOpExpensesNote 
}) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputRow label="Bank Fees" value={bankFees} setter={setBankFees} prefix="₱" />
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Other Expenses</label>
            <div className="flex gap-2">
                <div className="relative w-1/3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">₱</span>
                    </div>
                    <input
                        type="number"
                        step="0.01"
                        value={opExpenses}
                        onChange={(e) => setOpExpenses(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                    />
                </div>
                <input
                    type="text"
                    value={opExpensesNote}
                    onChange={(e) => setOpExpensesNote(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description (e.g. Food, Supplies)"
                />
            </div>
        </div>
    </div>
);

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
  // New split fields
  const [fundIn, setFundIn] = useState<string>('');
  const [cashAtm, setCashAtm] = useState<string>('');

  // Section 2: Sales (Manual Generic)
  const [salesTransactions, setSalesTransactions] = useState<{id: string, name: string, amount: string, cost: string}[]>([]);
  
  // Section 2B: POS Sales (Auto-Loaded)
  const [posAggregated, setPosAggregated] = useState<CartItem[]>([]);

  // Section 3: Expenses (Shared state for SOD and EOD)
  const [bankFees, setBankFees] = useState<string>('');
  const [opExpenses, setOpExpenses] = useState<string>('');
  const [opExpensesNote, setOpExpensesNote] = useState<string>('');

  // Section 4: End of Day Assets
  const [eodGpo, setEodGpo] = useState<string>('');
  const [eodGcash, setEodGcash] = useState<string>('');
  const [eodActual, setEodActual] = useState<string>('');
  
  // Section 5: Manual Override
  const [gcashNotebook, setGcashNotebook] = useState<string>('');

  // Load stores asynchronously
  useEffect(() => {
    storageService.fetchStores().then(data => {
        setStores(data);
        if (user.storeId) {
            setSelectedStoreId(user.storeId);
        } else if (data.length > 0) {
            setSelectedStoreId(data[0].id);
        }
    });
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
  useEffect(() => {
    const draftKey = `cfs_draft_${user.id}_${selectedStoreId}`;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
        try {
            const data = JSON.parse(draft);
            if (data.date === new Date().toISOString().split('T')[0]) {
                setSodGpo(data.sodGpo);
                setSodGcash(data.sodGcash);
                setSodPettyCash(data.sodPettyCash);
                // Restore new fields
                setFundIn(data.fundIn || '');
                setCashAtm(data.cashAtm || '');
                setBankFees(data.bankFees || '');
                setOpExpenses(data.opExpenses || '');
                setOpExpensesNote(data.opExpensesNote || '');
                if (data.salesTransactions) setSalesTransactions(data.salesTransactions);
                setIsSodSaved(true);
            } else {
                localStorage.removeItem(draftKey);
            }
        } catch (e) { console.error("Failed to parse draft", e); }
    }
  }, [user.id, selectedStoreId]);

  // --- HELPERS ---
  const num = (val: string) => parseFloat(val) || 0;
  
  const addTransaction = () => setSalesTransactions([...salesTransactions, { id: uuidv4(), name: '', amount: '', cost: '' }]);
  const removeTransaction = (id: string) => setSalesTransactions(salesTransactions.filter(t => t.id !== id));
  const updateTransaction = (id: string, field: 'name' | 'amount' | 'cost', val: string) => {
    setSalesTransactions(salesTransactions.map(t => t.id === id ? { ...t, [field]: val } : t));
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
    const totalExpenses = Number(bankFees || 0) + Number(opExpenses || 0);
    const actualCashSales = totalEndAssets - totalStartFund;
    const derivedGcashNet = actualCashSales - totalSalesRevenue;
    const notebookGcashVal = gcashNotebook ? Number(gcashNotebook) : 0;
    const hasNotebookEntry = gcashNotebook !== '';
    const effectiveGcashNet = hasNotebookEntry ? notebookGcashVal : derivedGcashNet;
    
    // REVERSED AS REQUESTED: System Derived - Notebook
    const notebookDifference = hasNotebookEntry ? derivedGcashNet - notebookGcashVal : 0;
    const eodNetSales = effectiveGcashNet + totalSalesNet - totalExpenses;

    return {
      totalStartFund, totalEndAssets, totalSalesRevenue, totalExpenses, actualCashSales,
      derivedGcashNet, effectiveGcashNet, eodNetSales, hasNotebookEntry, notebookDifference
    };
  }, [sodGpo, sodGcash, sodPettyCash, fundIn, cashAtm, eodGpo, eodGcash, eodActual, salesTransactions, posAggregated, bankFees, opExpenses, gcashNotebook]);

  // --- SAVE HANDLERS ---
  const handleSaveSod = () => {
    if (!selectedStoreId) return alert("Please select a store");
    const draftData = {
        date, sodGpo, sodGcash, sodPettyCash, fundIn, cashAtm, bankFees, opExpenses, opExpensesNote,
        salesTransactions 
    };
    const draftKey = `cfs_draft_${user.id}_${selectedStoreId}`;
    localStorage.setItem(draftKey, JSON.stringify(draftData));
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
      fundIns: 0, // Deprecated
      fundIn: num(fundIn),
      cashAtm: num(cashAtm),
      
      customSales: salesTransactions.map(t => ({ id: t.id, name: t.name, amount: num(t.amount), cost: num(t.cost) })),
      posSalesDetails: posAggregated,
      bankTransferFees: num(bankFees),
      operationalExpenses: num(opExpenses),
      operationalExpensesNote: opExpensesNote, 
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
        const draftKey = `cfs_draft_${user.id}_${selectedStoreId}`;
        localStorage.removeItem(draftKey);
        onSuccess();
    } catch (error) {
        console.error("Failed to save report:", error);
        alert("Failed to save report to database. Please check your connection and try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* TABS HEADER */}
      <div className="flex rounded-lg bg-gray-200 p-1 mb-6">
          <button onClick={() => setActiveTab('sod')} className={`flex-1 py-3 text-sm font-bold rounded-md transition-all ${activeTab === 'sod' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>1. Start of Day (SOD)</button>
          <button onClick={() => isSodSaved && setActiveTab('eod')} disabled={!isSodSaved} className={`flex-1 py-3 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'eod' ? 'bg-white text-blue-600 shadow-sm' : !isSodSaved ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}>{!isSodSaved && <Lock size={14} />} 2. End of Day (EOD)</button>
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
                    <InputRow label="Petty Cash" value={sodPettyCash} setter={setSodPettyCash} prefix="₱" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* SPLIT FIELDS */}
                    <InputRow label="Additional Fund-in" value={fundIn} setter={setFundIn} prefix="₱" />
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
        <div className={activeTab === 'eod' ? 'block' : 'hidden'}>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
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
                <div className="flex justify-between items-center mb-4 pb-2 border-b"><h2 className="text-lg font-bold text-gray-900">Other Transactions</h2><button type="button" onClick={addTransaction} className="text-blue-600 text-sm font-bold flex items-center hover:bg-blue-50 px-3 py-1 rounded"><Plus size={16} className="mr-1"/> ADD TRANSACTION</button></div>
                {salesTransactions.length === 0 ? <div className="text-center py-6 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200">No manual transactions recorded.</div> : (
                    <div className="space-y-3">{salesTransactions.map((item) => (<div key={item.id} className="flex gap-3 items-end"><div className="flex-[2]"><label className="text-xs text-gray-500 mb-1 block">Name</label><input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" value={item.name} onChange={e => updateTransaction(item.id, 'name', e.target.value)} placeholder="Services/Others"/></div><div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Cost (Optional)</label><div className="relative"><span className="absolute left-2 top-2 text-gray-400 text-xs">₱</span><input placeholder="0.00" type="number" className="w-full pl-6 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" value={item.cost} onChange={e => updateTransaction(item.id, 'cost', e.target.value)} /></div></div><div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Amount</label><div className="relative"><span className="absolute left-2 top-2 text-gray-400 text-xs">₱</span><input placeholder="0.00" type="number" className="w-full pl-6 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900" value={item.amount} onChange={e => updateTransaction(item.id, 'amount', e.target.value)} /></div></div><button type="button" onClick={() => removeTransaction(item.id)} className="text-red-400 hover:text-red-600 p-2 mb-0.5 hover:bg-red-50 rounded"><Trash2 size={18}/></button></div>))}</div>
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
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-32">
                <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">Expenses & Fees</h2>
                <ExpensesInputSection bankFees={bankFees} setBankFees={setBankFees} opExpenses={opExpenses} setOpExpenses={setOpExpenses} opExpensesNote={opExpensesNote} setOpExpensesNote={setOpExpensesNote}/>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 md:left-64 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
                 <div className="max-w-6xl mx-auto flex flex-col gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                         <div className="bg-gray-50 p-2 rounded border border-gray-100"><div className="text-gray-900 text-xs font-bold uppercase">TOTAL EOD SALES</div><div className="text-gray-900 font-bold">₱{calculations.actualCashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                         <div className={`bg-gray-50 p-2 rounded border border-gray-100 ${calculations.hasNotebookEntry ? 'opacity-50' : ''}`}><div className="text-green-700 text-xs font-bold uppercase">GCash Net (Derived)</div><div className="text-green-700 font-bold">₱{calculations.derivedGcashNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                         <div className={`p-2 rounded border ${calculations.hasNotebookEntry ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'}`}><div className={`text-xs font-bold uppercase ${calculations.hasNotebookEntry ? 'text-purple-700' : 'text-gray-500'}`}>GCash Notebook</div><div className={`font-bold ${calculations.hasNotebookEntry ? 'text-purple-900' : 'text-gray-400'}`}>{calculations.hasNotebookEntry ? `₱${Number(gcashNotebook).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}</div></div>
                         <div className="bg-blue-50 border-blue-100 border p-2 rounded"><div className="text-blue-600 text-xs font-bold uppercase">EOD Net Sales</div><div className="text-blue-900 font-bold">₱{calculations.eodNetSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-stretch">
                        <div className={`flex-1 w-full p-4 rounded-lg border flex justify-between items-center ${Math.abs(calculations.effectiveGcashNet) < 1 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200' }`}><div className="flex flex-col justify-center"><div className={`text-xs font-bold uppercase mb-1 ${Math.abs(calculations.effectiveGcashNet) < 1 ? 'text-green-600' : 'text-red-400'}`}>Total Gcash NET</div><div className={`text-3xl font-extrabold ${Math.abs(calculations.effectiveGcashNet) < 1 ? 'text-green-700' : 'text-red-600'}`}>{calculations.effectiveGcashNet > 0 ? '+' : ''}₱{calculations.effectiveGcashNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div><div className="text-right flex items-center h-full">{Math.abs(calculations.effectiveGcashNet) < 1 ? (<span className="text-green-700 font-bold flex items-center gap-2 text-lg"><CheckCircle size={24}/> BALANCED</span>) : (<span className="text-red-600 font-bold flex items-center gap-2 text-lg"><AlertTriangle size={24}/> {calculations.effectiveGcashNet < 0 ? 'SHORTAGE' : 'SURPLUS'}</span>)}</div></div>
                        {calculations.hasNotebookEntry && (<div className="bg-purple-50 border border-purple-200 p-4 rounded-lg flex flex-col justify-center min-w-[160px] shadow-sm"><div className="text-xs font-bold uppercase text-purple-700 mb-1">Difference</div><div className={`text-2xl font-bold ${calculations.notebookDifference > 0 ? 'text-green-600' : (calculations.notebookDifference < 0 ? 'text-red-600' : 'text-gray-600')}`}>{calculations.notebookDifference > 0 ? '+' : ''}₱{calculations.notebookDifference.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>)}
                        <button type="submit" disabled={isSubmitting} className={`w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}>{isSubmitting ? (<><Loader2 className="animate-spin mr-2" size={20}/> Submitting...</>) : ('Submit Final Report')}</button>
                    </div>
                 </div>
            </div>
        </div>
      </form>
    </div>
  );
};