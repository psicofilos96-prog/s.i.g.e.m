/**
 * Adaptadores. Só existe parser onde há leiaute real no repositório.
 * - censo-matriz-escolas: formato curado de docs/data/escolas-itaperuna-censo2026.json (fonte, sha256, escolas[]).
 * - educacenso / gpe: leiaute oficial não está no repositório ⇒ interface declarada, parser recusa, nenhuma coluna inventada.
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

const missing = (id: string, label: string): ImportAdapter => ({
  id, version: 1, label, layoutStatus: "leiaute-ausente", layoutSource: null, accepts: "", comparedFields: [],
  parse() { throw new Error(`O leiaute oficial de "${label}" não está disponível no SIGEM; nenhuma coluna é presumida.`); },
  normalize() { return { identityKey: null, values: {}, problems: ["Leiaute ausente."] }; },
});

export const IMPORT_ADAPTERS: readonly ImportAdapter[] = [
  censoEscolas,
  missing("educacenso-matricula", "Educacenso — arquivo de migração"),
  missing("gpe", "GPE"),
];
export const adapterById = (id: string) => IMPORT_ADAPTERS.find((a) => a.id === id) ?? null;
