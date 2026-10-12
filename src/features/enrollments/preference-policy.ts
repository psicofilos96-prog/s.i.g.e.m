// Matrículas L08 — preferências de escola/turno/oferta conforme política aprovada da campanha.
// Preferência é só ordem declarada para a distribuição (L09): nunca promete vaga.
// Sem política aprovada ⇒ nada é aceito (falha fechada; o banco repete a regra em trigger, migration 0460).

export type PreferencePolicy = {
  version: number; min: number; max: number; ordering: "ordenada" | "sem-ordem";
  shifts: string[]; offers: string[];
};
export type Preference = { schoolId: string; shiftId?: string | null; offerId?: string | null };
export type PreferenceProblem =
  | "sem-politica" | "abaixo-do-minimo" | "acima-do-maximo" | "repetida"
  | "escola-fora-da-campanha" | "turno-nao-admitido" | "oferta-nao-admitida";

export const NO_PROMISE_NOTICE =
  "Escolher escolas não garante vaga. A vaga só existe depois da distribuição e da confirmação pela escola.";

export function preferenceProblems(p: PreferencePolicy | null, prefs: Preference[], campaignSchools: string[]): PreferenceProblem[] {
  if (!p) return ["sem-politica"];
  const out = new Set<PreferenceProblem>();
  if (prefs.length < p.min) out.add("abaixo-do-minimo");
  if (prefs.length > p.max) out.add("acima-do-maximo");
  const allowed = new Set(campaignSchools);
  const seen = new Set<string>();
  for (const x of prefs) {
    const k = `${x.schoolId}|${x.shiftId ?? ""}|${x.offerId ?? ""}`;
    if (seen.has(k)) out.add("repetida");
    seen.add(k);
    if (!allowed.has(x.schoolId)) out.add("escola-fora-da-campanha");
    // Turno/oferta só se a política os declarar; lista vazia = não se escolhe (nunca "qualquer").
    if (x.shiftId != null && !p.shifts.includes(x.shiftId)) out.add("turno-nao-admitido");
    if (x.offerId != null && !p.offers.includes(x.offerId)) out.add("oferta-nao-admitida");
  }
  return [...out];
}

/** Ordem enviada à distribuição: posição 1..n se a política é ordenada; null se sem-ordem (nunca inventar prioridade). */
export function rankedPreferences(p: PreferencePolicy, prefs: Preference[]): Array<Preference & { rank: number | null }> {
  return prefs.map((x, i) => ({ ...x, rank: p.ordering === "ordenada" ? i + 1 : null }));
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const c = [...list]; const [x] = c.splice(from, 1) as [T]; c.splice(to, 0, x); return c;
}

export const PROBLEM_TEXT: Record<PreferenceProblem, string> = {
  "sem-politica": "As regras de preferência desta campanha ainda não foram aprovadas. Inscrições indisponíveis.",
  "abaixo-do-minimo": "Escolha mais escolas, conforme o mínimo da campanha.",
  "acima-do-maximo": "Você escolheu mais escolas do que a campanha permite.",
  repetida: "Há uma escolha repetida.",
  "escola-fora-da-campanha": "Uma escola escolhida não participa desta campanha.",
  "turno-nao-admitido": "Um turno escolhido não é oferecido nesta campanha.",
  "oferta-nao-admitida": "Uma oferta escolhida não é admitida nesta campanha.",
};

/** Política proposta: regras estruturais checadas antes do writer (que as repete). */
export function policyDraftProblems(d: { min: number; max: number; justification: string }): string[] {
  const e: string[] = [];
  if (!Number.isInteger(d.min) || d.min < 1) e.push("minimo-invalido");
  if (!Number.isInteger(d.max) || d.max > 10 || d.max < d.min) e.push("maximo-invalido");
  if (d.justification.trim().length < 20) e.push("justificativa-curta");
  return e;
}
