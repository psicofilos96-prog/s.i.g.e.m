import { userErrorText } from "@/lib/observability/governed-errors";
/**
 * B4.6.10 — "Onde este calendário vale": declaração humana da aplicabilidade sobre a última versão salva.
 * Só oferece escolas cadastradas e valores de eixo HOMOLOGADOS lidos do banco; gravar cria nova versão (retificação)
 * pelo writer existente com janelas. Sem cadastro, diz por extenso que não há o que declarar — nunca inventa.
 */
import { DateInput } from "@/components/sigem/date-input";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NetworkCalendar } from "./calendar-types";
import {
  centralErrorText, readApplicabilityOptions, saveCentralCalendar,
  type ApplicabilityOptions, type ApplicabilityScope, type CentralEntry,
} from "./calendar-central";

const scopeText = (s: ApplicabilityScope, o: ApplicabilityOptions) =>
  s.conditions.map((c) => {
    if (c.kind === "escola") return o.schools.find((x) => x.schoolId === c.school_id)?.name ?? "Escola (nome não disponível)";
    if (c.kind === "valor-de-eixo") return o.axisValues.find((x) => x.schemeId === c.scheme_id && x.valueId === c.value_id && x.version === c.value_version)?.label ?? "Valor homologado (rótulo não disponível)";
    return c.kind === "alocacao" ? "Alocação individual" : "Posição curricular individual";
  }).join(" + ");

export function CalendarApplicabilityPanel({ entry, cal, unsaved, onSaved }: {
  entry: CentralEntry; cal: NetworkCalendar; unsaved: boolean; onSaved: (message: string) => Promise<void> | void;
}) {
  const [opts, setOpts] = useState<ApplicabilityOptions | "acesso-negado" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApplicabilityScope[] | null>(null);
  const [choice, setChoice] = useState("");
  const [schoolLimit, setSchoolLimit] = useState("");
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState(`${cal.year}-01-01`);
  const [until, setUntil] = useState(`${cal.year}-12-31`);
  const [busy, setBusy] = useState(false);
  const versionId = entry.latest.versionId;

  useEffect(() => {
    let live = true;
    setOpts(null); setDraft(null); setError(null);
    readApplicabilityOptions(versionId).then((o) => { if (live) { setOpts(o); if (o !== "acesso-negado") setDraft(o.scopes); } },
      (e: unknown) => { if (live) setError(userErrorText(e)); });
    return () => { live = false; };
  }, [versionId]);

  if (error) return <p role="alert" className="text-sm text-destructive">Onde este calendário vale: {error}</p>;
  if (!opts || !draft) return <p role="status" className="text-sm text-muted-foreground">Lendo onde este calendário vale…</p>;
  if (opts === "acesso-negado") return null;

  const nothingToDeclare = opts.schools.length === 0 && opts.axisValues.length === 0;
  const changed = JSON.stringify(draft) !== JSON.stringify(opts.scopes);
  const add = () => {
    const [kind, ...rest] = choice.split("|");
    const cond = kind === "escola" ? { kind: "escola" as const, school_id: rest[0]! }
      : { kind: "valor-de-eixo" as const, scheme_id: rest[0]!, value_id: rest[1]!, value_version: Number(rest[2]) };
    const key = `recorte-${draft.length + 1}-${Date.now().toString(36)}`;
    const conditions = kind !== "escola" && schoolLimit
      ? [cond, { kind: "escola" as const, school_id: schoolLimit }] : [cond];
    setDraft([...draft, { scope_key: key, label: label.trim() || null, window_from: from, window_until: until, conditions }]);
    setChoice(""); setSchoolLimit(""); setLabel("");
  };
  const save = () => {
    setBusy(true);
    void saveCentralCalendar({ cal, sourceKey: cal.id, expectedBaseVersionId: versionId, sourceKind: "edicao-institucional",
      reason: "Declaração de onde o calendário vale", applicability: draft })
      .then((r) => onSaved(`Onde o calendário vale foi gravado · versão ${r.version}. Homologue para valer nas escolas.`),
        (e: unknown) => onSaved(`Não foi gravado: ${centralErrorText(e)}`))
      .finally(() => setBusy(false));
  };

  return (
    <section aria-label="Onde este calendário vale" className="space-y-2 text-sm" data-sigem-build="b4.6.10-aplicabilidade">
      <h3 className="font-medium">Onde este calendário vale</h3>
      {draft.length === 0 ? (
        <p className="text-muted-foreground">{opts.pending ?? "Ainda não declarado."} Diários, aulas previstas e conselhos só usam este calendário onde ele estiver declarado.</p>
      ) : (
        <ul className="space-y-1">
          {draft.map((s) => (
            <li key={s.scope_key} className="flex flex-wrap items-center gap-2">
              <span>{s.label ? `${s.label}: ` : ""}{scopeText(s, opts)} · {s.window_from} a {s.window_until}</span>
              <Button size="sm" variant="ghost" onClick={() => setDraft(draft.filter((x) => x !== s))}>Remover</Button>
            </li>
          ))}
        </ul>
      )}
      {nothingToDeclare ? (
        <p className="text-muted-foreground">Não há escolas cadastradas nem valores de etapa/modalidade homologados no sistema; quando houver, eles aparecem aqui para escolha.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">Vale para
            <select className="rounded-md border border-input bg-background px-2 py-1" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Escolha…</option>
              {opts.schools.length ? <optgroup label="Escolas">{opts.schools.map((x) => <option key={x.schoolId} value={`escola|${x.schoolId}`}>{x.name}{x.active ? "" : " (inativa)"}</option>)}</optgroup> : null}
              {opts.axisValues.length ? <optgroup label="Valores homologados">{opts.axisValues.map((x) => <option key={`${x.schemeId}|${x.valueId}|${x.version}`} value={`valor|${x.schemeId}|${x.valueId}|${x.version}`}>{x.label}</option>)}</optgroup> : null}
            </select>
          </label>
          {opts.schools.length > 0 && !choice.startsWith("escola|") ? (
            <label className="grid gap-1">Limitar também à escola (opcional)
              <select className="rounded-md border border-input bg-background px-2 py-1" value={schoolLimit} onChange={(e) => setSchoolLimit(e.target.value)}>
                <option value="">Todas as escolas para este valor</option>
                {opts.schools.map((x) => <option key={x.schoolId} value={x.schoolId}>{x.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1">Nome (opcional)<input className="rounded-md border border-input bg-background px-2 py-1" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
          <label className="grid gap-1">De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grid gap-1">Até<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <Button size="sm" variant="outline" disabled={!choice || !from || !until} onClick={add}>Adicionar</Button>
        </div>
      )}
      {changed ? (
        <Button size="sm" disabled={busy || unsaved} title={unsaved ? "Salve as alterações do calendário antes" : undefined} onClick={save}>
          Gravar onde o calendário vale
        </Button>
      ) : null}
    </section>
  );
}
