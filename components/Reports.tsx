import React, { useState, useEffect, useMemo } from 'react';
import { User, ReportData, Store, UserRole, GeneralExpense } from '../types';
import { storageService } from '../services/storageService';
import { Eye, FileText, X, CheckCircle, AlertTriangle, Loader2, Edit2, Trash2, Wallet } from 'lucide-react';

export const Reports: React.FC<{ user: User }> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'daily-reports' | 'expense-summary' | 'sod-eod' | 'bank-transfer-fees' | 'other-transactions' | 'pos-sales'>('daily-reports');
    const [reports, setReports] = useState<ReportData[]>([]);
    const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
    const [posTransactions, setPosTransactions] = useState<any[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStoreId, setFilterStoreId] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterFeeType, setFilterFeeType] = useState<'all' | 'expense' | 'bank'>('all');
    const [categories, setCategories] = useState<string[]>([]);
    const [transactionCategories, setTransactionCategories] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    // Admin auth & edit/delete flow
    const [showAdminAuth, setShowAdminAuth] = useState(false);
    const [adminUsername, setAdminUsername] = useState('admin');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminAction, setAdminAction] = useState<'delete'|'edit'|null>(null);
    const [adminTargetReportId, setAdminTargetReportId] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editReportData, setEditReportData] = useState<Partial<ReportData> | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [allStores, allReports, allUsers, allExpenses, transCats, allPosTransactions] = await Promise.all([
                storageService.fetchStores(),
                storageService.fetchReports(),
                storageService.fetchUsers(),
                storageService.fetchGeneralExpenses(),
                storageService.fetchTransactionCategories(),
                storageService.fetchTransactions()
            ]);
            const cats = storageService.getExpenseCategories();
            setCategories(cats);
            setTransactionCategories(transCats);
            setStores(allStores);
            setUsers(allUsers);
            setGeneralExpenses(allExpenses);
            setPosTransactions(allPosTransactions);
            let filtered = allReports;
            if (user.role === UserRole.EMPLOYEE) {
                filtered = allReports.filter(r => r.storeId === user.storeId);
            }
            setReports(filtered.sort((a, b) => b.date.localeCompare(a.date)));
        } catch (error) {
            console.error("Failed to load reports:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [user.id]);

    const openAdminAuth = (reportId: string, action: 'delete'|'edit') => {
        setAdminTargetReportId(reportId);
        setAdminAction(action);
        setShowAdminAuth(true);
        setAdminPassword('');
        setAdminUsername('admin');
    };

    const confirmAdminAuth = async () => {
        if (!adminTargetReportId || !adminAction) return;
        setIsAuthenticating(true);
        try {
            const auth = await storageService.login(adminUsername, adminPassword);
            if (!auth || auth.role !== UserRole.ADMIN) throw new Error('Invalid admin credentials');
            setShowAdminAuth(false);
            if (adminAction === 'delete') {
                await storageService.deleteReport(adminTargetReportId);
                await storageService.logActivity('Delete Report', `Deleted report ID: ${adminTargetReportId}`, auth.id, auth.name);
                alert('Report deleted');
                await loadData();
            } else if (adminAction === 'edit') {
                const r = reports.find(rr => rr.id === adminTargetReportId) || null;
                if (r) {
                    setSelectedReport(r);
                    setIsEditing(true);
                    setEditReportData({ ...r });
                }
            }
        } catch (e: any) {
            alert(e.message || 'Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleDeleteFromModal = async () => {
        if (!selectedReport) return;
        if (window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            try {
                await storageService.deleteReport(selectedReport.id);
                await storageService.logActivity('Delete Report', `Deleted report ID: ${selectedReport.id}`, user.id, user.name);
                alert('Report deleted');
                setSelectedReport(null);
                setIsEditing(false);
                setEditReportData(null);
                await loadData();
            } catch (e) {
                console.error(e);
                alert('Failed to delete report');
            }
        }
    };

    const saveEditedReport = async () => {
        if (!selectedReport || !editReportData) return;
        try {
            // Helper to get value from editData or selectedReport
            const getVal = (key: string) => {
                if (editReportData && (editReportData as any)[key] !== undefined) return Number((editReportData as any)[key]);
                return Number((selectedReport as any)[key] || 0);
            };

            // 1. Recalculate Start Fund
            const sodGpo = getVal('sodGpo');
            const sodGcash = getVal('sodGcash');
            const sodPettyCash = getVal('sodPettyCash');
            const fundIn = getVal('fundIn');
            const cashAtm = getVal('cashAtm');
            const totalStartFund = sodGpo + sodGcash + sodPettyCash + fundIn + cashAtm;

            // 2. Recalculate End Assets
            const eodGpo = getVal('eodGpo');
            const eodGcash = getVal('eodGcash');
            const eodActualCash = getVal('eodActualCash');
            const totalEndAssets = eodGpo + eodGcash + eodActualCash;

            // 3. Calculate Growth & Sales
            const growth = totalEndAssets - totalStartFund;

            let legacyManualRevenue = 0;
            if ((selectedReport as any).printerRevenue) legacyManualRevenue += Number((selectedReport as any).printerRevenue);
            if ((selectedReport as any).printerServiceRevenue) legacyManualRevenue += Number((selectedReport as any).printerServiceRevenue);
            if ((selectedReport as any).serviceRevenue) legacyManualRevenue += Number((selectedReport as any).serviceRevenue);
            if ((selectedReport as any).otherSales) legacyManualRevenue += Number((selectedReport as any).otherSales);

            const currentCustomSales = (editReportData as any)?.customSales || selectedReport.customSales || [];
            const manualRevenue = currentCustomSales.reduce((a: number, b: any) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
            const posRevenue = (selectedReport.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
            const totalSalesRevenue = manualRevenue + posRevenue;

            const derivedGcashNet = growth - totalSalesRevenue;

            const notebookGcash = (editReportData as any)?.gcashNotebook !== undefined 
                ? Number((editReportData as any).gcashNotebook) 
                : (selectedReport.gcashNotebook !== undefined ? Number(selectedReport.gcashNotebook) : undefined);

            const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;

            const manualNet = currentCustomSales.reduce((a: number, b: any) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
            const posNet = (selectedReport.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
            const totalItemsNet = manualNet + posNet;

            // 4. Recalculate Expenses
            const currentExpenses = (editReportData as any)?.expenses || selectedReport.expenses || [];
            const expensesSum = currentExpenses.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

            const bankTransferFees = getVal('bankTransferFees');
            const otherTransactionFees = getVal('otherTransactionFees');
            const operationalExpenses = currentExpenses.length > 0 ? expensesSum : getVal('operationalExpenses');

            const totalExpenses = bankTransferFees + otherTransactionFees + operationalExpenses;

            // 5. Final Metrics
            const grossSalesIncome = usedGcashNet + totalItemsNet;
            const finalEodNet = grossSalesIncome - totalExpenses;
            const actualEodSales = usedGcashNet + totalSalesRevenue; // theoreticalGrowth in DB
            
            const status = Math.abs(usedGcashNet) < 1 ? 'BALANCED' : (usedGcashNet < 0 ? 'SHORTAGE' : 'SURPLUS');

            const merged: ReportData = { 
                ...selectedReport, 
                ...(editReportData as ReportData),
                // Overwrite with recalculated values
                totalStartFund,
                totalEndAssets,
                totalNetSales: totalSalesRevenue,
                totalExpenses,
                operationalExpenses,
                theoreticalGrowth: actualEodSales,
                recordedProfit: finalEodNet,
                discrepancy: usedGcashNet,
                status: status as any
            } as ReportData;

            await storageService.saveReport(merged);
            await storageService.logActivity('Update Report', `Updated report for ${getStoreName(merged.storeId)} (${merged.date})`, user.id, user.name);
            alert('Report updated');
            setIsEditing(false);
            setSelectedReport(null);
            setEditReportData(null);
            await loadData();
        } catch (e: any) {
            console.error('Failed to save report', e);
            alert('Failed to save report: ' + (e.message || e));
        }
    };

    const getStoreName = (id: string) => stores.find(s => s.id === id)?.name || 'Unknown Store';
    const getUserName = (id: string) => {
        const u = users.find(u => u.id === id);
        return u ? `${u.name} (${u.username})` : 'Unknown User';
    };

    const formatMoney = (amount: number) => `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        const addDate = (dateStr: string, itemStoreId?: string) => {
            if (filterStoreId && itemStoreId && itemStoreId !== filterStoreId) return;
            if (!dateStr) return;
            try {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    months.add(`${y}-${m}`);
                }
            } catch (e) {}
        };
        reports.forEach(r => addDate(r.date, r.storeId));
        generalExpenses.forEach(e => addDate(e.date, e.storeId));
        posTransactions.forEach(t => addDate(t.date, t.storeId));
        return Array.from(months).sort().reverse();
    }, [reports, generalExpenses, posTransactions, filterStoreId]);

    // Apply UI filters to reports
    const filteredReports = reports.filter(r => {
        if (filterStoreId && r.storeId !== filterStoreId) return false;
        if (monthFilter) {
            const d = new Date(r.date);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (mStr !== monthFilter) return false;
        }
        // Use string comparison for dates (YYYY-MM-DD) to avoid timezone issues
        if (startDate && r.date < startDate) return false;
        if (endDate && r.date > endDate) return false;
        return true;
    }).sort((a,b)=> b.date.localeCompare(a.date));

    const posCategories = useMemo(() => {
        const allCats = new Set<string>();
        reports.forEach(r => {
            if (r.posSalesDetails) {
                r.posSalesDetails.forEach(item => {
                    if (item.category) allCats.add(item.category);
                });
            }
        });
        return Array.from(allCats).sort();
    }, [reports]);

    // Filter General Expenses
    const filteredGeneralExpenses = useMemo(() => {
        return generalExpenses.filter(e => {
            if (filterStoreId && e.storeId !== filterStoreId) return false;
            if (filterCategory && e.category !== filterCategory) return false;
            if (monthFilter) {
                const d = new Date(e.date);
                const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (mStr !== monthFilter) return false;
            }
            // Use string comparison for dates (YYYY-MM-DD) to avoid timezone issues
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
            return true;
        });
    }, [generalExpenses, filterStoreId, filterCategory, monthFilter, startDate, endDate]);

    const expenseSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        filteredGeneralExpenses.forEach(e => {
            summary[e.category] = (summary[e.category] || 0) + e.amount;
        });
        return summary;
    }, [filteredGeneralExpenses]);

    const totalGeneralExpenses = Object.values(expenseSummary).reduce((a, b) => a + b, 0);

    const dailyReportTotals = useMemo(() => {
        let totalGcash = 0;
        let totalDifference = 0;

        filteredReports.forEach(report => {
            const startFund = Number(report.totalStartFund || 0);
            const endAssets = Number(report.totalEndAssets || 0);
            const growth = endAssets - startFund;
            
            let legacyManualRevenue = 0;
            if ((report as any).printerRevenue) legacyManualRevenue += Number((report as any).printerRevenue);
            if ((report as any).printerServiceRevenue) legacyManualRevenue += Number((report as any).printerServiceRevenue);
            if ((report as any).serviceRevenue) legacyManualRevenue += Number((report as any).serviceRevenue);
            if ((report as any).otherSales) legacyManualRevenue += Number((report as any).otherSales);

            const manualRevenue = (report.customSales || []).reduce((a: number, b: any) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
            const posRevenue = (report.posSalesDetails || []).reduce((a: any, b: any) => a + (Number(b.price) * Number(b.quantity)), 0);
            
            const notebookGcash = report.gcashNotebook !== undefined ? Number(report.gcashNotebook) : undefined;
            const derivedGcashNet = growth - (manualRevenue + posRevenue);
            const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;
            
            const operationalExpenses = Number(report.operationalExpenses || 0);
            const overNegative = notebookGcash !== undefined
                ? (() => {
                        const baseDifference = derivedGcashNet - notebookGcash;
                        const expenseAdjustment = baseDifference < 0 ? operationalExpenses : -operationalExpenses;
                        return baseDifference + expenseAdjustment;
                    })()
                : 0;
            
            totalGcash += usedGcashNet;
            totalDifference += overNegative;
        });

        return { totalGcash, totalDifference };
    }, [filteredReports]);

    return (
        <div className="flex flex-col gap-6 min-h-0 w-full min-w-0">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={24} className="text-blue-600"/> Reports History
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab('daily-reports')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'daily-reports' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Daily Reports
                    </button>
                    <button 
                        onClick={() => setActiveTab('sod-eod')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sod-eod' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        SOD/EOD
                    </button>
                    <button 
                        onClick={() => setActiveTab('expense-summary')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'expense-summary' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Expense Summary
                    </button>
                    <button 
                        onClick={() => setActiveTab('bank-transfer-fees')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'bank-transfer-fees' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Bank Transfer Fee/Other Expense
                    </button>
                    <button 
                        onClick={() => setActiveTab('other-transactions')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'other-transactions' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Other Transactions
                    </button>
                    <button 
                        onClick={() => setActiveTab('pos-sales')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pos-sales' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        POS Sales
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full min-w-0">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {user.role === UserRole.ADMIN && (
                            <select value={filterStoreId} onChange={e => setFilterStoreId(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900">
                                <option value="">All Branches</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}
                        {(activeTab === 'expense-summary' || activeTab === 'other-transactions' || activeTab === 'pos-sales') && (
                            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                                <option value="">All Categories</option>
                                {(() => {
                                    let options: string[] = [];
                                    if (activeTab === 'expense-summary') options = categories;
                                    else if (activeTab === 'other-transactions') options = transactionCategories;
                                    else if (activeTab === 'pos-sales') options = posCategories;
                                    return options.map(c => <option key={c} value={c}>{c}</option>);
                                })()}
                            </select>
                        )}
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white" />
                        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                            <option value="">All Months</option>
                            {availableMonths.map(m => {
                                const [y, mon] = m.split('-');
                                const date = new Date(parseInt(y), parseInt(mon) - 1);
                                const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                                return <option key={m} value={m}>{label}</option>;
                            })}
                        </select>
                        <button onClick={() => {setFilterStoreId(''); setStartDate(''); setEndDate(''); setMonthFilter(''); setFilterCategory('');}} className="text-sm text-blue-600 hover:underline">Clear</button>
                        
                        {activeTab === 'daily-reports' && (
                            <div className="flex items-center gap-3 ml-6 pl-6 border-l border-gray-200">
                                <div className="bg-blue-50 px-3 py-1.5 rounded border border-blue-100 flex flex-col items-center min-w-[120px]">
                                    <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Overall GCash</span>
                                    <span className="text-base font-bold text-blue-700">{formatMoney(dailyReportTotals.totalGcash)}</span>
                                </div>
                                <div className="bg-purple-50 px-3 py-1.5 rounded border border-purple-100 flex flex-col items-center min-w-[120px]">
                                    <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Difference</span>
                                    <span className={`text-base font-bold ${dailyReportTotals.totalDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {dailyReportTotals.totalDifference > 0 ? '+' : ''}{formatMoney(dailyReportTotals.totalDifference)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {activeTab === 'daily-reports' && (
                            <button onClick={loadData} className="text-sm text-blue-600 border border-blue-100 px-3 py-1 rounded">Refresh</button>
                        )}

                    </div>
                </div>
                
                {activeTab === 'daily-reports' && (
                <div className="overflow-x-auto overflow-y-auto min-w-0 max-h-[70vh]">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Report Date</th>
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4 text-right">GCash EOD</th>
                <th className="px-6 py-4 text-right">Toys Net EOD</th>
                <th className="px-6 py-4 text-right">Printers EOD</th>
                <th className="px-6 py-4 text-right">Expenses</th>
                <th className="px-6 py-4 text-right">Over/Negative</th>
                <th className="px-6 py-4 text-right">EOD Net Sales</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                  <tr><td colSpan={10} className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/>Loading reports...</td></tr>
              ) : filteredReports.map((report) => {
                  // Calculate values for the spreadsheet view
                  const startFund = Number(report.totalStartFund || 0);
                  const endAssets = Number(report.totalEndAssets || 0);
                  const growth = endAssets - startFund;
                  
                  let legacyManualRevenue = 0;
                  if ((report as any).printerRevenue) legacyManualRevenue += Number((report as any).printerRevenue);
                  if ((report as any).printerServiceRevenue) legacyManualRevenue += Number((report as any).printerServiceRevenue);
                  if ((report as any).serviceRevenue) legacyManualRevenue += Number((report as any).serviceRevenue);
                  if ((report as any).otherSales) legacyManualRevenue += Number((report as any).otherSales);

                  const manualRevenue = (report.customSales || []).reduce((a, b) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
                  const posRevenue = (report.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
                  const totalSalesRevenue = manualRevenue + posRevenue;
                  const derivedGcashNet = growth - totalSalesRevenue;
                  const notebookGcash = report.gcashNotebook !== undefined ? Number(report.gcashNotebook) : undefined;
                  const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;
                  
                                    // Over/Negative: Difference between System Derived GCash and Notebook Record
                                    // Operational expenses (bank fees excluded) should move the variance toward zero:
                                    //   surplus (+) -> subtract expenses
                                    //   shortage (-) -> add expenses
                                    const operationalExpenses = Number(report.operationalExpenses || 0);
                                    const rawOverNegative = notebookGcash !== undefined
                                        ? (() => {
                                                const baseDifference = derivedGcashNet - notebookGcash;
                                                const expenseAdjustment = baseDifference < 0 ? operationalExpenses : -operationalExpenses;
                                                return baseDifference + expenseAdjustment;
                                            })()
                                        : 0;
                  const overNegative = Math.abs(rawOverNegative) < 0.005 ? 0 : rawOverNegative;
                  
                  const manualNet = (report.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
                  const posNet = (report.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
                  const totalItemsNet = manualNet + posNet;
                  const totalExpenses = Number(report.bankTransferFees || 0) + Number(report.otherTransactionFees || 0) + Number(report.operationalExpenses || 0);
                  const grossSalesIncome = usedGcashNet + totalItemsNet;
                  const finalEodNet = grossSalesIncome - totalExpenses;
                  
                  return (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap">{report.date}</td>
                  <td className="px-6 py-4">{getStoreName(report.storeId)}</td>
                  <td className="px-6 py-4">{getUserName(report.userId)}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatMoney(usedGcashNet)}</td>
                  <td className="px-6 py-4 text-right">{formatMoney(posNet)}</td>
                  <td className="px-6 py-4 text-right">{formatMoney(manualNet)}</td>
                  <td className="px-6 py-4 text-right">{formatMoney(totalExpenses)}</td>
                  <td className={`px-6 py-4 text-right font-bold ${overNegative < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {overNegative < 0 ? '' : (overNegative > 0 ? '+' : '')}{formatMoney(overNegative)}
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${finalEodNet < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(finalEodNet)}</td>
                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-3">
                                        <button 
                                            onClick={() => { setSelectedReport(report); setIsEditing(false); setEditReportData(null); }}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                            title="View Report"
                                        >
                                            <Eye size={18}/>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (user.role === UserRole.EMPLOYEE) {
                                                    setSelectedReport(report);
                                                    setIsEditing(true);
                                                    setEditReportData({ ...report });
                                                } else {
                                                    openAdminAuth(report.id, 'edit');
                                                }
                                            }}
                                            className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 p-2 rounded-lg transition-colors"
                                            title="Edit Report"
                                        >
                                            <Edit2 size={18}/>
                                        </button>
                                        {user.role === UserRole.ADMIN && (
                                            <button
                                                onClick={() => openAdminAuth(report.id, 'delete')}
                                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Delete Report"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        )}
                                    </td>
                </tr>
              );
              })}
              {!isLoading && reports.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">No reports found.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-blue-50 border-t-2 border-blue-200">
              <tr className="font-bold text-gray-900">
                <td className="px-6 py-4 text-sm font-bold text-gray-700">TOTALS</td>
                <td></td>
                <td></td>
                <td className="px-6 py-4 text-right">{(() => {
                    let totalGcash = 0;
                    reports.filter(r => {
                        if (filterStoreId && r.storeId !== filterStoreId) return false;
                        if (monthFilter) {
                            const d = new Date(r.date);
                            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            if (mStr !== monthFilter) return false;
                        }
                        if (startDate && new Date(r.date) < new Date(startDate)) return false;
                        if (endDate && new Date(r.date) > new Date(endDate)) return false;
                        return true;
                    }).forEach(report => {
                        const startFund = Number(report.totalStartFund || 0);
                        const endAssets = Number(report.totalEndAssets || 0);
                        const growth = endAssets - startFund;
                        let legacyManualRevenue = 0;
                        if ((report as any).printerRevenue) legacyManualRevenue += Number((report as any).printerRevenue);
                        if ((report as any).printerServiceRevenue) legacyManualRevenue += Number((report as any).printerServiceRevenue);
                        if ((report as any).serviceRevenue) legacyManualRevenue += Number((report as any).serviceRevenue);
                        if ((report as any).otherSales) legacyManualRevenue += Number((report as any).otherSales);
                        const manualRevenue = (report.customSales || []).reduce((a, b) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
                        const posRevenue = (report.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
                        const notebookGcash = report.gcashNotebook !== undefined ? Number(report.gcashNotebook) : undefined;
                        const derivedGcashNet = growth - (manualRevenue + posRevenue);
                        const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;
                        totalGcash += usedGcashNet;
                    });
                    return formatMoney(totalGcash);
                })()}</td>
                <td className="px-6 py-4 text-right">{(() => {
                    let totalToys = 0;
                    reports.filter(r => {
                        if (filterStoreId && r.storeId !== filterStoreId) return false;
                        if (monthFilter) {
                            const d = new Date(r.date);
                            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            if (mStr !== monthFilter) return false;
                        }
                        if (startDate && new Date(r.date) < new Date(startDate)) return false;
                        if (endDate && new Date(r.date) > new Date(endDate)) return false;
                        return true;
                    }).forEach(report => {
                        const posNet = (report.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
                        totalToys += posNet;
                    });
                    return formatMoney(totalToys);
                })()}</td>
                <td className="px-6 py-4 text-right">{(() => {
                    let totalPrinters = 0;
                    reports.filter(r => {
                        if (filterStoreId && r.storeId !== filterStoreId) return false;
                        if (monthFilter) {
                            const d = new Date(r.date);
                            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            if (mStr !== monthFilter) return false;
                        }
                        if (startDate && new Date(r.date) < new Date(startDate)) return false;
                        if (endDate && new Date(r.date) > new Date(endDate)) return false;
                        return true;
                    }).forEach(report => {
                        let legacyManualRevenue = 0;
                        if ((report as any).printerRevenue) legacyManualRevenue += Number((report as any).printerRevenue);
                        if ((report as any).printerServiceRevenue) legacyManualRevenue += Number((report as any).printerServiceRevenue);
                        if ((report as any).serviceRevenue) legacyManualRevenue += Number((report as any).serviceRevenue);
                        if ((report as any).otherSales) legacyManualRevenue += Number((report as any).otherSales);
                        const manualNet = (report.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
                        totalPrinters += manualNet;
                    });
                    return formatMoney(totalPrinters);
                })()}</td>
                <td className="px-6 py-4 text-right">{(() => {
                    let totalExpenses = 0;
                    reports.filter(r => {
                        if (filterStoreId && r.storeId !== filterStoreId) return false;
                        if (monthFilter) {
                            const d = new Date(r.date);
                            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            if (mStr !== monthFilter) return false;
                        }
                        if (startDate && new Date(r.date) < new Date(startDate)) return false;
                        if (endDate && new Date(r.date) > new Date(endDate)) return false;
                        return true;
                    }).forEach(report => {
                        const totalExp = Number(report.bankTransferFees || 0) + Number(report.otherTransactionFees || 0) + Number(report.operationalExpenses || 0);
                        totalExpenses += totalExp;
                    });
                    return formatMoney(totalExpenses);
                })()}</td>
                <td className="px-6 py-4 text-right">{(() => {
                    let totalOverNeg = 0;
                    reports.filter(r => {
                        if (filterStoreId && r.storeId !== filterStoreId) return false;
                        if (monthFilter) {
                            const d = new Date(r.date);
                            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            if (mStr !== monthFilter) return false;
                        }
                        if (startDate && new Date(r.date) < new Date(startDate)) return false;
                        if (endDate && new Date(r.date) > new Date(endDate)) return false;
                        return true;
                    }).forEach(report => {
                        const startFund = Number(report.totalStartFund || 0);
                        const endAssets = Number(report.totalEndAssets || 0);
                        const growth = endAssets - startFund;
                        let legacyManualRevenue = 0;
                        if ((report as any).printerRevenue) legacyManualRevenue += Number((report as any).printerRevenue);
                        if ((report as any).printerServiceRevenue) legacyManualRevenue += Number((report as any).printerServiceRevenue);
                        if ((report as any).serviceRevenue) legacyManualRevenue += Number((report as any).serviceRevenue);
                        if ((report as any).otherSales) legacyManualRevenue += Number((report as any).otherSales);
                        const manualRevenue = (report.customSales || []).reduce((a, b) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
                        const posRevenue = (report.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
                        const notebookGcash = report.gcashNotebook !== undefined ? Number(report.gcashNotebook) : undefined;
                        const derivedGcashNet = growth - (manualRevenue + posRevenue);
                                                const operationalExpenses = Number(report.operationalExpenses || 0);
                                                const overNegative = notebookGcash !== undefined
                                                    ? (() => {
                                                            const baseDifference = derivedGcashNet - notebookGcash;
                                                            const expenseAdjustment = baseDifference < 0 ? operationalExpenses : -operationalExpenses;
                                                            return baseDifference + expenseAdjustment;
                                                        })()
                                                    : 0;
                        totalOverNeg += overNegative;
                    });
                    return <span className={totalOverNeg < 0 ? 'text-red-600' : 'text-green-600'}>{totalOverNeg < 0 ? '' : (totalOverNeg > 0 ? '+' : '')}{formatMoney(totalOverNeg)}</span>;
                })()}</td>
                <td className="px-6 py-4 text-right">{(() => {
                    let totalEodNet = 0;
                    reports.filter(r => {
                        if (filterStoreId && r.storeId !== filterStoreId) return false;
                        if (monthFilter) {
                            const d = new Date(r.date);
                            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            if (mStr !== monthFilter) return false;
                        }
                        if (startDate && new Date(r.date) < new Date(startDate)) return false;
                        if (endDate && new Date(r.date) > new Date(endDate)) return false;
                        return true;
                    }).forEach(report => {
                        const startFund = Number(report.totalStartFund || 0);
                        const endAssets = Number(report.totalEndAssets || 0);
                        const growth = endAssets - startFund;
                        let legacyManualRevenue = 0;
                        if ((report as any).printerRevenue) legacyManualRevenue += Number((report as any).printerRevenue);
                        if ((report as any).printerServiceRevenue) legacyManualRevenue += Number((report as any).printerServiceRevenue);
                        if ((report as any).serviceRevenue) legacyManualRevenue += Number((report as any).serviceRevenue);
                        if ((report as any).otherSales) legacyManualRevenue += Number((report as any).otherSales);
                        const manualRevenue = (report.customSales || []).reduce((a, b) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
                        const posRevenue = (report.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
                        const notebookGcash = report.gcashNotebook !== undefined ? Number(report.gcashNotebook) : undefined;
                        const derivedGcashNet = growth - (manualRevenue + posRevenue);
                        const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;
                        const manualNet = (report.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
                        const posNet = (report.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
                        const totalItemsNet = manualNet + posNet;
                        const totalExp = Number(report.bankTransferFees || 0) + Number(report.otherTransactionFees || 0) + Number(report.operationalExpenses || 0);
                        const grossSalesIncome = usedGcashNet + totalItemsNet;
                        const finalEodNet = grossSalesIncome - totalExp;
                        totalEodNet += finalEodNet;
                    });
                    return <span className={totalEodNet < 0 ? 'text-red-600' : 'text-green-700'}>{formatMoney(totalEodNet)}</span>;
                })()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}

        {activeTab === 'sod-eod' && (
            <div className="overflow-x-auto overflow-y-auto min-w-0 max-h-[70vh]">
                <table className="w-full min-w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Report Date</th>
                            <th className="px-6 py-4">Store</th>
                            <th className="px-6 py-4 text-right bg-blue-50">GPO Start</th>
                            <th className="px-6 py-4 text-right bg-blue-50">GCash Start</th>
                            <th className="px-6 py-4 text-right bg-blue-50">Petty Cash</th>
                            <th className="px-6 py-4 text-right bg-blue-50">Add. Fund-in</th>
                            <th className="px-6 py-4 text-right bg-blue-50">Add. Cash (ATM)</th>
                            <th className="px-6 py-4 text-right bg-blue-100 font-bold">Total Start</th>
                            <th className="px-6 py-4 text-right bg-green-50">GPO End</th>
                            <th className="px-6 py-4 text-right bg-green-50">GCash End</th>
                            <th className="px-6 py-4 text-right bg-green-50">Actual Cash</th>
                            <th className="px-6 py-4 text-right bg-green-100 font-bold">Total End</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={12} className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/>Loading reports...</td></tr>
                        ) : filteredReports.map((report) => (
                            <tr key={report.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                                <td className="px-6 py-4 whitespace-nowrap">{report.date}</td>
                                <td className="px-6 py-4">{getStoreName(report.storeId)}</td>
                                <td className="px-6 py-4 text-right bg-blue-50/30">{formatMoney(Number(report.sodGpo || 0))}</td>
                                <td className="px-6 py-4 text-right bg-blue-50/30">{formatMoney(Number(report.sodGcash || 0))}</td>
                                <td className="px-6 py-4 text-right bg-blue-50/30">{formatMoney(Number(report.sodPettyCash || 0))}</td>
                                <td className="px-6 py-4 text-right bg-blue-50/30">{formatMoney(Number(report.fundIn || 0))}</td>
                                <td className="px-6 py-4 text-right bg-blue-50/30">{formatMoney(Number(report.cashAtm || 0))}</td>
                                <td className="px-6 py-4 text-right font-bold bg-blue-100/30">{formatMoney(Number(report.totalStartFund || 0))}</td>
                                <td className="px-6 py-4 text-right bg-green-50/30">{formatMoney(Number(report.eodGpo || 0))}</td>
                                <td className="px-6 py-4 text-right bg-green-50/30">{formatMoney(Number(report.eodGcash || 0))}</td>
                                <td className="px-6 py-4 text-right bg-green-50/30">{formatMoney(Number(report.eodActualCash || 0))}</td>
                                <td className="px-6 py-4 text-right font-bold bg-green-100/30">{formatMoney(Number(report.totalEndAssets || 0))}</td>
                            </tr>
                        ))}
                        {!isLoading && filteredReports.length === 0 && (
                            <tr><td colSpan={12} className="p-8 text-center text-gray-400">No reports found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'expense-summary' && (
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex flex-col">
                        <div className="text-sm text-red-600 font-medium mb-1">Total Expenses</div>
                        <div className="text-2xl font-bold text-red-600">{formatMoney(totalGeneralExpenses)}</div>
                    </div>
                    {Object.entries(expenseSummary).map(([category, amount]) => (
                        <div key={category} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-sm text-gray-600 font-medium mb-1">{category}</div>
                            <div className="text-2xl font-bold text-gray-900">{formatMoney(amount)}</div>
                        </div>
                    ))}
                </div>

                <h3 className="font-bold text-gray-800 mb-4">Expense Details</h3>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Store</th>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredGeneralExpenses.length === 0 ? (
                                <tr><td colSpan={5} className="p-6 text-center text-gray-500">No expenses found.</td></tr>
                            ) : (
                                filteredGeneralExpenses.map(e => (
                                    <tr key={e.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{getStoreName(e.storeId)}</td>
                                        <td className="px-6 py-4">{e.category}</td>
                                        <td className="px-6 py-4">{e.description}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatMoney(e.amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'bank-transfer-fees' && (() => {
            const feeData = filteredReports.flatMap(r => {
                const items = [];
                if ((filterFeeType === 'all' || filterFeeType === 'bank') && (Number(r.bankTransferFees) || 0) > 0) {
                    items.push({
                        id: r.id + '-bank',
                        date: r.date,
                        storeId: r.storeId,
                        type: 'Bank Transfer Fee',
                        description: 'Bank Transfer Fee',
                        amount: Number(r.bankTransferFees)
                    });
                }
                
                if (filterFeeType === 'all' || filterFeeType === 'expense') {
                    if (r.expenses && r.expenses.length > 0) {
                        r.expenses.forEach((exp, idx) => {
                            items.push({
                                id: r.id + '-exp-' + idx,
                                date: r.date,
                                storeId: r.storeId,
                                type: 'Other Expense',
                                description: exp.description || 'Other Expense',
                                amount: Number(exp.amount)
                            });
                        });
                    } else if ((Number(r.operationalExpenses) || 0) > 0) {
                        // Legacy support for reports without detailed expenses array
                        items.push({
                            id: r.id + '-exp-legacy',
                            date: r.date,
                            storeId: r.storeId,
                            type: 'Other Expense',
                            description: r.operationalExpensesNote || 'Other Expense',
                            amount: Number(r.operationalExpenses)
                        });
                    }
                }
                return items;
            });

            const totalFees = feeData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            return (
            <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                     <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 flex flex-col min-w-[200px]">
                        <div className="text-sm text-black font-medium mb-1">Total Fees & Expenses</div>
                        <div className="text-2xl font-bold text-black">{formatMoney(totalFees)}</div>
                    </div>
                     <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Filter Type:</label>
                        <select 
                            value={filterFeeType} 
                            onChange={e => setFilterFeeType(e.target.value as any)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                        >
                            <option value="all">All Fees & Expenses</option>
                            <option value="bank">Bank Transfer Fees</option>
                            <option value="expense">Other Expenses</option>
                        </select>
                     </div>
                </div>

                <h3 className="font-bold text-gray-800 mb-4">Fee & Expense Details</h3>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Store</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {feeData.length === 0 ? (
                                <tr><td colSpan={5} className="p-6 text-center text-gray-500">No fees or expenses found.</td></tr>
                            ) : (
                                feeData.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            {(!item.date || isNaN(new Date(item.date).getTime())) 
                                                ? '-' 
                                                : new Date(item.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">{getStoreName(item.storeId)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${item.type === 'Other Expense' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{item.description}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatMoney(Number(item.amount) || 0)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            );
        })()}

        {activeTab === 'other-transactions' && (() => {
            const transactions: any[] = [];
            filteredReports.forEach(r => {
                if (r.customSales) {
                    r.customSales.forEach((s: any) => {
                        if (filterCategory && s.category !== filterCategory) return;
                        transactions.push({
                            ...s,
                            date: r.date,
                            storeId: r.storeId,
                            reportId: r.id
                        });
                    });
                }
            });
            
            // Sort by date desc
            transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            const totalCost = transactions.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
            const totalNet = totalAmount - totalCost;

            return (
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col">
                            <div className="text-sm text-blue-600 font-medium mb-1">Total Sales</div>
                            <div className="text-2xl font-bold text-blue-600">{formatMoney(totalAmount)}</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex flex-col">
                            <div className="text-sm text-orange-600 font-medium mb-1">Total Cost</div>
                            <div className="text-2xl font-bold text-orange-600">{formatMoney(totalCost)}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex flex-col">
                            <div className="text-sm text-green-600 font-medium mb-1">Total Net Income</div>
                            <div className="text-2xl font-bold text-green-600">{formatMoney(totalNet)}</div>
                        </div>
                    </div>

                    <h3 className="font-bold text-gray-800 mb-4">Transaction Details</h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Store</th>
                                    <th className="px-6 py-3">Category</th>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                    <th className="px-6 py-3 text-right">Cost</th>
                                    <th className="px-6 py-3 text-right">Net</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.length === 0 ? (
                                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">No transactions found.</td></tr>
                                ) : (
                                    transactions.map((t, i) => (
                                        <tr key={`${t.reportId}-${t.id}-${i}`} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">{getStoreName(t.storeId)}</td>
                                            <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">{t.category}</span></td>
                                            <td className="px-6 py-4">{t.name}</td>
                                            <td className="px-6 py-4 text-right font-medium">{formatMoney(Number(t.amount))}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">{formatMoney(Number(t.cost))}</td>
                                            <td className="px-6 py-4 text-right font-bold text-green-600">{formatMoney(Number(t.amount) - Number(t.cost))}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        })()}

        {activeTab === 'pos-sales' && (() => {
            const posItems: any[] = [];
            
            // Filter transactions based on current filters
            const filteredTransactions = posTransactions.filter(t => {
                if (t.status === 'VOIDED') return false;
                if (filterStoreId && t.storeId !== filterStoreId) return false;
                if (monthFilter) {
                    const d = new Date(t.date);
                    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    if (mStr !== monthFilter) return false;
                }
                // Use string comparison for dates (YYYY-MM-DD) to avoid timezone issues
                if (startDate && t.date < startDate) return false;
                if (endDate && t.date > endDate) return false;
                return true;
            });

            filteredTransactions.forEach(t => {
                if (t.items) {
                    t.items.forEach((item: any) => {
                        if (filterCategory && item.category !== filterCategory) return;
                        posItems.push({
                            ...item,
                            date: t.date,
                            storeId: t.storeId,
                            reportId: t.reportId || t.id // Use transaction ID if report ID is missing
                        });
                    });
                }
            });
            
            // Sort by date desc
            posItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const totalSales = posItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
            const totalCost = posItems.reduce((sum, item) => sum + (Number(item.cost) * Number(item.quantity)), 0);
            const totalNet = totalSales - totalCost;
            const totalItems = posItems.reduce((sum, item) => sum + Number(item.quantity), 0);

            return (
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col">
                            <div className="text-sm text-blue-600 font-medium mb-1">Total Sales</div>
                            <div className="text-2xl font-bold text-blue-600">{formatMoney(totalSales)}</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex flex-col">
                            <div className="text-sm text-orange-600 font-medium mb-1">Total Cost</div>
                            <div className="text-2xl font-bold text-orange-600">{formatMoney(totalCost)}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex flex-col">
                            <div className="text-sm text-green-600 font-medium mb-1">Total Net Income</div>
                            <div className="text-2xl font-bold text-green-600">{formatMoney(totalNet)}</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 flex flex-col">
                            <div className="text-sm text-purple-600 font-medium mb-1">Items Sold</div>
                            <div className="text-2xl font-bold text-purple-600">{totalItems.toLocaleString()}</div>
                        </div>
                    </div>

                    <h3 className="font-bold text-gray-800 mb-4">POS Sales Details</h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Store</th>
                                    <th className="px-6 py-3">Category</th>
                                    <th className="px-6 py-3">Item Name</th>
                                    <th className="px-6 py-3 text-right">Price</th>
                                    <th className="px-6 py-3 text-right">Cost</th>
                                    <th className="px-6 py-3 text-right">Qty</th>
                                    <th className="px-6 py-3 text-right">Net</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {posItems.length === 0 ? (
                                    <tr><td colSpan={8} className="p-6 text-center text-gray-500">No POS sales found.</td></tr>
                                ) : (
                                    posItems.map((item, i) => {
                                        const sales = Number(item.price) * Number(item.quantity);
                                        const cost = Number(item.cost) * Number(item.quantity);
                                        const net = sales - cost;
                                        return (
                                        <tr key={`${item.reportId}-${item.id}-${i}`} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{new Date(item.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">{getStoreName(item.storeId)}</td>
                                            <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">{item.category || '-'}</span></td>
                                            <td className="px-6 py-4">{item.name}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">{formatMoney(Number(item.price))}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">{formatMoney(Number(item.cost))}</td>
                                            <td className="px-6 py-4 text-right font-medium">{item.quantity}</td>
                                            <td className="px-6 py-4 text-right font-bold text-green-600">{formatMoney(net)}</td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        })()}
      </div>

      {/* DETAILED BREAKDOWN MODAL */}
      {selectedReport && (() => {
          // Use edited data if in editing mode, otherwise use original report data
          const reportData = isEditing && editReportData ? editReportData : selectedReport;
          
          const startFund = Number((isEditing && editReportData) ? 
            ((Number((editReportData as any).sodGpo || selectedReport.sodGpo || 0) + 
              Number((editReportData as any).sodGcash || selectedReport.sodGcash || 0) + 
              Number((editReportData as any).sodPettyCash || selectedReport.sodPettyCash || 0) +
              Number((editReportData as any).fundIn || selectedReport.fundIn || 0) +
              Number((editReportData as any).cashAtm || selectedReport.cashAtm || 0))) 
            : selectedReport.totalStartFund);
          
          const endAssets = Number((isEditing && editReportData) ?
            ((Number((editReportData as any).eodGpo || selectedReport.eodGpo || 0) + 
              Number((editReportData as any).eodGcash || selectedReport.eodGcash || 0) + 
              Number((editReportData as any).eodActualCash || selectedReport.eodActualCash || 0)))
            : selectedReport.totalEndAssets);
          
          const growth = endAssets - startFund;
          
          let legacyManualRevenue = 0;
          if ((selectedReport as any).printerRevenue) legacyManualRevenue += Number((selectedReport as any).printerRevenue);
          if ((selectedReport as any).printerServiceRevenue) legacyManualRevenue += Number((selectedReport as any).printerServiceRevenue);
          if ((selectedReport as any).serviceRevenue) legacyManualRevenue += Number((selectedReport as any).serviceRevenue);
          if ((selectedReport as any).otherSales) legacyManualRevenue += Number((selectedReport as any).otherSales);

          const currentCustomSales = (isEditing && (editReportData as any)?.customSales)
              ? (editReportData as any).customSales
              : (selectedReport.customSales || []);

          const manualRevenue = currentCustomSales.reduce((a: number, b: any) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
          const posRevenue = (selectedReport.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
                    const totalSalesRevenue = manualRevenue + posRevenue;
                    const derivedGcashNet = growth - totalSalesRevenue;
                    const notebookGcash = (isEditing && editReportData && (editReportData as any).gcashNotebook !== undefined)
                        ? Number((editReportData as any).gcashNotebook)
                        : (selectedReport.gcashNotebook !== undefined ? Number(selectedReport.gcashNotebook) : undefined);
                    const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;
          const manualNet = currentCustomSales.reduce((a: number, b: any) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
          const posNet = (selectedReport.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
          const totalItemsNet = manualNet + posNet;

          const currentExpenses = (isEditing && (editReportData as any)?.expenses) 
              ? (editReportData as any).expenses 
              : (selectedReport.expenses || []);
          const expensesSum = currentExpenses.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

          const totalExpenses = Number((isEditing && editReportData && (editReportData as any).bankTransferFees !== undefined) ? (editReportData as any).bankTransferFees : (selectedReport.bankTransferFees || 0)) + 
                                Number((isEditing && editReportData && (editReportData as any).otherTransactionFees !== undefined) ? (editReportData as any).otherTransactionFees : (selectedReport.otherTransactionFees || 0)) +
                                (currentExpenses.length > 0 ? expensesSum : Number((isEditing && editReportData && (editReportData as any).operationalExpenses !== undefined) ? (editReportData as any).operationalExpenses : (selectedReport.operationalExpenses || 0)));
          
          const grossSalesIncome = usedGcashNet + totalItemsNet;
          const finalEodNet = grossSalesIncome - totalExpenses;
          const actualEodSales = usedGcashNet + totalSalesRevenue;
          
                    // Difference Calculation: (System Derived - Notebook) adjusted by Operational Expenses (bank fees excluded)
                    // Operational expenses should move the variance toward zero.
          const operationalExpenses = currentExpenses.length > 0 ? expensesSum : Number((isEditing && editReportData && (editReportData as any).operationalExpenses !== undefined) ? (editReportData as any).operationalExpenses : (selectedReport.operationalExpenses || 0));
                    const rawDifference = notebookGcash !== undefined
                        ? (() => {
                                const baseDifference = derivedGcashNet - notebookGcash;
                                const expenseAdjustment = baseDifference < 0 ? operationalExpenses : -operationalExpenses;
                                return baseDifference + expenseAdjustment;
                            })()
                        : 0;
          const difference = Math.abs(rawDifference) < 0.005 ? 0 : rawDifference;

          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 rounded-t-xl shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Report Breakdown</h3>
                    <p className="text-sm text-gray-500">
                        {selectedReport.date} • {getStoreName(selectedReport.storeId)} • <span className="font-medium text-gray-700">{getUserName(selectedReport.userId)}</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <>
                            <button onClick={handleDeleteFromModal} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"><Trash2 size={16}/> Delete</button>
                            <button onClick={() => { setIsEditing(false); setEditReportData(null); }} className="px-3 py-1 bg-gray-100 rounded">Cancel</button>
                            <button onClick={saveEditedReport} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                        </>
                    ) : null}
                    <button onClick={() => { setSelectedReport(null); setIsEditing(false); setEditReportData(null); }} className="text-gray-400 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-8 flex-1 min-h-0">
                    {/* 1. Start of Day */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-2">1. Start of Day (SOD)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">GPO Start</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.sodGpo ?? Number(selectedReport.sodGpo || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), sodGpo: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodGpo))}</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">GCash Start</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.sodGcash ?? Number(selectedReport.sodGcash || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), sodGcash: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodGcash))}</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">Petty Cash</span>
                                {isEditing ? (
                                    <>
                                    <input type="number" value={(editReportData as any)?.sodPettyCash ?? Number(selectedReport.sodPettyCash || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), sodPettyCash: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                    <input type="text" value={(editReportData as any)?.sodPettyCashNote ?? selectedReport.sodPettyCashNote ?? ''} onChange={e => setEditReportData(prev => ({ ...(prev||{}), sodPettyCashNote: e.target.value }))} className="w-full mt-1 text-xs border border-gray-300 rounded px-2 py-1" placeholder="Note" />
                                    </>
                                ) : (
                                    <>
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodPettyCash))}</span>
                                    {selectedReport.sodPettyCashNote && <div className="text-xs text-gray-500 mt-1 italic">{selectedReport.sodPettyCashNote}</div>}
                                    </>
                                )}
                            </div>
                            {/* New Fields */}
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">Add. Fund-in</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.fundIn ?? Number(selectedReport.fundIn || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), fundIn: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.fundIn || 0))}</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">Add. Cash (ATM)</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.cashAtm ?? Number(selectedReport.cashAtm || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), cashAtm: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.cashAtm || 0))}</span>
                                )}
                            </div>

                            <div className="col-span-2 md:col-span-5 text-right pt-2 border-t border-gray-200">
                                <span className="text-sm text-gray-600 mr-2">Total Start Fund:</span>
                                <span className="font-bold text-lg text-gray-900">{formatMoney(startFund)}</span>
                            </div>
                        </div>
                    </section>

                    {/* 2. End of Day Assets */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-2">2. End of Day (Assets)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg">
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">GPO End</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.eodGpo ?? Number(selectedReport.eodGpo || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), eodGpo: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.eodGpo))}</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">GCash End</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.eodGcash ?? Number(selectedReport.eodGcash || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), eodGcash: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.eodGcash))}</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-xs text-gray-600 mb-1">Actual Cash Count</span>
                                {isEditing ? (
                                    <input type="number" value={(editReportData as any)?.eodActualCash ?? Number(selectedReport.eodActualCash || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), eodActualCash: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.eodActualCash))}</span>
                                )}
                            </div>
                            <div className="col-span-2 md:col-span-3 text-right pt-2 border-t border-blue-200">
                                <span className="text-sm text-gray-600 mr-2">Total End Assets:</span>
                                <span className="font-bold text-lg text-gray-900">{formatMoney(endAssets)}</span>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        
                        {/* LEFT COLUMN: SALES & NET SALES */}
                        <div className="flex flex-col gap-6 h-full">
                            <div className="border border-gray-200 rounded-lg overflow-hidden text-sm flex flex-col flex-1">
                                <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-200 shrink-0">SALES (MARGINS)</div>
                                <div className="flex-1 bg-white">
                                <table className="w-full">
                                    <tbody className="divide-y divide-gray-100">
                                        
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700 font-medium">GCash Net <span className="text-xs font-normal text-gray-400">(Derived)</span></td>
                                            <td className={`p-2 pr-3 text-right font-mono font-bold ${notebookGcash !== undefined ? 'text-gray-400 line-through' : (derivedGcashNet < 0 ? 'text-red-600' : 'text-green-600')}`}>
                                                {formatMoney(derivedGcashNet)}
                                            </td>
                                        </tr>

                                        {(notebookGcash !== undefined || isEditing) && (
                                             <tr className="bg-purple-50">
                                                <td className="p-2 pl-3 text-purple-900 font-bold">GCash Net <span className="text-xs font-normal text-purple-600">(Notebook)</span></td>
                                                <td className="p-2 pr-3 text-right font-mono font-bold text-purple-900">
                                                    {isEditing ? (
                                                        <input type="number" value={(editReportData as any)?.gcashNotebook ?? notebookGcash ?? ''} onChange={e => setEditReportData(prev => ({ ...(prev||{}), gcashNotebook: Number(e.target.value) }))} className="w-28 text-right border border-gray-300 rounded px-2 py-1" placeholder="0.00" />
                                                    ) : (
                                                        formatMoney(notebookGcash!)
                                                    )}
                                                </td>
                                            </tr>
                                        )}

                                        {/* NEW DIFFERENCE ROW */}
                                        {(notebookGcash !== undefined || isEditing) && (
                                            <tr className={`${difference > 0 ? 'bg-green-50' : (difference < 0 ? 'bg-red-50' : 'bg-gray-50')}`}>
                                                <td className="p-2 pl-3 font-bold text-gray-700">Difference <span className="text-xs font-normal text-gray-400">(Sys - Note)</span></td>
                                                <td className={`p-2 pr-3 text-right font-bold font-mono ${difference > 0 ? 'text-green-600' : (difference < 0 ? 'text-red-600' : 'text-gray-600')}`}>
                                                    {difference > 0 ? '+' : ''}{formatMoney(difference)}
                                                </td>
                                            </tr>
                                        )}

                                        {selectedReport.posSalesDetails && selectedReport.posSalesDetails.map((item: any, i: number) => (
                                            <tr key={`pos-${i}`} className="bg-white">
                                                <td className="p-2 pl-3 text-gray-700 pl-6">
                                                    {item.name} <span className="text-xs text-gray-400">(x{item.quantity} Net)</span>
                                                </td>
                                                <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                    {formatMoney((Number(item.price) - Number(item.cost)) * Number(item.quantity))}
                                                </td>
                                            </tr>
                                        ))}

                                        {isEditing && currentCustomSales.length > 0 && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={2} className="p-2">
                                                    <div className="flex gap-1 text-xs font-bold text-gray-500 px-1">
                                                        <div className="flex-1">Description</div>
                                                        <div className="w-20">Category</div>
                                                        <div className="w-14 text-right">Cost</div>
                                                        <div className="w-16 text-right">Price</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {currentCustomSales.map((s: any, i: number) => (
                                            <tr key={`manual-${i}`} className="bg-white">
                                                {isEditing ? (
                                                    <td colSpan={2} className="p-2">
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="text" 
                                                                value={s.name} 
                                                                onChange={e => {
                                                                    const newSales = currentCustomSales.map((item: any, idx: number) => idx === i ? { ...item, name: e.target.value } : item);
                                                                    setEditReportData(prev => ({ ...(prev||{}), customSales: newSales }));
                                                                }}
                                                                className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-2 py-1"
                                                                placeholder="Description"
                                                            />
                                                            <input 
                                                                type="text" 
                                                                value={s.category || ''} 
                                                                onChange={e => {
                                                                    const newSales = currentCustomSales.map((item: any, idx: number) => idx === i ? { ...item, category: e.target.value } : item);
                                                                    setEditReportData(prev => ({ ...(prev||{}), customSales: newSales }));
                                                                }}
                                                                className="w-20 text-xs border border-gray-300 rounded px-2 py-1"
                                                                placeholder="Category"
                                                            />
                                                            <input 
                                                                type="number" 
                                                                value={s.cost || 0} 
                                                                onChange={e => {
                                                                    const newSales = currentCustomSales.map((item: any, idx: number) => idx === i ? { ...item, cost: Number(e.target.value) } : item);
                                                                    setEditReportData(prev => ({ ...(prev||{}), customSales: newSales }));
                                                                }}
                                                                className="w-14 text-xs border border-gray-300 rounded px-2 py-1 text-right"
                                                                placeholder="Cost"
                                                            />
                                                            <input 
                                                                type="number" 
                                                                value={s.amount || 0} 
                                                                onChange={e => {
                                                                    const newSales = currentCustomSales.map((item: any, idx: number) => idx === i ? { ...item, amount: Number(e.target.value) } : item);
                                                                    setEditReportData(prev => ({ ...(prev||{}), customSales: newSales }));
                                                                }}
                                                                className="w-16 text-xs border border-gray-300 rounded px-2 py-1 text-right"
                                                                placeholder="Price"
                                                            />
                                                        </div>
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td className="p-2 pl-3 text-gray-700 pl-6">
                                                            {s.name} 
                                                            {s.category && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{s.category}</span>}
                                                            <span className="text-xs text-gray-400 ml-1">(Net)</span>
                                                        </td>
                                                        <td className="p-2 pr-3 text-right font-mono text-gray-900 align-top">
                                                            {formatMoney((Number(s.amount) || 0) - (Number(s.cost) || 0))}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}

                                        {legacyManualRevenue > 0 && (
                                            <tr className="bg-white">
                                                <td className="p-2 pl-3 text-gray-700 pl-6">Legacy Services/Print/Others <span className="text-xs text-gray-400">(Auto-detected)</span></td>
                                                <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                    {formatMoney(legacyManualRevenue)}
                                                </td>
                                            </tr>
                                        )}
                                        
                                        <tr className="bg-gray-50 border-t border-gray-200">
                                            <td className="p-2 pl-3 font-bold text-gray-700">Gross Sales Income</td>
                                            <td className="p-2 pr-3 text-right font-bold font-mono text-gray-900">{formatMoney(grossSalesIncome)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            {/* EOD NET SALES CARD */}
                            <div className="bg-blue-600 rounded-lg p-4 text-white shadow-md">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="text-sm font-bold uppercase tracking-wider">EOD Net Sales</div>
                                    <div className="text-xl font-bold font-mono">{formatMoney(finalEodNet)}</div>
                                </div>
                                <div className="text-right text-xs opacity-70">
                                    (Gross Sales Income - Total Expenses)
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: EXPENSES & ACTUALS */}
                        <div className="flex flex-col gap-6 h-full">
                            <div className="border border-gray-200 rounded-lg overflow-hidden text-sm flex flex-col flex-1">
                                <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-200 shrink-0">EXPENSES</div>
                                <div className="flex-1 bg-white">
                                <table className="w-full">
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">Bank Transfer Fees</td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                {isEditing ? (
                                                    <input type="number" value={(editReportData as any)?.bankTransferFees ?? selectedReport.bankTransferFees ?? 0} onChange={e => setEditReportData(prev => ({ ...(prev||{}), bankTransferFees: Number(e.target.value) }))} className="w-24 text-right border border-gray-300 rounded px-2 py-1" />
                                                ) : (
                                                    formatMoney(Number(selectedReport.bankTransferFees) || 0)
                                                )}
                                            </td>
                                        </tr>
                                        {/* Conditionally show Other Transaction Fees if it exists (Legacy) */}
                                        {(Number(selectedReport.otherTransactionFees) > 0 || (isEditing && (editReportData as any)?.otherTransactionFees > 0)) && (
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">Other Transaction Fees <span className="text-xs text-gray-400">(Legacy)</span></td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                {isEditing ? (
                                                    <input type="number" value={(editReportData as any)?.otherTransactionFees ?? selectedReport.otherTransactionFees ?? 0} onChange={e => setEditReportData(prev => ({ ...(prev||{}), otherTransactionFees: Number(e.target.value) }))} className="w-24 text-right border border-gray-300 rounded px-2 py-1" />
                                                ) : (
                                                    formatMoney(Number(selectedReport.otherTransactionFees) || 0)
                                                )}
                                            </td>
                                        </tr>
                                        )}
                                        {currentExpenses.length > 0 ? (
                                            currentExpenses.map((exp: any, i: number) => (
                                                <tr key={`exp-${i}`} className="bg-white">
                                                    <td className="p-2 pl-3 text-gray-700">
                                                        <div className="font-medium">Other Expense</div>
                                                        {isEditing ? (
                                                            <input 
                                                                type="text" 
                                                                value={exp.description} 
                                                                onChange={e => {
                                                                    const newExpenses = currentExpenses.map((item: any, idx: number) => idx === i ? { ...item, description: e.target.value } : item);
                                                                    setEditReportData(prev => ({ ...(prev||{}), expenses: newExpenses }));
                                                                }}
                                                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 mt-0.5"
                                                                placeholder="Description"
                                                            />
                                                        ) : (
                                                            <div className="text-xs text-gray-600 mt-0.5">{exp.description}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                        {isEditing ? (
                                                            <input 
                                                                type="number" 
                                                                value={exp.amount} 
                                                                onChange={e => {
                                                                    const newExpenses = currentExpenses.map((item: any, idx: number) => idx === i ? { ...item, amount: Number(e.target.value) } : item);
                                                                    setEditReportData(prev => ({ ...(prev||{}), expenses: newExpenses }));
                                                                }}
                                                                className="w-24 text-right border border-gray-300 rounded px-2 py-1"
                                                            />
                                                        ) : (
                                                            formatMoney(Number(exp.amount))
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">
                                                <div className="font-medium">Other Expenses</div>
                                                {selectedReport.operationalExpensesNote && (
                                                    <div className="text-xs text-gray-600 mt-0.5">
                                                        {selectedReport.operationalExpensesNote}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                {isEditing ? (
                                                    <input type="number" value={(editReportData as any)?.operationalExpenses ?? selectedReport.operationalExpenses ?? 0} onChange={e => setEditReportData(prev => ({ ...(prev||{}), operationalExpenses: Number(e.target.value) }))} className="w-24 text-right border border-gray-300 rounded px-2 py-1" />
                                                ) : (
                                                    formatMoney(Number(selectedReport.operationalExpenses) || 0)
                                                )}
                                            </td>
                                        </tr>
                                        )}
                                        <tr className="bg-gray-50 border-t border-gray-200">
                                            <td className="p-2 pl-3 font-bold text-gray-700">Total Expenses</td>
                                            <td className="p-2 pr-3 text-right font-bold font-mono text-gray-900">{formatMoney(totalExpenses)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                </div>
                            </div>

                             {/* ACTUAL EOD SALES BREAKDOWN */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                                <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-200">ACTUAL EOD SALES</div>
                                <table className="w-full">
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">GCash Net <span className="text-xs text-gray-400">({notebookGcash !== undefined ? 'Notebook' : 'Derived'})</span></td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">{formatMoney(usedGcashNet)}</td>
                                        </tr>
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">POS Sales <span className="text-xs text-gray-400">(Total Price)</span></td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">{formatMoney(posRevenue)}</td>
                                        </tr>
                                         <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">Other Sales <span className="text-xs text-gray-400">(Total Amount)</span></td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">{formatMoney(manualRevenue)}</td>
                                        </tr>
                                        <tr className="bg-slate-100 border-t border-gray-200">
                                            <td className="p-2 pl-3 font-bold text-slate-900">Actual EOD Sales</td>
                                            <td className="p-2 pr-3 text-right font-bold font-mono text-slate-900">{formatMoney(actualEodSales)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl text-right shrink-0">
                    <button onClick={() => setSelectedReport(null)} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded transition-colors">
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
      })()}

      {/* ADMIN AUTH MODAL */}
      {showAdminAuth && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Admin Authentication Required</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Please enter admin credentials to {adminAction} this report.
                </p>
                <form onSubmit={(e) => { e.preventDefault(); confirmAdminAuth(); }}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input 
                                type="text" 
                                value={adminUsername} 
                                onChange={e => setAdminUsername(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        confirmAdminAuth();
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input 
                                type="password" 
                                autoFocus
                                value={adminPassword} 
                                onChange={e => setAdminPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        confirmAdminAuth();
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            type="button"
                            onClick={() => setShowAdminAuth(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isAuthenticating}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isAuthenticating ? 'Verifying...' : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
    );
};