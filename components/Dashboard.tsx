import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, ReportData, Store, GeneralExpense } from '../types';
import { storageService } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { TrendingUp, AlertOctagon, DollarSign, Loader2, CreditCard, Wallet, FileText, Calendar, Filter } from 'lucide-react';

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
  const [rangeStartMonth, setRangeStartMonth] = useState(currentMonth);
  const [rangeStartYear, setRangeStartYear] = useState(currentYear);
  const [rangeEndMonth, setRangeEndMonth] = useState(currentMonth);
  const [rangeEndYear, setRangeEndYear] = useState(currentYear);

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
    let startDate: Date, endDate: Date;
    
    if (filterType === 'month') {
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0);
    } else if (filterType === 'year') {
        startDate = new Date(selectedYearOnly, 0, 1);
        endDate = new Date(selectedYearOnly, 11, 31);
    } else {
        startDate = new Date(rangeStartYear, rangeStartMonth, 1);
        endDate = new Date(rangeEndYear, rangeEndMonth + 1, 0);
    }
    // Set times to cover full days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const isInRange = (dateStr: string) => {
        const d = new Date(dateStr);
        // Compare timestamps or date objects
        return d >= startDate && d <= endDate;
    };

    return {
        reports: filteredReports.filter(r => isInRange(r.date)),
        expenses: validExpenses.filter(e => isInRange(e.date)),
        fundIns: fundInTransactions.filter(e => isInRange(e.date))
    };
  }, [filterType, selectedMonth, selectedYear, selectedYearOnly, rangeStartMonth, rangeStartYear, rangeEndMonth, rangeEndYear, filteredReports, validExpenses, fundInTransactions]);

  const stats = useMemo(() => {
    const { reports, expenses, fundIns } = dateFilteredData;

    // Overall Net Sales = totalNetSales + discrepancy
    const overallNetSales = reports.reduce((acc, r) => acc + (r.totalNetSales + r.discrepancy), 0);
    
    // Overall General Expenses (excluding GPO Fund-in)
    const overallGeneralExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    
    // Running Profit
    const runningProfit = overallNetSales - overallGeneralExpenses;
    
    // Overall GPO Fundin (from reports + expenses)
    const fundInFromReports = reports.reduce((acc, r) => acc + (r.fundIn || 0), 0);
    const fundInFromExpenses = fundIns.reduce((acc, e) => acc + e.amount, 0);
    const overallFundIn = fundInFromReports + fundInFromExpenses;

    return { overallNetSales, overallGeneralExpenses, runningProfit, overallFundIn };
  }, [dateFilteredData]);

  const chartData = useMemo(() => {
    const { reports, expenses, fundIns } = dateFilteredData;
    const dataByDate: Record<string, { netSales: number, expenses: number, fundIn: number }> = {};

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
        if (!dataByDate[key]) dataByDate[key] = { netSales: 0, expenses: 0, fundIn: 0 };
        dataByDate[key].netSales += (r.totalNetSales + r.discrepancy);
        dataByDate[key].fundIn += (r.fundIn || 0);
    });

    // Aggregate expenses (valid only)
    expenses.forEach(e => {
        const key = getKey(e.date);
        if (!dataByDate[key]) dataByDate[key] = { netSales: 0, expenses: 0, fundIn: 0 };
        dataByDate[key].expenses += e.amount;
    });

    // Aggregate fund-in from expenses
    fundIns.forEach(e => {
        const key = getKey(e.date);
        if (!dataByDate[key]) dataByDate[key] = { netSales: 0, expenses: 0, fundIn: 0 };
        dataByDate[key].fundIn += e.amount;
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
        const d = dataByDate[key] || { netSales: 0, expenses: 0, fundIn: 0 };
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
            runningProfit: d.netSales - d.expenses,
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
                    onClick={() => setFilterType('month')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${filterType === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Monthly
                </button>
                <button 
                    onClick={() => setFilterType('year')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${filterType === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Yearly
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
                        <select 
                            value={rangeStartMonth} 
                            onChange={(e) => setRangeStartMonth(parseInt(e.target.value))}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                        >
                            {months.map((m, i) => <option key={i} value={i}>{m.substring(0,3)}</option>)}
                        </select>
                        <select 
                            value={rangeStartYear} 
                            onChange={(e) => setRangeStartYear(parseInt(e.target.value))}
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">To</span>
                        <select 
                            value={rangeEndMonth} 
                            onChange={(e) => setRangeEndMonth(parseInt(e.target.value))}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                        >
                            {months.map((m, i) => <option key={i} value={i}>{m.substring(0,3)}</option>)}
                        </select>
                        <select 
                            value={rangeEndYear} 
                            onChange={(e) => setRangeEndYear(parseInt(e.target.value))}
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall Net Sales" value={`₱${stats.overallNetSales.toLocaleString()}`} color="text-blue-600" icon={DollarSign} />
        <StatCard label="Overall General Expenses" value={`₱${stats.overallGeneralExpenses.toLocaleString()}`} color="text-red-600" icon={FileText} />
        <StatCard label="Running Profit" value={`₱${stats.runningProfit.toLocaleString()}`} color="text-emerald-600" icon={TrendingUp} />
        <StatCard label="OVERALL GPO FUNDIN" value={`₱${stats.overallFundIn.toLocaleString()}`} color="text-indigo-600" icon={Wallet} />
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col flex-shrink-0" style={{height: '380px'}}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Performance Overview ({filterType === 'month' ? `${months[selectedMonth]} ${selectedYear}` : filterType === 'year' ? `${selectedYearOnly}` : `${months[rangeStartMonth].substring(0,3)} ${rangeStartYear} - ${months[rangeEndMonth].substring(0,3)} ${rangeEndYear}`})
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