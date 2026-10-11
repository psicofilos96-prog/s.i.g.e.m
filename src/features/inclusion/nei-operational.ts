// SIGEM 2.0 — B: fechamento operacional do NEI. Projeções puras sobre o que os readers NEI já devolveram.
import { toPrintableHtml } from "@/features/reports/report-engine";
import { hasClinicalText, overdue } from "./nei-visits";

/** Alertas por prazo: só itens com prazo declarado; janela "a vencer" só configurada (null ⇒ só vencidos). */
export function deadlineAlerts(items: readonly { id: string; due: string | null; closed: boolean }[], today: string, soonDays: number | null) {
  const soonLimit = soonDays == null ? null : new Date(Date.parse(today) + soonDays * 86_400_000).toISOString().slice(0, 10);
  return items.flatMap((i) => {
    if (overdue(i.due, i.closed, today)) return [{ id: i.id, kind: "vencido" as const }];
    if (soonLimit && i.due && !i.closed && i.due >= today && i.due <= soonLimit) return [{ id: i.id, kind: "a-vencer" as const }];
    return [];
  });
}

/** Calendário de visitas: agrupa por dia; sem data fica fora e contado. */
export function visitCalendar(visits: readonly { id: string; date: string | null }[]) {
  const days = new Map<string, string[]>();
  let undated = 0;
  for (const v of visits) {
    if (!v.date) { undated++; continue; }
    days.set(v.date, [...(days.get(v.date) ?? []), v.id]);
  }
  return { days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)), undated };
}

/** Frequência AEE: só sessões realizadas; sem marcação nunca vira falta; percentual só com denominador > 0. */
export function aeeAttendance(sessions: readonly { held: boolean; mark: "presente" | "ausente" | null }[]) {
  const held = sessions.filter((s) => s.held);
  const present = held.filter((s) => s.mark === "presente").length;
  const absent = held.filter((s) => s.mark === "ausente").length;
  const unmarked = held.length - present - absent;
  const denom = present + absent;
  return { held: held.length, present, absent, unmarked, rate: denom > 0 ? present / denom : null };
}

/** Salas: conflito só entre horários registrados na mesma sala e dia. */
export function roomConflicts(slots: readonly { id: string; room: string | null; weekday: number; start: string; end: string }[]) {
  const out: [string, string][] = [];
  slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => {
    if (a.room && a.room === b.room && a.weekday === b.weekday && a.start < b.end && b.start < a.end) out.push([a.id, b.id]);
  }));
  return out;
}

/** Jornada do profissional AEE: só com fonte legítima; sem fonte ⇒ pendência, nunca carga presumida. */
export const aeeWorkload = (w: { hours: number | null; sourceRef: string | null }) =>
  w.hours != null && w.sourceRef ? { state: "registrada" as const, hours: w.hours } : { state: "sem-fonte" as const, hours: null };

/** Pendências institucionais distintas de lacunas técnicas. */
export const NEI_INSTITUTIONAL_PENDING = [
  { code: "nomeacao-coordenacao", text: "Nomeação da coordenação do NEI pela administração geral." },
  { code: "retencao-documentos", text: "Prazo de retenção dos documentos do NEI (hoje retidos sem descarte)." },
] as const;

const BRANDING = (title: string) => ({ title, headerLines: ["Núcleo de Educação Inclusiva — documento de trabalho, não é documento oficial"], logoUrl: null });

/** PDF de protocolo: recusa texto clínico, mesmo critério do banco. */
export function protocolPrint(p: { number: string; subject: string; body: string; destination: string; sentAt: string }) {
  if (hasClinicalText(p.subject) || hasClinicalText(p.body)) return { ok: false as const, reason: "texto-clinico" };
  const result = { columns: [{ key: "k", label: "Campo" }, { key: "v", label: "Conteúdo" }],
    rows: [["Protocolo", p.number], ["Destino", p.destination], ["Enviado em", p.sentAt], ["Assunto", p.subject], ["Mensagem", p.body]].map(([k, v]) => ({ k, v })) };
  return { ok: true as const, html: toPrintableHtml(result as never, BRANDING(`Protocolo ${p.number}`) as never) };
}

/** PDF do plano (PAEE/PEI): metas como escritas; sem prazo ⇒ "não declarado". */
export function planPrint(p: { kind: "PAEE" | "PEI"; version: number; status: string; goals: readonly { text: string; due: string | null }[] }) {
  const result = { columns: [{ key: "meta", label: "Meta" }, { key: "prazo", label: "Prazo" }],
    rows: p.goals.map((g) => ({ meta: g.text, prazo: g.due ?? "não declarado" })) };
  return toPrintableHtml(result as never, BRANDING(`${p.kind} — versão ${p.version}`) as never, [`Situação: ${p.status} (concluído pela equipe não é aprovação institucional)`]);
}
