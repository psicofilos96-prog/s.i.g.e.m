/**
 * 14.12 — Registro funcional (domínio Profissionais, Cap. 9): vínculo funcional ≠ lotação ≠
 * alteração funcional ≠ atuação (autorização). Linhas do banco append-only; leitura sempre
 * pela versão vigente da cadeia. Cargo é rótulo de catálogo e nunca concede capacidade.
 */
import { currentVersions } from "@/features/student-life/institutional-enrollment";

export type FunctionalLinkRow = {
  id: string; logical_id: string; version: number; supersedes_id: string | null; person_id: string;
  functional_registration: string | null; link_nature_id: string; link_nature_version: number;
  position_id: string | null; position_version: number | null; valid_from: string | null; valid_until: string | null; originating_act_ref: string | null;
};
export type PostingRow = {
  id: string; logical_id: string; version: number; supersedes_id: string | null; functional_link_logical_id: string; school_id: string;
  function_id: string | null; function_version: number | null; functional_status_id: string | null; functional_status_version: number | null;
  valid_from: string | null; valid_until: string | null; originating_act_ref: string | null;
};
export type FunctionalEventRow = {
  id: string; logical_id: string; version: number; supersedes_id: string | null; functional_link_logical_id: string; posting_logical_id: string | null;
  school_id: string; event_kind_id: string; event_kind_version: number; occurred_on: string | null; originating_act_ref: string | null;
};

const within = (from: string | null, until: string | null, at: string) => !!from && from <= at && (until == null || until >= at);

export type PostingsAt = {
  valid: PostingRow[];
  /** Lotação vigente cujo início não foi registrado: não se sabe se vale na data. */
  undated: PostingRow[];
  /** Mesmo vínculo com duas lotações vigentes na mesma escola e data: conflito, não duplicidade legítima. */
  conflicts: string[];
};

/** Lotações na escola válidas na data, só versões vigentes. Vínculo encerrado na data não conta. */
export function postingsAt(postings: readonly PostingRow[], links: readonly FunctionalLinkRow[], schoolId: string, at: string): PostingsAt {
  const cur = currentVersions(postings).filter((p) => p.school_id === schoolId);
  const linkByLogical = new Map(currentVersions(links).map((l) => [l.logical_id, l]));
  const valid = cur.filter((p) => within(p.valid_from, p.valid_until, at) && (() => {
    const l = linkByLogical.get(p.functional_link_logical_id);
    return !l || l.valid_from == null || within(l.valid_from, l.valid_until, at);
  })());
  const undated = cur.filter((p) => p.valid_from == null);
  const byLink = new Map<string, number>();
  for (const p of valid) byLink.set(p.functional_link_logical_id, (byLink.get(p.functional_link_logical_id) ?? 0) + 1);
  return { valid, undated, conflicts: [...byLink].filter(([, n]) => n > 1).map(([k]) => k).sort() };
}

export function functionalEventsIn(events: readonly FunctionalEventRow[], schoolId: string, from: string, to: string): { inWindow: FunctionalEventRow[]; undated: FunctionalEventRow[] } {
  const cur = currentVersions(events).filter((e) => e.school_id === schoolId);
  return { inWindow: cur.filter((e) => !!e.occurred_on && e.occurred_on >= from && e.occurred_on <= to), undated: cur.filter((e) => !e.occurred_on) };
}

export const FUNCTIONAL_CATALOG_SCHEMES = ["natureza-de-vinculo-funcional", "cargo", "funcao", "situacao-funcional", "natureza-de-alteracao-funcional"] as const;
