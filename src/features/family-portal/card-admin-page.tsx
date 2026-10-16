import { humanizeForScreen } from "@/config/technical-codes";
import { operationalToday, formatDateTime } from "@/lib/academic-date";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { useEffect, useRef, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { fmtDate } from "./family-portal";
import { CARD_KIND_LABEL, CARD_STATE_LABEL, cardMessage, issuedValidity, projectCardChain, validateCardDraft, verifyUrlFor, type CardChainView } from "./card-issuance";
import { cardPhotoUrl, findCardCandidates, readCardChain, readCardLayouts, recordCard, recordCardLayout, saveCardPhoto, type CardCandidate } from "./card-issuance-source";
import { CardBatchSheets, StudentCardView } from "./student-card-view";
import { PhotoCapture } from "./photo-capture";
import { candidateDisambiguation } from "./student-lookup";
import { CARD_ACCENT_LABEL, CARD_LOGOS, CARD_LOGO_LABEL, DEFAULT_CARD_LAYOUT, cardLayoutProblem, readCardLayout, type CardLayout } from "./card-layout";
import type { StudentCard } from "./student-card";

const today = () => operationalToday();
const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

function toCard(c: CardChainView, photoUrl: string | null): StudentCard {
  const h = c.head;
  return { name: h.student_name, school: h.school_name ?? null, className: h.class_label, shift: null, code: `${c.publicId}.${h.version}`, year: h.academic_year,
    photoUrl, internalId: h.internal_id ?? null, verifyUrl: c.state === "cancelada" ? null : verifyUrlFor(origin(), c.publicId, h.version), status: "vigente",
    validity: issuedValidity({ status: c.state === "valida" ? "valida" : "expirada", valid_until: h.valid_until }) };
}

/** Secretaria: foto, modelo, emissão, reemissão, cancelamento e impressão em lote. Permissão e dados oficiais são do banco; a tela só coleta. */
export function CardAdminPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState("");
  const [chain, setChain] = useState<CardChainView[] | null>(null);
  const [layouts, setLayouts] = useState<{ version: number; layout: CardLayout }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [birth, setBirth] = useState("");
  const [cands, setCands] = useState<CardCandidate[] | null>(null);
  const [pick, setPick] = useState<CardCandidate | null>(null);
  const [year, setYear] = useState(today().slice(0, 4));
  const [until, setUntil] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ card: StudentCard; layout: CardLayout }[] | null>(null);

  useEffect(() => { void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m)), () => setSchools([])); }, []);

  async function reload(s = school) {
    if (!s) return;
    try {
      const [rows, ls] = await Promise.all([readCardChain(s), readCardLayouts(s)]);
      setChain(projectCardChain(rows, today()));
      setLayouts(ls.map((l) => ({ version: l.version, layout: readCardLayout(l.config).layout })));
      setErr(null);
    } catch (e) { setChain(null); setErr(cardMessage((e as Error).message)); }
  }
  useEffect(() => { setChain(null); setCands(null); setPick(null); setSelected(new Set()); void reload(school); }, [school]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (inFlight.current) return; // clique duplo não grava duas vezes
    inFlight.current = true; setBusy(true); setNotice(null); setErr(null);
    try { await fn(); setNotice(ok); await reload(); } catch (e) { setErr(cardMessage((e as Error).message)); }
    inFlight.current = false; setBusy(false);
  }
  const layoutOf = (v: number | null | undefined) => layouts.find((l) => l.version === v)?.layout ?? DEFAULT_CARD_LAYOUT;
  const currentLayout = layouts.at(-1) ?? null;

  async function find() {
    setBusy(true); setErr(null); setPick(null);
    try { setCands(await findCardCandidates(school, query, birth)); } catch (e) { setCands(null); setErr(cardMessage((e as Error).message)); }
    setBusy(false);
  }
  async function refreshCandidate() { if (pick) { const r = await findCardCandidates(school, pick.student_id, null); setPick(r[0] ?? pick); } }
  function emit() {
    const v = validateCardDraft({ kind: "emissao", year, validUntil: until, reason: "" }); if (v) { setErr(v); return; }
    if (!pick) return;
    void act(() => recordCard({ publicId: null, expected: null, kind: "emissao", student: pick.student_id, school, year, validUntil: until, reason: null }).then(() => refreshCandidate()),
      "Carteirinha emitida com os dados do cadastro oficial.");
  }
  function change(c: CardChainView, kind: "reemissao" | "cancelamento", reason: string, validUntil: string) {
    const v = validateCardDraft({ kind, reason, validUntil, year: c.head.academic_year }); if (v) { setErr(v); return; }
    void act(() => recordCard({ publicId: c.publicId, expected: c.head.version, kind, student: null, school: null, year: null, validUntil: kind === "reemissao" ? validUntil : null, reason }),
      kind === "reemissao" ? "Carteirinha reemitida; a versão anterior passa a constar como substituída." : "Carteirinha cancelada.");
  }
  async function printBatch() {
    if (!chain) return;
    const list = chain.filter((c) => selected.has(c.publicId) && c.state !== "cancelada");
    const cards = await Promise.all(list.map(async (c) => ({ card: toCard(c, await cardPhotoUrl(c.head.photo_path ?? null)), layout: layoutOf(c.head.layout_version) })));
    setBatch(cards);
    // imprime só depois que as fotos carregarem (URLs assinadas curtas)
    setTimeout(() => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>(".card-batch img")];
      void Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => window.print());
    }, 100);
  }
  useEffect(() => { const after = () => setBatch(null); window.addEventListener("afterprint", after); return () => window.removeEventListener("afterprint", after); }, []);

  if (batch) return (
    <div className="space-y-3">
      <div className="flex gap-2 print:hidden"><Button type="button" onClick={() => window.print()}>Imprimir</Button><Button type="button" variant="outline" onClick={() => setBatch(null)}>Voltar</Button>
        <p className="text-sm text-muted-foreground">{batch.length} carteirinha(s): uma folha de frentes e uma de versos para cada 8. Imprima frente e verso virando pela borda longa.</p></div>
      <CardBatchSheets cards={batch} />
    </div>);

  return (
    <div className="space-y-6">
      <PageHeader title="Carteirinhas" description="Foto 3×4, modelo da escola, emissão, reemissão, cancelamento e impressão em lote. Nome, escola e turma vêm do cadastro oficial; cada ato fica no histórico." />
      <label className="block max-w-md text-sm">Escola
        <select className="mt-1 block w-full rounded border bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {err && <StatePanel tone="danger" title="Não foi possível concluir" description={err} />}
      {notice && <StatePanel tone="success" title="Registrado" description={notice} />}
      {school && chain && (
        <>
          <LayoutEditor key={currentLayout?.version ?? 0} current={currentLayout} busy={busy}
            onSave={(l) => void act(() => recordCardLayout(school, currentLayout?.version ?? null, l), "Modelo da carteirinha salvo como nova versão. Vale para as próximas emissões e reemissões.")} />

          <section className="space-y-3 rounded-lg border bg-card p-4" aria-labelledby="nova">
            <h2 id="nova" className="font-semibold">Emitir carteirinha</h2>
            <p className="text-sm text-muted-foreground">Busque pelo nome ou pelo identificador do estudante. Não é preciso CPF. Só aparecem estudantes com matrícula vigente nesta escola.</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">Nome ou identificador<input className="mt-1 block rounded border bg-background p-2" value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && query.trim().length >= 3) void find(); }} /></label>
              <Button type="button" variant="outline" disabled={busy || query.trim().length < 3} onClick={() => void find()}>Buscar</Button>
              <label className="text-sm">Data de nascimento (opcional)<DateInput className="mt-1 block rounded border bg-background p-2" value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
            </div>
            {cands && cands.length === 0 && <p className="text-sm text-muted-foreground">Nenhum estudante com matrícula vigente encontrado com esse dado nesta escola.</p>}
            {cands && cands.length > 0 && !pick && (
              <ul className="divide-y rounded border" aria-label="Estudantes encontrados">{cands.map((c) => (
                <li key={c.student_id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <strong>{c.name}</strong><span className="text-muted-foreground">{c.class_label ?? "turma não registrada"}{c.internal_id ? ` · ${c.internal_id}` : ""}</span>
                  <span className="text-muted-foreground">{c.birth_date ? `nasc. ${fmtDate(c.birth_date)}` : "nascimento não registrado"}</span>
                  {c.open_card && <span className="rounded border px-2 text-xs">já tem carteirinha</span>}
                  {(() => { const d = candidateDisambiguation(c, cands); return d.ok
                    ? <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setPick(c)}>Selecionar</Button>
                    : <span role="note" className="ml-auto text-xs text-destructive">{humanizeForScreen(d.reason)}</span>; })()}
                </li>))}</ul>)}
            {pick && (
              <div className="space-y-3">
                <p className="text-sm">Estudante: <strong>{pick.name}</strong>{pick.name_kind === "social" ? " (nome social registrado no cadastro)" : ""} · {pick.class_label ?? "turma não registrada"}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPick(null)}>Trocar</Button></p>
                <p className="text-sm">{pick.has_photo ? "Foto 3×4 registrada. Você pode substituí-la abaixo." : "Ainda não há foto 3×4 para a carteirinha."}</p>
                <PhotoCapture busy={busy} onConfirm={(b, o) => void act(() => saveCardPhoto(school, pick.student_id, b, o).then(() => refreshCandidate()),
                  "Foto registrada. Ela entra na próxima emissão ou reemissão.")} />
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">Ano letivo<input inputMode="numeric" className="mt-1 block w-24 rounded border bg-background p-2" value={year} onChange={(e) => setYear(e.target.value)} /></label>
                  <label className="text-sm">Válida até<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
                  <Button type="button" disabled={busy || !!pick.open_card} onClick={emit}>Emitir</Button>
                </div>
                {pick.open_card && <p className="text-sm text-muted-foreground">Já existe carteirinha vigente; para atualizar foto ou dados, use Reemitir na lista abaixo.</p>}
              </div>)}
          </section>

          {chain.length === 0 ? <EmptyState title="Nenhuma carteirinha emitida nesta escola" description="As carteirinhas emitidas aparecerão aqui com todo o histórico." /> : (
            <section className="space-y-2" aria-labelledby="emitidas">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="emitidas" className="font-semibold">Carteirinhas emitidas</h2>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set(chain.filter((c) => c.state !== "cancelada").map((c) => c.publicId)))}>Selecionar todas</Button>
                <Button type="button" size="sm" disabled={selected.size === 0} onClick={() => void printBatch()}>Imprimir selecionadas ({selected.size})</Button>
              </div>
              <ul className="space-y-3">{chain.map((c) => (
                <li key={c.publicId} className="min-w-0 space-y-2 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.state !== "cancelada" && <input type="checkbox" aria-label={`Selecionar ${c.head.student_name} para impressão`} checked={selected.has(c.publicId)}
                      onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(c.publicId); else n.delete(c.publicId); setSelected(n); }} />}
                    <strong>{c.head.student_name}</strong><span className="text-sm text-muted-foreground">{c.head.academic_year} · código {c.publicId}.{c.head.version}</span>
                    <span className="rounded border px-2 py-0.5 text-xs">{CARD_STATE_LABEL[c.state]}</span>
                    <Button type="button" variant="ghost" size="sm" className="ml-auto" aria-expanded={open === c.publicId} onClick={() => setOpen(open === c.publicId ? null : c.publicId)}>{open === c.publicId ? "Fechar" : "Abrir"}</Button>
                  </div>
                  {open === c.publicId && <CardDetail c={c} layout={layoutOf(c.head.layout_version)} busy={busy} onChange={change} />}
                </li>))}</ul>
            </section>)}
        </>)}
    </div>
  );
}

function LayoutEditor({ current, busy, onSave }: { current: { version: number; layout: CardLayout } | null; busy: boolean; onSave: (l: CardLayout) => void }) {
  const [l, setL] = useState<CardLayout>(current?.layout ?? DEFAULT_CARD_LAYOUT);
  const [openEd, setOpenEd] = useState(false);
  const problem = cardLayoutProblem(l);
  const sample: StudentCard = { name: "Nome do estudante", school: "Nome da escola", className: "Turma", shift: "Turno", code: "EXEMPLO000.1", year: "AAAA", photoUrl: null,
    internalId: "identificador", verifyUrl: null, status: "vigente", validity: "Válida até dd/mm/aaaa" };
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-labelledby="modelo">
      <div className="flex items-center gap-2"><h2 id="modelo" className="font-semibold">Modelo da carteirinha</h2>
        <span className="text-sm text-muted-foreground">{current ? `versão ${current.version}` : "padrão (ainda não salvo nesta escola)"}</span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" aria-expanded={openEd} onClick={() => setOpenEd(!openEd)}>{openEd ? "Fechar" : "Editar modelo"}</Button></div>
      {openEd && (
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2 text-sm">
            <label className="block">Título da frente<input maxLength={60} className="mt-1 block w-64 rounded border bg-background p-2" value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} /></label>
            <label className="block">Texto do verso<textarea maxLength={200} className="mt-1 block w-64 rounded border bg-background p-2" value={l.backText} onChange={(e) => setL({ ...l, backText: e.target.value })} /></label>
            <label className="block">Cor<select className="mt-1 block rounded border bg-background p-2" value={l.accent} onChange={(e) => setL({ ...l, accent: Number(e.target.value) as CardLayout["accent"] })}>
              {CARD_ACCENT_LABEL.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
            <fieldset><legend>Logos e brasões</legend>{CARD_LOGOS.map((g) => (
              <label key={g} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={l.logos.includes(g)}
                onChange={(e) => setL({ ...l, logos: e.target.checked ? [...l.logos, g] : l.logos.filter((x) => x !== g) })} />{CARD_LOGO_LABEL[g]}</label>))}</fieldset>
            <fieldset><legend>Campos da frente</legend>
              {([["showClass", "Turma"], ["showShift", "Turno"], ["showInternalId", "Identificador interno"]] as const).map(([k, n]) => (
                <label key={k} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={l[k]} onChange={(e) => setL({ ...l, [k]: e.target.checked })} />{n}</label>))}
            </fieldset>
            {problem && <p role="alert" className="text-destructive">Preencha o título (até 60 letras).</p>}
            <Button type="button" disabled={busy || !!problem} onClick={() => onSave(l)}>Salvar nova versão do modelo</Button>
          </div>
          <div><p className="mb-1 text-sm text-muted-foreground">Prévia (sem dados de estudante)</p><StudentCardView card={sample} layout={l} /></div>
        </div>)}
    </section>
  );
}

function CardDetail({ c, layout, busy, onChange }: { c: CardChainView; layout: CardLayout; busy: boolean; onChange: (c: CardChainView, k: "reemissao" | "cancelamento", reason: string, until: string) => void }) {
  const [reason, setReason] = useState(""); const [until, setUntil] = useState(c.head.valid_until);
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => { void cardPhotoUrl(c.head.photo_path ?? null).then(setPhoto, () => setPhoto(null)); }, [c.head.photo_path]);
  const card = toCard(c, photo);
  return (
    <div className="space-y-3">
      {c.state !== "cancelada" && <div className="card-print-area"><StudentCardView card={card} layout={layout} /></div>}
      {c.state !== "cancelada" && <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>Imprimir ou salvar em PDF</Button>}
      <div className="max-w-full"><table className="w-full table-fixed break-words text-xs sm:text-sm"><caption className="text-left font-medium">Histórico</caption>
        <thead><tr className="text-left text-muted-foreground"><th scope="col">Versão</th><th scope="col">Ato</th><th scope="col">Válida até</th><th scope="col">Foto</th><th scope="col">Motivo</th><th scope="col">Registrado em</th></tr></thead>
        <tbody>{c.history.map((h) => <tr key={h.version}><td>{h.version}</td><td>{CARD_KIND_LABEL[h.kind]}</td><td>{fmtDate(h.valid_until)}</td><td>{h.photo_path ? "sim" : "não"}</td><td>{h.reason ?? "—"}</td>
          <td>{formatDateTime(h.recorded_at)}</td></tr>)}</tbody></table></div>
      {c.state !== "cancelada" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Motivo<input className="mt-1 block rounded border bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <label className="text-sm">Nova validade (reemissão)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onChange(c, "reemissao", reason, until)}>Reemitir</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => onChange(c, "cancelamento", reason, until)}>Cancelar carteirinha</Button>
        </div>)}
    </div>
  );
}
