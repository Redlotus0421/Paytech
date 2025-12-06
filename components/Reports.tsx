import React, { useState, useEffect } from 'react';
import { User, ReportData, Store, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Eye, FileText, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface ReportsProps {
  user: User;
}

export const Reports: React.FC<ReportsProps> = ({ user }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Fetch all necessary data from the backend
            const [allStores, allReports, allUsers] = await Promise.all([
                storageService.fetchStores(),
                storageService.fetchReports(),
                storageService.fetchUsers() // FIX: Fetch all users from Supabase
            ]);
            
            setStores(allStores);
            setUsers(allUsers);

            let filtered = allReports;
            if (user.role === UserRole.EMPLOYEE) {
                filtered = allReports.filter(r => r.storeId === user.storeId);
            }
            setReports(filtered.sort((a, b) => b.timestamp - a.timestamp));
        } catch (error) {
            console.error("Failed to load reports:", error);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [user]);

  const getStoreName = (id: string) => stores.find(s => s.id === id)?.name || 'Unknown Store';
  const getUserName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? `${u.name} (${u.username})` : 'Unknown User';
  };

  const formatMoney = (amount: number) => `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText size={24} className="text-blue-600"/> Reports History
        </h2>
        <div className="text-sm text-gray-500">
          Total Reports: {reports.length}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Report Date</th>
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4 text-right">EOD Net Sales</th>
                <th className="px-6 py-4 text-right">Total EOD Sales</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/>Loading reports...</td></tr>
              ) : reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors text-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap">{report.date}</td>
                  <td className="px-6 py-4">{getStoreName(report.storeId)}</td>
                  <td className="px-6 py-4">{getUserName(report.userId)}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatMoney(report.recordedProfit || 0)}</td>
                  <td className={`px-6 py-4 text-right font-bold ${report.discrepancy < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {report.discrepancy < 0 ? '-' : (report.discrepancy > 0 ? '+' : '')}{formatMoney(Math.abs(report.discrepancy))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      report.status === 'BALANCED' ? 'bg-green-100 text-green-700' :
                      report.status === 'SHORTAGE' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {report.status === 'OVERAGE' ? 'SURPLUS' : report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setSelectedReport(report)}
                      className="text-blue-600 hover:text-blue-800 flex items-center justify-center mx-auto gap-1 text-xs font-bold uppercase"
                    >
                      <Eye size={16}/> View
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No reports found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Detailed Breakdown Modal ... */}
    </div>
  );
};