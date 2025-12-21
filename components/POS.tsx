import React, { useState, useEffect, useMemo } from 'react';
import { User, Store, InventoryItem, CartItem, UserRole, PosTransaction } from '../types';
import { storageService } from '../services/storageService';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Loader2, Edit2, X } from 'lucide-react';
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
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [editingPrice, setEditingPrice] = useState<string>('');

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
        }
    };
    loadInventory();
  }, [activeStoreId]);

  const addToCart = (item: InventoryItem) => {
    if (item.stock <= 0) return alert("Item out of stock");

    setCart(prev => {
        const existing = prev.find(c => c.id === item.id);
        if (existing) {
            // Check stock limit in cart
            if (existing.quantity >= item.stock) {
                alert("Max stock reached");
                return prev;
            }
            return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
        }
        return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(c => {
        if (c.id === itemId) {
            const newQty = c.quantity + delta;
            // Prevent going below 1 (use remove instead) and above stock
            if (newQty < 1) return c;
            if (newQty > c.stock) return c; 
            return { ...c, quantity: newQty };
        }
        return c;
    }));
  };

  const removeFromCart = (itemId: string) => {
      setCart(prev => prev.filter(c => c.id !== itemId));
  };

  const updatePrice = (itemId: string, newPrice: number) => {
      setCart(prev => prev.map(c => 
          c.id === itemId ? { ...c, price: newPrice } : c
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
        // Process Transaction
        // 1. Update Inventory Stock (Async)
        for (const item of cart) {
            await storageService.updateInventoryStock(item.id, -item.quantity);
        }

        // 2. Save POS Transaction Log (For Reports) - NOW AWAITED
        const transaction: PosTransaction = {
            id: uuidv4(),
            storeId: activeStoreId,
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            items: [...cart],
            totalAmount: cartTotal,
            paymentAmount: pay,
            cashierName: user.name
        };
        await storageService.savePosTransaction(transaction); // <--- AWAIT HERE

        // 3. Generate Receipt Data
        const receipt = {
            date: new Date().toLocaleString(),
            storeName: stores.find(s => s.id === activeStoreId)?.name || 'Store',
            items: [...cart],
            total: cartTotal,
            payment: pay,
            change: pay - cartTotal,
            cashier: user.name
        };
        setReceiptData(receipt);
        setShowReceipt(true);
        
        // 4. Clear Cart (in background, UI shows receipt)
        setCart([]);
        setPaymentAmount('');
        
        // Refresh inventory list to show new stock
        const allInventory = await storageService.getInventory();
        setItems(allInventory.filter(i => i.storeId === activeStoreId));
      } catch (error) {
        console.error("Checkout failed:", error);
        alert("Failed to process transaction. Please try again.");
      } finally {
        setIsLoading(false);
      }
  };

  const closeReceipt = () => {
      setShowReceipt(false);
      setReceiptData(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full w-full min-w-0">
       {/* Left: Item Grid */}
    <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="font-bold text-gray-700">Available Items</div>
                {user.role === UserRole.ADMIN && (
                    <select 
                        value={activeStoreId}
                        onChange={e => setActiveStoreId(e.target.value)}
                        className="p-1 border border-gray-300 rounded text-sm bg-white text-gray-900"
                    >
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}
            </div>
            
            <div className="p-4 border-b border-gray-100">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search items by name or category..."
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={32}/></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.filter(item => 
                            !searchTerm.trim() || 
                            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
                        ).map(item => (
                            <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                disabled={item.stock === 0}
                                className={`text-left p-3 rounded-lg border shadow-sm transition-all flex flex-col justify-between h-full ${
                                    item.stock === 0
                                        ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                                        : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
                                }`}
                            >
                                <div className="w-full mb-2">
                                    <div className="font-bold text-gray-900 line-clamp-2">{item.name}</div>
                                    {item.category && <div className="text-xs text-gray-500 mt-1 inline-block bg-gray-100 px-2 py-0.5 rounded">{item.category}</div>}
                                </div>
                                
                                <div className="w-full flex justify-between items-end mt-auto pt-2 border-t border-gray-50">
                                    <div>
                                        <div className={`text-xs font-bold ${item.stock === 0 ? 'text-red-500' : item.stock < 5 ? 'text-orange-500' : 'text-green-600'}`}>
                                            {item.stock === 0 ? 'OUT OF STOCK' : `${item.stock} Left`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-blue-600 text-lg">₱{item.price.toFixed(2)}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {items.length === 0 && !isLoading && (
                            <div className="col-span-full text-center py-10 text-gray-400 italic">
                                No items available in this store.
                            </div>
                        )}
                    </div>
                )}
            </div>
       </div>

       {/* Right: Cart & Checkout */}
    <div className="w-full md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col h-full min-w-0">
            <div className="p-4 bg-slate-900 text-white font-bold flex items-center gap-2 rounded-t-lg">
                <ShoppingCart size={20}/> Current Order
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <ShoppingCart size={48} className="mb-2"/>
                        <p>Cart is empty</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100">
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="font-medium text-gray-900 truncate">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                    Cost: ₱{item.cost?.toFixed(2) || '0.00'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {editingPriceId === item.id ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-600">Sale: ₱</span>
                                            <input 
                                                type="number"
                                                value={editingPrice}
                                                onChange={e => setEditingPrice(e.target.value)}
                                                placeholder={item.price.toFixed(2)}
                                                autoFocus
                                                className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                                            />
                                            <button 
                                                onClick={() => {
                                                    const newPrice = parseFloat(editingPrice);
                                                    if (!isNaN(newPrice) && newPrice > 0) {
                                                        updatePrice(item.id, newPrice);
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
                                                    setEditingPriceId(item.id);
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
                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-gray-100 text-gray-600"><Minus size={12}/></button>
                                    <span className="text-sm w-6 text-center font-medium text-gray-900">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-gray-100 text-gray-600"><Plus size={12}/></button>
                                </div>
                                <div className="font-bold text-gray-900 w-16 text-right">
                                    ₱{(item.price * item.quantity).toFixed(2)}
                                </div>
                                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
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
                            type="number"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder="0.00"
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
                                <div key={idx} className="flex justify-between text-gray-800">
                                    <span className="truncate w-32">{item.name}</span>
                                    <div className="flex gap-4">
                                        <span className="text-gray-500">x{item.quantity}</span>
                                        <span className="font-semibold text-right w-16">₱{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
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
    </div>
  );
};