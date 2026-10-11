/** LOTE 04 — rótulos e pendências derivadas da leitura `educacenso_people_at` (puro, sem inferência). */
export type IdState = "valido" | "invalido" | "ausente" | "registrado" | "sem-fonte";
export type PersonRow = { role: "aluno" | "profissional"; local_ref: string; person_id: string | null; masked_name: string | null; inep: IdState; inep_masked: string | null; cpf: IdState; birth: IdState; sex: IdState };
export type PeopleSummary = { students: number; professionals: number; without_person: number; inep_valid: number; inep_invalid: number; inep_missing: number; cpf_present: number; birth_present: number; sex_present: number; staff_records_without_person: number; collisions: number };
export type Collision = { key: string; kind: string; person_ids: string[]; masked_names: string[] | null; review: { seq: number; decision: string; reason: string; recorded_at: string } | null };
export type PeopleAt = { school_id: string; network: boolean; summary: PeopleSummary; people: PersonRow[]; collisions: Collision[] };

export const PEOPLE_STATE_LABEL: Record<IdState, string> = { valido: "válido", invalido: "inválido", ausente: "ausente", registrado: "registrado", "sem-fonte": "sem fonte" };
export const COLLISION_LABEL: Record<string, string> = { "inep-pessoa": "Mesmo código INEP", "cpf-hmac": "Mesmo CPF", "aluno-multiplas-pessoas": "Aluno ligado a mais de uma pessoa" };
export const REVIEW_LABEL: Record<string, string> = { "manter-separados": "pessoas diferentes", "encaminhar-correcao-na-origem": "corrigir na origem", reabrir: "reaberta" };

/** Validação do código INEP de pessoa física: 12 dígitos (guia). Ausente nunca é preenchido. */
export const inepPersonState = (v: string | null | undefined): IdState => (v == null || v === "" ? "ausente" : /^\d{12}$/.test(v) ? "valido" : "invalido");

/** Pendências por extenso para o Registro 30; obrigatórios ausentes nunca viram valor. */
export function peoplePendencies(s: PeopleSummary): string[] {
  const out: string[] = []; const total = s.students + s.professionals;
  const miss = (n: number, what: string) => { if (n > 0) out.push(`${n} de ${total} sem ${what}`); };
  miss(total - s.birth_present - s.professionals, "data de nascimento registrada (alunos)");
  miss(s.students - s.sex_present, "sexo registrado (alunos)");
  if (s.professionals > 0) out.push(`${s.professionals} profissionais sem nascimento/sexo no SIGEM (sem fonte)`);
  miss(s.inep_invalid, "código INEP válido (formato)");
  if (total > 0) out.push(`Cor/raça obrigatória: sem fonte no SIGEM para ${total} pessoas`);
  if (s.without_person > 0) out.push(`${s.without_person} alunos sem pessoa conciliada`);
  if (s.staff_records_without_person > 0) out.push(`${s.staff_records_without_person} registros de pessoal da escola não conciliados a pessoa`);
  if (s.collisions > 0) out.push(`${s.collisions} possíveis duplicidades aguardando a rede`);
  return out;
}
