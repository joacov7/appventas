export interface ProductVariantPublic {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  imageUrl: string | null;
}

export interface ProductPublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrls: string[];
  featured: boolean;
  category: { id: string; name: string; slug: string } | null;
  variants: ProductVariantPublic[];
}
