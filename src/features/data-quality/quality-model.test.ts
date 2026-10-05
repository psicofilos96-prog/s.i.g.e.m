import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { detect, evidenceHash, filterInbox, inbox, severityOf, SEVERITY_UNCONFIGURED, QUALITY_RULES, type QualityInputs, type ReviewEvent } from "./quality-model";

const base: QualityInputs = { schoolId: "s1", validOn: "2027-03-01", classes: [], calendars: 1, enrollments: [], allocations: [], positions: [], assignments: [], engagementFacts: [], documents: [], imports: [] };
const T = "2027-03-01T10:00:00Z";
const ev = (p: Partial<ReviewEvent>): ReviewEvent => ({ id: "e1", fingerprint: "", evidenceSha256: "", ruleId: "turma-sem-matriz", ruleVersion: 1, schoolId: "s1", state: "revisado", reason: "ok", supersedesId: null, recordedAt: T, ...p });

describe("detectores — falsos positivos", () => {
  it("dados íntegros não geram achado", () => {
    const d = detect({ ...base, classes: [{ classId: "c1", record: true, matrix: "resolvida", journey: true, schedule: true }] }, T);
    expect(d.findings).toEqual([]); expect(d.unverifiable).toEqual([]);
  });
  it("fonte não lida ⇒ não verificável, nunca achado", () => {
    const d = detect({ ...base, classes: null, enrollments: null, imports: null, documents: null }, T);
    expect(d.findings).toEqual([]);
    expect(d.unverifiable).toEqual(expect.arrayContaining(["turma-sem-matriz", "calendario-ausente", "matricula-concorrente", "importacao-com-divergencia"]));
  });
  it("turma não registrada na data não exige matriz nem calendário", () => {
    expect(detect({ ...base, calendars: 0, classes: [{ classId: "c1", record: false, matrix: "ausente", journey: false, schedule: true }] }, T).findings).toEqual([]);
  });
  it("posição só é achado quando a correspondência é exigida", () => {
    const d = detect({ ...base, positions: [{ allocationId: "a1", positionKey: "p", correspondenceRequired: false, correspondenceResolved: false },
      { allocationId: "a2", positionKey: "p", correspondenceRequired: null, correspondenceResolved: false }] }, T);
    expect(d.findings).toEqual([]);
  });
  it("matrículas sucessivas (sem sobreposição) não são concorrentes", () => {
    const d = detect({ ...base, enrollments: [{ enrollmentId: "m1", studentId: "x", validFrom: "2027-01-01", validUntil: "2027-02-01" },
      { enrollmentId: "m2", studentId: "x", validFrom: "2027-02-02", validUntil: null }] }, T);
    expect(d.findings).toEqual([]);
  });
  it("lote descartado não é divergência aberta", () => {
    expect(detect({ ...base, imports: [{ batchId: "b", conflictRows: 3, closed: true }] }, T).findings).toEqual([]);
  });
});

describe("detectores — achados objetivos", () => {
  it("cada invariante gera evidência e link", () => {
    const d = detect({ ...base, calendars: 2,
      classes: [{ classId: "c1", record: true, matrix: "ambigua", journey: false, schedule: true }],
      enrollments: [{ enrollmentId: "m1", studentId: "x", validFrom: "2027-01-01", validUntil: null }, { enrollmentId: "m2", studentId: "x", validFrom: "2027-02-01", validUntil: null }],
      allocations: [{ allocationId: "a1", studentId: "x", participationActive: false }],
      positions: [{ allocationId: "a1", positionKey: "p", correspondenceRequired: true, correspondenceResolved: false }],
      assignments: [{ assignmentId: "r1", classId: "c1", componentApplicable: false }],
      engagementFacts: [{ factKind: "regencia", factId: "f1", engagementId: "e1", factValidFrom: "2027-03-02", engagementValidUntil: "2027-03-01" }],
      documents: [{ emissionId: "d1", sourceKind: "situacao", sourceId: "s", versionAtEmission: 1, currentVersion: 2 }],
      imports: [{ batchId: "b", conflictRows: 1, closed: false }] }, T);
    expect(new Set(d.findings.map((f) => f.ruleId))).toEqual(new Set(QUALITY_RULES.map((r) => r.id)));
    for (const f of d.findings) expect(QUALITY_RULES.find((r) => r.id === f.ruleId)!.fix(f.evidence)).toMatch(/^\//);
  });
  it("deduplica mesma regra+entidade", () => {
    const d = detect({ ...base, imports: [{ batchId: "b", conflictRows: 1, closed: false }, { batchId: "b", conflictRows: 1, closed: false }] }, T);
    expect(d.findings).toHaveLength(1);
  });
  it("severidade só quando configurada", () => {
    expect(severityOf(SEVERITY_UNCONFIGURED, "turma-sem-matriz")).toBeNull();
    expect(severityOf({ "turma-sem-matriz": "bloqueante" }, "turma-sem-matriz")).toBe("bloqueante");
  });
  it("nenhuma regra pedagógica sobre nota ou frequência", () => {
    expect(QUALITY_RULES.some((r) => /nota|frequ[eê]ncia|desempenho/i.test(r.id + r.label))).toBe(false);
  });
});

describe("estado derivado — revisão, resolução, reabertura", () => {
  const f = detect({ ...base, imports: [{ batchId: "b", conflictRows: 1, closed: false }] }, T).findings[0]!;
  it("sem revisão ⇒ aberto; revisão da mesma evidência ⇒ revisado", async () => {
    const h = await evidenceHash(f.evidence);
    expect(inbox([f], new Map([[f.fingerprint, h]]), [])[0]!.state).toBe("aberto");
    expect(inbox([f], new Map([[f.fingerprint, h]]), [ev({ fingerprint: f.fingerprint, evidenceSha256: h, ruleId: f.ruleId })])[0]!.state).toBe("revisado");
  });
  it("evidência nova reabre a dispensa", async () => {
    const h = await evidenceHash(f.evidence);
    const it0 = inbox([f], new Map([[f.fingerprint, h]]), [ev({ fingerprint: f.fingerprint, evidenceSha256: "0".repeat(64), state: "dispensado", ruleId: f.ruleId })])[0]!;
    expect(it0.state).toBe("aberto"); expect(it0.evidenceChanged).toBe(true);
  });
  it("reabertura explícita volta a aberto; cabeça segue a cadeia", async () => {
    const h = await evidenceHash(f.evidence);
    const evs = [ev({ id: "1", fingerprint: f.fingerprint, evidenceSha256: h, ruleId: f.ruleId }), ev({ id: "2", supersedesId: "1", state: "reaberto", fingerprint: f.fingerprint, evidenceSha256: h, ruleId: f.ruleId, recordedAt: "2027-01-01T00:00:00Z" })];
    expect(inbox([f], new Map([[f.fingerprint, h]]), evs)[0]!.state).toBe("aberto");
  });
  it("fato corrigido na fonte ⇒ resolvido (sem ação na central)", () => {
    const items = inbox([], new Map(), [ev({ fingerprint: f.fingerprint, ruleId: f.ruleId })]);
    expect(items[0]!.state).toBe("resolvido");
  });
  it("evidência é canônica (ordem das chaves não importa)", async () => {
    expect(await evidenceHash({ a: 1, b: "x" })).toBe(await evidenceHash({ b: "x", a: 1 }));
  });
  it("filtro por setor e estado", () => {
    const items = inbox([f], new Map(), []);
    expect(filterInbox(items, { sector: "importacao", states: ["aberto"] })).toHaveLength(1);
    expect(filterInbox(items, { sector: "secretaria" })).toHaveLength(0);
  });
});

describe("persistência e permissão", () => {
  const sql = readdirSync("drizzle/migrations").filter((n) => n.includes("data_quality")).map((n) => readFileSync(`drizzle/migrations/${n}`, "utf8")).join("\n");
  it("ledger append-only, sem anon, writer com capability e cabeça esperada", () => {
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.data_quality_review_events/);
    expect(sql).toMatch(/REVOKE ALL ON public\.data_quality_review_events FROM anon, PUBLIC/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*data_quality_review_events[^;]*authenticated/);
    expect(sql).toMatch(/data-quality:capability-missing/); expect(sql).toMatch(/data-quality:stale-head/);
    expect(sql).toMatch(/SET search_path = ''/);
  });
  it("o motor não escreve em tabelas de fatos", () => {
    const src = readFileSync("src/features/data-quality/quality-source.ts", "utf8");
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });
});
