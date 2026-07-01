export const dynamic = "force-dynamic";

import Image from "next/image";
import { Package, ShieldCheck, Truck, Phone } from "lucide-react";
import { MayoristaRequestForm } from "./MayoristaRequestForm";

interface Product {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  category: { name: string } | null;
  variants: { price: number }[];
}

async function getProducts(): Promise<Product[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        category: { select: { name: true } },
        variants: { where: { active: true }, orderBy: { price: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrls: p.imageUrls,
      category: p.category,
      variants: p.variants.map(v => ({ price: Number(v.price) })),
    }));
  } catch {
    return [];
  }
}

async function getMayoristaDiscount(): Promise<number> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const tiers: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT descuento_pct FROM mayorista_tiers ORDER BY descuento_pct DESC LIMIT 1`
    );
    return tiers[0]?.descuento_pct ?? 20;
  } catch {
    return 20;
  }
}

export default async function MayoristasPage() {
  const [products, descuento] = await Promise.all([getProducts(), getMayoristaDiscount()]);

  return (
    <div className="min-h-screen bg-[#f8f6f1]">
      {/* Hero */}
      <section className="relative bg-[#1a1209] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1600&q=80')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center space-y-5">
          <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest">Canal Mayorista</p>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight">
            Distribuí productos<br />con identidad propia
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Precios especiales para revendedores, bazares y tiendas de regalos. Acceso con solicitud previa.
          </p>
          <a href="#solicitar"
            className="inline-block mt-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-full transition-colors">
            Solicitar acceso mayorista
          </a>
        </div>
      </section>

      {/* Beneficios */}
      <section className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[
          { icon: ShieldCheck, title: `${descuento}% OFF`, desc: "Precio mayorista directo" },
          { icon: Package, title: "Sin mínimo fijo", desc: "Pedidos a tu ritmo" },
          { icon: Truck, title: "Envío a todo el país", desc: "Coordinamos el despacho" },
          { icon: Phone, title: "Atención dedicada", desc: "Canal exclusivo WhatsApp" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl p-5 text-center shadow-sm border border-amber-100">
            <Icon size={28} className="mx-auto mb-2 text-amber-600" />
            <p className="font-bold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </section>

      {/* Productos */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Nuestros productos</h2>
        <p className="text-gray-500 text-sm mb-8">
          Precio público → precio mayorista con <span className="font-semibold text-amber-700">{descuento}% de descuento</span>
        </p>

        {products.length === 0 ? (
          <p className="text-center text-gray-400 py-16">No hay productos disponibles.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => {
              const precio = p.variants[0]?.price ?? null;
              const precioMayorista = precio ? Math.round(precio * (1 - descuento / 100)) : null;
              const img = p.imageUrls[0] ?? null;
              return (
                <div key={p.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
                  <div className="aspect-square bg-gray-50 relative">
                    {img ? (
                      <Image src={img} alt={p.name} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <Package size={40} strokeWidth={1} />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                      -{descuento}%
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    {p.category && <p className="text-xs text-gray-400 mb-0.5">{p.category.name}</p>}
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2">{p.name}</h3>
                    <div className="mt-auto">
                      {precio && (
                        <p className="text-xs text-gray-400 line-through">
                          ${precio.toLocaleString("es-AR")}
                        </p>
                      )}
                      {precioMayorista && (
                        <p className="font-bold text-amber-700 text-base">
                          ${precioMayorista.toLocaleString("es-AR")}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">Precio mayorista</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Formulario de solicitud */}
      <section id="solicitar" className="bg-[#1a1209] text-white py-16 px-6">
        <div className="max-w-lg mx-auto">
          <h2 className="text-3xl font-bold mb-2 text-center">Solicitá tu acceso</h2>
          <p className="text-white/60 text-sm text-center mb-8">
            Completá el formulario y te contactamos en menos de 24hs.
          </p>
          <MayoristaRequestForm />
        </div>
      </section>
    </div>
  );
}
