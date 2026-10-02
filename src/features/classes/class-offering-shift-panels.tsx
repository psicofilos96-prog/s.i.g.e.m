/**
 * B2.6 — Seções independentes "Classificação da Oferta" e "Turno" no detalhe
 * institucional da Turma. Vigente pelo reader bitemporal; opções só do catálogo
 * homologado; nenhum eixo ou turno é inferido, fixo ou fabricado.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  classOfferingAt, classOfferingHistory, classShiftAt, classShiftHistory, homologatedValues, humanFactError,
  recordOffering, recordShift, SHIFT_SCHEME, type FactHistoryItem, type FactOperation, type HomologatedValue,
} from "./class-offering-shift-source";

const fmt = (d: string | null | undefined) => (d ? formatAcademicDate(d) : "sem término");
const errText = (e: unknown) => humanFactError(String((e as { message?: string })?.message ?? e));
const Missing = ({ children }: { children: ReactNode }) => <span className="text-sm italic text-muted-foreground">{children}</span>;
const opLabel: Record<FactOperation, string> = { register: "Registro inicial.", correct: "Correção da versão vigente.", switch: "Troca: o novo valor passa a valer a partir da data informada; o anterior é encerrado no dia anterior." };

function Panel({ title, icon, actions, children }: { title: string; icon: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm" aria-label={title}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
function F({ label, name, type = "text", required, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | undefined }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={`of-${name}`} className="text-xs">{label}</Label>
      <Input id={`of-${name}`} name={name} type={type} required={required} defaultValue={defaultValue} />
    </div>
  );
}
function Actions({ hasCurrent, hasAny, onPick }: { hasCurrent: boolean; hasAny: boolean; onPick: (m: FactOperation) => void }) {
  return (
    <div className="flex gap-1">
      {!hasAny ? <Button size="sm" variant="outline" onClick={() => onPick("register")}>Registrar</Button> : null}
      {hasCurrent ? <><Button size="sm" variant="outline" onClick={() => onPick("correct")}>Corrigir</Button><Button size="sm" variant="outline" onClick={() => onPick("switch")}>Trocar</Button></> : null}
      {hasAny && !hasCurrent ? <Button size="sm" variant="outline" onClick={() => onPick("register")}>Registrar nova vigência</Button> : null}
    </div>
  );
}
function History({ items, labels }: { items: FactHistoryItem[]; labels: Map<string, string> }) {
  if (!items.length) return <Missing>Nenhuma versão registrada.</Missing>;
  return (
    <ol className="mt-1 grid gap-1 text-sm">
      {[...items].reverse().map((v) => (
        <li key={v.id} className="text-muted-foreground">
          Versão {v.version}: {v.values.map((x) => labels.get(`${x.schemeId}:${x.valueId}`) ?? x.valueId).join(" · ")} · {fmt(v.validFrom)} – {fmt(v.validUntil)}
          {v.correctionReason ? ` · ${v.correctionReason}` : ""}{v.actRef ? ` · Ato ${v.actRef}` : ""}
        </li>
      ))}
    </ol>
  );
}
const labelMap = (vals: readonly HomologatedValue[]) => new Map(vals.map((v) => [`${v.schemeId}:${v.valueId}`, v.label]));

// ───────── Classificação da Oferta ─────────
export function OfferingPanel({ classId, canMaintain, validOn }: { classId: string; canMaintain: boolean; validOn: string }) {
  const qc = useQueryClient();
  const current = useQuery({ queryKey: ["inst-offering", classId, validOn], queryFn: () => classOfferingAt(classId, { validOn }) });
  const history = useQuery({ queryKey: ["inst-offering-history", classId], queryFn: () => classOfferingHistory(classId) });
  const catalog = useQuery({ queryKey: ["inst-homologated", "*", validOn], queryFn: () => homologatedValues(null, validOn) });
  const [mode, setMode] = useState<FactOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schemes = [...new Set((catalog.data ?? []).filter((v) => v.schemeId !== SHIFT_SCHEME).map((v) => v.schemeId))].sort();
  const cur = current.data ?? null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!mode) return; const f = new FormData(e.currentTarget);
    const axes = schemes.flatMap((s) => {
      const key = String(f.get(`axis-${s}`) ?? ""); if (!key) return [];
      const v = (catalog.data ?? []).find((x) => x.schemeId === s && `${x.valueId}@${x.version}` === key);
      return v ? [{ schemeId: s, valueId: v.valueId, version: v.version }] : [];
    });
    try {
      await recordOffering({ classId, operation: mode, base: cur ? { versionId: cur.versionId, logicalId: cur.logicalId } : null, axes,
        validFrom: String(f.get("from")), validUntil: String(f.get("until") || "") || null, reason: String(f.get("reason") || "") || null, actRef: String(f.get("act")) });
      setMode(null); setError(null); await qc.invalidateQueries();
    } catch (x) { setError(errText(x)); }
  }
  return (
    <Panel title="Classificação da Oferta" icon={<Shapes className="size-4" />}
      actions={canMaintain ? <Actions hasCurrent={!!cur} hasAny={(history.data ?? []).length > 0} onPick={setMode} /> : undefined}>
      {current.error ? <p role="alert" className="text-sm text-destructive">{errText(current.error)}</p> : cur ? (
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          {cur.axes.map((a) => <><dt key={`k-${a.schemeId}`} className="text-muted-foreground">{a.schemeId}</dt><dd key={`v-${a.schemeId}`}>{a.label ?? a.valueId}</dd></>)}
          <dt className="text-muted-foreground">Vigência</dt><dd>{fmt(cur.validFrom)} – {fmt(cur.validUntil)}</dd>
        </dl>
      ) : current.isLoading ? <Missing>Carregando…</Missing> : <Missing>Não registrado</Missing>}
      {mode ? (
        <form onSubmit={submit} className="mt-3 grid gap-2 rounded-md border border-border p-3" aria-label="Classificação da oferta">
          <p className="text-xs text-muted-foreground">{opLabel[mode]}</p>
          {schemes.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">Não há valores institucionais homologados disponíveis para classificar a oferta. Eles são cadastrados em Administração › Catálogos Institucionais.</p>
          ) : schemes.map((s) => {
            const current = cur?.axes.find((a) => a.schemeId === s);
            return (
              <div key={s} className="grid gap-1">
                <Label htmlFor={`of-axis-${s}`} className="text-xs">Eixo {s}</Label>
                <select id={`of-axis-${s}`} name={`axis-${s}`} defaultValue={mode === "correct" && current ? `${current.valueId}@${current.valueVersion}` : ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Sem classificação neste eixo</option>
                  {(catalog.data ?? []).filter((v) => v.schemeId === s).map((v) => <option key={v.valueId} value={`${v.valueId}@${v.version}`}>{v.label}</option>)}
                </select>
              </div>
            );
          })}
          <div className="grid gap-2 sm:grid-cols-2">
            <F label="Início" name="from" type="date" required defaultValue={mode === "correct" ? cur?.validFrom : undefined} />
            <F label="Término (opcional)" name="until" type="date" defaultValue={mode === "correct" ? cur?.validUntil ?? undefined : undefined} />
          </div>
          {mode !== "register" ? <F label="Motivo" name="reason" required /> : null}
          <F label="Ato administrativo" name="act" required />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2"><Button type="submit" size="sm" disabled={schemes.length === 0}>Registrar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancelar</Button></div>
        </form>
      ) : null}
      <h3 className="mt-4 text-xs font-semibold text-muted-foreground">Histórico da classificação</h3>
      <History items={history.data ?? []} labels={labelMap(catalog.data ?? [])} />
    </Panel>
  );
}

// ───────── Turno ─────────
export function ShiftPanel({ classId, canMaintain, validOn }: { classId: string; canMaintain: boolean; validOn: string }) {
  const qc = useQueryClient();
  const current = useQuery({ queryKey: ["inst-shift", classId, validOn], queryFn: () => classShiftAt(classId, { validOn }) });
  const history = useQuery({ queryKey: ["inst-shift-history", classId], queryFn: () => classShiftHistory(classId) });
  const values = useQuery({ queryKey: ["inst-homologated", SHIFT_SCHEME, validOn], queryFn: () => homologatedValues(SHIFT_SCHEME, validOn) });
  const [mode, setMode] = useState<FactOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cur = current.data ?? null;
  const opts = values.data ?? [];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!mode) return; const f = new FormData(e.currentTarget);
    const v = opts.find((o) => `${o.valueId}@${o.version}` === String(f.get("shift")));
    if (!v) { setError("Selecione um turno homologado."); return; }
    try {
      await recordShift({ classId, operation: mode, base: cur ? { versionId: cur.versionId, logicalId: cur.logicalId } : null,
        valueId: v.valueId, valueVersion: v.version, validFrom: String(f.get("from")), validUntil: String(f.get("until") || "") || null,
        reason: String(f.get("reason") || "") || null, actRef: String(f.get("act")) });
      setMode(null); setError(null); await qc.invalidateQueries();
    } catch (x) { setError(errText(x)); }
  }
  return (
    <Panel title="Turno" icon={<Clock className="size-4" />}
      actions={canMaintain ? <Actions hasCurrent={!!cur} hasAny={(history.data ?? []).length > 0} onPick={setMode} /> : undefined}>
      {current.error ? <p role="alert" className="text-sm text-destructive">{errText(current.error)}</p> : cur ? (
        <p className="text-sm">{cur.value.label ?? cur.value.valueId} · {fmt(cur.validFrom)} – {fmt(cur.validUntil)}</p>
      ) : current.isLoading ? <Missing>Carregando…</Missing> : <Missing>Não registrado</Missing>}
      {mode ? (
        <form onSubmit={submit} className="mt-3 grid gap-2 rounded-md border border-border p-3" aria-label="Turno da turma">
          <p className="text-xs text-muted-foreground">{opLabel[mode]}</p>
          {opts.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">Não há valores institucionais de turno homologados. Eles são cadastrados no esquema “turno” em Administração › Catálogos Institucionais.</p>
          ) : (
            <div className="grid gap-1">
              <Label htmlFor="of-shift" className="text-xs">Turno</Label>
              <select id="of-shift" name="shift" required defaultValue={mode === "correct" && cur ? `${cur.value.valueId}@${cur.value.valueVersion}` : undefined} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {opts.map((o) => <option key={o.valueId} value={`${o.valueId}@${o.version}`}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <F label="Início" name="from" type="date" required defaultValue={mode === "correct" ? cur?.validFrom : undefined} />
            <F label="Término (opcional)" name="until" type="date" defaultValue={mode === "correct" ? cur?.validUntil ?? undefined : undefined} />
          </div>
          {mode !== "register" ? <F label="Motivo" name="reason" required /> : null}
          <F label="Ato administrativo" name="act" required />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2"><Button type="submit" size="sm" disabled={opts.length === 0}>Registrar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancelar</Button></div>
        </form>
      ) : null}
      <h3 className="mt-4 text-xs font-semibold text-muted-foreground">Histórico do turno</h3>
      <History items={history.data ?? []} labels={labelMap(opts)} />
    </Panel>
  );
}
