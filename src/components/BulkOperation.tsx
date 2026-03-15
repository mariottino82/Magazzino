import React, { useState } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { api } from '../api';
import { Product } from '../types';
import { Trash2, Camera, Plus, Save, XCircle } from 'lucide-react';
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

export const BulkOperation: React.FC<BulkOperationProps> = ({ onClose, onSuccess, products }) => {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'carico' | 'scarico'>('carico');

  const handleScan = async (barcode: string) => {
    try {
      const product = await api.inventory.getProductByBarcode(barcode);
      addItem(product);
      setIsScannerOpen(false);
    } catch (err) {
      setError('Prodotto non trovato per questo codice a barre');
      setTimeout(() => setError(''), 3000);
    }
  };

  const addItem = (product: Product) => {
    setScannedItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
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
        status: 'ok'
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
            <div className="flex-1 relative">
              <select 
                onChange={(e) => {
                  const p = products.find(p => p.id === e.target.value);
                  if (p) addItem(p);
                  e.target.value = "";
                }}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Aggiungi manualmente...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Prodotto</th>
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
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic text-sm">
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
    </div>
  );
};
