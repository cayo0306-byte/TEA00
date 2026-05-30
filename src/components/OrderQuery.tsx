import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Sparkles, Clock, CheckCircle, PackageOpen, Ban } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Order } from '../types';
import { formatCurrency } from '../utils';

export default function OrderQuery() {
  const [phoneInput, setPhoneInput] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSearched(false);

    const cleanedPhone = phoneInput.replace(/[-\s]/g, '');
    if (!cleanedPhone) {
      setErrorMsg('請輸入手機號碼');
      return;
    }

    if (cleanedPhone.length < 9) {
      setErrorMsg('手機號碼長度不足');
      return;
    }

    setLoading(true);

    try {
      const ordersRef = collection(db, 'orders');
      // Create a query matching the customer's phone number
      const q = query(
        ordersRef, 
        where('customerPhone', '==', cleanedPhone),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedOrders: Order[] = [];
      querySnapshot.forEach((doc) => {
        fetchedOrders.push({
          ...(doc.data() as Omit<Order, 'id'>),
          id: doc.id,
        });
      });
      
      setOrders(fetchedOrders);
      setSearched(true);
    } catch (err: any) {
      console.error('Error fetching customer orders:', err);
      // It's possible that a compound index for (customerPhone, createdAt) doesn't exist yet in development.
      // Let's fallback to searching without orderBy, then sorting manually! This prevents dynamic index requirement failures!
      try {
        const ordersRef = collection(db, 'orders');
        const fallbackQuery = query(ordersRef, where('customerPhone', '==', cleanedPhone));
        const querySnapshot = await getDocs(fallbackQuery);
        const fetchedOrders: Order[] = [];
        querySnapshot.forEach((doc) => {
          fetchedOrders.push({
            ...(doc.data() as Omit<Order, 'id'>),
            id: doc.id,
          });
        });
        
        // Manual sort by createdAt desc
        fetchedOrders.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        setOrders(fetchedOrders);
        setSearched(true);
      } catch (fallbackErr) {
        try {
          handleFirestoreError(fallbackErr, OperationType.LIST, 'orders');
        } catch (formattedErr: any) {
          setErrorMsg('查詢失敗，請稍候再試或連線異常。');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = {
    pending: { label: '待接單', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    preparing: { label: '製作中', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: Loader2 },
    completed: { label: '可取餐 / 已送達', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
    cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Ban }
  };

  return (
    <div id="order-query-container" className="max-w-2xl mx-auto bg-white/70 backdrop-blur-md rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-teal-600" />
        <h2 className="text-base font-bold text-gray-800">查詢我的點單進度</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        輸入點單時填寫的<strong>聯絡手機 (例如 0912345678)</strong>，即可追蹤茶鋪的實時接單、配製進度。
      </p>

      <form id="order-query-form" onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <input
            id="order-query-phone-input"
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="請輸入手機號碼 (09xxxxxxxx)"
            maxLength={10}
            className="w-full text-xs pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-mono"
            required
          />
        </div>
        <button
          id="order-query-search-btn"
          type="submit"
          disabled={loading}
          className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold py-3 px-5 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs active:scale-98 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>立即查詢</span>
        </button>
      </form>

      {errorMsg && (
        <div id="query-error-banner" className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 mb-4 animate-fade-in">
          {errorMsg}
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {searched && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            {orders.length === 0 ? (
              <div className="text-center py-10 bg-gray-55/30 rounded-xl border border-dashed border-gray-200">
                <PackageOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-550 font-medium">查無點單紀錄</p>
                <p className="text-[10px] text-gray-400 mt-1">請確保手機號碼正確，或未曾建立該號碼的商品點單。</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">共找到 {orders.length} 筆點單</h3>
                {orders.map((order) => {
                  const StatusIcon = statusMeta[order.status]?.icon || Clock;
                  return (
                    <div
                      key={order.id}
                      id={`queried-order-${order.id}`}
                      className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-teal-50/10 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-180 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-800 font-mono">{order.orderNumber}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(order.createdAt).toLocaleString('zh-TW')}
                          </span>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusMeta[order.status]?.color}`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${order.status === 'preparing' ? 'animate-spin' : ''}`} />
                          {statusMeta[order.status]?.label}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-gray-600">
                            <div>
                              <span className="font-semibold text-gray-800">{item.menuItem.name}</span>
                              <span className="text-gray-400 mx-1 font-mono">x{item.quantity}</span>
                              <span className="text-[10px] text-gray-500 bg-white border border-gray-100 px-1 py-0.2 rounded-sm ml-1">
                                {item.size} • {item.sugar} • {item.ice}
                              </span>
                              {item.toppings.length > 0 && (
                                <span className="text-[10px] text-amber-700 ml-1">
                                  (+{item.toppings.map(t => t.name).join(', ')})
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-gray-700">{formatCurrency(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>

                      {order.remarks && (
                        <div className="text-[10px] text-gray-400 mt-2 italic border-t border-gray-100 pt-2 flex items-center gap-1">
                          <strong>加註:</strong> {order.remarks}
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200/50">
                        <span className="text-[10px] text-gray-400">點單人：{order.customerName}</span>
                        <span className="text-sm font-bold text-teal-800">
                          小計 <span className="font-mono">{formatCurrency(order.totalPrice)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
