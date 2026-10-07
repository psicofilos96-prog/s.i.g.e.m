// N11.2.3 — Transporte escolar: projeção pura sobre fatos append-only (school_transport_facts).
// Nenhuma regra de elegibilidade, distância ou capacidade existe aqui: só o que foi registrado.
export type TransportKind = "rota" | "ponto" | "vinculo-estudante";
export type TransportFact = {
  id: string; school_id: string; kind: TransportKind; logical_id: string; version: number;
  route_logical_id: string | null; stop_logical_id: string | null; student_id: string | null;
  label: string | null; valid_from: string; valid_until: string | null; revoked: boolean; recorded_at: string;
};

/** Cabeça de cada fato lógico conhecida até knownAt (null = agora). */
export function heads(rows: readonly TransportFact[], knownAt: string | null = null): TransportFact[] {
  const best = new Map<string, TransportFact>();
  for (const r of rows) {
    if (knownAt && r.recorded_at > knownAt) continue;
    const cur = best.get(r.logical_id);
    if (!cur || r.version > cur.version) best.set(r.logical_id, r);
  }
  return [...best.values()];
}

export const activeOn = (f: TransportFact, on: string) =>
  !f.revoked && f.valid_from <= on && (f.valid_until === null || f.valid_until >= on);

export type RoutePicture = { route: TransportFact; stops: { stop: TransportFact; students: TransportFact[] }[] };

/** Rotas vigentes da escola na data, com pontos e estudantes vinculados vigentes. */
export function transportPicture(rows: readonly TransportFact[], schoolId: string, on: string, knownAt: string | null = null): RoutePicture[] {
  const h = heads(rows.filter((r) => r.school_id === schoolId), knownAt).filter((f) => activeOn(f, on));
  return h.filter((f) => f.kind === "rota").map((route) => ({
    route,
    stops: h.filter((s) => s.kind === "ponto" && s.route_logical_id === route.logical_id).map((stop) => ({
      stop,
      students: h.filter((v) => v.kind === "vinculo-estudante" && v.stop_logical_id === stop.logical_id),
    })),
  }));
}

/** Estudante com mais de um vínculo vigente aparece como inconsistência, nunca escolhido por prioridade. */
export function duplicatedStudents(pictures: readonly RoutePicture[]): string[] {
  const count = new Map<string, number>();
  for (const p of pictures) for (const s of p.stops) for (const v of s.students) if (v.student_id) count.set(v.student_id, (count.get(v.student_id) ?? 0) + 1);
  return [...count].filter(([, n]) => n > 1).map(([id]) => id);
}

export const TRANSPORT_ERROR: Record<string, string> = {
  "transporte:sem-sessao": "Sua sessão terminou. Entre novamente.",
  "transporte:sem-autorizacao": "Você não tem autorização para manter o transporte desta escola.",
  "transporte:base-alterada": "Outra pessoa alterou este registro. Recarregue e tente de novo.",
  "transporte:identidade-imutavel": "Este registro pertence a outra escola ou a outro tipo.",
  "transporte:rota-de-outra-escola": "A rota escolhida não é desta escola.",
  "transporte:ponto-de-outra-escola": "O ponto escolhido não é desta escola.",
  "transporte:estudante-sem-matricula-na-escola": "O estudante não tem matrícula nesta escola.",
  "transporte:append-only": "Registros de transporte não são apagados; registre uma nova versão.",
};
export function transportMessage(raw: string): string {
  const key = Object.keys(TRANSPORT_ERROR).find((k) => raw.includes(k));
  return key ? TRANSPORT_ERROR[key] : "Não foi possível registrar. Tente de novo.";
}
