import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { linkEligible, occupied, place, requestProblems, reviewProblems, waitlistOrder, type Request } from "./enrollment-flow";

const r = (id: string, o: Partial<Request> = {}): Request => ({ id, personId: `p-${id}`, authorPerson: `p-${id}`, mode: "individual",
  requestedAt: `2026-02-0${id.length}`, priority: null, reviewed: "deferida", placement: null, ended: false, ...o });

describe("L10 inscrição", () => {
  it("vínculo: só cabeça vigente no início da turma", () => {
    expect(linkEligible({ id: "l", validFrom: "2025-01-01", validUntil: null, superseded: false }, "2026-03-01")).toBe(true);
    expect(linkEligible({ id: "l", validFrom: "2025-01-01", validUntil: "2026-02-01", superseded: false }, "2026-03-01")).toBe(false);
    expect(linkEligible({ id: "l", validFrom: "2025-01-01", validUntil: null, superseded: true }, "2026-03-01")).toBe(false);
    expect(linkEligible(null, "2026-03-01")).toBe(false);
  });
  it("pedido individual de terceiro, turma fechada e pré-requisito faltante são recusados", () => {
    const p = requestProblems({ mode: "individual", personId: "a", sessionPerson: "b", schoolCapability: false, classState: "planejada",
      link: null, classStartsOn: "2026-03-01", missingPrerequisites: 1 });
    expect(p).toHaveLength(4);
  });
  it("quem pediu não analisa", () => expect(reviewProblems("p-a", r("a"), "Atende ao público da turma").join()).toMatch(/próprio/));
  it("concorrência: 5 colocações sequenciais sob lock nunca passam de 3 vagas", () => {
    let reqs = ["a", "b", "c", "d", "e"].map((x) => r(x));
    for (const x of reqs.map((q) => q.id)) {
      const res = place(reqs, x, 3, ["data-do-pedido"]);
      expect(res.ok).toBe(true);
      if (res.ok) reqs = reqs.map((q) => (q.id === x ? { ...q, placement: res.kind } : q));
    }
    expect(occupied(reqs)).toBe(3);
    expect(reqs.filter((q) => q.placement === "espera").map((q) => q.id)).toEqual(["d", "e"]);
  });
  it("vaga liberada vai só ao primeiro pelo critério aprovado", () => {
    const reqs = [r("a", { placement: "confirmacao", ended: true }), r("b", { placement: "espera", priority: 10 }), r("cc", { placement: "espera", priority: 90 })];
    expect(place(reqs, "b", 1, ["prioridade-da-analise"])).toEqual({ ok: false, error: "dev:not-first-in-waitlist" });
    expect(place(reqs, "cc", 1, ["prioridade-da-analise"])).toEqual({ ok: true, kind: "confirmacao" });
    expect(place(reqs, "cc", 1, null)).toEqual({ ok: false, error: "dev:waitlist-criteria-missing" });
  });
  it("sem vagas configuradas ou sem análise deferida, recusa", () => {
    expect(place([r("a")], "a", null, null)).toEqual({ ok: false, error: "dev:seats-not-configured" });
    expect(place([r("a", { reviewed: "indeferida" })], "a", 3, null)).toEqual({ ok: false, error: "dev:not-approved" });
  });
  it("pedido institucional à frente quando o critério manda", () => {
    const o = waitlistOrder([r("a", { placement: "espera" }), r("bb", { placement: "espera", mode: "institucional" })], ["pedido-institucional", "data-do-pedido"]);
    expect(o!.map((x) => x.id)).toEqual(["bb", "a"]);
  });
  it("migrations 0438/0439: lock da turma, aprovação ≠ autor, writers antigos fechados", () => {
    const sql = readFileSync("drizzle/migrations/0438_dev10_enrollment_flow.sql", "utf8");
    expect(sql).toMatch(/FROM public.dev_classes WHERE id = _e.class_id FOR UPDATE/);
    expect(sql).toMatch(/dev:self-approval/);
    expect(sql).toMatch(/dev:self-review/);
    expect(sql).toMatch(/IF _kind IN \('confirmacao','espera'\) THEN RAISE EXCEPTION 'dev:use-place'/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public.enroll_dev_class\(.*\) FROM authenticated/);
    expect(readFileSync("drizzle/migrations/0439_dev10_fix_school_capability.sql", "utf8")).toMatch(/has_school_capability\('indicar-para-formacao'/);
  });
});
