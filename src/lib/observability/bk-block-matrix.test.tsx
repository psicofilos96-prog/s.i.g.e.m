// BO.5 / BK — matriz código canônico real → categoria → mensagem pt-BR na tela, com código interno preservado.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { categorize, governError, userErrorText } from "./governed-errors";
import { ErrorState } from "@/components/sigem/states";

// Mensagens no formato real dos writers (P0001 `dominio:codigo`), extraídas das migrations.
const MATRIX: ReadonlyArray<[caso: string, raw: string, cat: string]> = [
  ["capability ausente", "capability:manter-grade-da-turma", "autorizacao"],
  ["capability ausente (genérica)", "assessment:capability-missing", "autorizacao"],
  ["revogada sem logout (sessão sem atuação)", "engagement:not-authorized", "autorizacao"],
  ["família inexistente/revogada", "family:not-authorized", "autorizacao"],
  ["IDOR estudante outra escola", "enrollment:student-not-in-school", "autorizacao"],
  ["IDOR turma outra escola", "allocation:class-other-school", "autorizacao"],
  ["período fechado", "assessment:period-closed", "registro-fechado"],
  ["ciclo fechado", "cycle:cycle-closed", "registro-fechado"],
  ["versão fechada", "schedule:block-after-version-closed", "registro-fechado"],
  ["stale/base desatualizada", "matrix:base-superseded", "conflito"],
  ["stale head", "calendar:stale-head", "conflito"],
  ["base desconhecida", "journey:base-unknown", "conflito"],
  ["regra institucional ausente", "closing:rule-required", "dependencia-normativa"],
  ["regra não homologada", "assessment:value-not-homologated", "dependencia-normativa"],
  ["INSTITUTIONAL_RULE (BK)", "ASSESSMENT_RULE_PENDING", "dependencia-normativa"],
  ["OFFICIAL_SOURCE_PENDING (BK)", "EDUCACENSO_LAYOUT_BLOCKED_BY_OFFICIAL_SOURCE", "fonte-ausente"],
  ["OFFICIAL_SOURCE_PENDING (writer)", "nutrition:inventory-catalog-pending", "fonte-ausente"],
  ["UNAVAILABLE", "year:year-unavailable", "indisponivel"],
  ["UNAVAILABLE (rede)", "TypeError: fetch failed", "indisponivel"],
  ["UNKNOWN", "XX000 relation public.institutional_students does not exist at function foo()", "falha-tecnica"],
];

describe("BK — bloqueios canônicos por tela", () => {
  it.each(MATRIX)("%s", (_caso, raw, cat) => {
    const err = new Error(raw);
    expect(categorize(err)).toBe(cat);
    const g = governError(err);
    expect(g.technical.length).toBeGreaterThan(0);
    const { unmount } = render(<ErrorState description={userErrorText(err)} />);
    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).toMatch(/Código: op-[0-9a-f]{12}/);
    expect(text).not.toMatch(/public\.|function|relation|P0001|XX000|stack|TypeError|:[a-z]+-[a-z]/);
    unmount();
  });

  it("código interno preservado para telemetria", () => {
    expect(governError(new Error("capability:manter-grade-da-turma")).code).toBe("capability:manter-grade-da-turma");
    expect(governError(new Error("ASSESSMENT_RULE_PENDING")).code).toBe("ASSESSMENT_RULE_PENDING");
  });

  it("código BK mostra a dependência específica do registro", () => {
    expect(governError(new Error("ASSESSMENT_RULE_PENDING")).userMessage).toMatch(/regra homologada/);
  });

  it("IDOR e inexistente respondem igual (sem enumeração)", () => {
    expect(governError(new Error("family:not-authorized")).userMessage).toBe(governError(new Error("enrollment:student-not-in-school")).userMessage);
  });
});
