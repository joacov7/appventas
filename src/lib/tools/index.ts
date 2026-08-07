// Punto de entrada del Tool Registry. Registra todas las tools una sola vez.
import { registry } from "./registry";
import { TOOLS } from "./definitions";

for (const tool of TOOLS) registry.register(tool);

export { registry };
export * from "./types";
