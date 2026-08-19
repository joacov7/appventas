import { describe, it, expect } from "vitest";
import { nivelAlerta, featureDeAgente, resolverFeature } from "./presupuesto.logic";

describe("nivelAlerta — umbrales 50/80/100", () => {
  it("sin límite → ok, pct 0", () => {
    const r = nivelAlerta(999, 0);
    expect(r.nivel).toBe("ok");
    expect(r.pct).toBe(0);
  });
  it("< 50% → ok", () => {
    expect(nivelAlerta(40, 100).nivel).toBe("ok");
  });
  it(">= 50% → informativa", () => {
    expect(nivelAlerta(50, 100).nivel).toBe("informativa");
    expect(nivelAlerta(79.9, 100).nivel).toBe("informativa");
  });
  it(">= 80% → advertencia", () => {
    expect(nivelAlerta(80, 100).nivel).toBe("advertencia");
    expect(nivelAlerta(99, 100).nivel).toBe("advertencia");
  });
  it(">= 100% → bloqueo", () => {
    expect(nivelAlerta(100, 100).nivel).toBe("bloqueo");
    expect(nivelAlerta(250, 100).nivel).toBe("bloqueo");
  });
  it("calcula el porcentaje", () => {
    expect(nivelAlerta(30, 120).pct).toBeCloseTo(25);
  });
});

describe("atribución de gasto", () => {
  it("featureDeAgente arma agente:<id>", () => {
    expect(featureDeAgente("ceo")).toBe("agente:ceo");
  });
  it("resolverFeature: explícita gana", () => {
    expect(resolverFeature({ feature: "titulos-ml", agentId: "ceo" })).toBe("titulos-ml");
  });
  it("resolverFeature: agentId → agente:<id>", () => {
    expect(resolverFeature({ agentId: "whatsapp" })).toBe("agente:whatsapp");
  });
  it("resolverFeature: sin nada → otros", () => {
    expect(resolverFeature({})).toBe("otros");
  });
});
