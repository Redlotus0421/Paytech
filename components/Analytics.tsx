import React, { useState, useEffect, useMemo } from 'react';
import { Store, ReportData } from '../types';
import { storageService } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2, Store as StoreIcon, ArrowLeft, Calendar } from 'lucide-react';

interface AnalyticsProps {
}

export const Analytics: React.FC<AnalyticsProps> = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [allStores, allReports] = await Promise.all([
          storageService.fetchStores(),
          storageService.fetchReports()
        ]);
        setStores(allStores);
        setReports(allReports);
      } catch (error) {
        console.error("Failed to load analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedStore(null);
    setView('list');
  };

  // --- DETAIL VIEW LOGIC ---
  const storeReports = useMemo(() => {
    if (!selectedStore) return [];
    return reports
      .filter(r => r.storeId === selectedStore.id)
      .sort((a, b) => a.timestamp - b.timestamp); // Ascending for charts
  }, [reports, selectedStore]);

  const stats = useMemo(() => {
    const totalProfit = storeReports.reduce((acc, r) => acc + r.recordedProfit, 0);
    const totalShortage = storeReports.reduce((acc, r) => r.discrepancy < 0 ? acc + r.discrepancy : acc, 0);
    const totalSurplus = storeReports.reduce((acc, r) => r.discrepancy > 0 ? acc + r.discrepancy : acc, 0);
    const balanceCount = storeReports.filter(r => r.status === 'BALANCED').length;
    return { totalProfit, totalShortage, totalSurplus, balanceCount };
  }, [storeReports]);

  const chartData = useMemo(() => {
    // Last 30 entries for chart clarity
    return storeReports.slice(-30).map(r => ({
      date: r.date.substring(5), // mm-dd
      profit: r.recordedProfit,
      discrepancy: r.discrepancy,
      sales: r.totalNetSales
    }));
  }, [storeReports]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
  }

  // --- LIST VIEW ---
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-blue-600" /> Analytics Overview
        </h2>
        <p className="text-gray-500">Select a store to view detailed performance metrics and history.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => {
             // Calculate quick stats for the card
             const thisStoreReports = reports.filter(r => r.storeId === store.id);
             const lastReport = thisStoreReports.sort((a,b) => b.timestamp - a.timestamp)[0];
             const totalSales = thisStoreReports.reduce((acc, r) => acc + r.recordedProfit, 0);

             return (
              <button 
                key={store.id} 
                onClick={() => handleStoreClick(store)}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <StoreIcon size={24} className="text-blue-600" />
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {thisStoreReports.length} Reports
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{store.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{store.location}</p>
                
                <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Total Net Sales</p>
                    <p className="text-lg font-bold text-gray-900">₱{totalSales.toLocaleString()}</p>
                  </div>
                  {lastReport && (
                    <div className="text-right">
                       <p className="text-xs text-gray-400 mb-1">Last Update</p>
                       <p className="text-xs font-medium text-gray-700">{lastReport.date}</p>
                    </div>
                  )}
                </div>
              </button>
             );
          })}
          
          {stores.length === 0 && (
            <div className="col-span-full p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
              No stores found. Please add stores in settings.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- DETAIL VIEW ---
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{selectedStore?.name} Analytics</h2>
          <p className="text-gray-500 text-sm">{selectedStore?.location}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Net Sales</p>
              <h3 className="text-2xl font-bold text-emerald-600">₱{stats.totalProfit.toLocaleString()}</h3>
            </div>
            <div className="p-2 rounded-full bg-emerald-50"><TrendingUp size={20} className="text-emerald-600" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Shortage</p>
              <h3 className="text-2xl font-bold text-red-600">₱{Math.abs(stats.totalShortage).toLocaleString()}</h3>
            </div>
            <div className="p-2 rounded-full bg-red-50"><AlertOctagon size={20} className="text-red-600" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Surplus</p>
              <h3 className="text-2xl font-bold text-blue-600">₱{stats.totalSurplus.toLocaleString()}</h3>
            </div>
            <div className="p-2 rounded-full bg-blue-50"><TrendingUp size={20} className="text-blue-600" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Perfect Reports</p>
              <h3 className="text-2xl font-bold text-indigo-600">{stats.balanceCount} <span className="text-sm text-gray-400 font-normal">/ {storeReports.length}</span></h3>
            </div>
            <div className="p-2 rounded-full bg-indigo-50"><DollarSign size={20} className="text-indigo-600" /></div>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Net Sales Performance (Last 30 Reports)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={12} stroke="#9ca3af" tickMargin={10} />
              <YAxis fontSize={12} stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                itemStyle={{ color: '#111827', fontWeight: 600 }}
              />
              <ReferenceLine y={0} stroke="#d1d5db" />
              <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="discrepancy" name="Variance" stroke="#ef4444" strokeWidth={2} dot={{r: 3}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Recent Reports History</h3>
          <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={14}/> {storeReports.length} records found</span>
        </div>
        <div className="overflow-x-auto">
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
              {storeReports.slice().reverse().map(report => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};