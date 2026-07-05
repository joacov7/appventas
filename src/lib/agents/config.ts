import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import type { AgentConfig } from "./types";

const KEY = "agents_config";

async function ensureTable() {
  await ensureSchema("config");
}

export async function loadAgentConfigs(): Promise<Record<string, AgentConfig>> {
  await ensureTable();
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY
    );
    return rows[0]?.config ?? {};
  } catch {
    return {};
  }
}

export async function saveAgentConfig(agentId: string, cfg: AgentConfig): Promise<void> {
  await ensureTable();
  const actual = await loadAgentConfigs();
  actual[agentId] = cfg;
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO catalog_config (tipo, config) VALUES ($1, $2::jsonb)
    ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()
  `, KEY, JSON.stringify(actual));
}
