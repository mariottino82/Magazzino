/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, ClipboardCheck, AlertTriangle, Plus, Search, 
  Calendar, Thermometer, History, Trash2, CheckCircle2, XCircle, LogOut, Users, Settings,
  FileSpreadsheet, FileText, Camera, ScanLine, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Batch, HACCPLog, Tab, User } from './types';
import { api } from './api';
import { exportToExcel, exportToPDF } from './utils/exportUtils';
import { BulkOperation } from './components/BulkOperation';
import { BarcodeScanner } from './components/BarcodeScanner';

const APP_NAME = 'GestioneSpighe';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [logs, setLogs] = useState<HACCPLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
      if (user.role === 'admin') fetchUsers();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const userData = await api.auth.me();
      setUser(userData);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [p, b, l] = await Promise.all([
        api.inventory.getProducts(),
        api.inventory.getBatches(),
        api.inventory.getLogs()
      ]);
      setProducts(p);
      setBatches(b);
      setLogs(l);
    } catch (err: any) {
      console.error('Fetch error:', err);
      // Only logout if it's explicitly an auth error and we're not already loading
      if (err.message.includes('Unauthorized') || err.message.includes('401')) {
        console.warn('Sessione scaduta o non valida. Reindirizzamento al login.');
        setUser(null);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const u = await api.admin.getUsers();
      setUsers(u);
    } catch (err: any) {
      console.error('Fetch users error:', err);
      if (err.message.includes('Unauthorized') || err.message.includes('401')) {
        setUser(null);
      }
    }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      if (authMode === 'login') {
        const userData = await api.auth.login({ email, password });
        if (userData.token) {
          localStorage.setItem('auth_token', userData.token);
        }
        setUser(userData);
      } else {
        const res = await api.auth.register({ email, password });
        alert(res.message);
        setAuthMode('login');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    localStorage.removeItem('auth_token');
    setUser(null);
    setActiveTab('dashboard');
  };

  const inventoryStats = useMemo(() => {
    return products.map(p => {
      const productBatches = batches.filter(b => b.product_id === p.id);
      const totalQty = productBatches.reduce((sum, b) => sum + b.quantity, 0);
      const isLowStock = totalQty < p.min_stock;
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expiringSoon = productBatches.some(b => {
        const exp = new Date(b.expiry_date);
        return exp <= nextWeek && exp >= today;
      });
      const expired = productBatches.some(b => new Date(b.expiry_date) < today);
      return { ...p, totalQty, isLowStock, expiringSoon, expired };
    });
  }, [products, batches]);

  const handleExportInventory = (type: 'excel' | 'pdf') => {
    const data = inventoryStats.map(s => ({
      Prodotto: s.name,
      Categoria: s.category,
      Giacenza: `${s.totalQty} ${s.unit}`,
      Stato: s.isLowStock ? 'SOTTO SCORTA' : 'OK',
      Barcode: s.barcode || '-'
    }));

    if (type === 'excel') {
      exportToExcel(data, `Inventario_${APP_NAME}`);
    } else {
      const headers = ['Prodotto', 'Categoria', 'Giacenza', 'Stato', 'Barcode'];
      const pdfData = data.map(item => [item.Prodotto, item.Categoria, item.Giacenza, item.Stato, item.Barcode]);
      exportToPDF(`Report Inventario ${APP_NAME}`, headers, pdfData, `Inventario_${APP_NAME}`);
    }
  };

  const handleExportBatches = (type: 'excel' | 'pdf') => {
    const data = batches.map(b => {
      const p = products.find(prod => prod.id === b.product_id);
      return {
        Prodotto: p?.name || 'Sconosciuto',
        Lotto: b.lot_number,
        Quantità: b.quantity,
        Scadenza: b.expiry_date,
        Fornitore: b.supplier,
        Ricevuto: b.received_date
      };
    });

    if (type === 'excel') {
      exportToExcel(data, `Lotti_${APP_NAME}`);
    } else {
      const headers = ['Prodotto', 'Lotto', 'Quantità', 'Scadenza', 'Fornitore', 'Ricevuto'];
      const pdfData = data.map(item => [item.Prodotto, item.Lotto, item.Quantità, item.Scadenza, item.Fornitore, item.Ricevuto]);
      exportToPDF(`Report Lotti e Scadenze ${APP_NAME}`, headers, pdfData, `Lotti_${APP_NAME}`);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Package className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          </div>
          <h2 className="text-xl font-bold mb-6 text-center">{authMode === 'login' ? 'Accedi' : 'Registrati'}</h2>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Email</label>
              <input name="email" type="email" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Password</label>
              <input name="password" type="password" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">
              {authMode === 'login' ? 'Entra' : 'Invia Richiesta'}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-4 text-sm text-gray-500 hover:text-emerald-600">
            {authMode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-72 bg-white z-50 md:hidden shadow-2xl"
            >
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <Package className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">{APP_NAME}</h1>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-900">
                    <X size={24} />
                  </button>
                </div>
                <nav className="space-y-2 flex-1">
                  <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
                  <NavItem active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }} icon={<Package size={20} />} label="Inventario" />
                  <NavItem active={activeTab === 'batches'} onClick={() => { setActiveTab('batches'); setIsMobileMenuOpen(false); }} icon={<History size={20} />} label="Lotti & Scadenze" />
                  <NavItem active={activeTab === 'haccp'} onClick={() => { setActiveTab('haccp'); setIsMobileMenuOpen(false); }} icon={<ClipboardCheck size={20} />} label="HACCP" />
                  {user.role === 'admin' && <NavItem active={activeTab === 'admin'} onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }} icon={<Users size={20} />} label="Utenti" />}
                </nav>
                <div className="pt-6 border-t border-gray-100">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <LogOut size={20} /> <span className="text-sm font-medium">Esci</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-10 hidden md:block">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center"><Package className="text-white w-5 h-5" /></div>
            <h1 className="text-xl font-bold tracking-tight">{APP_NAME}</h1>
          </div>
          <nav className="space-y-1">
            <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Inventario" />
            <NavItem active={activeTab === 'batches'} onClick={() => setActiveTab('batches')} icon={<History size={20} />} label="Lotti & Scadenze" />
            <NavItem active={activeTab === 'haccp'} onClick={() => setActiveTab('haccp')} icon={<ClipboardCheck size={20} />} label="HACCP" />
            {user.role === 'admin' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={20} />} label="Utenti" />}
          </nav>
          <div className="absolute bottom-6 left-6 right-6">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all">
              <LogOut size={20} /> <span className="text-sm font-medium">Esci</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="md:ml-64 p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
              <p className="text-gray-500 text-sm">Benvenuto, {user.email}</p>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
            >
              <Menu size={24} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Cerca..." className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-full md:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsBulkOpen(true)} 
                className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-bold"
                title="Operazione Multipla"
              >
                <ScanLine size={18} /> <span className="hidden lg:inline">Bulk</span>
              </button>
              {activeTab !== 'dashboard' && (
                <button 
                  onClick={() => {
                    if (activeTab === 'inventory') setIsAddProductOpen(true);
                    else if (activeTab === 'batches') setIsAddBatchOpen(true);
                    else if (activeTab === 'haccp') setIsAddLogOpen(true);
                    else if (activeTab === 'admin') setIsAddUserOpen(true);
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus size={18} /> <span className="hidden sm:inline">Aggiungi</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Prodotti" value={products.length} icon={<Package className="text-blue-600" />} color="blue" />
                <StatCard label="Sotto Scorta" value={inventoryStats.filter(s => s.isLowStock).length} icon={<AlertTriangle className="text-amber-600" />} color="amber" alert={inventoryStats.filter(s => s.isLowStock).length > 0} />
                <StatCard label="In Scadenza" value={inventoryStats.filter(s => s.expiringSoon).length} icon={<Calendar className="text-orange-600" />} color="orange" alert={inventoryStats.filter(s => s.expiringSoon).length > 0} />
                <StatCard label="Scaduti" value={inventoryStats.filter(s => s.expired).length} icon={<XCircle className="text-red-600" />} color="red" alert={inventoryStats.filter(s => s.expired).length > 0} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><AlertTriangle size={20} className="text-amber-500" /> Avvisi Critici</h3>
                  <div className="space-y-3">
                    {inventoryStats.filter(s => s.isLowStock || s.expiringSoon || s.expired).slice(0, 5).map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${s.expired ? 'bg-red-500' : s.expiringSoon ? 'bg-orange-500' : 'bg-amber-500'}`} />
                          <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-gray-500">{s.expired ? 'Scaduto' : s.expiringSoon ? 'In scadenza' : 'Sotto scorta'}</p></div>
                        </div>
                        <span className="text-sm font-mono font-bold">{s.totalQty} {s.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><ClipboardCheck size={20} className="text-emerald-500" /> Ultimi Registri HACCP</h3>
                  <div className="space-y-3">
                    {logs.slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          {log.type === 'temperature' ? <Thermometer size={16} className="text-blue-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
                          <div><p className="text-sm font-medium">{log.description}</p><p className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</p></div>
                        </div>
                        <StatusBadge status={log.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <button onClick={() => handleExportInventory('excel')} className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100">
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button onClick={() => handleExportInventory('pdf')} className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100">
                  <FileText size={16} /> PDF
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotto</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Barcode</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Categoria</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Giacenza</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Stato</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {inventoryStats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.barcode?.includes(searchTerm)).map(s => (
                      <tr 
                        key={s.id} 
                        className="hover:bg-emerald-50/50 cursor-pointer transition-colors group"
                        onClick={() => setSelectedProduct(s)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{s.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{s.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{s.barcode || '-'}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">{s.category}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-gray-900">{s.totalQty} {s.unit}</span>
                            <span className="text-[10px] text-gray-400 uppercase">Giacenza Totale</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {s.isLowStock ? (
                            <div className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle size={14} />
                              <span className="text-[10px] font-bold uppercase">Sotto Scorta</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 size={14} />
                              <span className="text-[10px] font-bold uppercase">Disponibile</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'batches' && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <button onClick={() => handleExportBatches('excel')} className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100">
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button onClick={() => handleExportBatches('pdf')} className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100">
                  <FileText size={16} /> PDF
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotto</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Lotto</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Quantità</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Scadenza</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Azioni</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {batches.filter(b => {
                      const p = products.find(prod => prod.id === b.product_id);
                      return p?.name.toLowerCase().includes(searchTerm.toLowerCase()) || b.lot_number.includes(searchTerm);
                    }).map(b => {
                      const p = products.find(prod => prod.id === b.product_id);
                      const isExpired = new Date(b.expiry_date) < new Date();
                      const today = new Date();
                      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                      const isExpiringSoon = new Date(b.expiry_date) <= nextWeek && !isExpired;

                      return (
                        <tr 
                          key={b.id} 
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedBatch(b)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{p?.name}</span>
                              <span className="text-[10px] text-gray-400 uppercase">{b.supplier}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">LOT</div>
                              <span className="font-mono font-medium">{b.lot_number}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-blue-600">{b.quantity} {p?.unit}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-500' : 'text-gray-700'}`}>
                                {b.expiry_date}
                              </span>
                              <span className="text-[10px] text-gray-400 uppercase">Scadenza</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {isExpired ? (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold uppercase">Scaduto</span>
                            ) : isExpiringSoon ? (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-bold uppercase">In Scadenza</span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold uppercase">In Stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'haccp' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Data</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Tipo</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Descrizione</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Operatore</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.date).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          log.type === 'temperature' ? 'bg-blue-50 text-blue-700' : 
                          log.type === 'cleaning' ? 'bg-purple-50 text-purple-700' : 
                          'bg-emerald-50 text-emerald-700'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{log.description}</td>
                      <td className="px-6 py-4 text-sm">{log.operator}</td>
                      <td className="px-6 py-4"><StatusBadge status={log.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'admin' && user.role === 'admin' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Email</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Ruolo</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Stato</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Azioni</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium">{u.email}</td>
                      <td className="px-6 py-4">
                        <select value={u.role} onChange={(e) => api.admin.updateUser(u.id, { role: e.target.value }).then(fetchUsers)} className="bg-gray-50 border border-gray-200 rounded-lg text-xs p-1">
                          <option value="user">User</option><option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select value={u.status} onChange={(e) => api.admin.updateUser(u.id, { status: e.target.value }).then(fetchUsers)} className="bg-gray-50 border border-gray-200 rounded-lg text-xs p-1">
                          <option value="pending">Pending</option><option value="approved">Approved</option><option value="suspended">Suspended</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => api.admin.deleteUser(u.id).then(fetchUsers)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatePresence>
      </main>

      {isAddProductOpen && (
        <Modal title="Nuovo Prodotto" onClose={() => setIsAddProductOpen(false)}>
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); await api.inventory.addProduct({ name: fd.get('name'), category: fd.get('category'), unit: fd.get('unit'), min_stock: Number(fd.get('min_stock')), barcode: fd.get('barcode') }); fetchData(); setIsAddProductOpen(false); }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome</label><input name="name" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Codice a Barre (Barcode)</label>
              <div className="flex gap-2">
                <input name="barcode" id="barcode-input" className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono" placeholder="Scansiona o inserisci..." />
                <button type="button" onClick={() => setIsScannerOpen(true)} className="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200">
                  <Camera size={20} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Categoria</label><select name="category" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>Fresco</option><option>Secco</option><option>Surgelato</option></select></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Unità</label><select name="unit" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>kg</option><option>litri</option><option>pezzi</option></select></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scorta Minima</label><input name="min_stock" type="number" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Salva Prodotto</button>
          </form>
        </Modal>
      )}

      {isBulkOpen && (
        <BulkOperation 
          products={products} 
          onClose={() => setIsBulkOpen(false)} 
          onSuccess={() => fetchData()} 
        />
      )}

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={(code) => {
            const input = document.getElementById('barcode-input') as HTMLInputElement;
            if (input) input.value = code;
            setIsScannerOpen(false);
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {isAddBatchOpen && (
        <Modal title="Nuovo Carico" onClose={() => setIsAddBatchOpen(false)}>
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = { productId: fd.get('productId'), lotNumber: fd.get('lotNumber'), quantity: Number(fd.get('quantity')), expiryDate: fd.get('expiryDate'), supplier: fd.get('supplier'), temperatureCheck: fd.get('temp') ? Number(fd.get('temp')) : null }; await api.inventory.addBatch(data); if (data.temperatureCheck) await api.inventory.addLog({ type: 'temperature', description: `Ricezione: ${data.temperatureCheck}°C (Lotto ${data.lotNumber})`, operator: user.email, status: data.temperatureCheck > 4 ? 'warning' : 'ok' }); fetchData(); setIsAddBatchOpen(false); }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto</label><select name="productId" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto</label><input name="lotNumber" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Quantità</label><input name="quantity" type="number" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scadenza</label><input name="expiryDate" type="date" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Temp. (°C)</label><input name="temp" type="number" step="0.1" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Fornitore</label><input name="supplier" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">Registra</button>
          </form>
        </Modal>
      )}

      {isAddLogOpen && (
        <Modal title="Nuovo Registro HACCP" onClose={() => setIsAddLogOpen(false)}>
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); await api.inventory.addLog({ type: fd.get('type'), description: fd.get('description'), operator: user.email, status: fd.get('status') }); fetchData(); setIsAddLogOpen(false); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Tipo</label>
              <select name="type" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <option value="quality">Controllo Qualità</option>
                <option value="cleaning">Pulizia</option>
                <option value="temperature">Temperatura</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Descrizione</label>
              <textarea name="description" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" rows={3} placeholder="Dettagli dell'operazione..." />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Stato</label>
              <select name="status" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <option value="ok">Conforme (OK)</option>
                <option value="warning">Avviso (Warning)</option>
                <option value="critical">Critico (Critical)</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">Salva Registro</button>
          </form>
        </Modal>
      )}

      {isAddUserOpen && user.role === 'admin' && (
        <Modal title="Nuovo Utente" onClose={() => setIsAddUserOpen(false)}>
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); await api.admin.addUser({ email: fd.get('email'), password: fd.get('password'), role: fd.get('role'), status: fd.get('status') }); fetchUsers(); setIsAddUserOpen(false); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Email</label>
              <input name="email" type="email" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Password</label>
              <input name="password" type="password" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Ruolo</label>
                <select name="role" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Stato</label>
                <select name="status" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">Crea Utente</button>
          </form>
        </Modal>
      )}

      {selectedProduct && (
        <Modal title={`Dettagli Prodotto: ${selectedProduct.name}`} onClose={() => setSelectedProduct(null)}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            const fd = new FormData(e.currentTarget); 
            await api.inventory.updateProduct(selectedProduct.id, { 
              name: fd.get('name'), 
              category: fd.get('category'), 
              unit: fd.get('unit'), 
              min_stock: Number(fd.get('min_stock')), 
              barcode: fd.get('barcode') 
            }); 
            fetchData(); 
            setSelectedProduct(null); 
          }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome</label><input name="name" defaultValue={selectedProduct.name} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Codice a Barre (Barcode)</label>
              <div className="flex gap-2">
                <input name="barcode" defaultValue={selectedProduct.barcode || ''} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Categoria</label><select name="category" defaultValue={selectedProduct.category} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>Fresco</option><option>Secco</option><option>Surgelato</option></select></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Unità</label><select name="unit" defaultValue={selectedProduct.unit} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>kg</option><option>litri</option><option>pezzi</option></select></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scorta Minima</label><input name="min_stock" type="number" defaultValue={selectedProduct.min_stock} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={async () => { if(confirm('Eliminare definitivamente questo prodotto e tutti i suoi lotti?')) { await api.inventory.deleteProduct(selectedProduct.id); fetchData(); setSelectedProduct(null); } }} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors">Elimina</button>
              <button type="submit" className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Aggiorna</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedBatch && (
        <Modal title={`Dettagli Lotto: ${selectedBatch.lot_number}`} onClose={() => setSelectedBatch(null)}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            const fd = new FormData(e.currentTarget); 
            await api.inventory.updateBatch(selectedBatch.id, { 
              lotNumber: fd.get('lotNumber'), 
              quantity: Number(fd.get('quantity')), 
              expiryDate: fd.get('expiryDate'), 
              supplier: fd.get('supplier'), 
              temperatureCheck: fd.get('temp') ? Number(fd.get('temp')) : null 
            }); 
            fetchData(); 
            setSelectedBatch(null); 
          }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto</label>
              <div className="p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium">
                {products.find(p => p.id === selectedBatch.product_id)?.name}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto</label><input name="lotNumber" defaultValue={selectedBatch.lot_number} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Quantità</label><input name="quantity" type="number" defaultValue={selectedBatch.quantity} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scadenza</label><input name="expiryDate" type="date" defaultValue={selectedBatch.expiry_date} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Temp. (°C)</label><input name="temp" type="number" step="0.1" defaultValue={selectedBatch.temperature_check || ''} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Fornitore</label><input name="supplier" defaultValue={selectedBatch.supplier} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={async () => { if(confirm('Eliminare questo lotto?')) { await api.inventory.deleteBatch(selectedBatch.id); fetchData(); setSelectedBatch(null); } }} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors">Elimina</button>
              <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">Aggiorna</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
      {icon} <span className="text-sm">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, color, alert }: { label: string, value: number, icon: React.ReactNode, color: string, alert?: boolean }) {
  return (
    <div className={`bg-white p-5 rounded-2xl border ${alert ? 'border-red-100 bg-red-50/10' : 'border-gray-200'} shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg bg-${color}-50`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {alert && <span className="text-red-500 animate-pulse"><AlertTriangle size={16} /></span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'critical' }) {
  const styles = { ok: 'bg-emerald-50 text-emerald-700 border-emerald-100', warning: 'bg-amber-50 text-amber-700 border-amber-100', critical: 'bg-red-50 text-red-700 border-red-100' };
  return <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${styles[status]}`}>{status}</span>;
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
      >
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
          <h3 className="text-lg sm:text-xl font-bold truncate pr-4">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors shrink-0">
            <XCircle size={28} className="sm:w-8 sm:h-8" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
