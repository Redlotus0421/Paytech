
import React, { useState, useEffect } from 'react';
import { User, ReportData, Store, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Eye, FileText, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ReportsProps {
  user: User;
}

export const Reports: React.FC<ReportsProps> = ({ user }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  useEffect(() => {
    const loadData = async () => {
        const allStores = await storageService.fetchStores();
        setStores(allStores);
        
        const allReports = storageService.getReports();
        const allUsers = storageService.getUsers();
        setUsers(allUsers);

        let filtered = allReports;
        if (user.role === UserRole.EMPLOYEE) {
            filtered = allReports.filter(r => r.storeId === user.storeId);
        }
        setReports(filtered.sort((a, b) => b.timestamp - a.timestamp));
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
              {reports.map((report) => (
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
              {reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No reports found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED BREAKDOWN MODAL */}
      {selectedReport && (() => {
          // Perform dynamic recalculation with strict number casting for robust legacy support
          const startFund = Number(selectedReport.totalStartFund);
          const endAssets = Number(selectedReport.totalEndAssets);
          // Actual Cash Growth (Total EOD Sales - System Derived)
          const growth = endAssets - startFund;
          
          // --- LEGACY SUPPORT ---
          // Aggressively check for legacy revenue fields from older report versions
          let legacyManualRevenue = 0;
          if ((selectedReport as any).printerRevenue) legacyManualRevenue += Number((selectedReport as any).printerRevenue);
          if ((selectedReport as any).printerServiceRevenue) legacyManualRevenue += Number((selectedReport as any).printerServiceRevenue);
          if ((selectedReport as any).serviceRevenue) legacyManualRevenue += Number((selectedReport as any).serviceRevenue);
          if ((selectedReport as any).otherSales) legacyManualRevenue += Number((selectedReport as any).otherSales);

          // Calculate Manual Revenue (New System + Legacy)
          const manualRevenue = (selectedReport.customSales || []).reduce((a, b) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
          
          // Calculate POS Revenue
          const posRevenue = (selectedReport.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
          
          // Total Sales Revenue (Gross Price)
          const totalSalesRevenue = manualRevenue + posRevenue;

          // --- GCash Net Logic ---
          // Formula: Cash Growth - Total Sales Revenue
          // This represents the surplus cash after accounting for all recorded sales
          const derivedGcashNet = growth - totalSalesRevenue;
          
          // --- OVERRIDE LOGIC ---
          const notebookGcash = selectedReport.gcashNotebook !== undefined ? Number(selectedReport.gcashNotebook) : undefined;
          const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;

          // --- EOD Net Sales Logic ---
          // Formula: Effective GCash Net + Item Net Profits - Expenses
          
          // Calculate Item Net Profits
          // 1. Manual Items Net (Revenue - Cost).
          const manualNet = (selectedReport.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
          
          // 2. POS Items Net (Price - Cost) * Qty
          const posNet = (selectedReport.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
          
          const totalItemsNet = manualNet + posNet;

          // Expenses
          const totalExpenses = Number(selectedReport.bankTransferFees || 0) + Number(selectedReport.operationalExpenses || 0);

          // Final Calculation
          // Gross Sales Income = Effective GCash Net + Total Items Net
          const grossSalesIncome = usedGcashNet + totalItemsNet;
          
          // EOD Net Sales = Gross Sales Income - Expenses
          const finalEodNet = grossSalesIncome - totalExpenses;

          // --- ACTUAL EOD SALES LOGIC ---
          // Formula: Effective GCash Net + Total Sales Revenue (Gross)
          const actualEodSales = usedGcashNet + totalSalesRevenue;

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
                <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-700">
                    <X size={24} />
                </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    {/* 1. Start of Day */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-2">1. Start of Day (SOD)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div><span className="block text-xs text-gray-600 mb-1">GPO Start</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodGpo))}</span></div>
                            <div><span className="block text-xs text-gray-600 mb-1">GCash Start</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodGcash))}</span></div>
                            <div><span className="block text-xs text-gray-600 mb-1">Petty Cash</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodPettyCash))}</span></div>
                            <div><span className="block text-xs text-gray-600 mb-1">Fund Ins / ATM</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.fundIns))}</span></div>
                            <div className="col-span-2 md:col-span-4 text-right pt-2 border-t border-gray-200">
                                <span className="text-sm text-gray-600 mr-2">Total Start Fund:</span>
                                <span className="font-bold text-lg text-gray-900">{formatMoney(startFund)}</span>
                            </div>
                        </div>
                    </section>

                    {/* 2. End of Day Assets */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-2">2. End of Day (Assets)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg">
                            <div><span className="block text-xs text-gray-600 mb-1">GPO End</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.eodGpo))}</span></div>
                            <div><span className="block text-xs text-gray-600 mb-1">GCash End</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.eodGcash))}</span></div>
                            <div><span className="block text-xs text-gray-600 mb-1">Actual Cash Count</span><span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.eodActualCash))}</span></div>
                            <div className="col-span-2 md:col-span-3 text-right pt-2 border-t border-blue-200">
                                <span className="text-sm text-gray-600 mr-2">Total End Assets:</span>
                                <span className="font-bold text-lg text-gray-900">{formatMoney(endAssets)}</span>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        
                        {/* LEFT COLUMN: SALES & NET SALES */}
                        <div className="flex flex-col gap-6 h-full">
                            <div className="border border-gray-200 rounded-lg overflow-hidden text-sm flex flex-col flex-1">
                                <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-200 shrink-0">SALES (MARGINS)</div>
                                <div className="flex-1 bg-white">
                                <table className="w-full">
                                    <tbody className="divide-y divide-gray-100">
                                        
                                        {/* 1a. GCash Net (Derived) - Only show if not overridden or if user wants to compare */}
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700 font-medium">GCash Net <span className="text-xs font-normal text-gray-400">(Derived)</span></td>
                                            <td className={`p-2 pr-3 text-right font-mono font-bold ${notebookGcash !== undefined ? 'text-gray-400 line-through' : (derivedGcashNet < 0 ? 'text-red-600' : 'text-green-600')}`}>
                                                {formatMoney(derivedGcashNet)}
                                            </td>
                                        </tr>

                                        {/* 1b. GCash Net (Notebook) - Show if exists */}
                                        {notebookGcash !== undefined && (
                                             <tr className="bg-purple-50">
                                                <td className="p-2 pl-3 text-purple-900 font-bold">GCash Net <span className="text-xs font-normal text-purple-600">(Notebook)</span></td>
                                                <td className="p-2 pr-3 text-right font-mono font-bold text-purple-900">
                                                    {formatMoney(notebookGcash)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* 2. POS Sales Nets */}
                                        {selectedReport.posSalesDetails && selectedReport.posSalesDetails.map((item, i) => (
                                            <tr key={`pos-${i}`} className="bg-white">
                                                <td className="p-2 pl-3 text-gray-700 pl-6">
                                                    {item.name} <span className="text-xs text-gray-400">(x{item.quantity} Net)</span>
                                                </td>
                                                <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                    {formatMoney((Number(item.price) - Number(item.cost)) * Number(item.quantity))}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* 3. Manual Sales Nets */}
                                        {(selectedReport.customSales || []).map((s, i) => (
                                            <tr key={`manual-${i}`} className="bg-white">
                                                <td className="p-2 pl-3 text-gray-700 pl-6">{s.name} <span className="text-xs text-gray-400">(Net)</span></td>
                                                <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                    {formatMoney((Number(s.amount) || 0) - (Number(s.cost) || 0))}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Legacy Printer Revenue Support (Explicit Row) */}
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
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">{formatMoney(Number(selectedReport.bankTransferFees) || 0)}</td>
                                        </tr>
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">
                                                Other Expenses
                                                {selectedReport.operationalExpensesNote && (
                                                    <span className="block text-xs text-gray-500 font-normal italic">
                                                        ({selectedReport.operationalExpensesNote})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2 pr-3 text-right font-mono text-gray-900">{formatMoney(Number(selectedReport.operationalExpenses) || 0)}</td>
                                        </tr>
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
    </div>
  );
};
