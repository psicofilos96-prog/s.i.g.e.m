/**
 * R4 — Propostas de atuação a partir das planilhas de pessoal. Puro: só propõe.
 * Vínculo só por chave inequívoca (matrícula funcional já registrada como identificador
 * da pessoa + INEP da escola + vigência declarada). Nome nunca vincula. Nada é gravado aqui;
 * a execução passa pelo writer canônico de atuação, com autoria humana.
 */
export type StaffRow = { sourceSha256: string; sheet: string; rowNo: number; schoolInep: string | null; registration: string | null; functionLabel: string | null; validFrom: string | null; validUntil: string | null };
export type PersonIndex = ReadonlyMap<string, readonly string[]>; // matrícula funcional → person_ids
export type SchoolIndex = ReadonlySet<string>; // INEPs oficiais

export type Pending = "sem-matricula-funcional" | "matricula-sem-pessoa" | "matricula-ambigua" | "escola-nao-identificada" | "vigencia-ausente" | "funcao-nao-comprovada" | "duplicada";
export type Proposal = { key: string; personId: string; schoolInep: string; functionLabel: string; validFrom: string; validUntil: string | null; provenance: string };

export const proposalKey = (r: StaffRow) => `${r.sourceSha256}:${r.sheet}:${r.rowNo}`;

export function proposeEngagements(rows: readonly StaffRow[], persons: PersonIndex, schools: SchoolIndex) {
  const ready: Proposal[] = []; const pending: { key: string; reason: Pending }[] = []; const seen = new Set<string>();
  for (const r of rows) {
    const key = proposalKey(r);
    if (seen.has(key)) { pending.push({ key, reason: "duplicada" }); continue; }
    seen.add(key);
    const reg = r.registration?.trim();
    if (!reg) { pending.push({ key, reason: "sem-matricula-funcional" }); continue; }
    const ids = persons.get(reg) ?? [];
    if (ids.length === 0) { pending.push({ key, reason: "matricula-sem-pessoa" }); continue; }
    if (ids.length > 1) { pending.push({ key, reason: "matricula-ambigua" }); continue; }
    if (!r.schoolInep || !schools.has(r.schoolInep)) { pending.push({ key, reason: "escola-nao-identificada" }); continue; }
    if (!r.validFrom) { pending.push({ key, reason: "vigencia-ausente" }); continue; }
    if (!r.functionLabel?.trim()) { pending.push({ key, reason: "funcao-nao-comprovada" }); continue; }
    ready.push({ key, personId: ids[0]!, schoolInep: r.schoolInep, functionLabel: r.functionLabel.trim(), validFrom: r.validFrom, validUntil: r.validUntil, provenance: `${r.sheet}#${r.rowNo}@${r.sourceSha256.slice(0, 12)}` });
  }
  // Conflito: mesma pessoa e escola com vigências sobrepostas e funções diferentes.
  const conflicts = ready.flatMap((a, i) => ready.slice(i + 1).filter((b) => b.personId === a.personId && b.schoolInep === a.schoolInep && b.functionLabel !== a.functionLabel && (a.validUntil ?? "9999") >= b.validFrom && (b.validUntil ?? "9999") >= a.validFrom).map((b) => [a.key, b.key] as const));
  const summary: Record<string, number> = {};
  for (const p of pending) summary[p.reason] = (summary[p.reason] ?? 0) + 1;
  return { ready, pending, conflicts, summary };
}

/** Docente em turma/disciplina só com função docente comprovada e proposta pronta; senão pendente com motivo. */
export function teachingAssignmentGate(p: Proposal | null, componentId: string | null, classId: string | null) {
  if (!p) return { ok: false as const, reason: "Sem atuação comprovada" };
  if (!/profess|docen|regent/i.test(p.functionLabel)) return { ok: false as const, reason: "Função docente não comprovada" };
  if (!classId || !componentId) return { ok: false as const, reason: "Turma ou componente não informado" };
  return { ok: true as const };
}
