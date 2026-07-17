import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verificarSesion } from "@/lib/admin-token";

// Secciones del panel que puede ver cada rol no-admin. El admin ve todo.
const PERMISOS_POR_ROL: Record<string, string[]> = {
  deposito: ["/admin/deposito"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("admin-token")?.value;
    const sesion = await verificarSesion(token, process.env.ADMIN_SECRET);
    if (!sesion) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Roles no-admin: solo pueden entrar a sus secciones permitidas.
    if (sesion.rol !== "admin") {
      const permitidas = PERMISOS_POR_ROL[sesion.rol] ?? [];
      const ok = permitidas.some(p => pathname === p || pathname.startsWith(p + "/"));
      if (!ok) {
        const destino = permitidas[0] ?? "/login";
        return NextResponse.redirect(new URL(destino, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
