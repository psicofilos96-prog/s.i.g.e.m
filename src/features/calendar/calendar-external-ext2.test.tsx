
import { nextFitStep } from "./calendar-external-model";
describe("Ajustar para caber", () => {
  it("cresce a faixa de informações antes de mexer na fonte e para quando não há mais o que ajustar", () => {
    const p = defaultProfile("externo-panoramico");
    const s1 = nextFitStep(p, ["legenda"])!;
    expect(s1.bands.info).toBe(p.bands.info + 1);
    expect(s1.minFitPt).toBe(p.minFitPt);
    const full = { ...p, bands: { ...p.bands, info: 28, body: 100 - p.bands.banner - 28 - p.bands.footer } };
    expect(nextFitStep(full, ["feriados"])!.minFitPt).toBe(p.minFitPt - 0.5);
    expect(nextFitStep({ ...full, minFitPt: 4 }, ["feriados"])).toBeNull();
    expect(nextFitStep(p, [])).toBeNull();
  });
});
