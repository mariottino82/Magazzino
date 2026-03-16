import React, { useState } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { api } from '../api';
import { Product } from '../types';
import { Trash2, Camera, Plus, Save, XCircle, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkOperationProps {
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
}

interface ScannedItem {
  product: Product;
  quantity: number;
}

interface PendingScan {
  barcode: string;
  product?: Product;
}

export const BulkOperation: React.FC<BulkOperationProps> = ({ onClose, onSuccess, products }) => {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [modalError, setModalError] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const [mode, setMode] = useState<'carico' | 'scarico'>('carico');

  const handleScan = async (barcode: string) => {
    try {
      setIsScannerOpen(false);
      const product = await api.inventory.getProductByBarcode(barcode);
      setPendingScan({ barcode, product });
    } catch (err) {
      // Product not found, prepare for new product creation
      setPendingScan({ barcode });
    }
  };

  const handleConfirmPending = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingScan) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const quantity = Number(formData.get('quantity'));

    if (!name || name.trim() === '') {
      setModalError('Il nome del prodotto è obbligatorio');
      return;
    }

    try {
      setModalError('');
      setIsModalSubmitting(true);
      let product = pendingScan.product;
      
      // If it's a new product, save it first
      if (!product) {
        try {
          product = await api.inventory.addProduct({
            name: name.trim(),
            barcode: pendingScan.barcode,
            category: 'Fresco', // Default category
            unit: 'pezzi',      // Default unit
            min_stock: 5
          });
        } catch (err: any) {
          // If server says it exists, try to fetch it one last time
          if (err.message.includes('already exists')) {
            product = await api.inventory.getProductByBarcode(pendingScan.barcode);
          } else {
            throw err;
          }
        }
      }

      addItem(product!, quantity);
      setPendingScan(null);
    } catch (err: any) {
      setModalError(err.message || 'Errore durante il salvataggio');
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const addItem = (product: Product, quantity: number = 1) => {
    setScannedItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeItem = (productId: string) => {
    setScannedItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    setScannedItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity: Math.max(0, qty) } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (scannedItems.length === 0) return;
    
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    
    const bulkData = {
      items: scannedItems.map(item => ({
        productId: item.product.id,
        quantity: mode === 'carico' ? item.quantity : -item.quantity
      })),
      lotNumber: mode === 'carico' ? fd.get('lotNumber') : 'SCARICO_BULK',
      expiryDate: mode === 'carico' ? fd.get('expiryDate') : new Date().toISOString().split('T')[0],
      supplier: mode === 'carico' ? fd.get('supplier') : 'INTERNO',
      temperatureCheck: fd.get('temp') ? Number(fd.get('temp')) : null
    };

    try {
      await api.inventory.addBulkBatches(bulkData);
      await api.inventory.addLog({
        type: mode === 'carico' ? 'quality' : 'quality',
        description: `${mode === 'carico' ? 'Carico' : 'Scarico'} Bulk di ${scannedItems.length} prodotti`,
        operator: 'Sistema',
        status: 'ok',
        lotNumber: mode === 'carico' ? fd.get('lotNumber') : 'SCARICO_BULK'
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
      >
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white shrink-0 sticky top-0 z-10">
          <h3 className="text-lg sm:text-xl font-bold">Operazione Multipla</h3>
          <div className="flex bg-white/20 p-1 rounded-xl mx-2">
            <button 
              onClick={() => setMode('carico')}
              className={`px-3 sm:px-4 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${mode === 'carico' ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'}`}
            >
              CARICO
            </button>
            <button 
              onClick={() => setMode('scarico')}
              className={`px-3 sm:px-4 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${mode === 'scarico' ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'}`}
            >
              SCARICO
            </button>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white shrink-0">
            <XCircle size={28} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold hover:bg-emerald-200 transition-all"
            >
              <Camera size={20} /> Scansiona
            </button>
            <button 
              onClick={() => setIsManualOpen(true)}
              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-200 transition-all"
            >
              <Plus size={20} /> Aggiungi Manuale
            </button>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Prodotto</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Barcode</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400 w-24">Quantità</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {scannedItems.map(item => (
                    <motion.tr 
                      key={item.product.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-gray-400">{item.product.unit}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {item.product.barcode}
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                          className="w-full p-1 border border-gray-200 rounded text-center font-mono"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeItem(item.product.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {scannedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic text-sm">
                      Nessun prodotto aggiunto. Scansiona o seleziona dalla lista.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-gray-100">
            {mode === 'carico' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lotto</label>
                    <input name="lotNumber" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" placeholder="es. L2024-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Scadenza</label>
                    <input name="expiryDate" type="date" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Fornitore</label>
                    <input name="supplier" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" placeholder="Nome fornitore" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Temp. Arrivo (°C)</label>
                    <input name="temp" type="number" step="0.1" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" placeholder="opzionale" />
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                Annulla
              </button>
              <button 
                type="submit" 
                disabled={scannedItems.length === 0 || isSubmitting}
                className="flex-2 flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
              >
                <Save size={20} /> {isSubmitting ? 'Salvataggio...' : 'Registra Tutto'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {pendingScan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 bg-emerald-600 text-white">
              <div className="flex items-center gap-2 mb-1">
                <ScanLine size={20} />
                <h4 className="font-bold">Codice Rilevato</h4>
              </div>
              <p className="text-xs font-mono opacity-80">{pendingScan.barcode}</p>
            </div>
            
            <form onSubmit={handleConfirmPending} className="p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium">
                  {modalError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome Prodotto</label>
                <input 
                  name="name" 
                  required 
                  defaultValue={pendingScan.product?.name || ''} 
                  placeholder="Inserisci nome prodotto..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Quantità</label>
                <input 
                  name="quantity" 
                  type="number" 
                  required 
                  defaultValue="1"
                  min="1"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono text-lg"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setPendingScan(null)}
                  className="flex-1 py-3 text-gray-400 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  disabled={isModalSubmitting}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isModalSubmitting ? '...' : 'Conferma'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {isManualOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 bg-blue-600 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Plus size={20} />
                <h4 className="font-bold">Inserimento Manuale</h4>
              </div>
              <p className="text-xs opacity-80">Inserisci i dati del prodotto</p>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const barcode = (fd.get('barcode') as string).trim();
                const name = (fd.get('name') as string).trim();
                const quantity = Number(fd.get('quantity'));

                if (!barcode || !name) {
                  setModalError('Barcode e Nome sono obbligatori');
                  return;
                }

                try {
                  setModalError('');
                  setIsModalSubmitting(true);
                  // Check if product exists by barcode
                  let product;
                  try {
                    product = await api.inventory.getProductByBarcode(barcode);
                  } catch (err) {
                    // Not found, create it
                    try {
                      product = await api.inventory.addProduct({
                        name,
                        barcode,
                        category: 'Fresco',
                        unit: 'pezzi',
                        min_stock: 5
                      });
                    } catch (addErr: any) {
                      if (addErr.message.includes('already exists')) {
                        product = await api.inventory.getProductByBarcode(barcode);
                      } else {
                        throw addErr;
                      }
                    }
                  }

                  addItem(product, quantity);
                  setIsManualOpen(false);
                  setModalError('');
                } catch (err: any) {
                  setModalError(err.message);
                } finally {
                  setIsModalSubmitting(false);
                }
              }} 
              className="p-6 space-y-4"
            >
              {modalError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium">
                  {modalError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Barcode</label>
                <input 
                  name="barcode" 
                  required 
                  placeholder="Scrivi o incolla barcode..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                  onBlur={async (e) => {
                    const bc = e.target.value;
                    if (bc) {
                      try {
                        const p = await api.inventory.getProductByBarcode(bc);
                        const nameInput = (e.target.form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement;
                        if (nameInput && !nameInput.value) nameInput.value = p.name;
                      } catch (err) {
                        // Ignore not found
                      }
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nome Prodotto</label>
                <input 
                  name="name" 
                  required 
                  placeholder="Inserisci nome prodotto..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Quantità</label>
                <input 
                  name="quantity" 
                  type="number" 
                  required 
                  defaultValue="1"
                  min="1"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-lg"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsManualOpen(false);
                    setModalError('');
                  }}
                  className="flex-1 py-3 text-gray-400 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  disabled={isModalSubmitting}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isModalSubmitting ? '...' : 'Aggiungi'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
