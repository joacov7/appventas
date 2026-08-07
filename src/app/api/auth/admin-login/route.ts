import { NextRequest, NextResponse } from "next/server";
import { signSessionToken } from "@/lib/admin-token";
import { buscarPorEmail } from "@/lib/services/usuarios.service";
import { verifyPassword } from "@/lib/password";

// Rate limit simple en memoria: 5 intentos fallidos por IP cada 15 minutos.
// (Best-effort en serverless: cada instancia tiene su contador, pero corta
// la fuerza bruta sostenida contra una misma instancia.)
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooManyAttempts(ip)) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá 15 minutos." }, { status: 429 });
  }

  const { email, password } = await req.json();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json({ error: "Admin no configurado" }, { status: 500 });
  }

  // 1) Súper-admin por variables de entorno (acceso total, no se puede borrar).
  let sub: string | null = null;
  let rol: string | null = null;
  if (adminEmail && adminPassword &&
      timingSafeEqual(String(email ?? ""), adminEmail) &&
      timingSafeEqual(String(password ?? ""), adminPassword)) {
    sub = "admin"; rol = "admin";
  } else {
    // 2) Usuarios del panel (tabla), con contraseña hasheada.
    try {
      const u = await buscarPorEmail(String(email ?? ""));
      if (u && u.activo && await verifyPassword(String(password ?? ""), u.password_hash)) {
        sub = u.email; rol = u.rol;
      }
    } catch { /* si falla la DB, cae en credenciales incorrectas */ }
  }

  if (!sub || !rol) {
    recordFailure(ip);
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  attempts.delete(ip);

  const token = await signSessionToken(adminSecret, sub, rol);
  const response = NextResponse.json({ ok: true, rol });
  response.cookies.set("admin-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 días (el token firmado también expira)
    path: "/",
  });

  return response;
}
