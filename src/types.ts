export interface MenuItem {
  id: string;
  name: string;
  englishName: string;
  category: string;
  priceM: number | null; // null means Medium is not available
  priceL: number;
  isRecommended: boolean;
  isHotPossible: boolean;
  isNoCaffeine: boolean;
  description: string;
  tags: string[];
  onSale: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Topping {
  name: string;
  price: number;
}

export interface CartItem {
  cartId: string; // unique identifier for specific customization combination
  menuItem: MenuItem;
  size: 'M' | 'L';
  sugar: string;
  ice: string;
  toppings: Topping[];
  quantity: number;
  remarks: string;
  pricePerUnit: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  totalPrice: number;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  remarks?: string;
  createdAt: any; // Can be string or Firebase Timestamp
  updatedAt?: any;
}

export interface SystemConfig {
  id: 'admin';
  passwordHash: string;
  isConfigured: boolean;
  createdAt?: any;
  updatedAt?: any;
}
