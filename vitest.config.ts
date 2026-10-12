import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// NPERF.TEST.1 — jsdom custava ~70% da suíte. Testes .ts rodam em node; .tsx e os .ts
// que tocam DOM (lista abaixo, verificada por execução) rodam em jsdom. Nenhum teste é excluído:
// `src/test/test-environments.test.ts` garante que todo arquivo de teste cai em exatamente um projeto.
export const DOM_TS_TESTS = [
  "src/lib/keyboard.test.ts",
  "src/features/calendar/calendar-supervision-restore.test.ts",
];

const shared = { testTimeout: 20000, globals: true, css: false } as const;

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    ...shared,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: DOM_TS_TESTS,
          setupFiles: ["./src/test/setup-common.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", ...DOM_TS_TESTS],
          setupFiles: ["./src/test/setup-common.ts", "./src/test/setup.ts"],
        },
      },
    ],
  },
});
