import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ShoppingBag,
  PlusCircle,
  TrendingUp,
  RotateCcw,
  Coffee,
  X,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  Play,
  CheckCircle,
  Ban
} from 'lucide-react';
import { Order, MenuItem, SystemConfig } from '../types';
import { hashPassword, formatCurrency } from '../utils';
import DashboardAnalytics from './DashboardAnalytics';

interface AdminPanelProps {
  products: MenuItem[];
  onRefreshProducts: () => void;
}

export default function AdminPanel({ products, onRefreshProducts }: AdminPanelProps) {
  // Authentication & Initialization State
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Operational State
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'analytics'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'pending' | 'preparing' | 'completed' | 'cancelled'>('all');

  // Product CRUD Form State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodEnglish, setProdEnglish] = useState('');
  const [prodCategory, setProdCategory] = useState('台灣原茶');
  const [customCategory, setCustomCategory] = useState('');
  const [prodPriceM, setProdPriceM] = useState<string>('');
  const [prodPriceL, setProdPriceL] = useState<string>('');
  const [prodIsRecommended, setProdIsRecommended] = useState(false);
  const [prodIsHotPossible, setProdIsHotPossible] = useState(false);
  const [prodIsNoCaffeine, setProdIsNoCaffeine] = useState(false);
  const [prodDescription, setProdDescription] = useState('');
  const [prodTagsString, setProdTagsString] = useState('');
  const [productFormError, setProductFormError] = useState('');

  // 1. Fetch system auth settings and check if configured
  useEffect(() => {
    const configRef = doc(db, 'system_config', 'admin');
    
    // First read system configuration
    const checkConfig = async () => {
      try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as SystemConfig;
          setIsConfigured(data.isConfigured);
        } else {
          setIsConfigured(false);
        }
      } catch (err) {
        console.error('Error fetching admin config:', err);
        setIsConfigured(false);
      }
    };

    checkConfig();
  }, []);

  // 2. Real-time Subscription to Orders using onSnapshot
  useEffect(() => {
    if (!isUnlocked) return;

    const ordersRef = collection(db, 'orders');
    
    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((doc) => {
          fetchedOrders.push({
            ...(doc.data() as Omit<Order, 'id'>),
            id: doc.id,
          });
        });
        
        // Sort orders globally by date newest to oldest
        fetchedOrders.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });

        setOrders(fetchedOrders);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'orders');
        } catch (err) {
          console.error('Real-time order subscription failed:', err);
        }
      }
    );

    return () => unsubscribe();
  }, [isUnlocked]);

  // Handle first-time password registration
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (passwordInput.length < 4) {
      setAuthError('管理密碼長度必須至少為 4 位數');
      return;
    }

    if (passwordInput !== confirmPassword) {
      setAuthError('兩次輸入的的密碼不一致！');
      return;
    }

    setIsActionLoading(true);

    try {
      const hash = await hashPassword(passwordInput);
      const configRef = doc(db, 'system_config', 'admin');

      const configPayload: SystemConfig = {
        id: 'admin',
        passwordHash: hash,
        isConfigured: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(configRef, configPayload);
      setIsConfigured(true);
      setIsUnlocked(true);
      setPasswordInput('');
      setConfirmPassword('');
    } catch (err) {
      setAuthError('帳戶設定失敗，請檢查網頁連線或資料庫權限及狀態。');
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Password Verification/Login
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsActionLoading(true);

    try {
      const configRef = doc(db, 'system_config', 'admin');
      const docSnap = await getDoc(configRef);

      if (!docSnap.exists()) {
        setAuthError('認證設定有誤，請嘗試重整網頁。');
        setIsConfigured(false);
        setIsActionLoading(false);
        return;
      }

      const data = docSnap.data() as SystemConfig;
      const inputHash = await hashPassword(passwordInput);

      if (inputHash === data.passwordHash) {
        setIsUnlocked(true);
        setPasswordInput('');
      } else {
        setAuthError('密碼不正確，請重新輸入。');
      }
    } catch (err) {
      setAuthError('認證查詢失敗，請檢查網路連線。');
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Log out of admin panel
  const handleLockAdmin = () => {
    setIsUnlocked(false);
    setPasswordInput('');
  };

  // Handle Order Status Transitions (接單, 完成, 取消)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'preparing' | 'completed' | 'cancelled') => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Update order status error:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      } catch (formattedErr: any) {
        alert('狀態更新失敗：' + formattedErr.message);
      }
    }
  };

  // Open product form (Create)
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdEnglish('');
    setProdCategory('台灣原茶');
    setCustomCategory('');
    setProdPriceM('');
    setProdPriceL('');
    setProdIsRecommended(false);
    setProdIsHotPossible(false);
    setProdIsNoCaffeine(false);
    setProdDescription('');
    setProdTagsString('');
    setProductFormError('');
    setIsProductModalOpen(true);
  };

  // Open product form (Edit)
  const handleOpenEditProduct = (product: MenuItem) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdEnglish(product.englishName);
    
    const standardCategories = ['台灣原茶', '朵朵與莎莎', '柚香橙韻', '水果調飲', '香醇鮮乳', '醇奶特調', '原茶調飲', '不失眠', '抱抱冬瓜'];
    if (standardCategories.includes(product.category)) {
      setProdCategory(product.category);
      setCustomCategory('');
    } else {
      setProdCategory('OTHER');
      setCustomCategory(product.category);
    }

    setProdPriceM(product.priceM !== null ? String(product.priceM) : '');
    setProdPriceL(String(product.priceL));
    setProdIsRecommended(product.isRecommended);
    setProdIsHotPossible(product.isHotPossible);
    setProdIsNoCaffeine(product.isNoCaffeine);
    setProdDescription(product.description);
    setProdTagsString(product.tags.join(', '));
    setProductFormError('');
    setIsProductModalOpen(true);
  };

  // Toggle onSale status directly in list
  const handleToggleProductSale = async (product: MenuItem) => {
    try {
      const prodRef = doc(db, 'menu_items', product.id);
      await updateDoc(prodRef, {
        onSale: !product.onSale,
        updatedAt: new Date().toISOString()
      });
      onRefreshProducts();
    } catch (err) {
      console.error('Toggle sale error:', err);
    }
  };

  // Delete product action
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('確定要永久刪除此品項嗎？此操作無法還原。')) return;

    try {
      const prodRef = doc(db, 'menu_items', productId);
      await deleteDoc(prodRef);
      onRefreshProducts();
    } catch (err) {
      console.error('Delete product error:', err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `menu_items/${productId}`);
      } catch (formattedErr: any) {
        alert('刪除品項失敗：' + formattedErr.message);
      }
    }
  };

  // Handle product creation or update submit
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError('');

    if (!prodName.trim()) {
      setProductFormError('請輸入品項中文名稱');
      return;
    }

    const priceLNum = parseInt(prodPriceL);
    if (isNaN(priceLNum) || priceLNum <= 0) {
      setProductFormError('大杯價格必須是大於 0 的整數');
      return;
    }

    const priceMNum = prodPriceM.trim() ? parseInt(prodPriceM) : null;
    if (priceMNum !== null && (isNaN(priceMNum) || priceMNum <= 0)) {
      setProductFormError('中杯價格若填寫，必須是大於 0 的整數');
      return;
    }

    // Determine target category
    const targetCategory = prodCategory === 'OTHER' ? customCategory.trim() : prodCategory;
    if (!targetCategory) {
      setProductFormError('請輸入自訂類別名稱');
      return;
    }

    const tagsArray = prodTagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const productPayload = {
      name: prodName.trim(),
      englishName: prodEnglish.trim(),
      category: targetCategory,
      priceM: priceMNum,
      priceL: priceLNum,
      isRecommended: prodIsRecommended,
      isHotPossible: prodIsHotPossible,
      isNoCaffeine: prodIsNoCaffeine,
      description: prodDescription.trim(),
      tags: tagsArray,
      onSale: editingProduct ? editingProduct.onSale : true,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProduct) {
        // Edit Mode: update in database
        const prodRef = doc(db, 'menu_items', editingProduct.id);
        await updateDoc(prodRef, productPayload);
      } else {
        // Create Mode: add doc with a readable random id to database
        const randId = 'drink-' + Math.random().toString(36).substr(2, 9);
        const prodRef = doc(db, 'menu_items', randId);
        await setDoc(prodRef, {
          ...productPayload,
          id: randId,
          createdAt: new Date().toISOString()
        });
      }

      setIsProductModalOpen(false);
      onRefreshProducts();
    } catch (err) {
      console.error('Save product error:', err);
      setProductFormError('儲存商品失敗，請檢查網頁連線狀態。');
    }
  };

  // Filter orders view
  const filteredOrders = orders.filter(o => {
    if (ordersFilter === 'all') return true;
    return o.status === ordersFilter;
  });

  // UI state when check is pending
  if (isConfigured === null) {
    return (
      <div className="min-h-80 flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-teal-600/30 border-t-teal-700 rounded-full animate-spin"></span>
      </div>
    );
  }

  // FIRST-TIME PASSWORD CONFIGURATION PANEL
  if (!isConfigured) {
    return (
      <div id="first-time-setup-panel" className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-8 shadow-xl mt-12">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-xs">
            <KeyRound className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 font-sans">設定管理者登入密碼</h2>
          <p className="text-xs text-gray-400 mt-2">
            為了維護您的茶飲店營收與產品資料，請在第一次使用前設定一組安全密碼。
          </p>
        </div>

        {authError && (
          <div id="setup-error-banner" className="mb-4 bg-red-50 text-red-600 text-xs p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form id="setup-password-form" onSubmit={handleSetupPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">設定管理密碼</label>
            <div className="relative">
              <input
                id="setup-password-input"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="請輸入密碼 (至少 4 位)"
                className="w-full text-xs px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-mono"
                required
              />
              <button
                type="button"
                id="setup-toggle-pwd-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">確認輸入密碼</label>
            <input
              id="setup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="請再次輸入相同的密碼"
              className="w-full text-xs px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-mono"
              required
            />
          </div>

          <button
            id="setup-save-btn"
            type="submit"
            disabled={isActionLoading}
            className="w-full bg-teal-700 hover:bg-teal-850 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isActionLoading ? '正在設定中...' : '儲存管理密碼並進入後台'}
          </button>
        </form>
      </div>
    );
  }

  // RUNTIME PASSWORD UNLOCK SECURITY PANEL
  if (!isUnlocked) {
    return (
      <div id="unlock-admin-panel" className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-8 shadow-xl mt-12">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 font-sans">請輸入管理者認證密碼</h2>
          <p className="text-xs text-gray-400 mt-2">
            需要安全認證才能進行接單服務與商品建檔、售價修改，不需第三方 credentials。
          </p>
        </div>

        {authError && (
          <div id="unlock-error-banner" className="mb-4 bg-red-50 text-red-650 text-xs p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-bounce" />
            <span>{authError}</span>
          </div>
        )}

        <form id="verify-password-form" onSubmit={handleVerifyPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">管理者密碼</label>
            <div className="relative">
              <input
                id="verify-password-input"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full text-xs px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-mono"
                required
              />
              <button
                type="button"
                id="verify-toggle-pwd-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="verify-submit-btn"
            type="submit"
            disabled={isActionLoading}
            className="w-full bg-teal-700 hover:bg-teal-850 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isActionLoading ? '驗證中...' : '驗證密碼並登入'}
          </button>
        </form>
      </div>
    );
  }

  // ACTIVE MERCHANDISING ADMIN CONTROL INTERFACE
  const orderCountByStatus = (status: string) => orders.filter(o => o.status === status).length;

  return (
    <div id="authenticated-admin-panel" className="space-y-6">
      {/* Admin Dashboard Page Nav */}
      <div className="bg-white border border-gray-150 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-700 text-white rounded-xl flex items-center justify-center">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-sans text-gray-800">烏弄 merchant 店鋪後台</h2>
            <div className="text-[10px] text-gray-400">登入狀態：安全管理者授權</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-gray-50 border border-gray-150 rounded-xl p-1">
          <button
            id="admin-tab-orders"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'orders' ? 'bg-white shadow-xs text-teal-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>訂單接單</span>
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            id="admin-tab-products"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'products' ? 'bg-white shadow-xs text-teal-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>商品庫存</span>
          </button>
          <button
            id="admin-tab-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-white shadow-xs text-teal-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>營收統計</span>
          </button>
        </div>

        <button
          id="admin-logout-btn"
          onClick={handleLockAdmin}
          className="text-xs font-bold text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 border border-gray-150 hover:border-red-100 px-3.5 py-2 rounded-xl transition-all"
        >
          登出後台
        </button>
      </div>

      {/* RENDER ACTIVE VIEW */}
      {activeTab === 'orders' && (
        <div id="admin-orders-tab-view" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-4 border border-gray-200/50 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-800">接單終端 (實時同步中)</h3>
            
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5 text-xs text-gray-600">
              {(['all', 'pending', 'preparing', 'completed', 'cancelled'] as const).map((filter) => {
                const labelMap = { all: '全部', pending: '待處理', preparing: '製作中', completed: '已完成', cancelled: '已取消' };
                const count = filter === 'all' ? orders.length : orderCountByStatus(filter);
                return (
                  <button
                    key={filter}
                    id={`order-filter-${filter}`}
                    onClick={() => setOrdersFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      ordersFilter === filter
                        ? 'bg-teal-700 border-teal-700 text-white shadow-xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {labelMap[filter]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-2" />
              <p className="text-xs font-semibold">目前無任何符合篩選的訂單</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => {
                const orderDate = new Date(order.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={order.id}
                    id={`admin-order-card-${order.id}`}
                    className={`bg-white rounded-2xl border p-5 transition-all shadow-xm ${
                      order.status === 'pending' ? 'border-amber-400 ring-2 ring-amber-100 animate-pulse' : 'border-gray-150'
                    }`}
                  >
                    {/* Card Title */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-gray-900 font-mono">{order.orderNumber}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                            order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                            order.status === 'preparing' ? 'bg-sky-100 text-sky-800' :
                            order.status === 'completed' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {order.status === 'pending' ? '待接單' :
                             order.status === 'preparing' ? '製作中' :
                             order.status === 'completed' ? '已完成' : '已取消'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-1 font-mono">
                          時間：{new Date(order.createdAt).toLocaleString('zh-TW')}
                        </span>
                      </div>
                      <span className="text-base font-extrabold text-teal-800 font-mono">
                        {formatCurrency(order.totalPrice)}
                      </span>
                    </div>

                    {/* Customer Meta */}
                    <div className="bg-gray-50 p-2.5 rounded-xl text-xs space-y-1 mb-4 border border-gray-100">
                      <div className="flex justify-between">
                        <span className="text-gray-400">客戶：{order.customerName}</span>
                        <span className="text-gray-500 font-mono font-bold">手機：{order.customerPhone}</span>
                      </div>
                      {order.remarks && (
                        <div className="text-[10px] text-teal-700 italic pt-1 border-t border-gray-180 flex items-center gap-1">
                          <strong>整單備註:</strong> {order.remarks}
                        </div>
                      )}
                    </div>

                    {/* Order items breakdowns */}
                    <div className="space-y-3 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-xs bg-gray-50/40 p-2 rounded-lg">
                          <div className="flex justify-between font-bold text-gray-800">
                            <span>{item.menuItem.name} ({item.size})</span>
                            <span className="font-mono text-gray-500">x{item.quantity}</span>
                          </div>
                          <div className="text-gray-500 text-[10px] space-y-0.5 mt-1 list-none font-sans">
                            <li>甜度: {item.sugar} • 冰量: {item.ice}</li>
                            {item.toppings.length > 0 && (
                              <li className="text-amber-800 font-medium">Toppings: {item.toppings.map(t => `${t.name}(+$${t.price})`).join(', ')}</li>
                            )}
                            {item.remarks && (
                              <li className="text-gray-400 italic">備註: "{item.remarks}"</li>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Operational Transition Actions */}
                    <div className="flex gap-2 justify-end border-t border-gray-100 pt-4">
                      {order.status === 'pending' && (
                        <>
                          <button
                            id={`order-reject-btn-${order.id}`}
                            onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>取消訂單</span>
                          </button>
                          <button
                            id={`order-accept-btn-${order.id}`}
                            onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>接單製作</span>
                          </button>
                        </>
                      )}

                      {order.status === 'preparing' && (
                        <>
                          <button
                            id={`order-cancel-active-btn-${order.id}`}
                            onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                            className="bg-gray-105 hover:bg-gray-150 text-gray-500 text-xs font-bold py-2 px-3 rounded-xl transition-all"
                          >
                            取消
                          </button>
                          <button
                            id={`order-complete-btn-${order.id}`}
                            onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-teal-600/10"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>完成配製</span>
                          </button>
                        </>
                      )}

                      {order.status === 'completed' && (
                        <div className="text-[10px] text-teal-600 font-bold bg-teal-50 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-teal-200">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          作業完成
                        </div>
                      )}

                      {order.status === 'cancelled' && (
                        <div className="text-[10px] text-gray-400 font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                          已取消該點單
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div id="admin-products-tab-view" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 py-2">
            <h3 className="text-sm font-bold text-gray-800">菜單品項管理 (直接控制 Firestore)</h3>
            <button
              id="admin-add-product-btn"
              onClick={handleOpenAddProduct}
              className="bg-teal-700 hover:bg-teal-850 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>註冊新品項</span>
            </button>
          </div>

          <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-xs text-gray-550 font-bold">
                  <th className="p-4">品項中文 / 類別</th>
                  <th className="p-4">中杯 M</th>
                  <th className="p-4">大杯 L</th>
                  <th className="p-4">狀態</th>
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-650">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      目前資料庫無任何茶飲品項，請點選右上角註冊
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} id={`admin-product-row-${p.id}`} className="hover:bg-gray-50/50">
                      <td className="p-4">
                        <div className="font-bold text-gray-800 font-sans">{p.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{p.englishName}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded-sm">
                            {p.category}
                          </span>
                          {p.isRecommended && (
                            <span className="bg-red-50 text-red-650 text-[9px] px-1.5 py-0.5 rounded-sm">
                              推薦
                            </span>
                          )}
                          {p.isNoCaffeine && (
                            <span className="bg-emerald-50 text-emerald-650 text-[9px] px-1.5 py-0.5 rounded-sm">
                              無咖啡因
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        {p.priceM !== null ? formatCurrency(p.priceM) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="p-4 font-mono font-bold">{formatCurrency(p.priceL)}</td>
                      <td className="p-4">
                        <button
                          id={`sale-toggle-${p.id}`}
                          onClick={() => handleToggleProductSale(p)}
                          className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-colors ${
                            p.onSale
                              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {p.onSale ? '上架中(售賣)' : '已下架(停售)'}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            id={`edit-product-btn-${p.id}`}
                            onClick={() => handleOpenEditProduct(p)}
                            className="p-1.5 text-gray-400 hover:text-teal-650 hover:bg-gray-100 rounded-md transition-colors"
                            title="編輯"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-product-btn-${p.id}`}
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <DashboardAnalytics orders={orders} products={products} />
      )}

      {/* product CRUD MODAL DIALOG */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div id="product-crud-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="product-crud-modal-content"
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-teal-800 text-white">
                <h3 className="text-sm font-bold font-sans">
                  {editingProduct ? `編輯品項：${editingProduct.name}` : '註冊全新茶飲品項'}
                </h3>
                <button
                  id="close-crud-modal"
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form id="product-crud-form" onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {productFormError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 font-medium">
                    {productFormError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 font-bold mb-1">中文品項名稱 *</label>
                    <input
                      id="form-prod-name"
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="如：香橘冬香"
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 font-bold mb-1">英文名稱</label>
                    <input
                      id="form-prod-english"
                      type="text"
                      value={prodEnglish}
                      onChange={(e) => setProdEnglish(e.target.value)}
                      placeholder="如：Orange Winter Tea"
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 font-bold mb-1">分類類別 *</label>
                    <select
                      id="form-prod-category"
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="台灣原茶">台灣原茶</option>
                      <option value="朵朵與莎莎">朵朵與莎莎</option>
                      <option value="柚香橙韻">柚香橙韻</option>
                      <option value="水果調飲">水果調飲</option>
                      <option value="香醇鮮乳">香醇鮮乳</option>
                      <option value="醇奶特調">醇奶特調</option>
                      <option value="原茶調飲">原茶調飲</option>
                      <option value="不失眠">不失眠</option>
                      <option value="抱抱冬瓜">抱抱冬瓜</option>
                      <option value="OTHER">== 自訂分類 ==</option>
                    </select>
                  </div>

                  {prodCategory === 'OTHER' && (
                    <div>
                      <label className="block text-gray-500 font-bold mb-1">請自訂類別名稱 *</label>
                      <input
                        id="form-prod-custom-category"
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="例如：特盛起司"
                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 font-bold mb-1">大杯 L 價格 (TWD) *</label>
                    <input
                      id="form-prod-price-l"
                      type="number"
                      value={prodPriceL}
                      onChange={(e) => setProdPriceL(e.target.value)}
                      placeholder="如：55"
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 font-bold mb-1">中杯 M 價格 (留空表示不提供)</label>
                    <input
                      id="form-prod-price-m"
                      type="number"
                      value={prodPriceM}
                      onChange={(e) => setProdPriceM(e.target.value)}
                      placeholder="如：40 (選填)"
                      className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Attributes toggles */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">品項屬性標籤</span>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">店長推薦 (展示「推薦」紅標)</span>
                    <input
                      id="form-prod-is-recommended"
                      type="checkbox"
                      checked={prodIsRecommended}
                      onChange={(e) => setProdIsRecommended(e.target.checked)}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">可做熱飲 (可供調配「溫熱」)</span>
                    <input
                      id="form-prod-is-hot"
                      type="checkbox"
                      checked={prodIsHotPossible}
                      onChange={(e) => setProdIsHotPossible(e.target.checked)}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">不含咖啡因 (適合失眠人飲用)</span>
                    <input
                      id="form-prod-is-decaf"
                      type="checkbox"
                      checked={prodIsNoCaffeine}
                      onChange={(e) => setProdIsNoCaffeine(e.target.checked)}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">簡單產品特色說明</label>
                  <textarea
                    id="form-prod-description"
                    value={prodDescription}
                    onChange={(e) => setProdDescription(e.target.value)}
                    placeholder="例如：花香 奶油香 堅果，茶感清新舒爽..."
                    maxLength={150}
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 h-16 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">設定特色標籤(逗號分隔)</label>
                  <input
                    id="form-prod-tags"
                    type="text"
                    value={prodTagsString}
                    onChange={(e) => setProdTagsString(e.target.value)}
                    placeholder="如：特等選、手揉工、招牌必喝"
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">多個標籤請用半形英文逗號 [ , ] 隔開</span>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end">
                  <button
                    id="form-cancel-btn"
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="bg-gray-100 text-gray-500 font-bold py-2 px-4 rounded-xl hover:bg-gray-150 transition-colors"
                  >
                    取消關閉
                  </button>
                  <button
                    id="form-submit-btn"
                    type="submit"
                    className="bg-teal-700 text-white font-bold py-2 px-5 rounded-xl hover:bg-teal-800 transition-colors"
                  >
                    確認儲存
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
