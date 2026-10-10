import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const applied: Array<[string, unknown]> = [];
let denied = false;
vi.mock("@/integrations/supabase/client", () => {
  const b: Record<string, (...a: unknown[]) => unknown> = {};
  for (const k of ["select", "eq", "ilike", "or", "order", "abortSignal", "limit"]) b[k] = (...a: unknown[]) => { applied.push([k, a]); return b; };
  b["range"] = async () => denied ? { data: null, error: { message: "permission denied" }, count: null } : { data: [
    { id: "1", source_kind: "servidores-por-escola", source_file: "s.xlsx", sheet: "Servidores por escola", row_no: 7, reference_period: "2026", school_id: "E1", school_name_source: "Escola A", sector: null, full_name: "Fulana", registration: null, cargo: "Professor", funcao: "Regente", vinculo: "Efetivo", situacao: null },
  ], error: null, count: 1797 };
  return { supabase: { from: () => b } };
});

import { readStaffRecords, sanitizeTerm } from "./staff-records";

describe("pessoal 2026 por escola", () => {
  it("filtros de escola, fonte, setor e situação vão ao servidor; ausência fica ausente; nunca concede acesso", async () => {
    applied.length = 0;
    const r = await readStaffRecords({ source: "servidores-por-escola", schoolId: "E1", sector: "", situacao: "ativo", search: "ful" }, 0);
    expect(applied).toContainEqual(["eq", ["school_id", "E1"]]);
    expect(applied).toContainEqual(["eq", ["source_kind", "servidores-por-escola"]]);
    expect(applied).toContainEqual(["ilike", ["situacao", "%ativo%"]]);
    expect(r.total).toBe(1797);
    expect(r.rows[0]).toMatchObject({ situacao: null, sourceLabel: "Planilha de servidores por escola", grantsAccess: false });
  });
  it("sem permissão: falha fechada", async () => {
    denied = true;
    await expect(readStaffRecords({ source: "", schoolId: "", sector: "", situacao: "", search: "" }, 0)).rejects.toThrow(/permission/);
    denied = false;
  });
  it("pesquisa não injeta operadores no filtro", () => {
    expect(sanitizeTerm("a,b.or(x)%")).not.toMatch(/[,()%]/);
  });
  it("só lê: sem escrita, sem cliente privilegiado, sem tocar atuação/acesso", () => {
    const src = readFileSync("src/features/professionals/staff-records.ts", "utf8") + readFileSync("src/features/professionals/staff-records-page.tsx", "utf8");
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|client\.server|institutional_engagements/);
  });
});
