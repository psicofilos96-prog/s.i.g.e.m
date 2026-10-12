/**
 * L44 — consolidação futura de logins da mesma pessoa. Login de autenticação ≠ pessoa ≠ matrícula.
 * Dois logins de matrícula só podem ser propostos para consolidação quando AMBAS as matrículas têm
 * ligação vigente e comprovada (ledger humano payroll_registration_person_links) à MESMA pessoa natural.
 * Nome, nascimento, cargo ou agrupamento visual nunca bastam. A função só propõe; executar é ato humano.
 */
export type LoginRef = { userId: string; registrationNorm: string | null };
export type ProvenLink = { registrationNorm: string; personId: string; revoked: boolean };

export type ConsolidationProposal = { personId: string; userIds: string[]; registrations: string[] };
export type ConsolidationRefusal = { userId: string; reason: "sem-matricula" | "sem-ligacao-comprovada" | "ligacao-ambigua" };

export function proposeConsolidations(logins: readonly LoginRef[], links: readonly ProvenLink[]) {
  const byReg = new Map<string, Set<string>>();
  for (const l of links) if (!l.revoked) {
    const s = byReg.get(l.registrationNorm) ?? new Set<string>(); s.add(l.personId); byReg.set(l.registrationNorm, s);
  }
  const groups = new Map<string, ConsolidationProposal>();
  const refused: ConsolidationRefusal[] = [];
  for (const g of logins) {
    if (!g.registrationNorm) { refused.push({ userId: g.userId, reason: "sem-matricula" }); continue; }
    const persons = byReg.get(g.registrationNorm);
    if (!persons || persons.size === 0) { refused.push({ userId: g.userId, reason: "sem-ligacao-comprovada" }); continue; }
    if (persons.size > 1) { refused.push({ userId: g.userId, reason: "ligacao-ambigua" }); continue; }
    const pid = [...persons][0]!;
    const p = groups.get(pid) ?? { personId: pid, userIds: [], registrations: [] };
    p.userIds.push(g.userId); p.registrations.push(g.registrationNorm); groups.set(pid, p);
  }
  return { proposals: [...groups.values()].filter((p) => p.userIds.length > 1), refused };
}
