export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  storeId?: string;
  name: string;
  status?: 'active' | 'inactive';
  permissions?: string[];
}

export interface Store {
  id: string;
  name: string;
  location: string;
}

export interface SalesTransaction {
  id: string;
  name: string;
  amount: number;
  cost?: number;
  category?: string;
}

export interface ExpenseTransaction {
  id: string;
  amount: number;
  description: string;
}

export interface GeneralExpense {
  id: string;
  storeId: string;
  date: string;
  category: string; // 'Payroll' | 'Rent' | 'Utilities' | 'Maintenance' | 'Other'
  amount: number;
  description: string;
  recordedBy: string;
}

export interface PosTransaction {
  id: string;
  storeId: string;
  date: string;
  timestamp: number;
  items: CartItem[];
  totalAmount: number;
  paymentAmount: number;
  cashierName: string;
  reportId?: string;
}
export interface ReportData {
  id: string;
  storeId: string;
  userId: string;
  date: string;
  timestamp: number;
  sodGpo: number;
  sodGcash: number;
  sodPettyCash: number;
  sodPettyCashNote?: string;
  // fundIns: number; // Removed/Deprecated
  fundIn: number; // New field
  cashAtm: number; // New field
  customSales: SalesTransaction[];
  posSalesDetails?: CartItem[];
  bankTransferFees: number;
  otherTransactionFees?: number;
  operationalExpenses: number;
  operationalExpensesNote?: string;
  expenses?: ExpenseTransaction[];
  eodGpo: number;
  eodGcash: number;
  eodActualCash: number;
  gcashNotebook?: number;
  totalStartFund: number;
  totalEndAssets: number;
  totalNetSales: number;
  totalExpenses: number;
  theoreticalGrowth: number;
  recordedProfit: number;
  discrepancy: number;
  status: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' | 'SURPLUS';
  notes?: string;
}
export interface InventoryItem {
  id: string;
  storeId: string;
  name: string;
  cost: number;
  price: number;
  stock: number;
  category?: string;
  isHidden?: boolean;
}
export interface CartItem extends InventoryItem {
  quantity: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: number;
}