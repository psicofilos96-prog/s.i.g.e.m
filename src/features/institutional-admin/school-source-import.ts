/**
 * Proposta cadastral de unidades a partir de fonte curada (Censo 2026), para revisão humana.
 * - Só INEP/nome/município/UF/dependência/aba/linha; nenhum dado pessoal.
 * - Fonte 2026 ≠ situação comprovada em 2027: ato e vigência vêm da pessoa autenticada.
 * - Nunca infere Regular/EJA/AEE nem aplicabilidade de calendário; dependência é só exibida.
 * - Localização (urbana/rural) a partir da aba só quando a pessoa opta explicitamente.
 * - Grava só por `register_school_record_version` (B2.1); resultados parciais preservados.
 */
import source from "../../../docs/data/escolas-itaperuna-censo2026.json";

export type SourceSchool = Readonly<{ inep: string; nome: string; municipio: string; uf: string; dependenciaNaFonte: string; aba: string; linha: number }>;
export type SchoolSource = Readonly<{ fonte: string; sha256: string; anoDaFonte: number; uso: string; escolas: readonly SourceSchool[] }>;
export const CENSO_2026_SOURCE = source as SchoolSource;

export type ProposalRow = Readonly<{
  inep: string; name: string; sheet: string; line: number; dependency: string;
  status: "novo" | "ja-cadastrado" | "inep-invalido" | "duplicado-na-fonte";
  proposedLocation: "urbana" | "rural" | null;
}>;

export const normalizeName = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
export const normalizeInep = (s: string) => s.replace(/\D/g, "");

/** Prévia: normaliza, deduplica INEP (primeira ocorrência vence; demais sinalizadas) e marca já cadastrados. */
export function buildSchoolProposal(src: SchoolSource, existingIneps: ReadonlySet<string>): ProposalRow[] {
  const seen = new Set<string>();
  return src.escolas.map((e) => {
    const inep = normalizeInep(e.inep);
    const base = {
      inep, name: normalizeName(e.nome), sheet: e.aba, line: e.linha, dependency: e.dependenciaNaFonte,
      proposedLocation: e.aba === "Urbanas" ? "urbana" as const : e.aba === "Rurais" ? "rural" as const : null,
    };
    if (inep.length !== 8) return { ...base, status: "inep-invalido" as const };
    if (seen.has(inep)) return { ...base, status: "duplicado-na-fonte" as const };
    seen.add(inep);
    return { ...base, status: existingIneps.has(inep) ? "ja-cadastrado" as const : "novo" as const };
  });
}

export type ImportInput = Readonly<{ act: string; validFrom: string; useSheetLocation: boolean }>;
export type ImportOutcome = Readonly<{ inep: string; ok: boolean; message: string | null }>;
type Rpc = (fn: "register_school_record_version", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Referência documental é opcional; só a vigência é exigida. */
export function importInputProblem(i: ImportInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.validFrom)) return "Informe a data de início da vigência.";
  return null;
}

/** Proveniência: referência informada (se houver) + a própria fonte curada com hash, aba e linha. */
export function provenanceRef(act: string, src: SchoolSource, r: ProposalRow): string {
  const source = `fonte ${src.fonte} sha256:${src.sha256} aba ${r.sheet} linha ${r.line}`;
  return act.trim() ? `${act.trim()} | ${source}` : source;
}

/** Grava as selecionadas em sequência; uma falha não desfaz as anteriores nem impede as seguintes. */
export async function importSelectedSchools(rows: readonly ProposalRow[], input: ImportInput, rpc: Rpc, src: SchoolSource = CENSO_2026_SOURCE): Promise<ImportOutcome[]> {
  const problem = importInputProblem(input);
  if (problem) throw new Error(problem);
  const out: ImportOutcome[] = [];
  for (const r of rows) {
    if (r.status !== "novo") { out.push({ inep: r.inep, ok: false, message: `ignorada (${r.status})` }); continue; }
    const { error } = await rpc("register_school_record_version", {
      _school: null, _base_version_id: null, _official_name: r.name, _address: null, _district: null,
      _location_kind: input.useSheetLocation ? r.proposedLocation : null, _active: true,
      _valid_from: input.validFrom, _justification: null,
      _act_ref: provenanceRef(input.act, src, r),
      _inep: r.inep, _network_code: null,
    });
    out.push({ inep: r.inep, ok: !error, message: error?.message ?? null });
  }
  return out;
}
