import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Config dedicada al smoke test contra la base real (npm run smoke).
// Se mantiene separada del `npm test` para que el suite normal no ejecute el
// smoke. Comparte el alias "@".
export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["scripts/**/*.ts"],
    testTimeout: 60000,
  },
});
