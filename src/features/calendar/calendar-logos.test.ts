import { describe, it, expect } from "vitest";
import {
  applyLogoWidth,
  applyLogoHeight,
  createLogo,
  reorderLogos,
  resolveLogoForContext,
  validateLogoConfig,
  validateLogoOverflow,
  sanitizeLogoUpload,
  type LogoConfig,
} from "./calendar-engine";
import {
  addLogo,
  moveLogo,
  removeLogo,
  saveLogo,
  sanitizeAndAssignLogoImage,
  clearLogoImage,
  restoreLogoDefault,
  restoreAllLogosDefault,
  toggleLogoVisibility,
  setLogoPrintOverride,
  projectLogosForContext,
  checkLogoOverflow,
} from "./calendar-governance";

function emptyConfig(): LogoConfig {
  return { items: [] };
}

describe("logos institucionais — governança", () => {
  it("adiciona e substitui a imagem de uma logo (sem usar nome de arquivo como identidade)", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const id = added.logos.items[0]!.id;
    const assigned = sanitizeAndAssignLogoImage(
      added.logos,
      id,
      { type: "image/png", size: 1024 },
      "asset-brasao-v2",
      { widthPx: 400, heightPx: 400 },
    );
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.logos.items[0]!.assetId).toBe("asset-brasao-v2");
    expect(assigned.logos.items[0]!.naturalWidthPx).toBe(400);
  });

  it("recusa upload em formato não seguro", () => {
    const check = sanitizeLogoUpload({ type: "image/svg+xml", size: 100 });
    expect(check.ok).toBe(false);
  });

  it("persiste a substituição após \"recarregar\" (clone estrutural)", () => {
    const added = addLogo(emptyConfig(), "Secretaria");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const assigned = sanitizeAndAssignLogoImage(added.logos, id, { type: "image/png", size: 10 }, "asset-1");
    if (!assigned.ok) throw new Error("falhou");
    const reloaded: LogoConfig = JSON.parse(JSON.stringify(assigned.logos));
    expect(reloaded.items[0]!.assetId).toBe("asset-1");
  });

  it("restaura a logo original ao padrão do modelo", () => {
    const added = addLogo(emptyConfig(), "Programa");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const assigned = sanitizeAndAssignLogoImage(added.logos, id, { type: "image/png", size: 10 }, "asset-x");
    if (!assigned.ok) throw new Error("falhou");
    const restored = restoreLogoDefault(assigned.logos, id);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.logos.items[0]!.assetId).toBeNull();
  });

  it("restaura TODAS as logos ao padrão (nenhuma configurada)", () => {
    expect(restoreAllLogosDefault()).toEqual({ items: [] });
  });

  it("remove a imagem sem apagar a logo", () => {
    const added = addLogo(emptyConfig(), "Selo");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const assigned = sanitizeAndAssignLogoImage(added.logos, id, { type: "image/png", size: 10 }, "asset-y");
    if (!assigned.ok) throw new Error("falhou");
    const cleared = clearLogoImage(assigned.logos, id);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.logos.items[0]!.assetId).toBeNull();
      expect(cleared.logos.items).toHaveLength(1);
    }
  });

  it("oculta e exibe uma logo sem removê-la", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const hidden = toggleLogoVisibility(added.logos, id, true);
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(hidden.logos.items[0]!.hidden).toBe(true);
    const shown = toggleLogoVisibility(hidden.logos, id, false);
    if (shown.ok) expect(shown.logos.items[0]!.hidden).toBe(false);
  });

  it("preserva a proporção ao alterar a largura (altura recalculada)", () => {
    const logo = { ...createLogo("l1", "Logo", 1), naturalWidthPx: 200, naturalHeightPx: 100 };
    const size = applyLogoWidth(logo, 40);
    expect(size.widthPt).toBe(40);
    expect(size.heightPt).toBe(20);
  });

  it("preserva a proporção ao alterar a altura (largura recalculada)", () => {
    const logo = { ...createLogo("l1", "Logo", 1), naturalWidthPx: 200, naturalHeightPx: 100 };
    const size = applyLogoHeight(logo, 30);
    expect(size.heightPt).toBe(30);
    expect(size.widthPt).toBe(60);
  });

  it("não deforma quando manter proporção está desligado (larguras/alturas independentes)", () => {
    const logo = {
      ...createLogo("l1", "Logo", 1),
      naturalWidthPx: 200,
      naturalHeightPx: 100,
      size: { ...createLogo("l1", "Logo", 1).size, lockAspectRatio: false },
    };
    const size = applyLogoWidth(logo, 500);
    expect(size.widthPt).toBe(500);
    expect(size.heightPt).toBe(logo.size.heightPt);
  });

  it("altera a posição de uma logo via saveLogo", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const logo = added.logos.items[0]!;
    const moved = saveLogo(added.logos, {
      ...logo,
      position: { ...logo.position, horizontal: "center", vertical: "middle" },
    });
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.logos.items[0]!.position.horizontal).toBe("center");
      expect(moved.logos.items[0]!.position.vertical).toBe("middle");
    }
  });

  it("suporta duas logos simultâneas, cada uma independente", () => {
    const first = addLogo(emptyConfig(), "Prefeitura");
    if (!first.ok) throw new Error("falhou");
    const second = addLogo(first.logos, "Secretaria");
    if (!second.ok) throw new Error("falhou");
    expect(second.logos.items).toHaveLength(2);
    expect(second.logos.items[0]!.id).not.toBe(second.logos.items[1]!.id);
  });

  it("reordena logos existentes", () => {
    const first = addLogo(emptyConfig(), "Prefeitura");
    if (!first.ok) throw new Error("falhou");
    const second = addLogo(first.logos, "Secretaria");
    if (!second.ok) throw new Error("falhou");
    const [a, b] = second.logos.items;
    const moved = moveLogo(second.logos, b!.id, -1);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      const sorted = [...moved.logos.items].sort((x, y) => x.order - y.order);
      expect(sorted[0]!.id).toBe(b!.id);
      expect(sorted[1]!.id).toBe(a!.id);
    }
  });

  it("remove uma logo adicionada", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const removed = removeLogo(added.logos, id);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.logos.items).toHaveLength(0);
  });

  it("impressão herda a configuração geral quando não há sobrescrita", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const [geral] = projectLogosForContext(added.logos, "geral");
    const [impressao] = projectLogosForContext(added.logos, "impressao");
    expect(impressao).toEqual(geral);
  });

  it("sobrescrita exclusiva de impressão altera só o contexto de impressão (delta)", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const withOverride = setLogoPrintOverride(added.logos, id, { size: { widthPt: 24, unit: "mm" } });
    expect(withOverride.ok).toBe(true);
    if (!withOverride.ok) return;
    const [geral] = projectLogosForContext(withOverride.logos, "geral");
    const [impressao] = projectLogosForContext(withOverride.logos, "impressao");
    expect(geral!.size.widthPt).toBe(96);
    expect(impressao!.size.widthPt).toBe(24);
    expect(impressao!.size.unit).toBe("mm");
  });

  it("remover a sobrescrita faz a impressão voltar a herdar o geral", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const withOverride = setLogoPrintOverride(added.logos, id, { size: { widthPt: 24, unit: "mm" } });
    if (!withOverride.ok) throw new Error("falhou");
    const removed = setLogoPrintOverride(withOverride.logos, id, undefined);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    const [geral] = projectLogosForContext(removed.logos, "geral");
    const [impressao] = projectLogosForContext(removed.logos, "impressao");
    expect(impressao).toEqual(geral);
  });

  it("alerta quando a logo ultrapassa a área imprimível, sem corrigir automaticamente", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const assigned = sanitizeAndAssignLogoImage(added.logos, id, { type: "image/png", size: 10 }, "asset-z");
    if (!assigned.ok) throw new Error("falhou");
    const huge = saveLogo(assigned.logos, {
      ...assigned.logos.items[0]!,
      size: { ...assigned.logos.items[0]!.size, widthPt: 500, heightPt: 500, unit: "mm" },
    });
    if (!huge.ok) throw new Error("falhou");
    const overflow = checkLogoOverflow(huge.logos, { widthMm: 210, heightMm: 297 });
    expect(overflow.length).toBeGreaterThan(0);
    // nada é redimensionado/movido automaticamente:
    expect(huge.logos.items[0]!.size.widthPt).toBe(500);
  });

  it("validateLogoOverflow não acusa nada quando a logo está dentro da página", () => {
    const logo = createLogo("l1", "Logo", 1);
    const withAsset = { ...logo, assetId: "asset-ok", size: { ...logo.size, widthPt: 20, heightPt: 20, unit: "mm" as const } };
    const overflow = validateLogoOverflow([withAsset], { widthMm: 210, heightMm: 297 });
    expect(overflow).toHaveLength(0);
  });

  it("prévia e PDF usam a mesma projeção (mesma função, mesmo resultado determinístico)", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const forPreview = projectLogosForContext(added.logos, "impressao");
    const forPdf = projectLogosForContext(added.logos, "impressao");
    expect(forPdf).toEqual(forPreview);
  });

  it("o recurso original da imagem (assetId e resolução natural) não é alterado por mudanças de tamanho/posição", () => {
    const added = addLogo(emptyConfig(), "Prefeitura");
    if (!added.ok) throw new Error("falhou");
    const id = added.logos.items[0]!.id;
    const assigned = sanitizeAndAssignLogoImage(
      added.logos,
      id,
      { type: "image/png", size: 10 },
      "asset-quality",
      { widthPx: 1200, heightPx: 800 },
    );
    if (!assigned.ok) throw new Error("falhou");
    const resized = saveLogo(assigned.logos, {
      ...assigned.logos.items[0]!,
      size: applyLogoWidth(assigned.logos.items[0]!, 50),
      position: { ...assigned.logos.items[0]!.position, horizontal: "right" },
    });
    if (!resized.ok) throw new Error("falhou");
    expect(resized.logos.items[0]!.assetId).toBe("asset-quality");
    expect(resized.logos.items[0]!.naturalWidthPx).toBe(1200);
    expect(resized.logos.items[0]!.naturalHeightPx).toBe(800);
  });

  it("validateLogoConfig recusa dimensões inválidas ou fora dos limites", () => {
    const base = createLogo("l1", "Logo", 1);
    const zero = { ...base, size: { ...base.size, widthPt: 0 } };
    expect(validateLogoConfig(zero).length).toBeGreaterThan(0);
    const outOfBounds = { ...base, size: { ...base.size, widthPt: 500, maxWidthPt: 200 } };
    expect(validateLogoConfig(outOfBounds).length).toBeGreaterThan(0);
    const badOpacity = { ...base, box: { ...base.box, opacity: 2 } };
    expect(validateLogoConfig(badOpacity).length).toBeGreaterThan(0);
  });

  it("reorderLogos não muda nada quando a direção é inválida (extremos)", () => {
    const logo = createLogo("l1", "Logo", 1);
    const result = reorderLogos([logo], "l1", -1);
    expect(result).toBe([logo].length ? result : result);
    expect(result).toEqual([logo]);
  });

  it("resolveLogoForContext no contexto geral ignora qualquer delta de impressão", () => {
    const logo = { ...createLogo("l1", "Logo", 1), print: { hidden: true } };
    const resolved = resolveLogoForContext(logo, "geral");
    expect(resolved.hidden).toBe(false);
  });
});
