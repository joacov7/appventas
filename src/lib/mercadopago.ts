import MercadoPagoConfig, { Payment, Preference } from "mercadopago";

if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN no está configurado en las variables de entorno");
}

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

export const mpPreference = new Preference(mpClient);
export const mpPayment = new Payment(mpClient);
