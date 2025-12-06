
import { User, Store, ReportData, UserRole, InventoryItem, PosTransaction } from '../types';
import { supabase } from './supabaseClient';

const KEYS = {
  USERS: 'cfs_users',
  // STORES key removed as we now use Supabase 'stores' table
  REPORTS: 'cfs_reports',
  CURRENT_USER: 'cfs_current_user',
  INVENTORY: 'cfs_inventory',
  POS_TRANSACTIONS: 'cfs_pos_transactions',
};

// Seed Data
const seedData = () => {
  // Store seeding removed as it is now handled by backend/SQL
  
  if (!localStorage.getItem(KEYS.USERS)) {
    const users: User[] = [
      { id: 'u_admin', username: 'admin', password: '950421', name: 'Boss Manager', role: UserRole.ADMIN },
      // Employee seeds removed from local storage as they should be managed via Admin Settings -> Supabase
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

  // Stores (Supabase Connected)
  fetchStores: async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) {
      console.error('Error fetching stores:', error);
      return [];
    }
    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      location: s.location
    }));
  },

  // Kept for backward compatibility if needed, but should be avoided
  getStores: (): Store[] => {
    return []; 
  },

  addStore: async (store: Store) => {
    // We don't need to generate ID here if DB does it, but keeping UUID logic is fine
    const { error } = await supabase.from('stores').insert([{
      id: store.id,
      name: store.name,
      location: store.location
    }]);
    
    if (error) throw error;
  },

  deleteStore: async (storeId: string) => {
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
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
        console.error('Error fetching inventory:', error.message || JSON.stringify(error));
        return [];
    }
    // Map DB columns (snake_case) to Types (camelCase)
    return (data || []).map((i: any) => ({
        id: i.id,
        storeId: i.store_id || i.storeId, // Handle both just in case
        name: i.name,
        cost: i.cost,
        price: i.price,
        stock: i.stock
    }));
  },

  addInventoryItem: async (item: InventoryItem): Promise<{ success: boolean; error?: any }> => {
    const { error } = await supabase.from('inventory').insert([{
        id: item.id,
        store_id: item.storeId,
        name: item.name,
        cost: item.cost,
        price: item.price,
        stock: item.stock
    }]);
    if (error) {
        console.error('Error adding inventory item:', error.message || JSON.stringify(error));
        return { success: false, error };
    }
    return { success: true };
  },

  updateInventoryItem: async (item: InventoryItem): Promise<{ success: boolean; error?: any }> => {
    const { error } = await supabase.from('inventory').update({
        store_id: item.storeId,
        name: item.name,
        cost: item.cost,
        price: item.price,
        stock: item.stock
    }).eq('id', item.id);
    if (error) {
        console.error('Error updating inventory item:', error.message || JSON.stringify(error));
        return { success: false, error };
    }
    return { success: true };
  },

  updateInventoryStock: async (itemId: string, quantityChange: number) => {
    // Optimistic update via read-modify-write
    // In production, use an RPC function like 'increment_stock' to be atomic
    const { data: current, error: fetchError } = await supabase.from('inventory').select('stock').eq('id', itemId).single();
    
    if (fetchError) {
        console.error('Error fetching item for stock update:', fetchError.message || JSON.stringify(fetchError));
        return;
    }

    if (current) {
        const newStock = current.stock + quantityChange;
        const { error: updateError } = await supabase.from('inventory').update({ stock: newStock }).eq('id', itemId);
        if (updateError) {
            console.error('Error updating stock:', updateError.message || JSON.stringify(updateError));
        }
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
