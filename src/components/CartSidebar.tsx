import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Trash2, User, Phone, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { CartItem, Order } from '../types';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc, getCountFromServer } from 'firebase/firestore';
import { formatCurrency, isValidPhone } from '../utils';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (cartId: string, newQty: number) => void;
  onRemoveItem: (cartId: string) => void;
  onClearCart: () => void;
  onOrderPlaced: (order: Order) => void;
}

export default function CartSidebar({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderPlaced
}: CartSidebarProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const totalPrice = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cartItems.length === 0) {
      setErrorMsg('您的購物車是空的，快去挑選好喝的茶飲吧！');
      return;
    }

    if (!customerName.trim()) {
      setErrorMsg('請輸入您的姓名');
      return;
    }

    const cleanedPhone = customerPhone.replace(/[-\s]/g, '');
    if (!cleanedPhone) {
      setErrorMsg('請輸入您的聯絡電話');
      return;
    }

    if (!isValidPhone(cleanedPhone)) {
      setErrorMsg('請輸入正確的手機號碼格式 (例如 0912345678)');
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine the sequential order number by counting current orders in Firestore
      const ordersRef = collection(db, 'orders');
      let orderCount = 0;
      
      try {
        const countSnapshot = await getCountFromServer(ordersRef);
        orderCount = countSnapshot.data().count;
      } catch (countErr) {
        console.warn('Could not get order count, defaulting sequence:', countErr);
        orderCount = Math.floor(Math.random() * 100); // Fail-safe fallback
      }

      const nextOrderNum = `#${1001 + orderCount}`;

      // Clean up cartItems to discard any undefined fields in nested objects prior to saving
      const cleanedItems = cartItems.map((item) => {
        const cleanedMenuItem: any = {
          id: item.menuItem.id,
          name: item.menuItem.name,
          englishName: item.menuItem.englishName || '',
          category: item.menuItem.category,
          priceM: item.menuItem.priceM !== undefined ? item.menuItem.priceM : null,
          priceL: item.menuItem.priceL,
          isRecommended: !!item.menuItem.isRecommended,
          isHotPossible: !!item.menuItem.isHotPossible,
          isNoCaffeine: !!item.menuItem.isNoCaffeine,
          description: item.menuItem.description || '',
          tags: item.menuItem.tags || [],
          onSale: !!item.menuItem.onSale,
        };

        if (item.menuItem.createdAt) {
          cleanedMenuItem.createdAt = item.menuItem.createdAt;
        }
        if (item.menuItem.updatedAt) {
          cleanedMenuItem.updatedAt = item.menuItem.updatedAt;
        }

        const cleanedToppings = item.toppings.map(t => ({
          name: t.name,
          price: t.price
        }));

        return {
          cartId: item.cartId,
          menuItem: cleanedMenuItem,
          size: item.size,
          sugar: item.sugar,
          ice: item.ice,
          toppings: cleanedToppings,
          quantity: item.quantity,
          remarks: item.remarks || '',
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
        };
      });

      const newOrder: any = {
        orderNumber: nextOrderNum,
        customerName: customerName.trim(),
        customerPhone: cleanedPhone,
        items: cleanedItems,
        totalPrice,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (remarks.trim()) {
        newOrder.remarks = remarks.trim();
      }

      const docRef = await addDoc(ordersRef, newOrder);
      
      const completedOrder: Order = {
        ...newOrder,
        id: docRef.id,
      };

      onOrderPlaced(completedOrder);
      onClearCart();
      // Reset form fields
      setCustomerName('');
      setCustomerPhone('');
      setRemarks('');
      onClose();
    } catch (err) {
      console.error('Checkout error:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'orders');
      } catch (formattedErr: any) {
        setErrorMsg('建立訂單失敗：' + formattedErr.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="cart-sidebar-overlay" className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          {/* Drawer Sheet */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              id="cart-sidebar-container"
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-teal-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
                  <h2 id="cart-title" className="text-lg font-bold font-sans">我的點單車</h2>
                  <span id="cart-count-badge" className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {cartItems.reduce((acc, item) => acc + item.quantity, 0)} 杯
                  </span>
                </div>
                <button
                  id="close-cart-btn"
                  onClick={onClose}
                  className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div id="cart-items-list" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                    <ShoppingBag className="w-16 h-16 text-gray-200 stroke-[1.2] mb-4" />
                    <p className="text-sm font-medium">購物車裡什麼都沒有喔</p>
                    <button
                      id="cart-empty-go-shop"
                      onClick={onClose}
                      className="mt-4 text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline"
                    >
                      開始挑選美味茶飲 →
                    </button>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <motion.div
                      key={item.cartId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 50 }}
                      id={`cart-item-${item.cartId}`}
                      className="flex items-start gap-3 p-3 bg-gray-50/80 hover:bg-gray-50 rounded-xl border border-gray-100/50 transition-colors"
                    >
                      {/* Details */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-800 font-sans">{item.menuItem.name}</span>
                          <span className="text-sm font-bold text-gray-800 font-mono">{formatCurrency(item.totalPrice)}</span>
                        </div>
                        
                        <div id="item-options-summary" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
                          <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-sm font-semibold">{item.size}杯</span>
                          <span>|</span>
                          <span>{item.sugar}</span>
                          <span>|</span>
                          <span>{item.ice}</span>
                        </div>

                        {item.toppings.length > 0 && (
                          <div id="item-toppings-summary" className="text-xs text-gray-400 mt-1 flex flex-wrap gap-1">
                            <span>配料: </span>
                            {item.toppings.map((t, idx) => (
                              <span key={idx} className="bg-amber-55/10 text-amber-800 px-1 py-0.2 rounded-sm font-medium">
                                {t.name}(+{t.price})
                              </span>
                            ))}
                          </div>
                        )}

                        {item.remarks && (
                          <div id="item-备注" className="text-xs text-gray-400 italic mt-1.5 bg-white p-1.5 rounded-md border border-gray-100 flex items-center gap-1">
                            <span className="font-semibold text-teal-600 font-sans not-italic">備註:</span> {item.remarks}
                          </div>
                        )}

                        {/* Controls */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center bg-white border border-gray-200/80 rounded-lg p-0.5 shadow-2xs">
                            <button
                              id={`cart-item-${item.cartId}-decrease`}
                              onClick={() => onUpdateQty(item.cartId, item.quantity - 1)}
                              className="text-gray-400 p-1 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                            <button
                              id={`cart-item-${item.cartId}-increase`}
                              onClick={() => onUpdateQty(item.cartId, item.quantity + 1)}
                              className="text-gray-400 p-1 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <X className="w-3 h-3 rotate-45" />
                            </button>
                          </div>

                          <button
                            id={`cart-item-${item.cartId}-delete`}
                            onClick={() => onRemoveItem(item.cartId)}
                            className="p-1 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="刪除品項"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Checkout Form */}
              {cartItems.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-6 space-y-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">點單人資訊</h3>
                  
                  {errorMsg && (
                    <div id="checkout-error-banner" className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-center gap-2">
                      <span className="font-bold flex-shrink-0 animate-pulse">⚠️</span>
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex.items-center flex items-center justify-center text-gray-400 pointer-events-none">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="checkout-name"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="點單人姓名"
                        className="w-full text-xs pl-9 pr-3 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                        required
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center justify-center text-gray-400 pointer-events-none">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        id="checkout-phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="手機號碼 (例如 0912345678)"
                        maxLength={10}
                        className="w-full text-xs pl-9 pr-3 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                        required
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 pt-3 flex items-start justify-center text-gray-400 pointer-events-none">
                        <FileText className="w-4 h-4" />
                      </div>
                      <textarea
                        id="checkout-remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="整筆訂單備註 (例如：去冰的放一起、需要吸管...)"
                        maxLength={120}
                        className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors resize-none h-16"
                      />
                    </div>

                    {/* Submit Section */}
                    <div className="pt-4 border-t border-gray-150 mt-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">應付總額 Total:</span>
                        <span id="checkout-total-price" className="text-xl font-bold text-teal-800 font-mono">
                          {formatCurrency(totalPrice)}
                        </span>
                      </div>

                      <button
                        id="checkout-submit-btn"
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-700/10 active:scale-98 transition-all disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            正在送出送出單...
                          </span>
                        ) : (
                          <>
                            <span>送出美味點單</span>
                            <ArrowRight className="w-4 h-4 ml-0.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
