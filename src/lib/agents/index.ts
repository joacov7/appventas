export * from "./types";
export { AGENTS, getAgent } from "./definitions";
export { runAgent, lastRuns } from "./engine";
export { loadAgentConfigs, saveAgentConfig } from "./config";
export {
  createOrMerge, transicionar, vincularAccion, listar as listarRecomendaciones,
  fuentesDe, dedupKey, calcularPrioridad, calcularValorEsperado,
  confianzaPorOrigen, puedeTransicionar, ESTADOS_VIVOS,
  marcarResultadoAccion, editarAccionInput,
} from "./recommendations";
export type {
  Recommendation, RecommendationInput, Severidad, EstadoReco, OrigenConfianza, Evidencia,
} from "./recommendations";
export {
  loadPolicies, savePolicies, enforceWrite, registrarAccion, ejecutadasHoy,
  resolvePolicy, evaluar, POLICIES_DEFAULT,
} from "./policies";
export type { PoliciesConfig, ToolPolicy, GlobalPolicy, EvalResult, EvalContext } from "./policies";
export { generarResumenJefe, ultimoResumenJefe } from "./jefe-gabinete";
export {
  registrarResultado, atribuirVenta, resultadosDe, resumenResultados,
  TIPOS_RESULTADO, esPositivo, esNegativo, agregarMetricas,
} from "./resultados";
export type { TipoResultado, ResultadoRow, MetricasResultados, ResumenResultados } from "./resultados";
export {
  MEM_NS, recordarDecision, decisionesDeEntidad, decisionQueBloquea,
  recordarCliente, perfilCliente, recordarProducto, perfilProducto,
  recordarProveedor, perfilProveedor, recordarReglaEmpresa, reglasEmpresa,
  estaVigente, decisionBloqueante, vencimientoEnDias,
} from "./memoria-estructurada";
export type { DecisionValue, MemNamespace } from "./memoria-estructurada";
export { scoreCliente, ameritaReactivacion } from "./crm.logic";
export type { CustomerScore, Riesgo, MetricasCliente } from "./crm.logic";
export {
  analizar, deduplicar, detectarConflictos, priorizar, conteosPorSeveridad, textoPlantilla,
} from "./jefe-gabinete.logic";
export type { RecoJefe, Conflicto, ResumenJefe } from "./jefe-gabinete.logic";
