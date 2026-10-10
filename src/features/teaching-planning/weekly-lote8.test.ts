import { describe, expect, it } from "vitest";
import { dailyBlocks } from "./planning-model";
describe("planejamento semanal com datas livres", () => {
  it("cria um bloco por dia útil do intervalo escolhido", () => {
    const b = dailyBlocks("2026-10-09", "2026-10-13", []);
    expect(b.map((x) => x.heading)).toEqual(["09/10/2026 (sexta)", "12/10/2026 (segunda)", "13/10/2026 (terça)"]);
  });
  it("não duplica dia já planejado e respeita intervalo inválido", () => {
    const a = dailyBlocks("2026-10-12", "2026-10-12", []);
    expect(dailyBlocks("2026-10-12", "2026-10-12", a)).toHaveLength(1);
    expect(dailyBlocks("2026-10-13", "2026-10-12", [])).toEqual([]);
  });
});
