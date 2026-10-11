/**
 * Livro do Diário por família de modelo da rede. Turma, família, componente e períodos explícitos;
 * dados lidos com a sessão (RLS). Pré-visualização e impressão A4 saem do mesmo HTML.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { DateInput } from "@/components/sigem/date-input";
import { useSessionUser } from "@/features/authority/session-authority";
import { institution } from "@/config/institution";
import { applicableRule, readClasses, type ClassOption } from "../final-sheet-cloud";
import type { Modality } from "../final-sheet";
import { FAMILIES, familyOf, type FamilyId, type SheetKind } from "./families";
import { bookIssues, renderBook, type BookInput, type BookPeriod } from "./book";
import { loadBookInput, readClassInfo, readResultRules, readYearPeriods } from "./book-cloud";

const field = "mt-1 block w-full rounded border bg-background p-2 text-sm";
const box = "surface-panel space-y-3 p-4";
const MODALITY: Partial<Record<FamilyId, Modality>> = { "fundamental-i": "fundamental-anos-iniciais", "componente-fii-eja": "fundamental-anos-finais", "livro-de-notas": "fundamental-anos-finais", "eja-i-v": "eja" };
const say = (e: unknown) => (e instanceof Error && !/SQLSTATE|permission denied|violates/i.test(e.message) ? e.message : "Não foi possível concluir. Tente de novo.");

function blankPeriods(count: number, unit: string): BookPeriod[] {
  return Array.from({ length: count }, (_, k) => ({ label: `${k + 1}º ${unit}`, from: "", to: "", planned: null }));
}

export function FamilyBookPage() {
  const { user, loading } = useSessionUser();
  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState("");
  const [family, setFamily] = useState<FamilyId>("componente-fii-eja");
  const [periods, setPeriods] = useState<BookPeriod[]>(blankPeriods(4, "período letivo"));
  const [componentId, setComponentId] = useState("");
  const [teacher, setTeacher] = useState("");
  const [shift, setShift] = useState("");
  const [kinds, setKinds] = useState<SheetKind[] | null>(null);
  const [input, setInput] = useState<BookInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (user) readClasses().then(setClasses).catch(() => setErr("Não foi possível ler as turmas com o seu acesso.")); }, [user]);
  const fam = familyOf(family);
  useEffect(() => { setKinds(null); setInput(null); setPeriods((p) => (p.length === fam.periods.count ? p : blankPeriods(fam.periods.count, fam.periods.unit))); }, [family]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sugestão de datas: períodos cadastrados do ano da turma (editáveis); sem cadastro, o usuário informa.
  useEffect(() => {
    if (!classId) return; setInput(null);
    void readClassInfo(classId).then((i) => readYearPeriods(i.yearId)).then((ps) => {
      if (ps.length) setPeriods(ps.slice(0, fam.periods.count).map((p) => ({ label: p.label, from: p.from, to: p.to, planned: null })));
    }).catch(() => undefined);
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setBusy(true); setErr(null);
    try {
      const modality = MODALITY[family];
      const cls = classes?.find((c) => c.id === classId);
      const rule = modality ? applicableRule(await readResultRules(), modality, { year: cls?.year }).rule : null;
      const r = await loadBookInput({ family, classId, componentId: componentId || null, periods, teacher: teacher.trim() || null, shift: shift.trim() || null, rule: rule ? { label: rule.label, passMark: rule.passMark } : null });
      setInput(r.input);
      if (!componentId && fam.singleComponent && r.input.components.length === 1) setComponentId(r.input.components[0]!.id);
    } catch (e) { setErr(say(e)); setInput(null); } finally { setBusy(false); }
  };

  const html = useMemo(() => (input ? renderBook({ ...input, componentId: componentId || null }, { kinds: kinds ?? undefined, emblem: institution.emblemUrl, issuedAt: new Date().toISOString() }) : null), [input, kinds, componentId]);
  const issues = input ? bookIssues({ ...input, componentId: componentId || null }) : [];
  const periodsOk = periods.every((p) => p.from && p.to && p.from <= p.to);

  if (loading) return <SkeletonState label="Verificando sessão" />;
  if (!user) return <StatePanel tone="warning" title="Entre para usar" description="O Livro do Diário lê turmas, chamadas e notas reais e exige login." />;

  const print = () => {
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) { setErr("O navegador bloqueou a janela de impressão. Permita janelas para este endereço."); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-4">
      <section className={box} aria-label="Turma e família">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Turma
            <select aria-label="Turma" className={field} value={classId} onChange={(e) => { setClassId(e.target.value); setComponentId(""); }}>
              <option value="">{classes ? "Escolha a turma" : "Carregando turmas…"}</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} — {c.school} ({c.year})</option>)}
            </select>
          </label>
          <label className="text-sm">Família do modelo
            <select aria-label="Família do modelo" className={field} value={family} onChange={(e) => setFamily(e.target.value as FamilyId)}>
              {FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Professor(a) para o cabeçalho (opcional)
            <input aria-label="Professor para o cabeçalho" className={field} value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </label>
          <label className="text-sm">Turno (opcional)
            <input aria-label="Turno" className={field} value={shift} onChange={(e) => setShift(e.target.value)} />
          </label>
          {fam.singleComponent && family === "componente-fii-eja" ? (
            <label className="text-sm">Componente
              <select aria-label="Componente" className={field} value={componentId} onChange={(e) => setComponentId(e.target.value)}>
                <option value="">{input ? "Escolha o componente" : "Carregue a turma para listar"}</option>
                {(input?.components ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Modelos de referência: {fam.models.join(" · ")}</p>
      </section>

      <section className={box} aria-label="Períodos letivos">
        <h2 className="font-semibold">Períodos ({fam.periods.count} × {fam.periods.unit})</h2>
        <div className="grid gap-2">
          {periods.map((p, k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-4">
              <input aria-label={`Nome do período ${k + 1}`} className={field} value={p.label} onChange={(e) => setPeriods(periods.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} />
              <DateInput aria-label={`Início do período ${k + 1}`} value={p.from} onChange={(e) => setPeriods(periods.map((x, j) => (j === k ? { ...x, from: e.target.value } : x)))} />
              <DateInput aria-label={`Fim do período ${k + 1}`} value={p.to} onChange={(e) => setPeriods(periods.map((x, j) => (j === k ? { ...x, to: e.target.value } : x)))} />
              <input aria-label={`Aulas previstas do período ${k + 1}`} inputMode="numeric" placeholder="Aulas previstas (opcional)" className={field} value={p.planned ?? ""} onChange={(e) => setPeriods(periods.map((x, j) => (j === k ? { ...x, planned: e.target.value === "" || !/^\d+$/.test(e.target.value) ? null : Number(e.target.value) } : x)))} />
            </div>
          ))}
        </div>
        <Button disabled={busy || !classId || !periodsOk} onClick={() => void load()}>{busy ? "Lendo…" : "Carregar dados da turma"}</Button>
        {!periodsOk ? <p className="text-xs text-muted-foreground">Informe início e fim de cada período.</p> : null}
      </section>

      {err ? <p role="alert" className="text-sm text-destructive">{err}</p> : null}

      {input ? (
        <section className={box} aria-label="Folhas do livro">
          <h2 className="font-semibold">Folhas</h2>
          <p className="text-sm text-muted-foreground">{input.students.length} estudante(s), {input.attendance.length} aula(s) com chamada, {input.grades.length} lançamento(s) classificados, {input.lessons.length} registro(s) de aula visíveis com o seu acesso.</p>
          <div className="flex flex-wrap gap-3">
            {fam.sheets.map((s) => (
              <label key={s.kind} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={!kinds || kinds.includes(s.kind)} onChange={(e) => { const cur = kinds ?? fam.sheets.map((x) => x.kind); setKinds(e.target.checked ? [...cur, s.kind] : cur.filter((x) => x !== s.kind)); }} />
                {s.title}{s.emittedBy === "folha-final" ? " (Folha Final)" : ""}
              </label>
            ))}
          </div>
          {issues.length ? <ul role="status" aria-label="Pendências" className="list-disc pl-5 text-sm text-muted-foreground">{issues.map((x) => <li key={x}>{x}</li>)}</ul> : <p role="status" className="text-sm">Sem pendências: documento completo para as fontes lidas.</p>}
          {input.unclassified.length ? <p className="text-xs text-muted-foreground">Sem coluna do modelo: {input.unclassified.map((u) => u.title).join(", ")}. Defina a coluna ao criar a avaliação.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={print}>Imprimir / salvar PDF</Button>
            <Button asChild variant="outline"><Link to="/diario/folha-final">Folha Final, Boletim, Ficha e Ata</Link></Button>
          </div>
          {html ? <iframe title="Pré-visualização do livro" className="h-[70vh] w-full rounded border bg-background" srcDoc={html} /> : null}
        </section>
      ) : null}

      <details className={box}>
        <summary className="cursor-pointer font-semibold">Checklist do modelo — {fam.label}</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left text-xs">
            <thead><tr><th scope="col">Folha</th><th scope="col">Campos</th><th scope="col">Tabelas</th><th scope="col">Cálculos</th><th scope="col">Rodapé / assinaturas</th><th scope="col">Paginação</th></tr></thead>
            <tbody>{fam.sheets.map((s) => <tr key={s.kind} className="border-t align-top"><td className="py-1 pr-2 font-medium">{s.title}<br /><span className="text-muted-foreground">{s.source} · {s.orientation === "landscape" ? "paisagem" : "retrato"}</span></td><td className="pr-2">{s.fields.join("; ")}</td><td className="pr-2">{s.tables.join("; ")}</td><td className="pr-2">{s.calculations.join("; ") || "—"}</td><td className="pr-2">{[...s.footer, ...s.signatures].join("; ") || "—"}</td><td>{s.pagination}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
