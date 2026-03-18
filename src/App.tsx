/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, ClipboardCheck, AlertTriangle, Plus, Search, 
  Calendar, Thermometer, History, Trash2, CheckCircle2, XCircle, LogOut, Users, Settings,
  FileSpreadsheet, FileText, Camera, ScanLine, Menu, X, Phone, Hash, ArrowDownRight, ArrowUpRight, ChevronRight, Filter
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
  const [sales, setSales] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [initialBarcode, setInitialBarcode] = useState('');
  const [isScaricoOpen, setIsScaricoOpen] = useState(false);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaleScannerOpen, setIsSaleScannerOpen] = useState(false);
  const [isHaccpScannerOpen, setIsHaccpScannerOpen] = useState(false);
  const [saleProductId, setSaleProductId] = useState('');
  const [saleBatchId, setSaleBatchId] = useState('');
  const [saleQuantity, setSaleQuantity] = useState<number | string>('');
  const [saleBarcode, setSaleBarcode] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [haccpProductId, setHaccpProductId] = useState('');
  const [haccpLotNumber, setHaccpLotNumber] = useState('');
  const [haccpBarcode, setHaccpBarcode] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [selectedLog, setSelectedLog] = useState<HACCPLog | null>(null);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'product' | 'batch' | 'log' } | null>(null);
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
      const [p, b, l, s] = await Promise.all([
        api.inventory.getProducts(),
        api.inventory.getBatches(),
        api.inventory.getLogs(),
        api.inventory.getSales()
      ]);
      setProducts(p);
      setBatches(b);
      setLogs(l);
      setSales(s);
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
      const totalQty = p.quantity; // Use product.quantity as requested
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
      Stato: s.isLowStock ? 'SOTTO SCORTA' : 'OK'
    }));

    if (type === 'excel') {
      exportToExcel(data, `Inventario_${APP_NAME}`);
    } else {
      const headers = ['Prodotto', 'Categoria', 'Giacenza', 'Stato'];
      const pdfData = data.map(item => [item.Prodotto, item.Categoria, item.Giacenza, item.Stato]);
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

  const handleExportSales = (type: 'excel' | 'pdf') => {
    const data = sales.map(sale => {
      const p = products.find(prod => prod.id === sale.product_id);
      const b = batches.find(batch => batch.id === sale.batch_id);
      return {
        Data: new Date(sale.date).toLocaleString(),
        Prodotto: p?.name || 'Sconosciuto',
        Lotto: b?.lot_number || 'Sconosciuto',
        Quantità: `${sale.quantity} ${p?.unit}`,
        Cliente: sale.customer_name,
        Indirizzo: sale.customer_address
      };
    });

    if (type === 'excel') {
      exportToExcel(data, `Vendite_${APP_NAME}`);
    } else {
      const headers = ['Data', 'Prodotto', 'Lotto', 'Quantità', 'Cliente', 'Indirizzo'];
      const pdfData = data.map(item => [item.Data, item.Prodotto, item.Lotto, item.Quantità, item.Cliente, item.Indirizzo]);
      exportToPDF(`Report Vendite ${APP_NAME}`, headers, pdfData, `Vendite_${APP_NAME}`);
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
                  <NavItem active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }} icon={<Package size={20} />} label="Magazzino" />
                  <NavItem active={activeTab === 'batches'} onClick={() => { setActiveTab('batches'); setIsMobileMenuOpen(false); }} icon={<History size={20} />} label="Prodotti" />
                  <NavItem active={activeTab === 'sales'} onClick={() => { setActiveTab('sales'); setIsMobileMenuOpen(false); }} icon={<FileText size={20} />} label="Vendite" />
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
            <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Magazzino" />
            <NavItem active={activeTab === 'batches'} onClick={() => setActiveTab('batches')} icon={<History size={20} />} label="Prodotti" />
            <NavItem active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={<FileText size={20} />} label="Vendite" />
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
              <h2 className="text-2xl font-bold capitalize">
                {activeTab === 'inventory' ? 'Magazzino' : 
                 activeTab === 'batches' ? 'Prodotti' : 
                 activeTab === 'sales' ? 'Vendite' : 
                 activeTab}
              </h2>
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
              {activeTab !== 'dashboard' && activeTab !== 'batches' && activeTab !== 'inventory' && activeTab !== 'sales' && (
                <button 
                  onClick={() => {
                    if (activeTab === 'haccp') setIsAddLogOpen(true);
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button onClick={() => setIsBulkOpen(true)} className="flex items-center justify-center sm:justify-start gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 w-full sm:w-auto">
                    <Plus size={20} /> Carico
                  </button>
                  <button onClick={() => setIsScaricoOpen(true)} className="flex items-center justify-center sm:justify-start gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 w-full sm:w-auto">
                    <LogOut size={20} className="rotate-90" /> Scarico
                  </button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button onClick={() => handleExportInventory('excel')} className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 flex-1 sm:flex-none justify-center">
                    <FileSpreadsheet size={16} /> Excel
                  </button>
                  <button onClick={() => handleExportInventory('pdf')} className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 flex-1 sm:flex-none justify-center">
                    <FileText size={16} /> PDF
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-nowrap">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotto</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Categoria</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Giacenza</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Stato</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {inventoryStats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) && s.totalQty > 0).map(s => (
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
            </div>
          )}

          {activeTab === 'batches' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button onClick={() => setIsAddProductOpen(true)} className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 w-full sm:w-auto">
                    <Plus size={20} /> Nuovo Prodotto
                  </button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button onClick={() => handleExportBatches('excel')} className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 flex-1 sm:flex-none justify-center">
                    <FileSpreadsheet size={16} /> Excel
                  </button>
                  <button onClick={() => handleExportBatches('pdf')} className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 flex-1 sm:flex-none justify-center">
                    <FileText size={16} /> PDF
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Package size={20} className="text-emerald-600" /> Anagrafica Prodotti
                </h3>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto text-nowrap">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotto</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Categoria</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Scorta Min.</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Giacenza Tot.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {inventoryStats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                          <tr 
                            key={s.id} 
                            className={`hover:bg-emerald-50/50 cursor-pointer transition-colors ${s.isLowStock ? 'bg-red-50/50' : ''}`}
                            onClick={() => setSelectedProduct(s)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{s.name}</span>
                                {s.isLowStock && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase animate-pulse">SOTTO SCORTA</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">{s.category}</span></td>
                            <td className="px-6 py-4 font-mono text-sm">{s.min_stock} {s.unit}</td>
                            <td className={`px-6 py-4 font-mono font-bold ${s.isLowStock ? 'text-red-600' : 'text-gray-900'}`}>{s.totalQty} {s.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <History size={20} className="text-blue-600" /> Lotti & Scadenze
                </h3>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto text-nowrap">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotto</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Lotto</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Barcode</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Scadenza</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Giacenza</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {batches.filter(b => {
                        const p = products.find(prod => prod.id === b.product_id);
                        return p?.name.toLowerCase().includes(searchTerm.toLowerCase()) || b.lot_number.includes(searchTerm) || b.barcode?.includes(searchTerm);
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
                            <td className="px-6 py-4 font-mono text-xs text-gray-400">{b.barcode || '-'}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-500' : 'text-gray-700'}`}>
                                  {b.expiry_date}
                                </span>
                                <span className="text-[10px] text-gray-400 uppercase">Scadenza</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                b.quantity <= 0 ? 'bg-red-100 text-red-700' :
                                b.quantity <= (p?.min_stock || 5) ? 'bg-orange-100 text-orange-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {b.quantity} {p?.unit}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-2 flex-1 md:w-auto">
                    <div className="relative flex-1 md:w-40">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date" 
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        title="Data Inizio"
                      />
                    </div>
                    <span className="text-gray-400 text-xs">al</span>
                    <div className="relative flex-1 md:w-40">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date" 
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        title="Data Fine"
                      />
                    </div>
                  </div>
                  <div className="relative flex-1 md:w-64">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtra per cliente..." 
                      value={customerFilter}
                      onChange={(e) => setCustomerFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  {((startDateFilter || endDateFilter) || customerFilter) && (
                    <button 
                      onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setCustomerFilter(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Resetta
                    </button>
                  )}
                </div>
                <div className="flex gap-2 w-full md:w-auto justify-end">
                  <button onClick={() => handleExportSales('excel')} className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 flex-1 md:flex-none justify-center">
                    <FileSpreadsheet size={16} /> Excel
                  </button>
                  <button onClick={() => handleExportSales('pdf')} className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 flex-1 md:flex-none justify-center">
                    <FileText size={16} /> PDF
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-nowrap">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Data</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">N. Fattura</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Cliente</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotti</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Recapito</th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      // Filter sales based on filters
                      const filteredSales = sales.filter(sale => {
                        const saleDate = sale.date.split('T')[0];
                        const matchesStart = !startDateFilter || saleDate >= startDateFilter;
                        const matchesEnd = !endDateFilter || saleDate <= endDateFilter;
                        const matchesCustomer = !customerFilter || 
                          (sale.customer_name && sale.customer_name.toLowerCase().includes(customerFilter.toLowerCase()));
                        const matchesSearch = !searchTerm || 
                          (sale.customer_name && sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (sale.invoice_number && sale.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()));
                        
                        return matchesStart && matchesEnd && matchesCustomer && matchesSearch;
                      });

                      // Group sales by invoice_number and customer_name
                      const grouped: { [key: string]: any } = {};
                      filteredSales.forEach(sale => {
                        const key = sale.invoice_number || `no-invoice-${sale.id}`;
                        if (!grouped[key]) {
                          grouped[key] = {
                            ...sale,
                            items: [sale]
                          };
                        } else {
                          grouped[key].items.push(sale);
                        }
                      });

                      return Object.values(grouped)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(order => {
                          return (
                            <tr 
                              key={order.id} 
                              className="hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => setSelectedSale(order)}
                            >
                              <td className="px-6 py-4 text-xs text-gray-500">{new Date(order.date).toLocaleString()}</td>
                              <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-700">
                                {order.invoice_number || '---'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-gray-900">{order.customer_name}</div>
                                <div className="text-[10px] text-gray-400 uppercase">{order.customer_address}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {order.items.map((item: any, idx: number) => {
                                    const p = products.find(prod => prod.id === item.product_id);
                                    return (
                                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                                        {p?.name} ({item.quantity})
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-mono">{order.customer_phone || '---'}</td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'haccp' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-2 flex-1 md:w-auto">
                    <div className="relative flex-1 md:w-40">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date" 
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        title="Data Inizio"
                      />
                    </div>
                    <span className="text-gray-400 text-xs">al</span>
                    <div className="relative flex-1 md:w-40">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date" 
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        title="Data Fine"
                      />
                    </div>
                  </div>
                  {(startDateFilter || endDateFilter) && (
                    <button 
                      onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Resetta
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-nowrap">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Data</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Tipo</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Prodotto / Lotto</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Descrizione</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.filter(l => {
                      const logDate = l.date.split('T')[0];
                      const matchesStart = !startDateFilter || logDate >= startDateFilter;
                      const matchesEnd = !endDateFilter || logDate <= endDateFilter;
                      const matchesSearch = l.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                            l.type.includes(searchTerm) ||
                                            (l.lot_number && l.lot_number.toLowerCase().includes(searchTerm.toLowerCase()));
                      
                      return matchesStart && matchesEnd && matchesSearch;
                    }).map(l => {
                      const p = products.find(prod => prod.id === l.product_id);
                      return (
                        <tr 
                          key={l.id} 
                          className="hover:bg-amber-50/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedLog(l)}
                        >
                          <td className="px-6 py-4 text-sm font-mono whitespace-nowrap">{new Date(l.date).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {l.type === 'temperature' && <Thermometer size={14} className="text-blue-500" />}
                              {l.type === 'cleaning' && <CheckCircle2 size={14} className="text-emerald-500" />}
                              {l.type === 'quality' && <ClipboardCheck size={14} className="text-purple-500" />}
                              <span className="text-xs font-bold uppercase">{l.type}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{p?.name || '-'}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{l.lot_number || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{l.description}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                              l.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 
                              l.status === 'warning' ? 'bg-amber-100 text-amber-700' : 
                              'bg-red-100 text-red-700'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

          {activeTab === 'admin' && user.role === 'admin' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto text-nowrap">
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
            </div>
          )}
        </AnimatePresence>
      </main>

      {isScaricoOpen && (
        <Modal title="Scarico Magazzino (Vendita)" onClose={() => { setIsScaricoOpen(false); setError(''); }} error={error}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            const formData = new FormData(e.currentTarget);
            const productId = saleProductId;
            const batchId = saleBatchId;
            const quantity = Number(saleQuantity);
            const customerName = formData.get('customerName') as string;
            const customerAddress = formData.get('customerAddress') as string;
            const customerPhone = formData.get('customerPhone') as string;
            const invoiceNumber = formData.get('invoiceNumber') as string;

            if (!productId || !batchId || !quantity) {
              setError('Seleziona prodotto, lotto e quantità');
              return;
            }

            try {
              await api.inventory.addSale({
                product_id: productId,
                batch_id: batchId,
                quantity,
                customer_name: customerName,
                customer_address: customerAddress,
                customer_phone: customerPhone,
                invoice_number: invoiceNumber
              });

              fetchData();
              setIsScaricoOpen(false);
              setSaleProductId('');
              setSaleBatchId('');
              setSaleQuantity('');
              setSaleBarcode('');
            } catch (err: any) {
              setError(err.message);
            }
          }} className="p-1 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Codice a Barre (Barcode)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={saleBarcode}
                    onChange={(e) => setSaleBarcode(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const batch = batches.find(b => b.barcode === saleBarcode);
                        if (batch) {
                          setSaleProductId(batch.product_id);
                          setSaleBatchId(batch.id);
                        } else {
                          const product = await api.inventory.getProductByBarcode(saleBarcode);
                          if (product) {
                            setSaleProductId(product.id);
                            const firstBatch = batches.find(b => b.product_id === product.id);
                            if (firstBatch) setSaleBatchId(firstBatch.id);
                          }
                        }
                      }
                    }}
                    placeholder="Scansiona..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaleScannerOpen(true)}
                  className="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors"
                >
                  <Camera size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto</label>
                <select 
                  value={saleProductId} 
                  onChange={(e) => {
                    setSaleProductId(e.target.value);
                    setSaleBatchId('');
                  }}
                  required 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Seleziona prodotto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Disp: {p.quantity} {p.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto di Riferimento</label>
                <select 
                  value={saleBatchId} 
                  onChange={(e) => setSaleBatchId(e.target.value)}
                  required 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Seleziona lotto...</option>
                  {batches.filter(b => b.product_id === saleProductId).map(b => {
                    const p = products.find(prod => prod.id === b.product_id);
                    return <option key={b.id} value={b.id}>{b.lot_number} (Scad: {b.expiry_date})</option>;
                  })}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Quantità da Scaricare</label>
              <input 
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(e.target.value)}
                type="number" 
                step="0.01" 
                required 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome Cliente</label>
              <input name="customerName" type="text" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Recapito (Cell.)</label>
                <input name="customerPhone" type="tel" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">N. Fattura/Ricevuta</label>
                <input name="invoiceNumber" type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Indirizzo di Recapito</label>
              <textarea name="customerAddress" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20" rows={2}></textarea>
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20">Conferma Scarico</button>
          </form>
        </Modal>
      )}



      {isAddProductOpen && (
        <Modal title="Nuovo Prodotto" onClose={() => { setIsAddProductOpen(false); setInitialBarcode(''); setError(''); }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            try {
              const name = (fd.get('name') as string).trim();
              const barcode = (fd.get('barcode') as string).trim();
              if (!name) throw new Error('Il nome è obbligatorio');
              if (!barcode) throw new Error('Il codice a barre è obbligatorio');
              
              await api.inventory.addProduct({ 
                name, 
                barcode,
                category: fd.get('category'), 
                unit: fd.get('unit'), 
                min_stock: Number(fd.get('min_stock'))
              }); 
              fetchData(); 
              setIsAddProductOpen(false); 
              setInitialBarcode('');
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome</label><input name="name" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" placeholder="es. Provolone Molise" /></div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Codice a Barre</label><input name="barcode" defaultValue={initialBarcode} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono" placeholder="es. 8001234567890" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Categoria</label><select name="category" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>Fresco</option><option>Secco</option><option>Surgelato</option></select></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Unità</label><select name="unit" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>kg</option><option>litri</option><option>pezzi</option></select></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scorta Minima</label><input name="min_stock" type="number" defaultValue="5" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Salva Prodotto</button>
          </form>
        </Modal>
      )}

      {isBulkOpen && (
        <BulkOperation 
          products={products} 
          onClose={() => setIsBulkOpen(false)} 
          onSuccess={() => fetchData()} 
          onAddProduct={(barcode) => {
            setInitialBarcode(barcode || '');
            setIsAddProductOpen(true);
          }}
        />
      )}

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={async (code) => {
            const input = document.getElementById('barcode-input') as HTMLInputElement;
            if (input) input.value = code;
            
            // Try to find product for this barcode
            try {
              const product = await api.inventory.getProductByBarcode(code);
              if (product) {
                const productSelect = document.querySelector('select[name="productId"]') as HTMLSelectElement;
                if (productSelect) productSelect.value = product.id;
              }
            } catch (err) {
              console.error('Error finding product for barcode:', err);
            }
            
            setIsScannerOpen(false);
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {isSaleScannerOpen && (
        <BarcodeScanner 
          onScan={async (code) => {
            setSaleBarcode(code);
            setIsSaleScannerOpen(false);
            
            // Try to find batch for this barcode
            try {
              const batch = batches.find(b => b.barcode === code);
              if (batch) {
                setSaleProductId(batch.product_id);
                setSaleBatchId(batch.id);
              } else {
                // Try to find product by barcode (maybe it's a new batch of an existing product)
                const product = await api.inventory.getProductByBarcode(code);
                if (product) {
                  setSaleProductId(product.id);
                  // Find first batch for this product
                  const firstBatch = batches.find(b => b.product_id === product.id);
                  if (firstBatch) setSaleBatchId(firstBatch.id);
                }
              }
            } catch (err) {
              console.error('Error finding product for barcode:', err);
            }
          }} 
          onClose={() => setIsSaleScannerOpen(false)} 
        />
      )}

      {isHaccpScannerOpen && (
        <BarcodeScanner 
          onScan={(code) => {
            setSearchTerm(code);
            setIsHaccpScannerOpen(false);
            const foundLog = logs.find(l => l.lot_number === code);
            if (foundLog) {
              setSelectedLog(foundLog);
            }
          }} 
          onClose={() => setIsHaccpScannerOpen(false)} 
        />
      )}

      {isAddBatchOpen && (
        <Modal title="Nuovo Carico" onClose={() => { setIsAddBatchOpen(false); setError(''); }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            const data = { 
              productId: fd.get('productId'), 
              lotNumber: fd.get('lotNumber'), 
              barcode: fd.get('barcode'),
              quantity: Number(fd.get('quantity')), 
              expiryDate: fd.get('expiryDate'), 
              supplier: fd.get('supplier'), 
              temperatureCheck: fd.get('temp') ? Number(fd.get('temp')) : null 
            }; 
            try {
              await api.inventory.addBatch(data); 
              if (data.temperatureCheck) {
                await api.inventory.addLog({ 
                  type: 'temperature', 
                  description: `Ricezione: ${data.temperatureCheck}°C (Lotto ${data.lotNumber})`, 
                  operator: user.email, 
                  status: data.temperatureCheck > 4 ? 'warning' : 'ok',
                  productId: data.productId as string,
                  lotNumber: data.lotNumber as string
                }); 
              }
              fetchData(); 
              setIsAddBatchOpen(false); 
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto</label><select name="productId" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
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
        <Modal title="Nuovo Registro HACCP" onClose={() => { 
          setIsAddLogOpen(false); 
          setError(''); 
          setHaccpProductId('');
          setHaccpLotNumber('');
          setHaccpBarcode('');
        }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            try {
              await api.inventory.addLog({ 
                type: fd.get('type'), 
                description: fd.get('description'), 
                operator: user.email, 
                status: fd.get('status'),
                productId: haccpProductId || null,
                lotNumber: haccpLotNumber || null
              }); 
              fetchData(); 
              setIsAddLogOpen(false); 
              setHaccpProductId('');
              setHaccpLotNumber('');
              setHaccpBarcode('');
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Tipo</label>
                <select name="type" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <option value="quality">Controllo Qualità</option>
                  <option value="cleaning">Pulizia</option>
                  <option value="temperature">Temperatura</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Stato</label>
                <select name="status" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <option value="ok">Conforme (OK)</option>
                  <option value="warning">Avviso (Warning)</option>
                  <option value="critical">Critico (Critical)</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Barcode (Manuale o Scanner)</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text"
                    value={haccpBarcode}
                    onChange={async (e) => {
                      const code = e.target.value;
                      setHaccpBarcode(code);
                      if (code) {
                        const product = products.find(p => p.barcode === code);
                        if (product) {
                          setHaccpProductId(product.id);
                          const latestBatch = batches.filter(b => b.product_id === product.id).sort((a, b) => new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime())[0];
                          if (latestBatch) setHaccpLotNumber(latestBatch.lot_number);
                        } else {
                          const batch = batches.find(b => b.barcode === code);
                          if (batch) {
                            setHaccpProductId(batch.product_id);
                            setHaccpLotNumber(batch.lot_number);
                          }
                        }
                      }
                    }}
                    placeholder="Scansiona o inserisci barcode..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto (Opzionale)</label>
                  <select 
                    value={haccpProductId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setHaccpProductId(pid);
                      if (pid) {
                        const latestBatch = batches.filter(b => b.product_id === pid).sort((a, b) => new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime())[0];
                        if (latestBatch) {
                          setHaccpLotNumber(latestBatch.lot_number);
                          setHaccpBarcode(latestBatch.barcode || '');
                        }
                      } else {
                        setHaccpLotNumber('');
                        setHaccpBarcode('');
                      }
                    }}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="">Nessuno</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto (Opzionale)</label>
                  <input 
                    value={haccpLotNumber}
                    onChange={(e) => setHaccpLotNumber(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                    placeholder="Es: LOT123" 
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Descrizione</label>
              <textarea name="description" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" rows={3} placeholder="Dettagli dell'operazione..." />
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">Salva Registro</button>
          </form>
        </Modal>
      )}

      {isAddUserOpen && user.role === 'admin' && (
        <Modal title="Nuovo Utente" onClose={() => { setIsAddUserOpen(false); setError(''); }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            try {
              await api.admin.addUser({ 
                email: fd.get('email'), 
                password: fd.get('password'), 
                role: fd.get('role'), 
                status: fd.get('status') 
              }); 
              fetchUsers(); 
              setIsAddUserOpen(false); 
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
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

      {selectedLog && (
        <Modal title={`Dettagli Registro HACCP`} onClose={() => { setSelectedLog(null); setError(''); }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            try {
              await api.inventory.updateLog(selectedLog.id, { 
                type: fd.get('type'), 
                description: fd.get('description'), 
                status: fd.get('status'),
                productId: fd.get('productId') || null,
                lotNumber: fd.get('lotNumber') || null
              }); 
              fetchData(); 
              setSelectedLog(null); 
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Tipo</label><select name="type" defaultValue={selectedLog.type} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option value="temperature">Temperatura</option><option value="cleaning">Pulizia</option><option value="quality">Qualità</option></select></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Stato</label><select name="status" defaultValue={selectedLog.status} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option value="ok">OK</option><option value="warning">Warning</option><option value="critical">Critical</option></select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto</label>
                <select name="productId" defaultValue={selectedLog.product_id || ''} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <option value="">Nessuno</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto</label><input name="lotNumber" defaultValue={selectedLog.lot_number || ''} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Descrizione</label><textarea name="description" defaultValue={selectedLog.description} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" rows={3} /></div>
            <div className="text-[10px] text-gray-400 uppercase flex justify-between">
              <span>Operatore: {selectedLog.operator}</span>
              <span>Data: {new Date(selectedLog.date).toLocaleString()}</span>
            </div>
            <div className="flex gap-3 pt-4">
              {confirmDelete?.id === selectedLog.id ? (
                <div className="flex-1 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">Annulla</button>
                  <button type="button" onClick={async () => { 
                    try {
                      await api.inventory.deleteLog(selectedLog.id); 
                      await fetchData(); 
                      setSelectedLog(null); 
                      setConfirmDelete(null); 
                    } catch (err: any) {
                      alert('Errore eliminazione: ' + err.message);
                    }
                  }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Conferma</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete({ id: selectedLog.id, type: 'log' })} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors">Elimina</button>
              )}
              <button type="submit" className="flex-[2] bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20">Aggiorna</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedProduct && (
        <Modal title={`Dettagli Prodotto: ${selectedProduct.name}`} onClose={() => { setSelectedProduct(null); setError(''); }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            try {
              await api.inventory.updateProduct(selectedProduct.id, { 
                name: fd.get('name'), 
                category: fd.get('category'), 
                unit: fd.get('unit'), 
                min_stock: Number(fd.get('min_stock'))
              }); 
              fetchData(); 
              setSelectedProduct(null); 
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome</label><input name="name" defaultValue={selectedProduct.name} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Categoria</label><select name="category" defaultValue={selectedProduct.category} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>Fresco</option><option>Secco</option><option>Surgelato</option></select></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Unità</label><select name="unit" defaultValue={selectedProduct.unit} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"><option>kg</option><option>litri</option><option>pezzi</option></select></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scorta Minima</label><input name="min_stock" type="number" defaultValue={selectedProduct.min_stock} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div className="flex gap-3 pt-4">
              {confirmDelete?.id === selectedProduct.id ? (
                <div className="flex-1 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">Annulla</button>
                  <button type="button" onClick={async () => { 
                    try {
                      await api.inventory.deleteProduct(selectedProduct.id); 
                      await fetchData(); 
                      setSelectedProduct(null); 
                      setConfirmDelete(null); 
                    } catch (err: any) {
                      alert('Errore eliminazione: ' + err.message);
                    }
                  }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Conferma</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete({ id: selectedProduct.id, type: 'product' })} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors">Elimina</button>
              )}
              <button type="submit" className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Aggiorna</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedBatch && (
        <Modal title={`Dettagli Lotto: ${selectedBatch.lot_number}`} onClose={() => { setSelectedBatch(null); setError(''); }} error={error}>
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            setError('');
            const fd = new FormData(e.currentTarget); 
            try {
              await api.inventory.updateBatch(selectedBatch.id, { 
                lotNumber: fd.get('lotNumber'), 
                barcode: fd.get('barcode'),
                expiryDate: fd.get('expiryDate'), 
                supplier: fd.get('supplier'), 
                temperatureCheck: fd.get('temp') ? Number(fd.get('temp')) : null 
              }); 
              fetchData(); 
              setSelectedBatch(null); 
            } catch (err: any) {
              setError(err.message);
            }
          }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Prodotto</label>
              <div className="p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium">
                {products.find(p => p.id === selectedBatch.product_id)?.name}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Codice a Barre (Barcode)</label>
              <div className="flex gap-2">
                <input name="barcode" defaultValue={selectedBatch.barcode || ''} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto</label><input name="lotNumber" defaultValue={selectedBatch.lot_number} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
              <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scadenza</label><input name="expiryDate" type="date" defaultValue={selectedBatch.expiry_date} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Temp. (°C)</label><input name="temp" type="number" step="0.1" defaultValue={selectedBatch.temperature_check || ''} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Fornitore</label><input name="supplier" defaultValue={selectedBatch.supplier} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" /></div>
            <div className="flex gap-3 pt-4">
              {confirmDelete?.id === selectedBatch.id ? (
                <div className="flex-1 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">Annulla</button>
                  <button type="button" onClick={async () => { 
                    try {
                      await api.inventory.deleteBatch(selectedBatch.id); 
                      await fetchData(); 
                      setSelectedBatch(null); 
                      setConfirmDelete(null); 
                    } catch (err: any) {
                      alert('Errore eliminazione: ' + err.message);
                    }
                  }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Conferma</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete({ id: selectedBatch.id, type: 'batch' })} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors">Elimina</button>
              )}
              <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">Aggiorna</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedSale && (
        <Modal title="Dettagli Vendita" onClose={() => setSelectedSale(null)}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Data e Ora</label>
                <div className="text-sm font-mono font-bold">{new Date(selectedSale.date).toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">N. Fattura/Ricevuta</label>
                <div className="text-lg font-mono font-bold text-emerald-700">
                  {selectedSale.invoice_number || '---'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-2">Prodotti nell'ordine</label>
                <div className="space-y-3">
                  {(selectedSale.items || [selectedSale]).map((item: any, idx: number) => {
                    const p = products.find(prod => prod.id === item.product_id);
                    const b = batches.find(batch => batch.id === item.batch_id);
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-gray-200">
                          <Package size={16} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{p?.name || 'Sconosciuto'}</div>
                          <div className="text-[10px] text-gray-500 font-mono">Lotto: {b?.lot_number || '---'}</div>
                        </div>
                        <div className="text-sm font-bold text-emerald-600">
                          {item.quantity} {p?.unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="text-blue-600" size={24} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-0.5">Cliente</label>
                  <div className="text-lg font-bold text-gray-900">{selectedSale.customer_name}</div>
                  <div className="text-sm text-gray-500">{selectedSale.customer_address}</div>
                  {selectedSale.customer_phone && (
                    <div className="mt-2 flex items-center gap-2 text-sm font-mono text-blue-600 bg-blue-50 px-3 py-1 rounded-lg w-fit">
                      <Phone size={14} /> {selectedSale.customer_phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => setSelectedSale(null)}
                className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
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

function Modal({ title, children, onClose, error }: { title: string, children: React.ReactNode, onClose: () => void, error?: string }) {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md mx-auto my-auto">
        {/* Backdrop click area (invisible but covers the whole screen) */}
        <div className="fixed inset-0" onClick={onClose}></div>
        
        {/* Modal Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white w-full rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
            <h3 className="text-lg sm:text-xl font-bold truncate pr-4 text-gray-900">{title}</h3>
            <button 
              onClick={onClose} 
              className="p-2 -mr-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
              aria-label="Chiudi"
            >
              <XCircle size={24} />
            </button>
          </div>
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain bg-white">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
            <div className="space-y-4">
              {children}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
