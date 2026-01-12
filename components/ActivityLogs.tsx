import React, { useState, useEffect } from 'react';
import { ActivityLog, User } from '../types';
import { storageService } from '../services/storageService';
import { Search, Download, Loader2 } from 'lucide-react';

export const ActivityLogs: React.FC<{ user: User }> = ({ user }) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [filterUser, setFilterUser] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            // First ensure void logs are synced
            await storageService.syncVoidLogs();

            const [logsData, usersData] = await Promise.all([
                storageService.fetchActivityLogs(filterDateStart, filterDateEnd),
                storageService.fetchUsers()
            ]);
            setLogs(logsData);
            
            const uMap: Record<string, User> = {};
            usersData.forEach(u => { uMap[u.id] = u; });
            setUsersMap(uMap);
        } catch (error) {
            console.error('Failed to load logs', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [filterDateStart, filterDateEnd]); // Reload when date filters change

    const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();

    const filteredLogs = logs.filter(log => {
        if (filterUser && log.userId !== filterUser) return false;
        if (filterAction && log.action !== filterAction) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const user = usersMap[log.userId];
            const userName = user ? user.username : log.userName;
            const fullName = user ? user.name : '';
            return (
                log.details.toLowerCase().includes(query) ||
                log.action.toLowerCase().includes(query) ||
                userName.toLowerCase().includes(query) ||
                fullName.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const handleExportCSV = () => {
        const headers = ['Time', 'Type', 'Description', 'Full Name', 'Username', 'Role'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => {
                const user = usersMap[log.userId];
                const userName = user ? user.username : log.userName;
                const fullName = user ? user.name : '';
                const role = user ? user.role : 'Unknown';
                return [
                    `"${new Date(log.timestamp).toLocaleString()}"`,
                    `"${log.action}"`,
                    `"${log.details.replace(/"/g, '""')}"`,
                    `"${fullName}"`,
                    `"${userName}"`,
                    `"${role}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `activity_logs_${new Date().toISOString().slice(0,10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getActionStyle = (action: string) => {
        const lower = action.toLowerCase();
        if (lower.includes('delete') || lower.includes('void')) return 'bg-red-100 text-red-700 border-red-200';
        if (lower.includes('add') || lower.includes('create') || lower.includes('submit')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (lower.includes('update') || lower.includes('edit')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (lower.includes('login')) return 'bg-gray-100 text-gray-700 border-gray-200';
        if (lower.includes('sale') || lower.includes('transaction')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="flex flex-col gap-6 min-h-0 w-full min-w-0 h-full p-6 bg-gray-50">
            {/* Header Section */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
                <p className="text-gray-500 mt-1">Track all system activities and user actions</p>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-0 flex-1 overflow-hidden">
                
                {/* Card Header */}
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
                    <p className="text-sm text-gray-500 mt-1">View and filter system activity logs</p>
                
                    {/* Toolbar */}
                    <div className="mt-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                        {/* Search */}
                        <div className="relative w-full md:w-96">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search activities..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                            />
                        </div>

                        {/* Filters & Actions */}
                        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center justify-end">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={filterDateStart} 
                                    onChange={e => setFilterDateStart(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    title="Start Date"
                                />
                                <span className="text-gray-400">-</span>
                                <input 
                                    type="date" 
                                    value={filterDateEnd} 
                                    onChange={e => setFilterDateEnd(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    title="End Date"
                                />
                            </div>

                            <select 
                                value={filterAction}
                                onChange={e => setFilterAction(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="">All Types</option>
                                {uniqueActions.map(action => (
                                    <option key={action} value={action}>{action}</option>
                                ))}
                            </select>

                            <select 
                                value={filterUser}
                                onChange={e => setFilterUser(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="">All Users</option>
                                {Object.values(usersMap).map(u => (
                                    <option key={u.id} value={u.id}>{u.username}</option>
                                ))}
                            </select>

                            <button 
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Download size={16} />
                                Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-medium border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 w-1/4 font-medium">Time</th>
                                <th className="px-6 py-4 w-1/5 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Description</th>
                                <th className="px-6 py-4 w-64 font-medium">Performed By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-12 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2"/>Loading logs...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center text-gray-400">No activity logs found matching your filters.</td></tr>
                            ) : (
                                filteredLogs.map(log => {
                                    const logUser = usersMap[log.userId];
                                    const userName = logUser ? logUser.username : log.userName;
                                    const fullName = logUser ? logUser.name : '';
                                    const role = logUser ? logUser.role : 'Unknown Role';
                                    const date = new Date(log.timestamp);
                                    
                                    return (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                            {date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}, {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionStyle(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700 font-medium">
                                            {log.details}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="font-medium text-gray-900">
                                                    {fullName || userName} 
                                                    {fullName && <span className="text-xs text-gray-500 ml-1">({userName})</span>}
                                                </div>
                                                <span className="text-xs text-gray-500">{role}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
