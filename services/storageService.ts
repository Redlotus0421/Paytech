
import { User, Store, ReportData, UserRole, InventoryItem, PosTransaction } from '../types';
import { supabase } from './supabaseClient';

const KEYS = {
  USERS: 'cfs_users',
  STORES: 'cfs_stores',
  REPORTS: 'cfs_reports',
  CURRENT_USER: 'cfs_current_user',
  INVENTORY: 'cfs_inventory',
  POS_TRANSACTIONS: 'cfs_pos_transactions',
};

// Seed Data
const seedData = () => {
  if (!localStorage.getItem(KEYS.STORES)) {
    const stores: Store[] = [
      { id: 'store_1', name: 'Food Court Main', location: 'Downtown' },
      { id: 'store_2', name: 'La Carlota Branch', location: 'La Carlota' },
    ];
    localStorage.setItem(KEYS.STORES, JSON.stringify(stores));
  }

  if (!localStorage.getItem(KEYS.USERS)) {
    const users: User[] = [
      { id: 'u_admin', username: 'admin', password: '950421', name: 'Boss Manager', role: UserRole.ADMIN },
      { id: 'u_emp1', username: 'jane', name: 'Jane Doe', role: UserRole.EMPLOYEE, storeId: 'store_1' },
      { id: 'u_emp2', username: 'john', name: 'John Smith', role: UserRole.EMPLOYEE, storeId: 'store_2' },
    ];
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  }
};

// Initialize
seedData();

export const storageService = {
  // Auth
  login: (username: string, password?: string): User | null => {
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.username === username);
    
    if (user) {
      if (user.password && user.password !== password) {
        return null;
      }
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },

  saveSessionUser: (user: User) => {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  },

  logout: () => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },

  getCurrentUser: (): User | null => {
    const u = localStorage.getItem(KEYS.CURRENT_USER);
    return u ? JSON.parse(u) : null;
  },

  // Stores
  getStores: (): Store[] => {
    return JSON.parse(localStorage.getItem(KEYS.STORES) || '[]');
  },

  addStore: (store: Store) => {
    const stores = storageService.getStores();
    stores.push(store);
    localStorage.setItem(KEYS.STORES, JSON.stringify(stores));
  },

  // Users
  getUsers: (): User[] => {
    return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  },

  addUser: (user: User) => {
    const users = storageService.getUsers();
    users.push(user);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  updateUser: (updatedUser: User) => {
    const users = storageService.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    }
  },

  deleteUser: (userId: string) => {
    const users = storageService.getUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    localStorage.setItem(KEYS.USERS, JSON.stringify(filteredUsers));
  },

  // Reports
  getReports: (): ReportData[] => {
    return JSON.parse(localStorage.getItem(KEYS.REPORTS) || '[]');
  },

  saveReport: (report: ReportData) => {
    const reports = storageService.getReports();
    reports.push(report);
    localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
  },

  getReportsByStore: (storeId: string): ReportData[] => {
    const reports = storageService.getReports();
    return reports.filter(r => r.storeId === storeId);
  },

  // Inventory (Supabase Connected)
  getInventory: async (): Promise<InventoryItem[]> => {
    const { data, error } = await supabase.from('inventory').select('*');
    if (error) {
        console.error('Error fetching inventory:', error);
        return [];
    }
    // Map DB columns (snake_case) to Types (camelCase)
    return (data || []).map((i: any) => ({
        id: i.id,
        storeId: i.store_id,
        name: i.name,
        cost: i.cost,
        price: i.price,
        stock: i.stock
    }));
  },

  addInventoryItem: async (item: InventoryItem) => {
    const { error } = await supabase.from('inventory').insert([{
        id: item.id,
        store_id: item.storeId,
        name: item.name,
        cost: item.cost,
        price: item.price,
        stock: item.stock
    }]);
    if (error) console.error('Error adding inventory item:', error);
  },

  updateInventoryItem: async (item: InventoryItem) => {
    const { error } = await supabase.from('inventory').update({
        store_id: item.storeId,
        name: item.name,
        cost: item.cost,
        price: item.price,
        stock: item.stock
    }).eq('id', item.id);
    if (error) console.error('Error updating inventory item:', error);
  },

  updateInventoryStock: async (itemId: string, quantityChange: number) => {
    // Optimistic update via read-modify-write
    // In production, use an RPC function like 'increment_stock' to be atomic
    const { data: current } = await supabase.from('inventory').select('stock').eq('id', itemId).single();
    if (current) {
        const newStock = current.stock + quantityChange;
        await supabase.from('inventory').update({ stock: newStock }).eq('id', itemId);
    }
  },

  // POS Transactions
  savePosTransaction: (transaction: PosTransaction) => {
      const txs = JSON.parse(localStorage.getItem(KEYS.POS_TRANSACTIONS) || '[]');
      txs.push(transaction);
      localStorage.setItem(KEYS.POS_TRANSACTIONS, JSON.stringify(txs));
  },

  getPosTransactions: (storeId: string, date: string): PosTransaction[] => {
      const txs = JSON.parse(localStorage.getItem(KEYS.POS_TRANSACTIONS) || '[]');
      // Filter by Store AND Date AND check if NOT yet reported (reportId is undefined)
      return txs.filter((t: PosTransaction) => 
        t.storeId === storeId && 
        t.date === date && 
        !t.reportId
      );
  },

  markPosTransactionsAsReported: (storeId: string, date: string, reportId: string) => {
    const txs = JSON.parse(localStorage.getItem(KEYS.POS_TRANSACTIONS) || '[]');
    const updatedTxs = txs.map((t: PosTransaction) => {
        // Tag transactions that match the criteria and haven't been tagged yet
        if (t.storeId === storeId && t.date === date && !t.reportId) {
            return { ...t, reportId };
        }
        return t;
    });
    localStorage.setItem(KEYS.POS_TRANSACTIONS, JSON.stringify(updatedTxs));
  }
};
