import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { User, Store, InventoryItem, CartItem, UserRole, PosTransaction, InventoryUnit } from '../types';
import { storageService } from '../services/storageService';
import { BarcodeScanner } from './BarcodeScanner';
import { isValidPaytechBarcode, normalizeBarcodeInput } from '../utils/barcode';
import { useUsbBarcodeScanner } from '../hooks/useUsbBarcodeScanner';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Loader2, Edit2, X, ScanLine, Radio, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface POSProps {
  user: User;
}

export const POS: React.FC<POSProps> = ({ user }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
    const [editingPrice, setEditingPrice] = useState<string>('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [showScanner, setShowScanner] = useState(false);
    const [viewBarcodesCartIdx, setViewBarcodesCartIdx] = useState<number | null>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const paymentInputRef = useRef<HTMLInputElement>(null);
    const cartUnitIdsRef = useRef<Set<string>>(new Set());
    const processingBarcodesRef = useRef<Set<string>>(new Set());

  const focusScanInput = useCallback(() => {
    setTimeout(() => {
      if (showScanner || showReceipt) return;
      if (document.activeElement === paymentInputRef.current) return;
      scanInputRef.current?.focus();
    }, 50);
  }, [showScanner, showReceipt]);

  const getCartUnitIds = useCallback((cartItems: CartItem[]) => {
    return cartItems.flatMap(c => c.unitIds || []);
  }, []);

  useEffect(() => {
    cartUnitIdsRef.current = new Set(getCartUnitIds(cart));
  }, [cart, getCartUnitIds]);

  const processBarcodeRef = useRef<(barcode: string) => Promise<void>>(async () => {});

  const { scannerDetected, markScannerDetected } = useUsbBarcodeScanner({
    enabled: !showScanner && !showReceipt,
    scanInputRef,
    onScan: (barcode) => { processBarcodeRef.current(barcode); },
  });

  const processBarcode = useCallback(async (barcode: string) => {
    const trimmed = normalizeBarcodeInput(barcode);
    if (!trimmed || !isValidPaytechBarcode(trimmed)) return;

    if (processingBarcodesRef.current.has(trimmed)) return;
    processingBarcodesRef.current.add(trimmed);

    try {
      const result = await storageService.lookupUnitByBarcode(trimmed);
      if (!result) {
        alert(`Barcode not found: ${trimmed}`);
        setSearchTerm('');
        focusScanInput();
        return;
      }

      const { unit, item } = result;

      if (unit.storeId !== activeStoreId) {
        alert('This item belongs to a different store.');
        setSearchTerm('');
        focusScanInput();
        return;
      }

      if (unit.status !== 'available') {
        alert('This item has already been sold or is unavailable.');
        setSearchTerm('');
        focusScanInput();
        return;
      }

      if (cartUnitIdsRef.current.has(unit.id)) {
        alert('This barcode is already in the cart.');
        setSearchTerm('');
        focusScanInput();
        return;
      }

      if (item.stock <= 0) {
        alert('Item out of stock');
        setSearchTerm('');
        focusScanInput();
        return;
      }

      let added = false;
      setCart(prev => {
        const allUnitIds = prev.flatMap(c => c.unitIds || []);
        if (allUnitIds.includes(unit.id)) return prev;

        const existing = prev.find(c => c.id === item.id && c.unitIds && c.unitIds.length > 0);
        if (existing) {
          added = true;
          cartUnitIdsRef.current.add(unit.id);
          return prev.map(c =>
            c.id === item.id && c.unitIds
              ? {
                  ...c,
                  quantity: c.quantity + 1,
                  unitIds: [...(c.unitIds || []), unit.id],
                  barcodes: [...(c.barcodes || []), unit.barcode],
                }
              : c
          );
        }

        added = true;
        cartUnitIdsRef.current.add(unit.id);
        return [...prev, {
          ...item,
          quantity: 1,
          unitIds: [unit.id],
          barcodes: [unit.barcode],
        }];
      });

      if (!added) {
        alert('This barcode is already in the cart.');
      } else {
        markScannerDetected();
      }

      setSearchTerm('');
      setShowScanner(false);
      focusScanInput();
    } finally {
      processingBarcodesRef.current.delete(trimmed);
    }
  }, [activeStoreId, focusScanInput, markScannerDetected]);

  processBarcodeRef.current = processBarcode;

  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    const loadData = async () => {
        const allStores = await storageService.fetchStores();
        setStores(allStores);

        // Initial setup based on role
        if (user.role === UserRole.EMPLOYEE && user.storeId) {
            setActiveStoreId(user.storeId);
        } else if (allStores.length > 0) {
            setActiveStoreId(allStores[0].id);
        }
    };
    loadData();
  }, [user]);

  // Load items when active store changes
  useEffect(() => {
    const loadInventory = async () => {
        if (activeStoreId) {
            setIsLoading(true);
            const allInventory = await storageService.getInventory();
            setItems(allInventory.filter(i => i.storeId === activeStoreId));
            setCart([]); // Clear cart when switching stores
            setPaymentAmount('');
            setShowReceipt(false);
            setIsLoading(false);
            focusScanInput();
        }
    };
    loadInventory();
  }, [activeStoreId, focusScanInput]);

  useEffect(() => {
    focusScanInput();
  }, [focusScanInput]);

  const addToCart = (item: InventoryItem) => {
    if (item.stock <= 0) return alert("Item out of stock");

    setCart(prev => {
        const existing = prev.find(c => c.id === item.id && !c.unitIds?.length);
        if (existing) {
            if (existing.quantity >= item.stock) {
                alert("Max stock reached");
                return prev;
            }
            return prev.map(c => c.id === item.id && !c.unitIds?.length ? { ...c, quantity: c.quantity + 1 } : c);
        }
        return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (cartIdx: number, delta: number) => {
    setCart(prev => prev.map((c, idx) => {
        if (idx === cartIdx) {
            const newQty = c.quantity + delta;
            if (newQty < 1) return c;
            if (newQty > c.stock) return c;

            if (c.unitIds && c.unitIds.length > 0) {
              if (delta > 0) {
                alert('Scan another barcode to add more of this item.');
                return c;
              }
              const newUnitIds = c.unitIds.slice(0, newQty);
              const newBarcodes = (c.barcodes || []).slice(0, newQty);
              return { ...c, quantity: newQty, unitIds: newUnitIds, barcodes: newBarcodes };
            }

            return { ...c, quantity: newQty };
        }
        return c;
    }));
  };

  const removeFromCart = (cartIdx: number) => {
      const item = cart[cartIdx];
      if (item) {
          storageService.logActivity('Void Item', `Removed ${item.quantity}x ${item.name} from cart`, user.id, user.name);
      }
      setCart(prev => prev.filter((_, idx) => idx !== cartIdx));
      focusScanInput();
  };

  const updatePrice = (cartIdx: number, newPrice: number) => {
      setCart(prev => prev.map((c, idx) => 
          idx === cartIdx ? { ...c, price: newPrice } : c
      ));
      setEditingPriceId(null);
      setEditingPrice('');
  };

  const cartTotal = useMemo(() => {
      return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const handleCheckout = async () => {
      if (!activeStoreId) return alert("Please select a store first.");
      
      const pay = parseFloat(paymentAmount);
      if (isNaN(pay) || pay <= 0) return alert("Invalid payment amount");
      if (pay < cartTotal) return alert("Insufficient payment amount");

      setIsLoading(true);

      try {
        const transactionId = uuidv4();
        const resolvedCart: CartItem[] = [];
        const usedUnitIds: string[] = [];

        for (const item of cart) {
          let unitIds = [...(item.unitIds || [])];
          let barcodes = [...(item.barcodes || [])];

          if (unitIds.length < item.quantity) {
            const needed = item.quantity - unitIds.length;
            const hasUnits = await storageService.itemHasUnits(item.id);
            if (hasUnits) {
              const exclude = [...usedUnitIds, ...unitIds];
              const fifoUnits = await storageService.getAvailableUnits(item.id, needed, exclude);
              if (fifoUnits.length < needed) {
                alert(`Not enough available units for "${item.name}". Need ${needed}, found ${fifoUnits.length}.`);
                setIsLoading(false);
                return;
              }
              unitIds = [...unitIds, ...fifoUnits.map((u: InventoryUnit) => u.id)];
              barcodes = [...barcodes, ...fifoUnits.map((u: InventoryUnit) => u.barcode)];
            }
          }

          usedUnitIds.push(...unitIds);
          resolvedCart.push({ ...item, unitIds: unitIds.length ? unitIds : undefined, barcodes: barcodes.length ? barcodes : undefined });
        }

        for (const item of resolvedCart) {
          if (item.unitIds?.length) {
            await storageService.markUnitsSold(item.unitIds, transactionId);
            await storageService.syncStockFromUnits(item.id);
          } else {
            await storageService.updateInventoryStock(item.id, -item.quantity);
          }
        }

        const transaction: PosTransaction = {
            id: transactionId,
            storeId: activeStoreId,
            date: date,
            timestamp: Date.now(),
            items: resolvedCart,
            totalAmount: cartTotal,
            paymentAmount: pay,
            cashierName: user.name
        };
        await storageService.savePosTransaction(transaction);
        
        await storageService.logActivity('POS Transaction', `Processed sale of ₱${cartTotal.toFixed(2)} (${cart.length} items)`, user.id, user.name);

        const receipt = {
            date: `${date} ${new Date().toLocaleTimeString()}`,
            storeName: stores.find(s => s.id === activeStoreId)?.name || 'Store',
            items: [...resolvedCart],
            total: cartTotal,
            payment: pay,
            change: pay - cartTotal,
            cashier: user.name
        };
        setReceiptData(receipt);
        setShowReceipt(true);
        
        setCart([]);
        setPaymentAmount('');
        
        const allInventory = await storageService.getInventory();
        setItems(allInventory.filter(i => i.storeId === activeStoreId));
      } catch (error) {
        console.error("Checkout failed:", error);
        alert("Failed to process transaction. Please try again.");
      } finally {
        setIsLoading(false);
      }
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      const trimmed = normalizeBarcodeInput(searchTerm);
      if (isValidPaytechBarcode(trimmed)) {
        e.preventDefault();
        await processBarcode(trimmed);
      }
    }
  };

  const closeReceipt = () => {
      setShowReceipt(false);
      setReceiptData(null);
      focusScanInput();
  };

  const closeCameraScanner = () => {
      setShowScanner(false);
      focusScanInput();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full w-full min-w-0">
       {/* Left: Item Grid */}
    <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 gap-2 flex-wrap">
                <div className="font-bold text-gray-700">Available Items</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {scannerDetected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                      <Radio size={12} /> USB Scanner ready
                    </span>
                  ) : isTouchDevice ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                      Camera Scan available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      Listening for scanner...
                    </span>
                  )}
                {user.role === UserRole.ADMIN && (
                    <select 
                        value={activeStoreId}
                        onChange={e => setActiveStoreId(e.target.value)}
                        className="p-1 border border-gray-300 rounded text-sm bg-white text-gray-900"
                    >
                        {stores.length === 0 && <option value="">Loading stores...</option>}
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}
                {stores.length === 0 && (
                  <button onClick={async () => {
                    const allStores = await storageService.fetchStores();
                    setStores(allStores);
                    if (allStores.length > 0 && !activeStoreId) setActiveStoreId(allStores[0].id);
                  }} className="text-xs text-blue-600 hover:text-blue-800 underline ml-2">
                    Retry
                  </button>
                )}
                </div>
            </div>
            
            <div className="p-4 border-b border-gray-100 flex gap-2 items-center">
                <input
                    ref={scanInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Scan barcode here (USB scanner) or search by name..."
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 whitespace-nowrap"
                    title="Use device camera to scan barcode or QR"
                >
                    <ScanLine size={18} /> Camera Scan
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-white">
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={32}/></div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Price</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.filter(item => 
                                !searchTerm.trim() || 
                                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
                            ).map(item => (
                                <tr 
                                    key={item.id}
                                    onClick={() => item.stock > 0 && addToCart(item)}
                                    className={`cursor-pointer transition-colors hover:bg-blue-50 ${item.stock === 0 ? 'opacity-50 bg-gray-50 cursor-not-allowed' : ''}`}
                                >
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {item.category ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                {item.category}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                            item.stock === 0 ? 'bg-red-100 text-red-800' : 
                                            item.stock < 5 ? 'bg-orange-100 text-orange-800' : 
                                            'bg-green-100 text-green-800'
                                        }`}>
                                            {item.stock}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">
                                        ₱{item.price.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-gray-400 italic">
                                        No items available in this store.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
       </div>

       {/* Right: Cart & Checkout */}
    <div className="w-full md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col h-full min-w-0">
            <div className="p-4 bg-slate-900 text-white font-bold flex items-center gap-2 rounded-t-lg">
                <ShoppingCart size={20}/> Current Order
            </div>

            {/* Date Selection */}
            <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Transaction Date</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    data-pos-exclude-wedge
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-medium text-gray-900"
                />
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <ShoppingCart size={48} className="mb-2"/>
                        <p>Cart is empty</p>
                    </div>
                ) : (
                    cart.map((item, cartIdx) => (
                        <div key={`${item.id}-${cartIdx}-${item.unitIds?.join('-') || 'manual'}`} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100">
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="font-medium text-gray-900 truncate">{item.name}</div>
                                {item.barcodes && item.barcodes.length > 0 && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] font-mono text-purple-600 truncate flex-1">
                                      {item.barcodes.length} barcode{item.barcodes.length > 1 ? 's' : ''} scanned
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setViewBarcodesCartIdx(cartIdx)}
                                      className="flex items-center gap-0.5 text-[10px] font-semibold text-purple-700 hover:text-purple-900 px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 border border-purple-200 shrink-0"
                                    >
                                      <Eye size={10} /> View
                                    </button>
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                    Cost: ₱{item.cost?.toFixed(2) || '0.00'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {editingPriceId === cartIdx ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-600">Sale: ₱</span>
                                            <input 
                                                type="number"
                                                value={editingPrice}
                                                onChange={e => setEditingPrice(e.target.value)}
                                                placeholder={item.price.toFixed(2)}
                                                autoFocus
                                                data-pos-exclude-wedge
                                                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                            />
                                            <button 
                                                onClick={() => {
                                                    const newPrice = parseFloat(editingPrice);
                                                    if (!isNaN(newPrice) && newPrice > 0) {
                                                        updatePrice(cartIdx, newPrice);
                                                    }
                                                }}
                                                className="text-green-600 hover:text-green-800 text-xs font-bold"
                                            >
                                                ✓
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setEditingPriceId(null);
                                                    setEditingPrice('');
                                                }}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium text-gray-900">Sale: ₱{item.price.toFixed(2)}</span>
                                            <button 
                                                onClick={() => {
                                                    setEditingPriceId(cartIdx);
                                                    setEditingPrice(item.price.toString());
                                                }}
                                                className="text-blue-500 hover:text-blue-700"
                                                title="Adjust transaction price only"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 italic mt-0.5">*Price adjustment for this transaction only</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 bg-white rounded border border-gray-200">
                                    <button onClick={() => updateQuantity(cartIdx, -1)} className="p-1 hover:bg-gray-100 text-gray-600"><Minus size={12}/></button>
                                    <span className="text-sm w-6 text-center font-medium text-gray-900">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(cartIdx, 1)} className="p-1 hover:bg-gray-100 text-gray-600"><Plus size={12}/></button>
                                </div>
                                <div className="font-bold text-gray-900 w-16 text-right">
                                    ₱{(item.price * item.quantity).toFixed(2)}
                                </div>
                                <button onClick={() => removeFromCart(cartIdx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer / Checkout */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between mb-2 text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>₱{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-4 text-xl font-bold text-gray-900">
                    <span>Total</span>
                    <span>₱{cartTotal.toFixed(2)}</span>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
                        <input 
                            ref={paymentInputRef}
                            type="number"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder="0.00"
                            data-pos-exclude-wedge
                            className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-bold bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || !paymentAmount || isLoading}
                    className={`w-full py-4 rounded-lg font-bold text-lg flex justify-center items-center gap-2 shadow-md transition-colors ${
                        cart.length > 0 && paymentAmount && !isLoading
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20}/> : <CreditCard size={20}/>}
                    {isLoading ? 'Processing...' : 'Pay Now'}
                </button>
            </div>
       </div>

       {/* Receipt Modal */}
       {showReceipt && receiptData && (
           <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                   <div className="bg-slate-900 text-white p-4 text-center relative">
                       <h3 className="font-bold text-lg">Transaction Receipt</h3>
                       <button onClick={closeReceipt} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><Plus className="rotate-45" size={24}/></button>
                   </div>
                   <div className="p-6 overflow-y-auto flex-1 font-mono text-sm">
                        <div className="text-center mb-6">
                            <div className="font-bold text-xl text-gray-800 uppercase tracking-wider mb-1">PAYTECH</div>
                            <div className="text-gray-500">{receiptData.storeName}</div>
                            <div className="text-xs text-gray-400 mt-1">{receiptData.date}</div>
                            <div className="text-xs text-gray-400">Cashier: {receiptData.cashier}</div>
                        </div>

                        <div className="border-b-2 border-dashed border-gray-300 mb-4"></div>

                        <div className="space-y-2 mb-4">
                            {receiptData.items.map((item: any, idx: number) => (
                                <div key={idx} className="text-gray-800">
                                    <div className="flex justify-between">
                                        <span className="truncate w-32">{item.name}</span>
                                        <div className="flex gap-4">
                                            <span className="text-gray-500">x{item.quantity}</span>
                                            <span className="font-semibold text-right w-16">₱{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    {item.barcodes?.length > 0 && (
                                      <div className="text-[10px] text-gray-400 font-mono pl-1">{item.barcodes.join(', ')}</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="border-b-2 border-dashed border-gray-300 mb-4"></div>

                        <div className="flex justify-between mb-1 font-bold text-gray-900 text-lg">
                            <span>TOTAL</span>
                            <span>₱{receiptData.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 mb-1">
                            <span>CASH</span>
                            <span>₱{receiptData.payment.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>CHANGE</span>
                            <span>₱{receiptData.change.toFixed(2)}</span>
                        </div>

                        <div className="mt-8 text-center text-xs text-gray-400">
                            Thank you for your purchase!
                        </div>
                   </div>
                   <div className="p-4 bg-gray-50 border-t border-gray-100">
                       <button onClick={closeReceipt} className="w-full bg-slate-900 text-white py-3 rounded font-semibold hover:bg-slate-800">
                           New Transaction
                       </button>
                   </div>
               </div>
           </div>
       )}

       {showScanner && (
         <BarcodeScanner
           onScan={processBarcode}
           onClose={closeCameraScanner}
         />
       )}

       {viewBarcodesCartIdx !== null && cart[viewBarcodesCartIdx]?.barcodes && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
             <div className="p-4 border-b border-gray-200 flex justify-between items-center">
               <div>
                 <h3 className="font-bold text-gray-900">Scanned Barcodes</h3>
                 <p className="text-sm text-gray-500 truncate">{cart[viewBarcodesCartIdx].name}</p>
               </div>
               <button
                 type="button"
                 onClick={() => setViewBarcodesCartIdx(null)}
                 className="text-gray-400 hover:text-gray-600"
               >
                 <X size={24} />
               </button>
             </div>
             <div className="p-4 max-h-64 overflow-y-auto space-y-2">
               {cart[viewBarcodesCartIdx].barcodes!.map((code, idx) => (
                 <div
                   key={`${code}-${idx}`}
                   className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100"
                 >
                   <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                   <span className="text-sm font-mono text-purple-700">{code}</span>
                 </div>
               ))}
             </div>
             <div className="p-4 border-t border-gray-100 bg-gray-50">
               <button
                 type="button"
                 onClick={() => setViewBarcodesCartIdx(null)}
                 className="w-full py-2 bg-slate-900 text-white rounded font-medium hover:bg-slate-800"
               >
                 Close
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};