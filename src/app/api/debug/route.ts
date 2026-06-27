export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, any> = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    ADMIN_SECRET: !!process.env.ADMIN_SECRET,
  };

  try {
    await (prisma as any).$queryRawUnsafe("SELECT 1");
    checks.db_connection = "ok";
  } catch (e: any) {
    checks.db_connection = e?.message ?? "error";
  }

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='virolas'"
    );
    checks.virolas_table = rows.length > 0 ? "exists" : "missing";
  } catch (e: any) {
    checks.virolas_table = e?.message ?? "error";
  }

  return NextResponse.json(checks);
}
