export interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface CreateOrderPayload {
  items: { variantId: string; quantity: number; unitPrice: number }[];
  shippingAddress: ShippingAddress;
  guestEmail?: string;
  notes?: string;
}
