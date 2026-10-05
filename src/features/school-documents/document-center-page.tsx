import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DOCUMENT_KINDS, buildSnapshot, documentMessage, emissionStatus, kindLabel, publicFieldAllowed, renderDocument,
  renderFromSnapshot, type DocumentBlock, type EmissionRow, type FactMap, type FactSource, type RenderResult,
  type TemplateVersion,
} from "./document-engine";
import {
  cancelEmission, collectStudentFacts, emitDocument, readStudentEmissions, readTemplates, recordTemplateVersion,
} from "./document-source";

const today = () => new Date().toISOString().slice(0, 10);

export function DocumentView({ title, identity, render, footer }: {
  title: string; identity: TemplateVersion["identity"]; render: RenderResult; footer?: React.ReactNode;
}) {
  return (
    <article className="rounded-md border border-border bg-card p-6 text-card-foreground print:border-0" aria-label={title}>
      <header className="mb-4 flex items-start gap-4 border-b border-border pb-3">
        {identity.logo_url ? <img src={identity.logo_url} alt="Identidade institucional" className="h-14 w-auto" /> : null}
        <div className="text-sm">{(identity.header_lines ?? []).map((l, i) => <p key={i}>{l}</p>)}</div>
      </header>
      <h2 className="mb-4 text-center text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm">
        {render.blocks.map((b, i) =>
          b.type === "heading" ? <h3 key={i} className="font-semibold">{b.text}</h3>
          : b.type === "paragraph" ? <p key={i}>{b.text}</p>
          : b.type === "field" ? (
            <p key={i}><span className="font-medium">{b.label}: </span>
              {b.value ?? <span className="text-muted-foreground italic">sem registro</span>}</p>
          ) : b.type === "signature" ? <div key={i} className="mt-10 border-t border-foreground pt-1 text-center text-xs">{b.label}</div> : null)}
      </div>
      {identity.footer ? <p className="mt-6 text-xs text-muted-foreground">{identity.footer}</p> : null}
      {footer}
    </article>
  );
}

export function DocumentCenterPage({ initialSchool, initialStudent }: { initialSchool?: string | undefined; initialStudent?: string | undefined }) {
  const [school, setSchool] = useState(initialSchool ?? "");
  const [student, setStudent] = useState(initialStudent ?? "");
  const [validOn, setValidOn] = useState(today());
  const [templates, setTemplates] = useState<TemplateVersion[] | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [facts, setFacts] = useState<{ facts: FactMap; sources: FactSource[] } | null>(null);
  const [history, setHistory] = useState<EmissionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [viewing, setViewing] = useState<EmissionRow | null>(null);

  const loadTemplates = () => readTemplates().then(setTemplates).catch((e) => setTplError(documentMessage(e)));
  useEffect(() => { void loadTemplates(); }, []);

  const heads = useMemo(() => {
    const m = new Map<string, TemplateVersion>();
    for (const t of templates ?? []) if (!m.has(t.template_id) || m.get(t.template_id)!.version_no < t.version_no) m.set(t.template_id, t);
    return [...m.values()];
  }, [templates]);
  const tpl = heads.find((t) => t.version_id === selected) ?? null;

  async function load() {
    setMsg(null); setFacts(null); setHistory(null);
    if (!school.trim() || !student.trim()) { setMsg({ tone: "err", text: "Informe escola e aluno." }); return; }
    setBusy(true);
    try {
      const [f, h] = await Promise.allSettled([collectStudentFacts(school.trim(), student.trim(), validOn, null), readStudentEmissions(school.trim(), student.trim())]);
      if (f.status === "fulfilled") setFacts(f.value); else setMsg({ tone: "err", text: documentMessage(f.reason) });
      if (h.status === "fulfilled") setHistory(h.value); else setMsg({ tone: "err", text: `Histórico indisponível: ${documentMessage(h.reason)}` });
    } finally { setBusy(false); }
  }

  const preview = tpl && facts ? renderDocument(tpl.blocks, facts.facts) : null;

  async function emit() {
    if (!tpl || !facts) return;
    setBusy(true); setMsg(null);
    try {
      const snapshot = buildSnapshot({ template: tpl, facts: facts.facts, sources: facts.sources,
        context: { school_id: school.trim(), student_id: student.trim(), valid_on: validOn, known_at: null } });
      const r = await emitDocument({ templateVersionId: tpl.version_id, school: school.trim(), student: student.trim(),
        context: { valid_on: validOn }, snapshot });
      setMsg({ tone: "ok", text: `Emitido. Código de verificação ${r.verification_code}${r.emission_number ? `, número ${r.emission_number}` : ""}.` });
      setHistory(await readStudentEmissions(school.trim(), student.trim()));
    } catch (e) { setMsg({ tone: "err", text: documentMessage(e) }); } finally { setBusy(false); }
  }

  async function act(row: EmissionRow, kind: "reproduzir" | "cancelar" | "retificar") {
    setMsg(null);
    try {
      if (kind === "reproduzir") {
        await emitDocument({ templateVersionId: null, school: school.trim(), student: student.trim(), context: {}, snapshot: null, reproducesId: row.id });
      } else {
        const reason = window.prompt(kind === "cancelar" ? "Motivo do cancelamento" : "Motivo da retificação");
        if (!reason?.trim()) return;
        if (kind === "cancelar") await cancelEmission(row.id, reason);
        else {
          if (!tpl || !facts) { setMsg({ tone: "err", text: "Escolha o modelo e carregue os fatos atuais para retificar." }); return; }
          const snapshot = buildSnapshot({ template: tpl, facts: facts.facts, sources: facts.sources,
            context: { school_id: school.trim(), student_id: student.trim(), valid_on: validOn, known_at: null } });
          await emitDocument({ templateVersionId: tpl.version_id, school: school.trim(), student: student.trim(),
            context: { valid_on: validOn }, snapshot, retifiesId: row.id, retificationReason: reason });
        }
      }
      setHistory(await readStudentEmissions(school.trim(), student.trim()));
    } catch (e) { setMsg({ tone: "err", text: documentMessage(e) }); }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria Escolar" title="Documentos escolares"
        description="Documentos montados só com os registros oficiais. A emissão congela os dados usados; mudanças posteriores não alteram documentos já emitidos." />

      <section aria-labelledby="ctx" className="grid gap-3 sm:grid-cols-4">
        <h2 id="ctx" className="sr-only">Aluno</h2>
        <label className="text-sm">Escola<Input value={school} onChange={(e) => setSchool(e.target.value)} /></label>
        <label className="text-sm">Aluno<Input value={student} onChange={(e) => setStudent(e.target.value)} /></label>
        <label className="text-sm">Data de referência<DateInput value={validOn} onChange={(e) => setValidOn(e.target.value)} /></label>
        <div className="flex items-end"><Button onClick={load} disabled={busy}>{busy ? "Carregando…" : "Abrir aluno"}</Button></div>
      </section>
      {msg ? <p role="status" className={msg.tone === "ok" ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p> : null}

      <section aria-labelledby="tpl" className="space-y-2">
        <h2 id="tpl" className="font-semibold">Modelo</h2>
        {tplError ? <p className="text-sm text-destructive">{tplError}</p>
        : templates === null ? <p className="text-sm text-muted-foreground">Carregando modelos…</p>
        : heads.length === 0 ? <EmptyState title="Nenhum modelo cadastrado" description="Cadastre um modelo abaixo. A gravação exige a permissão de manter modelos, ainda não atribuída a nenhuma atuação." />
        : (
          <select className="w-full rounded-md border border-input bg-background p-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Modelo">
            <option value="">Escolha um modelo</option>
            {heads.map((t) => <option key={t.version_id} value={t.version_id}>{kindLabel(t.document_kind)} — {t.title} (versão {t.version_no})</option>)}
          </select>
        )}
        {tpl ? (() => { const k = DOCUMENT_KINDS.find((d) => d.id === tpl.document_kind); return k?.pendingWithoutRule
          ? <p className="text-sm text-muted-foreground">{k.pendingWithoutRule}</p> : null; })() : null}
      </section>

      {tpl && preview ? (
        <section aria-labelledby="prev" className="space-y-3">
          <h2 id="prev" className="font-semibold">Prévia antes de emitir</h2>
          {preview.missingFacts.length > 0 ? (
            <p className="text-sm text-warning">Sem registro oficial para: {preview.missingFacts.join(", ")}. Esses campos sairão como "sem registro".</p>
          ) : null}
          <DocumentView title={tpl.title} identity={tpl.identity} render={preview} />
          <Button onClick={emit} disabled={busy}>Emitir documento</Button>
        </section>
      ) : null}

      {history !== null ? (
        <section aria-labelledby="hist" className="space-y-2">
          <h2 id="hist" className="font-semibold">Histórico de emissões</h2>
          {history.length === 0 ? <EmptyState compact title="Nenhum documento emitido" description="Este aluno ainda não tem documentos emitidos nesta escola." /> : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {history.map((h) => {
                const st = emissionStatus(h, history);
                return (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{kindLabel(h.document_kind)} {h.emission_number ? `nº ${h.emission_number}` : ""}
                        {h.emission_kind === "reproducao" ? " — reprodução" : ""}</p>
                      <p className="text-muted-foreground">{new Date(h.emitted_at).toLocaleString("pt-BR")} · código {h.verification_code} ·{" "}
                        {st === "valida" ? "válido" : st === "cancelada" ? `cancelado (${h.event_reason ?? "ver original"})` : `retificado (${h.event_reason ?? "ver original"})`}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewing(h)}>Ver</Button>
                      {st === "valida" && h.emission_kind === "original" ? <>
                        <Button size="sm" variant="outline" onClick={() => act(h, "reproduzir")}>Reproduzir</Button>
                        <Button size="sm" variant="outline" onClick={() => act(h, "retificar")}>Retificar</Button>
                        <Button size="sm" variant="destructive" onClick={() => act(h, "cancelar")}>Cancelar</Button>
                      </> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {viewing ? (
        <section aria-labelledby="view" className="space-y-2">
          <div className="flex items-center justify-between print:hidden">
            <h2 id="view" className="font-semibold">Documento emitido (dados congelados)</h2>
            <div className="flex gap-2"><Button size="sm" onClick={() => window.print()}>Imprimir / PDF</Button>
              <Button size="sm" variant="outline" onClick={() => setViewing(null)}>Fechar</Button></div>
          </div>
          <DocumentView title={viewing.snapshot.template.title} identity={viewing.snapshot.template.identity}
            render={renderFromSnapshot(viewing.snapshot)}
            footer={<p className="mt-4 break-all text-xs text-muted-foreground">
              Verificação: {typeof window !== "undefined" ? window.location.origin : ""}/verificar/{viewing.verification_code} · impressão {viewing.snapshot_sha256}
              {viewing.emission_kind === "reproducao" ? " · reprodução de documento já emitido" : ""}</p>} />
        </section>
      ) : null}

      <TemplateEditor heads={heads} onSaved={loadTemplates} />
    </div>
  );
}

function TemplateEditor({ heads, onSaved }: { heads: TemplateVersion[]; onSaved: () => void }) {
  const [base, setBase] = useState("");
  const [id, setId] = useState(""); const [kind, setKind] = useState(DOCUMENT_KINDS[0]!.id);
  const [title, setTitle] = useState(""); const [blocks, setBlocks] = useState("[]");
  const [identity, setIdentity] = useState('{"header_lines":[],"logo_url":null,"footer":null}');
  const [prefix, setPrefix] = useState(""); const [pub, setPub] = useState("escola.id");
  const [sourceRef, setSourceRef] = useState(""); const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const head = heads.find((h) => h.template_id === base) ?? null;
  useEffect(() => {
    if (!head) return;
    setId(head.template_id); setKind(head.document_kind); setTitle(head.title);
    setBlocks(JSON.stringify(head.blocks, null, 2)); setIdentity(JSON.stringify(head.identity, null, 2));
    setPrefix(head.numbering?.prefix ?? ""); setPub(head.public_fields.join(", "));
  }, [head]);
  async function save() {
    setMsg(null);
    try {
      const b = JSON.parse(blocks) as DocumentBlock[]; const idt = JSON.parse(identity);
      const fields = pub.split(",").map((s) => s.trim()).filter(Boolean);
      const bad = fields.find((f) => !publicFieldAllowed(f));
      if (bad) { setMsg(`O campo "${bad}" não pode aparecer na verificação pública.`); return; }
      await recordTemplateVersion({ templateId: id.trim(), kind, expectedHeadId: head?.version_id ?? null, title, blocks: b,
        identity: idt, numbering: prefix.trim() ? { prefix: prefix.trim() } : null, publicFields: fields,
        sourceRef: sourceRef.trim() || null, reason: reason.trim() || null });
      setMsg("Versão do modelo gravada."); onSaved();
    } catch (e) { setMsg(e instanceof SyntaxError ? "Blocos ou identidade com formato inválido." : documentMessage(e)); }
  }
  return (
    <section aria-labelledby="ed" className="space-y-3 border-t border-border pt-6">
      <h2 id="ed" className="font-semibold">Modelos de documento</h2>
      <p className="text-sm text-muted-foreground">Cada alteração cria nova versão; documentos já emitidos continuam com a versão usada. Use {"{{chave}}"} para citar um registro oficial.</p>
      <select className="w-full rounded-md border border-input bg-background p-2 text-sm" value={base} onChange={(e) => setBase(e.target.value)} aria-label="Modelo base">
        <option value="">Novo modelo</option>
        {heads.map((h) => <option key={h.template_id} value={h.template_id}>{h.title} (versão {h.version_no})</option>)}
      </select>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Identificador<Input value={id} disabled={!!head} onChange={(e) => setId(e.target.value)} /></label>
        <label className="text-sm">Tipo
          <select className="w-full rounded-md border border-input bg-background p-2" value={kind} disabled={!!head} onChange={(e) => setKind(e.target.value)}>
            {DOCUMENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select></label>
        <label className="text-sm">Título<Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      </div>
      <label className="block text-sm">Blocos<Textarea rows={6} value={blocks} onChange={(e) => setBlocks(e.target.value)} className="font-mono text-xs" /></label>
      <label className="block text-sm">Identidade institucional (cabeçalho, endereço da imagem, rodapé)<Textarea rows={3} value={identity} onChange={(e) => setIdentity(e.target.value)} className="font-mono text-xs" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Prefixo da numeração (vazio = sem número)<Input value={prefix} onChange={(e) => setPrefix(e.target.value)} /></label>
        <label className="text-sm">Campos na verificação pública<Input value={pub} onChange={(e) => setPub(e.target.value)} /></label>
        <label className="text-sm">Referência documental/fonte (opcional)<Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} /></label>
        <label className="text-sm">Motivo da alteração{head ? " (obrigatório)" : ""}<Input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
      <Button onClick={save}>Gravar versão do modelo</Button>
    </section>
  );
}
