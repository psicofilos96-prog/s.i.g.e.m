/**
 * Matrículas L07 — formulário de inscrição em etapas (portal público, migration 0459).
 * Rascunho só na memória da página (nunca armazenamento do navegador: contém dados de criança); envio só por
 * `enr_submit_application` com chave idempotente; escola/etapa/modalidade só da campanha publicada.
 * Critérios: só declarações de critério homologado; sem catálogo homologado a etapa não aceita declaração.
 */
import { supabase } from "@/integrations/supabase/client";
import { ageOn, normalizeContact, validCpf } from "./ingress-identity";
import type { PublicCampaign } from "./ingress-public";
import { preferenceProblems, PROBLEM_TEXT, type PreferencePolicy } from "./preference-policy";

export const STEPS = ["responsavel", "estudante", "etapa", "preferencias", "criterios", "documentos", "conferencia"] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = {
  responsavel: "Quem pede", estudante: "Estudante", etapa: "Etapa e modalidade", preferencias: "Escolas de preferência",
  criterios: "Critérios", documentos: "Documentos", conferencia: "Conferência e envio",
};

export interface Draft {
  requesterKind: "responsavel" | "estudante-adulto"; requesterName: string; requesterCpf: string; email: string; phone: string; kinship: string;
  studentName: string; studentBirth: string; studentCpf: string; stage: string; modality: string; schools: string[];
  /** Turno/oferta por escola escolhida; só valores declarados na política aprovada (null = sem preferência). */
  choices: Record<string, { shift: string | null; offer: string | null }>;
  documentsAck: boolean; truth: boolean;
}
export const emptyDraft = (): Draft => ({
  requesterKind: "responsavel", requesterName: "", requesterCpf: "", email: "", phone: "", kinship: "",
  studentName: "", studentBirth: "", studentCpf: "", stage: "", modality: "", schools: [], choices: {}, documentsAck: false, truth: false,
});

export type Errs = Partial<Record<keyof Draft, string>>;
const fullName = (s: string) => { const n = s.trim().replace(/\s+/g, " "); return n.length >= 5 && n.includes(" "); };

/** Erros por campo, em linguagem simples. Vazio = etapa pode avançar. */
export function stepErrors(step: Step, d: Draft, c: Pick<PublicCampaign, "stage_ids" | "modality_ids" | "schools">, today: string, policy?: PreferencePolicy | null): Errs {
  const e: Errs = {};
  if (step === "responsavel") {
    if (!fullName(d.requesterName)) e.requesterName = "Escreva o nome completo, com sobrenome.";
    if (!validCpf(d.requesterCpf)) e.requesterCpf = "CPF não confere. Verifique os 11 números.";
    const em = d.email.trim() ? normalizeContact("email", d.email) : null;
    const ph = d.phone.trim() ? normalizeContact("telefone", d.phone) : null;
    if (d.email.trim() && !em) e.email = "E-mail incompleto. Exemplo: nome@provedor.com";
    if (d.phone.trim() && !ph) e.phone = "Telefone com DDD, só números. Exemplo: 22 99999-0000";
    if (!d.email.trim() && !d.phone.trim()) e.email = "Informe ao menos um contato: e-mail ou telefone.";
    if (d.requesterKind === "responsavel" && !/^[a-zà-ú ]{3,40}$/i.test(d.kinship.trim())) e.kinship = "Diga qual é o parentesco (por exemplo: mãe, pai, avó).";
  }
  if (step === "estudante") {
    if (d.requesterKind === "responsavel" && !fullName(d.studentName)) e.studentName = "Escreva o nome completo do estudante.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.studentBirth) || d.studentBirth > today || ageOn(d.studentBirth, today) > 120) e.studentBirth = "Data de nascimento inválida.";
    if (d.studentCpf.trim() && !validCpf(d.studentCpf)) e.studentCpf = "CPF do estudante não confere. Se não tiver, deixe em branco.";
  }
  if (step === "etapa") {
    if (!c.stage_ids.includes(d.stage)) e.stage = "Escolha uma etapa oferecida nesta campanha.";
    if (!c.modality_ids.includes(d.modality)) e.modality = "Escolha uma modalidade oferecida nesta campanha.";
  }
  if (step === "preferencias") {
    const allowed = new Set(c.schools.map((s) => s.school_id));
    if (!d.schools.length) e.schools = "Escolha ao menos uma escola.";
    else if (d.schools.some((s) => !allowed.has(s)) || new Set(d.schools).size !== d.schools.length) e.schools = "Só escolas desta campanha, sem repetir.";
    else if (policy !== undefined) {
      const probs = preferenceProblems(policy, choicesOf(d), [...allowed]);
      if (probs.length) e.schools = PROBLEM_TEXT[probs[0]!];
    }
  }
  if (step === "documentos" && !d.documentsAck) e.documentsAck = "Confirme que leu a lista de documentos do edital.";
  if (step === "conferencia" && !d.truth) e.truth = "Confirme que as informações são verdadeiras.";
  return e;
}

/** Primeira etapa com erro (para levar a pessoa direto ao que falta antes de enviar). */
export function firstInvalidStep(d: Draft, c: Pick<PublicCampaign, "stage_ids" | "modality_ids" | "schools">, today: string, policy?: PreferencePolicy | null): Step | null {
  return STEPS.find((s) => Object.keys(stepErrors(s, d, c, today, policy)).length) ?? null;
}

/** Escolhas na ordem marcada, com turno/oferta só quando informados. */
export function choicesOf(d: Draft) {
  return d.schools.map((schoolId) => ({ schoolId, shiftId: d.choices[schoolId]?.shift ?? null, offerId: d.choices[schoolId]?.offer ?? null }));
}

/** Política pública da campanha (limites, turnos e ofertas admitidos); null = sem política aprovada. */
export async function fetchPreferencePolicy(campaignId: string): Promise<PreferencePolicy | null> {
  const { data, error } = await supabase.rpc("enr_public_preference_policy", { _campaign: campaignId });
  if (error) throw new Error("politica-indisponivel");
  return parsePolicy(data);
}
export function parsePolicy(v: unknown): PreferencePolicy | null {
  const p = v as Partial<PreferencePolicy> | null;
  if (!p || typeof p.version !== "number" || typeof p.min !== "number" || typeof p.max !== "number") return null;
  if (p.ordering !== "ordenada" && p.ordering !== "sem-ordem") return null;
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : []);
  return { version: p.version, min: p.min, max: p.max, ordering: p.ordering, shifts: arr(p.shifts), offers: arr(p.offers) };
}

/** Estudante adulto pede para si: o estudante é a própria pessoa. */
export function effectiveStudentName(d: Draft) { return d.requesterKind === "estudante-adulto" ? d.requesterName : d.studentName; }

export type SubmitResult = "recebido" | "ja-recebido" | "campanha-fechada" | "fora-da-campanha" | "invalido" | "limite" | "indisponivel";
export const SUBMIT_MESSAGE: Record<Exclude<SubmitResult, "recebido">, string> = {
  "ja-recebido": "Este pedido já foi enviado. Guarde o comprovante que apareceu na primeira vez.",
  "campanha-fechada": "A campanha não está recebendo pedidos agora. Confira o prazo na página de matrículas.",
  "fora-da-campanha": "Alguma escolha não faz parte desta campanha. Revise etapa, modalidade e escolas.",
  invalido: "Alguns dados não puderam ser aceitos. Revise as etapas e tente novamente.",
  limite: "Foi atingido o limite de pedidos para este CPF nesta campanha. Procure o atendimento.",
  indisponivel: "O envio online está indisponível no momento. Tente mais tarde ou procure o atendimento.",
};

export async function submitApplication(campaignId: string, d: Draft, key: string): Promise<{ result: SubmitResult; code: string | null; check: string | null }> {
  const { data, error } = await supabase.rpc("enr_submit_application_v2", {
    _campaign: campaignId, _requester_kind: d.requesterKind, _requester_name: d.requesterName, _requester_cpf: d.requesterCpf,
    _email: d.email, _phone: d.phone, _kinship: d.requesterKind === "responsavel" ? d.kinship : (null as unknown as string),
    _student_name: effectiveStudentName(d), _student_birth: d.studentBirth, _student_cpf: d.studentCpf, _stage: d.stage, _modality: d.modality,
    _choices: choicesOf(d).map((x) => ({ school: x.schoolId, shift: x.shiftId, offer: x.offerId })), _documents_ack: d.documentsAck, _truth: d.truth, _key: key,
  });
  if (error) return { result: "indisponivel", code: null, check: null };
  const r = (data as { result: string; application_code: string | null; check_code: string | null }[] | null)?.[0];
  const result = (r && (r.result === "recebido" || r.result in SUBMIT_MESSAGE) ? r.result : "indisponivel") as SubmitResult;
  return { result, code: r?.application_code ?? null, check: r?.check_code ?? null };
}
