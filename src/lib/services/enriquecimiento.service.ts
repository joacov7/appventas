import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Enriquecimiento: sacar el email (y redes) de la web del prospecto ────────
// Visita el sitio del comercio, busca emails y links a Instagram/Facebook en el
// HTML (home + página de contacto si existe) y completa los huecos de la ficha.
// Gratis: no usa APIs pagas. Marca enriquecido_en para no re-visitar sitios.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Basura típica que matchea el regex pero no es un mail de contacto.
const EMAIL_BASURA = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|godaddy|schema\.org|@2x|no-?reply|noreply/i;

const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,30})/i;
const FB_RE = /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.\-_]{2,60})/i;
const FB_BASURA = /^(sharer|share|plugins|dialog|tr|policies|help|login)/i;

async function bajarHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-AR,es;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "";
    if (!tipo.includes("html")) return null;
    const texto = await res.text();
    return texto.slice(0, 500_000); // cap de tamaño
  } catch {
    return null;
  }
}

function normalizarUrl(website: string): string {
  const w = website.trim();
  return w.startsWith("http") ? w : `https://${w}`;
}

function extraerEmail(html: string, dominio: string): string | null {
  const candidatos = Array.from(new Set(html.match(EMAIL_RE) ?? []))
    .map(e => e.toLowerCase())
    .filter(e => !EMAIL_BASURA.test(e) && e.length < 60);
  if (!candidatos.length) return null;
  // Preferir un mail del mismo dominio del sitio; si no, el primero decente.
  const propio = candidatos.find(e => dominio && e.endsWith(`@${dominio}`) );
  return propio ?? candidatos[0];
}

// Busca el link a la página de contacto dentro del HTML de la home.
function linkContacto(html: string, base: string): string | null {
  const m = html.match(/href=["']([^"']*(?:contacto|contact|nosotros)[^"']*)["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return null; }
}

export interface ResultadoEnriquecer {
  procesados: number;
  con_email: number;
  con_redes: number;
  restantes: number;
}

// Procesa hasta `limit` prospectos con website y sin email, en paralelo acotado.
export async function enriquecerLote(limit = 10): Promise<ResultadoEnriquecer> {
  await ensureSchema("captacion");
  const filas: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, website, instagram, facebook FROM prospectos
     WHERE website IS NOT NULL AND website <> '' AND email IS NULL AND enriquecido_en IS NULL
     ORDER BY puntos DESC NULLS LAST LIMIT ${Math.min(Math.max(limit, 1), 20)}`
  );

  let con_email = 0, con_redes = 0;

  const CONCURRENCIA = 5;
  for (let i = 0; i < filas.length; i += CONCURRENCIA) {
    await Promise.allSettled(filas.slice(i, i + CONCURRENCIA).map(async (p) => {
      const url = normalizarUrl(String(p.website));
      let dominio = "";
      try { dominio = new URL(url).hostname.replace(/^www\./, ""); } catch { /* url rota */ }

      let email: string | null = null;
      let ig: string | null = null;
      let fb: string | null = null;

      const home = await bajarHtml(url);
      if (home) {
        email = extraerEmail(home, dominio);
        const mIg = home.match(IG_RE);
        if (mIg) ig = `https://instagram.com/${mIg[1].replace(/\/$/, "")}`;
        const mFb = home.match(FB_RE);
        if (mFb && !FB_BASURA.test(mFb[1])) fb = `https://facebook.com/${mFb[1].replace(/\/$/, "")}`;

        // Si la home no tiene mail, probar la página de contacto (1 fetch más).
        if (!email) {
          const contacto = linkContacto(home, url);
          if (contacto) {
            const html2 = await bajarHtml(contacto);
            if (html2) email = extraerEmail(html2, dominio);
          }
        }
      }

      if (email) con_email++;
      if (ig || fb) con_redes++;

      await (prisma as any).$executeRawUnsafe(
        `UPDATE prospectos SET
           email = COALESCE(email, $1),
           instagram = COALESCE(instagram, $2),
           facebook = COALESCE(facebook, $3),
           enriquecido_en = now()
         WHERE id = $4`,
        email, ig, fb, Number(p.id)
      );
    }));
  }

  const rest: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM prospectos
     WHERE website IS NOT NULL AND website <> '' AND email IS NULL AND enriquecido_en IS NULL`
  );

  return { procesados: filas.length, con_email, con_redes, restantes: Number(rest[0]?.n ?? 0) };
}
