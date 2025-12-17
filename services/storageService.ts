import { User, Store, ReportData, UserRole, InventoryItem, PosTransaction } from '../types';
import { supabase } from './supabaseClient';

const KEYS = {
  USERS: 'cfs_users',
  CURRENT_USER: 'cfs_current_user',
  POS_TRANSACTIONS: 'cfs_pos_transactions',
  TRANSACTION_CATEGORIES: 'cfs_transaction_categories',
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
  login: async (username: string, password?: string): Promise<User | null> => {
    // Check seeded/local users first
    const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    const localUser = users.find((u: User) => u.username === username);
    if (localUser && (!localUser.password || localUser.password === password)) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(localUser));
      return localUser;
    }

    // Fallback: check Supabase users table for active user
    try {
      const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
      if (error) {
        console.error('Error looking up user during login:', error);
        return null;
      }
      if (!data) return null;

      const appUser: User = {
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role,
        storeId: data.store_id || data.storeId || data.storeid,
        status: data.status,
        password: data.password,
        permissions: data.permissions || []
      };

      // If password is set in DB, validate it (plain-text comparison expected here)
      if (appUser.password && password && appUser.password !== password) {
        return null;
      }

      // Accept user (no password provided or matches)
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(appUser));
      return appUser;
    } catch (e) {
      console.error('Login fallback failed:', e);
      return null;
    }
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
    console.log('storageService.fetchReports returned', (data || []).length, 'rows');
    return (data || []).map((r: any) => ({
      id: r.id, storeId: r.store_id, userId: r.user_id, date: r.date, timestamp: r.timestamp || Date.parse(r.date),
      sodGpo: Number(r.sod_gpo || 0), sodGcash: Number(r.sod_gcash || 0), sodPettyCash: Number(r.sod_petty_cash || 0),
      // Mapped fundIn/cashAtm (handle older records by defaulting to 0)
      fundIns: 0, // Deprecated
      fundIn: Number(r.fund_in || 0),
      cashAtm: Number(r.cash_atm || 0),
      customSales: r.custom_sales || [], posSalesDetails: r.pos_sales_details || [],
      bankTransferFees: Number(r.bank_transfer_fees || 0), operationalExpenses: Number(r.operational_expenses || 0), operationalExpensesNote: r.operational_expenses_note,
      expenses: r.expenses || [],
      eodGpo: Number(r.eod_gpo || 0), eodGcash: Number(r.eod_gcash || 0), eodActualCash: Number(r.eod_actual_cash || 0),
      gcashNotebook: r.gcash_notebook !== null && r.gcash_notebook !== undefined ? Number(r.gcash_notebook) : undefined,
      totalStartFund: Number(r.total_start_fund || 0), totalEndAssets: Number(r.total_end_assets || 0), totalNetSales: Number(r.total_net_sales || 0),
      totalExpenses: Number(r.total_expenses || 0), theoreticalGrowth: Number(r.theoretical_growth || 0), recordedProfit: Number(r.recorded_profit || 0),
      discrepancy: Number(r.discrepancy || 0), status: r.status, notes: r.notes
    }));
  },
  saveReport: async (report: ReportData) => {
    const dbReport = {
      id: report.id,
      store_id: report.storeId, user_id: report.userId, date: report.date, timestamp: report.timestamp,
      sod_gpo: report.sodGpo, sod_gcash: report.sodGcash, sod_petty_cash: report.sodPettyCash,
      // Save new fields
      fund_in: report.fundIn,
      cash_atm: report.cashAtm,
      fund_ins: 0, // Deprecated
      custom_sales: report.customSales, pos_sales_details: report.posSalesDetails,
      bank_transfer_fees: report.bankTransferFees, operational_expenses: report.operationalExpenses, operational_expenses_note: report.operationalExpensesNote,
      expenses: report.expenses,
      eod_gpo: report.eodGpo, eod_gcash: report.eodGcash, eod_actual_cash: report.eodActualCash,
      gcash_notebook: report.gcashNotebook, total_start_fund: report.totalStartFund, total_end_assets: report.totalEndAssets,
      total_net_sales: report.totalNetSales, total_expenses: report.totalExpenses, theoretical_growth: report.theoreticalGrowth,
      recorded_profit: report.recordedProfit, discrepancy: report.discrepancy, status: report.status, notes: report.notes
    };
    // Use upsert so saving an existing report updates it, while new reports are inserted
    const { error } = await supabase.from('reports').upsert([dbReport], { onConflict: 'id' });
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
        id: i.id, storeId: i.store_id, name: i.name, cost: Number(i.cost), price: Number(i.price), stock: Number(i.stock),
        category: i.category || ''
    }));
  },
  addInventoryItem: async (item: InventoryItem): Promise<{ success: boolean; error?: any }> => {
    try {
      console.log('📝 Adding inventory item:', item);
      
      // Verify store exists
      const { data: storeExists, error: storeError } = await supabase.from('stores').select('id').eq('id', item.storeId).single();
      if (storeError || !storeExists) {
        console.error('❌ Store not found:', item.storeId);
        return { success: false, error: { message: `Store ${item.storeId} does not exist` } };
      }
      
      const insertPayload = {
        id: item.id,
        store_id: item.storeId,
        name: item.name,
        cost: item.cost,
        price: item.price,
        stock: item.stock,
        category: item.category && item.category.trim() ? item.category : null
      };
      console.log('📤 Insert payload:', insertPayload);
      const { error } = await supabase.from('inventory').insert([insertPayload]);
      if (error) {
        console.error('❌ Error adding item:', error.message, error.details, error.code);
        const details = error.details ? ` (${error.details})` : '';
        const msg = error.code === 'PGRST116' ? 'Permission denied. RLS policy blocks insert.' : error.message;
        return { success: false, error: { message: msg + details } };
      }
      console.log('✅ Item added successfully');
      return { success: true };
    } catch (e: any) {
      console.error('❌ Unexpected error adding item:', e.message);
      return { success: false, error: { message: e.message } };
    }
  },
  updateInventoryItem: async (item: InventoryItem): Promise<{ success: boolean; error?: any }> => {
    try {
      console.log('✏️ Updating inventory item:', item);
      const updatePayload = {
        store_id: item.storeId,
        name: item.name,
        cost: item.cost,
        price: item.price,
        stock: item.stock,
        category: item.category && item.category.trim() ? item.category : null
      };
      console.log('📤 Update payload:', updatePayload);
      const { error } = await supabase.from('inventory').update(updatePayload).eq('id', item.id);
      if (error) {
        console.error('❌ Error updating item:', error.message, error.details, error.code);
        const details = error.details ? ` (${error.details})` : '';
        const msg = error.code === 'PGRST116' ? 'Permission denied. RLS policy blocks update.' : error.message;
        return { success: false, error: { message: msg + details } };
      }
      console.log('✅ Item updated successfully');
      return { success: true };
    } catch (e: any) {
      console.error('❌ Unexpected error updating item:', e.message);
      return { success: false, error: { message: e.message } };
    }
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
          reportId: t.report_id, status: t.status || 'COMPLETED',
          // Audit/void metadata (may be null)
          voidedBy: t.voided_by || null,
          voidNote: t.void_note || null,
          voidedAt: t.voided_at || null
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
    voidTransaction: async (transactionId: string, voidedById?: string | null, note?: string | null) => {
        const { data: tx, error: fetchError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
        if (fetchError || !tx) throw new Error("Transaction not found");
        if (tx.status === 'VOIDED') throw new Error("Transaction already voided");

        // Try to update with audit fields. If the DB schema doesn't have those columns
        // (common when schema differs), fall back to a minimal update so voiding still works.
        const basePayload: any = { status: 'VOIDED' };
        const auditPayload: any = { ...basePayload, voided_at: new Date().toISOString() };
        if (voidedById) auditPayload.voided_by = voidedById;
        if (note) auditPayload.void_note = note;

        // First attempt: update including audit columns
        let updateError: any = null;
        try {
          const res = await supabase.from('transactions').update(auditPayload).eq('id', transactionId);
          updateError = (res as any).error;
          if (updateError) throw updateError;
        } catch (err: any) {
          console.warn('voidTransaction: audit update failed, retrying minimal update', err?.message || err);
          // Retry with minimal payload (status only)
          const { error: minimalErr } = await supabase.from('transactions').update(basePayload).eq('id', transactionId);
          if (minimalErr) throw minimalErr;
        }

        // Restore inventory stock for each item in the transaction
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
  },
  // Transaction Categories - stored locally and synced
  getTransactionCategories: (): string[] => {
    const cats = localStorage.getItem(KEYS.TRANSACTION_CATEGORIES);
    return cats ? JSON.parse(cats) : ['Printing Services', 'Repair Services', 'Accessories', 'Other'];
  },
  addTransactionCategory: (category: string): string[] => {
    const cats = storageService.getTransactionCategories();
    const trimmed = category.trim();
    if (trimmed && !cats.includes(trimmed)) {
      cats.push(trimmed);
      localStorage.setItem(KEYS.TRANSACTION_CATEGORIES, JSON.stringify(cats));
    }
    return cats;
  },
};