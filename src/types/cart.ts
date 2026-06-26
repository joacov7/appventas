export interface CartDiseno {
  preview: string; // base64 PNG thumbnail
  datos: object;   // Fabric.js canvas JSON
  virolaId: number;
  virolaSlug: string;
  virolaName: string;
}

export interface CartItem {
  cartKey: string;   // unique key: variantId for regular, variantId+timestamp for designs
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  stock: number;
  slug: string;
  diseno?: CartDiseno;
}

export interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity" | "cartKey"> & { quantity?: number; cartKey?: string }) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}
