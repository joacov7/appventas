export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getClienteSesion } from "@/lib/cliente-auth";

export async function GET() {
  const ses = await getClienteSesion();
  return NextResponse.json({ email: ses?.email ?? null });
}
