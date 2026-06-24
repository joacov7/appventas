import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "NO ESTÁ";
  const host = url.includes("@") ? url.split("@")[1]?.split("/")[0] : "no se puede parsear";
  return NextResponse.json({ host, hasUrl: !!process.env.DATABASE_URL });
}
