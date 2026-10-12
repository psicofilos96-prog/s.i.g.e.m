// Tecnologia L08 — atendimentos presenciais e remotos (migration 0482). Sessão append-only do chamado, registrada
// só pela pessoa da atuação responsável vigente; retificação cita a anterior com motivo e a substitui na leitura.
// Resultado de sessão é fato do atendimento, nunca muda o estado do chamado (conclusão/verificação são L05).
export type Mode = "presencial" | "remoto";
export type Result = "resolvido" | "parcial" | "nao-resolvido" | "nao-realizado";
export interface Session { id: string; seq: number; mode: Mode; spaceId: string | null; startedAt: string; endedAt: string; result: Result; summary: string; rectifies: string | null; reason: string | null; personId: string }

export function sessionProblem(s: { mode: Mode; spaceId: string | null; startedAt: string; endedAt: string; summary: string; rectifies: string | null; reason: string | null }, ticketCreatedAt: string, now: string): string | null {
  const a = Date.parse(s.startedAt), b = Date.parse(s.endedAt);
  if (!(b > a)) return "periodo-invalido";
  if (b - a > 24 * 3_600_000) return "periodo-longo-demais";
  if (b > Date.parse(now) + 300_000) return "periodo-futuro";
  if (a < Date.parse(ticketCreatedAt)) return "anterior-ao-chamado";
  if (s.mode === "remoto" && s.spaceId) return "remoto-com-espaco";
  if (s.summary.trim().length < 10) return "resumo-curto";
  if (s.rectifies && (s.reason?.trim().length ?? 0) < 10) return "retificacao-sem-motivo";
  return null;
}

/** Sessões vigentes: as retificadas saem da leitura, mas permanecem no histórico. */
export function effectiveSessions(ss: readonly Session[]): Session[] {
  const replaced = new Set(ss.map((s) => s.rectifies).filter(Boolean));
  return [...ss].filter((s) => !replaced.has(s.id)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function sessionSummary(ss: readonly Session[]) {
  const eff = effectiveSessions(ss);
  const by = (m: Mode) => eff.filter((s) => s.mode === m);
  const minutes = (xs: Session[]) => xs.reduce((t, s) => t + (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000, 0);
  const results = Object.fromEntries((["resolvido", "parcial", "nao-resolvido", "nao-realizado"] as const).map((r) => [r, eff.filter((s) => s.result === r).length]));
  return { sessions: eff.length, presencial: by("presencial").length, remoto: by("remoto").length,
    minutesPresencial: minutes(by("presencial")), minutesRemoto: minutes(by("remoto")), results, lastResult: eff.at(-1)?.result ?? null, rectified: ss.length - eff.length };
}
