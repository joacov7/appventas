import { loadConfig } from "@/lib/ai/config";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";

// ─── Voz en WhatsApp ──────────────────────────────────────────────────────────
// Si el cliente manda una nota de voz, la transcribimos (voz→texto), el bot
// arma la respuesta, y la devolvemos como audio (texto→voz). Usa OpenAI.
//
// Costo aprox: transcripción ~US$0.006/min · TTS ~US$0.006 por respuesta.

const GRAPH = "https://graph.facebook.com/v19.0";

// Clave de OpenAI: la del proveedor configurado o la de entorno.
async function openaiKey(): Promise<string | null> {
  try {
    const cfg = await loadConfig();
    const k = cfg?.proveedores?.openai?.apiKey;
    if (k) return k;
  } catch { /* usa env */ }
  return process.env.OPENAI_API_KEY ?? null;
}

// Descarga el binario de un audio de WhatsApp a partir de su media id.
async function descargarMediaWhatsapp(mediaId: string, token: string): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    if (!meta?.url) return null;
    const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) return null;
    const buffer = Buffer.from(await bin.arrayBuffer());
    return { buffer, mime: meta.mime_type ?? "audio/ogg" };
  } catch { return null; }
}

// Voz → texto con Whisper.
async function transcribir(buffer: Buffer, mime: string): Promise<string | null> {
  const key = await openaiKey();
  if (!key) return null;
  try {
    const form = new FormData();
    const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("mpeg") ? "mp3" : "ogg";
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "es");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.text ?? "").trim() || null;
  } catch { return null; }
}

// Texto → voz (OpenAI TTS). Devuelve audio OGG/Opus (formato de nota de voz).
async function sintetizar(texto: string): Promise<Buffer | null> {
  const key = await openaiKey();
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        voice: "alloy",
        input: texto.slice(0, 3000),   // acota para no gastar de más
        response_format: "opus",
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// Sube un audio a los servidores de WhatsApp y devuelve su media id.
async function subirAudioWhatsapp(buffer: Buffer, phoneNumberId: string, token: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: "audio/ogg" }), "respuesta.ogg");
    form.append("type", "audio/ogg");
    const res = await fetch(`${GRAPH}/${phoneNumberId}/media`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ?? null;
  } catch { return null; }
}

// Envía una nota de voz (audio ya subido) a un contacto.
async function enviarAudio(to: string, mediaId: string, phoneNumberId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "audio", audio: { id: mediaId } }),
    });
    return res.ok;
  } catch { return false; }
}

export interface ResultadoVoz { ok: boolean; transcripcion?: string; respuesta?: string; motivo?: string }

// Orquesta todo el flujo de voz. `responder` calcula la respuesta del bot
// a partir de la transcripción (se inyecta para no acoplar módulos).
export async function procesarAudioEntrante(
  waId: string, mediaId: string,
  responder: (waId: string, texto: string) => Promise<string>
): Promise<ResultadoVoz> {
  const { accessToken, phoneNumberId } = await loadWhatsAppConfig();
  if (!accessToken || !phoneNumberId) return { ok: false, motivo: "WhatsApp no configurado" };

  const media = await descargarMediaWhatsapp(mediaId, accessToken);
  if (!media) return { ok: false, motivo: "No se pudo descargar el audio" };

  const texto = await transcribir(media.buffer, media.mime);
  if (!texto) return { ok: false, motivo: "No se pudo transcribir (¿falta OpenAI?)" };

  const respuesta = await responder(waId, texto);

  const audio = await sintetizar(respuesta);
  if (!audio) return { ok: false, transcripcion: texto, respuesta, motivo: "No se pudo generar la voz" };

  const nuevoId = await subirAudioWhatsapp(audio, phoneNumberId, accessToken);
  if (!nuevoId) return { ok: false, transcripcion: texto, respuesta, motivo: "No se pudo subir el audio" };

  const enviado = await enviarAudio(waId, nuevoId, phoneNumberId, accessToken);
  return { ok: enviado, transcripcion: texto, respuesta, motivo: enviado ? undefined : "No se pudo enviar" };
}
