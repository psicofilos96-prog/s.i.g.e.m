import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, readAll, useOptions } from "./data";
import { PageTitle } from "./simple-shell";

export function AttendancePage() {
  const schools = useOptions("schools");
  const classes = useOptions("classes");
  const [school, setSchool] = useState("");
  const [klass, setKlass] = useState("");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const roster = useQuery({
    queryKey: ["sg-roster", klass, day],
    enabled: Boolean(klass),
    queryFn: async () => {
      const st = await readAll("sg_students", "id,name", (q) => q.eq("class_id", klass));
      st.sort((a, b) => String(a["name"]).localeCompare(String(b["name"]), "pt-BR"));
      const { data, error } = await db.from("sg_attendance").select("student_id,present").eq("class_id", klass).eq("day", day);
      if (error) throw new Error(error.message);
      const m: Record<string, boolean> = {};
      for (const r of data as { student_id: string; present: boolean }[]) m[r.student_id] = r.present;
      return { students: st as { id: string; name: string }[], marks: m };
    },
  });
  useEffect(() => { if (roster.data) setMarks(roster.data.marks); }, [roster.data]);

  const sel = "min-h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg";
  const list = roster.data?.students ?? [];
  const present = list.filter((s) => marks[s.id] === true).length;

  return (
    <div>
      <PageTitle emoji="✅" title="Chamada" />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <select aria-label="Escola" value={school} onChange={(e) => { setSchool(e.target.value); setKlass(""); }} className={sel}>
          <option value="">1. Escolha a escola</option>
          {(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Turma" value={klass} onChange={(e) => setKlass(e.target.value)} className={sel} disabled={!school}>
          <option value="">2. Escolha a turma</option>
          {(classes.data ?? []).filter((c) => c.school_id === school).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input aria-label="Dia" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={sel} />
      </div>

      {klass && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-lg">
            <span>{present} presentes de {list.length}</span>
            <button type="button" onClick={() => setMarks(Object.fromEntries(list.map((s) => [s.id, true])))} className="min-h-12 rounded-2xl bg-secondary px-4">Todos presentes</button>
          </div>
          {roster.isLoading && <p className="text-xl text-muted-foreground">Abrindo a turma…</p>}
          {!roster.isLoading && list.length === 0 && <p className="text-xl text-muted-foreground">Esta turma ainda não tem alunos.</p>}
          <ul className="grid gap-2">
            {list.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3">
                <span className="truncate text-xl"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{s.name}</span>
                <div className="flex shrink-0 gap-2">
                  <button type="button" aria-pressed={marks[s.id] === true} onClick={() => setMarks((m) => ({ ...m, [s.id]: true }))}
                    className={`min-h-14 min-w-14 rounded-xl text-2xl font-bold ${marks[s.id] === true ? "bg-success text-success-foreground" : "bg-secondary"}`} aria-label={`${s.name} presente`}>✓</button>
                  <button type="button" aria-pressed={marks[s.id] === false} onClick={() => setMarks((m) => ({ ...m, [s.id]: false }))}
                    className={`min-h-14 min-w-14 rounded-xl text-2xl font-bold ${marks[s.id] === false ? "bg-destructive text-destructive-foreground" : "bg-secondary"}`} aria-label={`${s.name} faltou`}>✗</button>
                </div>
              </li>
            ))}
          </ul>
          {list.length > 0 && (
            <button disabled={busy} onClick={async () => {
              setBusy(true);
              const rows = Object.entries(marks).map(([student_id, p]) => ({ student_id, class_id: klass, day, present: p }));
              const { error } = await db.from("sg_attendance").upsert(rows, { onConflict: "student_id,day" });
              setBusy(false);
              if (error) toast.error(error.message); else toast.success("Chamada salva ✓");
            }} className="mt-6 min-h-16 w-full rounded-2xl bg-primary text-2xl font-bold text-primary-foreground sg-glow disabled:opacity-50">
              {busy ? "Salvando…" : "✓ Salvar chamada"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
