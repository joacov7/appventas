"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Item { producto: string; variante: string | null; pedido: number; controlado: number; faltante: number; }
interface Prep {
  order_id: string; cliente: string; direccion: any; email: string | null; notas: string | null;
  items: Item[]; hayFaltante: boolean; armador: string | null;
}

export default function EtiquetaPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [prep, setPrep] = useState<Prep | null>(null);
  const [tienda, setTienda] = useState("Regionales por Mayor");

  useEffect(() => {
    fetch(`/api/deposito/${orderId}`).then(r => r.json()).then(setPrep);
    fetch("/api/store-config").then(r => r.json()).then(d => { if (d?.storeName) setTienda(d.storeName); }).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (prep) { const t = setTimeout(() => window.print(), 500); return () => clearTimeout(t); }
  }, [prep]);

  if (!prep) return <p style={{ padding: 20 }}>Cargando…</p>;
  const dir = prep.direccion ?? {};

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <style>{`@media print { .noprint { display:none } @page { margin: 12mm } }`}</style>
      <div className="noprint" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: "#111", color: "#fff", border: 0, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Imprimir</button>
        <button onClick={() => window.close()} style={{ border: "1px solid #ccc", background: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Cerrar</button>
      </div>

      {/* ── Etiqueta de envío ── */}
      <div style={{ border: "2px solid #111", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666" }}>Etiqueta de envío</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>DE:</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{tienda}</div>
        <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
        <div style={{ fontSize: 11, color: "#666" }}>PARA:</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{dir.fullName ?? prep.cliente}</div>
        {dir.street && <div style={{ fontSize: 16 }}>{dir.street}</div>}
        <div style={{ fontSize: 16 }}>{[dir.city, dir.province].filter(Boolean).join(", ")}</div>
        {dir.postalCode && <div style={{ fontSize: 16, fontWeight: 600 }}>CP {dir.postalCode}</div>}
        {dir.phone && <div style={{ fontSize: 14, marginTop: 4 }}>Tel: {dir.phone}</div>}
        <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>Pedido #{prep.order_id.slice(0, 8)}</div>
      </div>

      {/* ── Remito / control de armado ── */}
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Remito · Control de armado</div>
          <div style={{ fontSize: 11, color: "#666" }}>{prep.armador ? `Armó: ${prep.armador}` : ""}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left", color: "#666", fontSize: 11 }}>
              <th style={{ padding: "4px 0" }}>Producto</th>
              <th style={{ textAlign: "center" }}>Pedido</th>
              <th style={{ textAlign: "center" }}>Enviado</th>
              <th style={{ textAlign: "center" }}>Falta</th>
            </tr>
          </thead>
          <tbody>
            {prep.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 0" }}>{it.producto}{it.variante ? ` — ${it.variante}` : ""}</td>
                <td style={{ textAlign: "center" }}>{it.pedido}</td>
                <td style={{ textAlign: "center", fontWeight: 600 }}>{it.controlado}</td>
                <td style={{ textAlign: "center", color: it.faltante > 0 ? "#c00" : "#999" }}>{it.faltante || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {prep.hayFaltante && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#c00", fontWeight: 600 }}>⚠️ Pedido con faltantes — revisar con el cliente.</div>
        )}
        {prep.notas && <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Notas: {prep.notas}</div>}
      </div>
    </div>
  );
}
