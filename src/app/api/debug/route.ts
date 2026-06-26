import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const url = process.env.DATABASE_URL ?? "NOT SET";
    const host = url.match(/@([^/]+)\//)?.[1] ?? "unknown";
    await prisma.$queryRaw`SELECT 1`;
    const tables = await prisma.$queryRaw<{tablename: string}[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    return NextResponse.json({ host, tables: tables.map(t => t.tablename) });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
