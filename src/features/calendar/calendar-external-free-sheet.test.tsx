import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { richFixture } from "./calendar-external-rich-fixture";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { externalPresentation } from "./calendar-visual-resolver";
import { buildExternalViewModel, defaultProfile } from "./calendar-external-model";
import { ExternalSheet } from "./calendar-external-sheets";

const f = richFixture();
const pres = externalPresentation(f.presentation);
const vm = buildExternalViewModel(buildPrintModel(pres, f.days, f.periods), pres, { versionId: "ver-rica", config: f.council, days: f.days });

describe("CAL.EXT.3 — folhas de layout livre usam os mesmos dados do calendário interno", () => {
  for (const t of ["externo-fotografico", "externo-quadro"] as const) {
    it(`${t}: 12 meses × 31 dias, total anual do motor, blocos posicionados pelo perfil`, () => {
      const p = defaultProfile(t, pres);
      const r = render(<ExternalSheet template={t} vm={vm} p={p} presentation={pres} />);
      expect(r.container.querySelectorAll("tbody tr[data-month]").length).toBe(12);
      expect(r.container.querySelectorAll("tbody tr[data-month] td.cx-dia, tbody tr[data-month] td.cx-inexistente").length).toBe(12 * 31);
      expect(r.getByTestId("cx-total-anual").textContent).toBe(String(vm.total.schoolDays));
      const leg = r.container.querySelector<HTMLElement>('[data-free-block="legenda"]')!;
      expect(leg.style.left).toBe(`${p.free.blocks.legenda.x}mm`);
    });
  }
  it("bloco oculto não é desenhado", () => {
    const p = defaultProfile("externo-quadro", pres); p.free.blocks.conselhos.visible = false;
    const r = render(<ExternalSheet template="externo-quadro" vm={vm} p={p} presentation={pres} />);
    expect(r.container.querySelector('[data-free-block="conselhos"]')).toBeNull();
  });
});
