import { useState } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAcademicDate } from "@/lib/academic-date";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { schoolsWithCapability } from "./institutional-class-source";
import { ASSIGNMENT_STATE_TEXT, TEACHING_ASSIGNMENT_CAPABILITY, humanAssignmentError, readTeachingAssignments } from "./teaching-assignment-source";
import { assignTeacher, assignmentElements, classSchoolOf, endTeacherAssignment, humanTeamError, teachingCandidates } from "./class-team-source";

/**
 * N5.3.2 — "Professores da turma": leitura canônica + atribuição/encerramento pelo writer v2.
 * O ator é a sessão (pessoa ou Secretaria setorial); o professor é sempre uma atuação real da escola.
 */
export function TeachingAssignmentPanel({ classId, validOn }: { classId: string; validOn: string }) {
  const [knownAt, setKnownAt] = useState(() => new Date().toISOString());
  const qc = useQueryClient();
  const auth = useSessionAuthority();
  const school = useQuery({ queryKey: ["class-school", classId], queryFn: () => classSchoolOf(classId) });
  const canAssign = auth.status === "signed-in" && !!school.data && schoolsWithCapability(auth.capabilities, TEACHING_ASSIGNMENT_CAPABILITY).includes(school.data);
  const q = useQuery({ queryKey: ["teaching-assignments", classId, validOn, knownAt], queryFn: () => readTeachingAssignments(classId, validOn, knownAt) });
  const cands = useQuery({ queryKey: ["teaching-candidates", school.data, validOn], enabled: canAssign, queryFn: () => teachingCandidates(school.data!, validOn) });
  const elems = useQuery({ queryKey: ["assignment-elements", classId, validOn], enabled: canAssign, queryFn: () => assignmentElements(classId, validOn) });
  const [search, setSearch] = useState(""); const [cand, setCand] = useState(""); const [elem, setElem] = useState("");
  const [from, setFrom] = useState(validOn); const [until, setUntil] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => { setKnownAt(new Date().toISOString()); void qc.invalidateQueries({ queryKey: ["teaching-assignments", classId] }); };
  const nameOf = (engagementId: string) => cands.data?.find((c) => c.engagementId === engagementId)?.name ?? "Profissional da escola";

  const add = useMutation({
    mutationFn: async () => {
      const c = cands.data?.find((x) => x.engagementId === cand); const e = elems.data?.find((x) => `${x.matrixVersionId}|${x.itemKey}` === elem);
      if (!c || !e) throw new Error("Escolha o professor e o componente.");
      if (until && until < from) throw new Error("O fim precisa ser depois do início.");
      return assignTeacher({ classId, candidate: c, element: e, from, until: until || null });
    },
    onSuccess: () => { setMsg("Professor vinculado."); setCand(""); setElem(""); refresh(); },
    onError: (e) => setMsg(e instanceof Error && e.message.startsWith("Escolha") || (e instanceof Error && e.message.startsWith("O fim")) ? e.message : humanTeamError(e)),
  });
  const end = useMutation({
    mutationFn: async (a: NonNullable<typeof q.data>[number]) => {
      const c = cands.data?.find((x) => x.engagementId === a.engagementId);
      return endTeacherAssignment({ classId, assignmentId: a.assignmentId, headVersionId: a.versionId, from: a.from, until: validOn,
        engagementId: a.engagementId, functionalLinkId: c?.functionalLinkId ?? null, matrixVersionId: a.matrixVersionId,
        itemKey: a.itemKey, reason: "Encerramento do vínculo pela Secretaria" });
    },
    onSuccess: () => { setMsg("Vínculo encerrado. O histórico foi preservado."); refresh(); },
    onError: (e) => setMsg(humanTeamError(e)),
  });

  const filtered = (cands.data ?? []).filter((c) => `${c.name} ${c.registration ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const sel = "mt-1 block h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <section aria-labelledby="ta-title" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 id="ta-title" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="size-4" />Professores da turma</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando professores…</p>
        : q.error ? <p role="alert" className="text-sm text-destructive">{humanAssignmentError(q.error)}</p>
        : !q.data?.length ? <p className="text-sm text-muted-foreground">Nenhum professor vinculado a esta turma na data.</p>
        : (
          <ul className="grid gap-2 text-sm">
            {q.data.map((a) => (
              <li key={a.assignmentId} className="rounded border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{nameOf(a.engagementId)}</span>
                  <span className="text-muted-foreground">· {a.elementLabel ?? "Componente sem rótulo declarado"}</span>
                  <Badge variant={a.state === "vigente" ? "secondary" : "destructive"}>{ASSIGNMENT_STATE_TEXT[a.state]}</Badge>
                  {a.coAssignedCount > 0 ? <Badge variant="outline">Divide o componente com mais {a.coAssignedCount}</Badge> : null}
                </div>
                <p className="text-muted-foreground">
                  {formatAcademicDate(a.from)} – {a.until ? formatAcademicDate(a.until) : "sem término"} · versão {a.version}
                </p>
                {canAssign && !a.until && a.state === "vigente" ? (
                  <Button type="button" size="sm" variant="outline" className="mt-1" disabled={end.isPending}
                    onClick={() => { if (window.confirm(`Encerrar o vínculo em ${formatAcademicDate(validOn)}? O histórico continua guardado.`)) end.mutate(a); }}>
                    Encerrar vínculo
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

      {canAssign ? (
        <div className="mt-4 grid gap-2 border-t border-border pt-3 text-sm">
          <h3 className="font-semibold">Vincular professor</h3>
          {cands.isLoading || elems.isLoading ? <p className="text-muted-foreground">Carregando…</p>
            : !cands.data?.length ? <p className="text-muted-foreground">Nenhum profissional elegível cadastrado para esta escola.</p>
            : !elems.data?.length ? <p className="text-muted-foreground">Matriz curricular ainda não configurada para este ano.</p>
            : (
              <>
                <label>Buscar por nome ou matrícula funcional
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: Maria ou 12345" /></label>
                <label>Professor
                  <select className={sel} value={cand} onChange={(e) => setCand(e.target.value)}>
                    <option value="">Escolha…</option>
                    {filtered.map((c) => <option key={c.engagementId} value={c.engagementId}>{c.name}{c.registration ? ` — matrícula ${c.registration}` : ""}{c.positionLabel ? ` · ${c.positionLabel}` : ""}</option>)}
                  </select></label>
                <label>Componente
                  <select className={sel} value={elem} onChange={(e) => setElem(e.target.value)}>
                    <option value="">Escolha…</option>
                    {elems.data.map((x) => <option key={`${x.matrixVersionId}|${x.itemKey}`} value={`${x.matrixVersionId}|${x.itemKey}`}>{x.label ?? "Componente sem rótulo declarado"}</option>)}
                  </select></label>
                <div className="grid grid-cols-2 gap-2">
                  <label>Início<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                  <label>Fim (opcional)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
                </div>
                <Button type="button" className="w-fit" disabled={add.isPending} onClick={() => { setMsg(null); add.mutate(); }}>{add.isPending ? "Vinculando…" : "Vincular professor"}</Button>
              </>
            )}
          <p className="text-xs text-muted-foreground">Aparecem só pessoas com atuação, vínculo funcional e lotação vigentes nesta escola. Nenhum professor, vínculo ou acesso é criado aqui.</p>
        </div>
      ) : null}
      {msg ? <p role="status" className="mt-2 text-sm">{msg}</p> : null}
    </section>
  );
}
