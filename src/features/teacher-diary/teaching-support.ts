/**
 * N10.2.4 — "Há mediação vigente" na área do professor: projeção pura de `inclusion_teaching_support_flags`
 * (o reader só devolve as próprias turmas). Nome só de quem está na lista da turma do professor; flag de
 * estudante fora da lista nunca aparece por id. Nenhum conteúdo de PEI/registro/clínico chega aqui.
 */
export type SupportFlag = Readonly<{ class_id: string; student_id: string; has_active_mediation: boolean }>;
export type SupportClass = Readonly<{ classId: string; className: string; students: readonly string[] }>;

export function supportByClass(
  flags: readonly SupportFlag[],
  classes: readonly { classId: string; className: string }[],
  nameOf: (studentId: string) => string | null,
): SupportClass[] {
  const own = new Map(classes.map((c) => [c.classId, c.className]));
  const by = new Map<string, Set<string>>();
  for (const f of flags) {
    if (!f.has_active_mediation || !own.has(f.class_id)) continue;
    const n = nameOf(f.student_id); if (!n) continue;
    by.set(f.class_id, (by.get(f.class_id) ?? new Set()).add(n));
  }
  return [...by].map(([classId, s]) => ({ classId, className: own.get(classId)!, students: [...s].sort((a, b) => a.localeCompare(b, "pt-BR")) }))
    .sort((a, b) => a.className.localeCompare(b.className, "pt-BR"));
}
