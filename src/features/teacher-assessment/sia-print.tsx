import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import sigem from "@/assets/logo-sigem.png.asset.json";
import { Button } from "@/components/ui/button";
import { StatePanel, EmptyState } from "@/components/sigem/patterns";
import { reviewsOf, reviewState } from "@/features/teacher-review/teacher-work-review";
import { authoringMessage, printFingerprint, printProjection, variantProjection, VARIANT_LETTERS, type InstrumentVersion, type ItemVersion } from "./authoring-model";
import { headerById, headersOf, itemKey, printSettingsOf, saveHeader, schoolNames, type HeaderVersion } from "./authoring-source";
import { DEFAULT_LABELS, HEADER_LOGOS, headerProblems, parseEntries, richBlocks, variantAnswerKey, weightSummary, type HeaderConfig } from "./sia-editor";

const LOGO: Record<string, { src: string | null; alt: string }> = {
  brasao: { src: brasao.url, alt: "Brasão de Itaperuna" }, sigem: { src: sigem.url, alt: "SIGEM" },
  prefeitura: { src: null, alt: "Prefeitura Municipal de Itaperuna" }, educacao: { src: null, alt: "Secretaria Municipal de Educação" },
};
const LOGO_LABEL: Record<string, string> = { brasao: "Brasão de Itaperuna", sigem: "SIGEM", prefeitura: "Prefeitura (texto)", educacao: "Secretaria de Educação (texto)" };

/** Renderiza a marcação mínima sempre como texto (escape do React); equação em fonte matemática, tabela como tabela. */
export function RichText({ text }: { text: string }) {
  return <>{richBlocks(text).map((b, i) => b.kind === "table"
    ? <table key={i} className="my-2 w-full border-collapse text-sm"><tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => j === 0 ? <th key={k} className="border border-border px-2 py-1 text-left font-semibold">{c}</th> : <td key={k} className="border border-border px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
    : b.kind === "eq" ? <p key={i} className="my-2 text-center font-serif italic" role="math" aria-label={b.text}>{b.text}</p>
    : <p key={i} className="whitespace-pre-wrap">{b.parts.map((p, k) => p.kind === "eq" ? <span key={k} className="font-serif italic" role="math" aria-label={p.text}>{p.text}</span> : <span key={k}>{p.text}</span>)}</p>)}</>;
}

export function PrintHeader({ header, label, title, className }: { header: HeaderVersion | null; label: string | null; title: string; className?: string }) {
  const c = header?.config;
  return (
    <header className={`space-y-2 border-b border-border pb-3 ${className ?? ""}`}>
      <div className="flex items-center gap-3">
        {(c?.logos ?? []).filter((l) => LOGO[l]?.src).map((l) => <img key={l} src={LOGO[l]!.src!} alt={LOGO[l]!.alt} className="h-12 w-auto" />)}
        <div className="flex-1 text-center">
          {(c?.logos ?? []).filter((l) => !LOGO[l]?.src).map((l) => <p key={l} className="text-xs uppercase tracking-wide">{LOGO[l]!.alt}</p>)}
          {c?.line1 && <p className="text-xs uppercase">{c.line1}</p>}
          {header && <p className="text-sm font-semibold uppercase" data-testid="sia-unit">{header.unit_name_snapshot}</p>}
          {c?.line2 && <p className="text-xs">{c.line2}</p>}
        </div>
      </div>
      <h1 className="text-center text-lg font-semibold">{label ? `${label} — ` : ""}{title}</h1>
      {(c?.showStudentLines ?? true) && <div className="grid grid-cols-[2fr_1fr] gap-x-4 gap-y-1 text-sm"><span>Estudante: ________________________________</span><span>Data: ____/____/______</span><span>Turma: ____________</span><span>Nº: ______</span></div>}
      {c?.notice && <p className="text-justify text-xs">{c.notice}</p>}
    </header>
  );
}

const A4_CSS = `@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
@media print { html, body { background: #fff !important; } .sia-sheet { max-width: none !important; padding: 0 !important; box-shadow: none !important; }
.sia-sheet li, .sia-sheet table, .sia-sheet header { break-inside: avoid; } .sia-key { break-before: page; } }`;

export function SiaPrintView({ ins, items, uid, onClose }: { ins: InstrumentVersion; items: ReadonlyMap<string, ItemVersion>; uid: string | null; onClose: () => void }) {
  const [letter, setLetter] = useState("");
  const rv = useQuery({ queryKey: ["twr", "instrumento", ins.instrument_id], queryFn: () => reviewsOf("instrumento", ins.instrument_id) });
  const settings = useQuery({ queryKey: ["sia-settings", ins.id], queryFn: () => printSettingsOf(ins.id) });
  const header = useQuery({ queryKey: ["sia-header", settings.data?.header_version_id], enabled: !!settings.data?.header_version_id, queryFn: () => headerById(settings.data!.header_version_id!) });
  const approved = !!rv.data && reviewState(rv.data, ins.id) === "aprovado";
  const printable = approved && ins.status === "publicado";
  const vp = useMemo(() => variantProjection(ins, items, letter || null, approved), [ins, items, letter, approved]);
  const p = vp.ok ? vp.p : printProjection(ins, items);
  const weights = useMemo(() => new Map(parseEntries(ins.items).map((e) => [e.itemVersionId, e.weight])), [ins.items]);
  const ws = weightSummary(parseEntries(ins.items));
  const isAuthor = ins.author_user_id === uid;
  const keys = useQuery({ queryKey: ["sia-keys", ins.id], enabled: isAuthor, queryFn: async () => new Map(await Promise.all(p.questions.map(async (q) => {
    const k = (await itemKey(q.itemVersionId).catch(() => []))[0]; const a = k?.answer; return [q.itemVersionId, Array.isArray(a) ? String(a[0] ?? "") || null : typeof a === "string" ? a : null] as const;
  }))) });
  const [fp, setFp] = useState("");
  useEffect(() => { printFingerprint(p).then(setFp); }, [p]);
  const label = settings.data?.label ?? null;
  return (
    <div className="space-y-4">
      <style>{A4_CSS}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" onClick={onClose}>Voltar</Button>
        <label className="text-sm">Versão <select aria-label="Versão da prova" className="ml-1 rounded border border-input bg-background p-1" value={letter} onChange={(e) => setLetter(e.target.value)} disabled={!approved}><option value="">Original</option>{[...VARIANT_LETTERS].map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
        <Button onClick={() => window.print()} disabled={!printable || !vp.ok}>Imprimir / salvar PDF (A4)</Button>
      </div>
      {!printable && <StatePanel tone="warning" title="Prévia — impressão bloqueada" description={rv.error ? "Não foi possível ler a análise da OP." : ins.status !== "publicado" ? "Publique a prova e envie à OP; a impressão só libera após a aprovação humana desta versão exata." : "Aguardando aprovação da OP para esta versão. Nada é aprovado automaticamente."} />}
      {p.missing.length > 0 && <StatePanel tone="warning" title="Itens não acessíveis" description={`${p.missing.length} item(ns) não puderam ser lidos e não aparecem.`} />}
      {!settings.data && settings.isFetched && <p className="text-xs text-muted-foreground print:hidden">Sem cabeçalho institucional definido para esta versão.</p>}
      <article data-testid="sia-sheet" className="sia-sheet mx-auto max-w-[210mm] space-y-4 bg-card p-[16mm] text-justify text-card-foreground shadow-sm" style={{ hyphens: "auto" }} lang="pt-BR">
        <PrintHeader header={header.data ?? null} label={label} title={p.title} />
        {!printable && <p className="text-center text-xs font-semibold uppercase tracking-widest text-destructive">Rascunho — não aprovado pela OP</p>}
        {p.instructions && <div className="text-sm"><RichText text={p.instructions} /></div>}
        <ol className="space-y-5">{p.questions.map((q) => {
          const vf = q.options.length === 2 && q.options[0]?.key === "V"; const w = weights.get(q.itemVersionId);
          return (
            <li key={q.itemVersionId} className="break-inside-avoid">
              <div className="flex gap-2"><strong>{q.number}.</strong><div className="flex-1"><RichText text={q.stem} /></div>{w != null && <span className="shrink-0 text-xs">({String(w).replace(".", ",")} pt)</span>}</div>
              {q.options.length > 0 ? <ul className="mt-2 space-y-1 pl-6">{q.options.map((o, i) => <li key={o.key}>{vf ? `( ) ${o.text}` : `(${"ABCDEFGHIJ"[i]}) `}{!vf && o.text}</li>)}</ul>
                : <div className="mt-2 space-y-5" aria-hidden>{[0, 1, 2, 3].map((k) => <div key={k} className="border-b border-border" />)}</div>}
            </li>);
        })}</ol>
        <footer className="border-t border-border pt-2 text-2xs text-muted-foreground">{letter && vp.ok ? `Prova ${letter} · ` : ""}Versão {p.version} · {ws.total !== null ? `total ${String(ws.total).replace(".", ",")} pt · ` : ws.declared ? `${ws.missing} questão(ões) sem peso · ` : ""}impressão {fp.slice(0, 16)}</footer>
      </article>
      {isAuthor && keys.data && (
        <section aria-label="Gabarito" className="sia-key sia-sheet mx-auto max-w-[210mm] bg-card p-[16mm] text-card-foreground">
          <h2 className="mb-2 font-semibold">Gabarito {letter && vp.ok ? `— Prova ${letter}` : "— Original"} (uso do professor)</h2>
          <table className="w-full border-collapse text-sm" data-testid="sia-key"><tbody>{variantAnswerKey(p.questions, keys.data).map((k) => <tr key={k.number}><td className="border border-border px-2 py-1">{k.number}</td><td className="border border-border px-2 py-1">{k.display}</td></tr>)}</tbody></table>
          <p className="mt-2 text-2xs text-muted-foreground">Cada versão tem seu gabarito próprio derivado da mesma semente; impressão {fp.slice(0, 16)}.</p>
        </section>)}
    </div>
  );
}

/** Cabeçalhos por escola: qualquer leitor vê; gravar exige OP ou secretaria da escola (o banco decide). */
export function HeadersTab({ schoolIds }: { schoolIds: string[] }) {
  const qc = useQueryClient();
  const [school, setSchool] = useState(schoolIds[0] ?? "");
  const names = useQuery({ queryKey: ["sia-school-names", schoolIds.join()], queryFn: () => schoolNames(schoolIds) });
  const hs = useQuery({ queryKey: ["sia-headers", schoolIds.join()], queryFn: () => headersOf(schoolIds) });
  const head = (hs.data ?? []).find((h) => h.school_id === school) ?? null;
  const [c, setC] = useState<HeaderConfig>({ labels: DEFAULT_LABELS, logos: ["brasao"], line1: "Secretaria Municipal de Educação", line2: "", notice: "", showStudentLines: true });
  const [labels, setLabels] = useState(DEFAULT_LABELS.join(", "));
  const [msg, setMsg] = useState<{ err: boolean; text: string } | null>(null);
  useEffect(() => { if (head) { setC(head.config); setLabels(head.config.labels.join(", ")); } }, [head?.id]);
  if (!schoolIds.length) return <EmptyState title="Sem escola vinculada" description="Cabeçalhos são da escola da sua regência ou atuação." />;
  const cfg: HeaderConfig = { ...c, labels: labels.split(",").map((x) => x.trim()).filter(Boolean) };
  const problems = headerProblems(cfg);
  const name = (names.data ?? []).find((n) => n.school_id === school)?.official_name;
  const save = async () => { try { await saveHeader(school, head?.id ?? null, cfg); await qc.invalidateQueries({ queryKey: ["sia-headers"] }); setMsg({ err: false, text: "Cabeçalho salvo (nova versão)." }); } catch (e) { setMsg({ err: true, text: authoringMessage((e as Error).message) }); } };
  const inp = "w-full rounded border border-input bg-background p-2 text-sm";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-label="Configurar cabeçalho" className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">A unidade é identificada automaticamente pelo cadastro da escola. Gravar exige permissão da OP ou da secretaria desta escola; cada gravação vira nova versão.</p>
        {msg && <div role={msg.err ? "alert" : "status"} className={`rounded border p-2 text-sm ${msg.err ? "border-destructive text-destructive" : "border-border"}`}>{msg.text}</div>}
        {schoolIds.length > 1 && <label className="block text-sm">Escola<select className={inp} value={school} onChange={(e) => setSchool(e.target.value)}>{schoolIds.map((s) => <option key={s} value={s}>{(names.data ?? []).find((n) => n.school_id === s)?.official_name ?? s}</option>)}</select></label>}
        <p className="text-sm">Unidade: <strong>{name ?? "carregando…"}</strong>{head ? ` · versão ${head.version}` : " · nenhum cabeçalho ainda"}</p>
        <label className="block text-sm">Nomes das avaliações (separados por vírgula)<input aria-label="Nomes das avaliações" className={inp} value={labels} onChange={(e) => setLabels(e.target.value)} /></label>
        <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="font-medium">Logos</legend>{HEADER_LOGOS.map((l) => <label key={l} className="flex items-center gap-1"><input type="checkbox" checked={c.logos.includes(l)} onChange={(e) => setC({ ...c, logos: e.target.checked ? [...c.logos, l] : c.logos.filter((x) => x !== l) })} />{LOGO_LABEL[l]}</label>)}</fieldset>
        <label className="block text-sm">Linha superior<input className={inp} maxLength={160} value={c.line1 ?? ""} onChange={(e) => setC({ ...c, line1: e.target.value })} /></label>
        <label className="block text-sm">Linha inferior<input className={inp} maxLength={160} value={c.line2 ?? ""} onChange={(e) => setC({ ...c, line2: e.target.value })} /></label>
        <label className="block text-sm">Orientações fixas<textarea rows={3} className={inp} maxLength={600} value={c.notice ?? ""} onChange={(e) => setC({ ...c, notice: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.showStudentLines ?? true} onChange={(e) => setC({ ...c, showStudentLines: e.target.checked })} />Linhas de identificação do estudante</label>
        {problems.length > 0 && <ul className="text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Button onClick={save} disabled={problems.length > 0}>Salvar cabeçalho</Button>
      </section>
      <section aria-label="Prévia do cabeçalho" className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <PrintHeader header={{ id: "", school_id: school, version: 0, supersedes_id: null, unit_name_snapshot: name ?? "", config: cfg, recorded_at: "" }} label={cfg.labels[0] ?? null} title="Título da prova" />
      </section>
    </div>
  );
}
