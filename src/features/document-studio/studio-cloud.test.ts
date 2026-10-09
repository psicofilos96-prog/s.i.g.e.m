import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { diffVersions, emissionStatus, factKeys, library, parseVerifyUrl, qrDataUrl, qrMatrix, reproduce, verifyUrl, versionStates, type StudioEmission, type StudioEvent, type StudioVersion } from "./studio-cloud";
import { BASE_TEMPLATES } from "./base-templates";
import { DEFAULT_PAGE, type StudioBlock } from "./studio-engine";

const code = "0123456789ABCDEF0A1B";
const v = (id: string, n: number, blocks: StudioBlock[] = [{ type: "title", text: `v${n}` }]): StudioVersion =>
  ({ id, template_id: "decl", version_no: n, supersedes_id: null, sector: "secretaria", title: "Declaração", blocks, page: DEFAULT_PAGE, base_template_id: null, content_sha256: "h", author_id: "u", created_at: "2026-10-09T00:00:00Z" });
const ev = (version_id: string, kind: StudioEvent["kind"], at: string): StudioEvent => ({ id: version_id + kind + at, version_id, kind, actor_id: "u", note: null, at });

function scan(text: string) {
  const m = qrMatrix(text); const scale = 4, quiet = 4, n = m.length, size = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r]![c]) for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
    const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0;
  }
  return jsQR(px, size, size)?.data ?? null;
}

describe("DOCS.PRO.3 — Document Studio persistido", () => {
  it("QR gerado localmente é escaneável e volta ao código", () => {
    const url = verifyUrl(code, "https://sigem.exemplo.gov.br");
    const read = scan(url);
    expect(read).toBe(url);
    expect(parseVerifyUrl(read!)).toBe(code);
    expect(qrDataUrl(url)).toMatch(/^data:image\/gif;base64,/);
  });
  it("URL de verificação recusa código fora do formato e origem estranha", () => {
    expect(() => verifyUrl("123", "https://x.gov.br")).toThrow();
    expect(() => verifyUrl(code, "javascript:alert(1)")).toThrow();
    expect(parseVerifyUrl("https://x/verificar/documento/../../etc")).toBeNull();
  });
  it("estados: rascunho → revisão → homologado; nova homologada substitui; arquivar vence", () => {
    const vs = [v("a", 1), v("b", 2)];
    expect(versionStates(vs, [])).toEqual({ a: "rascunho", b: "rascunho" });
    const e1 = [ev("a", "enviar-revisao", "1"), ev("a", "homologar", "2")];
    expect(versionStates(vs, e1).a).toBe("homologado");
    const e2 = [...e1, ev("b", "enviar-revisao", "3"), ev("b", "homologar", "4")];
    expect(versionStates(vs, e2)).toEqual({ a: "substituido", b: "homologado" });
    expect(library(vs, versionStates(vs, e2))[0]!.current!.id).toBe("b");
    expect(versionStates(vs, [...e2, ev("b", "arquivar", "5")]).b).toBe("arquivado");
    expect(versionStates(vs, [ev("a", "enviar-revisao", "1"), ev("a", "devolver", "2")]).a).toBe("rascunho");
  });
  it("comparar versões aponta bloco alterado, incluído e removido", () => {
    const d = diffVersions([{ type: "title", text: "A" }, { type: "line" }], [{ type: "title", text: "B" }, { type: "line" }, { type: "page-break" }]);
    expect(d.map((x) => x.change)).toEqual(["alterado", "igual", "incluido"]);
    expect(diffVersions([{ type: "line" }], [])[0]!.change).toBe("removido");
  });
  it("reprodução usa só o snapshot congelado (versão histórica) e marca cancelado", () => {
    const e = { verification_code: code, snapshot: { template_id: "decl", version_id: "a", version_no: 1, title: "Declaração", blocks: [{ type: "title", text: "Texto da v1" }, { type: "field", label: "Nome", fact: "estudante.nome" }, { type: "qr", label: "Verificação" }] as StudioBlock[], page: DEFAULT_PAGE, facts: { "estudante.nome": "Fulano" }, content_sha256: "h" } };
    const ok = reproduce(e, "https://x.gov.br").html;
    expect(ok).toContain("Texto da v1"); expect(ok).toContain("Fulano"); expect(ok).toContain('class="qrimg" src="data:image/gif;base64,');
    expect(ok).not.toContain("DOCUMENTO CANCELADO");
    expect(reproduce(e, "https://x.gov.br", "cancelado").html).toContain("DOCUMENTO CANCELADO");
    expect(reproduce(e, "https://x.gov.br").html).toBe(ok); // determinístico
  });
  it("status da emissão vem do evento", () => {
    const e = { id: "e1" } as StudioEmission;
    expect(emissionStatus(e, [])).toBe("valido");
    expect(emissionStatus(e, [{ emission_id: "e1", kind: "cancelamento", replaced_by: null, reason: "x", at: "" }])).toBe("cancelado");
    expect(emissionStatus(e, [{ emission_id: "e1", kind: "substituicao", replaced_by: "e2", reason: "x", at: "" }])).toBe("substituido");
  });
  it("modelos-base continuam rascunhos e têm id aceito pelo banco", () => {
    expect(BASE_TEMPLATES.length).toBeGreaterThanOrEqual(41);
    for (const t of BASE_TEMPLATES) expect(t.id).toMatch(/^[a-z0-9][a-z0-9-]{1,79}$/);
    expect(JSON.stringify(BASE_TEMPLATES)).not.toMatch(/homologad[oa]"/);
  });
  it("chaves de fato do formulário de emissão saem dos campos do modelo", () => {
    expect(factKeys([{ type: "field", label: "Nome", fact: "estudante.nome" }, { type: "rich", runs: [{ text: "Escola {{escola.nome}}" }] }] as StudioBlock[])).toEqual(["escola.nome", "estudante.nome"]);
  });
});
