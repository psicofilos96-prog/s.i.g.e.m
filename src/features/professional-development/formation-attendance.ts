/**
 * SIGEM Desenvolvimento L12 — frequência formativa (projeção pura; banco = 0441).
 * Unidade = encontro (presencial/remoto síncrono) ou atividade assíncrona. Correção = nova versão com motivo.
 * Abrir/baixar material não é evidência; sem registro = não lançado (fora do denominador), nunca falta.
 */
export type Mode = "presencial" | "remota-sincrona" | "assincrona";
export type Status = "presente" | "ausente" | "ausencia-justificada";
export type EvidenceKind = "lista-de-presenca" | "registro-de-conexao-com-duracao" | "entrega-de-atividade" | "observacao-do-formador";

export const REFUSED_EVIDENCE = ["acesso-a-material", "download", "visualizacao", "clique"] as const;

export type AttendanceRecord = Readonly<{ unitId: string; version: number; mode: Mode; status: Status;
  evidenceKind: EvidenceKind | null; evidenceRef: string | null; connectedMinutes: number | null; reason: string | null }>;

/** Espelha os CHECKs do banco. */
export function recordProblems(r: Omit<AttendanceRecord, "unitId"> & { evidenceKindRaw?: string }): string[] {
  const p: string[] = [];
  if (r.evidenceKindRaw && (REFUSED_EVIDENCE as readonly string[]).includes(r.evidenceKindRaw)) p.push("Abrir ou baixar material não prova participação.");
  if (r.status === "presente" && (!r.evidenceKind || !r.evidenceRef?.trim())) p.push("Presença exige evidência e referência.");
  if (r.mode === "assincrona" && r.status === "presente" && r.evidenceKind !== "entrega-de-atividade") p.push("Atividade assíncrona só conta com entrega registrada.");
  if (r.mode === "remota-sincrona" && r.status === "presente") {
    if (r.evidenceKind !== "registro-de-conexao-com-duracao" && r.evidenceKind !== "observacao-do-formador") p.push("Remoto síncrono exige registro de conexão com duração ou observação do formador.");
    if (r.evidenceKind === "registro-de-conexao-com-duracao" && r.connectedMinutes == null) p.push("Informe os minutos conectados.");
  }
  if (r.status === "ausencia-justificada" && !r.reason?.trim()) p.push("Ausência justificada exige motivo.");
  if (r.version > 1 && (r.reason?.trim().length ?? 0) < 10) p.push("Correção exige motivo (10+ caracteres).");
  return p;
}

/** Versão vigente por unidade; lacuna na cadeia ⇒ unidade ambígua. */
export function currentRecords(records: readonly AttendanceRecord[]) {
  const by = new Map<string, AttendanceRecord[]>();
  for (const r of records) by.set(r.unitId, [...(by.get(r.unitId) ?? []), r]);
  const current = new Map<string, AttendanceRecord>(); const ambiguous: string[] = [];
  for (const [u, rs] of by) {
    const s = [...rs].sort((a, b) => a.version - b.version);
    if (s.some((x, i) => x.version !== i + 1)) ambiguous.push(u); else current.set(u, s[s.length - 1]!);
  }
  return { current, ambiguous };
}

/**
 * Frequência sobre as unidades previstas (encontros não cancelados + atividades).
 * Percentual só fecha quando TODAS estão lançadas e sem ambiguidade; senão null com pendências, porque falta presumida seria fato falso.
 * Ausência justificada fica fora do denominador.
 */
export function attendanceSummary(expectedUnits: readonly string[], records: readonly AttendanceRecord[]) {
  const { current, ambiguous } = currentRecords(records);
  const notRecorded = expectedUnits.filter((u) => !current.has(u) && !ambiguous.includes(u));
  const counted = expectedUnits.map((u) => current.get(u)).filter((r): r is AttendanceRecord => !!r);
  const present = counted.filter((r) => r.status === "presente").length;
  const absent = counted.filter((r) => r.status === "ausente").length;
  const justified = counted.filter((r) => r.status === "ausencia-justificada").length;
  const denom = present + absent;
  const complete = notRecorded.length === 0 && ambiguous.length === 0;
  return { present, absent, justified, notRecorded, ambiguous,
    pct: complete && denom > 0 ? Math.round((present / denom) * 10000) / 100 : null };
}
