import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WEEKDAY_LABEL } from "@/features/student-life/class-journey-source";
import { responsibleNames } from "./institutional-schedules-page";
import {
  CROSS_CLASS_TEXT, NO_CROSS_CLASS_TEXT, conflictsOfClass, conflictsOfPerson, coverageNote,
  crossClassTeacherConflicts, personsOfEngagements, readAccessibleSchedules,
} from "./teacher-cross-class-conflicts";
import { openSchedulePrint, rowsOf, schedulePrintHtml } from "./schedule-print";

type Opt = { id: string; name: string; schoolId: string };

/** NHOR.4 — alerta factual de conflito do mesmo profissional entre turmas + ficha do profissional + impressão. */
export function CrossClassPanel({ classes, classId, validOn, knownAt, contextKey }: {
  classes: readonly Opt[]; classId: string; validOn: string; knownAt: string; contextKey: string;
}) {
  const t = { validOn, knownAt };
  const ids = classes.map((c) => c.id);
  const batch = useQuery({ queryKey: ["nhor4-batch", contextKey, ids, validOn, knownAt], enabled: ids.length > 0, queryFn: () => readAccessibleSchedules(ids, t) });
  const engs = useMemo(() => [...new Set((batch.data?.schedules ?? []).flatMap((s) => s.days.flatMap((d) => d.blocks.flatMap((b) => b.engagementIds))))].sort(), [batch.data]);
  const persons = useQuery({ queryKey: ["nhor4-persons", contextKey, engs, validOn, knownAt], enabled: engs.length > 0, queryFn: () => personsOfEngagements(engs, t) });
  const names = useQuery({ queryKey: ["nhor4-names", contextKey, engs, validOn, knownAt], enabled: engs.length > 0, queryFn: () => responsibleNames(engs, t) });
  const [person, setPerson] = useState("");

  if (batch.error) return <p role="alert" className="text-sm text-destructive">Não foi possível verificar conflitos entre turmas. Nada foi concluído.</p>;
  if (!batch.data || (engs.length > 0 && !persons.data)) return <p role="status" className="text-sm text-muted-foreground">Verificando conflitos entre turmas…</p>;
  if (persons.data?.error) return <p role="alert" className="text-sm text-destructive">Não foi possível identificar os profissionais das grades. Nenhum conflito entre turmas foi concluído.</p>;

  const personOf = persons.data?.map ?? new Map<string, string>();
  const { conflicts, unresolvedEngagements } = crossClassTeacherConflicts(batch.data.schedules, personOf);
  const coverage = coverageNote(batch.data, unresolvedEngagements.length);
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? "Turma sem nome legível";
  const engName = names.data?.names ?? new Map<string, string>();
  const personName = (p: string) => { for (const [e, q] of personOf) if (q === p && engName.get(e)) return engName.get(e)!; return "Profissional sem nome legível"; };
  const mine = conflictsOfClass(conflicts, classId);
  const current = batch.data.schedules.find((s) => s.classId === classId);
  const peopleHere = [...new Set((current?.days ?? []).flatMap((d) => d.blocks.flatMap((b) => b.engagementIds)).map((e) => personOf.get(e)).filter((x): x is string => Boolean(x)))].sort((a, b) => personName(a).localeCompare(personName(b)));
  const chosen = peopleHere.includes(person) ? person : peopleHere[0] ?? "";
  const engsOf = (p: string) => new Set([...personOf].filter(([, q]) => q === p).map(([e]) => e));
  const schoolId = classes.find((c) => c.id === classId)?.schoolId;
  const base = { validOn, className, personName, coverage };
  const print = (scope: "turma" | "profissional" | "escola") => {
    const sch = batch.data!.schedules;
    const html = scope === "turma"
      ? schedulePrintHtml({ ...base, scope, subject: className(classId), rows: rowsOf(sch.filter((s) => s.classId === classId), className, (e) => engName.get(e)), conflicts: mine })
      : scope === "profissional"
        ? schedulePrintHtml({ ...base, scope, subject: personName(chosen), rows: rowsOf(sch, className, (e) => engName.get(e), engsOf(chosen)), conflicts: conflictsOfPerson(conflicts, chosen) })
        : (() => { const inSchool = new Set(classes.filter((c) => c.schoolId === schoolId).map((c) => c.id));
            return schedulePrintHtml({ ...base, scope, subject: "Escola da turma selecionada", rows: rowsOf(sch.filter((s) => inSchool.has(s.classId)), className, (e) => engName.get(e)), conflicts: conflicts.filter((c) => inSchool.has(c.a.classId) || inSchool.has(c.b.classId)) }); })();
    openSchedulePrint(html);
  };
  const personConf = chosen ? conflictsOfPerson(conflicts, chosen) : [];

  return (
    <section className="space-y-3 rounded-md border border-border p-3 text-sm" aria-label="Conflitos do mesmo profissional entre turmas">
      <h2 className="font-medium">Conflitos do mesmo profissional entre turmas</h2>
      {mine.length === 0
        ? <p className="text-xs text-muted-foreground" data-testid="cross-class-conflicts">{NO_CROSS_CLASS_TEXT}</p>
        : <div role="alert" data-testid="cross-class-conflicts" className="text-destructive"><p>{CROSS_CLASS_TEXT}</p><ul className="list-disc pl-5">{mine.map((c) => (
            <li key={`${c.personId}-${c.a.blockId}-${c.b.blockId}`}>{personName(c.personId)} · {WEEKDAY_LABEL[c.weekday] ?? "Dia"} {c.overlapStart}–{c.overlapEnd}: {className(c.a.classId)} e {className(c.b.classId)}</li>))}</ul></div>}
      {coverage && <p role="note" className="text-xs text-muted-foreground">{coverage}</p>}
      {peopleHere.length > 0 && (
        <div className="space-y-2 rounded border border-border p-2" aria-label="Ficha do profissional">
          <Label htmlFor="nhor4-person">Ficha do profissional</Label>
          <select id="nhor4-person" className="h-9 rounded-md border border-input bg-background px-2" value={chosen} onChange={(e) => setPerson(e.target.value)}>
            {peopleHere.map((p) => <option key={p} value={p}>{personName(p)}</option>)}
          </select>
          <p data-testid="person-conflicts" className={personConf.length ? "text-destructive" : "text-muted-foreground"}>
            {personConf.length ? `${CROSS_CLASS_TEXT} (${personConf.length})` : NO_CROSS_CLASS_TEXT}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => print("turma")}><Printer aria-hidden /> PDF da turma</Button>
        <Button type="button" variant="outline" size="sm" disabled={!chosen} onClick={() => print("profissional")}><Printer aria-hidden /> PDF do profissional</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => print("escola")}><Printer aria-hidden /> PDF da escola</Button>
      </div>
    </section>
  );
}
