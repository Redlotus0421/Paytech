import React, { useState, useEffect, useMemo } from 'react';
import { Store, ReportData, User, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2, Store as StoreIcon, ArrowLeft, Calendar } from 'lucide-react';

export const Analytics: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Month Filter State (YYYY-MM format)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const user = storageService.getCurrentUser();
    setCurrentUser(user);

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [allStores, allReports] = await Promise.all([
          storageService.fetchStores(),
          storageService.fetchReports()
        ]);
        console.log('Analytics: fetched reports count', (allReports || []).length);
        setStores(allStores);
        
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
    // Reset month to current when selecting a store
    setSelectedMonth(new Date().toISOString().slice(0, 7));
  };

  const handleBack = () => {
    setSelectedStore(null);
    setView('list');
  };

  // Filter reports by store AND month
  const storeReports = useMemo(() => {
    if (!selectedStore && !currentUser?.storeId) return [];
    
    const targetStoreId = selectedStore?.id || currentUser?.storeId;

    return reports
      .filter(r => {
          const isStoreMatch = r.storeId === targetStoreId;
          const isMonthMatch = r.date.startsWith(selectedMonth);
          return isStoreMatch && isMonthMatch;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [reports, selectedStore, currentUser, selectedMonth]);

  const stats = useMemo(() => {
    // Use the filtered storeReports directly for stats
    const totalProfit = storeReports.reduce((acc, r) => acc + r.recordedProfit, 0);
    const totalShortage = storeReports.reduce((acc, r) => r.discrepancy < 0 ? acc + r.discrepancy : acc, 0);
    const totalSurplus = storeReports.reduce((acc, r) => r.discrepancy > 0 ? acc + r.discrepancy : acc, 0);
    const balanceCount = storeReports.filter(r => r.status === 'BALANCED').length;
    return { totalProfit, totalShortage, totalSurplus, balanceCount, reportCount: storeReports.length };
  }, [storeReports]);

  const chartData = useMemo(() => {
    // Show all data for the selected month
    return storeReports.map(r => ({
      date: r.date.substring(5), // mm-dd
      profit: r.recordedProfit,
      discrepancy: r.discrepancy,
      sales: r.totalNetSales
    }));
  }, [storeReports]);

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
          
          {/* Month Filter - Positioned absolutely to force top layer */}
          <div className="absolute top-0 right-0 z-[100] group bg-white border border-gray-300 hover:border-blue-400 rounded-lg shadow-sm transition-colors">
            {/* Visual part (Underneath) */}
            <div className="flex items-center px-3 py-2 pointer-events-none">
              <Calendar size={18} className="text-gray-500 mr-2 group-hover:text-blue-500" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 min-w-[80px]">{selectedMonth}</span>
            </div>
            
            {/* Functional part (Overlay) - Ensures native picker trigger */}
            <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                style={{ appearance: 'none' }} 
            />
          </div>
      </div>
      
      {/* Spacer to prevent overlap with absolute button on mobile if needed, though usually fine on desktop */}
      <div className="h-8 md:hidden"></div> 

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10 pt-2">
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-emerald-600">₱{stats.totalProfit.toLocaleString()}</h3><p className="text-sm text-gray-500">Total Net Sales</p></div>
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-red-600">₱{Math.abs(stats.totalShortage).toLocaleString()}</h3><p className="text-sm text-gray-500">Total Shortage</p></div>
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-blue-600">₱{stats.totalSurplus.toLocaleString()}</h3><p className="text-sm text-gray-500">Total Surplus</p></div>
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col justify-between"><h3 className="text-2xl font-bold text-indigo-600">{stats.balanceCount} <span className="text-sm">/ {stats.reportCount}</span></h3><p className="text-sm text-gray-500">Perfect Reports</p></div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border relative z-0 flex flex-col" style={{height: '400px'}}>
        <h3 className="text-lg font-bold text-gray-900 mb-6">Performance ({selectedMonth})</h3>
        {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" /><YAxis /><Tooltip /><ReferenceLine y={0} stroke="#000" /><Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={2} /><Line type="monotone" dataKey="discrepancy" name="Variance" stroke="#ef4444" strokeWidth={2} /></LineChart></ResponsiveContainer>
        ) : (
            <div className="flex items-center justify-center text-gray-400 h-full">No data for this month</div>
        )}
      </div>

      {/* Recent Activity Table (Filtered by Month) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative z-0 w-full min-w-0">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Reports History ({selectedMonth})</h3>
          <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={14}/> {storeReports.length} records found</span>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Gross Sales</th>
                <th className="px-6 py-3 text-right">Net Profit</th>
                <th className="px-6 py-3 text-right">Variance</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {storeReports.length > 0 ? (
                  storeReports.slice().reverse().map(report => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                      <td className="px-6 py-3 font-medium">{report.date}</td>
                      <td className="px-6 py-3 text-right">₱{report.totalNetSales.toLocaleString()}</td>
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
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No reports found for this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};