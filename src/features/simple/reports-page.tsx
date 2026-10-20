import { operationalToday } from "@/lib/academic-date";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ENTITIES, ENTITY_LIST, type EntityKey } from "./entities";
import { readAll, useOptions } from "./data";
import { PageTitle } from "./simple-shell";
import { DateInput } from "@/components/sigem/date-input";

type Subject = EntityKey | "attendance";
type Row = Record<string, unknown>;

const ageOf = (d: unknown) => {
  if (typeof d !== "string") return null;
  const b = new Date(d), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};

export function ReportsPage() {
  const [subject, setSubject] = useState<Subject>("students");
  const [groupBy, setGroupBy] = useState("school_id");
  const [school, setSchool] = useState("");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 8) + "01");
  const [to, setTo] = useState(() => operationalToday());
  const schools = useOptions("schools");
  const classes = useOptions("classes");
  const staff = useOptions("staff");
  const names = useMemo(() => ({
    school_id: new Map((schools.data ?? []).map((s) => [s.id, s.name])),
    class_id: new Map((classes.data ?? []).map((s) => [s.id, s.name])),
    teacher_id: new Map((staff.data ?? []).map((s) => [s.id, s.name])),
  }), [schools.data, classes.data, staff.data]);

  const groupOptions = subject === "attendance"
    ? [{ key: "school_id", label: "Escola" }, { key: "class_id", label: "Turma" }, { key: "student", label: "Aluno" }, { key: "day", label: "Dia" }]
    : [...ENTITIES[subject].fields.filter((f) => f.group).map((f) => ({ key: f.key, label: f.label })), ...(subject === "students" ? [{ key: "age", label: "Idade" }] : [])];

  const data = useQuery({
    queryKey: ["sg-report", subject, school, from, to],
    queryFn: async () => {
      if (subject === "attendance") {
        const st = await readAll("sg_students", "id,name,school_id,class_id", school ? (q) => q.eq("school_id", school) : undefined);
        const sm = new Map(st.map((s) => [s.id, s]));
        const at = await readAll("sg_attendance", "id,student_id,day,present", (q) => q.gte("day", from).lte("day", to));
        return at.filter((a) => sm.has(String(a["student_id"]))).map((a) => {
          const s = sm.get(String(a["student_id"]))!;
          return { ...a, school_id: s["school_id"], class_id: s["class_id"], student: s["name"] } as Row;
        });
      }
      const e = ENTITIES[subject];
      return readAll(e.table, "*", school && e.fields.some((f) => f.key === "school_id") ? (q) => q.eq("school_id", school) : undefined);
    },
  });

  const label = (k: string, v: unknown) => {
    if (v == null || v === "") return "Não informado";
    const m = (names as Record<string, Map<string, string>>)[k];
    return m ? m.get(String(v)) ?? "Não informado" : k === "day" ? String(v).split("-").reverse().join("/") : String(v);
  };

  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; total: number; present: number }>();
    for (const r of data.data ?? []) {
      const raw = groupBy === "age" ? ageOf(r["birth_date"]) : r[groupBy];
      const name = groupBy === "age" ? (raw == null ? "Não informado" : `${raw} anos`) : label(groupBy, raw);
      const g = m.get(name) ?? { name, total: 0, present: 0 };
      g.total++; if (r["present"] === true) g.present++;
      m.set(name, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [data.data, groupBy, names]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAtt = subject === "attendance";
  const total = data.data?.length ?? 0;
  const groupLabel = groupOptions.find((g) => g.key === groupBy)?.label ?? "";
  const title = `${isAtt ? "Frequência" : ENTITIES[subject as EntityKey].many} por ${groupLabel}`;
  const tableRows = grouped.map((g) => isAtt ? [g.name, g.total, g.present, g.total - g.present, `${Math.round((g.present / g.total) * 100)}%`] : [g.name, g.total, `${((g.total / Math.max(1, total)) * 100).toFixed(1)}%`]);
  const head = isAtt ? [groupLabel, "Registros", "Presenças", "Faltas", "Frequência"] : [groupLabel, "Quantidade", "%"];
  const chart = grouped.slice(0, 25).map((g) => ({ name: g.name.length > 22 ? g.name.slice(0, 21) + "…" : g.name, valor: isAtt ? Math.round((g.present / g.total) * 100) : g.total }));

  async function toExcel(full: boolean) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Relatório");
    if (full && !isAtt) {
      const fields = ENTITIES[subject as EntityKey].fields;
      ws.addRow(fields.map((f) => f.label));
      for (const r of data.data ?? []) ws.addRow(fields.map((f) => (f.type === "ref" ? label(f.key, r[f.key]) : r[f.key] ?? "")));
    } else { ws.addRow(head); tableRows.forEach((r) => ws.addRow(r)); }
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf]), `${title}.xlsx`);
  }
  async function toPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`SIGEM — ${title}`, 14, 16);
    doc.setFontSize(10); doc.text(`Total: ${total} · Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 23);
    autoTable(doc, { head: [head], body: tableRows.map((r) => r.map(String)), startY: 28 });
    doc.save(`${title}.pdf`);
  }

  const sel = "min-h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg";
  return (
    <div>
      <PageTitle emoji="📊" title="Relatórios" />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="O quê">
        {[...ENTITY_LIST.map((e) => ({ k: e.key as Subject, l: `${e.emoji} ${e.many}` })), { k: "attendance" as Subject, l: "✅ Frequência" }].map((o) => (
          <button key={o.k} type="button" aria-pressed={subject === o.k} onClick={() => { setSubject(o.k); setGroupBy("school_id"); }}
            className={`min-h-14 rounded-2xl px-5 text-lg font-semibold ${subject === o.k ? "bg-primary text-primary-foreground sg-glow" : "bg-card"}`}>{o.l}</button>
        ))}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-base">Separar por
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={sel}>
            {groupOptions.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </label>
        {subject !== "schools" && (
          <label className="grid gap-1 text-base">Escola
            <select value={school} onChange={(e) => setSchool(e.target.value)} className={sel}>
              <option value="">Todas</option>
              {(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {isAtt && <>
          <label className="grid gap-1 text-base">De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} className={`${sel} h-14`} /></label>
          <label className="grid gap-1 text-base">Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} className={`${sel} h-14`} /></label>
        </>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-2xl font-bold">{data.isLoading ? "Contando…" : `Total: ${total.toLocaleString("pt-BR")}`}</p>
        <button type="button" onClick={() => toExcel(false)} className="min-h-12 rounded-2xl bg-secondary px-4 text-lg">⬇ Excel</button>
        {!isAtt && <button type="button" onClick={() => toExcel(true)} className="min-h-12 rounded-2xl bg-secondary px-4 text-lg">⬇ Lista completa</button>}
        <button type="button" onClick={toPdf} className="min-h-12 rounded-2xl bg-secondary px-4 text-lg">⬇ PDF</button>
      </div>
      {data.error && <p className="rounded-2xl bg-destructive/20 p-4 text-lg">Não consegui ler agora.</p>}

      {chart.length > 0 && (
        <div className="mb-6 h-80 rounded-3xl bg-card p-4 sg-glow" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              <Bar dataKey="valor" name={isAtt ? "Frequência %" : "Quantidade"} fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl bg-card">
        <table className="w-full text-left text-lg">
          <caption className="sr-only">{title}</caption>
          <thead><tr>{head.map((h) => <th key={h} scope="col" className="border-b border-border p-3">{h}</th>)}</tr></thead>
          <tbody>{tableRows.map((r) => <tr key={String(r[0])} className="border-b border-border/50">{r.map((c, i) => <td key={i} className="p-3">{String(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
