import { describe, expect, it } from "vitest";
import { breadcrumbForPath, provisionalNavigation } from "./navigation";
describe("breadcrumbForPath", () => {
  it("nomeia o domínio do menu e a página", () => {
    const g = provisionalNavigation.find((x) => x.items.some((i) => i.to !== "/" && i.label !== x.label))!;
    const item = g.items.find((i) => i.to !== "/")!;
    expect(breadcrumbForPath(item.to)).toEqual({ group: g.label, page: item.label });
  });
  it("rota fora do menu não inventa domínio", () => {
    expect(breadcrumbForPath("/rota-inexistente-xyz").group).toBeNull();
  });
});
