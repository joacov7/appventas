import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { resolvePolicy, evaluar, POLICIES_DEFAULT } from "./policies.logic";
import type { PoliciesConfig, EvalResult } from "./policies.logic";
import type { AutonomyMode } from "./types";

export { resolvePolicy, evaluar, POLICIES_DEFAULT } from "./policies.logic";
export type { PoliciesConfig, ToolPolicy, GlobalPolicy, EvalResult, EvalContext } from "./policies.logic";

const KEY = "agent_policies";

async function ensure() { await ensureSchema("config", "agentes"); }

// ─── Config de políticas (reutiliza catalog_config, sin tabla nueva) ─────────
export async function loadPolicies(): Promise<PoliciesConfig> {
  await ensure();
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY);
    return rows[0]?.config ?? POLICIES_DEFAULT;
  } catch {
    return POLICIES_DEFAULT;
  }
}

export async function savePolicies(cfg: PoliciesConfig): Promise<void> {
  await ensure();
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ($1, $2::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()`,
    KEY, JSON.stringify(cfg));
}

// ─── Contexto para el enforcement (consultas mínimas a la base) ──────────────

// Cuántas veces se EJECUTÓ (world-facing) esta tool hoy — para el tope diario.
export async function ejecutadasHoy(tool: string, tenantId = "default"): Promise<number> {
  try {
    const r: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM agent_tool_actions
        WHERE tenant_id = $1 AND tool = $2 AND modo = 'ejecutada'
          AND created_at >= date_trunc('day', now())`, tenantId, tool);
    return r[0]?.n ?? 0;
  } catch { return 0; }
}

// Precio (variante activa más barata) y costo actuales del producto.
async function precioYCosto(productId: string): Promise<{ precio: number | null; costo: number | null }> {
  let precio: number | null = null, costo: number | null = null;
  try {
    const v = await prisma.productVariant.findFirst({
      where: { productId: String(productId), active: true }, orderBy: { price: "asc" },
    });
    precio = v ? Number(v.price) : null;
  } catch { /* noop */ }
  try {
    const c: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT costo::float AS costo FROM product_pricing WHERE product_id = $1`, String(productId));
    costo = c[0]?.costo != null ? Number(c[0].costo) : null;
  } catch { /* noop */ }
  return { precio, costo };
}

// Registra una acción de escritura (auditoría + contador diario).
export async function registrarAccion(input: {
  agentId?: string | null; agentRunId?: number | null; tool: string;
  modo: "ejecutada" | "propuesta" | "bloqueada"; motivo?: string | null; entityId?: string | null;
  tenantId?: string;
}): Promise<void> {
  await ensure();
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO agent_tool_actions (tenant_id, agent_id, agent_run_id, tool, modo, motivo, entity_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    input.tenantId ?? "default", input.agentId ?? null, input.agentRunId ?? null,
    input.tool, input.modo, input.motivo ?? null, input.entityId ?? null).catch(() => {});
}

// ─── Enforcement de alto nivel: junta contexto y evalúa ──────────────────────
// Usado por el engine (agentes) y por el endpoint de aprobación. Server-side.
export async function enforceWrite(args: {
  agentId: string;
  tool: string;
  input: any;
  agentAutonomy: AutonomyMode;
  ejecutadasEnRun?: number;
  cfg?: PoliciesConfig;
  tenantId?: string;
}): Promise<EvalResult> {
  const cfg = args.cfg ?? await loadPolicies();
  const resolved = resolvePolicy(cfg, args.agentId, args.tool);
  const global = cfg.global ?? {};

  let precioActual: number | null = null, costoActual: number | null = null;
  if (args.tool === "aplicar_precio" && args.input?.productId) {
    const pc = await precioYCosto(String(args.input.productId));
    precioActual = pc.precio; costoActual = pc.costo;
  }

  const diario = await ejecutadasHoy(args.tool, args.tenantId);

  return evaluar({
    tool: args.tool,
    resolved,
    global,
    agentAutonomy: args.agentAutonomy,
    toolInput: args.input,
    hora: new Date().getHours(),
    ejecutadasEnRun: args.ejecutadasEnRun ?? 0,
    ejecutadasHoy: diario,
    precioActual,
    costoActual,
  });
}
