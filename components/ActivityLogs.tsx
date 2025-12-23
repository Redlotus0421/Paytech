import React, { useState, useEffect } from 'react';
import { ActivityLog, User } from '../types';
import { storageService } from '../services/storageService';
import { History, Search, RefreshCw, Loader2 } from 'lucide-react';

export const ActivityLogs: React.FC<{ user: User }> = ({ user }) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [filterUser, setFilterUser] = useState('');
    const [filterAction, setFilterAction] = useState('');

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const [logsData, usersData] = await Promise.all([
                storageService.fetchActivityLogs(),
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
    }, []);

    const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();

    const filteredLogs = logs.filter(log => {
        const logUser = usersMap[log.userId];
        const displayName = logUser ? `${logUser.name} (${logUser.username})` : log.userName;
        
        if (filterUser && !displayName.toLowerCase().includes(filterUser.toLowerCase())) return false;
        if (filterAction && log.action !== filterAction) return false;
        return true;
    });

    return (
        <div className="flex flex-col gap-6 min-h-0 w-full min-w-0 h-full">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm shrink-0">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <History size={24} className="text-blue-600"/> Activity Logs
                </h2>
                <button 
                    onClick={loadLogs} 
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="Refresh Logs"
                >
                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-0 flex-1">
                <div className="p-4 border-b border-gray-100 flex gap-4 shrink-0">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Filter by User..." 
                            value={filterUser}
                            onChange={e => setFilterUser(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm w-full"
                        />
                    </div>
                    <div className="relative flex-1 max-w-xs">
                        <select 
                            value={filterAction}
                            onChange={e => setFilterAction(e.target.value)}
                            className="pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm w-full appearance-none bg-white"
                            style={{ backgroundImage: 'none' }} // Remove default arrow to use custom if needed, or just let it be standard select
                        >
                            <option value="">All Actions</option>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                        {/* Add a custom arrow or just rely on browser default */}
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 w-48">Timestamp</th>
                                <th className="px-6 py-3 w-48">User</th>
                                <th className="px-6 py-3 w-48">Action</th>
                                <th className="px-6 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/>Loading logs...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No activity logs found.</td></tr>
                            ) : (
                                filteredLogs.map(log => {
                                    const logUser = usersMap[log.userId];
                                    const displayName = logUser ? `${logUser.name} (${logUser.username})` : log.userName;
                                    
                                    return (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-900">{displayName}</td>
                                        <td className="px-6 py-3">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">{log.details}</td>
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
