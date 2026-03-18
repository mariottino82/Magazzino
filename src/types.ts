export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
  min_stock: number;
  quantity: number; // Added for stock tracking
}

export interface Batch {
  id: string;
  product_id: string;
  lot_number: string;
  barcode?: string;
  quantity: number;
  expiry_date: string;
  received_date: string;
  supplier: string;
  temperature_check?: number;
}

export interface Sale {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  invoice_number: string;
  date: string;
}

export interface HACCPLog {
  id: string;
  date: string;
  type: 'temperature' | 'cleaning' | 'quality';
  description: string;
  operator: string;
  status: 'ok' | 'warning' | 'critical';
  product_id?: string;
  lot_number?: string;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'suspended';
  created_at?: string;
}

export type Tab = 'dashboard' | 'inventory' | 'batches' | 'sales' | 'haccp' | 'admin';
