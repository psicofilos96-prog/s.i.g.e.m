import { describe, expect, it } from "vitest";
import { BASE_TEMPLATES } from "./base-templates";
import { STUDIO_LOGOS, logoAssets, logoRef, setHeaderLogo, unknownLogoRefs } from "./studio-logos";
import { reproduce } from "./studio-cloud";
import { validateTemplate } from "./studio-engine";

/** Versões de logo já publicadas: id@versão → URL. Nunca altere uma linha; logo novo entra como nova versão. */
const FROZEN: Record<string, string> = Object.fromEntries(STUDIO_LOGOS.filter((l) => l.version === 1).map((l) => [`${l.id}@1`, l.url]));

describe("Documentos L04 — biblioteca e logos", () => {
  it("biblioteca cobre ofício, memorando, ata, declaração, parecer, requerimento e termo, todos válidos", () => {
    const ids = BASE_TEMPLATES.map((t) => t.id);
    for (const k of ["oficio", "memorando", "ata-de-reuniao", "declaracao-de-matricula", "parecer", "requerimento", "termo-uso-imagem"]) expect(ids).toContain(k);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of BASE_TEMPLATES) { expect(validateTemplate(t.blocks, t.page), t.id).toEqual([]); expect(unknownLogoRefs(t.blocks), t.id).toEqual([]); }
  });
  it("registro de logos é append-only: versão publicada nunca muda de URL", () => {
    for (const [k, u] of Object.entries(FROZEN)) expect(logoAssets()[k]).toBe(u);
    const keys = STUDIO_LOGOS.map((l) => logoRef(l));
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of STUDIO_LOGOS) expect(l.url).toMatch(/^\/__l5e\/assets-v1\/[0-9a-f-]+\//);
  });
  it("logo só do registro", () => {
    const b = BASE_TEMPLATES[0]!.blocks;
    expect(() => setHeaderLogo(b, "https://evil/x.png")).toThrow("registro");
    expect(() => setHeaderLogo(b, "asset:brasao@99")).toThrow("registro");
    expect(setHeaderLogo(b, null).find((x) => x.type === "header")).toMatchObject({ logoAsset: null });
  });
  it("modelo novo não altera documento emitido: reprodução vem só do snapshot", () => {
    const t = BASE_TEMPLATES.find((x) => x.id === "oficio")!;
    const snapshot = { title: "Ofício", blocks: structuredClone(t.blocks), page: structuredClone(t.page), facts: { "escola.nome": "E1" }, version_no: 1 } as never;
    const e = { snapshot, verification_code: "ABCDEF0123456789ABCD" };
    const before = reproduce(e, "https://sigem.example").html;
    t.blocks.push({ type: "rich", runs: [{ text: "TEXTO NOVO DA VERSÃO 2" }] }); // nova versão do modelo
    const after = reproduce(e, "https://sigem.example").html;
    t.blocks.pop();
    expect(after).toBe(before);
    expect(after).not.toContain("TEXTO NOVO");
    expect(before).toContain(FROZEN["brasao@1"]!);
  });
});
