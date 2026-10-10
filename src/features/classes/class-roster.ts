/**
 * LOTE 3/14 — Diário nominal da turma 2026.
 * Leitura só com a sessão de quem consulta (RLS do banco decide escola/turma); nenhuma escrita,
 * nenhum cliente privilegiado. Paginação, pesquisa e ordenação acontecem no servidor de dados.
 * Projeção pura: episódio corrigido (superseded) sai da lista; saída registrada vira "encerrado";
 * AEE só quando a turma declara tipo AEE; dupla matrícula = o mesmo aluno com outro episódio
 * vigente em outra turma visível. Ausência continua ausência.
 */
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";

export type RosterSort = "nome" | "inicio";
export type RosterEpisodeRow = {
  id: string; student_id: string; enrollment_id: string; class_id: string; valid_from: string | null; supersedes_id: string | null;
  studentName: string | null; ending: { ended_on: string; reason_label: string | null } | null;
};
export type RosterEntry = Readonly<{
  episodeId: string; studentId: string; enrollmentId: string; studentName: string | null; validFrom: string | null;
  bond: "regular" | "aee"; situation: { kind: "vigente" } | { kind: "encerrado"; on: string; reason: string | null };
  otherActiveClasses: number;
}>;
export type RosterCounts = Readonly<{ episodes: number; distinctStudents: number; distinctEnrollments: number; active: number; ended: number }>;

/** Remove episódios substituídos por correção (o substituto carrega `supersedes_id`). */
export function currentEpisodes<T extends { id: string; supersedes_id: string | null }>(rows: readonly T[]): T[] {
  const superseded = new Set(rows.map((r) => r.supersedes_id).filter((x): x is string => !!x));
  return rows.filter((r) => !superseded.has(r.id));
}

export function projectRoster(rows: readonly RosterEpisodeRow[], opts: { isAee: boolean; otherActive: ReadonlyMap<string, number> }): RosterEntry[] {
  return currentEpisodes(rows).map((r) => ({
    episodeId: r.id, studentId: r.student_id, enrollmentId: r.enrollment_id, studentName: r.studentName, validFrom: r.valid_from,
    bond: opts.isAee ? "aee" : "regular",
    situation: r.ending ? { kind: "encerrado", on: r.ending.ended_on, reason: r.ending.reason_label } : { kind: "vigente" },
    otherActiveClasses: opts.otherActive.get(r.student_id) ?? 0,
  }));
}

export function rosterCounts(rows: readonly { id: string; supersedes_id: string | null; student_id: string; enrollment_id: string; ended: boolean }[]): RosterCounts {
  const cur = currentEpisodes(rows);
  return {
    episodes: cur.length,
    distinctStudents: new Set(cur.map((r) => r.student_id)).size,
    distinctEnrollments: new Set(cur.map((r) => r.enrollment_id)).size,
    active: cur.filter((r) => !r.ended).length,
    ended: cur.filter((r) => r.ended).length,
  };
}

/** Conta, por aluno, outros episódios vigentes em turmas diferentes desta (dupla matrícula). */
export function otherActiveByStudent(rows: readonly { id: string; supersedes_id: string | null; student_id: string; class_id: string; ended: boolean }[], classId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of currentEpisodes(rows)) if (r.class_id !== classId && !r.ended) m.set(r.student_id, (m.get(r.student_id) ?? 0) + 1);
  return m;
}

export const ROSTER_PAGE_SIZE = 50;
const sanitize = (q: string) => q.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80);

type Raw = { id: string; student_id: string; enrollment_id: string; class_id: string; valid_from: string | null; supersedes_id: string | null;
  institutional_students: { display_name: string | null } | null; class_enrollment_episode_endings: Array<{ ended_on: string; reason_label: string | null }> | null };

/** Pesquisa, ordena (nome ou início) e pagina a turma INTEIRA; nunca ordena só a página. */
export function sortFilterPage(entries: readonly RosterEntry[], args: { page: number; search: string; sort: RosterSort }) {
  const q = sanitize(args.search).toLocaleLowerCase("pt-BR");
  const f = q ? entries.filter((e) => (e.studentName ?? "").toLocaleLowerCase("pt-BR").includes(q)) : [...entries];
  f.sort(args.sort === "inicio"
    ? (a, b) => (a.validFrom ?? "9999").localeCompare(b.validFrom ?? "9999") || a.episodeId.localeCompare(b.episodeId)
    : (a, b) => (a.studentName ?? "\uffff").localeCompare(b.studentName ?? "\uffff", "pt-BR", { sensitivity: "base" }) || a.episodeId.localeCompare(b.episodeId));
  const from = Math.max(0, args.page) * ROSTER_PAGE_SIZE;
  return { entries: f.slice(from, from + ROSTER_PAGE_SIZE), total: f.length };
}

const ROSTER_MAX = 20000;

export async function readClassRoster(classId: string, args: { page: number; search: string; sort: RosterSort; isAee: boolean }, signal?: AbortSignal) {
  // Turma inteira em páginas de 1000 (ordem estável por id), sob a RLS de quem consulta.
  const all = await readPages<Raw>((from, to) => {
    let b = supabase.from("class_enrollment_episodes")
      .select("id, student_id, enrollment_id, class_id, valid_from, supersedes_id, institutional_students(display_name), class_enrollment_episode_endings(ended_on, reason_label)")
      .eq("class_id", classId).order("id");
    if (signal) b = b.abortSignal(signal);
    return b.range(from, to) as unknown as PromiseLike<{ data: Raw[] | null; error: { message: string } | null }>;
  }, ROSTER_MAX);
  if (all.error) throw new Error(all.error.message);
  const raw = all.data ?? [];
  const ended = (e: unknown) => Array.isArray(e) && e.length > 0;
  const counts = rosterCounts(raw.map((r) => ({ ...r, ended: ended(r.class_enrollment_episode_endings) })));

  // Dupla matrícula: uma leitura paginada para todos os alunos da turma (sem N+1).
  const ids = [...new Set(raw.map((r) => r.student_id))];
  type O = { id: string; supersedes_id: string | null; student_id: string; class_id: string; class_enrollment_episode_endings: unknown };
  const other = ids.length ? await readPages<O>((from, to) => {
    let b = supabase.from("class_enrollment_episodes").select("id, supersedes_id, student_id, class_id, class_enrollment_episode_endings(ended_on)")
      .in("student_id", ids).order("id");
    if (signal) b = b.abortSignal(signal);
    return b.range(from, to) as unknown as PromiseLike<{ data: O[] | null; error: { message: string } | null }>;
  }, ROSTER_MAX) : { data: [] as O[], error: null, truncated: false };
  if (other.error) throw new Error(other.error.message);
  const otherActive = otherActiveByStudent((other.data ?? []).map((r) => ({ ...r, ended: ended(r.class_enrollment_episode_endings) })), classId);

  const rows: RosterEpisodeRow[] = raw.map((r) => ({
    id: r.id, student_id: r.student_id, enrollment_id: r.enrollment_id, class_id: r.class_id, valid_from: r.valid_from, supersedes_id: r.supersedes_id,
    studentName: r.institutional_students?.display_name ?? null, ending: r.class_enrollment_episode_endings?.[0] ?? null,
  }));
  const page = sortFilterPage(projectRoster(rows, { isAee: args.isAee, otherActive }), args);
  return { entries: page.entries, total: page.total, counts, countsTruncated: all.truncated || other.truncated };
}
