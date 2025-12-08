import { User, Store, ReportData, UserRole, InventoryItem, PosTransaction } from '../types';
import { supabase } from './supabaseClient';

const KEYS = {
  USERS: 'cfs_users',
  CURRENT_USER: 'cfs_current_user',
  POS_TRANSACTIONS: 'cfs_pos_transactions',
};

const seedData = () => {
  const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  if (!users.find((u: User) => u.username === 'admin')) {
    const adminUser: User = { 
      id: 'u_admin', 
      username: 'admin', 
      password: '950421', 
      name: 'Boss Manager', 
      role: UserRole.ADMIN,
      permissions: ['dashboard', 'analytics', 'reports', 'entry', 'pos', 'inventory', 'transactions', 'manage-stores', 'manage-users'] 
    };
    users.push(adminUser);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  }
};
seedData();

export const storageService = {
  login: (username: string, password?: string): User | null => {
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.username === username);
    if (user && (!user.password || user.password === password)) {
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
  fetchStores: async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) { console.error('Error fetching stores:', error); return []; }
    return data || [];
  },
  addStore: async (store: Store) => {
    const { error } = await supabase.from('stores').insert([store]);
    if (error) throw error;
  },
  deleteStore: async (storeId: string) => {
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
  },
  fetchUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) { console.error('Error fetching users:', error); return []; }
    return (data || []).map((u: any) => ({
        id: u.id, username: u.username, name: u.name, role: u.role,
        storeId: u.store_id, status: u.status, password: u.password,
        permissions: u.permissions || []
    }));
  },
  fetchReports: async (): Promise<ReportData[]> => {
    const { data, error } = await supabase.from('reports').select('*');
    if (error) { console.error('Error fetching reports:', error); return []; }
    return (data || []).map((r: any) => ({
      id: r.id, storeId: r.store_id, userId: r.user_id, date: r.date, timestamp: r.timestamp,
      sodGpo: Number(r.sod_gpo), sodGcash: Number(r.sod_gcash), sodPettyCash: Number(r.sod_petty_cash),
      // Mapped fundIn/cashAtm (handle older records by defaulting to 0)
      fundIns: 0, // Deprecated
      fundIn: Number(r.fund_in || 0),
      cashAtm: Number(r.cash_atm || 0),
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
      store_id: report.storeId, user_id: report.userId, date: report.date, timestamp: report.timestamp,
      sod_gpo: report.sodGpo, sod_gcash: report.sodGcash, sod_petty_cash: report.sodPettyCash,
      // Save new fields
      fund_in: report.fundIn,
      cash_atm: report.cashAtm,
      fund_ins: 0, // Deprecated
      custom_sales: report.customSales, pos_sales_details: report.posSalesDetails,
      bank_transfer_fees: report.bankTransferFees, operational_expenses: report.operationalExpenses, operational_expenses_note: report.operationalExpensesNote,
      eod_gpo: report.eodGpo, eod_gcash: report.eodGcash, eod_actual_cash: report.eodActualCash,
      gcash_notebook: report.gcashNotebook, total_start_fund: report.totalStartFund, total_end_assets: report.totalEndAssets,
      total_net_sales: report.totalNetSales, total_expenses: report.totalExpenses, theoretical_growth: report.theoreticalGrowth,
      recorded_profit: report.recordedProfit, discrepancy: report.discrepancy, status: report.status, notes: report.notes
    };
    const { error } = await supabase.from('reports').insert([dbReport]);
    if (error) { console.error('Error saving report:', error); throw error; }

    const { error: txError } = await supabase.from('transactions')
        .update({ report_id: report.id })
        .eq('store_id', report.storeId)
        .eq('date', report.date)
        .is('report_id', null); 
    if(txError) console.error("Error linking transactions to report:", txError);
  },
  deleteReport: async (reportId: string) => {
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (error) throw error;
  },
  getInventory: async (): Promise<InventoryItem[]> => {
    const { data, error } = await supabase.from('inventory').select('*');
    if (error) { console.error('Error fetching inventory:', error.message); return []; }
    return (data || []).map((i: any) => ({
        id: i.id, storeId: i.store_id, name: i.name, cost: Number(i.cost), price: Number(i.price), stock: Number(i.stock)
    }));
  },
  addInventoryItem: async (item: InventoryItem): Promise<{ success: boolean; error?: any }> => {
    const { error } = await supabase.from('inventory').insert([{
        id: item.id, store_id: item.storeId, name: item.name, cost: item.cost, price: item.price, stock: item.stock
    }]);
    if (error) { console.error('Error adding item:', error); return { success: false, error }; }
    return { success: true };
  },
  updateInventoryItem: async (item: InventoryItem): Promise<{ success: boolean; error?: any }> => {
    const { error } = await supabase.from('inventory').update({
        store_id: item.storeId, name: item.name, cost: item.cost, price: item.price, stock: item.stock
    }).eq('id', item.id);
    if (error) { console.error('Error updating item:', error); return { success: false, error }; }
    return { success: true };
  },
  updateInventoryStock: async (itemId: string, quantityChange: number) => {
    const { data: current } = await supabase.from('inventory').select('stock').eq('id', itemId).single();
    if (current) {
        const newStock = current.stock + quantityChange;
        await supabase.from('inventory').update({ stock: newStock }).eq('id', itemId);
    }
  },
  savePosTransaction: async (transaction: PosTransaction) => {
      console.log("💾 Saving POS Transaction to DB:", transaction);
      const dbTx = {
          id: transaction.id, store_id: transaction.storeId, date: transaction.date, timestamp: transaction.timestamp,
          items: transaction.items, total_amount: transaction.totalAmount, payment_amount: transaction.paymentAmount,
          cashier_name: transaction.cashierName, report_id: transaction.reportId || null, status: 'COMPLETED'
      };
      console.log("📤 Sending to Supabase:", dbTx);
      const { error } = await supabase.from('transactions').insert([dbTx]);
      if(error) { 
          console.error("❌ Error saving transaction to Supabase:", error); 
          console.error("Error details:", error.message, error.code, error.details);
          alert("CRITICAL ERROR: Failed to save transaction to database. " + error.message); 
      } 
      else { 
          console.log("✅ Transaction saved successfully!"); 
      }
  },
  fetchTransactions: async (): Promise<any[]> => {
      console.log("🔍 Attempting to fetch transactions...");
      const { data, error } = await supabase.from('transactions').select('*');
      if (error) { 
          console.error("❌ Error fetching transactions:", error); 
          console.error("Error details:", error.message, error.code, error.details);
          return []; 
      }
      console.log("✅ Successfully fetched transactions:", data);
      return (data || []).map((t: any) => ({
          id: t.id, storeId: t.store_id, date: t.date, timestamp: t.timestamp, items: t.items || [],
          totalAmount: Number(t.total_amount), paymentAmount: Number(t.payment_amount), cashierName: t.cashier_name,
          reportId: t.report_id, status: t.status || 'COMPLETED'
      }));
  },
  getPosTransactions: async (storeId: string, date: string): Promise<PosTransaction[]> => {
      const { data, error } = await supabase.from('transactions')
        .select('*').eq('store_id', storeId).eq('date', date).is('report_id', null).eq('status', 'COMPLETED');
      if (error) { console.error("Error fetching pending transactions:", error); return []; }
      return (data || []).map((t: any) => ({
          id: t.id, storeId: t.store_id, date: t.date, timestamp: t.timestamp, items: t.items,
          totalAmount: Number(t.total_amount), paymentAmount: Number(t.payment_amount), cashierName: t.cashier_name, reportId: t.report_id
      }));
  },
  markPosTransactionsAsReported: async (storeId: string, date: string, reportId: string) => {},
  voidTransaction: async (transactionId: string) => {
      const { data: tx, error: fetchError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
      if (fetchError || !tx) throw new Error("Transaction not found");
      if (tx.status === 'VOIDED') throw new Error("Transaction already voided");
      const { error: updateError } = await supabase.from('transactions').update({ status: 'VOIDED' }).eq('id', transactionId);
      if (updateError) throw updateError;
      const items = tx.items as any[];
      for (const item of items) { await storageService.updateInventoryStock(item.id, item.quantity); }
  },
  resetSystem: async (currentAdminId: string) => {
    await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', currentAdminId).neq('username', 'admin');
    await supabase.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    localStorage.removeItem(KEYS.POS_TRANSACTIONS);
  }
};