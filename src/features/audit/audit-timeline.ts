/**
 * NAUD.2 — apresentação da Central de Auditoria (pura): rótulo legível da ação, natureza do ator
 * (principal institucional × pessoa), setor/escola do ator, busca livre, detalhe minimizado e
 * link para o fato original só quando a tela de origem existe e reaplica a própria ACL.
 * Nada aqui amplia leitura: só reorganiza eventos que a RLS de quem consulta já devolveu.
 */
import type { AuditEvent, AuditFilter } from "./audit-model";
import { filterEvents } from "./audit-model";

/** Ator conhecido pela consulta autorizada do Administrador Geral (access_center_inventory). */
export type ActorInfo = Readonly<{ kind: string; station: string | null; schoolId: string | null }>;
export type ActorDirectory = ReadonlyMap<string, ActorInfo>;

export type ActorNature = "principal" | "pessoa" | "tecnica" | "nao-visivel" | "nao-declarado";
export const NATURE_LABEL: Record<ActorNature, string> = {
  principal: "Principal institucional (conta de setor — não é pessoa)",
  pessoa: "Pessoa natural",
  tecnica: "Conta técnica",
  "nao-visivel": "Natureza da conta não visível para sua consulta",
  "nao-declarado": "Ator não declarado",
};

export function actorNature(e: AuditEvent, dir: ActorDirectory): ActorNature {
  if (e.actorPersonId) return "pessoa";
  if (!e.actorUserId) return "nao-declarado";
  const a = dir.get(e.actorUserId);
  if (!a) return "nao-visivel"; // nunca presumir pessoa nem setor
  if (a.kind === "setorial" || a.kind === "orgao") return "principal";
  if (a.kind === "humano") return "pessoa";
  if (a.kind === "tecnico") return "tecnica";
  return "nao-visivel";
}

const ACTION_PREFIX: Record<string, string> = {
  conta: "Conta", politica: "Política de acesso", anexo: "Anexo da inclusão", documento: "Documento escolar",
  importacao: "Importação", movimentacao: "Movimentação do estudante",
};
/** "documento:emitido" → "Documento escolar — emitido". Desconhecido mantém o código, sem traduzir por palpite. */
export function actionLabel(action: string): string {
  const [head, ...rest] = action.split(":");
  const p = head ? ACTION_PREFIX[head] : undefined;
  if (!p) return action;
  const tail = rest.join(" · ").replace(/[-_]/g, " ").trim();
  return tail ? `${p} — ${tail}` : p;
}

/** Link para o fato original: só para telas existentes que reaplicam a ACL; anexo/conta nunca linkam. */
const SAFE_LINK: Record<string, string> = {
  emissao: "/documentos-escolares", lote: "/importacoes", politica: "/central-de-acessos",
};
export function originalFactLink(e: AuditEvent): string | null {
  const prefix = e.entity?.split(":")[0];
  return prefix ? SAFE_LINK[prefix] ?? null : null;
}
export const SAFE_LINK_ROUTES = Object.values(SAFE_LINK);

export type NaudFilter = AuditFilter & Readonly<{ station?: string | null; nature?: ActorNature | null; search?: string | null }>;

/** Filtros completos: período/área/tipo/ator/registro (modelo) + setor, escola (do evento ou do ator), natureza e busca. */
export function filterTimeline(evs: readonly AuditEvent[], f: NaudFilter, dir: ActorDirectory): AuditEvent[] {
  const { schoolId, ...rest } = f;
  const q = f.search?.trim().toLowerCase() || null;
  return filterEvents(evs, { ...rest, schoolId: null }).filter((e) => {
    const a = e.actorUserId ? dir.get(e.actorUserId) : undefined;
    if (schoolId && !e.schoolIds.includes(schoolId) && a?.schoolId !== schoolId) return false;
    if (f.station && a?.station !== f.station) return false;
    if (f.nature && actorNature(e, dir) !== f.nature) return false;
    if (q && ![actionLabel(e.action), e.action, e.module, e.entity ?? "", e.reason ?? ""].some((t) => t.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Agrupa por dia (timeline), mantendo a ordem decrescente já aplicada. */
export function groupByDay(evs: readonly AuditEvent[]): { day: string; events: AuditEvent[] }[] {
  const out: { day: string; events: AuditEvent[] }[] = [];
  for (const e of evs) { const d = e.at.slice(0, 10); const last = out[out.length - 1];
    if (last?.day === d) last.events.push(e); else out.push({ day: d, events: [e] }); }
  return out;
}

/** Detalhe minimizado: só campos de proveniência; nenhum payload, login, e-mail ou texto bruto. */
export function minimizedDetail(e: AuditEvent, dir: ActorDirectory): { label: string; value: string }[] {
  const nat = actorNature(e, dir);
  const rows: { label: string; value: string }[] = [
    { label: "Ação", value: actionLabel(e.action) },
    { label: "Quem age", value: NATURE_LABEL[nat] },
    { label: "Quando foi registrado", value: e.at },
    { label: "Efeito em", value: e.effectiveOn ?? "não declarado" },
    { label: "Registro", value: e.entity ? `${e.entity}${e.entityVersion ? ` v${e.entityVersion}` : ""}` : "não declarado" },
    { label: "Origem", value: e.origin ?? "não declarada" },
    { label: "Motivo", value: e.reason ?? "não declarado" },
  ];
  const a = e.actorUserId ? dir.get(e.actorUserId) : undefined;
  if (a?.station) rows.push({ label: "Setor do ator", value: a.station });
  return rows;
}
