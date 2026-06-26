import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  const { id } = await params;
  await prisma.heroSlide.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const slide = await prisma.heroSlide.update({ where: { id }, data: body });
  return NextResponse.json(slide);
}
