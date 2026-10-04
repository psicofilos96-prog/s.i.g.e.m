/**
 * B4.10.0f — roster institucional preservando participações independentes.
 * Reais: readers B3 (cycle-enrollment-source), readInstitutionalRoster, projectInstitutionalChains,
 * studentsForClassOn, allocationWindows, attendanceBlocker (fragmento roster-chain). Simulado: cliente do backend
 * (RPCs `*_at` devolvem cabeças conforme o contrato SQL 0001/0003; a fonte não recompõe cabeça).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const m = vi.hoisted(() => ({
  students: [] as Row[],
  rpc: {} as Record<string, Row[]>,
  rpcArgs: [] as { fn: string; args: Record<string, unknown> }[],
}));
vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const data = table === "institutional_students" ? m.students : table === "institutional_schools" ? [{ id: "esc" }] : [];
    const b: Record<string, unknown> = {};
    for (const k of ["select", "in", "order", "eq", "lte", "limit"]) b[k] = () => b;
    b["then"] = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok);
    return b;
  };
  return {
    supabase: {
      from,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        m.rpcArgs.push({ fn, args });
        return { data: m.rpc[fn] ?? [], error: null };
      },
    },
  };
});

import { readInstitutionalRoster, applyInstitutionalRoster, rosterChainDiagnostics, resetInstitutionalRoster } from "./institutional-roster";
import { setDiaryPersistenceMode as setMode } from "@/features/diary/diary-persistence-mode";
import { setDiarySessionState } from "@/features/diary/diary-session-state";
const setDiaryPersistenceMode = (x: "cloud" | "laboratorio") => {
  if (x === "cloud") setDiarySessionState({ phase: "pronto", key: "u#1@" + "2026-03-10", userId: "u", reference: { validOn: "2026-03-10", knownAt: "2026-03-10T12:00:00.000000Z", source: "informada", operationalToday: "2026-03-10" } });
  else setDiarySessionState({ phase: "sem-fronteira", key: null, userId: null });
  setMode(x);
};
import { studentsForClassOn } from "@/features/diary/diary-data";
import { allocationWindows } from "@/features/diary/attendance-closing";
import { demonstrationStudents } from "./students-data";

const K = "2026-03-10T12:00:00.000000Z";
const ON = "2026-03-10";
const enr = (o: Partial<Row> = {}) => ({ id: "e-v1", logical_id: "e", student_id: "s1", school_id: "esc", academic_year_id: "a", opened_on: "2026-01-01", ended_on: null, institutional_number: null, ending_reason: null, created_at: K, ...o });
const part = (o: Partial<Row> = {}) => ({ id: "p-v1", logical_id: "p", version: 1, supersedes_id: null, enrollment_logical_id: "e", student_id: "s1", school_id: "esc", nature_scheme_id: "natureza", nature_value_id: "regular-x", nature_version: 3, valid_from: "2026-01-01", valid_until: null, annulled: false, created_at: K, ...o });
const alloc = (o: Partial<Row> = {}) => ({ id: "a-v1", logical_id: "a", participation_logical_id: "p", enrollment_id: "e-v1", student_id: "s1", school_id: "esc", class_id: "t1", valid_from: "2026-01-01", ended_on: null, ending_reason: null, created_at: K, ...o });
const set = (e: Row[], p: Row[], a: Row[]) => { m.rpc = { cycle_enrollments_at: e, cycle_participations_at: p, class_allocations_at: a }; };
const read = (validOn = ON) => readInstitutionalRoster({ validOn, knownAt: K });

beforeEach(() => {
  m.students = [{ id: "s1", display_name: "Ana", institutional_identifier: null }, { id: "s2", display_name: "Bia", institutional_identifier: null }];
  m.rpcArgs = [];
  set([], [], []);
  resetInstitutionalRoster();
  setDiaryPersistenceMode("laboratorio");
});

describe("B4.10.0f — cadeia inscrição → participação → alocações", () => {
  it("participação sem alocação continua visível, com vigência e natureza próprias", async () => {
    set([enr()], [part({ valid_from: "2026-02-01" })], []);
    const [s] = await read();
    const p = s!.enrollments[0]!.academicLinks[0]!.participations;
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ id: "p", versionId: "p-v1", validFrom: "2026-02-01", allocations: [], nature: null, natureRef: { schemeId: "natureza", valueId: "regular-x", version: 3 } });
    expect(s!.enrollments[0]!.academicLinks[0]!.presentationGroupingOnly).toBe(true);
  });

  it("mesma participação com 2 episódios: uma participação, duas alocações, histórico preservado", async () => {
    set([enr()], [part()], [alloc({ id: "a1", logical_id: "a1", class_id: "t-antiga", ended_on: "2026-02-01" }), alloc({ id: "a2", logical_id: "a2", class_id: "t1", valid_from: "2026-02-02" })]);
    const [s] = await read();
    const ps = s!.enrollments[0]!.academicLinks.flatMap((l) => l.participations);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.allocations.map((a) => [a.id, a.situation])).toEqual([["a1", "Encerrada"], ["a2", "Vigente"]]);
    expect(s!.currentClassId).toBe("t1");
  });

  it("regular + AEE distintos: duas participações, nenhuma dominante, natureza não mapeada", async () => {
    set([enr()], [part(), part({ id: "q-v1", logical_id: "q", nature_value_id: "aee-y" })],
      [alloc(), alloc({ id: "b-v1", logical_id: "b", participation_logical_id: "q", class_id: "t-aee" })]);
    setDiaryPersistenceMode("cloud");
    applyInstitutionalRoster(await read());
    const ps = (await read())[0]!.enrollments[0]!.academicLinks[0]!.participations;
    expect(ps.map((p) => [p.id, p.natureValueId, p.nature])).toEqual([["p", "regular-x", null], ["q", "aee-y", null]]);
    expect(studentsForClassOn("t1", ON).map((x) => x.participation.id)).toEqual(["p"]);
    expect(studentsForClassOn("t-aee", ON).map((x) => x.participation.id)).toEqual(["q"]);
    const [s] = await read();
    expect([s!.currentSituation, s!.currentClassId]).toEqual(["Várias alocações vigentes na data", null]);
  });

  it("vigência da participação é a dela, não a da alocação; cadeia inteira decide a lista da turma", async () => {
    set([enr()], [part({ valid_from: "2026-01-01", valid_until: "2026-03-05" })], [alloc({ valid_from: "2026-01-10", ended_on: null })]);
    setDiaryPersistenceMode("cloud");
    const r = await read();
    applyInstitutionalRoster(r);
    const p = r[0]!.enrollments[0]!.academicLinks[0]!.participations[0]!;
    expect([p.validFrom, p.validUntil, p.allocations[0]!.from, p.allocations[0]!.until]).toEqual(["2026-01-01", "2026-03-05", "2026-01-10", null]);
    expect(studentsForClassOn("t1", "2026-03-01")).toHaveLength(1);
    expect(studentsForClassOn("t1", ON)).toHaveLength(0); // participação encerrada não autoriza a alocação
    expect(allocationWindows(r[0]!, "t1")).toEqual([{ from: "2026-01-10", until: "2026-03-05" }]);
  });

  it("abertura ausente da inscrição não vira vigência; inscrição encerrada não autoriza filho", async () => {
    setDiaryPersistenceMode("cloud");
    set([enr({ opened_on: null })], [part()], [alloc()]);
    let r = await read(); applyInstitutionalRoster(r);
    expect(studentsForClassOn("t1", ON)).toHaveLength(0);
    expect(allocationWindows(r[0]!, "t1")).toEqual([]);
    set([enr({ ended_on: "2026-02-01" })], [part()], [alloc()]);
    r = await read(); applyInstitutionalRoster(r);
    expect(studentsForClassOn("t1", ON)).toHaveLength(0);
    expect(studentsForClassOn("t1", "2026-01-15")).toHaveLength(1);
  });

  it("nova cabeça da inscrição não perde o vínculo lógico (alocação guarda versão antiga)", async () => {
    set([enr({ id: "e-v2" })], [part()], [alloc({ enrollment_id: "e-v1" })]);
    const [s] = await read();
    expect(s!.enrollments[0]!).toMatchObject({ id: "e", versionId: "e-v2" });
    expect(s!.enrollments[0]!.academicLinks[0]!.participations[0]!.allocations).toHaveLength(1);
    expect(s!.chainDiagnostics).toBeUndefined();
  });

  it("pai ausente, de outro aluno ou de outra escola: diagnóstico, nunca relação válida", async () => {
    set([enr(), enr({ id: "e2-v1", logical_id: "e2", student_id: "s2" })],
      [part({ id: "x", logical_id: "orfa", enrollment_logical_id: "nao-legivel" }), part({ id: "y", logical_id: "outro", enrollment_logical_id: "e2" }), part({ id: "z", logical_id: "escola", school_id: "outra" })],
      [alloc({ participation_logical_id: "orfa" }), alloc({ id: "c", logical_id: "c", participation_logical_id: "p" })]);
    const r = await read();
    expect(r.chainDiagnostics.map((d) => [d.code, d.record.logicalId]).sort()).toEqual([
      ["allocation:parent-unreadable", "a"], ["allocation:parent-unreadable", "c"],
      ["participation:parent-mismatch", "escola"], ["participation:parent-mismatch", "outro"], ["participation:parent-unreadable", "orfa"],
    ]);
    expect(r.flatMap((s) => s.enrollments.flatMap((e) => e.academicLinks.flatMap((l) => l.participations)))).toEqual([]);
  });

  it("cabeça duplicada para o mesmo logical_id: recusa o lote, sem escolher", async () => {
    set([enr()], [part(), part({ id: "p-v2" })], []);
    await expect(read()).rejects.toThrow(/participation:duplicate-head/);
    set([enr(), enr({ id: "e-v2" })], [], []);
    await expect(read()).rejects.toThrow(/enrollment:duplicate-head/);
    set([enr()], [part()], [alloc(), alloc({ id: "a-v2" })]);
    await expect(read()).rejects.toThrow(/allocation:duplicate-head/);
  });

  it("episódio legado sem participação: diagnóstico com evidência, turma sem chamada, nada inventado", async () => {
    set([enr()], [part()], [alloc(), alloc({ id: "leg", logical_id: "leg", participation_logical_id: null, student_id: "s2", class_id: "t1" })]);
    setDiaryPersistenceMode("cloud");
    const r = await read();
    applyInstitutionalRoster(r);
    expect(rosterChainDiagnostics()).toEqual([expect.objectContaining({ code: "allocation:legacy-without-participation", studentId: "s2", classId: "t1", evidence: { from: "2026-01-01", until: null } })]);
    expect(studentsForClassOn("t1", ON).map((x) => x.student.id)).toEqual(["s1"]);
    expect(r[1]!.enrollments).toEqual([]);
    expect(r[1]!.chainDiagnostics).toHaveLength(1);
  });

  it("knownAt único e validOn:null (histórico) chegam aos três readers", async () => {
    await read("2025-06-01");
    const b3 = m.rpcArgs.filter((c) => /_at$/.test(c.fn));
    expect(b3.map((c) => c.fn).sort()).toEqual(["class_allocations_at", "cycle_enrollments_at", "cycle_participations_at"]);
    for (const c of b3) expect([c.args["_valid_on"], c.args["_known_at"]]).toEqual([null, K]);
  });

  it("laboratório preservado: sem sessão a lista é a demonstrativa e nenhum diagnóstico existe", () => {
    expect(rosterChainDiagnostics()).toEqual([]);
    expect(demonstrationStudents.length).toBeGreaterThan(0);
  });
});
