import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, PlusCircle, Check } from 'lucide-react';
import { MenuItem, CartItem, Topping } from '../types';
import { TOPPINGS } from '../initialMenuData';
import { formatCurrency } from '../utils';

interface CustomizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  onAddToCart: (item: CartItem) => void;
}

export default function CustomizeDialog({ isOpen, onClose, menuItem, onAddToCart }: CustomizeDialogProps) {
  if (!menuItem) return null;

  const [size, setSize] = useState<'M' | 'L'>('L');
  const [sugar, setSugar] = useState<string>('半糖 (50%)');
  const [ice, setIce] = useState<string>('正常冰');
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [remarks, setRemarks] = useState<string>('');

  // Reset states when dialog opens with a new item
  useEffect(() => {
    if (menuItem) {
      setSize(menuItem.priceM !== null ? 'L' : 'L');
      // If the item has a "sweetness fixed" tag e.g. 甜度固定, set default
      const isSugarFixed = menuItem.tags.includes('甜度固定') || menuItem.description.includes('甜度固定');
      setSugar(isSugarFixed ? '甜度固定' : '半糖 (50%)');
      
      const isIceFixed = menuItem.description.includes('冰沙');
      setIce(isIceFixed ? '冰沙固定' : '正常冰');
      
      setSelectedToppings([]);
      setQuantity(1);
      setRemarks('');
    }
  }, [menuItem]);

  const sugarOptions = menuItem.tags.includes('甜度固定') || menuItem.description.includes('甜度固定')
    ? ['甜度固定']
    : ['全糖 (100%)', '少糖 (70%)', '半糖 (50%)', '微糖 (30%)', '無糖 (0%)'];

  const iceOptions = menuItem.description.includes('冰沙')
    ? ['冰沙固定']
    : menuItem.isHotPossible
      ? ['多冰', '正常冰', '少冰', '微冰', '去冰', '熱飲 (溫熱)']
      : ['多冰', '正常冰', '少冰', '微冰', '去冰'];

  const handleToppingToggle = (topping: Topping) => {
    if (selectedToppings.some(t => t.name === topping.name)) {
      setSelectedToppings(selectedToppings.filter(t => t.name !== topping.name));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  const basePrice = size === 'M' && menuItem.priceM !== null ? menuItem.priceM : menuItem.priceL;
  const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const pricePerUnit = basePrice + toppingsPrice;
  const totalPrice = pricePerUnit * quantity;

  const handleAddToCart = () => {
    const cartId = `${menuItem.id}-${size}-${sugar}-${ice}-${selectedToppings.map(t => t.name).join('_')}-${remarks || 'none'}`;
    const cartItem: CartItem = {
      cartId,
      menuItem,
      size,
      sugar,
      ice,
      toppings: selectedToppings,
      quantity,
      remarks,
      pricePerUnit,
      totalPrice,
    };
    onAddToCart(cartItem);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="customize-dialog-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            id="customize-dialog-content"
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="dialog-drink-name" className="text-xl font-bold font-sans text-gray-900">{menuItem.name}</h3>
                  {menuItem.isRecommended && (
                    <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">推薦</span>
                  )}
                  {menuItem.isNoCaffeine && (
                    <span className="bg-emerald-50 text-emerald-600 text-xs px-2 py-0.5 rounded-full font-medium">無咖啡因</span>
                  )}
                </div>
                <div className="text-gray-400 text-xs font-mono mt-0.5">{menuItem.englishName}</div>
                {menuItem.description && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg border-l-2 border-teal-500">{menuItem.description}</p>
                )}
              </div>
              <button
                id="close-dialog-btn"
                onClick={onClose}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Size Customization */}
              {menuItem.priceM !== null && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-teal-500 rounded-full"></span> 選擇規格
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="size-m-btn"
                      type="button"
                      onClick={() => setSize('M')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        size === 'M'
                          ? 'border-teal-500 bg-teal-50/40 text-teal-700'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-sm font-bold">Medium (中杯)</span>
                      <span className="text-xs font-mono mt-1">{formatCurrency(menuItem.priceM)}</span>
                    </button>
                    <button
                      id="size-l-btn"
                      type="button"
                      onClick={() => setSize('L')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        size === 'L'
                          ? 'border-teal-500 bg-teal-50/40 text-teal-700'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-sm font-bold">Large (大杯)</span>
                      <span className="text-xs font-mono mt-1">{formatCurrency(menuItem.priceL)}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sugar Customization */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-3 bg-teal-500 rounded-full"></span> 甜度表
                </h4>
                <div className="flex flex-wrap gap-2">
                  {sugarOptions.map((opt) => (
                    <button
                      key={opt}
                      id={`sugar-opt-${opt}`}
                      type="button"
                      onClick={() => setSugar(opt)}
                      className={`px-3 py-2 text-xs rounded-lg border font-medium transition-all ${
                        sugar === opt
                          ? 'bg-teal-500 border-teal-500 text-white shadow-xs'
                          : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ice Customization */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-3 bg-teal-500 rounded-full"></span> 冰塊表
                </h4>
                <div className="flex flex-wrap gap-2">
                  {iceOptions.map((opt) => (
                    <button
                      key={opt}
                      id={`ice-opt-${opt}`}
                      type="button"
                      onClick={() => setIce(opt)}
                      className={`px-3 py-2 text-xs rounded-lg border font-medium transition-all ${
                        ice === opt
                          ? 'bg-teal-500 border-teal-500 text-white shadow-xs'
                          : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toppings Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-1 h-3 bg-teal-500 rounded-full"></span> 加點配料 (多選)
                  </span>
                  <span className="text-xs text-gray-400 font-normal">可多選配料</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {TOPPINGS.map((topping) => {
                    const isSelected = selectedToppings.some(t => t.name === topping.name);
                    return (
                      <button
                        key={topping.name}
                        id={`topping-opt-${topping.name}`}
                        type="button"
                        onClick={() => handleToppingToggle(topping)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/30 text-teal-800'
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-medium">{topping.name}</span>
                        </div>
                        <span className="text-xs font-mono text-gray-500">+{formatCurrency(topping.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Remarks/Memo */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-1 h-3 bg-teal-500 rounded-full"></span> 客製化備註
                </h4>
                <textarea
                  id="remarks-textarea"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="如：不加茶凍、想要袋子、其他特殊需求..."
                  maxLength={100}
                  className="w-full text-xs p-3 border border-gray-100 bg-gray-50/50 rounded-xl focus:outline-none focus:border-teal-400 focus:bg-white transition-all resize-none h-18"
                />
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              {/* Quantity Selector */}
              <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-xs">
                <button
                  id="qty-decrease-btn"
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span id="qty-display" className="w-10 text-center text-sm font-bold font-sans text-gray-800">{quantity}</span>
                <button
                  id="qty-increase-btn"
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add Button */}
              <button
                id="add-to-cart-submit-btn"
                type="button"
                onClick={handleAddToCart}
                className="flex-1 ml-4 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-between shadow-md shadow-teal-600/10 active:scale-98 transition-all"
              >
                <span className="text-sm">加到我的購物車</span>
                <span className="text-base font-mono">{formatCurrency(totalPrice)}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
