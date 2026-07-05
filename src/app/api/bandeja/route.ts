export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listarConversaciones, hiloConversacion, responderConversacion, type Canal } from "@/lib/services/bandeja.service";

// GET: lista de conversaciones, o el hilo de una si se pasa ?contacto&canal.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const contacto = sp.get("contacto");
  const canal = (sp.get("canal") as Canal) || "whatsapp";
  try {
    if (contacto) {
      return NextResponse.json(await hiloConversacion(canal, contacto));
    }
    const canalFiltro = sp.get("canal") as Canal | null;
    return NextResponse.json(await listarConversaciones(canalFiltro ? { canal: canalFiltro } : {}));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// POST: responde en el canal correspondiente.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { canal, contacto, texto } = await req.json();
  if (!contacto || !texto) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  try {
    const r = await responderConversacion((canal as Canal) || "whatsapp", contacto, texto);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
