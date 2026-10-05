/** 14.10.1 + 14.11 — nenhuma adulteração do cliente alcança a versão oficial; Mapas antigos preservam a versão da competência. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { assembleMapSnapshot, snapshotFingerprint, verifyOfficialization, type AssemblyInput, type MapCompetenceRule, type MapSnapshot } from "./map-domain";
import { episodeFacts } from "@/features/ciece/fact-adapters";
import type { IndicatorDefinition } from "@/features/ciece/indicator-engine";
import type { SchoolUnit, SchoolRecordVersion } from "@/features/schools/school-registry";

const def: IndicatorDefinition = { id: "mapa-matricula", version: 1, label: "Matrícula", status: "homologada", factTypeId: "episodio-de-enturmacao", subjectKey: "studentId",
  populationCriteria: {}, temporal: { kind: "fotografia" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "estudantes" };
const rule: MapCompetenceRule = { id: "r", version: 1, status: "homologada", homologationActRef: "ato", validFrom: "2026-01-01", validUntil: null,
  definition: { coveredSchoolIds: ["e1"], snapshotDate: { kind: "dia-do-mes", day: 15 }, cells: [{ cellId: "matricula", sectionId: "turmas", label: "Matrícula", definition: def }], blockingCellIds: [], schoolLeadershipEngagementKindIds: ["direcao-escolar"] } };
const ver = (n: number, from: string, o: Partial<SchoolRecordVersion> = {}): SchoolRecordVersion => ({ id: `v${n}`, schoolId: "e1", versionNumber: n, supersedesVersionId: n > 1 ? `v${n - 1}` : null,
  officialName: "Escola", address: "Rua A", district: "Centro", locationKind: "urbana", active: true, validFrom: from, originatingActRef: null, ...o });
const unit = (versions: SchoolRecordVersion[]): SchoolUnit => ({ schoolId: "e1", identifiers: [], versions });
const epi = (id: string) => ({ id, enrollment_id: `m-${id}`, student_id: `s-${id}`, school_id: "e1", class_id: "t1", class_label_snapshot: null, cycle_id: "c", valid_from: "2026-02-01", originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: null });
const lead = (id: string, from = "2026-01-01", until: string | null = null) => ({ engagementId: id, personId: `p-${id}`, personName: `Pessoa ${id}`, engagementKindId: "direcao-escolar", validFrom: from, validUntil: until, originatingActRef: "port-1" });
const input = (o: Partial<AssemblyInput> = {}): AssemblyInput => ({
  competence: { schoolId: "e1", year: 2026, month: 4 }, rule,
  schools: [unit([ver(1, "2020-01-01", { phone: "22 3822-0000", ownBuilding: true, hardAccess: false, classroomCount: 8 })])],
  classes: [{ id: "t1", name: "600" }], facts: episodeFacts([epi("a"), epi("b")] as never), observations: { text: "", eventId: null },
  leadership: [lead("d1")], ...o,
});
const cell = (s: MapSnapshot, id: string) => s.cells.find((c) => c.cellId === id)!;
const clone = (s: MapSnapshot): MapSnapshot => JSON.parse(JSON.stringify(s));

describe("14.10.1 oficialização só aceita a remontagem do servidor", () => {
  const rebuilt = assembleMapSnapshot(input());
  const fp = snapshotFingerprint(rebuilt);
  const ok = verifyOfficialization({ rebuilt, rule, conferredFingerprint: fp, clientExpectedFingerprint: fp, failedSources: [] });
  it("sem adulteração: grava exatamente a fotografia remontada", () => {
    expect(ok.ok && ok.snapshot).toBe(rebuilt);
  });
  const tamperings: [string, (s: MapSnapshot) => void][] = [
    ["valor", (s) => { cell(s, "matricula").value = 99; }],
    ["estado", (s) => { cell(s, "telefone").state = "ausente"; }],
    ["total", (s) => { cell(s, "matricula").coverage = { eligible: 99, observed: 99, complete: true }; }],
    ["turma", (s) => { cell(s, "turma:t1").label = "Turma 999"; }],
    ["classificação", (s) => { cell(s, "turma:t1").value = "etapa: medio"; }],
    ["turno", (s) => { cell(s, "turma:t1").value = "turno: noite"; }],
    ["proveniência", (s) => { cell(s, "nome-oficial").recordRefs = ["forjado:1@1"]; }],
    ["regra", (s) => { s.rule = { id: "outra", version: 9 }; }],
  ];
  for (const [what, mutate] of tamperings) {
    it(`adulteração de ${what} conferida pelo cliente não alcança a versão`, () => {
      const forged = clone(rebuilt); mutate(forged);
      const forgedFp = snapshotFingerprint(forged);
      expect(forgedFp).not.toBe(fp);
      // Cliente conferiu a marca forjada e envia-a como esperada: servidor remonta e recusa.
      const r = verifyOfficialization({ rebuilt, rule, conferredFingerprint: forgedFp, clientExpectedFingerprint: forgedFp, failedSources: [] });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("divergente-da-conferencia");
    });
  }
  it("marca vista desatualizada e fonte com falha também recusam", () => {
    expect(verifyOfficialization({ rebuilt, rule, conferredFingerprint: fp, clientExpectedFingerprint: "x", failedSources: [] }).ok).toBe(false);
    expect(verifyOfficialization({ rebuilt, rule, conferredFingerprint: fp, clientExpectedFingerprint: fp, failedSources: ["x"] }).ok).toBe(false);
  });
  it("arquitetura: o cliente não envia fotografia e o banco só aceita escrita do servidor", () => {
    const fn = readFileSync("src/features/statistical-map/statistical-map.functions.ts", "utf8");
    const off = fn.slice(fn.indexOf("export const officializeStatisticalMap"));
    expect(off.slice(0, off.indexOf(".handler"))).not.toMatch(/snapshot|cells|value/i);
    expect(off).toMatch(/_snapshot: check\.snapshot/);
    expect(fn).not.toMatch(/db\.rpc\("officialize_statistical_map"|db\.rpc\("record_map_conference"/);
    const dir = "supabase/migrations";
    const sql = readdirSync(dir).sort().map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
    const lastGrant = sql.slice(sql.lastIndexOf("officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid,text) FROM"));
    expect(lastGrant).toMatch(/FROM anon, public, authenticated/);
    expect(lastGrant).toMatch(/TO service_role/);
    expect(sql).toMatch(/act_as_verified_user/);
  });
});

describe("14.11 fontes novas no Mapa", () => {
  it("telefone, prédio, salas e difícil acesso vêm da versão cadastral; ausente ≠ não", () => {
    const s = assembleMapSnapshot(input());
    expect(cell(s, "telefone").value).toBe("22 3822-0000");
    expect(cell(s, "predio-proprio").value).toBe("Sim");
    expect(cell(s, "dificil-acesso").value).toBe("Não");
    expect(cell(s, "numero-de-salas").value).toBe("8");
    expect(cell(s, "email").state).toBe("ausente");
    expect(s.cells.every((c) => c.origin !== "sem-fonte" || !["telefone", "email", "predio-proprio", "dificil-acesso", "numero-de-salas", "anexos", "direcao"].includes(c.cellId))).toBe(true);
  });
  it("temporal: Mapa de abril mantém dados de abril depois de mudanças em maio", () => {
    const later = [ver(1, "2020-01-01", { phone: "antigo", classroomCount: 8, ownBuilding: true }), ver(2, "2026-05-10", { phone: "novo", classroomCount: 12, ownBuilding: false })];
    const abr = assembleMapSnapshot(input({ schools: [unit(later)], leadership: [lead("d1", "2025-01-01", "2026-04-30")] }));
    expect(cell(abr, "telefone").value).toBe("antigo");
    expect(cell(abr, "numero-de-salas").value).toBe("8");
    expect(cell(abr, "predio-proprio").value).toBe("Sim");
    expect(cell(abr, "direcao").value).toBe("Pessoa d1");
    const mai = assembleMapSnapshot(input({ competence: { schoolId: "e1", year: 2026, month: 5 }, schools: [unit(later)], leadership: [lead("d2", "2026-05-01")] }));
    expect(cell(mai, "telefone").value).toBe("novo");
    expect(cell(mai, "direcao").value).toBe("Pessoa d2");
  });
  it("direção: ausente, indeterminada com duas simultâneas, sem regra sem tipos declarados, nunca por cargo", () => {
    expect(cell(assembleMapSnapshot(input({ leadership: [] })), "direcao").state).toBe("ausente");
    const two = cell(assembleMapSnapshot(input({ leadership: [lead("a"), lead("b")] })), "direcao");
    expect(two.state).toBe("indeterminado"); expect(two.value).toBeNull();
    const noKinds = { ...rule, definition: { ...rule.definition, schoolLeadershipEngagementKindIds: [] } };
    expect(cell(assembleMapSnapshot(input({ rule: noKinds })), "direcao").state).toBe("sem-regra");
    const other = { ...lead("x"), engagementKindId: "professor" };
    expect(cell(assembleMapSnapshot(input({ leadership: [other] })), "direcao").state).toBe("ausente");
    expect(readFileSync("src/features/statistical-map/map-domain.ts", "utf8")).not.toMatch(/position_?label/i);
  });
  it("anexos: identidade própria, versão vigente, correção substitui sem apagar, nada por nome", () => {
    const annex: SchoolUnit = { schoolId: "e9", identifiers: [], versions: [{ ...ver(1, "2020-01-01", { address: "Estrada B", officialName: "Anexo Sítio" }), id: "a1", schoolId: "e9" }] };
    const l1 = { id: "l1", logicalLinkId: "L", version: 1, supersedesId: null, principalSchoolId: "e1", linkedSchoolId: "e9", linkKindId: "anexo", linkKindVersion: 1, validFrom: "2026-01-01", validUntil: null, originatingActRef: "ato" };
    const l2 = { ...l1, id: "l2", version: 2, supersedesId: "l1", validFrom: "2026-04-20" };
    const s = assembleMapSnapshot(input({ schools: [...input().schools, annex], links: [l1, l2] }));
    expect(cell(s, "anexos").state).toBe("ausente"); // versão vigente (l2) só vale a partir de 20/04
    const s2 = assembleMapSnapshot(input({ schools: [...input().schools, annex], links: [l1] }));
    expect(cell(s2, "anexos").value).toContain("Anexo Sítio — Estrada B");
  });
});
