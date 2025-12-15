import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, ReportData, Store } from '../types';
import { storageService } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2 } from 'lucide-react';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const allStores = await storageService.fetchStores();
            setStores(allStores);
            const allReports = await storageService.fetchReports();
        console.log('Dashboard: fetched reports count', (allReports || []).length);
            setReports(allReports);
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

  const stats = useMemo(() => {
    const totalProfit = filteredReports.reduce((acc, r) => acc + r.recordedProfit, 0);
    const totalShortage = filteredReports.reduce((acc, r) => r.discrepancy < 0 ? acc + r.discrepancy : acc, 0);
    const balanceCount = filteredReports.filter(r => r.status === 'BALANCED').length;
    return { totalProfit, totalShortage, balanceCount };
  }, [filteredReports]);

  const chartData = useMemo(() => {
    return filteredReports.slice(0, 7).reverse().map(r => ({
      date: r.date.substring(5),
      profit: r.recordedProfit,
      discrepancy: r.discrepancy
    }));
  }, [filteredReports]);

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
    <div className="flex flex-col gap-6 min-h-0 w-full min-w-0">
      <h2 className="text-xl font-bold text-gray-900">
        {user.role === UserRole.ADMIN ? 'Global Overview' : 'Store Performance'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Net Sales" value={`₱${stats.totalProfit.toLocaleString()}`} color="text-emerald-600" icon={TrendingUp} />
        <StatCard label="Total Shortage/Surplus" value={`₱${Math.abs(stats.totalShortage).toLocaleString()}`} color="text-red-600" icon={AlertOctagon} />
        <StatCard label="Balanced Reports" value={stats.balanceCount} color="text-blue-600" icon={DollarSign} />
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col flex-shrink-0" style={{height: '380px'}}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Net Sales vs Total EOD Sales (Last 7 Entries)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="date" fontSize={12} stroke="#374151" />
            <YAxis fontSize={12} stroke="#374151" />
            <Tooltip />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Bar dataKey="profit" fill="#10b981" name="Net Sales" />
            <Bar dataKey="discrepancy" fill="#ef4444" name="Total EOD Sales" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden w-full min-w-0 flex flex-col">
        <div className="p-4 border-b border-gray-100 shrink-0"><h3 className="text-sm font-semibold text-gray-700">Recent Submissions</h3></div>
        <div className="overflow-x-auto overflow-y-auto min-w-0 max-h-[70vh]">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="px-4 py-3">Date</th>
                {user.role === UserRole.ADMIN && <th className="px-4 py-3">Store</th>}
                <th className="px-4 py-3">Net Sales</th>
                <th className="px-4 py-3">Total EOD Sales</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map(report => (
                <tr key={report.id} className="hover:bg-gray-50 text-gray-900">
                  <td className="px-4 py-3">{report.date}</td>
                  {user.role === UserRole.ADMIN && <td className="px-4 py-3 text-xs text-gray-700">{stores.find(s => s.id === report.storeId)?.name || 'Unknown'}</td>}
                  <td className="px-4 py-3 font-medium">₱{report.recordedProfit.toFixed(0)}</td>
                  <td className={`px-4 py-3 font-bold ${report.discrepancy < 0 ? 'text-red-600' : 'text-green-600'}`}>{report.discrepancy.toFixed(0)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${report.status === 'BALANCED' ? 'bg-green-100 text-green-700' : report.status === 'SHORTAGE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{report.status === 'OVERAGE' ? 'SURPLUS' : report.status}</span></td>
                </tr>
              ))}
              {filteredReports.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No reports found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};