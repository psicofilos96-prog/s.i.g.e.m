/**
 * Adaptadores. Só existe parser onde há leiaute real no repositório.
 * - censo-matriz-escolas: formato curado de docs/data/escolas-itaperuna-censo2026.json (fonte, sha256, escolas[]).
 * - educacenso: leiaute oficial não está no repositório ⇒ interface declarada, parser recusa, nenhuma coluna inventada.
 * - gpe: EXTERNAL_INTEGRATION_UNDEFINED — integração histórica sem contrato nem arquivo prometido; mantida só por compatibilidade.
 */
import { normText, type ImportAdapter, type ParsedRow } from "./import-engine";

const censoEscolas: ImportAdapter = {
  id: "censo-matriz-escolas",
  version: 1,
  label: "Censo — matriz de escolas (formato curado)",
  layoutStatus: "disponivel",
  layoutSource: "docs/data/escolas-itaperuna-censo2026.json",
  accepts: ".json",
  comparedFields: ["nome"],
  parse(text) {
    const j = JSON.parse(text) as { escolas?: unknown };
    if (!j || !Array.isArray(j.escolas)) throw new Error("Arquivo sem a lista \"escolas\" do formato curado.");
    return j.escolas.map((e, i): ParsedRow => {
      const o = (e ?? {}) as Record<string, unknown>;
      const ref = o["aba"] != null && o["linha"] != null ? `${String(o["aba"])}:${String(o["linha"])}` : `item:${i + 1}`;
      return { lineRef: ref, raw: o };
    });
  },
  normalize(row) {
    const inep = normText(row.raw["inep"])?.replace(/\D/g, "") ?? null;
    const nome = normText(row.raw["nome"]);
    const problems: string[] = [];
    if (!inep) problems.push("INEP ausente.");
    else if (inep.length !== 8) problems.push(`INEP com ${inep.length} dígitos; esperado 8.`);
    if (!nome) problems.push("Nome ausente.");
    return {
      identityKey: inep && inep.length === 8 ? `inep:${inep}` : null,
      values: { inep, nome, municipio: normText(row.raw["municipio"]), uf: normText(row.raw["uf"]), dependencia_na_fonte: normText(row.raw["dependenciaNaFonte"]) },
      problems,
    };
  },
  confirmFields: [{ key: "validFrom", label: "Início da vigência no SIGEM", kind: "date", required: true }],
  async apply(row, ctx, rpc) {
    const v = row.normalized ?? {};
    const { data, error } = await rpc("register_school_record_version", {
      _school: null, _base_version_id: null, _official_name: v["nome"], _address: null, _district: null,
      _location_kind: null, _active: true, _valid_from: ctx.fields["validFrom"], _justification: null,
      _act_ref: `importação ${ctx.batchId} | fonte ${ctx.sourceName} sha256:${ctx.sourceSha256} linha ${row.line_ref}${ctx.sourceRef ? ` | ${ctx.sourceRef}` : ""}`,
      _inep: v["inep"], _network_code: null,
    });
    if (error) return { ok: false, message: error.message };
    const ref = typeof data === "string" ? data : JSON.stringify(data ?? `inep:${String(v["inep"])}`);
    return { ok: true, canonicalRef: ref.slice(0, 200) };
  },
};


/**
 * Resultados de avaliação institucional/externa — leiaute PRÓPRIO do SIGEM (não é leiaute oficial de terceiros):
 * CSV com cabeçalho estudante;item;situacao;valor. Estudante = identificador SIGEM; item vazio = resultado global.
 * A avaliação (versão) e a escola são escolhidas na confirmação; o writer valida escala, item e matrícula.
 */
const SITUACOES = ["observado", "ausente", "nao-aplicado"];
const resultadoAvaliacao: ImportAdapter = {
  id: "resultado-avaliacao-institucional",
  version: 1,
  label: "Resultados de avaliação institucional (leiaute SIGEM)",
  layoutStatus: "disponivel",
  layoutSource: "src/features/data-import/adapters.ts (leiaute próprio do SIGEM)",
  accepts: ".csv",
  comparedFields: ["situacao", "valor"],
  parse(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) throw new Error("Arquivo vazio.");
    const sep = lines[0]!.includes(";") ? ";" : ",";
    const head = lines[0]!.split(sep).map((h) => h.trim().toLowerCase());
    for (const c of ["estudante", "situacao"]) if (!head.includes(c)) throw new Error(`Coluna obrigatória ausente: ${c}.`);
    return lines.slice(1).map((l, i): ParsedRow => {
      const cells = l.split(sep); const raw: Record<string, unknown> = {};
      head.forEach((h, j) => { raw[h] = cells[j] ?? ""; });
      return { lineRef: `linha:${i + 2}`, raw };
    });
  },
  normalize(row) {
    const estudante = normText(row.raw["estudante"]); const item = normText(row.raw["item"]);
    const situacao = normText(row.raw["situacao"])?.toLowerCase() ?? null; const valor = normText(row.raw["valor"]);
    const problems: string[] = [];
    if (!estudante) problems.push("Estudante ausente.");
    if (!situacao || !SITUACOES.includes(situacao)) problems.push("Situação deve ser observado, ausente ou nao-aplicado.");
    if (situacao === "observado" && !valor) problems.push("Resultado observado sem valor.");
    if (situacao && situacao !== "observado" && valor) problems.push("Valor informado para resultado não observado.");
    return { identityKey: estudante ? `estudante:${estudante}|item:${item ?? "-"}` : null, values: { estudante, item, situacao, valor }, problems };
  },
  confirmFields: [
    { key: "assessmentVersionId", label: "Versão da avaliação (identificador)", kind: "text", required: true },
    { key: "schoolId", label: "Escola (identificador)", kind: "text", required: true },
  ],
  async apply(row, ctx, rpc) {
    const v = row.normalized ?? {};
    const { data, error } = await rpc("record_inst_assessment_result", {
      _base_id: null, _kind: "registro", _assessment_version: ctx.fields["assessmentVersionId"], _school: ctx.fields["schoolId"],
      _student: v["estudante"], _class: null, _item: v["item"] ?? null, _status: v["situacao"], _raw: v["valor"] ?? null,
      _source: `importação ${ctx.batchId} | ${ctx.sourceName} sha256:${ctx.sourceSha256} ${row.line_ref}${ctx.sourceRef ? ` | ${ctx.sourceRef}` : ""}`.slice(0, 500),
      _plan_key: `${ctx.fields["assessmentVersionId"]}:${row.identity_key}:${ctx.sourceSha256}`, _reason: null,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, canonicalRef: String(data) };
  },
};

const missing = (id: string, label: string): ImportAdapter => ({
  id, version: 1, label, layoutStatus: "leiaute-ausente", layoutSource: null, accepts: "", comparedFields: [],
  parse() { throw new Error(`O leiaute oficial de "${label}" não está disponível no SIGEM; nenhuma coluna é presumida.`); },
  normalize() { return { identityKey: null, values: {}, problems: ["Leiaute ausente."] }; },
});

export const IMPORT_ADAPTERS: readonly ImportAdapter[] = [
  censoEscolas,
  resultadoAvaliacao,
  missing("educacenso-matricula", "Educacenso — arquivo de migração"),
  missing("gpe", "GPE — integração sem contrato, nenhum arquivo aguardado (EXTERNAL_INTEGRATION_UNDEFINED · NO_ACTIVE_CONTRACT)"),
  // DP_FILE_CONTRACT_PENDING — BLOCKED_BY_SOURCE_FILE: o DP externo é a autoridade funcional e o SIGEM não administra vida funcional;
  // sem a planilha real nenhuma coluna é presumida, e ausência de pessoa nunca significa desligamento (snapshot × delta indefinido).
  missing("dp-quadro-funcional", "Planilha oficial do DP externo (DP_FILE_CONTRACT_PENDING)"),
];
export const adapterById = (id: string) => IMPORT_ADAPTERS.find((a) => a.id === id) ?? null;
