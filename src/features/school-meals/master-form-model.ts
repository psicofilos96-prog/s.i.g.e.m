// LOTE 14 — formulário de cadastro técnico (registro mestre). Só monta o payload declarado;
// competência, transição e autoria distinta são decididas pelo banco (record_meal_master).
export type FieldKind = "text" | "number" | "date" | "ref" | "person";
export interface FieldSpec { key: string; label: string; kind: FieldKind; required: boolean; refKind?: string }

export const MASTER_FORM: Record<string, { school: boolean; fields: FieldSpec[] }> = {
  "item-alimentar": { school: false, fields: [{ key: "nome", label: "Nome do gênero/item", kind: "text", required: true }] },
  "unidade-de-medida": { school: false, fields: [{ key: "nome", label: "Nome", kind: "text", required: true }, { key: "simbolo", label: "Símbolo", kind: "text", required: true }] },
  fornecedor: { school: false, fields: [{ key: "nome", label: "Razão social", kind: "text", required: true }, { key: "documento", label: "CNPJ/CPF (opcional)", kind: "text", required: false }] },
  "referencia-contratual": { school: false, fields: [
    { key: "natureza", label: "Natureza (processo, ata, contrato, empenho)", kind: "text", required: true },
    { key: "numero", label: "Número", kind: "text", required: true },
    { key: "fornecedor_ref", label: "Fornecedor", kind: "ref", refKind: "fornecedor", required: true },
    { key: "empenho", label: "Nota de empenho (opcional)", kind: "text", required: false },
  ] },
  "designacao-inspetor": { school: true, fields: [{ key: "pessoa_id", label: "Pessoa designada (identificador do cadastro de pessoas)", kind: "person", required: true }] },
  "treinamento-inspetor": { school: true, fields: [
    { key: "designacao_ref", label: "Designação", kind: "ref", refKind: "designacao-inspetor", required: true },
    { key: "realizado_em", label: "Realizado em", kind: "date", required: true },
  ] },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Payload a partir dos valores digitados; erro por extenso quando falta campo obrigatório. Vazio opcional é omitido, nunca zero. */
export function buildMasterPayload(kind: string, values: Record<string, string>): { payload: Record<string, unknown> } | { error: string } {
  const spec = MASTER_FORM[kind]; if (!spec) return { error: "Espécie sem formulário." };
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) { if (f.required) return { error: `Preencha: ${f.label}.` }; continue; }
    if (f.kind === "number") { const n = Number(v.replace(",", ".")); if (!Number.isFinite(n)) return { error: `${f.label}: número inválido.` }; out[f.key] = n; }
    else if ((f.kind === "ref" || f.kind === "person") && !UUID.test(v)) return { error: `${f.label}: identificador inválido.` };
    else out[f.key] = v;
  }
  return { payload: out };
}

/** Próximas ações possíveis pela situação; quem pode executá-las o banco decide. */
export function masterActions(status: string): ("conferencia" | "homologacao" | "retirada")[] {
  if (status === "rascunho") return ["conferencia", "retirada"];
  if (status === "conferida") return ["homologacao", "retirada"];
  if (status === "homologada") return ["retirada"];
  return [];
}
