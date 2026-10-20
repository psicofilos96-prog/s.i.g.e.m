import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { adaptersFor } from "./audit-page";

describe("PERF.LOADING.1 — Estação lê só as fontes que exibe", () => {
  it("Contas e Políticas consultam apenas as duas tabelas delas", () => {
    expect(adaptersFor(new Set(["Contas", "Políticas de acesso"])).map((a) => a.table).sort())
      .toEqual(["account_credential_events", "capability_policies"]);
  });
  it("a Auditoria completa continua lendo todas as fontes", () => {
    expect(adaptersFor().length).toBe(6);
  });
});
