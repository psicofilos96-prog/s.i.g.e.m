import { useMemo, useState } from "react";
import { PageHeader, NoteBox } from "@/components/sigem/patterns";
import { ACERVO } from "./acervo";
import { BASE_TEMPLATES, DRAFT_LABEL, SECTOR_DOCUMENTS, type BaseTemplate } from "./base-templates";
import { STATE_LABEL, TOKEN_CATALOG, renderStudio, unresolvableTokens, validateTemplate, type StudioBlock } from "./studio-engine";

const SAMPLE_NOTE = "Prévia sem dados de aluno: campos aparecem como \"sem registro\". A emissão real usa só os fatos do banco.";

export function DocumentStudioPage() {
  const [sector, setSector] = useState("todos");
  const sectors = useMemo(() => ["todos", ...new Set(BASE_TEMPLATES.map((t) => t.sector))], []);
  const [selected, setSelected] = useState<BaseTemplate>(BASE_TEMPLATES[0]!);
  const [blocks, setBlocks] = useState<StudioBlock[]>(() => structuredClone(selected.blocks));
  const [orientation, setOrientation] = useState(selected.page.orientation);
  const page = { ...selected.page, orientation };
  const issues = validateTemplate(blocks, page);
  const pending = unresolvableTokens(blocks);
  const preview = renderStudio({ title: selected.title, blocks, page, facts: {}, draftLabel: DRAFT_LABEL });

  const pick = (t: BaseTemplate) => { setSelected(t); setBlocks(structuredClone(t.blocks)); setOrientation(t.page.orientation); };
  const move = (i: number, d: -1 | 1) => setBlocks((b) => { const n = [...b]; const j = i + d; if (j < 0 || j >= n.length) return b; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const remove = (i: number) => setBlocks((b) => b.filter((_, k) => k !== i));
  const add = (blk: StudioBlock) => setBlocks((b) => [...b, blk]);
  const editText = (i: number, text: string) => setBlocks((b) => b.map((x, k) => k !== i ? x : x.type === "title" ? { ...x, text } : x.type === "rich" ? { ...x, runs: [{ text }] } : x));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Documentos institucionais" title="Central de Documentos"
        description="Biblioteca de modelos por setor, editor seguro por blocos e prévia de impressão. Todo modelo-base nasce como rascunho não homologado." />

      <NoteBox>Estados de um modelo: {Object.values(STATE_LABEL).join(" → ")}. A gravação de versões e a homologação no banco ainda não estão ligadas a esta tela: as alterações aqui ficam só nesta sessão.</NoteBox>

      <section aria-labelledby="lib" className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <h2 id="lib" className="text-lg font-semibold">Biblioteca</h2>
          <label className="block text-sm">Setor
            <select className="mt-1 w-full rounded-md border border-border bg-background p-2" value={sector} onChange={(e) => setSector(e.target.value)}>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <ul className="space-y-1">
            {BASE_TEMPLATES.filter((t) => sector === "todos" || t.sector === sector).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pick(t)} aria-pressed={t.id === selected.id}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${t.id === selected.id ? "border-primary bg-accent" : "border-border"}`}>
                  <span className="block font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.sector} · {STATE_LABEL.rascunho}{t.source ? " · com referência no acervo" : " · sem modelo no acervo"}</span>
                </button>
              </li>))}
          </ul>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Editor — {selected.title}</h2>
            <p className="text-xs text-muted-foreground">Fonte: {selected.source ?? "nenhuma no acervo — texto-base editável, não oficial"}</p>
            <label className="text-sm">Orientação{" "}
              <select className="rounded-md border border-border bg-background p-1" value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)}>
                <option value="retrato">Retrato</option><option value="paisagem">Paisagem</option>
              </select>
            </label>
            <ol className="space-y-2">
              {blocks.map((b, i) => (
                <li key={i} className="rounded-md border border-border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{b.type}</span>
                    <span className="flex gap-1">
                      <button type="button" className="rounded border border-border px-2" onClick={() => move(i, -1)} aria-label={`Subir bloco ${i + 1}`}>↑</button>
                      <button type="button" className="rounded border border-border px-2" onClick={() => move(i, 1)} aria-label={`Descer bloco ${i + 1}`}>↓</button>
                      <button type="button" className="rounded border border-border px-2" onClick={() => remove(i)} aria-label={`Remover bloco ${i + 1}`}>✕</button>
                    </span>
                  </div>
                  {(b.type === "title" || b.type === "rich") && (
                    <textarea aria-label={`Texto do bloco ${i + 1}`} className="mt-2 w-full rounded border border-border bg-background p-1"
                      value={b.type === "title" ? b.text : b.runs.map((r) => r.text).join("")} onChange={(e) => editText(i, e.target.value)} />
                  )}
                  {b.type === "field" && <p className="text-xs text-muted-foreground">{b.label} ← {b.fact}</p>}
                </li>))}
            </ol>
            <div className="flex flex-wrap gap-2 text-sm">
              {([["Parágrafo", { type: "rich", runs: [{ text: "Novo texto" }] }], ["Linha", { type: "line" }], ["Assinatura", { type: "signature", label: "Assinatura" }],
                 ["Quebra de página", { type: "page-break" }], ["Número do documento", { type: "document-number" }], ["QR de verificação", { type: "qr", label: "Verificação" }]] as const)
                .map(([l, blk]) => <button key={l} type="button" className="rounded-md border border-border px-2 py-1" onClick={() => add(structuredClone(blk) as StudioBlock)}>+ {l}</button>)}
            </div>
            {issues.length > 0 && <div role="alert" className="text-sm text-destructive">Problemas: {issues.map((x) => `${x.path} ${x.code}`).join("; ")}</div>}
            {pending.length > 0 && <p className="text-sm">Ainda não emitível: {pending.join(", ")} não têm leitura autorizada no sistema.</p>}
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Prévia de impressão</h2>
            <p className="text-xs text-muted-foreground">{SAMPLE_NOTE}</p>
            <iframe title={`Prévia de ${selected.title}`} sandbox="" srcDoc={preview.html} className="h-[640px] w-full rounded-md border border-border bg-card" />
          </div>
        </div>
      </section>

      <section aria-labelledby="tok" className="space-y-2">
        <h2 id="tok" className="text-lg font-semibold">Campos disponíveis</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {TOKEN_CATALOG.map((t) => <li key={t.key}><code>{`{{${t.key}}}`}</code> — {t.label}{t.reader ? "" : " (sem leitura autorizada)"}</li>)}
        </ul>
      </section>

      <section aria-labelledby="acv" className="space-y-2">
        <h2 id="acv" className="text-lg font-semibold">Acervo analisado ({ACERVO.length})</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Documento</th><th className="p-2">Setor</th><th className="p-2">Finalidade</th><th className="p-2">Assinaturas</th><th className="p-2">Classe</th></tr></thead>
          <tbody>{ACERVO.map((a) => <tr key={a.file + a.name} className="border-t border-border"><td className="p-2">{a.name}</td><td className="p-2">{a.sector}</td><td className="p-2">{a.purpose}</td><td className="p-2">{a.signatures.join(", ") || "—"}</td><td className="p-2">{a.klass}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section aria-labelledby="sec" className="space-y-2">
        <h2 id="sec" className="text-lg font-semibold">Documentos já emitidos pelos setores</h2>
        <ul className="text-sm">{SECTOR_DOCUMENTS.map((s) => <li key={s.route}><a className="underline" href={s.route}>{s.sector}</a> — {s.document}</li>)}</ul>
      </section>
    </div>
  );
}
