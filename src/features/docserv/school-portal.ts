/** DocServ LOTE 04 — painel da escola: contadores e filtros sobre a leitura `docserv_school_roster` (puro). */
export type DocCell = { document_id: string; version: number; seq: number; path: string; valid_until: string | null; by_school: boolean; status: string };
export type RosterPerson = { person_id: string; masked_name: string | null; sources: string[]; functions: string[]; other_schools: number; docs: Record<string, DocCell> };
export type LinkRequest = { request_id: string; seq: number; kind: string; state: string; reason: string; person_masked: string | null; at: string };
export type Roster = { school_id: string; season: string; can_validate: boolean; staff_records_without_person: number; people: RosterPerson[]; requests: LinkRequest[] };

export const TYPES = ["antecedente_criminal", "antecedente_civil"] as const;
export type Filter = "todos" | "sem-envio" | "pendente" | "problema" | "valido";

/** Rótulo do vínculo só a partir da origem real; titular/dobra/AJT aparecem somente se vierem da lotação registrada. */
export function linkLabel(p: RosterPerson): string {
  const parts = p.sources.map((s) => (s === "lotacao" ? "lotação" : s.startsWith("atuacao:") ? `atuação (${s.slice(8)})` : s));
  if (p.functions.length) parts.push(p.functions.join(", "));
  else if (!p.sources.includes("lotacao")) parts.push("titular/dobra/AJT sem lotação registrada");
  return parts.join(" · ");
}

export function criminalState(p: RosterPerson): Exclude<Filter, "todos"> {
  const d = p.docs["antecedente_criminal"];
  if (!d) return "sem-envio";
  if (d.status === "valido") return "valido";
  if (d.status === "pendente_validacao") return "pendente";
  return "problema";
}

/** Cada pessoa conta uma vez por escola, mesmo com atuação e lotação simultâneas. */
export function counters(r: Roster) {
  const ids = new Set(r.people.map((p) => p.person_id));
  const c = { servidores: ids.size, "sem-envio": 0, pendente: 0, problema: 0, valido: 0, multiplos: 0 };
  const seen = new Set<string>();
  for (const p of r.people) {
    if (seen.has(p.person_id)) continue; seen.add(p.person_id);
    c[criminalState(p)]++;
    if (p.other_schools > 0 || p.sources.length > 1) c.multiplos++;
  }
  return c;
}

export function applyFilter(r: Roster, f: Filter, q: string): RosterPerson[] {
  const s = q.trim().toLowerCase();
  return r.people.filter((p) => (f === "todos" || criminalState(p) === f) && (!s || (p.masked_name ?? "").toLowerCase().includes(s)));
}

/** Fila de validação: só documentos aguardando, e só quando o banco diz que a escola pode validar. */
export function validationQueue(r: Roster): { person: RosterPerson; type: string; doc: DocCell }[] {
  if (!r.can_validate) return [];
  return r.people.flatMap((p) => TYPES.flatMap((t) => (p.docs[t]?.status === "pendente_validacao" || p.docs[t]?.status === "alerta_revisao_urgente" ? [{ person: p, type: t, doc: p.docs[t]! }] : [])));
}
