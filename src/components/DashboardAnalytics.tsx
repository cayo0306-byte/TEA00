import React from 'react';
import { Order, MenuItem } from '../types';
import { formatCurrency } from '../utils';
import { TrendingUp, Award, DollarSign, ShoppingCart, Percent } from 'lucide-react';

interface DashboardAnalyticsProps {
  orders: Order[];
  products: MenuItem[];
}

export default function DashboardAnalytics({ orders, products }: DashboardAnalyticsProps) {
  // Filter for valid completed orders
  const completedOrders = orders.filter(o => o.status === 'completed');
  const activeOrders = orders.filter(o => o.status === 'preparing' || o.status === 'pending');
  const allNonCancelledOrders = orders.filter(o => o.status !== 'cancelled');

  // 1. Calculations: Financials
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const potentialRevenue = allNonCancelledOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const averageOrderValue = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

  // 2. Beverage sales aggregations (top drinks)
  const productSalesMap: { [productName: string]: { qty: number; revenue: number } } = {};
  const categorySalesMap: { [category: string]: number } = {};

  orders.forEach(order => {
    if (order.status === 'cancelled') return;
    order.items.forEach(item => {
      const name = item.menuItem.name;
      const cat = item.menuItem.category || '未分類';
      const qty = item.quantity;
      const price = item.totalPrice;

      // Product grouping
      if (!productSalesMap[name]) {
        productSalesMap[name] = { qty: 0, revenue: 0 };
      }
      productSalesMap[name].qty += qty;
      productSalesMap[name].revenue += price;

      // Category grouping
      if (!categorySalesMap[cat]) {
        categorySalesMap[cat] = 0;
      }
      categorySalesMap[cat] += price;
    });
  });

  const topProductsSorted = Object.entries(productSalesMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5); // top 5

  const categoryShares = Object.entries(categorySalesMap)
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Maximum quantity for scale sizing in bar chart
  const maxQty = topProductsSorted.length > 0 ? Math.max(...topProductsSorted.map(p => p.qty), 1) : 10;

  return (
    <div id="analytics-panel" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">已收營業額</span>
            <span className="text-xl font-bold font-mono text-teal-850 mt-1 block">{formatCurrency(totalRevenue)}</span>
            <span className="text-[9px] text-gray-400 font-mono">潛在可能總計: {formatCurrency(potentialRevenue)}</span>
          </div>
          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">完成單量</span>
            <span className="text-xl font-bold font-mono text-gray-800 mt-1 block">{completedOrders.length} 筆</span>
            <span className="text-[9px] text-teal-600 font-medium">進行中訂單: {activeOrders.length} 筆</span>
          </div>
          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">客單均價</span>
            <span className="text-xl font-bold font-mono text-gray-800 mt-1 block">{formatCurrency(averageOrderValue)}</span>
            <span className="text-[9px] text-gray-400 font-mono">每張訂單配比</span>
          </div>
          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">在售生品</span>
            <span className="text-xl font-bold font-mono text-gray-800 mt-1 block">{products.filter(p => p.onSale).length} 款</span>
            <span className="text-[9px] text-gray-400 font-mono">總註冊品項: {products.length}款</span>
          </div>
          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs lg:col-span-2">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            排行榜：熱銷品項統計
          </h3>

          {topProductsSorted.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center text-gray-400">
              <span className="text-xs">尚無任何銷售數據</span>
            </div>
          ) : (
            <div className="space-y-4">
              {topProductsSorted.map((product, index) => {
                const percentage = (product.qty / maxQty) * 100;
                return (
                  <div key={product.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-gray-150 text-gray-650' :
                          index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-bold text-gray-800">{product.name}</span>
                      </div>
                      <span className="font-mono text-gray-600">
                        {product.qty} 杯 / {formatCurrency(product.revenue)}
                      </span>
                    </div>
                    {/* SVG Graphic Bar */}
                    <div className="w-full bg-gray-50 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Share Stats */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1">
            <Percent className="w-4 h-4 text-teal-600" />
            營收配比：類別銷售比重
          </h3>

          {categoryShares.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center text-gray-400">
              <span className="text-xs">尚無銷售統計</span>
            </div>
          ) : (
            <div className="space-y-4">
              {categoryShares.map((share) => {
                const totalRevLocal = categoryShares.reduce((s, x) => s + x.revenue, 0) || 1;
                const ratio = Math.round((share.revenue / totalRevLocal) * 100);
                return (
                  <div key={share.category} className="flex items-center justify-between border-b border-gray-50 pb-2">
                    <div>
                      <span className="text-xs font-bold text-gray-800">{share.category}</span>
                      <span className="text-[10px] text-gray-400 ml-2 font-mono">{formatCurrency(share.revenue)}</span>
                    </div>
                    <span className="text-xs font-extrabold text-teal-700 font-mono bg-teal-50 px-2 py-0.5 rounded-sm">
                      {ratio}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
