/**
 * B4.1 — Matrizes curriculares com sessão institucional.
 * Somente leitura pelos readers bitemporais; nunca cai em fixture/demonstração.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate } from "@/lib/academic-date";
import {
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

const NORMATIVE_NOTE =
  "Unidade de carga, tipos de item não disciplinar e eixo de oferta dependem de catálogos institucionais ainda não homologados; enquanto vazios, essas informações não podem ser registradas.";

export function InstitutionalMatricesList() {
  const [validOn, setValidOn] = useState(todayIso);
  const [knownAt] = useState(() => new Date().toISOString());
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
          <p className="text-xs text-muted-foreground">{NORMATIVE_NOTE}</p>
        </>
      )}
    </section>
  );
}

/** Quadro transcrito do ato: símbolos exibidos exatamente como no documento, sem interpretação. */
function MatrixLayoutTable({ layout, items }: { layout: MatrixLayout; items: { itemKey: string; reference: { kind: string; labelSnapshot?: string } }[] }) {
  const leaves = leafColumns(layout);
  const tops = layout.columns.filter((c) => !c.parent);
  const span = (key: string): number => {
    const kids = layout.columns.filter((c) => c.parent === key);
    return kids.length === 0 ? 1 : kids.reduce((n, k) => n + span(k.key), 0);
  };
  const hasNested = tops.length !== leaves.length;
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
            <tr>
              <th rowSpan={hasNested ? 2 : 1} className="border-b border-border p-2 text-left">Item</th>
              {tops.map((c) => (
                <th key={c.key} colSpan={span(c.key)} className="border-b border-l border-border p-2 text-center">{c.header}</th>
              ))}
            </tr>
            {hasNested && (
              <tr>
                {tops.flatMap((t) => {
                  const kids = layout.columns.filter((c) => c.parent === t.key);
                  return kids.map((k) => <th key={k.key} className="border-b border-l border-border p-2 text-center font-normal">{k.header}</th>);
                })}
              </tr>
            )}
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
