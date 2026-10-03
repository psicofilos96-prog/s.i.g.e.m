/**
 * B4.1 — Matrizes curriculares com sessão institucional.
 * Leitura pelos readers bitemporais; nunca cai em fixture/demonstração.
 * B4.1.3: composição de nova versão só com a capacidade efetiva de rede
 * `manter-matrizes-curriculares`, via writer canônico (o banco revalida).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate } from "@/lib/academic-date";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { MatrixVersionEditor } from "@/features/curriculum/institutional-matrix-editor";
import { draftFromVersion, emptyDraft, headerRows } from "@/features/curriculum/matrix-editor-model";
import {
  canMaintainMatrices,
  loadMatrixHistory,
  cellText,
  describeLoad,
  leafColumns,
  loadInstitutionalMatrixLayout,
  type MatrixLayout,
  humanMatrixError,
  loadInstitutionalMatrices,
  loadInstitutionalMatrixDetail,
} from "@/features/curriculum/curricular-matrix-source";

const todayIso = () => new Date().toISOString().slice(0, 10);

const NO_WRITE_NOTE =
  "Sua atuação vigente não concede manter matrizes curriculares em rede (ou a política de capacidades ainda não foi homologada); a edição fica indisponível.";

function useCanMaintain() {
  const a = useSessionAuthority();
  return a.status === "signed-in" && canMaintainMatrices(a.capabilities);
}

function Success({ text }: { text: string | null }) {
  return text ? <p role="status" className="rounded-md border border-primary p-3 text-sm text-foreground">{text}</p> : null;
}

const NORMATIVE_NOTE =
  "Unidade de carga, tipos de item não disciplinar e eixo de oferta dependem de catálogos institucionais ainda não homologados; enquanto vazios, essas informações não podem ser registradas.";

export function InstitutionalMatricesList() {
  const [validOn, setValidOn] = useState(todayIso);
  const [knownAt] = useState(() => new Date().toISOString());
  const canWrite = useCanMaintain();
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["b41-matrices", validOn, knownAt],
    enabled: Boolean(validOn),
    queryFn: () => loadInstitutionalMatrices({ validOn, knownAt }),
  });
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Matrizes curriculares institucionais</h1>
        <p className="text-sm text-muted-foreground">Versão vigente em cada matriz na data consultada, conforme registrada até agora.</p>
      </header>
      <div className="max-w-xs space-y-1">
        <Label htmlFor="b41-date">Vigente em</Label>
        <DateInput id="b41-date" value={validOn} onChange={(e) => setValidOn(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">{NORMATIVE_NOTE}</p>
      <Success text={done} />
      {canWrite ? (
        creating ? (
          <MatrixVersionEditor initial={emptyDraft()} onCancel={() => setCreating(false)}
            onDone={(r) => { setCreating(false); setDone(`Matriz constituída: versão ${r.version} registrada (${r.matrixId}).`); }} />
        ) : <Button onClick={() => { setDone(null); setCreating(true); }}>Constituir nova matriz</Button>
      ) : <p className="text-xs text-muted-foreground">{NO_WRITE_NOTE}</p>}
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{humanMatrixError((q.error as Error).message)}</p>}
      {q.data && q.data.length === 0 && (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          Nenhuma matriz curricular institucional registrada vigente nesta data.
        </p>
      )}
      {q.data && q.data.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {q.data.map((m) => (
            <li key={m.matrixId} className="p-3">
              <Link to="/matrizes-curriculares/$id" params={{ id: m.matrixId }} className="font-semibold text-foreground hover:text-primary hover:underline">
                {m.officialName}
              </Link>
              <p className="text-xs text-muted-foreground">
                Versão {m.version} · desde {formatAcademicDate(m.validFrom)}
                {m.effectiveUntil ? ` até ${formatAcademicDate(m.effectiveUntil)}` : " · sem término declarado"} · ato {m.actRef}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InstitutionalMatrixDetail({ id }: { id: string }) {
  const [validOn, setValidOn] = useState(todayIso);
  const [knownAt] = useState(() => new Date().toISOString());
  const q = useQuery({
    queryKey: ["b41-matrix", id, validOn, knownAt],
    enabled: Boolean(validOn),
    queryFn: () => loadInstitutionalMatrixDetail(id, { validOn, knownAt }),
  });
  const canWrite = useCanMaintain();
  const [editing, setEditing] = useState<null | "sucessao" | "retificacao">(null);
  const [done, setDone] = useState<string | null>(null);
  const history = useQuery({ queryKey: ["b413-history", id], queryFn: () => loadMatrixHistory(id) });
  const latest = history.data?.[history.data.length - 1] ?? null;
  const layout = useQuery({
    queryKey: ["b412-matrix-layout", id, validOn, knownAt],
    enabled: Boolean(validOn) && Boolean(q.data?.matrix),
    queryFn: () => loadInstitutionalMatrixLayout(id, { validOn, knownAt }),
  });
  return (
    <section className="space-y-4">
      <div className="max-w-xs space-y-1">
        <Label htmlFor="b41-detail-date">Vigente em</Label>
        <DateInput id="b41-detail-date" value={validOn} onChange={(e) => setValidOn(e.target.value)} />
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{humanMatrixError((q.error as Error).message)}</p>}
      {q.data && !q.data.matrix && (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          Nenhuma matriz curricular institucional com este identificador está vigente nesta data.
        </p>
      )}
      {q.data?.matrix && (
        <>
          <header>
            <h1 className="text-2xl font-semibold text-foreground">{q.data.matrix.officialName}</h1>
            <p className="text-xs text-muted-foreground">
              Versão {q.data.matrix.version} · desde {formatAcademicDate(q.data.matrix.validFrom)}
              {q.data.matrix.effectiveUntil ? ` até ${formatAcademicDate(q.data.matrix.effectiveUntil)}` : ""} · ato {q.data.matrix.actRef}
            </p>
          </header>
          <Success text={done} />
          {canWrite ? (
            editing && latest ? (
              <MatrixVersionEditor
                key={editing}
                initial={draftFromVersion({ matrix: q.data.matrix, latestVersionId: latest.versionId, items: q.data.items,
                  applicability: q.data.applicability, layout: layout.data ?? null, mode: editing })}
                onCancel={() => setEditing(null)}
                onDone={(r) => { setEditing(null); setDone(`Versão ${r.version} registrada. As versões anteriores foram preservadas no histórico.`); }} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button disabled={!latest || layout.isLoading} onClick={() => { setDone(null); setEditing("sucessao"); }}>Nova versão a partir desta (sucessão)</Button>
                <Button variant="outline" disabled={!latest || layout.isLoading} onClick={() => { setDone(null); setEditing("retificacao"); }}>Retificar a partir desta</Button>
                <p className="w-full text-xs text-muted-foreground">Carrega a versão vigente em {formatAcademicDate(validOn)} como ponto de partida; nada do passado é editado.</p>
              </div>
            )
          ) : <p className="text-xs text-muted-foreground">{NO_WRITE_NOTE}</p>}
          {layout.error && <p role="alert" className="text-sm text-destructive">{humanMatrixError((layout.error as Error).message)}</p>}
          {layout.data && <MatrixLayoutTable layout={layout.data} items={q.data.items} />}
          <h2 className="text-lg font-semibold text-foreground">Itens</h2>
          {q.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item registrado nesta versão.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {q.data.items.map((it) => (
                <li key={it.itemKey} className="flex justify-between gap-4 p-3 text-sm">
                  <span>{it.reference.kind === "componente" ? it.reference.labelSnapshot : `${it.reference.schemeId}: ${it.reference.valueId}`}</span>
                  <span className="text-muted-foreground">{describeLoad(it)}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="text-lg font-semibold text-foreground">Aplicabilidade</h2>
          {q.data.applicability.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma aplicabilidade declarada nesta versão.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {q.data.applicability.map((a, i) => (
                <li key={i}>
                  {a.dimension === "ano-letivo" ? `Ano letivo ${a.academicYearId}` : a.dimension === "escola" ? `Unidade ${a.schoolId}` : `${a.schemeId}: ${a.valueId} (v${a.valueVersion})`}
                </li>
              ))}
            </ul>
          )}
          <h2 className="text-lg font-semibold text-foreground">Histórico de versões</h2>
          {history.error && <p role="alert" className="text-sm text-destructive">{humanMatrixError((history.error as Error).message)}</p>}
          {history.data && (
            <ol className="divide-y divide-border rounded-md border border-border text-sm">
              {history.data.map((h) => (
                <li key={h.versionId} className="p-3">
                  <p className="font-medium text-foreground">
                    Versão {h.version} · {h.changeKind === "constituicao" ? "constituição" : h.changeKind === "sucessao" ? "sucessão" : `retificação da versão ${h.version - 1}`}
                    {h.versionId === q.data!.matrix!.versionId ? " · vigente na data consultada" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.officialName} · desde {formatAcademicDate(h.validFrom)}{h.validUntil ? ` até ${formatAcademicDate(h.validUntil)}` : ""} · ato {h.actRef}
                    {h.reason ? ` · motivo: ${h.reason}` : ""} · registrada em {new Date(h.recordedAt).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">{NORMATIVE_NOTE}</p>
        </>
      )}
    </section>
  );
}

/** Quadro transcrito do ato: símbolos exibidos exatamente como no documento, sem interpretação. */
function MatrixLayoutTable({ layout, items }: { layout: MatrixLayout; items: { itemKey: string; reference: { kind: string; labelSnapshot?: string } }[] }) {
  const leaves = leafColumns(layout);
  const heads = headerRows(layout.columns);
  const groupLabel = (k: string | null) => layout.groups.find((g) => g.key === k)?.label ?? null;
  const rowLabel = (r: MatrixLayout["rows"][number]) => {
    if (r.role !== "item") return r.label ?? "";
    const it = items.find((i) => i.itemKey === r.item);
    return it?.reference.labelSnapshot || r.item || "";
  };
  let lastGroup: string | null = null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">Quadro da matriz</h2>
      <p className="text-xs text-muted-foreground">
        Transcrito de {layout.source.locator} · ato {layout.source.act}
        {layout.source.page ? ` · página ${layout.source.page}` : ""}. Símbolos aparecem como no documento; o sistema não lhes atribui significado.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            {heads.length === 0 ? (
              <tr><th scope="col" className="border-b border-border p-2 text-left">Item</th></tr>
            ) : heads.map((hr, level) => (
              <tr key={level}>
                {level === 0 && <th scope="col" rowSpan={heads.length} className="border-b border-border p-2 text-left">Item</th>}
                {hr.map((h) => (
                  <th key={h.key} scope="col" colSpan={h.colSpan} rowSpan={h.rowSpan} className="border-b border-l border-border p-2 text-center">{h.header}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {layout.rows.flatMap((r) => {
              const out = [];
              if (r.group !== lastGroup && r.group) {
                out.push(
                  <tr key={`g-${r.key}`}>
                    <td colSpan={leaves.length + 1} className="bg-muted p-2 font-semibold text-foreground">{groupLabel(r.group)}</td>
                  </tr>,
                );
              }
              lastGroup = r.group;
              out.push(
                <tr key={r.key} className={r.role === "total" ? "font-semibold" : undefined}>
                  <td className="border-t border-border p-2">{rowLabel(r)}</td>
                  {leaves.map((c) => {
                    const t = cellText(layout, r.key, c.key);
                    return (
                      <td key={c.key} className="border-l border-t border-border p-2 text-center">
                        {t ?? <span className="text-muted-foreground" title="Nada transcrito nesta célula">·</span>}
                      </td>
                    );
                  })}
                </tr>,
              );
              return out;
            })}
          </tbody>
        </table>
      </div>
      {layout.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {layout.notes.map((n) => <li key={n.key}>{n.marker ? `${n.marker} ` : ""}{n.text}</li>)}
        </ul>
      )}
    </section>
  );
}
