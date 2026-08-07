export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CLIENTE_COOKIE } from "@/lib/cliente-auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/portal/login", req.nextUrl.origin));
  res.cookies.set(CLIENTE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
