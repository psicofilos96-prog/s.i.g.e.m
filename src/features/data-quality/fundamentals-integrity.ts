/**
 * SIGEM 2.0 — A: lacunas-raiz de identidade, vínculos e dados fundamentais.
 * Projeção pura: classifica, nunca corrige. Cada lacuna aponta o writer canônico que a resolve.
 */

export type Gap = Readonly<{ code: string; kind: "pendente" | "a-revisar" | "falha-de-escopo" | "ausencia-real"; fixVia: string | null }>;

/** Início da matrícula: só declaração da Secretaria; data técnica nunca serve. */
export function enrollmentStart(e: { declaredStart: string | null; technicalCreatedAt?: string | null }): Gap | null {
  if (e.declaredStart) return null;
  return { code: "matricula-sem-inicio-declarado", kind: "pendente", fixVia: "secretariat_declare_enrollment_start" };
}

/** Estudante em >1 escola: sobreposição exige revisão temporal; nunca fusão nem escolha automática. */
export function multiSchool(rows: readonly { school: string; year: string; opened: string | null; closed: string | null }[]): Gap | null {
  const bySchool = new Set(rows.map((r) => r.school));
  if (bySchool.size < 2) return null;
  const sameYear = rows.some((a, i) => rows.some((b, j) => j > i && a.school !== b.school && a.year === b.year));
  if (!sameYear) return null;
  const datesKnown = rows.every((r) => r.opened != null);
  if (datesKnown) {
    const overlap = rows.some((a, i) => rows.some((b, j) => j > i && a.school !== b.school && a.year === b.year &&
      a.opened! <= (b.closed ?? "9999") && b.opened! <= (a.closed ?? "9999")));
    if (!overlap) return null; // sucessão temporal legítima (transferência)
  }
  return { code: datesKnown ? "matricula-simultanea" : "multiescola-sem-datas", kind: "a-revisar", fixVia: "record_student_movement" };
}

/** Turma sem etapa: composição declarada é a fonte; nome da turma nunca. */
export function classStage(c: { compositionPositions: number }): Gap | null {
  return c.compositionPositions > 0 ? null : { code: "turma-sem-composicao", kind: "pendente", fixVia: "secretariat_create_class" };
}

/** Docente com 0 estudantes: distinguir ausência real de falha de escopo. */
export function teacherRoster(t: { hasEngagement: boolean; classesInScope: number | null; allocationsReadable: boolean; students: number }): Gap | null {
  if (!t.hasEngagement) return { code: "docente-sem-atuacao", kind: "falha-de-escopo", fixVia: "record_engagement" };
  if (t.classesInScope == null || !t.allocationsReadable) return { code: "escopo-nao-lido", kind: "falha-de-escopo", fixVia: null };
  if (t.classesInScope === 0) return { code: "docente-sem-turma-atribuida", kind: "pendente", fixVia: "atribuicao-docente" };
  if (t.students === 0) return { code: "turma-sem-enturmacao", kind: "ausencia-real", fixVia: "manter-matricula-e-enturmacao" };
  return null;
}

/** Planilha × lotação: só matrícula funcional exata concilia; nome é no máximo candidato. */
export function staffMatch(row: { registration: string | null; fullName: string }, people: readonly { id: string; registration: string | null; name: string }[]) {
  const reg = row.registration?.trim();
  if (reg) {
    const hits = people.filter((p) => p.registration?.trim() === reg);
    if (hits.length === 1) return { state: "conciliado" as const, personId: hits[0].id };
    if (hits.length > 1) return { state: "ambiguo" as const, personId: null };
  }
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
  const byName = people.filter((p) => norm(p.name) === norm(row.fullName)).map((p) => p.id);
  return { state: byName.length ? ("candidato-por-nome" as const) : ("sem-identificador" as const), personId: null, candidates: byName };
}

/** Jornada sem fonte declarada nunca vira carga presumida. */
export function workloadSource(j: { hours: number | null; sourceRef: string | null }): Gap | null {
  if (j.hours != null && j.sourceRef) return null;
  return { code: "jornada-sem-fonte", kind: "pendente", fixVia: null };
}

/** Relatório de não resolvidos: contagem por código; contagem desconhecida fica null. */
export function unresolvedReport(gaps: readonly (Gap | null)[]) {
  const out: Record<string, number> = {};
  for (const g of gaps) if (g) out[g.code] = (out[g.code] ?? 0) + 1;
  return out;
}
