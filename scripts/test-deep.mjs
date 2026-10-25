import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", "src/test/invariants"], {
  stdio: "inherit",
  env: { ...process.env, SIGEM_DEEP: "1" },
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);