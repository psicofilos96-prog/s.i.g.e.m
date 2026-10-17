/** Regras puras dos documentos de movimentação (declaração de transferência e termo de renovação). */

/** Validade da declaração: data de emissão + N dias corridos (N vem do parâmetro da Secretaria). */
export function declarationValidUntil(issuedOn: string, days: number): string {
  if (!Number.isInteger(days) || days < 1) throw new Error("validade inválida");
  const d = new Date(`${issuedOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Número exibido: sequencial da escola no ano, ex.: 007/2027. */
export const declarationNumberLabel = (n: number, year: number) => `${String(n).padStart(3, "0")}/${year}`;

export type RenewalCandidate = { student_id: string; display_name: string; decision: string | null; decision_sequence: number | null; resulting_enrollment_id: string | null };
export type RenewalGroups = { prontos: RenewalCandidate[]; renovados: RenewalCandidate[]; excecoes: RenewalCandidate[] };

/** Prontos = sem decisão; já renovados; exceções = outra decisão registrada (transferido, não renovou). */
export function groupRenewal(rows: RenewalCandidate[]): RenewalGroups {
  const g: RenewalGroups = { prontos: [], renovados: [], excecoes: [] };
  for (const r of rows) (r.decision === "renovou" ? g.renovados : r.decision ? g.excecoes : g.prontos).push(r);
  return g;
}

/** Impressão digital da prévia: se a lista mudar entre ver e confirmar, a confirmação é recusada. */
export function renewalFingerprint(rows: RenewalCandidate[]): string {
  return rows.map((r) => `${r.student_id}:${r.decision ?? "-"}:${r.decision_sequence ?? 0}`).sort().join("|");
}
