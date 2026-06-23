import MercadoPagoConfig, { Payment, Preference } from "mercadopago";

function getMpClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN no está configurado en las variables de entorno");
  }
  return new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
}

export function getMpPreference() {
  return new Preference(getMpClient());
}

export function getMpPayment() {
  return new Payment(getMpClient());
}
