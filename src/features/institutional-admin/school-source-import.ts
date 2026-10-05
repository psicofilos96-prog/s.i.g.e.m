/**
 * Lote de unidades a partir do snapshot EducaCenso 2026 da própria rede (staging sem dado pessoal).
 * - Grava só por `register_school_record_version` (B2.1), com a sessão de quem confirma; nunca service_role.
 * - school_id = inep-<código>; valid_from padrão = data de referência do snapshot.
 * - Dependência/categoria/poder público preservados como na fonte (valores abertos).
 * - Campos sem fonte (endereço, distrito, codigo-rede, prédio, acesso, salas) ficam NULL.
 * - Referência documental é opcional; a proveniência técnica (arquivo, hash, aba, linha) sempre acompanha.
 */
import staging from "../../../docs/data/educacenso-2026-school-staging.json";

export type StagedSchool = Readonly<{
  school_id: string; inep: string; official_name: string; administrative_dependency: string;
  private_school_category: string | null; partnership_public_authority: string | null;
  location_kind: string; active: boolean; phone: string | null; institutional_email: string | null;
  source_sheet: string | null; source_line: number | null;
}>;
export type SchoolStaging = Readonly<{
  fonte: Readonly<{ arquivo: string; sha256: string; origem: string; data_referencia: string }>;
  valid_from: string; escolas: readonly StagedSchool[];
}>;
export const SCHOOL_STAGING = staging as unknown as SchoolStaging;

export type ProposalRow = Readonly<{
  inep: string; schoolId: string; name: string; dependency: string; privateCategory: string | null;
  partnership: string | null; location: string; active: boolean; phone: string | null; email: string | null;
  sheet: string | null; line: number | null;
  status: "novo" | "ja-cadastrado" | "inep-invalido" | "duplicado-na-fonte";
}>;

export const normalizeName = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
export const normalizeInep = (s: string) => s.replace(/\D/g, "");

/** "municipal" × "privada conveniada à rede" — rótulo de apresentação derivado só dos valores da fonte. */
export function unitKindLabel(dependency: string | null, partnership: string | null): string {
  if (!dependency) return "dependência não informada";
  if (dependency.toLowerCase() === "municipal") return "unidade municipal";
  if (partnership) return `unidade ${dependency} conveniada (poder público: ${partnership})`;
  return `unidade ${dependency}`;
}

export function buildSchoolProposal(src: SchoolStaging, existingIneps: ReadonlySet<string>): ProposalRow[] {
  const seen = new Set<string>();
  return src.escolas.map((e) => {
    const inep = normalizeInep(e.inep);
    const base = {
      inep, schoolId: `inep-${inep}`, name: normalizeName(e.official_name), dependency: e.administrative_dependency,
      privateCategory: e.private_school_category, partnership: e.partnership_public_authority, location: e.location_kind,
      active: e.active, phone: e.phone, email: e.institutional_email, sheet: e.source_sheet, line: e.source_line,
    };
    if (inep.length !== 8) return { ...base, status: "inep-invalido" as const };
    if (seen.has(inep)) return { ...base, status: "duplicado-na-fonte" as const };
    seen.add(inep);
    return { ...base, status: existingIneps.has(inep) ? "ja-cadastrado" as const : "novo" as const };
  });
}

export type ImportInput = Readonly<{ act: string; validFrom: string }>;
export type ImportOutcome = Readonly<{ inep: string; ok: boolean; message: string | null }>;
type Rpc = (fn: "register_school_record_version", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Referência documental é opcional; só a vigência é exigida. */
export function importInputProblem(i: ImportInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.validFrom)) return "Informe a data de início da vigência.";
  return null;
}

export function provenanceRef(act: string, src: SchoolStaging, r: ProposalRow): string {
  const source = `fonte ${src.fonte.arquivo} sha256:${src.fonte.sha256} ref ${src.fonte.data_referencia} aba ${r.sheet ?? "?"} linha ${r.line ?? "?"}`;
  return act.trim() ? `${act.trim()} | ${source}` : source;
}

export function writerArgs(r: ProposalRow, input: ImportInput, src: SchoolStaging): Record<string, unknown> {
  return {
    _school: r.schoolId, _base_version_id: null, _official_name: r.name, _address: null, _district: null,
    _location_kind: r.location, _active: r.active, _valid_from: input.validFrom, _justification: null,
    _act_ref: provenanceRef(input.act, src, r), _inep: r.inep, _network_code: null,
    _phone: r.phone, _email: r.email, _own_building: null, _hard_access: null, _classroom_count: null,
    _administrative_dependency: r.dependency, _private_school_category: r.privateCategory,
    _partnership_public_authority: r.partnership,
  };
}

/** Grava as selecionadas em sequência; uma falha não desfaz as anteriores nem impede as seguintes. */
export async function importSelectedSchools(rows: readonly ProposalRow[], input: ImportInput, rpc: Rpc, src: SchoolStaging = SCHOOL_STAGING): Promise<ImportOutcome[]> {
  const problem = importInputProblem(input);
  if (problem) throw new Error(problem);
  const out: ImportOutcome[] = [];
  for (const r of rows) {
    if (r.status !== "novo") { out.push({ inep: r.inep, ok: false, message: `ignorada (${r.status})` }); continue; }
    const { error } = await rpc("register_school_record_version", writerArgs(r, input, src));
    out.push({ inep: r.inep, ok: !error, message: error?.message ?? null });
  }
  return out;
}
