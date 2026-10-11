/**
 * Prevenção de homônimos na busca sem CPF. Um candidato só pode ser escolhido quando algo o distingue
 * dos demais com o mesmo nome no resultado: identificador interno próprio ou data de nascimento própria.
 * Sem distinção, a tela pede outro dado — nunca escolhe "o primeiro".
 */
export type LookupCandidate = Readonly<{ student_id: string; name: string; internal_id: string | null; birth_date?: string | null; homonyms?: number }>;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function candidateDisambiguation(c: LookupCandidate, all: readonly LookupCandidate[]): { ok: true } | { ok: false; reason: string } {
  const same = all.filter((x) => norm(x.name) === norm(c.name));
  if (same.length <= 1 && (c.homonyms ?? 1) <= 1) return { ok: true };
  const others = same.filter((x) => x.student_id !== c.student_id);
  const idUnique = !!c.internal_id && others.every((x) => x.internal_id !== c.internal_id);
  const birthUnique = !!c.birth_date && others.every((x) => x.birth_date !== c.birth_date);
  if (idUnique || birthUnique) return { ok: true };
  return { ok: false, reason: "Homônimo sem dado que o distinga: busque pelo identificador ou informe a data de nascimento." };
}
