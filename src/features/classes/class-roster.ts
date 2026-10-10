/**
 * LOTE 3/14 — Diário nominal da turma 2026.
 * Leitura só com a sessão de quem consulta (RLS do banco decide escola/turma); nenhuma escrita,
 * nenhum cliente privilegiado. Paginação, pesquisa e ordenação acontecem no servidor de dados.
 * Projeção pura: episódio corrigido (superseded) sai da lista; saída registrada vira "encerrado";
 * AEE só quando a turma declara tipo AEE; dupla matrícula = o mesmo aluno com outro episódio
 * vigente em outra turma visível. Ausência continua ausência.
 */
import { supabase } from "@/integrations/supabase/client";

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

export async function readClassRoster(classId: string, args: { page: number; search: string; sort: RosterSort; isAee: boolean }, signal?: AbortSignal) {
  const q = sanitize(args.search);
  const from = args.page * ROSTER_PAGE_SIZE;
  let b = supabase.from("class_enrollment_episodes")
    .select(`id, student_id, enrollment_id, class_id, valid_from, supersedes_id, institutional_students${q ? "!inner" : ""}(display_name), class_enrollment_episode_endings(ended_on, reason_label)`, { count: "exact" })
    .eq("class_id", classId);
  if (q) b = b.ilike("institutional_students.display_name", `%${q}%`);
  b = args.sort === "inicio" ? b.order("valid_from", { ascending: true, nullsFirst: false }).order("id") : b.order("student_id").order("id");
  if (signal) b = b.abortSignal(signal);
  const page = await b.range(from, from + ROSTER_PAGE_SIZE - 1);
  if (page.error) throw new Error(page.error.message);
  const raw = (page.data ?? []) as unknown as Raw[];

  // Contagens exatas da turma inteira (só ids) e dupla matrícula da página — duas leituras, sem N+1.
  const ids = [...new Set(raw.map((r) => r.student_id))];
  let ac = supabase.from("class_enrollment_episodes").select("id, supersedes_id, student_id, enrollment_id, class_enrollment_episode_endings(ended_on)").eq("class_id", classId).limit(1000);
  let oc = supabase.from("class_enrollment_episodes").select("id, supersedes_id, student_id, class_id, class_enrollment_episode_endings(ended_on)").in("student_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).limit(1000);
  if (signal) { ac = ac.abortSignal(signal); oc = oc.abortSignal(signal); }
  const [all, other] = await Promise.all([ac, oc]);
  if (all.error) throw new Error(all.error.message);
  if (other.error) throw new Error(other.error.message);
  const ended = (e: unknown) => Array.isArray(e) && e.length > 0;
  const counts = rosterCounts((all.data ?? []).map((r) => ({ ...r, ended: ended(r.class_enrollment_episode_endings) })));
  const otherActive = otherActiveByStudent((other.data ?? []).map((r) => ({ ...r, ended: ended(r.class_enrollment_episode_endings) })), classId);

  const rows: RosterEpisodeRow[] = raw.map((r) => ({
    id: r.id, student_id: r.student_id, enrollment_id: r.enrollment_id, class_id: r.class_id, valid_from: r.valid_from, supersedes_id: r.supersedes_id,
    studentName: r.institutional_students?.display_name ?? null, ending: r.class_enrollment_episode_endings?.[0] ?? null,
  }));
  let entries = projectRoster(rows, { isAee: args.isAee, otherActive });
  if (args.sort === "nome") entries = [...entries].sort((a, b) => (a.studentName ?? "\uffff").localeCompare(b.studentName ?? "\uffff", "pt-BR", { sensitivity: "base" }) || a.episodeId.localeCompare(b.episodeId));
  return { entries, total: page.count ?? 0, counts, countsTruncated: (all.data?.length ?? 0) >= 1000 };
}
