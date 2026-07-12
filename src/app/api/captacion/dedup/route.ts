export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deduplicarProspectos } from "@/lib/services/dedup.service";

// Depura duplicados de la cartera de prospectos (OSM + Google Places).
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const r = await deduplicarProspectos();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error deduplicando" }, { status: 500 });
  }
}
