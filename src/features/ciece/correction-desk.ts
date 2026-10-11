/**
 * CIECE Lote 07 — Central de pendências e correções (núcleo puro, nunca grava).
 * Fluxo: detecção → classificação → encaminhamento ao dono → análise → correção NA ORIGEM
 * → nova verificação → validação → encerramento. Estado é projeção dos eventos (append-only, seq);
 * a CIECE nunca altera o fato: "corrigido" só existe com referência ao ato do writer canônico do dono,
 * e só encerra quando a re-verificação (quality-auditor) não detecta mais o achado.
 */
import type { Finding, Grade } from "./quality-auditor";
import { RULES } from "./quality-auditor";

export type Owner = "secretaria" | "unidade-escolar" | "dp-administrativo" | "revisao-humana" | "setor-dono";
export type CaseState = "detectado" | "classificado" | "encaminhado" | "em-analise" | "corrigido-na-origem" | "reverificado" | "validado" | "encerrado" | "descartado";
export type EventKind = "classificar" | "encaminhar" | "analisar" | "registrar-correcao" | "reverificar" | "validar" | "encerrar" | "descartar" | "anexar";

export type CaseEvent = {
  seq: number; kind: EventKind; actor: string; at: string; idempotencyKey: string;
  priority?: string; dueOn?: string; correctionActRef?: string; stillDetected?: boolean;
  attachmentRef?: string; reason?: string;
};
export type CorrectionCase = { protocol: string; finding: Finding; owner: Owner; events: CaseEvent[] };

const OWNER_BY_RULE: Record<string, Owner> = {
  "inep-invalido": "unidade-escolar", "ibge-invalido": "unidade-escolar", "inep-duplicado": "unidade-escolar",
  "distrito-ausente": "unidade-escolar", "matricula-sem-inicio": "secretaria", "matricula-multiescola": "secretaria",
  "sem-enturmacao": "secretaria", "turma-incompleta": "secretaria", "vinculo-incompleto": "dp-administrativo",
  "duplicidade-suspeita": "revisao-humana", "sem-proveniencia": "setor-dono",
};
export const ownerOf = (ruleId: string): Owner | null => OWNER_BY_RULE[ruleId] ?? null;

/** Protocolo estável derivado de regra+versão+sujeito: mesmo achado ⇒ mesmo caso (sem duplicidade). */
export function protocolOf(f: Finding): string {
  let h = 0; const s = `${f.ruleId}|${f.version}|${f.subject}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `CIECE-${f.ruleId}-${h.toString(36).toUpperCase()}`;
}

/** Abre casos só para achados acionáveis; "nao-aplicavel" (fonte não lida) nunca vira pendência. */
export function openCases(findings: Finding[], existing: CorrectionCase[] = []): { cases: CorrectionCase[]; refused: { finding: Finding; reason: string }[] } {
  const seen = new Set(existing.map((c) => c.protocol));
  const cases: CorrectionCase[] = []; const refused: { finding: Finding; reason: string }[] = [];
  for (const f of findings) {
    if (f.grade === "nao-aplicavel") { refused.push({ finding: f, reason: "fonte-nao-lida" }); continue; }
    const owner = ownerOf(f.ruleId);
    if (!owner || !RULES.some((r) => r.id === f.ruleId)) { refused.push({ finding: f, reason: "regra-sem-proprietario" }); continue; }
    const protocol = protocolOf(f);
    if (seen.has(protocol)) continue;
    seen.add(protocol); cases.push({ protocol, finding: f, owner, events: [] });
  }
  return { cases, refused };
}

const NEXT: Record<EventKind, CaseState[]> = {
  classificar: ["detectado"], encaminhar: ["classificado"], analisar: ["encaminhado"],
  "registrar-correcao": ["em-analise"], reverificar: ["corrigido-na-origem"],
  validar: ["reverificado"], encerrar: ["validado"],
  descartar: ["detectado", "classificado", "encaminhado", "em-analise"], anexar: [],
};
const TARGET: Partial<Record<EventKind, CaseState>> = {
  classificar: "classificado", encaminhar: "encaminhado", analisar: "em-analise", "registrar-correcao": "corrigido-na-origem",
  validar: "validado", encerrar: "encerrado", descartar: "descartado",
};

export type Authority = { actor: string; capabilities: ReadonlySet<string>; ownerOf: ReadonlySet<Owner> };
export const CAP_TRIAGE = "triar-pendencias-ciece";
export const CAP_VALIDATE = "validar-correcoes-ciece";

export type Refusal = "evento-repetido" | "seq-fora-de-ordem" | "transicao-invalida" | "sem-capacidade" | "nao-e-o-dono"
  | "prioridade-nao-homologada" | "correcao-sem-ato-da-origem" | "reverificacao-sem-resultado" | "validador-igual-ao-corretor"
  | "descarte-sem-motivo" | "anexo-sem-referencia" | "erro-confirmado-nao-descartavel";

export function stateOf(c: CorrectionCase): CaseState {
  let s: CaseState = "detectado";
  for (const e of c.events) {
    if (e.kind === "reverificar") s = e.stillDetected ? "em-analise" : "reverificado";
    else if (TARGET[e.kind]) s = TARGET[e.kind]!;
  }
  return s;
}

/** Valida o próximo evento. Fail-closed; nunca concede autoridade nem toca o fato. */
export function validateEvent(c: CorrectionCase, e: CaseEvent, a: Authority, homologatedPriorities: ReadonlySet<string>): Refusal | null {
  if (c.events.some((x) => x.idempotencyKey === e.idempotencyKey)) return "evento-repetido";
  if (e.seq !== c.events.length + 1) return "seq-fora-de-ordem";
  if (e.kind === "anexar") return e.attachmentRef ? null : "anexo-sem-referencia";
  const s = stateOf(c);
  if (!NEXT[e.kind].includes(s)) return "transicao-invalida";
  if (["classificar", "encaminhar", "descartar"].includes(e.kind) && !a.capabilities.has(CAP_TRIAGE)) return "sem-capacidade";
  if (e.kind === "classificar" && e.priority && !homologatedPriorities.has(e.priority)) return "prioridade-nao-homologada";
  if (["analisar", "registrar-correcao"].includes(e.kind) && !a.ownerOf.has(c.owner)) return "nao-e-o-dono";
  if (e.kind === "registrar-correcao" && !e.correctionActRef) return "correcao-sem-ato-da-origem";
  if (e.kind === "reverificar" && typeof e.stillDetected !== "boolean") return "reverificacao-sem-resultado";
  if (["validar", "encerrar"].includes(e.kind) && !a.capabilities.has(CAP_VALIDATE)) return "sem-capacidade";
  if (e.kind === "validar" && c.events.some((x) => x.kind === "registrar-correcao" && x.actor === a.actor)) return "validador-igual-ao-corretor";
  if (e.kind === "descartar") {
    if (!e.reason?.trim()) return "descarte-sem-motivo";
    if (c.finding.grade === "erro-confirmado") return "erro-confirmado-nao-descartavel";
  }
  return null;
}

/** Prazo/prioridade só se declarados num evento; sem declaração = null, nunca SLA inventado. */
export function declared(c: CorrectionCase): { priority: string | null; dueOn: string | null } {
  let priority: string | null = null, dueOn: string | null = null;
  for (const e of c.events) { if (e.priority) priority = e.priority; if (e.dueOn) dueOn = e.dueOn; }
  return { priority, dueOn };
}
export function overdue(c: CorrectionCase, today: string): boolean | null {
  const { dueOn } = declared(c); if (!dueOn) return null;
  return !["encerrado", "descartado"].includes(stateOf(c)) && today > dueOn;
}

/** Re-verificação: achado ainda presente na nova auditoria? */
export const stillDetected = (c: CorrectionCase, fresh: Finding[]) => fresh.some((f) => protocolOf(f) === c.protocol);

export const GRADE_ORDER: readonly Grade[] = ["erro-confirmado", "provavel", "alerta", "pendencia"];
