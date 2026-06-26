import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada");
  return new Resend(key);
}

interface OrderItem {
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  shippingAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  shippingOptionName?: string;
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

function orderItemsHtml(items: OrderItem[]) {
  return items.map((i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
        <strong>${i.productName}</strong><br/>
        <span style="color:#6b7280;font-size:13px;">${i.variantName}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatPrice(i.unitPrice)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${formatPrice(i.subtotal)}</td>
    </tr>
  `).join("");
}

export async function sendOrderConfirmationToCustomer(data: OrderEmailData) {
  const from = "AppVentas <onboarding@resend.dev>";

  await getResend().emails.send({
    from,
    to: data.customerEmail,
    subject: `✅ Confirmación de tu pedido #${data.orderId.slice(-8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#059669;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">¡Gracias por tu compra!</h1>
          <p style="color:#d1fae5;margin:8px 0 0;">Pedido #${data.orderId.slice(-8).toUpperCase()}</p>
        </div>

        <div style="padding:32px;">
          <p style="color:#374151;">Hola <strong>${data.customerName}</strong>, recibimos tu pedido y está siendo procesado.</p>

          <h2 style="color:#111827;font-size:16px;margin-top:24px;">Detalle del pedido</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;color:#6b7280;">Producto</th>
                <th style="padding:8px 12px;text-align:center;color:#6b7280;">Cant.</th>
                <th style="padding:8px 12px;text-align:right;color:#6b7280;">Precio</th>
                <th style="padding:8px 12px;text-align:right;color:#6b7280;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${orderItemsHtml(data.items)}</tbody>
          </table>

          <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#6b7280;">Subtotal</span>
              <span>${formatPrice(data.subtotal)}</span>
            </div>
            ${data.discount > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#059669;">Descuento</span>
              <span style="color:#059669;">− ${formatPrice(data.discount)}</span>
            </div>` : ""}
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#6b7280;">Envío${data.shippingOptionName ? ` (${data.shippingOptionName})` : ""}</span>
              <span>${data.shippingCost === 0 ? "Gratis" : formatPrice(data.shippingCost)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #e5e7eb;font-weight:700;font-size:16px;">
              <span>Total</span>
              <span style="color:#059669;">${formatPrice(data.total)}</span>
            </div>
          </div>

          <h2 style="color:#111827;font-size:16px;margin-top:24px;">Dirección de envío</h2>
          <p style="color:#374151;margin:0;">
            ${data.shippingAddress.street}<br/>
            ${data.shippingAddress.city}, ${data.shippingAddress.province} (${data.shippingAddress.postalCode})
          </p>

          <p style="margin-top:32px;color:#6b7280;font-size:13px;">
            Ante cualquier consulta respondé este email o contactanos.
          </p>
        </div>

        <div style="background:#f9fafb;padding:16px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">AppVentas</p>
        </div>
      </div>
    `,
  });
}

export async function sendNewOrderNotificationToAdmin(data: OrderEmailData) {
  const adminEmail = process.env.ADMIN_EMAIL_TO;
  if (!adminEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  await getResend().emails.send({
    from: "AppVentas <onboarding@resend.dev>",
    to: adminEmail,
    subject: `🛒 Nueva venta — ${formatPrice(data.total)} — ${data.customerName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#111827;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Nueva venta recibida</h1>
        </div>
        <div style="padding:24px;">
          <p><strong>Cliente:</strong> ${data.customerName} (${data.customerEmail})</p>
          <p><strong>Pedido:</strong> #${data.orderId.slice(-8).toUpperCase()}</p>
          <p><strong>Total:</strong> <span style="color:#059669;font-weight:700;font-size:18px;">${formatPrice(data.total)}</span></p>
          <p><strong>Envío:</strong> ${data.shippingOptionName ?? "—"} — ${data.shippingAddress.street}, ${data.shippingAddress.city}, ${data.shippingAddress.province}</p>

          <h3 style="margin-top:20px;">Productos</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px;text-align:left;">Producto</th>
                <th style="padding:8px;text-align:center;">Cant.</th>
                <th style="padding:8px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${orderItemsHtml(data.items)}</tbody>
          </table>

          ${appUrl ? `<p style="margin-top:24px;"><a href="${appUrl}/admin/ordenes" style="background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Ver en el admin</a></p>` : ""}
        </div>
      </div>
    `,
  });
}
