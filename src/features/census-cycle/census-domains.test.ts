import { describe, expect, it } from "vitest";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { CENSUS_SNAPSHOT_REPORT, domainCoverage, isRepeatedImport, reconciliationRows, ruleDomain, snapshotReportRows } from "./census-domains";
import type { SnapshotContent } from "./census-cycle";

const snap: SnapshotContent = {
  schema: "s", academic_year_id: "2026", reference_date: "2026-05-27", rule_set: "estrutural-v1",
  schools: [
    { school_id: "A", active: true, measures: { vinculos_ativos: { value: 10, reason: null }, turmas: { value: 2, reason: null }, enturmacoes_vigentes: { value: null, reason: "x" }, lotacoes_profissionais: { value: 0, reason: null } } },
    { school_id: "B", active: false, measures: {} },
  ],
  findings: [{ rule: "vinculo-sem-inicio-efetivo", rule_version: 1, school_id: "A", count: 3 }, { rule: "vinculo-em-escola-sem-cadastro-vigente", rule_version: 1, school_id: "B", count: 1 }],
  domains_unavailable: [],
};

describe("Censo por domínio", () => {
  it("regras caem no domínio certo", () => {
    expect(ruleDomain("enturmacao-simultanea")).toBe("alunos");
    expect(ruleDomain("enturmacao-em-turma-de-outra-escola-ou-ano")).toBe("turmas");
    expect(ruleDomain("vinculo-em-escola-sem-cadastro-vigente")).toBe("escolas");
  });
  it("desconhecido conta como desconhecido; zero lido conta como conhecido", () => {
    const cov = Object.fromEntries(domainCoverage(snap).map((d) => [d.domain, d]));
    expect(cov["profissionais"]).toMatchObject({ known: 1, unknown: 1 });
    expect(cov["alunos"]).toMatchObject({ known: 1, findings: 3 });
    expect(cov["escolas"]).toMatchObject({ known: 1, unknown: 1, findings: 1 });
  });
  it("relatório mostra nome, nunca o identificador, e ausência como 'não disponível'", () => {
    const rows = snapshotReportRows(snap, new Map([["A", "EM Alfa"]]));
    expect(rows[0]).toMatchObject({ escola: "EM Alfa", enturmacoes_vigentes: null, lotacoes_profissionais: 0, inconsistencias: 3 });
    expect(rows[1]!["escola"]).toBe("Escola sem nome registrado");
    const csv = toCsv(runReport(CENSUS_SNAPSHOT_REPORT, { params: {} }, rows), { headerLines: [], title: "t" });
    expect(csv).toMatch(/não disponível/);
  });
  it("mesmo arquivo (hash) é reconhecido como repetido", () => {
    expect(isRepeatedImport([{ source_sha256: "ab" }], "ab")).toBe(true);
    expect(isRepeatedImport([{ source_sha256: "ab" }], "cd")).toBe(false);
  });
  it("reconciliação preserva valor ausente da fonte como nulo", () => {
    const r = reconciliationRows([{ school_id: "A", measure: "turmas", sigem_value: 2, sigem_reason: null, source_value: null, category: "ausente-na-fonte" }], new Map(), {}, {});
    expect(r[0]).toMatchObject({ sigem: 2, fonte: null });
  });
});
