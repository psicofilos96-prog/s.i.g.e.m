/**
 * Frente V — modelo puro da organização da oferta (jornada, grade, atribuição, substituição,
 * horário projetado, carga e prontidão do Diário). Sem I/O. As regras definitivas vivem no banco
 * (writers SECURITY DEFINER); aqui só existe pré-validação para orientar quem preenche e
 * tradução de códigos estáveis para português. Nada é inferido: ausência continua ausência.
 */

export type Interval = { weekday: number; startsAt: string; endsAt: string };
export type DraftBlock = Interval & { blockKey: string; matrixVersionId: string | null; itemKey: string | null };

export const WEEKDAYS: readonly { n: number; label: string }[] = [
  { n: 1, label: "Segunda" }, { n: 2, label: "Terça" }, { n: 3, label: "Quarta" },
  { n: 4, label: "Quinta" }, { n: 5, label: "Sexta" }, { n: 6, label: "Sábado" }, { n: 7, label: "Domingo" },
];
export const weekdayLabel = (n: number) => WEEKDAYS.find((d) => d.n === n)?.label ?? `Dia ${n}`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const intervalMinutes = (i: Interval) => toMin(i.endsAt) - toMin(i.startsAt);

/** Erros de preenchimento da jornada (o banco revalida tudo). */
export function journeyDraftIssues(intervals: readonly Interval[]): string[] {
  const out: string[] = [];
  if (intervals.length === 0) out.push("Informe ao menos um intervalo de funcionamento.");
  intervals.forEach((i, k) => {
    if (!(i.weekday >= 1 && i.weekday <= 7)) out.push(`Intervalo ${k + 1}: dia da semana inválido.`);
    if (!TIME.test(i.startsAt) || !TIME.test(i.endsAt)) out.push(`Intervalo ${k + 1}: horário inválido.`);
    else if (toMin(i.startsAt) >= toMin(i.endsAt)) out.push(`Intervalo ${k + 1}: o início precisa ser antes do fim.`);
  });
  for (let a = 0; a < intervals.length; a++)
    for (let b = a + 1; b < intervals.length; b++) {
      const x = intervals[a]!, y = intervals[b]!;
      if (x.weekday === y.weekday && TIME.test(x.startsAt) && TIME.test(y.startsAt) && toMin(x.startsAt) < toMin(y.endsAt) && toMin(y.startsAt) < toMin(x.endsAt))
        out.push(`${weekdayLabel(x.weekday)}: os intervalos ${a + 1} e ${b + 1} se sobrepõem.`);
    }
  return out;
}

/** Erros de preenchimento da grade frente à jornada vigente (o banco revalida tudo). */
export function scheduleDraftIssues(blocks: readonly DraftBlock[], journey: readonly Interval[]): string[] {
  const out: string[] = [];
  if (blocks.length === 0) out.push("Informe ao menos um bloco.");
  if (journey.length === 0) out.push("A turma não tem jornada vigente; registre a jornada antes da grade.");
  const keys = new Set<string>();
  blocks.forEach((b, k) => {
    const n = `Bloco ${k + 1}`;
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(b.blockKey)) out.push(`${n}: chave inválida.`);
    if (keys.has(b.blockKey)) out.push(`${n}: chave repetida.`);
    keys.add(b.blockKey);
    if (!TIME.test(b.startsAt) || !TIME.test(b.endsAt) || toMin(b.startsAt) >= toMin(b.endsAt)) out.push(`${n}: horário inválido.`);
    if (!b.matrixVersionId || !b.itemKey) out.push(`${n}: escolha o elemento curricular da matriz aplicável.`);
    else if (journey.length > 0 && !journey.some((j) => j.weekday === b.weekday && toMin(j.startsAt) <= toMin(b.startsAt) && toMin(b.endsAt) <= toMin(j.endsAt)))
      out.push(`${n}: fora da jornada da turma.`);
  });
  for (let a = 0; a < blocks.length; a++)
    for (let c = a + 1; c < blocks.length; c++) {
      const x = blocks[a]!, y = blocks[c]!;
      if (x.weekday === y.weekday && TIME.test(x.startsAt) && TIME.test(y.startsAt) && toMin(x.startsAt) < toMin(y.endsAt) && toMin(y.startsAt) < toMin(x.endsAt))
        out.push(`${weekdayLabel(x.weekday)}: blocos ${a + 1} e ${c + 1} se sobrepõem (paralelismo não tem norma definida).`);
    }
  return out;
}

/** Conflito temporal potencial entre blocos de um mesmo profissional (não é ilegalidade presumida). */
export function personConflicts<T extends Interval & { id: string }>(blocks: readonly T[]): [string, string][] {
  const out: [string, string][] = [];
  for (let a = 0; a < blocks.length; a++)
    for (let b = a + 1; b < blocks.length; b++) {
      const x = blocks[a]!, y = blocks[b]!;
      if (x.weekday === y.weekday && toMin(x.startsAt) < toMin(y.endsAt) && toMin(y.startsAt) < toMin(x.endsAt)) out.push([x.id, y.id]);
    }
  return out;
}

/** Saldo só existe com carga contratual conhecida; ausência nunca vira zero. */
export function balanceText(contractualMinutes: number | null, assignedMinutes: number | null): string {
  if (contractualMinutes == null) return "Saldo não calculável: carga contratual não informada por fonte funcional.";
  if (assignedMinutes == null) return "Saldo não calculável: carga atribuída indisponível.";
  return `Saldo descritivo: ${contractualMinutes - assignedMinutes} min (minutos de bloco não equivalem a hora-aula normativa).`;
}

export type ReadinessRow = { scope: string; subjectRef: string; code: string; state: string };
export type ReadinessResult = "ready" | "blocked" | "unavailable";

const READINESS: Record<string, string> = {
  "acesso-negado": "Você não tem acesso à organização desta turma.",
  "ano-sem-estado": "O ano letivo não tem estado operacional registrado.",
  "ano-em-preparacao:organizacao-permitida-diario-nao": "Ano em preparação: a organização pode ser montada, mas o Diário ainda não pode ser executado.",
  "turma-nao-vigente": "A turma não está vigente na data.",
  "organizacao-de-periodos-ausente": "A turma não tem organização de períodos vigente.",
  "matriz-nao-resolvida": "Nenhuma matriz curricular foi resolvida para a turma.",
  "jornada-ausente": "A jornada da turma não foi registrada.",
  "grade-ausente": "A grade semanal da turma não foi registrada.",
  "referencia-curricular-nao-comprovada": "Bloco com elemento curricular não comprovado na matriz aplicável.",
  "bloco-sem-atribuicao-docente": "Bloco sem atribuição docente vigente.",
  "substituicao-vigente": "Há substituição temporária vigente (informativo).",
};
export function readinessText(code: string): string {
  if (READINESS[code]) return READINESS[code]!;
  if (code.startsWith("ano-nao-operacional:")) return "O ano letivo não está operacional.";
  if (code.startsWith("grade-nao-utilizavel:")) return "A grade existe, mas tem pendências que a tornam não utilizável.";
  if (code.startsWith("atribuicao-")) return "Atribuição docente com pendência na data.";
  if (code.startsWith("fonte-indisponivel:")) return "Uma fonte necessária não pôde ser lida; nada foi concluído.";
  return "Pendência sem descrição cadastrada.";
}
export function readinessResult(rows: readonly ReadinessRow[]): ReadinessResult {
  const r = rows.find((x) => x.scope === "resultado");
  if (!r || !["ready", "blocked", "unavailable"].includes(r.state)) return "unavailable";
  return r.state as ReadinessResult;
}

const ERRORS: [string, string][] = [
  ["session-required", "Entre com sua conta para continuar."],
  ["person-required", "Sua conta não está vinculada a uma pessoa institucional."],
  ["capability:", "Sua atuação não tem competência para esta operação nesta escola e data."],
  ["year-without-state", "O ano letivo ainda não foi aberto para preparação."],
  ["year-not-writable", "O ano letivo não aceita esta operação (histórico ou encerrado)."],
  ["window-outside-year", "O período informado está fora do ano letivo da turma."],
  ["stale-head", "Os dados mudaram desde que você abriu a tela. Recarregue antes de continuar."],
  ["reason-required", "Informe o motivo."],
  ["interval-overlap", "Há intervalos sobrepostos no mesmo dia."],
  ["outside-class-validity", "O período não cabe na existência da turma."],
  ["journey-absent", "A turma não tem jornada vigente em todo o período."],
  ["block-outside-journey", "Há bloco fora da jornada da turma."],
  ["block-overlap", "Há blocos sobrepostos."],
  ["matrix-not-applicable", "A matriz escolhida não se aplica à turma em todo o período."],
  ["element-not-in-matrix", "O elemento escolhido não pertence a essa versão da matriz."],
  ["component-without-matrix-item", "Escolha o elemento pela matriz aplicável, não só o componente."],
  ["responsibles-come-from-teaching-assignments", "Responsáveis por bloco vêm das atribuições docentes."],
  ["functional-link", "O vínculo funcional escolhido não é da pessoa ou não está vigente em todo o período."],
  ["no-school-posting-throughout", "O profissional não tem lotação nesta escola em todo o período."],
  ["engagement", "A atuação escolhida não é da escola ou não está vigente em todo o período."],
  ["outside-titular-window", "A substituição precisa caber no período da atribuição titular."],
  ["substitute-is-titular", "O substituto não pode ser o próprio titular."],
  ["substitution:overlap", "Já existe substituição nesse período para esta atribuição."],
  ["assignment:overlap", "Esta atuação já está atribuída a este elemento em período sobreposto."],
  ["end-required", "A substituição temporária precisa de data de término."],
];
export function humanOfferError(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return ERRORS.find(([k]) => m.includes(k))?.[1] ?? "A operação não foi concluída.";
}
