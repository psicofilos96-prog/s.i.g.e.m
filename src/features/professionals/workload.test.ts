import { describe, expect, it } from "vitest";
import { addSame, balance, qty, toMinutes, type DurationRule, type MunicipalRule, type Qty } from "./workload";

const D = "2026-03-01";
const ef: DurationRule = { id: "r1", context: "EF-anos-finais", minutesPerClassHour: 50, validFrom: "2026-01-01", validUntil: null, homologated: true };
const ei: DurationRule = { id: "r2", context: "EI", minutesPerClassHour: 60, validFrom: "2026-01-01", validUntil: null, homologated: true };
const ok = (r: ReturnType<typeof qty>): Qty => { if (!r.ok) throw new Error(r.error); return r.value; };

describe("dimensões", () => {
  it("hora-aula exige contexto; valor negativo recusado", () => {
    expect(qty(4, "hora-aula")).toEqual({ ok: false, error: "contexto-ausente" });
    expect(qty(-1, "hora-relogio")).toEqual({ ok: false, error: "valor-invalido" });
  });
  it("hora-aula converte só por regra homologada da etapa", () => {
    expect(toMinutes(ok(qty(6, "hora-aula", "EF-anos-finais")), D, [ef])).toEqual({ ok: true, value: 300 });
    expect(toMinutes(ok(qty(6, "hora-aula", "EF-anos-finais")), D, [{ ...ef, homologated: false }])).toEqual({ ok: false, error: "sem-regra-de-duracao" });
    expect(toMinutes(ok(qty(6, "hora-aula", "EF-anos-finais")), D, [ef, { ...ef, id: "x" }])).toEqual({ ok: false, error: "regra-ambigua" });
  });
  it("não soma unidades ou contextos diferentes sem conversão", () => {
    expect(addSame(ok(qty(2, "hora-relogio")), ok(qty(2, "hora-aula", "EI")))).toEqual({ ok: false, error: "unidade-incompativel" });
    expect(addSame(ok(qty(2, "hora-aula", "EI")), ok(qty(2, "hora-aula", "EF-anos-finais")))).toEqual({ ok: false, error: "unidade-incompativel" });
  });
});

describe("saldo de jornada", () => {
  const extra: MunicipalRule = { id: "m1", kind: "extraclasse-minimo", fraction: 1 / 3, validFrom: "2026-01-01", validUntil: null, homologated: true };
  it("categorias separadas, disponível e extraclasse com regra", () => {
    const b = balance({
      contratual: [ok(qty(30, "hora-relogio"))],
      atribuida: [ok(qty(12, "hora-aula", "EF-anos-finais")), ok(qty(10, "hora-aula", "EI"))],
      extraclasse: [ok(qty(10, "hora-relogio"))],
    }, D, [ef, ei], [extra]);
    expect(b.minutes.atribuida).toBe(1200);
    expect(b.disponivel).toBe(600);
    expect(b.extraclasseMinimo).toBe(600);
    expect(b.extraclasseAtendido).toBe(true);
    expect(b.minutes.regencia).toBeNull();
  });
  it("sem contratual ou sem regra ⇒ null com pendência, nunca zero", () => {
    const b = balance({ atribuida: [ok(qty(4, "hora-aula", "EM"))] }, D, [ef], []);
    expect(b.disponivel).toBeNull();
    expect(b.minutes.atribuida).toBeNull();
    expect(b.extraclasseAtendido).toBeNull();
    expect(b.pendencias).toEqual(expect.arrayContaining(["atribuida: sem-regra-de-duracao", "sem regra municipal homologada de extraclasse"]));
  });
  it("atribuição acima da contratual é sinalizada", () => {
    const b = balance({ contratual: [ok(qty(20, "hora-relogio"))], atribuida: [ok(qty(30, "hora-relogio"))] }, D, [], []);
    expect(b.disponivel).toBe(-600);
    expect(b.pendencias).toContain("atribuição excede a jornada contratual");
  });
});
