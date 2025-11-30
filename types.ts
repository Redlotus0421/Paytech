export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  username: string;
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

// Sub-types for the form data
export interface ToyItem {
  id: string;
  name: string;
  capital: number;
  price: number;
}

export interface CoffeeItem {
  id: string;
  name: string;
  capital: number;
  price: number;
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
  toys: ToyItem[];
  coffee: CoffeeItem[];
  printerRevenue: number;
  
  // GCash Transaction Specifics
  gcashSystemAmount: number;
  gcashNotebookRecord: number;

  // Expenses
  bankTransferFees: number;
  operationalExpenses: number; // Food, supplies

  // End of Day (EOD) Assets
  eodGpo: number;
  eodGcash: number;
  eodActualCash: number;

  // Calculated Fields (Saved for historical integrity)
  totalStartFund: number;
  totalEndAssets: number;
  totalNetSales: number;
  totalExpenses: number;
  theoreticalGrowth: number;
  recordedProfit: number;
  discrepancy: number;
  
  status: 'BALANCED' | 'SHORTAGE' | 'OVERAGE';
  notes?: string;
}