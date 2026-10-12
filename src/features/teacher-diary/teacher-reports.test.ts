import { describe, expect, it } from "vitest";
import { INSTITUTIONAL_LOGOS } from "@/features/reports/report-analytics";
import { TEACHER_REPORTS, canSign, nextEmission, pageFooter, reportReadiness, validateHeader } from "./teacher-reports";

describe("relatórios do docente (L16)", () => {
  it("catálogo cobre os 13 relatórios pedidos, cada um com fonte", () => {
    expect(TEACHER_REPORTS).toHaveLength(13);
    expect(TEACHER_REPORTS.every((r) => r.sources.length > 0)).toBe(true);
  });
  it("fonte negada ou não lida e regra ausente bloqueiam por extenso", () => {
    expect(reportReadiness("aulas", { "lesson-versions": "lida" }, false)).toEqual({ ok: true });
    const r = reportReadiness("frequencia-turma", { attendance: "negada" }, false);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reasons.join("|")).toMatch(/permissão.*\|.*roster.*\|.*regra homologada/);
  });
  it("cabeçalho aceita só logos institucionais", () => {
    const ok = { title: "Diário", schoolName: "E.M. X", lines: [], logoIds: INSTITUTIONAL_LOGOS.slice(0, 1).map((l) => l.id), coatOfArms: true };
    expect(validateHeader(ok)).toEqual([]);
    expect(validateHeader({ ...ok, logoIds: ["javascript:alert"] }).join()).toMatch(/institucional/);
  });
  it("rodapé paginado legível", () => expect(pageFooter(2, 5, 3, "AB12")).toBe("Página 2 de 5 · versão 3 · verificação AB12"));
  it("assinatura só de pessoa autorizada; ICP só com evidência", () => {
    const doc = { reportId: "diario-de-classe" as const, authorPersonId: "p1", requiredCapability: null };
    expect(canSign(doc, { personId: null, capabilities: [], icpEvidence: false }).ok).toBe(false);
    expect(canSign(doc, { personId: "p2", capabilities: [], icpEvidence: false }).ok).toBe(false);
    expect(canSign(doc, { personId: "p1", capabilities: [], icpEvidence: false })).toEqual({ ok: true, kind: "simples" });
    const dir = { ...doc, requiredCapability: "assinar-diario" };
    expect(canSign(dir, { personId: "p1", capabilities: [], icpEvidence: true }).ok).toBe(false);
    expect(canSign(dir, { personId: "d", capabilities: ["assinar-diario"], icpEvidence: true }).kind).toBe("qualificada");
  });
  it("mesma fonte não cria versão; mudança cria", () => {
    expect(nextEmission([], "h1")).toEqual({ version: 1, changed: true });
    expect(nextEmission([{ version: 1, hash: "h1" }], "h1")).toEqual({ version: 1, changed: false });
    expect(nextEmission([{ version: 1, hash: "h1" }], "h2").version).toBe(2);
  });
});
