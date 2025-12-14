import React, { useState, useEffect } from 'react';
import { User, ReportData, Store, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Eye, FileText, X, CheckCircle, AlertTriangle, Loader2, Edit2, Trash2 } from 'lucide-react';

export const Reports: React.FC<{ user: User }> = ({ user }) => {
    const [reports, setReports] = useState<ReportData[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStoreId, setFilterStoreId] = useState('');
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
            const [allStores, allReports, allUsers] = await Promise.all([
                storageService.fetchStores(),
                storageService.fetchReports(),
                storageService.fetchUsers()
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

    useEffect(() => { loadData(); }, [user]);

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

    const saveEditedReport = async () => {
        if (!selectedReport || !editReportData) return;
        try {
            const merged: ReportData = { ...selectedReport, ...(editReportData as ReportData) } as ReportData;
            await storageService.saveReport(merged);
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

    // Apply UI filters to reports
    const filteredReports = reports.filter(r => {
        if (filterStoreId && r.storeId !== filterStoreId) return false;
        if (monthFilter) {
            const m = new Date(r.date).getMonth() + 1;
            if (m !== Number(monthFilter)) return false;
        }
        if (startDate && new Date(r.date) < new Date(startDate)) return false;
        if (endDate && new Date(r.date) > new Date(endDate)) return false;
        return true;
    }).sort((a,b)=> b.timestamp - a.timestamp);

    // ...existing JSX code for rendering the component goes here...

    return (
        <div className="space-y-6 min-h-0 w-full min-w-0">
            {/* ...existing JSX code... */}
        </div>
    );
};
                                    <span className={`text-right font-semibold ${totalOverNeg < 0 ? 'text-red-600' : 'text-green-600'}`}>{totalOverNeg < 0 ? '' : (totalOverNeg > 0 ? '+' : '')}{formatMoney(totalOverNeg)}</span>
                                    <span className="text-right font-semibold text-green-700">{formatMoney(totalEodNet)}</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
                {/* ...existing code... */}
            </div>
        );
    })()}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-600">Username</label>
                                <input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full border rounded px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600">Password</label>
                                <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full border rounded px-3 py-2" />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setShowAdminAuth(false)} className="px-3 py-1 bg-gray-100 rounded">Cancel</button>
                            <button onClick={confirmAdminAuth} disabled={isAuthenticating} className="px-3 py-1 bg-blue-600 text-white rounded">{isAuthenticating ? 'Checking...' : 'Confirm'}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full min-w-0">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {user.role === UserRole.ADMIN && (
                            <select value={filterStoreId} onChange={e => setFilterStoreId(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900">
                                <option value="">All Branches</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white" />
                        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                            <option value="">Month</option>
                            <option value="01">January</option>
                            <option value="02">February</option>
                            <option value="03">March</option>
                            <option value="04">April</option>
                            <option value="05">May</option>
                            <option value="06">June</option>
                            <option value="07">July</option>
                            <option value="08">August</option>
                            <option value="09">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
                        <button onClick={() => { setStartDate(''); setEndDate(''); setMonthFilter(''); setFilterStoreId(''); }} className="text-sm text-gray-500">Clear</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={loadData} className="text-sm text-blue-600 border border-blue-100 px-3 py-1 rounded">Refresh</button>
                    </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto min-w-0 max-h-[70vh]">
                    {/** compute filteredReports */}
                    {(() => {
                        const start = startDate ? new Date(startDate) : null;
                        const end = endDate ? new Date(endDate) : null;
                        const filtered = reports.filter(r => {
                            if (filterStoreId && r.storeId !== filterStoreId) return false;
                            if (monthFilter) {
                                const m = new Date(r.date).getMonth() + 1;
                                if (m !== Number(monthFilter)) return false;
                            }
                            if (start && new Date(r.date) < start) return false;
                            if (end && new Date(r.date) > end) return false;
                            return true;
                        });
                        (filtered as ReportData[]).sort((a,b)=> b.timestamp - a.timestamp);
                        // expose filteredReports by closure for JSX below
                        (window as any).__filteredReports = filtered;
                    })()}
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
                  const overNegative = notebookGcash !== undefined ? (derivedGcashNet - notebookGcash) : 0;
                  
                  const manualNet = (report.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
                  const posNet = (report.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
                  const totalItemsNet = manualNet + posNet;
                  const totalExpenses = Number(report.bankTransferFees || 0) + Number(report.operationalExpenses || 0);
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
                  <td className="px-6 py-4 text-right font-bold text-green-700">{formatMoney(finalEodNet)}</td>
                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-3">
                                        <button 
                                            onClick={() => { setSelectedReport(report); setIsEditing(false); setEditReportData(null); }}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                            title="View Report"
                                        >
                                            <Eye size={18}/>
                                        </button>
                                        <button
                                            onClick={() => openAdminAuth(report.id, 'edit')}
                                            className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 p-2 rounded-lg transition-colors"
                                            title="Edit Report"
                                        >
                                            <Edit2 size={18}/>
                                        </button>
                                        <button
                                            onClick={() => openAdminAuth(report.id, 'delete')}
                                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                            title="Delete Report"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
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
          </table>
        </div>
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

          const manualRevenue = (selectedReport.customSales || []).reduce((a, b) => a + Number(b.amount || 0), 0) + legacyManualRevenue;
          const posRevenue = (selectedReport.posSalesDetails || []).reduce((a, b) => a + (Number(b.price) * Number(b.quantity)), 0);
                    const totalSalesRevenue = manualRevenue + posRevenue;
                    const derivedGcashNet = growth - totalSalesRevenue;
                    const notebookGcash = (isEditing && editReportData && (editReportData as any).gcashNotebook !== undefined)
                        ? Number((editReportData as any).gcashNotebook)
                        : (selectedReport.gcashNotebook !== undefined ? Number(selectedReport.gcashNotebook) : undefined);
                    const usedGcashNet = notebookGcash !== undefined ? notebookGcash : derivedGcashNet;
          const manualNet = (selectedReport.customSales || []).reduce((a, b) => a + (Number(b.amount || 0) - Number(b.cost || 0)), 0) + legacyManualRevenue;
          const posNet = (selectedReport.posSalesDetails || []).reduce((a, b) => a + ((Number(b.price) - Number(b.cost)) * Number(b.quantity)), 0);
          const totalItemsNet = manualNet + posNet;
          const totalExpenses = Number((isEditing && editReportData && (editReportData as any).bankTransferFees !== undefined) ? (editReportData as any).bankTransferFees : (selectedReport.bankTransferFees || 0)) + Number((isEditing && editReportData && (editReportData as any).operationalExpenses !== undefined) ? (editReportData as any).operationalExpenses : (selectedReport.operationalExpenses || 0));
          const grossSalesIncome = usedGcashNet + totalItemsNet;
          const finalEodNet = grossSalesIncome - totalExpenses;
          const actualEodSales = usedGcashNet + totalSalesRevenue;
          
          // Difference Calculation: System Derived - Notebook
          const difference = notebookGcash !== undefined ? (derivedGcashNet - notebookGcash) : 0;

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
                                    <input type="number" value={(editReportData as any)?.sodPettyCash ?? Number(selectedReport.sodPettyCash || 0)} onChange={e => setEditReportData(prev => ({ ...(prev||{}), sodPettyCash: Number(e.target.value) }))} className="w-full text-right font-mono font-medium text-gray-900 border border-gray-300 rounded px-2 py-1" />
                                ) : (
                                    <span className="font-mono font-medium text-gray-900">{formatMoney(Number(selectedReport.sodPettyCash))}</span>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        
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

                                        {notebookGcash !== undefined && (
                                             <tr className="bg-purple-50">
                                                <td className="p-2 pl-3 text-purple-900 font-bold">GCash Net <span className="text-xs font-normal text-purple-600">(Notebook)</span></td>
                                                <td className="p-2 pr-3 text-right font-mono font-bold text-purple-900">
                                                    {isEditing ? (
                                                        <input type="number" value={(editReportData as any)?.gcashNotebook ?? notebookGcash} onChange={e => setEditReportData(prev => ({ ...(prev||{}), gcashNotebook: Number(e.target.value) }))} className="w-28 text-right border border-gray-300 rounded px-2 py-1" />
                                                    ) : (
                                                        formatMoney(notebookGcash)
                                                    )}
                                                </td>
                                            </tr>
                                        )}

                                        {/* NEW DIFFERENCE ROW */}
                                        {notebookGcash !== undefined && (
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

                                        {(selectedReport.customSales || []).map((s: any, i: number) => (
                                            <tr key={`manual-${i}`} className="bg-white">
                                                <td className="p-2 pl-3 text-gray-700 pl-6">{s.name} <span className="text-xs text-gray-400">(Net)</span></td>
                                                <td className="p-2 pr-3 text-right font-mono text-gray-900">
                                                    {formatMoney((Number(s.amount) || 0) - (Number(s.cost) || 0))}
                                                </td>
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
                                        <tr className="bg-white">
                                            <td className="p-2 pl-3 text-gray-700">
                                                Other Expenses
                                                {selectedReport.operationalExpensesNote && (
                                                    <span className="block text-xs text-gray-500 font-normal italic">
                                                        ({selectedReport.operationalExpensesNote})
                                                    </span>
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
        );
    })()}
  </div>
 );
}