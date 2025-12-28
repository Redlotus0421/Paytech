import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, ReportData, Store, GeneralExpense } from '../types';
import { storageService } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2, CreditCard, Wallet, FileText } from 'lucide-react';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const stats = useMemo(() => {
    // Overall Net Sales = totalNetSales + discrepancy
    const overallNetSales = filteredReports.reduce((acc, r) => acc + (r.totalNetSales + r.discrepancy), 0);
    
    // Overall General Expenses (excluding GPO Fund-in)
    const overallGeneralExpenses = validExpenses.reduce((acc, e) => acc + e.amount, 0);
    
    // Running Profit
    const runningProfit = overallNetSales - overallGeneralExpenses;
    
    // Overall GPO Fundin (from reports + expenses)
    const fundInFromReports = filteredReports.reduce((acc, r) => acc + (r.fundIn || 0), 0);
    const fundInFromExpenses = fundInTransactions.reduce((acc, e) => acc + e.amount, 0);
    const overallFundIn = fundInFromReports + fundInFromExpenses;

    return { overallNetSales, overallGeneralExpenses, runningProfit, overallFundIn };
  }, [filteredReports, validExpenses, fundInTransactions]);

  const chartData = useMemo(() => {
    const dataByDate: Record<string, { netSales: number, expenses: number, fundIn: number }> = {};

    // Aggregate reports
    filteredReports.forEach(r => {
        const date = r.date;
        if (!dataByDate[date]) dataByDate[date] = { netSales: 0, expenses: 0, fundIn: 0 };
        dataByDate[date].netSales += (r.totalNetSales + r.discrepancy);
        dataByDate[date].fundIn += (r.fundIn || 0);
    });

    // Aggregate expenses (valid only)
    validExpenses.forEach(e => {
        const date = e.date;
        if (!dataByDate[date]) dataByDate[date] = { netSales: 0, expenses: 0, fundIn: 0 };
        dataByDate[date].expenses += e.amount;
    });

    // Aggregate fund-in from expenses
    fundInTransactions.forEach(e => {
        const date = e.date;
        if (!dataByDate[date]) dataByDate[date] = { netSales: 0, expenses: 0, fundIn: 0 };
        dataByDate[date].fundIn += e.amount;
    });

    // Sort dates and take last 7
    const sortedDates = Object.keys(dataByDate).sort();
    const last7Dates = sortedDates.slice(-7);

    return last7Dates.map(date => {
        const d = dataByDate[date];
        return {
            date: date.substring(5), // MM-DD
            netSales: d.netSales,
            expenses: d.expenses,
            runningProfit: d.netSales - d.expenses,
            fundIn: d.fundIn
        };
    });
  }, [filteredReports, validExpenses, fundInTransactions]);

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
      <h2 className="text-xl font-bold text-gray-900">
        {user.role === UserRole.ADMIN ? 'Global Overview' : 'Store Performance'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall Net Sales" value={`₱${stats.overallNetSales.toLocaleString()}`} color="text-blue-600" icon={DollarSign} />
        <StatCard label="Overall General Expenses" value={`₱${stats.overallGeneralExpenses.toLocaleString()}`} color="text-red-600" icon={FileText} />
        <StatCard label="Running Profit" value={`₱${stats.runningProfit.toLocaleString()}`} color="text-emerald-600" icon={TrendingUp} />
        <StatCard label="OVERALL GPO FUNDIN" value={`₱${stats.overallFundIn.toLocaleString()}`} color="text-indigo-600" icon={Wallet} />
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col flex-shrink-0" style={{height: '380px'}}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Performance Overview (Last 7 Days)</h3>
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden w-full">
      <div className="p-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Recent Submissions</h3></div>
        <div className="overflow-x-auto">
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