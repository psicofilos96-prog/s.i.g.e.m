import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cellKey, printFinalSheet, projectFinalSheet, resultMinutes, type Modality, type SheetCell, type SheetInput } from "@/features/diary/final-sheet";

const title = "Laboratório da Folha Final — SIGEM";
const description = "Folha Final no layout dos modelos de diário da rede: médias, recuperação final, frequência, resultado e ata, com pendências explícitas.";

export const Route = createFileRoute("/laboratorio/folha-final")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const PERIODS: Record<Modality, string[]> = {
  "fundamental-anos-iniciais": ["1º PL", "2º PL", "3º PL"],
  "fundamental-anos-finais": ["1º PL", "2º PL", "3º PL"],
  eja: ["1º B", "2º B"],
  "educacao-infantil": [],
};
const LABEL: Record<Modality, string> = { "fundamental-anos-iniciais": "Fundamental I", "fundamental-anos-finais": "Fundamental II", eja: "EJA (semestral)", "educacao-infantil": "Educação Infantil" };
const COMPONENTS = [{ id: "lp", label: "Língua Portuguesa" }, { id: "mat", label: "Matemática" }];
const STUDENTS = [
  { id: "s1", name: "Estudante sintético 1", status: "Ativo" },
  { id: "s2", name: "Estudante sintético 2", status: "Ativo" },
  { id: "s3", name: "Estudante sintético 3", status: "Transferido" },
];
const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v)));

function Page() {
  const [modality, setModality] = useState<Modality>("fundamental-anos-finais");
  const [cells, setCells] = useState<Record<string, SheetCell>>({});
  const periods = PERIODS[modality];
  const input: SheetInput = { modality, periods, components: COMPONENTS, students: STUDENTS, cells };
  const sheet = useMemo(() => projectFinalSheet(input), [modality, cells]); // eslint-disable-line react-hooks/exhaustive-deps
  const minutes = resultMinutes(sheet.rows);

  const set = (s: string, c: string, patch: Partial<SheetCell>) =>
    setCells((prev) => {
      const k = cellKey(s, c);
      const cur = prev[k] ?? { periodGrades: periods.map(() => null), finalRecovery: null, lessonsGiven: null, absences: null };
      return { ...prev, [k]: { ...cur, ...patch } };
    });

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(printFinalSheet(input, sheet.rows, { school: "Escola (simulação)", className: "Turma simulada", year: "2026" }));
    w.document.close();
    w.print();
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Folha Final, Boletim e Ata</h1>
        <p className="text-sm text-muted-foreground">Cálculo pelas regras dos modelos de diário da rede (média ≥ 50; EJA também frequência ≥ 75%). Esta tela usa estudantes sintéticos: nada é gravado e nenhum resultado é oficial.</p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Modalidade">
        {(Object.keys(LABEL) as Modality[]).map((m) => (
          <Button key={m} variant={m === modality ? "default" : "outline"} onClick={() => { setModality(m); setCells({}); }}>{LABEL[m]}</Button>
        ))}
      </div>

      {sheet.blocked ? (
        <p className="rounded-md border border-border bg-muted p-4 text-sm text-foreground">{sheet.blocked}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-2">Estudante</th><th className="p-2">Componente</th>{periods.map((p) => <th key={p} className="p-2">{p}</th>)}<th className="p-2">Rec. final</th><th className="p-2">Aulas dadas</th><th className="p-2">Faltas</th><th className="p-2">Média</th><th className="p-2">Freq.</th><th className="p-2">Situação</th></tr>
              </thead>
              <tbody>
                {sheet.rows.flatMap((r) => r.components.map((c, ci) => {
                  const cell = cells[cellKey(r.student.id, c.id)];
                  const field = (val: number | null | undefined, on: (v: number | null) => void, label: string) => (
                    <input aria-label={label} type="number" min={0} className="w-16 rounded border border-input bg-background px-1 py-0.5" value={val ?? ""} onChange={(e) => on(num(e.target.value))} />
                  );
                  return (
                    <tr key={r.student.id + c.id} className="border-t border-border">
                      <td className="p-2">{ci === 0 ? `${r.student.name}${r.student.status !== "Ativo" ? ` (${r.student.status})` : ""}` : ""}</td>
                      <td className="p-2">{COMPONENTS.find((x) => x.id === c.id)?.label}</td>
                      {periods.map((p, k) => <td key={p} className="p-2">{field(cell?.periodGrades[k], (v) => { const g = [...(cell?.periodGrades ?? periods.map(() => null))]; g[k] = v; set(r.student.id, c.id, { periodGrades: g }); }, `${r.student.name} ${c.id} ${p}`)}</td>)}
                      <td className="p-2">{field(cell?.finalRecovery, (v) => set(r.student.id, c.id, { finalRecovery: v }), "Recuperação final")}</td>
                      <td className="p-2">{field(cell?.lessonsGiven, (v) => set(r.student.id, c.id, { lessonsGiven: v }), "Aulas dadas")}</td>
                      <td className="p-2">{field(cell?.absences, (v) => set(r.student.id, c.id, { absences: v }), "Faltas")}</td>
                      <td className="p-2">{c.average ?? "—"}</td>
                      <td className="p-2">{c.attendance === null ? "—" : `${Math.round(c.attendance * 100)}%`}</td>
                      <td className="p-2 font-medium">{c.result}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

          <section className="space-y-2 rounded-md border border-border p-4">
            <h2 className="font-semibold text-foreground">Ata de resultados</h2>
            <p className="text-sm text-foreground">{minutes.total} estudantes · {Object.entries(minutes.by).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
            {!minutes.canClose && <p className="text-sm text-destructive">Fechamento bloqueado: há pendências.</p>}
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {sheet.rows.flatMap((r) => r.missing.slice(0, 3).map((m) => <li key={r.student.id + m}>{r.student.name} — {m}</li>))}
            </ul>
            <Button onClick={print}>Imprimir Folha Final (A4 paisagem)</Button>
          </section>
        </>
      )}
    </main>
  );
}
