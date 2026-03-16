import { Product, Batch, HACCPLog, User } from './types';

const fetchApi = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const contentType = res.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = { error: await res.text() };
  }

  if (!res.ok) {
    throw new Error(data.error || `Server error (${res.status}): ${res.statusText}`);
  }
  return data;
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
    updateUser: (id: string, data: any) => fetchApi(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteUser: (id: string) => fetchApi(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  inventory: {
    getProducts: () => fetchApi('/api/products'),
    addProduct: (data: any) => fetchApi('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id: string, data: any) => fetchApi(`/api/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProduct: (id: string) => fetchApi(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getProductByBarcode: (barcode: string) => fetchApi(`/api/products/barcode/${encodeURIComponent(barcode)}`),
    getBatches: () => fetchApi('/api/batches'),
    addBatch: (data: any) => fetchApi('/api/batches', { method: 'POST', body: JSON.stringify(data) }),
    updateBatch: (id: string, data: any) => fetchApi(`/api/batches/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addBulkBatches: (data: any) => fetchApi('/api/batches/bulk', { method: 'POST', body: JSON.stringify(data) }),
    deleteBatch: (id: string) => fetchApi(`/api/batches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getLogs: () => fetchApi('/api/logs'),
    addLog: (data: any) => fetchApi('/api/logs', { method: 'POST', body: JSON.stringify(data) }),
  },
};
