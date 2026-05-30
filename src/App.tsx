import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { MenuItem, CartItem, Order } from './types';
import { initialMenuData } from './initialMenuData';
import CustomizeDialog from './components/CustomizeDialog';
import CartSidebar from './components/CartSidebar';
import OrderQuery from './components/OrderQuery';
import AdminPanel from './components/AdminPanel';
import { formatCurrency } from './utils';
import {
  ShoppingBag,
  Sparkles,
  Phone,
  Clock,
  Compass,
  ArrowRight,
  ChevronRight,
  LayoutDashboard,
  CheckCircle,
  HelpCircle,
  Store,
  Wine
} from 'lucide-react';

export default function App() {
  // Navigation Section State
  const [activePortal, setActivePortal] = useState<'customer' | 'admin'>('customer');

  // Customer Catalog State
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [activeCategory, setActiveCategory] = useState('台灣原茶');
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Placed Order Tracking Receipt
  const [recentlyPlacedOrder, setRecentlyPlacedOrder] = useState<Order | null>(null);

  // Categories aligned with UNOCHA (烏弄) menu image layout.
  const categories = [
    '台灣原茶',
    '朵朵與莎莎',
    '柚香橙韻',
    '水果調飲',
    '香醇鮮乳',
    '醇奶特調',
    '原茶調飲',
    '不失眠',
    '抱抱冬瓜'
  ];

  // 1. Fetch products from Firestore upon startup, runs seeding if empty
  const fetchMenuAndSeedIfBlank = async () => {
    setIsLoadingMenu(true);
    try {
      const menuRef = collection(db, 'menu_items');
      const querySnapshot = await getDocs(menuRef);
      const list: MenuItem[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({
          ...(docSnap.data() as Omit<MenuItem, 'id'>),
          id: docSnap.id
        });
      });

      if (list.length === 0) {
        console.log('Firestore menu collection is empty. Bootstrapping with seed products...');
        // Write each seed product to Firestore
        for (const seed of initialMenuData) {
          const productDocRef = doc(db, 'menu_items', seed.id);
          await setDoc(productDocRef, {
            ...seed,
            createdAt: new Date().toISOString()
          });
        }
        // Retry fetch
        const retrySnapshot = await getDocs(menuRef);
        const retryList: MenuItem[] = [];
        retrySnapshot.forEach((snap) => {
          retryList.push({
            ...(snap.data() as Omit<MenuItem, 'id'>),
            id: snap.id
          });
        });
        setProducts(retryList);
      } else {
        setProducts(list);
      }
    } catch (err) {
      console.error('Failed fetching menu catalog from remote db:', err);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  useEffect(() => {
    fetchMenuAndSeedIfBlank();
  }, []);

  // 2. Shopping Cart Operations
  const handleAddToCart = (newItem: CartItem) => {
    // Check if item with identical customizations is already added
    const matchIndex = cart.findIndex((item) => item.cartId === newItem.cartId);
    if (matchIndex > -1) {
      const updatedCart = [...cart];
      const matchItem = updatedCart[matchIndex];
      matchItem.quantity += newItem.quantity;
      matchItem.totalPrice = matchItem.quantity * matchItem.pricePerUnit;
      setCart(updatedCart);
    } else {
      setCart([...cart, newItem]);
    }
    // Automatically open feedback/cart
    setIsCartOpen(true);
  };

  const handleUpdateCartQty = (cartId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(cartId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.cartId === cartId
          ? { ...item, quantity: newQty, totalPrice: newQty * item.pricePerUnit }
          : item
      )
    );
  };

  const handleRemoveCartItem = (cartId: string) => {
    setCart(cart.filter((item) => item.cartId !== cartId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderSubmissionSuccess = (placedOrder: Order) => {
    setRecentlyPlacedOrder(placedOrder);
  };

  // Filter products by category and active status
  const displayedProducts = products.filter(
    (p) => p.category === activeCategory && p.onSale
  );

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Banner Nav Header */}
      <header className="sticky top-0 z-45 bg-[#0F4C5C]/95 backdrop-blur-md text-white border-b border-[#146074]/30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-[#0F4C5C] font-black shadow-inner shadow-amber-300">
              <Wine className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 id="brand-title" className="text-base font-black tracking-tight font-sans">
                UNOCHA 烏弄原生茶鋪
              </h1>
              <span className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-400/20 px-1.5 py-0.2 rounded-sm uppercase tracking-widest font-bold">
                Taiwan Original Tea
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick checkout status */}
            {cart.length > 0 && activePortal === 'customer' && (
              <button
                id="header-floating-cart-btn"
                onClick={() => setIsCartOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-900 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-amber-500/10"
              >
                <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                <span className="font-mono">{cart.reduce((s, i) => s + i.quantity, 0)} 杯</span>
              </button>
            )}

            {/* Portal Switcher */}
            <button
              id="portal-switch-btn"
              onClick={() => {
                setActivePortal(activePortal === 'customer' ? 'admin' : 'customer');
                setRecentlyPlacedOrder(null);
              }}
              className={`text-xs font-black px-4 py-2 rounded-xl border border-white/10 transition-all flex items-center gap-1.5 ${
                activePortal === 'admin'
                  ? 'bg-amber-500 text-slate-900 border-amber-600'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{activePortal === 'customer' ? '管理後台' : '前台點單'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Core Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {/* CUSTOMER PORTAL */}
        {activePortal === 'customer' ? (
          <div className="space-y-10">
            {/* Promo hero board */}
            <section
              id="hero-teaser"
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F4C5C] to-[#1A3D45] text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_50%)] pointer-events-none" />
              <div className="space-y-4 max-w-xl">
                <div id="badge-promo" className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-400/20 px-3 py-1 rounded-full text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                  <span>自備環保杯折 5 元 • 線上＆門市買五送一</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-sans leading-tight">
                  堅持品質與本味，<br />
                  台灣在地特等獎茶師監製
                </h2>
                <p className="text-slate-200 text-xs leading-relaxed max-w-lg">
                  以純原茶、手焙工序著稱。我們採集阿里山高山金萱、名間冬片茶、台茶十八號紅玉，呈現純粹乾淨、回甘生津的茶湯風味。
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2 text-[10px] text-slate-300">
                  <span className="flex items-center gap-1">🟢 推薦飲品</span>
                  <span className="flex items-center gap-1">🔴 可做熱飲</span>
                  <span className="flex items-center gap-1">⚫ 無咖啡因</span>
                </div>
              </div>
              
              {/* Micro tracking indicator / shortcut scroll */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 w-full md:w-80 space-y-3 shadow-inner">
                <span className="text-[10px] font-bold text-amber-300 uppercase block tracking-wider">配製追蹤即時查</span>
                <p className="text-slate-200 text-xs">已經點完單？點選下方按鈕直接查詢店家接單、手配製作進度。</p>
                <button
                  id="scroll-to-query-btn"
                  onClick={() => {
                    document.getElementById('order-query-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full bg-white text-slate-900 hover:bg-slate-50 transition-colors py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                >
                  <span>前往查詢進度</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>

            {/* Catalog Division */}
            <section id="menu-catalog-division" className="space-y-6">
              {/* Smooth Category Tabs Rail */}
              <div className="sticky top-18 z-40 bg-slate-50/95 backdrop-blur-md py-4 border-b border-gray-200 flex items-center">
                <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pr-6 pb-1 flex-nowrap w-full">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      id={`cat-tab-${cat}`}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4.5 py-3 rounded-full text-xs font-extrabold whitespace-nowrap transition-all border ${
                        activeCategory === cat
                          ? 'bg-[#0F4C5C] text-white border-[#0F4C5C] shadow-lg shadow-[#0F4C5C]/15'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product grid content */}
              <AnimatePresence mode="wait">
                {isLoadingMenu ? (
                  <div className="min-h-80 flex flex-col items-center justify-center text-gray-400">
                    <span className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-650 rounded-full animate-spin mb-2" />
                    <p className="text-xs">茶單品項同步中...</p>
                  </div>
                ) : (
                  <motion.div
                    key={activeCategory}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    id="drinks-display-grid"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {displayedProducts.length === 0 ? (
                      <div className="col-span-full py-16 bg-white border border-gray-100 rounded-2xl text-center text-gray-400">
                        目前此類別無在售品項
                      </div>
                    ) : (
                      displayedProducts.map((drink) => (
                        <div
                          key={drink.id}
                          id={`drink-card-${drink.id}`}
                          className="group relative bg-white rounded-2xl border border-gray-200/60 p-5 flex flex-col justify-between hover:border-teal-500 hover:shadow-xl shadow-xs transition-all duration-300 overflow-hidden"
                        >
                          <div className="space-y-2.5">
                            {/* Tags and Badges */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {drink.isRecommended && (
                                <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  推薦
                                </span>
                              )}
                              {drink.isHotPossible && (
                                <span className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  可做熱飲
                                </span>
                              )}
                              {drink.isNoCaffeine && (
                                <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  無咖啡因
                                </span>
                              )}
                              {drink.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Name & Title */}
                            <div>
                              <h3 id={`drink-name-${drink.id}`} className="text-base sm:text-lg font-black text-gray-900 font-sans tracking-tight">
                                {drink.name}
                              </h3>
                              <p className="text-[10px] text-gray-400 font-mono leading-none mt-0.5">
                                {drink.englishName}
                              </p>
                            </div>

                            {/* Description block */}
                            {drink.description && (
                              <p className="text-xs text-gray-500 leading-relaxed font-sans line-clamp-2">
                                {drink.description}
                              </p>
                            )}
                          </div>

                          {/* Footer specs */}
                          <div className="flex items-end justify-between mt-5 pt-4 border-t border-gray-50">
                            <div className="flex items-baseline gap-2">
                              {drink.priceM !== null && (
                                <div className="text-xs">
                                  <span className="text-gray-400">M </span>
                                  <span className="font-bold text-gray-700 font-mono">
                                    {formatCurrency(drink.priceM)}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-xs text-gray-400">
                                  {drink.priceM !== null ? 'L ' : 'L '}
                                </span>
                                <span className="text-lg font-black text-teal-800 font-mono">
                                  {formatCurrency(drink.priceL)}
                                </span>
                              </div>
                            </div>

                            {/* Custom order trigger */}
                            <button
                              id={`trigger-custom-${drink.id}`}
                              onClick={() => setSelectedProduct(drink)}
                              className="bg-[#0F4C5C] hover:bg-teal-700 rounded-xl px-4 py-2 text-xs font-black text-white hover:shadow-md transition-all active:scale-95 flex items-center gap-1 border border-teal-800"
                            >
                              <span>選規格</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* PLACED ORDER CONFIRMATION BANNER BAR */}
            <AnimatePresence>
              {recentlyPlacedOrder && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  id="just-placed-order-banner"
                  className="p-6 bg-teal-50 border-2 border-teal-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-700">
                      <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-teal-950 font-sans">🎉 點單送出成功！</h3>
                      <p className="text-xs text-teal-700 mt-1">
                        您的訂單號碼為 <strong className="font-mono text-teal-950">{recentlyPlacedOrder.orderNumber}</strong>。
                        已存入 Firestore 資料庫。
                      </p>
                    </div>
                  </div>
                  <button
                    id="track-just-placed-btn"
                    onClick={() => {
                      document.getElementById('order-query-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-teal-700 text-white hover:bg-teal-800 text-xs font-extrabold py-2 px-4 rounded-xl transition-all shadow-xs"
                  >
                    即時進度追蹤
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* LIVE TRACKING MODULE */}
            <section id="order-query-section" className="py-8 border-t border-gray-200">
              <OrderQuery />
            </section>
          </div>
        ) : (
          /* ADMINISTRATIVE BACKEND PORTAL */
          <AdminPanel products={products} onRefreshProducts={fetchMenuAndSeedIfBlank} />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-gray-500 py-10 mt-12 border-t border-gray-800/20 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-teal-400" />
            <span className="font-bold text-gray-400 font-sans">烏弄 UNOCHA 飲茶點單系統</span>
            <span>•</span>
            <span>雲端數據庫實體安全管理</span>
          </div>
          <div className="text-[10px] text-gray-600 font-mono">
            Firestore Database ID: {db.app.options.projectId}
          </div>
        </div>
      </footer>

      {/* OVERLAY COMPONENT MOUNT POINT */}
      <CustomizeDialog
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        menuItem={selectedProduct}
        onAddToCart={handleAddToCart}
      />

      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderPlaced={handleOrderSubmissionSuccess}
      />
    </div>
  );
}
