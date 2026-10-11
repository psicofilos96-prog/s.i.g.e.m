import { describe, it, expect } from "vitest";
import { appendNc, project, recurrence, versionPlan, planGaps, type NcEvent } from "./supervision-nonconformity";

const base = { caseId: "c1", isHuman: true, at: "2026-03-01", reason: null } as const;
function run(steps: Omit<NcEvent, "seq">[]) {
  let log: NcEvent[] = [];
  for (const s of steps) { const r = appendNc(log, s, log.length, ["alta"]); if (!r.ok) return r.code; log = r.value; }
  return log;
}
const obs: Omit<NcEvent, "seq"> = { ...base, kind: "observar", principalId: "a", level: "registrar", side: "supervisao", schoolId: "E1", area: "escrituracao", normRef: "Res. CME 3/2026 art. 5", evidencePaths: ["supervisao/E1/v1/f.jpg"], priority: "alta" };

describe("não conformidade", () => {
  it("ciclo completo até regularizada", () => {
    const log = run([
      obs,
      { ...base, kind: "analisar", principalId: "a", level: "registrar", side: "supervisao" },
      { ...base, kind: "solicitar-esclarecimento", principalId: "a", level: "registrar", side: "supervisao", reason: "explicar livro" },
      { ...base, kind: "manifestar", principalId: "dir", level: "consultar", side: "escola", reason: "livro em restauro" },
      { ...base, kind: "confirmar", principalId: "b", level: "conferir", side: "supervisao" },
      { ...base, kind: "iniciar-providencias", principalId: "a", level: "registrar", side: "supervisao" },
      { ...base, kind: "solicitar-verificacao", principalId: "a", level: "registrar", side: "supervisao" },
      { ...base, kind: "verificar", principalId: "b", level: "conferir", side: "supervisao", verifiedOk: true },
    ]);
    if (typeof log === "string") throw new Error(log);
    const p = project(log);
    expect(p.state).toBe("regularizada");
    expect(p.manifestations).toHaveLength(1);
    expect(recurrence([log], "E1", "escrituracao")).toEqual(["c1"]);
  });
  it("não confirma automaticamente nem pelo próprio observador", () => {
    const pre = [obs, { ...base, kind: "analisar" as const, principalId: "a", level: "registrar" as const, side: "supervisao" as const }];
    expect(run([...pre, { ...base, kind: "confirmar", principalId: "a", level: "coordenar", side: "supervisao" }])).toBe("confirmador-igual-ao-observador");
    expect(run([...pre, { ...base, kind: "confirmar", principalId: "b", level: "registrar", side: "supervisao" }])).toBe("sem-competencia");
    expect(run([{ ...obs, normRef: null }, pre[1]!, { ...base, kind: "confirmar", principalId: "b", level: "conferir", side: "supervisao" }])).toBe("sem-norma-referenciada");
    expect(run([{ ...obs, isHuman: false }])).toBe("autor-nao-humano");
    expect(run([{ ...obs, priority: "urgentissima" }])).toBe("prioridade-nao-configurada");
    expect(run([obs, { ...base, kind: "encerrar", principalId: "a", level: "registrar", side: "supervisao" }])).toBe("transicao-invalida");
  });
});

describe("plano de adequação", () => {
  const act = { id: "a1", description: "restaurar livro", resources: null, responsible: "Secretaria", dueOn: "2026-02-01", evidencePaths: [], done: false };
  it("versiona com motivo, exige evidência na verificação final e lista lacunas", () => {
    const v1 = versionPlan([], { caseId: "c1", authorId: "a", isHuman: true, reason: null, actions: [act], finalCheck: null }, 0, "confirmada");
    if (!v1.ok) throw new Error(v1.code);
    expect(versionPlan(v1.value, { caseId: "c1", authorId: "a", isHuman: true, reason: null, actions: [act], finalCheck: null }, 1, "em-providencia")).toEqual({ ok: false, code: "motivo-obrigatorio" });
    expect(versionPlan(v1.value, { caseId: "c1", authorId: "a", isHuman: true, reason: "final", actions: [{ ...act, done: true }], finalCheck: { by: "b", ok: true, at: "x" } }, 1, "em-providencia")).toEqual({ ok: false, code: "acao-sem-evidencia" });
    expect(planGaps(v1.value[0]!, "2026-03-01")).toEqual([{ action: "a1", gap: "prazo vencido" }]);
  });
});
