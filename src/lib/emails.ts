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

// ── Carrito abandonado ────────────────────────────────────────────────────────

interface CartItem {
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

function cartItemsHtml(items: CartItem[]) {
  return items.map((i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">
        <strong style="color:#111827;">${i.productName}</strong>
        ${i.variantName ? `<br/><span style="color:#6b7280;font-size:13px;">${i.variantName}</span>` : ""}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151;">×${i.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#059669;">${formatPrice(i.price * i.quantity)}</td>
    </tr>
  `).join("");
}

export async function sendAbandonedCartEmail({
  email,
  items,
  total,
  etapa,
  couponCode,
}: {
  email: string;
  items: CartItem[];
  total: number;
  etapa: "2h" | "24h";
  couponCode?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";
  const cartUrl = `${appUrl}/checkout`;

  const es24h = etapa === "24h";
  const asunto = es24h
    ? `⏰ Última oportunidad — tu carrito te espera`
    : `🛒 Olvidaste algo en tu carrito`;

  const cuponHtml = es24h && couponCode ? `
    <div style="margin:24px 0;background:#fef3c7;border:2px dashed #f59e0b;border-radius:12px;padding:20px;text-align:center;">
      <p style="margin:0 0 8px;color:#92400e;font-size:14px;">¡Un regalo para que vuelvas!</p>
      <p style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:4px;color:#b45309;">${couponCode}</p>
      <p style="margin:0;color:#92400e;font-size:13px;">Usá este cupón en el checkout y llevate un descuento especial</p>
    </div>
  ` : "";

  await getResend().emails.send({
    from: "AppVentas <onboarding@resend.dev>",
    to: email,
    subject: asunto,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#059669;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">
            ${es24h ? "⏰ Tu carrito está por vencer" : "🛒 Dejaste algo en tu carrito"}
          </h1>
          <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">
            ${es24h ? "Es tu última oportunidad de completar tu compra" : "Todavía tenés tiempo de completar tu pedido"}
          </p>
        </div>

        <div style="padding:32px;">
          <p style="color:#374151;font-size:15px;margin:0 0 24px;">
            ${es24h
              ? "Notamos que no completaste tu compra. Los productos en tu carrito tienen stock limitado."
              : "¡Hola! Guardamos tu carrito por si lo necesitás. Podés completar tu compra en cualquier momento."}
          </p>

          ${cuponHtml}

          <h2 style="color:#111827;font-size:15px;margin:0 0 12px;">Tu carrito</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
            <tbody>${cartItemsHtml(items)}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:12px;text-align:right;font-weight:700;color:#111827;">Total:</td>
                <td style="padding:12px;text-align:right;font-weight:700;font-size:18px;color:#059669;">${formatPrice(total)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="text-align:center;margin:24px 0;">
            <a href="${cartUrl}" style="display:inline-block;background:#059669;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
              Completar mi compra →
            </a>
          </div>

          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;">
            Si no querés recibir más emails, ignorá este mensaje.<br/>
            <a href="${appUrl}" style="color:#9ca3af;">AppVentas</a>
          </p>
        </div>
      </div>
    `,
  });
}

// ── Newsletter: bienvenida ────────────────────────────────────────────────────

export async function sendWelcomeEmail({
  email,
  nombre,
  couponCode,
}: {
  email: string;
  nombre?: string | null;
  couponCode: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

  await getResend().emails.send({
    from: "AppVentas <onboarding@resend.dev>",
    to: email,
    subject: "🎁 ¡Bienvenido/a! Acá va tu cupón de descuento",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#059669;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">¡Gracias por suscribirte!</h1>
          <p style="color:#d1fae5;margin:8px 0 0;">Ya sos parte de nuestra comunidad</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#374151;font-size:15px;">
            Hola${nombre ? ` <strong>${nombre}</strong>` : ""}! Como regalo de bienvenida, te regalamos un cupón exclusivo de descuento.
          </p>
          <div style="margin:24px 0;background:#f0fdf4;border:2px dashed #059669;border-radius:12px;padding:24px;text-align:center;">
            <p style="margin:0 0 8px;color:#065f46;font-size:14px;">Tu cupón de bienvenida:</p>
            <p style="margin:0 0 4px;font-size:32px;font-weight:900;letter-spacing:4px;color:#059669;">${couponCode}</p>
            <p style="margin:0;color:#065f46;font-size:13px;">Ingresalo en el checkout para obtener tu descuento</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${appUrl}/productos" style="display:inline-block;background:#059669;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
              Ver productos →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;">
            Si no querés recibir más emails, ignorá este mensaje.<br/>
            <a href="${appUrl}" style="color:#9ca3af;">AppVentas</a>
          </p>
        </div>
      </div>
    `,
  });
}

// ── Reactivación 30 días ──────────────────────────────────────────────────────

export async function sendReactivationEmail({
  email,
  couponCode,
  daysSinceOrder,
}: {
  email: string;
  couponCode: string;
  daysSinceOrder: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

  await getResend().emails.send({
    from: "AppVentas <onboarding@resend.dev>",
    to: email,
    subject: "💛 ¡Te extrañamos! Un descuento especial para vos",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#111827;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">💛 ¡Hace ${daysSinceOrder}+ días que no te vemos!</h1>
          <p style="color:#9ca3af;margin:8px 0 0;font-size:14px;">Te tenemos un regalo para que vuelvas</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#374151;font-size:15px;">
            Hola! Notamos que hace un tiempo que no visitás nuestra tienda. Queremos que vuelvas con un descuento especial para tu próxima compra.
          </p>
          <div style="margin:24px 0;background:#fef3c7;border:2px dashed #f59e0b;border-radius:12px;padding:24px;text-align:center;">
            <p style="margin:0 0 8px;color:#92400e;font-size:14px;">Tu cupón exclusivo:</p>
            <p style="margin:0 0 4px;font-size:32px;font-weight:900;letter-spacing:4px;color:#b45309;">${couponCode}</p>
            <p style="margin:0;color:#92400e;font-size:13px;">Descuento especial por tiempo limitado</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${appUrl}/productos" style="display:inline-block;background:#059669;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
              Ver novedades →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;">
            Si no querés recibir más emails, ignorá este mensaje.<br/>
            <a href="${appUrl}" style="color:#9ca3af;">AppVentas</a>
          </p>
        </div>
      </div>
    `,
  });
}

// ── Referidos: notificación al referidor ─────────────────────────────────────

export async function sendReferralNotification({
  referrerEmail,
  codigo,
}: {
  referrerEmail: string;
  codigo: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

  await getResend().emails.send({
    from: "AppVentas <onboarding@resend.dev>",
    to: referrerEmail,
    subject: "🎉 ¡Alguien usó tu link de referido!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#059669;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🎉 ¡Tu link funcionó!</h1>
          <p style="color:#d1fae5;margin:8px 0 0;">Alguien compró usando tu código de referido</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#374151;font-size:15px;">
            ¡Excelente! Alguien usó tu código <strong style="color:#059669;letter-spacing:2px;">${codigo}</strong> y realizó una compra.
          </p>
          <p style="color:#374151;font-size:15px;margin-top:16px;">
            Seguí compartiendo tu link para acumular más referidos y desbloquear beneficios exclusivos.
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${appUrl}" style="display:inline-block;background:#059669;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
              Ver mi tienda →
            </a>
          </div>
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
