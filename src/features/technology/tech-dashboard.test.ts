import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { techDashboard } from "./tech-dashboard";

const ev = (seq: number, kind: string) => ({ seq, kind, actorPerson: "p", at: "2026-10-01" }) as never;
const rec = (nature: "incidente" | "requisicao") => ({ seq: 1, ticket_code: "CHM-2026-000001", nature, reason: null });

describe("Tecnologia L03 — painel operacional", () => {
  const d = techDashboard({
    today: "2026-10-12", truncated: false,
    tickets: [
      { id: "a", schoolId: "s1", createdAt: "2026-08-01", events: [], records: [rec("incidente")] },
      { id: "b", schoolId: "s1", createdAt: "2026-10-10", events: [ev(1, "atribuicao"), ev(2, "inicio"), ev(3, "conclusao")], records: [rec("requisicao")] },
      { id: "c", schoolId: "s2", createdAt: "2026-10-10", events: [ev(1, "conclusao")], records: [] },
    ],
    problems: [{ id: "p", schoolId: "s1", events: [{ seq: 1, action: "investigar" }] }],
    changes: [{ id: "m", schoolId: null, events: [{ seq: 1, action: "avaliar" }, { seq: 2, action: "aprovar" }] }],
  });
  const v = (k: string) => (d.panels.find((p) => p.key === k) as { values: Record<string, number> }).values;
  it("chamados projetados dos eventos, não de campo gravado", () => {
    expect(v("chamados")).toMatchObject({ abertos: 2, concluidos: 1, "sem-natureza": 1, "abertos-mais-de-30-dias": 1 });
    expect(d.issues).toBe(1); // conclusão sem atendimento é inconsistência, não conta como concluído
  });
  it("incidentes pela natureza vigente", () => expect(v("incidentes")).toEqual({ incidentes: 1, requisicoes: 1, "incidentes-abertos": 1 }));
  it("problemas e mudanças por estado", () => { expect(v("problemas")).toEqual({ "em-investigacao": 1 }); expect(v("mudancas")).toEqual({ aprovar: 1 }); });
  it("fonte ausente é indisponível com motivo, nunca zero", () => {
    for (const k of ["equipamentos", "conectividade", "projetos"]) {
      const p = d.panels.find((x) => x.key === k)!;
      expect(p.status).toBe("unavailable");
      expect("values" in p).toBe(false);
    }
  });
  it("tela só lê (sem insert/update/rpc de escrita)", () => {
    const src = readFileSync("src/features/technology/tech-dashboard-page.tsx", "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(|\.rpc\(/);
  });
});
