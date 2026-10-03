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
  describeLoad,
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
