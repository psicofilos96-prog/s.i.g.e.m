/**
 * SIGEM Desenvolvimento L13 — ambiente do participante e do formador (projeção pura; banco = 0442).
 * Nenhum AVA institucional foi identificado no projeto: `EXTERNAL_LMS_ADAPTERS` nasce vazio e o ambiente é nativo.
 * Material acessado não é progresso; questionário não tem gabarito nem nota automática; feedback é humano.
 */
export const EXTERNAL_LMS_ADAPTERS: readonly { id: string; contract: string }[] = [];

export type Activity = Readonly<{ id: string; title: string; opensOn: string; closesOn: string }>;
export type Submission = Readonly<{ activityId: string; version: number; at: string }>;
export type Feedback = Readonly<{ activityId: string; outcome: "atende" | "atende-parcialmente" | "nao-atende" | "comentario" }>;
export type Questionnaire = Readonly<{ id: string; opensOn: string; closesOn: string }>;

export type ActivityState = "nao-aberta" | "pendente" | "entregue" | "com-feedback" | "prazo-encerrado-sem-entrega";

export function activityState(a: Activity, subs: readonly Submission[], fb: readonly Feedback[], today: string): ActivityState {
  const mine = subs.filter((s) => s.activityId === a.id);
  if (mine.length && fb.some((f) => f.activityId === a.id)) return "com-feedback";
  if (mine.length) return "entregue";
  if (today < a.opensOn) return "nao-aberta";
  return today > a.closesOn ? "prazo-encerrado-sem-entrega" : "pendente";
}

/**
 * Progresso = atividades entregues / atividades da turma e questionários respondidos / questionários.
 * Materiais abertos NÃO entram (parâmetro nem existe). Sem atividade ⇒ null, nunca 0% ou 100%.
 */
export function participantProgress(activities: readonly Activity[], subs: readonly Submission[], qs: readonly Questionnaire[], answered: ReadonlySet<string>) {
  const delivered = activities.filter((a) => subs.some((s) => s.activityId === a.id)).length;
  const responded = qs.filter((q) => answered.has(q.id)).length;
  return {
    activities: { delivered, total: activities.length, pct: activities.length ? Math.round((delivered / activities.length) * 100) : null },
    questionnaires: { responded, total: qs.length },
    proves: "entregas registradas; não comprova aprendizagem" as const,
  };
}

export type Question = Readonly<{ kind: "aberta" | "escolha-unica" | "escala"; text: string; options?: readonly string[] }>;

/** Espelha `record_dev_questionnaire`: só chaves kind/text/options; sem campo de resposta correta. */
export function questionProblems(qs: readonly Record<string, unknown>[]): string[] {
  const p: string[] = [];
  if (qs.length === 0 || qs.length > 50) p.push("Informe de 1 a 50 perguntas.");
  qs.forEach((q, i) => {
    const keys = Object.keys(q).sort().join(",");
    if (keys !== "kind,text" && keys !== "kind,options,text") p.push(`Pergunta ${i + 1}: campos não permitidos (sem gabarito/nota).`);
    if (!["aberta", "escolha-unica", "escala"].includes(String(q["kind"]))) p.push(`Pergunta ${i + 1}: tipo inválido.`);
    if (String(q["text"] ?? "").trim().length < 5) p.push(`Pergunta ${i + 1}: enunciado curto.`);
  });
  return p;
}

/** Caminhos no bucket privado `dev-formacao` (checados também pelo banco e pela política de storage). */
export const materialPath = (classId: string, file: string) => `materiais/${classId}/${file}`;
export const submissionPath = (classId: string, enrollmentId: string, file: string) => `entregas/${classId}/${enrollmentId}/${file}`;

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
