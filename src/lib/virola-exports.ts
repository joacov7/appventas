"use client";

// ── Constantes de canvas ─────────────────────────────────────────────────────
export const CANVAS_SIZE = 500;
export const RING_OUTER = 220;
export const RING_INNER = 80;

// Escala px → mm: la virola de 35mm de diámetro real ocupa 2*RING_OUTER px en canvas
export function pxToMm(px: number, diametroMm: number): number {
  return (px / (2 * RING_OUTER)) * diametroMm;
}

// ── SVG export ───────────────────────────────────────────────────────────────
export async function exportSVG(canvas: any, virola: { diametroMm: number; nombre: string }) {
  // Quitar clip para exportar completo y re-poner
  const clip = canvas.clipPath;
  canvas.clipPath = undefined;
  canvas.renderAll();

  const svgStr = canvas.toSVG({
    width: `${virola.diametroMm}mm`,
    height: `${virola.diametroMm}mm`,
    viewBox: `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`,
  });

  canvas.clipPath = clip;
  canvas.renderAll();

  // Inyectar clip circular en el SVG
  const ringR = RING_OUTER;
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const clipDef = `<defs>
  <clipPath id="ring-clip">
    <circle cx="${cx}" cy="${cy}" r="${ringR}"/>
  </clipPath>
</defs>`;
  const layerGuides = `<!-- Capa CORTE: anillo exterior e interior para láser -->
<g id="CORTE" fill="none" stroke="red" stroke-width="0.5">
  <circle cx="${cx}" cy="${cy}" r="${ringR}" />
  <circle cx="${cx}" cy="${cy}" r="${RING_INNER}" />
</g>`;

  // Insertar defs y guías al inicio del SVG
  const svgWithClip = svgStr
    .replace("<defs>", `${clipDef}<defs>`)
    .replace("</svg>", `${layerGuides}\n</svg>`);

  download(svgWithClip, `${slug(virola.nombre)}.svg`, "image/svg+xml");
}

// ── DXF export ───────────────────────────────────────────────────────────────
export async function exportDXF(canvas: any, virola: { diametroMm: number; nombre: string }) {
  const Drawing = (await import("dxf-writer")).default;
  const d = new Drawing();

  // Capas
  d.addLayer("CORTE", Drawing.ACI.RED, "CONTINUOUS");
  d.addLayer("GRABADO", Drawing.ACI.CYAN, "CONTINUOUS");

  const scale = virola.diametroMm / (2 * RING_OUTER); // px → mm
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;

  // --- Capa CORTE: anillo ---
  d.setActiveLayer("CORTE");
  // DXF usa Y invertido con respecto a canvas
  d.drawCircle(0, 0, RING_OUTER * scale);
  d.drawCircle(0, 0, RING_INNER * scale);

  // --- Capa GRABADO: objetos del diseño ---
  d.setActiveLayer("GRABADO");

  const objects = canvas.getObjects();
  for (const obj of objects) {
    const x = ((obj.left ?? 0) - cx) * scale;
    const y = -((obj.top ?? 0) - cy) * scale; // invertir Y

    if (obj.type === "i-text" || obj.type === "text") {
      const text = obj.text ?? "";
      const h = (obj.fontSize ?? 24) * scale;
      d.drawText(x, y, h, 0, text);
    } else if (obj.type === "image") {
      // Imágenes: bounding box como rectángulo de referencia
      const w = (obj.width ?? 50) * (obj.scaleX ?? 1) * scale;
      const h = (obj.height ?? 50) * (obj.scaleY ?? 1) * scale;
      d.drawRect(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    }
  }

  download(d.toDxfString(), `${slug(virola.nombre)}.dxf`, "application/dxf");
}

// ── PNG export (alta resolución) ─────────────────────────────────────────────
export async function exportPNG(canvas: any, virola: { nombre: string }) {
  const clip = canvas.clipPath;
  canvas.clipPath = undefined;
  canvas.renderAll();
  const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
  canvas.clipPath = clip;
  canvas.renderAll();
  download(dataUrl, `${slug(virola.nombre)}.png`, "image/png");
}

// ── PDF orden de trabajo ─────────────────────────────────────────────────────
export async function exportPDF(
  canvas: any,
  virola: { nombre: string; material: string; diametroMm: number; precioBase: string },
  cantidad: number,
  perfil?: { nombre: string; potencia: number; velocidad: number; pasadas: number } | null
) {
  const jsPDFModule = await import("jspdf");
  const jsPDF = jsPDFModule.default ?? (jsPDFModule as any).jsPDF;

  const clip = canvas.clipPath;
  canvas.clipPath = undefined;
  canvas.renderAll();
  const imgData = canvas.toDataURL({ format: "png", multiplier: 1.5 });
  canvas.clipPath = clip;
  canvas.renderAll();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Encabezado
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Orden de Trabajo — Virola Personalizada", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 14, 27);

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(14, 30, pageW - 14, 30);

  // Datos del producto
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.text("Especificaciones", 14, 38);
  doc.setFont("helvetica", "normal");

  const specs = [
    ["Modelo", virola.nombre],
    ["Material", virola.material],
    ["Diámetro", `${virola.diametroMm} mm`],
    ["Precio unitario", `$${Number(virola.precioBase).toLocaleString("es-AR")}`],
    ["Cantidad", String(cantidad)],
    ["Total", `$${(Number(virola.precioBase) * cantidad).toLocaleString("es-AR")}`],
  ];

  let y = 44;
  for (const [label, value] of specs) {
    doc.setTextColor(100);
    doc.text(`${label}:`, 14, y);
    doc.setTextColor(30);
    doc.text(value, 55, y);
    y += 7;
  }

  // Perfil de láser
  if (perfil) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Perfil de Láser", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const laserSpecs = [
      ["Perfil", perfil.nombre],
      ["Potencia", `${perfil.potencia}%`],
      ["Velocidad", `${perfil.velocidad} mm/s`],
      ["Pasadas", String(perfil.pasadas)],
    ];
    for (const [label, value] of laserSpecs) {
      doc.setTextColor(100);
      doc.text(`${label}:`, 14, y);
      doc.setTextColor(30);
      doc.text(value, 55, y);
      y += 7;
    }
  }

  // Diseño
  const imgX = pageW / 2 - 55;
  doc.addImage(imgData, "PNG", imgX, 38, 110, 110);

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Diseño generado digitalmente — Archivo para producción láser", 14, pageH - 10);

  doc.save(`orden-${slug(virola.nombre)}.pdf`);
}

// ── helpers ───────────────────────────────────────────────────────────────────
function slug(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
