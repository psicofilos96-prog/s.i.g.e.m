import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DOCUMENT_KINDS, buildSnapshot, emissionStatus, publicFieldAllowed, publicPayload, renderDocument, renderFromSnapshot,
  type EmissionRow, type TemplateVersion,
} from "./document-engine";

const tpl = (over: Partial<TemplateVersion> = {}): TemplateVersion => ({
  template_id: "declaracao-teste", document_kind: "declaracao-de-matricula", version_id: "v1", version_no: 1,
  supersedes_id: null, title: "Declaração", identity: { header_lines: ["Rede"] }, numbering: null,
  public_fields: ["escola.id"], source_ref: null, change_reason: null, recorded_at: "2026-10-05",
  blocks: [
    { type: "paragraph", text: "Declaramos que {{aluno.nome}} está matriculado sob nº {{matricula.numero}}." },
    { type: "field", label: "Turma", fact: "turma.rotulo" },
    { type: "paragraph", text: "Encerrada em {{matricula.encerramento}}.", when: { fact: "matricula.encerramento", present: true } },
    { type: "signature", label: "Secretaria" },
  ], ...over,
});
const ctx = { school_id: "e1", student_id: "a1", valid_on: "2026-10-05", known_at: null };

describe("motor de documentos escolares", () => {
  it("suporta os sete tipos pedidos", () => {
    expect(DOCUMENT_KINDS.map((k) => k.id)).toEqual(["declaracao-de-matricula", "declaracao-de-frequencia", "declaracao-escolar",
      "boletim", "ficha-individual", "historico-escolar", "transferencia"]);
  });
  it("fato ausente não é inventado", () => {
    const r = renderDocument(tpl().blocks, { "aluno.nome": "Ana" });
    expect(r.missingFacts).toEqual(["matricula.numero", "turma.rotulo"]);
    expect(r.blocks[1]).toMatchObject({ type: "field", value: null });
    expect(r.blocks.some((b) => b.type === "paragraph" && /Encerrada/.test(b.text))).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/"0"|: 0[,}]/);
  });
  it("snapshot só leva fatos usados e presentes e é imune a mudança posterior", () => {
    const facts: Record<string, string> = { "aluno.nome": "Ana", "matricula.numero": "123", "aluno.cpf": "secreto" };
    const s = buildSnapshot({ template: tpl(), facts, sources: [], context: ctx });
    expect(s.fields).toEqual({ "aluno.nome": "Ana", "matricula.numero": "123" });
    expect(s.absent).toEqual(["turma.rotulo"]);
    facts["aluno.nome"] = "Outra";
    const t = tpl(); (t.blocks[0] as { text: string }).text = "mudou";
    expect(renderFromSnapshot(s).blocks[0]).toMatchObject({ text: expect.stringContaining("Ana") });
  });
  it("modelo versionado: snapshot guarda a versão usada", () => {
    const s = buildSnapshot({ template: tpl({ version_id: "v2", version_no: 2 }), facts: {}, sources: [], context: ctx });
    expect(s.template).toMatchObject({ version_id: "v2", version_no: 2 });
  });
  it("verificação pública nunca expõe dado sensível", () => {
    for (const k of ["avaliacao.nota", "frequencia.percentual", "aluno.cpf", "aluno.endereco", "saude.laudo", "aluno.nascimento"])
      expect(publicFieldAllowed(k)).toBe(false);
    const s = buildSnapshot({ template: tpl(), facts: { "aluno.nome": "Ana" }, sources: [], context: ctx });
    expect(publicPayload(s, ["aluno.nome", "aluno.cpf"])).toEqual({ "aluno.nome": "Ana" });
  });
  it("reprodução herda o estado do original; cancelamento e retificação", () => {
    const base = { snapshot: {} as never, template_version_id: "v1", document_kind: "boletim", snapshot_sha256: "x",
      emission_number: null, emitted_by_person: null, emitted_at: "", event_reason: null, replacement_emission_id: null,
      event_recorded_at: null, verification_code: "C", retifies_id: null };
    const o: EmissionRow = { ...base, id: "o", emission_kind: "original", reproduces_id: null, event_kind: "cancelamento" };
    const r: EmissionRow = { ...base, id: "r", emission_kind: "reproducao", reproduces_id: "o", event_kind: null };
    expect(emissionStatus(r, [o, r])).toBe("cancelada");
    expect(emissionStatus({ ...o, event_kind: "retificacao" }, [])).toBe("retificada");
  });
  it("migration: append-only, sem DML direto, anon só verifica, capabilities sem regra", () => {
    const sql = readFileSync("drizzle/migrations/0066_school_documents_versioned_emission.sql", "utf8");
    expect(sql).toMatch(/REVOKE ALL ON public\.school_document_templates[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(sql.match(/append_only BEFORE UPDATE OR DELETE/g)?.length).toBe(4);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_school_document\(text\) TO anon, authenticated/);
    expect(sql.match(/TO anon/g)?.length).toBe(1);
    expect(sql).not.toMatch(/INSERT INTO public\.capability_policy_rules/);
    expect(sql).toMatch(/sha256\(convert_to\(snap::text/);
  });
});
