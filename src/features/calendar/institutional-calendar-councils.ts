/**
 * B4.6.7f — Papel de conselho dos tipos de dia (parte da construção da versão do calendário) e agenda de conselhos.
 *
 * - Declaração explícita por versão (`record_calendar_council_configuration`, capacidade `construir-calendario-da-rede`),
 *   imutável e só ANTES da decisão de homologação da mesma versão; a homologação aprova o snapshot inteiro.
 * - `councilRole` da fonte é PROPOSTA exibida para escolha humana; nunca é aplicado automaticamente.
 * - Agenda: `calendar_council_agenda_at` por alocação canônica, intervalo e UM knownAt; o servidor só consulta a
 *   versão que ele próprio decidiu para a alocação no dia. Efeito do conselho = school_day_effect declarado
 *   (true/false/null preservado). Sem versão decidida ⇒ pendente; sem configuração ⇒ não configurada (nunca zero).
 * - Agregado da turma: união dos itens por data com contagem por estado; nenhuma alocação é dominante.
 */
import { supabase } from "@/integrations/supabase/client";
import { isKnownAt } from "@/lib/postgres-instant";
import { CalendarWriteRefused } from "./institutional-calendar-writers";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never) as never;

export type CouncilRoleInput = { dayTypeId: string; role: string; sourceProposal: string | null };

/** Grava a configuração (lista vazia = "nenhum tipo é conselho nesta versão", declarado). */
export async function recordCouncilConfiguration(p: { versionId: string; roles: CouncilRoleInput[]; actRef: string }, rpc: Rpc = defaultRpc) {
  if (!p.actRef.trim()) throw new CalendarWriteRefused("form:act-required");
  const seen = new Set<string>();
  for (const r of p.roles) {
    if (!r.role.trim()) throw new CalendarWriteRefused("calendar-council:role-required");
    if (seen.has(r.dayTypeId)) throw new CalendarWriteRefused("calendar-council:duplicate-type");
    seen.add(r.dayTypeId);
  }
  const { data, error } = await rpc("record_calendar_council_configuration", {
    _version_id: p.versionId, _act_ref: p.actRef.trim(),
    _roles: p.roles.map((r) => ({ dayTypeId: r.dayTypeId, role: r.role.trim(), sourceProposal: r.sourceProposal })),
  });
  if (error) throw new CalendarWriteRefused(String(error.message ?? "erro"));
  return data as Record<string, unknown>;
}

export type CouncilConfiguration =
  | { kind: "acesso-negado" }
  | { kind: "nao-configurada" }
  | { kind: "configurada"; declaresNone: boolean; actRef: string; roles: { dayTypeId: string; role: string; sourceProposal: string | null }[] }
  | { kind: "malformada"; reason: string };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown) => (typeof x === "string" ? x : null);

export function parseCouncilConfiguration(raw: unknown): CouncilConfiguration {
  if (!isObj(raw) || raw["contract"] !== "b4.6.7f/1") return { kind: "malformada", reason: "contrato" };
  if (raw["state"] === "access-denied") return { kind: "acesso-negado" };
  if (raw["state"] === "nao-configurada") return { kind: "nao-configurada" };
  if (raw["state"] !== "configurada" || typeof raw["declaresNone"] !== "boolean" || !Array.isArray(raw["roles"])) return { kind: "malformada", reason: "estado" };
  const roles: { dayTypeId: string; role: string; sourceProposal: string | null }[] = [];
  for (const r of raw["roles"]) {
    if (!isObj(r) || !str(r["dayTypeId"]) || !str(r["role"])) return { kind: "malformada", reason: "papel" };
    roles.push({ dayTypeId: r["dayTypeId"] as string, role: r["role"] as string, sourceProposal: str(r["sourceProposal"]) });
  }
  if (raw["declaresNone"] !== (roles.length === 0)) return { kind: "malformada", reason: "declaracao-incoerente" };
  return { kind: "configurada", declaresNone: raw["declaresNone"] as boolean, actRef: str(raw["actRef"]) ?? "", roles };
}

export async function readCouncilConfiguration(p: { versionId: string; on: string; knownAt: string }, rpc: Rpc = defaultRpc): Promise<CouncilConfiguration> {
  const { data, error } = await rpc("calendar_council_configuration_at", { _version_id: p.versionId, _on: p.on, _known_at: p.knownAt });
  if (error) return { kind: "malformada", reason: "leitura-falhou" };
  return parseCouncilConfiguration(data);
}

/** Propostas da fonte: tipo institucional (pelo typeMap explícito do snapshot) → councilRole do catálogo da fonte. */
export function councilProposals(presentation: Record<string, unknown> | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!presentation) return out;
  const typeMap = isObj(presentation["typeMap"]) ? presentation["typeMap"] : {};
  const catalog = isObj(presentation["dayTypeCatalog"]) ? presentation["dayTypeCatalog"] : {};
  for (const [typeVersionId, code] of Object.entries(typeMap)) {
    const t = typeof code === "string" ? catalog[code] : null;
    const role = isObj(t) ? str(t["councilRole"]) : null;
    if (role) out.set(typeVersionId, role);
  }
  return out;
}

// ---------- agenda ----------
export type CouncilItem = { dayTypeId: string; role: string; label: string | null; schoolDayEffect: boolean | null };
export type CouncilAgendaDay =
  | { on: string; state: "pendente"; dayResult: string | null }
  | { on: string; state: "nao-configurada"; dayResult: string | null; versionId: string }
  | { on: string; state: "configurada"; dayResult: string | null; versionId: string; calendarId: string | null; items: CouncilItem[] };
export type CouncilAgendaRead =
  | { kind: "acesso-negado" }
  | { kind: "snapshot-invalido"; detail: string | null }
  | { kind: "malformada"; reason: string }
  | { kind: "lido"; allocation: string; days: CouncilAgendaDay[] };

export function parseCouncilAgenda(raw: unknown, expect: { allocation: string; from: string; to: string }): CouncilAgendaRead {
  if (!isObj(raw) || raw["contract"] !== "b4.6.7f/1") return { kind: "malformada", reason: "contrato" };
  if (raw["state"] === "access-denied") return { kind: "acesso-negado" };
  if (raw["state"] === "snapshot-invalido") return { kind: "snapshot-invalido", detail: str(raw["detail"]) };
  if (raw["state"] !== "lido" || raw["authorizes"] !== false || raw["allocation"] !== expect.allocation || !Array.isArray(raw["days"]))
    return { kind: "malformada", reason: "estado" };
  const days: CouncilAgendaDay[] = [];
  for (const d of raw["days"]) {
    if (!isObj(d) || !str(d["on"])) return { kind: "malformada", reason: "dia" };
    const on = d["on"] as string; const dayResult = str(d["dayResult"]);
    if (on < expect.from || on > expect.to || (days.length && days[days.length - 1]!.on >= on)) return { kind: "malformada", reason: "datas" };
    if (d["state"] === "pendente") { days.push({ on, state: "pendente", dayResult }); continue; }
    const versionId = str(d["versionId"]);
    if (!versionId) return { kind: "malformada", reason: "versao" };
    if (d["state"] === "nao-configurada") { days.push({ on, state: "nao-configurada", dayResult, versionId }); continue; }
    if (d["state"] !== "configurada" || !Array.isArray(d["items"])) return { kind: "malformada", reason: "estado-dia" };
    const items: CouncilItem[] = [];
    for (const i of d["items"]) {
      if (!isObj(i) || !str(i["dayTypeId"]) || !str(i["role"])) return { kind: "malformada", reason: "item" };
      const e = i["schoolDayEffect"];
      if (e !== true && e !== false && e !== null) return { kind: "malformada", reason: "efeito" };
      items.push({ dayTypeId: i["dayTypeId"] as string, role: i["role"] as string, label: str(i["label"]), schoolDayEffect: e });
    }
    days.push({ on, state: "configurada", dayResult, versionId, calendarId: str(d["calendarId"]), items });
  }
  return { kind: "lido", allocation: expect.allocation, days };
}

export async function readCouncilAgenda(p: { allocation: string; from: string; to: string; knownAt: string }, rpc: Rpc = defaultRpc): Promise<CouncilAgendaRead> {
  if (!isKnownAt(p.knownAt)) return { kind: "snapshot-invalido", detail: "known-at" };
  const { data, error } = await rpc("calendar_council_agenda_at", { _allocation: p.allocation, _from: p.from, _to: p.to, _known_at: p.knownAt });
  if (error) return { kind: "malformada", reason: "leitura-falhou" };
  return parseCouncilAgenda(data, p);
}

export type ClassCouncilAgenda = {
  /** Eventos de conselho declarados, por data, com quantas alocações os têm (sem dominante). */
  items: { on: string; role: string; label: string | null; schoolDayEffect: boolean | null; allocations: number }[];
  /** Motivos que tornam a agenda parcial; vazio ⇒ completa para todas as alocações lidas. */
  gaps: string[];
  complete: boolean;
};

const GAP: Record<string, string> = {
  pendente: "há dias sem calendário decidido pelo servidor para algum estudante",
  "nao-configurada": "há calendário homologado sem papéis de conselho declarados",
  "acesso-negado": "a leitura foi negada para algum estudante",
  "snapshot-invalido": "a referência temporal da leitura é inválida",
  malformada: "uma resposta do servidor veio em formato inesperado",
};

/** Agregado por turma. Zero alocações ⇒ agenda indeterminada (nunca "nenhum conselho"). */
export function aggregateCouncilAgenda(reads: readonly CouncilAgendaRead[]): ClassCouncilAgenda {
  const gaps = new Set<string>();
  if (reads.length === 0) gaps.add("nenhum estudante alocado à turma no intervalo");
  const m = new Map<string, ClassCouncilAgenda["items"][number]>();
  for (const r of reads) {
    if (r.kind !== "lido") { gaps.add(GAP[r.kind]!); continue; }
    for (const d of r.days) {
      if (d.state !== "configurada") { gaps.add(GAP[d.state]!); continue; }
      for (const i of d.items) {
        const k = `${d.on}|${i.role}|${i.label ?? ""}|${String(i.schoolDayEffect)}`;
        const cur = m.get(k);
        if (cur) cur.allocations += 1; else m.set(k, { on: d.on, role: i.role, label: i.label, schoolDayEffect: i.schoolDayEffect, allocations: 1 });
      }
    }
  }
  return { items: [...m.values()].sort((a, b) => a.on.localeCompare(b.on) || a.role.localeCompare(b.role)), gaps: [...gaps], complete: gaps.size === 0 };
}

export const COUNCIL_EFFECT_LABEL = (e: boolean | null) =>
  e === true ? "conta como dia letivo" : e === false ? "não conta como dia letivo" : "efeito não declarado";
