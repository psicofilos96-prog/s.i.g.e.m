/**
 * Rede/Matrículas/Vagas L07 — Inscrição e pré-matrícula.
 * Identificação mínima (allowlist de campos); CPF só chega como HMAC calculado no servidor.
 * Possíveis cadastros existentes são só CANDIDATOS para revisão humana (CPF forte; nome+nascimento fraco;
 * nome sozinho nunca). Documentos só por referência a caminho privado do bucket. Protocolo determinístico
 * e idempotente. A inscrição NUNCA cria matrícula, pessoa, estudante nem vínculo familiar de acesso:
 * seu único destino é virar rascunho da matrícula guiada por ato humano da escola.
 */
export const ALLOWED_FIELDS = ["campaignId", "schoolPreferenceIds", "childName", "childBirthDate", "childCpfHmac", "guardianName", "guardianContactHmac", "guardianRelationDeclared", "documentRefs", "idempotencyKey"] as const;
export type Field = (typeof ALLOWED_FIELDS)[number];

export interface PreRegistrationInput {
  campaignId: string; schoolPreferenceIds: readonly string[];
  childName: string; childBirthDate: string; childCpfHmac: string | null;
  guardianName: string; guardianContactHmac: string; guardianRelationDeclared: string;
  documentRefs: readonly string[]; idempotencyKey: string;
}
export interface ExistingPerson { personId: string; nameNormalized: string; birthDate: string | null; cpfHmac: string | null }
export interface Candidate { personId: string; strength: "forte" | "fraca"; basis: string }

const SENSITIVE = /\b(cid|laudo|diagn[oó]stic|defici[eê]ncia|transtorno|\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/i;
export const normalizeName = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function validatePreRegistration(raw: Record<string, unknown>, ctx: { campaignAccepts: (schoolId: string) => boolean; maxPreferences: number | null; today: string }): string[] {
  const out: string[] = [];
  for (const k of Object.keys(raw)) if (!(ALLOWED_FIELDS as readonly string[]).includes(k)) out.push(`Campo não permitido: ${k}.`);
  const r = raw as Partial<PreRegistrationInput>;
  if (!r.childName?.trim() || !r.guardianName?.trim()) out.push("Nome da criança e do responsável obrigatórios.");
  if (!r.childBirthDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.childBirthDate) || r.childBirthDate > ctx.today) out.push("Data de nascimento inválida.");
  if (r.childCpfHmac && !/^[a-f0-9]{64}$/.test(r.childCpfHmac)) out.push("CPF deve chegar só como HMAC calculado no servidor.");
  if (!r.guardianContactHmac || !/^[a-f0-9]{64}$/.test(r.guardianContactHmac)) out.push("Contato do responsável só como HMAC.");
  if (!r.idempotencyKey?.trim()) out.push("Chave idempotente obrigatória.");
  const prefs = r.schoolPreferenceIds ?? [];
  if (prefs.length === 0) out.push("Escolha ao menos uma escola.");
  if (ctx.maxPreferences === null && prefs.length > 1) out.push("Número de preferências não configurado: só uma escola.");
  if (ctx.maxPreferences !== null && prefs.length > ctx.maxPreferences) out.push(`Máximo de ${ctx.maxPreferences} preferências.`);
  if (new Set(prefs).size !== prefs.length) out.push("Escola repetida nas preferências.");
  for (const s of prefs) if (!ctx.campaignAccepts(s)) out.push(`Campanha não aceita inscrição para a escola ${s} nesta data.`);
  for (const d of r.documentRefs ?? []) if (!/^inscricoes\/[\w-]+\/[\w-]+\/[\w.-]+$/.test(d)) out.push(`Documento fora do armazenamento protegido: ${d}.`);
  for (const t of [r.childName, r.guardianName, r.guardianRelationDeclared]) if (t && SENSITIVE.test(t)) out.push("Texto livre não pode conter CPF ou informação clínica.");
  return out;
}

export function findCandidates(input: Pick<PreRegistrationInput, "childName" | "childBirthDate" | "childCpfHmac">, people: readonly ExistingPerson[]): Candidate[] {
  const n = normalizeName(input.childName);
  const out: Candidate[] = [];
  for (const p of people) {
    if (input.childCpfHmac && p.cpfHmac === input.childCpfHmac) out.push({ personId: p.personId, strength: "forte", basis: "CPF" });
    else if (p.birthDate && p.birthDate === input.childBirthDate && p.nameNormalized === n) out.push({ personId: p.personId, strength: "fraca", basis: "nome+nascimento" });
  }
  return out; // nome sozinho nunca gera candidato
}

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
/** Protocolo opaco: mesma campanha + chave idempotente ⇒ mesmo protocolo (reenvio não duplica). */
export async function protocolFor(campaignId: string, idempotencyKey: string) {
  return `INS-${(await sha256Hex(`${campaignId}|${idempotencyKey}`)).slice(0, 12).toUpperCase()}`;
}

export interface PreRegistrationRecord {
  protocol: string; campaignId: string; campaignVersion: number; submittedAt: string;
  input: PreRegistrationInput; candidates: Candidate[]; status: "recebida";
  /** Invariantes de efeito: inscrição não é fato oficial. */
  createsEnrollment: false; createsPerson: false; createsGuardianAccess: false;
}

export async function submitPreRegistration(raw: Record<string, unknown>, ctx: {
  campaignVersion: number | null; campaignAccepts: (schoolId: string) => boolean; maxPreferences: number | null; today: string; now: string;
  people: readonly ExistingPerson[]; existingProtocols: ReadonlySet<string>;
}): Promise<{ ok: true; record: PreRegistrationRecord; duplicate: boolean } | { ok: false; issues: string[] }> {
  if (ctx.campaignVersion === null) return { ok: false, issues: ["Campanha não publicada."] };
  const issues = validatePreRegistration(raw, ctx);
  if (issues.length) return { ok: false, issues };
  const input = raw as unknown as PreRegistrationInput;
  const protocol = await protocolFor(input.campaignId, input.idempotencyKey);
  return { ok: true, duplicate: ctx.existingProtocols.has(protocol), record: {
    protocol, campaignId: input.campaignId, campaignVersion: ctx.campaignVersion, submittedAt: ctx.now, input,
    candidates: findCandidates(input, ctx.people), status: "recebida",
    createsEnrollment: false, createsPerson: false, createsGuardianAccess: false,
  } };
}

/** Consulta pública pelo protocolo: só situação, nunca dados pessoais nem candidatos. */
export const publicStatusView = (r: PreRegistrationRecord) => ({ protocol: r.protocol, status: r.status, submittedAt: r.submittedAt });

/** Conversão em rascunho da matrícula guiada: só pessoa natural da escola preferida, com decisão sobre candidatos. */
export function toEnrollmentDraftPlan(r: PreRegistrationRecord, actor: { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; schoolIds: readonly string[] },
  decision: { schoolId: string; matchedPersonId: string | null; requiredCapability: string | null; reason: string }) {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false as const, reason: "Exige pessoa natural da escola." };
  if (!decision.requiredCapability || !actor.capabilities.includes(decision.requiredCapability)) return { ok: false as const, reason: "Competência não configurada ou ausente." };
  if (!actor.schoolIds.includes(decision.schoolId) || !r.input.schoolPreferenceIds.includes(decision.schoolId)) return { ok: false as const, reason: "Escola fora do escopo ou das preferências." };
  if (decision.matchedPersonId && !r.candidates.some((c) => c.personId === decision.matchedPersonId)) return { ok: false as const, reason: "Pessoa escolhida não está entre os candidatos apurados." };
  if (r.candidates.length > 0 && decision.matchedPersonId === null && !decision.reason.trim()) return { ok: false as const, reason: "Descartar candidatos exige motivo." };
  return { ok: true as const, plan: { writer: "enrollment_draft_start" as const, schoolId: decision.schoolId, protocol: r.protocol, personId: decision.matchedPersonId, decidedBy: actor.personId } };
}
