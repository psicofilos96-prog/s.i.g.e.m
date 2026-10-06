import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { eventValueText, parseTrajectory, trajectoryRows, FICHA_LONGITUDINAL } from "./student-trajectory-source";
import { reportById } from "@/features/reports/report-registry";
import { runReport } from "@/features/reports/report-engine";

const ok = (events: unknown[], domains: Record<string, string> = {}) => ({
  result: "ok", student_id: "s", as_of: "2027-05-01", known_at: "x",
  domains: { matricula: "com-fatos", alocacao: "com-fatos", movimentacao: "sem-fatos-legiveis", frequencia: "com-fatos", avaliacao: "com-fatos", fechamento: "sem-fatos-legiveis", acompanhamento: "nao-autorizado", ...domains },
  events, alerts: { state: "bloqueado-sem-regra-homologada", items: [] },
});

describe("AB.2 ficha longitudinal", () => {
  it("access-denied é uniforme e formato desconhecido é indisponível", () => {
    expect(parseTrajectory({ result: "access-denied" })).toEqual({ result: "access-denied" });
    expect(parseTrajectory(null).result).toBe("unavailable");
    expect(parseTrajectory({ result: "ok?" }).result).toBe("unavailable");
  });
  it("ordena por data, descarta evento sem proveniência e domínio desconhecido", () => {
    const t = parseTrajectory(ok([
      { domain: "frequencia", on: "2027-03-08", source: "attendance_record_versions", source_id: "a", mark: null },
      { domain: "matricula", on: "2027-02-01", source: "school_enrollments", source_id: "m" },
      { domain: "frequencia", on: "2027-02-08", source: null, source_id: "x" },
      { domain: "diagnostico", on: "2027-02-08", source: "y", source_id: "z" },
    ]));
    if (t.result !== "ok") throw new Error();
    expect(t.events.map((e) => e.sourceId)).toEqual(["m", "a"]);
  });
  it("pendente ≠ falta e zero real ≠ ausência", () => {
    const t = parseTrajectory(ok([
      { domain: "frequencia", on: "2027-03-08", source: "s", source_id: "1", mark: null },
      { domain: "avaliacao", on: "2027-03-10", source: "s", source_id: "2", value: { kind: "numerica", value: 0 } },
      { domain: "avaliacao", on: "2027-03-11", source: "s", source_id: "3", value: null },
    ]));
    if (t.result !== "ok") throw new Error();
    expect(t.events.map(eventValueText)).toEqual(["Sem marcação (pendente)", "0", "Sem resultado registrado"]);
  });
  it("domínio sem estado reconhecido nunca vira 'com-fatos' nem zero", () => {
    const t = parseTrajectory(ok([], { fechamento: "???" }));
    if (t.result !== "ok") throw new Error();
    expect(t.domains.fechamento).toBe("sem-fatos-legiveis");
  });
  it("exportação está no catálogo comum e não leva nome nem texto livre", () => {
    expect(reportById(FICHA_LONGITUDINAL.id)).toBe(FICHA_LONGITUDINAL);
    const t = parseTrajectory(ok([{ domain: "acompanhamento", on: "2026-09-01", source: "school_pedagogical_records", source_id: "r", label: "Registro", body: "segredo", display_name: "Fulano" }]));
    const res = runReport(FICHA_LONGITUDINAL, { params: { asOf: "2027-05-01" } }, trajectoryRows(t));
    expect(JSON.stringify(res)).not.toMatch(/segredo|Fulano/);
    expect(trajectoryRows({ result: "access-denied" })).toEqual([]);
  });
  it("alertas permanecem bloqueados sem regra homologada", () => {
    const t = parseTrajectory(ok([]));
    if (t.result !== "ok") throw new Error();
    expect(t.alertsState).toBe("bloqueado-sem-regra-homologada");
  });
  it("migrations AB.2: reader e writers sem EXECUTE para anon/service_role; catálogo compara 'homologada'", () => {
    const dir = "drizzle/migrations";
    const all = readdirSync(dir).filter((f) => /^015[3-6]/.test(f)).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
    expect(all).toMatch(/REVOKE[^;]*student_trajectory_at[^;]*anon/i);
    const fixes = readdirSync(dir).filter((f) => /^015[56]/.test(f)).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
    expect(fixes).not.toMatch(/d\.status = 'homologado'/);
    expect(fixes).toMatch(/school_followup_grant_on\('registrar-acompanhamento-pedagogico'/);
    expect(all).not.toMatch(/GRANT[^;]*record_school_pedagogical_record[^;]*(anon|service_role)/i);
  });
});
