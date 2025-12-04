
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  username: string;
  password?: string; // Added for auth
  role: UserRole;
  storeId?: string; // If employee, which store they belong to
  name: string;
  status?: 'active' | 'inactive';
}

export interface Store {
  id: string;
  name: string;
  location: string;
}

// Generic Sales Transaction (Manual Entry)
export interface SalesTransaction {
  id: string;
  name: string;
  amount: number;
  cost?: number; // Added for Net calculation
}

// POS Transaction Record
export interface PosTransaction {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  items: CartItem[];
  totalAmount: number;
  paymentAmount: number;
  cashierName: string;
  reportId?: string; // Links transaction to a specific EOD report
}

export interface ReportData {
  id: string;
  storeId: string;
  userId: string;
  date: string;
  timestamp: number;

  // Start of Day (SOD)
  sodGpo: number;
  sodGcash: number;
  sodPettyCash: number;
  fundIns: number;

  // Sales Operations
  customSales: SalesTransaction[]; // Manual entries
  posSalesDetails?: CartItem[]; // Aggregated POS items (Snapshot)
  
  // Expenses
  bankTransferFees: number;
  operationalExpenses: number; // Food, supplies
  operationalExpensesNote?: string; // Description of expenses

  // End of Day (EOD) Assets
  eodGpo: number;
  eodGcash: number;
  eodActualCash: number;

  // Manual Override
  gcashNotebook?: number; // User entered GCash Net from notebook

  // Calculated Fields (Saved for historical integrity)
  totalStartFund: number;
  totalEndAssets: number;
  totalNetSales: number;
  totalExpenses: number;
  theoreticalGrowth: number; // Actual Cash Sales
  recordedProfit: number; // EOD Net Sales
  discrepancy: number; // Total EOD Sales (Variance or Notebook Value)
  
  status: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' | 'SURPLUS';
  notes?: string;
}

// Inventory & POS
export interface InventoryItem {
  id: string;
  storeId: string;
  name: string;
  cost: number;
  price: number;
  stock: number;
}

export interface CartItem extends InventoryItem {
  quantity: number;
}
