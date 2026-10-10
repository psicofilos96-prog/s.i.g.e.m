import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useSessionUser } from "@/features/authority/session-authority";
import { printBulletins, printFinalSheet, printIndividualSheets, projectFinalSheet, resultMinutes, AWAITING_RULE, type Modality, type SheetInput } from "@/features/diary/final-sheet";
import {
  ACTION_LABEL, actMessage, applicableRule, attendanceFrom, cellsFrom, withAttendance, readClassSheet, readClasses, recordAct, sha256, sheetSnapshot, studentsFrom,
  type ClassOption,
} from "@/features/diary/final-sheet-cloud";

const title = "Folha Final, Ata e Boletim — SIGEM";
const description = "Folha Final da turma com estudantes, resultados gravados e regra homologada; conferência, homologação e reabertura auditáveis.";
export const Route = createFileRoute("/diario_/folha-final")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const MODALITY: Record<Modality, string> = { "fundamental-anos-iniciais": "Fundamental I", "fundamental-anos-finais": "Fundamental II", eja: "EJA (semestral)", "educacao-infantil": "Educação Infantil" };
const field = "mt-1 block w-full rounded border bg-background p-2 text-sm";
type Loaded = Awaited<ReturnType<typeof readClassSheet>>;

function Page() {
  const { user, loading } = useSessionUser();
  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState("");
  const [modality, setModality] = useState<Modality | "">("");
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) readClasses().then(setClasses).catch(() => setErr("Não foi possível ler as turmas.")); }, [user]);
  const load = async (id = classId) => { if (!id) return; setData(null); setErr(null); try { setData(await readClassSheet(id)); } catch { setErr("Não foi possível ler os dados da turma."); } };
  useEffect(() => { void load(); }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = classes?.find((c) => c.id === classId) ?? null;
  const view = useMemo(() => {
    if (!data || !modality) return null;
    const periods = [...new Set(data.instruments.map((i) => i.period_id))].sort();
    const base = cellsFrom(data.entries, data.instruments, periods);
    const cells = withAttendance(base.cells, attendanceFrom(data.attendance), periods);
    const compIds = new Set(base.components.map((c) => c.id));
    const components = [...base.components, ...[...new Set(data.attendance.map((a) => a.component_id))].filter((c) => !compIds.has(c)).map((id) => ({ id, label: id }))];
    const notes = base.notes;
    const { rule, issue } = applicableRule(data.rules, modality, { year: cls?.year });
    const input: SheetInput = { modality, periods, components, students: studentsFrom(data.episodes, data.endings, data.names), cells, rule };
    return { input, sheet: projectFinalSheet(input), notes, issue };
  }, [data, modality, cls?.year]);
  const last = data?.acts.at(-1) ?? null;
  const [sha, setSha] = useState<string | null>(null);
  useEffect(() => { setSha(null); if (view) void sha256(sheetSnapshot(view.input, view.sheet.rows)).then(setSha); }, [view]);

  if (loading) return <main className="p-4"><SkeletonState label="Verificando sessão" /></main>;
  if (!user) return <main className="mx-auto max-w-3xl space-y-3 p-4"><h1 className="text-xl font-semibold">Folha Final</h1>
    <StatePanel tone="warning" title="Entre para usar" description="A Folha Final lê dados reais da turma e exige login. Para conhecer o layout com dados de simulação, use o laboratório." />
    <Link className="underline" to="/laboratorio/folha-final">Abrir laboratório</Link></main>;

  async function act(action: string, needReason: boolean) {
    if (!view || !data) return;
    const reason = needReason ? await askText("Motivo:") : null; if (needReason && !reason?.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const snap = sheetSnapshot(view.input, view.sheet.rows);
      await recordAct({ classId, expectedSeq: last?.seq ?? 0, action, ruleId: view.input.rule?.id ?? null, snapshot: snap, sha: await sha256(snap), reason });
      setMsg(`${ACTION_LABEL[action]} registrada.`); await load();
    } catch (e) { setMsg(actMessage((e as Error).message)); } finally { setBusy(false); }
  }
  function print() {
    if (!view || !cls) return;
    const w = window.open("", "_blank"); if (!w) { setMsg("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(printFinalSheet(view.input, view.sheet.rows, { school: cls.school, className: cls.name, year: cls.year, state: last ? `${ACTION_LABEL[last.action]} (ato ${last.seq})` : "Sem ato registrado — prévia" }));
    w.document.close(); w.focus(); w.print();
  }
  function printDoc(kind: "boletim" | "ficha") {
    if (!view || !cls) return;
    const same = !!last && last.snapshot_sha256 === sha;
    const h = { school: cls.school, className: cls.name, year: cls.year,
      state: last ? `${ACTION_LABEL[last.action]} (ato ${last.seq})${same ? "" : " — os dados atuais DIFEREM do último ato: documento é prévia"}` : "Sem ato registrado — prévia",
      source: `Folha Final da turma, impressão digital ${sha?.slice(0, 16) ?? "—"}` };
    const doc = kind === "boletim" ? printBulletins(view.input, view.sheet.rows, h) : printIndividualSheets(view.input, view.sheet.rows, h);
    const w = window.open("", "_blank"); if (!w) { setMsg("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(doc); w.document.close(); w.focus(); w.print();
  }
  const minutes = view ? resultMinutes(view.sheet.rows) : null;
  const homologated = last?.action === "homologacao" || last?.action === "retificacao";

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 text-sm">
      <h1 className="text-xl font-semibold">Folha Final e Ata de resultados</h1>
      <p><Link className="underline" to="/diario/regras-folha-final">Regras de resultado da Folha Final (cadastrar, revisar, homologar)</Link></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Turma<select className={field} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{classes === null ? "Carregando…" : classes.length === 0 ? "Nenhuma turma visível para sua conta" : "Escolha"}</option>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.school} ({c.year})</option>)}</select></label>
        <label>Modalidade da folha (declarada por você)<select className={field} value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
          <option value="">Escolha</option>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {cls?.stage && <p className="text-muted-foreground">Etapa registrada na turma: {cls.stage}. A modalidade não é deduzida do nome.</p>}
      {err && <StatePanel tone="warning" title="Não disponível" description={err} />}
      {msg && <p role="status">{msg}</p>}
      {classId && !data && !err && <SkeletonState label="Lendo a turma" />}
      {data?.truncated && <StatePanel tone="warning" title="Leitura incompleta" description="A turma tem mais de 1.000 registros: a folha não pode ser conferida." />}
      {view && <>
        {view.sheet.blocked ? <><StatePanel tone="info" title="Educação Infantil: parecer descritivo" description={view.sheet.blocked} />
          <Link className="underline" to="/diario/turmas/$turmaId" params={{ turmaId: classId }}>Abrir o parecer descritivo desta turma</Link></> : <>
          {view.issue && <StatePanel tone="warning" title="Resultado não emitido" description={view.issue} />}
          {view.input.rule && <p>Regra aplicada: {view.input.rule.label} · fonte {view.input.rule.sourceRef}</p>}
          {view.notes.map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
          <p className="text-muted-foreground">Frequência: lida das chamadas gravadas ({data!.attendance.length} registro(s)). Sem chamada, aparece "não informada", nunca 100%; se a regra exigir frequência, o resultado fica pendente.</p>
          {view.input.students.length === 0 ? <StatePanel tone="info" title="Sem estudantes" description="Nenhum estudante vinculado a esta turma é visível para sua conta." />
            : view.input.components.length === 0 ? <StatePanel tone="info" title="Sem avaliações gravadas" description={`${view.input.students.length} estudante(s) na turma; nenhum resultado avaliativo gravado. Nada é tratado como zero.`} />
            : null}
          <div className="overflow-auto rounded border" role="region" aria-label="Folha Final" tabIndex={0}>
            <table className="w-full text-left text-xs"><thead className="bg-muted"><tr><th className="p-1">Nº</th><th className="p-1">Estudante</th><th className="p-1">Situação</th>{view.input.components.map((c) => <th key={c.id} className="p-1">{c.label} (méd.)</th>)}<th className="p-1">Resultado</th><th className="p-1">Pendências</th></tr></thead>
              <tbody>{view.sheet.rows.map((r, k) => <tr key={r.student.id} className="border-t"><td className="p-1">{k + 1}</td><td className="p-1">{r.student.name}</td><td className="p-1">{r.student.status}</td>
                {r.components.map((c) => <td key={c.id} className="p-1">{c.average ?? "—"}</td>)}<td className="p-1 font-medium">{r.overall}</td><td className="p-1 text-muted-foreground">{r.missing.slice(0, 3).join("; ")}{r.missing.length > 3 ? "…" : ""}</td></tr>)}</tbody></table>
          </div>
          {minutes && <p>Ata: {minutes.total} estudante(s) · {Object.entries(minutes.by).map(([k, v]) => `${k}: ${v}`).join(" · ")}{!minutes.canClose && " · homologação indisponível enquanto houver pendência ou falta de regra"}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={print} disabled={view.sheet.rows.length === 0}>Folha Final A4 (PDF)</Button>
            <Button variant="outline" onClick={() => printDoc("boletim")} disabled={view.sheet.rows.length === 0 || !sha}>Boletins A4 (PDF)</Button>
            <Button variant="outline" onClick={() => printDoc("ficha")} disabled={view.sheet.rows.length === 0 || !sha}>Fichas individuais A4 (PDF)</Button>
            {!homologated && <>
              <Button variant="outline" disabled={busy || view.sheet.rows.length === 0} onClick={() => act("rascunho", false)}>Salvar rascunho</Button>
              <Button variant="outline" disabled={busy || view.sheet.rows.length === 0} onClick={() => act("conferencia", false)}>Registrar conferência</Button>
              <Button disabled={busy || last?.action !== "conferencia" || !minutes?.canClose} onClick={() => act("homologacao", false)} title={view.sheet.rows.some((r) => r.overall === AWAITING_RULE) ? "Sem regra homologada" : undefined}>Homologar</Button>
            </>}
            {homologated && <>
              <Button variant="outline" disabled={busy} onClick={() => act("reabertura", true)}>Reabrir (com motivo)</Button>
              <Button variant="outline" disabled={busy} onClick={() => act("retificacao", true)}>Retificar (com motivo)</Button>
            </>}
          </div>
        </>}
        <section aria-labelledby="hist" className="space-y-1"><h2 id="hist" className="font-medium">Histórico de atos</h2>
          {data!.acts.length === 0 ? <p className="text-muted-foreground">Nenhum ato registrado.</p> : <ol className="list-decimal pl-5">{data!.acts.map((a) => <li key={a.seq}>{ACTION_LABEL[a.action] ?? a.action} · {new Date(a.created_at).toLocaleString("pt-BR")}{a.reason ? ` · motivo: ${a.reason}` : ""} · impressão {a.snapshot_sha256.slice(0, 12)}</li>)}</ol>}
        </section>
      </>}
    </main>
  );
}
