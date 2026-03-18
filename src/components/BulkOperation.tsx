import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Plus, Trash2, Package, Calendar, Truck, Thermometer, Hash, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarcodeScanner } from './BarcodeScanner';
import { api } from '../api';
import { Product } from '../types';

interface BulkOperationProps {
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
  onAddProduct?: (barcode?: string) => void;
}

interface ScannedItem {
  id: string;
  productId: string;
  barcode: string;
  name: string;
  quantity: number;
  lot_number: string;
  expiry_date: string;
  temperature: string;
  supplier: string;
}

export const BulkOperation: React.FC<BulkOperationProps> = ({ 
  products, 
  onClose, 
  onSuccess,
  onAddProduct
}) => {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [manualQuantity, setManualQuantity] = useState<number>(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product?.barcode) {
        setManualBarcode(product.barcode);
      }
    }
  }, [selectedProductId, products]);

  const addItem = (product: Product, barcode?: string, quantity: number = 1) => {
    const newItem: ScannedItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.id,
      barcode: barcode || product.barcode || '',
      name: product.name,
      quantity: quantity,
      lot_number: '',
      expiry_date: '',
      temperature: '',
      supplier: ''
    };
    setItems(prev => [newItem, ...prev]);
    setManualBarcode('');
    setSelectedProductId('');
    setManualQuantity(1);
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = manualBarcode.trim();
    if (!barcode) return;
    
    try {
      const product = await api.inventory.getProductByBarcode(barcode);
      if (product) {
        addItem(product, barcode, manualQuantity);
      }
    } catch (err: any) {
      setError(
        <div className="flex flex-col gap-2">
          <p>Prodotto con barcode {barcode} non trovato.</p>
          {onAddProduct && (
            <button 
              onClick={() => {
                onAddProduct(barcode);
                onClose();
              }}
              className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-emerald-700 transition-colors self-start"
            >
              Crea Nuovo Prodotto
            </button>
          )}
        </div>
      );
      setTimeout(() => setError(null), 10000);
    }
  };

  const handleManualAdd = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      addItem(product, manualBarcode.trim(), manualQuantity);
    }
  };

  const updateItem = (id: string, field: keyof ScannedItem, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirm = async () => {
    if (items.length === 0) return;
    
    // Validation
    const invalid = items.some(item => !item.quantity || !item.lot_number || !item.expiry_date || !item.barcode);
    if (invalid) {
      setError('Tutti i campi obbligatori (Quantità, Lotto, Scadenza, Barcode) devono essere compilati per ogni prodotto');
      return;
    }

    setLoading(true);
    try {
      // Use bulk endpoint
      await api.inventory.addBulkBatches(items.map(item => ({
        product_id: item.productId,
        lot_number: item.lot_number,
        barcode: item.barcode,
        expiry_date: item.expiry_date,
        quantity: item.quantity,
        temperature: item.temperature,
        supplier: item.supplier
      })));
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-emerald-600 text-white shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-3">
              <Package />
              Carico Magazzino
            </h2>
            <p className="text-xs sm:text-sm opacity-80 font-medium">Inserimento manuale o tramite barcode</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 animate-shake">
              <X size={18} /> {error}
            </div>
          )}

          {/* Add Item Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            {/* Barcode Input */}
            <form onSubmit={handleBarcodeSubmit} className="space-y-2">
              <label className="block text-[10px] font-bold uppercase text-gray-400">Scansiona Barcode</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="Codice a barre..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors"
                >
                  <Camera size={20} />
                </button>
                <div className="w-20">
                  <input
                    type="number"
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(Number(e.target.value))}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-center"
                    placeholder="Qtà"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap"
                >
                  Aggiungi
                </button>
              </div>
            </form>

            {/* Manual Dropdown */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase text-gray-400">Selezione Manuale</label>
              <div className="flex gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex-1 p-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Seleziona prodotto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="w-20">
                  <input
                    type="number"
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(Number(e.target.value))}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-center"
                    placeholder="Qtà"
                  />
                </div>
                <button
                  onClick={handleManualAdd}
                  disabled={!selectedProductId}
                  className="px-4 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Aggiungi
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
              Prodotti in Carico ({items.length})
            </h3>
            
            <AnimatePresence>
              {items.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl"
                >
                  <Package className="mx-auto text-gray-200 mb-3" size={48} />
                  <p className="text-gray-400 font-medium">Nessun prodotto aggiunto. Scansiona o seleziona un prodotto per iniziare.</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <Package size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{item.name}</h4>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="space-y-1">
                          <label className={`text-[10px] font-bold uppercase ${!item.barcode ? 'text-red-500' : 'text-gray-400'}`}>
                            Barcode {!item.barcode && '*'}
                          </label>
                          <input
                            type="text"
                            value={item.barcode}
                            onChange={(e) => updateItem(item.id, 'barcode', e.target.value)}
                            className={`w-full p-2 bg-gray-50 border ${!item.barcode ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono`}
                            placeholder="Codice a barre obbligatorio"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Quantità</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value))}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
                            <Hash size={10} /> Lotto
                          </label>
                          <input
                            type="text"
                            value={item.lot_number}
                            onChange={(e) => updateItem(item.id, 'lot_number', e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            placeholder="es. L2024-01"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
                            <Calendar size={10} /> Scadenza
                          </label>
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateItem(item.id, 'expiry_date', e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
                            <Thermometer size={10} /> Temp. (°C)
                          </label>
                          <input
                            type="text"
                            value={item.temperature}
                            onChange={(e) => updateItem(item.id, 'temperature', e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            placeholder="es. +4"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
                            <Truck size={10} /> Fornitore
                          </label>
                          <input
                            type="text"
                            value={item.supplier}
                            onChange={(e) => updateItem(item.id, 'supplier', e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            placeholder="es. Rossi Srl"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-white transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || items.length === 0}
            className="flex-[2] px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Elaborazione...
              </>
            ) : (
              <><Save size={20} /> Conferma Carico ({items.length})</>
            )}
          </button>
        </div>
      </motion.div>

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={async (code) => {
            setIsScannerOpen(false);
            try {
              const product = await api.inventory.getProductByBarcode(code);
              if (product) addItem(product, code);
              else throw new Error('Not found');
            } catch (err) {
              setError(
                <div className="flex flex-col gap-2">
                  <p>Prodotto con barcode {code} non trovato.</p>
                  {onAddProduct && (
                    <button 
                      onClick={() => {
                        onAddProduct(code);
                        onClose();
                      }}
                      className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-emerald-700 transition-colors self-start"
                    >
                      Crea Nuovo Prodotto
                    </button>
                  )}
                </div>
              );
              setTimeout(() => setError(null), 10000);
            }
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </div>
  );
};
