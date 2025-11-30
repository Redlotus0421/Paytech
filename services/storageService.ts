import { User, Store, ReportData, UserRole } from '../types';

const KEYS = {
  USERS: 'cfs_users',
  STORES: 'cfs_stores',
  REPORTS: 'cfs_reports',
  CURRENT_USER: 'cfs_current_user',
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
      { id: 'u_admin', username: 'admin', name: 'Boss Manager', role: UserRole.ADMIN },
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
  login: (username: string): User | null => {
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.username === username);
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },

  // Helper to save a user from Supabase to local session
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
  }
};