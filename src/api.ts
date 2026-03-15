import { Product, Batch, HACCPLog, User } from './types';

const fetchApi = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Something went wrong');
  }
  return res.json();
};

export const api = {
  auth: {
    login: (credentials: any) => fetchApi('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (credentials: any) => fetchApi('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => fetchApi('/api/auth/logout', { method: 'POST' }),
    me: () => fetchApi('/api/auth/me'),
  },
  admin: {
    getUsers: () => fetchApi('/api/admin/users'),
    addUser: (data: any) => fetchApi('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, data: any) => fetchApi(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteUser: (id: string) => fetchApi(`/api/admin/users/${id}`, { method: 'DELETE' }),
  },
  inventory: {
    getProducts: () => fetchApi('/api/products'),
    addProduct: (data: any) => fetchApi('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    getProductByBarcode: (barcode: string) => fetchApi(`/api/products/barcode/${barcode}`),
    getBatches: () => fetchApi('/api/batches'),
    addBatch: (data: any) => fetchApi('/api/batches', { method: 'POST', body: JSON.stringify(data) }),
    addBulkBatches: (data: any) => fetchApi('/api/batches/bulk', { method: 'POST', body: JSON.stringify(data) }),
    deleteBatch: (id: string) => fetchApi(`/api/batches/${id}`, { method: 'DELETE' }),
    getLogs: () => fetchApi('/api/logs'),
    addLog: (data: any) => fetchApi('/api/logs', { method: 'POST', body: JSON.stringify(data) }),
  },
};
