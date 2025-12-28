import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, ReportData, Store, GeneralExpense } from '../types';
import { storageService } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2, CreditCard, Wallet, FileText, Calendar, Filter } from 'lucide-react';

const calculateReportMetrics = (report: ReportData) => {
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
    
    const manualNet = (report.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
    const posNet = (report.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
    const totalItemsNet = manualNet + posNet;
    
    const totalExpenses = Number(report.bankTransferFees || 0) + Number(report.otherTransactionFees || 0) + Number(report.operationalExpenses || 0);
    
    const grossSalesIncome = usedGcashNet + totalItemsNet;
    const finalEodNet = grossSalesIncome - totalExpenses;
    
    const actualEodSales = usedGcashNet + totalSalesRevenue; 

    return {
        netSales: finalEodNet,
        grossSales: actualEodSales
    };
};

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [filterType, setFilterType] = useState<'month' | 'range' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedYearOnly, setSelectedYearOnly] = useState(currentYear);
  // Date Range State
  const [startDate, setStartDate] = useState(new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses' | 'fundin'>('sales');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = Array.from({length: 5}, (_, i) => currentYear - i);

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [allStores, allReports, allExpenses] = await Promise.all([
                storageService.fetchStores(),
                storageService.fetchReports(),
                storageService.fetchGeneralExpenses()
            ]);
            setStores(allStores);
            setReports(allReports);
            setGeneralExpenses(allExpenses);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, []);

  const filteredReports = useMemo(() => {
    let data = reports;
    // CRITICAL: Filter data for non-admin users
    if (user.role !== UserRole.ADMIN && user.storeId) {
      data = reports.filter(r => r.storeId === user.storeId);
    }
    return data.sort((a, b) => b.timestamp - a.timestamp);
  }, [reports, user]);

  const validExpenses = useMemo(() => {
    let data = generalExpenses.filter(e => e.category !== 'GPO Fund-in');
    if (user.role !== UserRole.ADMIN && user.storeId) {
      data = data.filter(e => e.storeId === user.storeId);
    }
    return data;
  }, [generalExpenses, user]);

  const fundInTransactions = useMemo(() => {
    let data = generalExpenses.filter(e => e.category === 'GPO Fund-in');
    if (user.role !== UserRole.ADMIN && user.storeId) {
      data = data.filter(e => e.storeId === user.storeId);
    }
    return data;
  }, [generalExpenses, user]);

  const dateFilteredData = useMemo(() => {
    let startDateObj: Date, endDateObj: Date;
    
    if (filterType === 'month') {
        startDateObj = new Date(selectedYear, selectedMonth, 1);
        endDateObj = new Date(selectedYear, selectedMonth + 1, 0);
    } else if (filterType === 'year') {
        startDateObj = new Date(selectedYearOnly, 0, 1);
        endDateObj = new Date(selectedYearOnly, 11, 31);
    } else {
        startDateObj = new Date(startDate);
        endDateObj = new Date(endDate);
    }
    // Set times to cover full days
    startDateObj.setHours(0, 0, 0, 0);
    endDateObj.setHours(23, 59, 59, 999);

    const isInRange = (dateStr: string) => {
        const d = new Date(dateStr);
        // Compare timestamps or date objects
        return d >= startDateObj && d <= endDateObj;
    };

    return {
        reports: filteredReports.filter(r => isInRange(r.date)),
        expenses: validExpenses.filter(e => isInRange(e.date)),
        fundIns: fundInTransactions.filter(e => isInRange(e.date))
    };
  }, [filterType, selectedMonth, selectedYear, selectedYearOnly, startDate, endDate, filteredReports, validExpenses, fundInTransactions]);

  const stats = useMemo(() => {
    const { reports, expenses, fundIns } = dateFilteredData;

    // Calculate metrics for all reports
    const enrichedReports = reports.map(r => {
        const m = calculateReportMetrics(r);
        return { ...r, calculatedNetSales: m.netSales, calculatedGrossSales: m.grossSales };
    });

    // Overall Net Sales = Sum of calculatedNetSales
    const overallNetSales = enrichedReports.reduce((acc, r) => acc + r.calculatedNetSales, 0);

    // Overall EOD Sales (Gross) = Sum of calculatedGrossSales
    const overallGrossSales = enrichedReports.reduce((acc, r) => acc + r.calculatedGrossSales, 0);
    
    // Overall General Expenses (excluding GPO Fund-in)
    const overallGeneralExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    
    // Running Profit = Overall Net Sales - Overall General Expenses
    const runningProfit = overallNetSales - overallGeneralExpenses;
    
    // Overall GPO Fundin (from reports only)
    const fundInFromReports = reports.reduce((acc, r) => acc + (r.fundIn || 0), 0);
    const overallFundIn = fundInFromReports;

    return { overallNetSales, overallGrossSales, overallGeneralExpenses, runningProfit, overallFundIn };
  }, [dateFilteredData]);

  const chartData = useMemo(() => {
    const { reports, expenses } = dateFilteredData;
    const dataByDate: Record<string, { netSales: number, expenses: number, fundIn: number, recordedProfit: number }> = {};

    // Helper to get key based on filter type
    const getKey = (dateStr: string) => {
        if (filterType === 'year') {
            // Group by Month (YYYY-MM)
            return dateStr.substring(0, 7);
        }
        // Group by Date (YYYY-MM-DD)
        return dateStr;
    };

    // Aggregate reports
    reports.forEach(r => {
        const key = getKey(r.date);
        const metrics = calculateReportMetrics(r);
        if (!dataByDate[key]) dataByDate[key] = { netSales: 0, expenses: 0, fundIn: 0, recordedProfit: 0 };
        dataByDate[key].netSales += metrics.netSales;
        dataByDate[key].fundIn += (r.fundIn || 0);
        dataByDate[key].recordedProfit += metrics.netSales;
    });

    // Aggregate expenses (valid only)
    expenses.forEach(e => {
        const key = getKey(e.date);
        if (!dataByDate[key]) dataByDate[key] = { netSales: 0, expenses: 0, fundIn: 0, recordedProfit: 0 };
        dataByDate[key].expenses += e.amount;
    });

    // Sort dates
    let sortedKeys = Object.keys(dataByDate).sort();

    // If Yearly filter, ensure all 12 months are present
    if (filterType === 'year') {
        const year = selectedYearOnly;
        sortedKeys = Array.from({ length: 12 }, (_, i) => {
            const monthNum = i + 1;
            const monthStr = monthNum.toString().padStart(2, '0');
            return `${year}-${monthStr}`;
        });
    }
    
    return sortedKeys.map(key => {
        const d = dataByDate[key] || { netSales: 0, expenses: 0, fundIn: 0, recordedProfit: 0 };
        let displayDate = key;
        if (filterType === 'year') {
            // Convert YYYY-MM to Month Name
            const [y, m] = key.split('-');
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
            displayDate = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
        } else {
            displayDate = key.substring(5); // MM-DD
        }

        return {
            date: displayDate,
            fullDate: key,
            netSales: d.netSales,
            expenses: d.expenses,
            runningProfit: d.recordedProfit - d.expenses,
            fundIn: d.fundIn
        };
    });
  }, [dateFilteredData, filterType, selectedYearOnly]);

  useEffect(() => {
    try {
      console.log('Dashboard: filteredReports count', filteredReports.length);
      console.log('Dashboard: chartData sample', chartData.slice(0, 10));
    } catch (e) { console.error('Dashboard debug failed', e); }
  }, [filteredReports, chartData]);

  const StatCard = ({ label, value, color, icon: Icon }: any) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <h3 className={`text-xl font-bold ${color}`}>{value}</h3>
        </div>
        <div className={`p-2 rounded-full bg-gray-50`}><Icon size={20} className={color} /></div>
      </div>
    </div>
  );

  if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900">
            {user.role === UserRole.ADMIN ? 'Global Overview' : 'Store Performance'}
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex bg-gray-100 p-1 rounded-md">
                <button 
                    onClick={() => setFilterType('year')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${filterType === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Yearly
                </button>
                <button 
                    onClick={() => setFilterType('month')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${filterType === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Monthly
                </button>
                <button 
                    onClick={() => setFilterType('range')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${filterType === 'range' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Range
                </button>
            </div>

            {filterType === 'month' ? (
                <div className="flex gap-2">
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                    >
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            ) : filterType === 'year' ? (
                <div className="flex gap-2">
                    <select 
                        value={selectedYearOnly} 
                        onChange={(e) => setSelectedYearOnly(parseInt(e.target.value))}
                        className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">From</span>
                        <input 
                            type="date"
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">To</span>
                        <input 
                            type="date"
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Overall EOD Sales (Gross)" value={`₱${stats.overallGrossSales.toLocaleString()}`} color="text-purple-600" icon={DollarSign} />
        <StatCard label="Overall Net Sales" value={`₱${stats.overallNetSales.toLocaleString()}`} color="text-blue-600" icon={DollarSign} />
        <StatCard label="Overall General Expenses" value={`₱${stats.overallGeneralExpenses.toLocaleString()}`} color="text-red-600" icon={FileText} />
        <StatCard label="Running Profit" value={`₱${stats.runningProfit.toLocaleString()}`} color="text-emerald-600" icon={TrendingUp} />
        <StatCard label="OVERALL GPO FUNDIN" value={`₱${stats.overallFundIn.toLocaleString()}`} color="text-indigo-600" icon={Wallet} />
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col flex-shrink-0" style={{height: '380px'}}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Performance Overview ({filterType === 'month' ? `${months[selectedMonth]} ${selectedYear}` : filterType === 'year' ? `${selectedYearOnly}` : `${startDate} to ${endDate}`})
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="date" fontSize={12} stroke="#374151" />
            <YAxis fontSize={12} stroke="#374151" />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Bar dataKey="netSales" fill="#3b82f6" name="Net Sales" />
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            <Bar dataKey="runningProfit" fill="#10b981" name="Running Profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'sales' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <div className="flex items-center justify-center gap-2">
                <TrendingUp size={16} />
                Sales Report
            </div>
        </button>
        <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'expenses' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <div className="flex items-center justify-center gap-2">
                <FileText size={16} />
                General Expenses
            </div>
        </button>
        <button
            onClick={() => setActiveTab('fundin')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'fundin' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <div className="flex items-center justify-center gap-2">
                <Wallet size={16} />
                GPO Fundin
            </div>
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden w-full">
        <div className="p-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Sales Report</h3></div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                    <th className="px-4 py-3">Date</th>
                    {user.role === UserRole.ADMIN && <th className="px-4 py-3">Store</th>}
                    <th className="px-4 py-3">Total EOD Sales</th>
                    <th className="px-4 py-3">Net Sales</th>
                    <th className="px-4 py-3">Status</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {dateFilteredData.reports.map(report => {
                    const metrics = calculateReportMetrics(report);
                    return (
                    <tr key={report.id} className="hover:bg-gray-50 text-gray-900">
                    <td className="px-4 py-3">{report.date}</td>
                    {user.role === UserRole.ADMIN && <td className="px-4 py-3 text-xs text-gray-700">{stores.find(s => s.id === report.storeId)?.name || 'Unknown'}</td>}
                    <td className="px-4 py-3 font-medium">₱{metrics.grossSales.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">₱{metrics.netSales.toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${report.status === 'BALANCED' ? 'bg-green-100 text-green-700' : report.status === 'SHORTAGE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{report.status === 'OVERAGE' ? 'SURPLUS' : report.status}</span></td>
                    </tr>
                    );
                })}
                {dateFilteredData.reports.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No reports found</td></tr>}
                </tbody>
            </table>
            </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden w-full">
            <div className="p-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">General Expenses</h3></div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                    <th className="px-4 py-3">Date</th>
                    {user.role === UserRole.ADMIN && <th className="px-4 py-3">Store</th>}
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {dateFilteredData.expenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50 text-gray-900">
                    <td className="px-4 py-3">{expense.date}</td>
                    {user.role === UserRole.ADMIN && <td className="px-4 py-3 text-xs text-gray-700">{stores.find(s => s.id === expense.storeId)?.name || 'Unknown'}</td>}
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">{expense.category}</span></td>
                    <td className="px-4 py-3 text-gray-500">{expense.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">₱{expense.amount.toLocaleString()}</td>
                    </tr>
                ))}
                {dateFilteredData.expenses.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No expenses found</td></tr>}
                </tbody>
            </table>
            </div>
        </div>
      )}

      {activeTab === 'fundin' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden w-full">
            <div className="p-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">GPO Fundin</h3></div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                    <th className="px-4 py-3">Date</th>
                    {user.role === UserRole.ADMIN && <th className="px-4 py-3">Store</th>}
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Source</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {[
                    ...dateFilteredData.reports.filter(r => (r.fundIn || 0) > 0).map(r => ({ 
                        id: r.id, 
                        date: r.date, 
                        storeId: r.storeId, 
                        amount: r.fundIn || 0, 
                        source: 'Sales Report',
                        type: 'report'
                    }))
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, idx) => (
                    <tr key={`${item.type}-${item.id}-${idx}`} className="hover:bg-gray-50 text-gray-900">
                    <td className="px-4 py-3">{item.date}</td>
                    {user.role === UserRole.ADMIN && <td className="px-4 py-3 text-xs text-gray-700">{stores.find(s => s.id === item.storeId)?.name || 'Unknown'}</td>}
                    <td className="px-4 py-3 text-right font-bold text-blue-600">₱{item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{item.source}</td>
                    </tr>
                ))}
                {(dateFilteredData.reports.filter(r => (r.fundIn || 0) > 0).length === 0) && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No fund-ins found</td></tr>}
                </tbody>
            </table>
            </div>
        </div>
      )}
    </div>
  );
};