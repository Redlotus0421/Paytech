import React, { useState, useEffect, useMemo } from 'react';
import { Store, ReportData, User, UserRole, GeneralExpense } from '../types';
import { storageService } from '../services/storageService';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2, Store as StoreIcon, ArrowLeft, Calendar, FileText, CreditCard, Wallet } from 'lucide-react';

export const Analytics: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses' | 'fundin'>('sales');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Month Filter State (YYYY-MM format)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  // Date Filter State (YYYY-MM-DD format)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  // Range Filter State
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  // Filter Type State
  const [filterType, setFilterType] = useState<'month' | 'date' | 'range'>('month');

  useEffect(() => {
    const user = storageService.getCurrentUser();
    setCurrentUser(user);

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [allStores, allReports, allExpenses] = await Promise.all([
          storageService.fetchStores(),
          storageService.fetchReports(),
          storageService.fetchGeneralExpenses()
        ]);
        console.log('Analytics: fetched reports count', (allReports || []).length);
        setStores(allStores);
        setGeneralExpenses(allExpenses);
        
        if (user && user.role === UserRole.EMPLOYEE && user.storeId) {
            setReports(allReports.filter(r => r.storeId === user.storeId));
        } else {
            setReports(allReports);
        }
      } catch (error) { 
        console.error("Failed to load analytics data:", error);
        setError(`Failed to load analytics data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      finally { setIsLoading(false); }
    };
    loadData();
  }, []);

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store);
    setView('detail');
    // Reset month/date to current when selecting a store
    setSelectedMonth(new Date().toISOString().slice(0, 7));
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  const handleBack = () => {
    setSelectedStore(null);
    setView('list');
  };

  // Filter reports by store AND month/date/range
  const storeReports = useMemo(() => {
    if (!selectedStore && !currentUser?.storeId) return [];
    
    const targetStoreId = selectedStore?.id || currentUser?.storeId;

    return reports
      .filter(r => {
          const isStoreMatch = r.storeId === targetStoreId;
          let isDateMatch = false;
          if (filterType === 'month') {
            isDateMatch = r.date.startsWith(selectedMonth);
          } else if (filterType === 'date') {
            isDateMatch = r.date === selectedDate;
          } else if (filterType === 'range') {
            isDateMatch = r.date >= startDate && r.date <= endDate;
          }
          return isStoreMatch && isDateMatch;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [reports, selectedStore, currentUser, selectedMonth, selectedDate, startDate, endDate, filterType]);

  // Filter expenses by store AND month/date/range
  const storeExpenses = useMemo(() => {
    if (!selectedStore && !currentUser?.storeId) return [];
    const targetStoreId = selectedStore?.id || currentUser?.storeId;

    return generalExpenses
      .filter(e => {
          const isStoreMatch = e.storeId === targetStoreId;
          let isDateMatch = false;
          if (filterType === 'month') {
            isDateMatch = e.date.startsWith(selectedMonth);
          } else if (filterType === 'date') {
            isDateMatch = e.date === selectedDate;
          } else if (filterType === 'range') {
            isDateMatch = e.date >= startDate && e.date <= endDate;
          }
          return isStoreMatch && isDateMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [generalExpenses, selectedStore, currentUser, selectedMonth, selectedDate, startDate, endDate, filterType]);

  const stats = useMemo(() => {
    // Use the filtered storeReports directly for stats
    const totalProfit = storeReports.reduce((acc, r) => acc + r.recordedProfit, 0);
    const totalShortage = storeReports.reduce((acc, r) => r.discrepancy < 0 ? acc + r.discrepancy : acc, 0);
    const totalSurplus = storeReports.reduce((acc, r) => r.discrepancy > 0 ? acc + r.discrepancy : acc, 0);
    const balanceCount = storeReports.filter(r => r.status === 'BALANCED').length;
    
    // Calculate Gross Sales (Net Sales + Discrepancy)
    const totalNetSalesWithDiscrepancy = storeReports.reduce((acc, r) => acc + (r.totalNetSales + r.discrepancy), 0);
    
    // Calculate Raw Net Sales (without discrepancy)
    const totalNetSales = storeReports.reduce((acc, r) => acc + r.totalNetSales, 0);

    // Expenses stats
    const totalExpenses = storeExpenses.reduce((acc, e) => acc + e.amount, 0);
    
    // Fund In stats
    const totalFundIn = storeReports.reduce((acc, r) => acc + (r.fundIn || 0), 0);

    // Running Profit
    const runningProfit = totalNetSales - totalExpenses;

    return { totalProfit, totalShortage, totalSurplus, balanceCount, reportCount: storeReports.length, totalExpenses, totalFundIn, totalNetSalesWithDiscrepancy, totalNetSales, runningProfit };
  }, [storeReports, storeExpenses]);

  const chartData = useMemo(() => {
    const dataByDate: Record<string, { netSales: number, expenses: number, fundIn: number, recordedProfit: number }> = {};

    // Aggregate reports
    storeReports.forEach(r => {
        const date = r.date;
        if (!dataByDate[date]) dataByDate[date] = { netSales: 0, expenses: 0, fundIn: 0, recordedProfit: 0 };
        dataByDate[date].netSales += (r.totalNetSales + r.discrepancy);
        dataByDate[date].fundIn += (r.fundIn || 0);
        dataByDate[date].recordedProfit += r.recordedProfit;
    });

    // Aggregate expenses
    storeExpenses.forEach(e => {
        const date = e.date;
        if (!dataByDate[date]) dataByDate[date] = { netSales: 0, expenses: 0, fundIn: 0, recordedProfit: 0 };
        dataByDate[date].expenses += e.amount;
    });

    // Sort dates
    const sortedDates = Object.keys(dataByDate).sort();

    return sortedDates.map(date => {
        const d = dataByDate[date];
        return {
            date: date.substring(5), // MM-DD
            netSales: d.netSales,
            expenses: d.expenses,
            runningProfit: d.netSales - d.expenses,
            fundIn: d.fundIn,
            recordedProfit: d.recordedProfit
        };
    });
  }, [storeReports, storeExpenses]);

  const expensesChartData = useMemo(() => {
    // Group expenses by date
    const grouped = storeExpenses.reduce((acc, e) => {
        const date = e.date.substring(5);
        acc[date] = (acc[date] || 0) + e.amount;
        return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));
  }, [storeExpenses]);

  // Debug: log storeReports and chartData to help diagnose missing chart
  useEffect(() => {
    try {
      console.log('Analytics: storeReports count', storeReports.length);
      console.log('Analytics: chartData sample', chartData.slice(0, 10));
    } catch (e) {
      console.error('Analytics debug failed', e);
    }
  }, [storeReports, chartData]);

  if (isLoading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  if (view === 'list' && currentUser?.role === UserRole.ADMIN) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="text-blue-600" /> Analytics Overview</h2>
        <p className="text-gray-500">Select a store to view detailed performance metrics.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => {
             const thisStoreReports = reports.filter(r => r.storeId === store.id);
             const lastReport = thisStoreReports.sort((a,b) => b.timestamp - a.timestamp)[0];
             const totalSales = thisStoreReports.reduce((acc, r) => acc + r.recordedProfit, 0);
             return (
              <button key={store.id} onClick={() => handleStoreClick(store)} className="bg-white p-6 rounded-xl shadow-sm border text-left group hover:shadow-md hover:border-blue-300 transition-all h-full flex flex-col justify-between">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg"><StoreIcon size={24} className="text-blue-600" /></div>
                  <div className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{thisStoreReports.length} Reports</div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{store.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{store.location}</p>
                <div className="pt-4 border-t flex justify-between items-end">
                  <div><p className="text-xs text-gray-400">Total Net Sales (All Time)</p><p className="text-lg font-bold text-gray-900">₱{totalSales.toLocaleString()}</p></div>
                  {lastReport && <div><p className="text-xs text-gray-400">Last Update</p><p className="text-xs font-medium text-gray-700">{lastReport.date}</p></div>}
                </div>
              </button>
             );
          })}
        </div>
      </div>
    );
  }

  const displayStore = selectedStore || (currentUser?.storeId ? stores.find(s => s.id === currentUser.storeId) : null);

  return (
    <div className="flex flex-col gap-6 relative min-h-0 w-full min-w-0"> 
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error loading analytics</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {currentUser?.role === UserRole.ADMIN && <button onClick={handleBack} className="p-2 hover:bg-gray-200 rounded-full"><ArrowLeft size={24} /></button>}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{displayStore?.name || 'Store'} Analytics</h2>
                <p className="text-gray-500 text-sm">{displayStore?.location}</p>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Type Toggle */}
            <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-medium">
                <button 
                    onClick={() => setFilterType('month')}
                    className={`px-3 py-1 rounded-md transition-all ${filterType === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Month
                </button>
                <button 
                    onClick={() => setFilterType('date')}
                    className={`px-3 py-1 rounded-md transition-all ${filterType === 'date' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Date
                </button>
                <button 
                    onClick={() => setFilterType('range')}
                    className={`px-3 py-1 rounded-md transition-all ${filterType === 'range' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Range
                </button>
            </div>

            {/* Date/Month Picker */}
            <div className="bg-white border border-gray-300 hover:border-blue-400 rounded-lg shadow-sm transition-colors flex items-center px-3 py-2">
                <Calendar size={18} className="text-gray-500 mr-2" />
                {filterType === 'month' ? (
                    <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent cursor-pointer"
                    />
                ) : filterType === 'date' ? (
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent cursor-pointer"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent cursor-pointer w-32"
                        />
                        <span className="text-gray-400 text-xs">to</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent cursor-pointer w-32"
                        />
                    </div>
                )}
            </div>
          </div>
      </div>
      
      {/* Spacer to prevent overlap with absolute button on mobile if needed, though usually fine on desktop */}
      <div className="h-8 md:hidden"></div> 

      {/* 3. Cards Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10 pt-2">
        {activeTab === 'sales' && (
            <>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-blue-600">₱{stats.totalNetSalesWithDiscrepancy.toLocaleString()}</h3><p className="text-sm text-gray-500">Overall EOD Sales (Gross)</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-blue-500">₱{stats.totalNetSales.toLocaleString()}</h3><p className="text-sm text-gray-500">Overall Net Sales</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-red-600">₱{stats.totalExpenses.toLocaleString()}</h3><p className="text-sm text-gray-500">Overall General Expenses</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-emerald-600">₱{stats.runningProfit.toLocaleString()}</h3><p className="text-sm text-gray-500">Running Profit</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-indigo-600">₱{stats.totalFundIn.toLocaleString()}</h3><p className="text-sm text-gray-500">Overall GPO Fundin</p></div>
            </>
        )}
        {activeTab === 'expenses' && (
            <>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-red-600">₱{stats.totalExpenses.toLocaleString()}</h3><p className="text-sm text-gray-500">Total Expenses</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-gray-700">{storeExpenses.length}</h3><p className="text-sm text-gray-500">Total Transactions</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-gray-700">₱{storeExpenses.length > 0 ? (stats.totalExpenses / storeExpenses.length).toLocaleString(undefined, {maximumFractionDigits: 2}) : 0}</h3><p className="text-sm text-gray-500">Avg. Expense</p></div>
            </>
        )}
        {activeTab === 'fundin' && (
            <>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-blue-600">₱{stats.totalFundIn.toLocaleString()}</h3><p className="text-sm text-gray-500">Total Fund In</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-gray-700">{storeReports.filter(r => (r.fundIn || 0) > 0).length}</h3><p className="text-sm text-gray-500">Fund In Events</p></div>
                <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-gray-700">₱{storeReports.filter(r => (r.fundIn || 0) > 0).length > 0 ? (stats.totalFundIn / storeReports.filter(r => (r.fundIn || 0) > 0).length).toLocaleString(undefined, {maximumFractionDigits: 2}) : 0}</h3><p className="text-sm text-gray-500">Avg. Fund In</p></div>
            </>
        )}
      </div>

      {/* 1. Performance Chart Area (Dynamic based on activeTab) */}
      <div className="bg-white p-6 rounded-lg shadow-sm border relative z-0 flex flex-col" style={{height: '400px'}}>
        {activeTab === 'sales' && (
            <>
                <h3 className="text-lg font-bold text-gray-900 mb-6">Performance Chart ({filterType === 'month' ? selectedMonth : filterType === 'date' ? selectedDate : `${startDate} to ${endDate}`})</h3>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <ReferenceLine y={0} stroke="#000" />
                            <Bar dataKey="netSales" name="Gross Sales (EOD Sales)" fill="#3b82f6" />
                            <Bar dataKey="recordedProfit" name="Net Profit (EOD Net)" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center text-gray-400 h-full">No data for this {filterType === 'month' ? 'month' : filterType === 'date' ? 'date' : 'range'}</div>
                )}
            </>
        )}
        {activeTab === 'expenses' && (
            <>
                <h3 className="text-lg font-bold text-gray-900 mb-6">Expenses Trend ({filterType === 'month' ? selectedMonth : filterType === 'date' ? selectedDate : `${startDate} to ${endDate}`})</h3>
                {expensesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={expensesChartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="amount" name="Expense Amount" fill="#ef4444" /></BarChart></ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center text-gray-400 h-full">No expenses for this {filterType === 'month' ? 'month' : filterType === 'date' ? 'date' : 'range'}</div>
                )}
            </>
        )}
        {activeTab === 'fundin' && (
            <>
                <h3 className="text-lg font-bold text-gray-900 mb-6">Fund In Trend ({filterType === 'month' ? selectedMonth : filterType === 'date' ? selectedDate : `${startDate} to ${endDate}`})</h3>
                {chartData.some(d => d.fundIn > 0) ? (
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="fundIn" name="Fund In Amount" fill="#3b82f6" /></BarChart></ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center text-gray-400 h-full">No fund in records for this {filterType === 'month' ? 'month' : filterType === 'date' ? 'date' : 'range'}</div>
                )}
            </>
        )}
      </div>

      {/* 2. Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
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



      {/* 4. Table Area */}
      {activeTab === 'sales' && (
        <>
            {/* Recent Activity Table (Filtered by Month) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative z-0 w-full min-w-0 flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-gray-900">Reports History ({filterType === 'month' ? selectedMonth : filterType === 'date' ? selectedDate : `${startDate} to ${endDate}`})</h3>
                <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={14}/> {storeReports.length} records found</span>
                </div>
                <div className="overflow-x-auto overflow-y-auto min-w-0 flex-1 min-h-0 max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3 text-right">GROSS SALES</th>
                        <th className="px-6 py-3 text-right">NET PROFIT</th>
                        <th className="px-6 py-3 text-right">Variance</th>
                        <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {storeReports.length > 0 ? (
                        storeReports.slice().reverse().map(report => (
                            <tr key={report.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                            <td className="px-6 py-3 font-medium">{report.date}</td>
                            <td className="px-6 py-3 text-right">₱{(report.totalNetSales + report.discrepancy).toLocaleString()}</td>
                            <td className="px-6 py-3 text-right font-bold text-emerald-600">₱{report.recordedProfit.toLocaleString()}</td>
                            <td className={`px-6 py-3 text-right font-bold ${report.discrepancy < 0 ? 'text-red-500' : (report.discrepancy > 0 ? 'text-blue-500' : 'text-gray-400')}`}>
                                {report.discrepancy > 0 ? '+' : ''}{report.discrepancy.toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                report.status === 'BALANCED' ? 'bg-green-100 text-green-700' :
                                report.status === 'SHORTAGE' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                                }`}>
                                {report.status}
                                </span>
                            </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No reports found for this {filterType === 'month' ? 'month' : filterType === 'date' ? 'date' : 'range'}.</td></tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}

      {/* GENERAL EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative z-0 w-full min-w-0 flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-gray-900">Expenses History ({filterType === 'month' ? selectedMonth : filterType === 'date' ? selectedDate : `${startDate} to ${endDate}`})</h3>
                <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={14}/> {storeExpenses.length} records found</span>
                </div>
                <div className="overflow-x-auto overflow-y-auto min-w-0 flex-1 min-h-0 max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                        <th className="px-6 py-3 text-right">Recorded By</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {storeExpenses.length > 0 ? (
                        storeExpenses.map(expense => (
                            <tr key={expense.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                            <td className="px-6 py-3 font-medium">{expense.date}</td>
                            <td className="px-6 py-3"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">{expense.category}</span></td>
                            <td className="px-6 py-3 text-gray-500">{expense.description || '-'}</td>
                            <td className="px-6 py-3 text-right font-bold text-red-600">₱{expense.amount.toLocaleString()}</td>
                            <td className="px-6 py-3 text-right text-xs text-gray-400">{expense.recordedBy || 'Unknown'}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No expenses found for this {filterType === 'month' ? 'month' : filterType === 'date' ? 'date' : 'range'}.</td></tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}

      {/* GPO FUNDIN TAB */}
      {activeTab === 'fundin' && (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative z-0 w-full min-w-0 flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-gray-900">Fund In History ({filterType === 'month' ? selectedMonth : filterType === 'date' ? selectedDate : `${startDate} to ${endDate}`})</h3>
                <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={14}/> {storeReports.filter(r => (r.fundIn || 0) > 0).length} records found</span>
                </div>
                <div className="overflow-x-auto overflow-y-auto min-w-0 flex-1 min-h-0 max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3 text-right">Fund In Amount</th>
                        <th className="px-6 py-3 text-right">Total Start Fund</th>
                        <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {storeReports.filter(r => (r.fundIn || 0) > 0).length > 0 ? (
                        storeReports.filter(r => (r.fundIn || 0) > 0).slice().reverse().map(report => (
                            <tr key={report.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                            <td className="px-6 py-3 font-medium">{report.date}</td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600">₱{report.fundIn.toLocaleString()}</td>
                            <td className="px-6 py-3 text-right text-gray-500">₱{report.totalStartFund.toLocaleString()}</td>
                            <td className="px-6 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                report.status === 'BALANCED' ? 'bg-green-100 text-green-700' :
                                report.status === 'SHORTAGE' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                                }`}>
                                {report.status}
                                </span>
                            </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">No fund in records found for this {filterType === 'month' ? 'month' : filterType === 'date' ? 'date' : 'range'}.</td></tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}
    </div>
  );
};