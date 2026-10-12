/**
 * Matrículas L05 — identificação do solicitante (responsável ou estudante adulto), contatos e recuperação de acesso.
 * Núcleo puro: o servidor recebe só HMAC de CPF/contato (nunca valor claro), toda resposta pública é uniforme
 * e declaração de parentesco é só declaração — nunca cria `guardian_authorizations`, que nasce apenas no
 * writer da escola (`record_guardian_authorization_v4`).
 */
export type RequesterKind = "responsavel" | "estudante-adulto";
export type KinshipDeclaration = { declared: string; status: "declarado" }; // nunca "autorizado"

export interface IdentificationInput {
  kind: RequesterKind; fullName: string; cpf: string; birthDate: string; // AAAA-MM-DD
  contacts: { channel: "email" | "telefone"; value: string }[];
  kinship: string | null; // obrigatório só para responsável
}
export interface IdentificationPlan {
  kind: RequesterKind; fullName: string; birthDate: string; cpfHmac: string;
  contacts: { channel: "email" | "telefone"; hmac: string; masked: string; verified: false }[];
  kinship: KinshipDeclaration | null; createsGuardianLink: false;
}
type R<T> = { ok: true; value: T } | { ok: false; issues: string[] };

export function onlyDigits(s: string) { return s.replace(/\D/g, ""); }
export function validCpf(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
export function ageOn(birth: string, on: string): number {
  const [by = 0, bm = 0, bd = 0] = birth.split("-").map(Number); const [y = 0, m = 0, d = 0] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
export function normalizeContact(channel: "email" | "telefone", v: string): string | null {
  if (channel === "email") { const e = v.trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null; }
  const d = onlyDigits(v); const n = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  return n.length === 10 || n.length === 11 ? n : null;
}
export function maskContact(channel: "email" | "telefone", n: string): string {
  if (channel === "email") { const [u = "", dom = ""] = n.split("@"); return `${u.slice(0, 1)}***@${dom}`; }
  return `(${n.slice(0, 2)}) ****-${n.slice(-4)}`;
}
const KINSHIP_RE = /^[a-zà-ú ]{3,40}$/i;

/** Monta o plano de identificação. `hmac` é fornecido pelo servidor (segredo nunca no navegador). */
export function planIdentification(i: IdentificationInput, today: string, adultAge: number | null, hmac: (v: string) => string): R<IdentificationPlan> {
  const issues: string[] = [];
  const name = i.fullName.trim().replace(/\s+/g, " ");
  if (name.length < 5 || !name.includes(" ")) issues.push("Informe o nome completo.");
  if (!validCpf(i.cpf)) issues.push("CPF inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.birthDate) || i.birthDate > today) issues.push("Data de nascimento inválida.");
  if (i.kind === "estudante-adulto") {
    if (adultAge == null) issues.push("Idade mínima para pedido próprio não está configurada; procure o atendimento.");
    else if (!issues.length && ageOn(i.birthDate, today) < adultAge) issues.push("Pedido próprio exige a idade mínima definida pela rede.");
    if (i.kinship) issues.push("Estudante adulto não declara parentesco.");
  } else if (!i.kinship || !KINSHIP_RE.test(i.kinship.trim())) issues.push("Informe o parentesco declarado.");
  const contacts: IdentificationPlan["contacts"] = [];
  for (const c of i.contacts) {
    const n = normalizeContact(c.channel, c.value);
    if (!n) { issues.push(`Contato inválido (${c.channel}).`); continue; }
    if (!contacts.some((x) => x.hmac === hmac(n))) contacts.push({ channel: c.channel, hmac: hmac(n), masked: maskContact(c.channel, n), verified: false });
  }
  if (!contacts.length) issues.push("Informe ao menos um contato.");
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: {
    kind: i.kind, fullName: name, birthDate: i.birthDate, cpfHmac: hmac(onlyDigits(i.cpf)), contacts,
    kinship: i.kind === "responsavel" ? { declared: i.kinship!.trim().toLowerCase(), status: "declarado" } : null,
    createsGuardianLink: false,
  } };
}

/** Resposta pública de recuperação: SEMPRE a mesma, exista ou não cadastro, para impedir enumeração. */
export const RECOVERY_PUBLIC_MESSAGE = "Se houver cadastro com esses dados, enviaremos um código para o contato registrado.";
export function recoveryResponse(_found: boolean): { message: string } { return { message: RECOVERY_PUBLIC_MESSAGE }; }

/** Código de recuperação: uso único, validade curta, tentativas limitadas; comparação em tempo constante. */
export interface RecoveryChallenge { codeHash: string; expiresAt: number; attempts: number; usedAt: number | null }
export const RECOVERY_TTL_MS = 10 * 60_000;
export const RECOVERY_MAX_ATTEMPTS = 5;
export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}
export function checkRecovery(ch: RecoveryChallenge | null, codeHash: string, now: number): { ok: boolean; next: RecoveryChallenge | null } {
  if (!ch || ch.usedAt != null || now > ch.expiresAt || ch.attempts >= RECOVERY_MAX_ATTEMPTS) return { ok: false, next: ch };
  if (!constantTimeEqual(ch.codeHash, codeHash)) return { ok: false, next: { ...ch, attempts: ch.attempts + 1 } };
  return { ok: true, next: { ...ch, usedAt: now } };
}
/** Limite por janela para pedidos de código (por contato HMAC e por origem). */
export function rateAllowed(previous: readonly number[], now: number, windowMs = 60 * 60_000, max = 3) {
  return previous.filter((t) => now - t < windowMs).length < max;
}
