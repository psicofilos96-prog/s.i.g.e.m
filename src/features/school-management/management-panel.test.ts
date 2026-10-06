import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { buildPanel, classifyError, managementRows, type Inputs } from "./management-panel";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const no = (error: string) => ({ ok: false as const, error });
const base = (): Inputs => ({
  school: "inep-1", year: "ano-x", on: "2027-03-10", knownAt: null, window: { from: "2027-02-08", to: "2027-03-10" },
  overview: ok({ year: { label: "2027", state: "operacional", starts_on: "2027-02-01", ends_on: "2027-12-20" }, enrollments: { total: 10, active: 8, not_started: 0, start_unknown: 0, ended: 2 }, allocations: { active_episodes: 8, classes_with_students: 2, enrollments_without_class: 1 }, movements: { transferencia: 2 } }),
  classes: ok([{ id: "c1", name: "1A" }, { id: "c2", name: "1B" }]), schedules: ok({ c1: true, c2: false }),
  diary: ok([{ result_kind: "lesson", attendance_version: 1, marked_count: 8, eligible_count: 8 }, { result_kind: "lesson", attendance_version: null, marked_count: null, eligible_count: null }]),
  plans: ok([{ result_kind: "plan" }]), attendanceClosings: ok(0), assessmentClosings: ok(1), followups: ok(3), documents: ok(0),
  communications: ok([{ state: "publicado" }, { state: "retificacao-em-rascunho" }, { state: "rascunho" }]),
  aee: ok([{ valid_from: "2027-02-01", valid_to: null, event_kind: "inicio" }]), meals: ok(0),
});
const by = (i: Inputs) => { const r = buildPanel(i); return { ...r, b: Object.fromEntries(r.blocks.map((x) => [x.id, x])) }; };

describe("AK — Estação da Direção", () => {
  it("escola com fontes disponíveis: estados e pendências explicáveis", () => {
    const { b, pending } = by(base());
    expect(b.matriculas!.state).toBe("AVAILABLE"); expect(b.matriculas!.value).toBe(8);
    expect(b.grade!.value).toBe(1); expect(b.diario!.value).toBe(2); expect(b.comunicacao!.value).toBe(2);
    expect(b["fechamento-frequencia"]!.state).toBe("ZERO");
    expect(pending.map((p) => p.id).sort()).toEqual(["aula-sem-frequencia", "comunicado-correcao", "grade-c2", "sem-turma"].sort());
  });
  it("alimentação sem informação é UNKNOWN, nunca zero", () => {
    const { b } = by(base());
    expect(b.alimentacao!.state).toBe("UNKNOWN"); expect(b.alimentacao!.value).toBeNull();
  });
  it("matrícula sem início efetivo torna ativas desconhecidas", () => {
    const i = base(); if (i.overview.ok) i.overview.data.enrollments.start_unknown = 3;
    const { b, pending } = by(i);
    expect(b.matriculas!.state).toBe("UNKNOWN"); expect(b.matriculas!.value).toBeNull();
    expect(pending.some((p) => p.id === "matricula-sem-inicio")).toBe(true);
  });
  it("ano sem estado fica BLOQUEADO e não é aberto", () => {
    const i = base(); if (i.overview.ok) i.overview.data.year.state = null;
    expect(by(i).b.ano!.state).toBe("BLOCKED");
  });
  it("Direção sem capability / outra escola: tudo indisponível, nada vira zero", () => {
    const i: Inputs = { ...base(), overview: no("secretariat:not-authorized"), classes: no("permission denied for table"), schedules: no("x"),
      diary: ok([{ result_kind: "access-denied", attendance_version: null, marked_count: null, eligible_count: null }]), plans: ok([{ result_kind: "access-denied" }]),
      attendanceClosings: no("permission denied"), assessmentClosings: no("permission denied"), followups: no("capability:x"), documents: no("42501"),
      communications: no("capability:consultar-comunicacao-escolar"), aee: no("not-authorized"), meals: no("not-authorized") };
    const { blocks } = by(i);
    expect(blocks.every((x) => x.state === "UNAVAILABLE" && x.value === null)).toBe(true);
  });
  it("falha técnica é UNKNOWN com pendência de fonte", () => {
    expect(classifyError("network timeout")).toBe("UNKNOWN");
    const i = { ...base(), documents: no("network timeout") };
    expect(by(i).pending.some((p) => p.id === "falha-documentos")).toBe(true);
  });
  it("links de drill-down apontam para rotas existentes", () => {
    const { blocks, pending } = by(base());
    for (const l of new Set([...blocks, ...pending].map((x) => x.link))) expect(existsSync(`src/routes${l === "/diario" ? "/diario.tsx" : `${l}.tsx`}`) || existsSync(`src/routes${l}.index.tsx`)).toBe(true);
  });
  it("relatório marca reprodução temporal por fonte", () => {
    const rows = managementRows(by(base()).blocks);
    expect(rows.find((r) => r.block.startsWith("Matrículas"))!.knownAt).toMatch(/não/);
  });
  it("nenhuma escrita indireta: a fonte só lê", () => {
    const src = readFileSync("src/features/school-management/management-source.ts", "utf8");
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(src).not.toMatch(/rpc\("record_|rpc\("register_|rpc\("apply_/);
  });
});
