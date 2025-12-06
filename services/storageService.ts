import { User, Store, ReportData, UserRole, InventoryItem, PosTransaction } from '../types';
import { supabase } from './supabaseClient';

const KEYS = {
  USERS: 'cfs_users',
  CURRENT_USER: 'cfs_current_user',
  POS_TRANSACTIONS: 'cfs_pos_transactions',
};

// Seed Data
const seedData = () => {
  const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  if (!users.find((u: User) => u.username === 'admin')) {
    const adminUser: User = { id: 'u_admin', username: 'admin', password: '950421', name: 'Boss Manager', role: UserRole.ADMIN };
    users.push(adminUser);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  }
};

seedData();

export const storageService = {
  // Auth
  login: (username: string, password?: string): User | null => {
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.username === username);
    if (user) {
      if (user.password && user.password !== password) return null;
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },
  saveSessionUser: (user: User) => localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user)),
  logout: () => localStorage.removeItem(KEYS.CURRENT_USER),
  getCurrentUser: (): User | null => {
    const u = localStorage.getItem(KEYS.CURRENT_USER);
    return u ? JSON.parse(u) : null;
  },

  // Stores (Supabase Connected)
  fetchStores: async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) { console.error('Error fetching stores:', error); return []; }
    return (data || []).map((s: any) => ({ id: s.id, name: s.name, location: s.location }));
  },
  addStore: async (store: Store) => {
    const { error } = await supabase.from('stores').insert([{ id: store.id, name: store.name, location: store.location }]);
    if (error) throw error;
  },
  deleteStore: async (storeId: string) => {
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
  },

  // Users
  // FIX: Added fetchUsers to get all users from Supabase
  fetchUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return (data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        storeId: u.store_id || u.storeId || u.storeid,
        status: u.status,
        password: u.password,
        permissions: u.permissions || []
    }));
  },
  // Legacy function for local users (e.g., fallback admin)
  getUsers: (): User[] => JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
  
  // Reports (Supabase Connected)
  fetchReports: async (): Promise<ReportData[]> => {
    const { data, error } = await supabase.from('reports').select('*');
    if (error) { console.error('Error fetching reports:', error); return []; }
    return (data || []).map((r: any) => ({
      id: r.id, storeId: r.store_id, userId: r.user_id, date: r.date, timestamp: r.timestamp,
      sodGpo: Number(r.sod_gpo), sodGcash: Number(r.sod_gcash), sodPettyCash: Number(r.sod_petty_cash), fundIns: Number(r.fund_ins),
      customSales: r.custom_sales || [], posSalesDetails: r.pos_sales_details || [],
      bankTransferFees: Number(r.bank_transfer_fees), operationalExpenses: Number(r.operational_expenses), operationalExpensesNote: r.operational_expenses_note,
      eodGpo: Number(r.eod_gpo), eodGcash: Number(r.eod_gcash), eodActualCash: Number(r.eod_actual_cash),
      gcashNotebook: r.gcash_notebook !== null ? Number(r.gcash_notebook) : undefined,
      totalStartFund: Number(r.total_start_fund), totalEndAssets: Number(r.total_end_assets), totalNetSales: Number(r.total_net_sales),
      totalExpenses: Number(r.total_expenses), theoreticalGrowth: Number(r.theoretical_growth), recordedProfit: Number(r.recorded_profit),
      discrepancy: Number(r.discrepancy), status: r.status, notes: r.notes
    }));
  },
  saveReport: async (report: ReportData) => {
    const dbReport = {
      id: report.id, store_id: report.storeId, user_id: report.userId, date: report.date, timestamp: report.timestamp,
      sod_gpo: report.sodGpo, sod_gcash: report.sodGcash, sod_petty_cash: report.sodPettyCash, fund_ins: report.fundIns,
      custom_sales: report.customSales, pos_sales_details: report.posSalesDetails,
      bank_transfer_fees: report.bankTransferFees, operational_expenses: report.operationalExpenses, operational_expenses_note: report.operationalExpensesNote,
      eod_gpo: report.eodGpo, eod_gcash: report.eodGcash, eod_actual_cash: report.eodActualCash,
      gcash_notebook: report.gcashNotebook, total_start_fund: report.totalStartFund, total_end_assets: report.totalEndAssets,
      total_net_sales: report.totalNetSales, total_expenses: report.totalExpenses, theoretical_growth: report.theoreticalGrowth,
      recorded_profit: report.recordedProfit, discrepancy: report.discrepancy, status: report.status, notes: report.notes
    };
    const { error } = await supabase.from('reports').insert([dbReport]);
    if (error) { console.error('Error saving report:', error); throw error; }
  },

  // Inventory (Supabase Connected)
  getInventory: async (): Promise<InventoryItem[]> => { /* ... implementation ... */ return []; },
  addInventoryItem: async (item: InventoryItem) => { /* ... implementation ... */ },
  updateInventoryItem: async (item: InventoryItem) => { /* ... implementation ... */ },
  updateInventoryStock: async (itemId: string, qty: number) => { /* ... implementation ... */ },

  // POS Transactions (Local Storage)
  savePosTransaction: (transaction: PosTransaction) => { /* ... implementation ... */ },
  getPosTransactions: (storeId: string, date: string): PosTransaction[] => { return []; },
  markPosTransactionsAsReported: (storeId: string, date: string, reportId: string) => { /* ... implementation ... */ }
};