import React, { useState, useEffect, useMemo } from 'react';
import { User, ReportData, Store, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { AlertTriangle, CheckCircle, Calculator, Trash2, Plus } from 'lucide-react';
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
}

// Fixed: Component defined outside to prevent re-renders losing focus
const InputRow = ({ label, value, setter, placeholder = "0.00", type = "number" }: InputRowProps) => (
  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      step="0.01"
      value={value}
      onChange={(e) => setter(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
      placeholder={placeholder}
    />
  </div>
);

export const EntryForm: React.FC<EntryFormProps> = ({ user, onSuccess }) => {
  const stores = storageService.getStores();
  
  // Basic State
  const [selectedStoreId, setSelectedStoreId] = useState<string>(user.storeId || (stores[0]?.id || ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Section 1: Start of Day
  const [sodGpo, setSodGpo] = useState<string>('');
  const [sodGcash, setSodGcash] = useState<string>('');
  const [sodPettyCash, setSodPettyCash] = useState<string>('');
  const [fundIns, setFundIns] = useState<string>('');

  // Section 2: Sales
  const [printerRevenue, setPrinterRevenue] = useState<string>('');
  const [gcashSystem, setGcashSystem] = useState<string>('');
  const [gcashNotebook, setGcashNotebook] = useState<string>('');
  
  const [toys, setToys] = useState<{id: string, capital: string, price: string}[]>([]);
  const [coffee, setCoffee] = useState<{id: string, capital: string, price: string}[]>([]);

  // Section 3: Expenses
  const [bankFees, setBankFees] = useState<string>('');
  const [opExpenses, setOpExpenses] = useState<string>('');

  // Section 4: End of Day Assets
  const [eodGpo, setEodGpo] = useState<string>('');
  const [eodGcash, setEodGcash] = useState<string>('');
  const [eodActual, setEodActual] = useState<string>('');

  // --- HELPERS ---
  const num = (val: string) => parseFloat(val) || 0;
  
  const addToy = () => setToys([...toys, { id: uuidv4(), capital: '', price: '' }]);
  const removeToy = (id: string) => setToys(toys.filter(t => t.id !== id));
  const updateToy = (id: string, field: 'capital' | 'price', val: string) => {
    setToys(toys.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const addCoffee = () => setCoffee([...coffee, { id: uuidv4(), capital: '', price: '' }]);
  const removeCoffee = (id: string) => setCoffee(coffee.filter(c => c.id !== id));
  const updateCoffee = (id: string, field: 'capital' | 'price', val: string) => {
    setCoffee(coffee.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  // --- CALCULATIONS ---
  const calculations = useMemo(() => {
    const totalStartFund = num(sodGpo) + num(sodGcash) + num(sodPettyCash) + num(fundIns);
    const totalEndAssets = num(eodGpo) + num(eodGcash) + num(eodActual);
    
    const toysNet = toys.reduce((acc, t) => acc + (num(t.price) - num(t.capital)), 0);
    const coffeeNet = coffee.reduce((acc, c) => acc + (num(c.price) - num(c.capital)), 0);
    const gcashNet = num(gcashNotebook); 

    const totalNetSales = gcashNet + toysNet + coffeeNet + num(printerRevenue);
    const totalExpenses = num(bankFees) + num(opExpenses);
    
    const theoreticalGrowth = totalEndAssets - totalStartFund;
    const recordedProfit = totalNetSales - totalExpenses;
    
    // Discrepancy logic
    const discrepancy = theoreticalGrowth - recordedProfit;

    return {
      totalStartFund,
      totalEndAssets,
      totalNetSales,
      totalExpenses,
      theoreticalGrowth,
      recordedProfit,
      discrepancy
    };
  }, [sodGpo, sodGcash, sodPettyCash, fundIns, eodGpo, eodGcash, eodActual, toys, coffee, printerRevenue, gcashNotebook, bankFees, opExpenses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return alert("Please select a store");

    const report: ReportData = {
      id: uuidv4(),
      storeId: selectedStoreId,
      userId: user.id,
      date,
      timestamp: Date.now(),
      sodGpo: num(sodGpo),
      sodGcash: num(sodGcash),
      sodPettyCash: num(sodPettyCash),
      fundIns: num(fundIns),
      toys: toys.map(t => ({ id: t.id, name: 'Toy', capital: num(t.capital), price: num(t.price)})),
      coffee: coffee.map(c => ({ id: c.id, name: 'Coffee', capital: num(c.capital), price: num(c.price)})),
      printerRevenue: num(printerRevenue),
      gcashSystemAmount: num(gcashSystem),
      gcashNotebookRecord: num(gcashNotebook),
      bankTransferFees: num(bankFees),
      operationalExpenses: num(opExpenses),
      eodGpo: num(eodGpo),
      eodGcash: num(eodGcash),
      eodActualCash: num(eodActual),
      ...calculations,
      status: Math.abs(calculations.discrepancy) < 1 ? 'BALANCED' : (calculations.discrepancy < 0 ? 'SHORTAGE' : 'OVERAGE')
    };

    storageService.saveReport(report);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">1</span> 
          Start of Day
        </h2>
        {user.role === UserRole.ADMIN && (
          <div className="mb-4">
             <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
             <select 
              value={selectedStoreId} 
              onChange={e => setSelectedStoreId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
             >
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>
        )}
        <InputRow label="Date" value={date} setter={setDate} type="date" />
        <div className="grid grid-cols-2 gap-4">
          <InputRow label="GPO Start" value={sodGpo} setter={setSodGpo} />
          <InputRow label="GCash Start" value={sodGcash} setter={setSodGcash} />
          <InputRow label="Petty Cash" value={sodPettyCash} setter={setSodPettyCash} />
          <InputRow label="Fund Ins / ATM" value={fundIns} setter={setFundIns} />
        </div>
        <div className="mt-2 text-right text-sm text-gray-600">
          Total Start: <span className="font-semibold text-gray-900">{calculations.totalStartFund.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
           <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">2</span> 
           Sales & Operations
        </h2>
        
        <InputRow label="Printer / Services Revenue" value={printerRevenue} setter={setPrinterRevenue} />
        
        <div className="grid grid-cols-2 gap-4 mb-4">
           <InputRow label="GCash System" value={gcashSystem} setter={setGcashSystem} />
           <InputRow label="GCash Notebook" value={gcashNotebook} setter={setGcashNotebook} />
        </div>
        {num(gcashSystem) !== num(gcashNotebook) && (
            <div className="mb-4 p-2 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200 flex items-center">
                <AlertTriangle size={14} className="mr-1"/>
                Mismatch: {Math.abs(num(gcashSystem) - num(gcashNotebook)).toFixed(2)} diff
            </div>
        )}

        {/* Toys Sub-section */}
        <div className="mb-4 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-700">Toys Sales</h3>
                <button type="button" onClick={addToy} className="text-blue-600 text-xs flex items-center"><Plus size={14}/> Add Item</button>
            </div>
            {toys.map((item, idx) => (
                <div key={item.id} className="flex gap-2 mb-2 items-center">
                    <input placeholder="Capital" type="number" className="w-1/3 text-sm p-1 border border-gray-300 rounded bg-white text-gray-900" value={item.capital} onChange={e => updateToy(item.id, 'capital', e.target.value)} />
                    <input placeholder="Sold Price" type="number" className="w-1/3 text-sm p-1 border border-gray-300 rounded bg-white text-gray-900" value={item.price} onChange={e => updateToy(item.id, 'price', e.target.value)} />
                    <div className="text-xs text-green-600 w-1/6 font-mono text-right">
                        +{(num(item.price) - num(item.capital)).toFixed(0)}
                    </div>
                    <button type="button" onClick={() => removeToy(item.id)} className="text-red-400"><Trash2 size={16}/></button>
                </div>
            ))}
        </div>

        {/* Coffee Sub-section */}
        <div className="mb-4 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-700">Coffee Sales</h3>
                <button type="button" onClick={addCoffee} className="text-blue-600 text-xs flex items-center"><Plus size={14}/> Add Item</button>
            </div>
            {coffee.map((item, idx) => (
                <div key={item.id} className="flex gap-2 mb-2 items-center">
                    <input placeholder="Capital" type="number" className="w-1/3 text-sm p-1 border border-gray-300 rounded bg-white text-gray-900" value={item.capital} onChange={e => updateCoffee(item.id, 'capital', e.target.value)} />
                    <input placeholder="Sold Price" type="number" className="w-1/3 text-sm p-1 border border-gray-300 rounded bg-white text-gray-900" value={item.price} onChange={e => updateCoffee(item.id, 'price', e.target.value)} />
                    <div className="text-xs text-green-600 w-1/6 font-mono text-right">
                        +{(num(item.price) - num(item.capital)).toFixed(0)}
                    </div>
                    <button type="button" onClick={() => removeCoffee(item.id)} className="text-red-400"><Trash2 size={16}/></button>
                </div>
            ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
           <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">3</span> 
           Expenses
        </h2>
        <div className="grid grid-cols-2 gap-4">
            <InputRow label="Bank Fees" value={bankFees} setter={setBankFees} />
            <InputRow label="Operational (Food/Supplies)" value={opExpenses} setter={setOpExpenses} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
           <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">4</span> 
           End of Day (Assets)
        </h2>
        <div className="grid grid-cols-2 gap-4">
            <InputRow label="GPO End" value={eodGpo} setter={setEodGpo} />
            <InputRow label="GCash End" value={eodGcash} setter={setEodGcash} />
        </div>
        <InputRow label="Actual Cash Count (Drawer)" value={eodActual} setter={setEodActual} />
      </div>

      {/* DISCREPANCY CARD - Sticky on Mobile */}
      <div className="sticky bottom-20 z-40">
          <div className={`p-4 rounded-lg shadow-lg border-2 backdrop-blur-sm bg-white/95 transition-all ${
              Math.abs(calculations.discrepancy) < 1 
              ? 'border-green-500' 
              : calculations.discrepancy < 0 ? 'border-red-500' : 'border-blue-500'
          }`}>
              <div className="flex justify-between items-end">
                  <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Discrepancy Check</p>
                      <div className={`text-2xl font-bold ${
                          Math.abs(calculations.discrepancy) < 1 ? 'text-green-600' : 'text-red-600'
                      }`}>
                          {calculations.discrepancy > 0 ? '+' : ''}{calculations.discrepancy.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                          Theo. Growth: {calculations.theoreticalGrowth.toFixed(2)} | Rec. Profit: {calculations.recordedProfit.toFixed(2)}
                      </div>
                  </div>
                  <div className="text-right">
                      {Math.abs(calculations.discrepancy) < 1 ? (
                          <div className="flex flex-col items-center text-green-600">
                             <CheckCircle size={32} />
                             <span className="text-xs font-bold">BALANCED</span>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center text-red-600">
                             <AlertTriangle size={32} />
                             <span className="text-xs font-bold">ATTENTION</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      <button
        type="submit"
        className="w-full bg-slate-900 text-white py-4 rounded-lg text-lg font-semibold shadow-md hover:bg-slate-800 transition-colors"
      >
        Submit Final Report
      </button>
    </form>
  );
};