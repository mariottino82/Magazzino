export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string; // kg, litri, pezzi, etc.
  minStock: number;
  barcode?: string;
}

export interface Batch {
  id: string;
  productId: string;
  lotNumber: string;
  quantity: number;
  expiryDate: string;
  receivedDate: string;
  supplier: string;
  temperatureCheck?: number; // HACCP
}

export interface HACCPLog {
  id: string;
  date: string;
  type: 'temperature' | 'cleaning' | 'quality';
  description: string;
  operator: string;
  status: 'ok' | 'warning' | 'critical';
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'suspended';
  created_at?: string;
}

export type Tab = 'dashboard' | 'inventory' | 'batches' | 'haccp' | 'admin';
