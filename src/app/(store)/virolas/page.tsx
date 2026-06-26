import Link from "next/link";
import { CircleDot, Pencil } from "lucide-react";

interface Virola {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  material: string;
  diametroMm: number;
  precioBase: string;
  imageUrl: string | null;
}

async function getVirolas(): Promise<Virola[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/virolas`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function VirolasPage() {
  const virolas = await getVirolas();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <CircleDot size={16} />
          Diseño personalizado
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Personalizá tu virola</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Elegí el modelo, agregá tu diseño con texto e imágenes, y recibí tu virola única cortada a láser.
        </p>
      </div>

      {/* Process steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
        {[
          { n: "1", t: "Elegí el modelo", d: "Seleccioná entre nuestros modelos de virola en diferentes materiales y diámetros." },
          { n: "2", t: "Diseñá en el editor", d: "Agregá textos, íconos y tu logo. Mové, rotá y escalá cada elemento en el canvas." },
          { n: "3", t: "Agregá al carrito", d: "Tu diseño se guarda con el pedido y lo producimos con nuestro láser de precisión." },
        ].map(({ n, t, d }) => (
          <div key={n} className="bg-gray-50 rounded-2xl p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center mx-auto mb-3 text-lg">
              {n}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t}</h3>
            <p className="text-sm text-gray-500">{d}</p>
          </div>
        ))}
      </div>

      {/* Virola cards */}
      {virolas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CircleDot size={48} strokeWidth={1} className="mx-auto mb-4" />
          <p className="text-lg">Próximamente disponible</p>
          <p className="text-sm mt-2">Estamos preparando el catálogo de virolas. ¡Volvé pronto!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {virolas.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-2xl overflow-hidden flex items-center justify-center">
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt={v.nombre} className="w-full h-full object-cover" />
                ) : (
                  <CircleDot size={80} strokeWidth={0.8} className="text-gray-300" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{v.nombre}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">{v.diametroMm}mm</span>
                </div>
                <p className="text-sm text-gray-500 capitalize mb-1">{v.material}</p>
                {v.descripcion && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{v.descripcion}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="font-bold text-lg text-gray-900">
                    ${Number(v.precioBase).toLocaleString("es-AR")}
                  </span>
                  <Link
                    href={`/virolas/${v.slug}/personalizar`}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Pencil size={14} /> Personalizar
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
