/**
 * R5 — Correspondência curricular (E2 perfil, E3 posição→matriz, E4 associação específica).
 * Só dados canônicos: catálogos homologados, matrizes e turmas institucionais.
 * Sem dado ⇒ estado vazio explícito; nada é semeado. E4 é exceção explícita,
 * nunca fallback da correspondência regular.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAcademicDate } from "@/lib/academic-date";
import { loadCatalog } from "@/features/institutional-admin/institutional-catalog-source";
import { listInstitutionalClasses } from "@/features/classes/institutional-class-source";
import { leafColumns, loadInstitutionalMatrices, loadInstitutionalMatrixLayout } from "@/features/curriculum/curricular-matrix-source";
import { HomologationPanel, useR5Capabilities } from "@/features/curriculum/r5-homologation-panel";
import {
  GATE_EFFECTS, POLICY_PENDING_NOTE, canMaintain, homologatedOptions, humanR5Error, loadAssociations, loadCorrespondences,
  loadProfiles, maintainCapabilityOf, nextStep, recordAssociationVersion, recordCorrespondenceVersion, recordProfileVersion,
  type CatalogOption, type CatalogRef, type GateEffect,
} from "@/features/curriculum/r5-source";

const todayIso = () => new Date().toISOString().slice(0, 10);
const GATE_EFFECT_LABEL: Record<GateEffect, string> = {
  "matching-regular": "segue a correspondência regular",
  "associacao-explicita": "exige associação específica (exceção)",
  "fora-de-correspondencia": "fica fora da correspondência",
};
export const E4_EXCEPTION_NOTE =
  "A associação específica é exceção explícita para uma turma, registrada por ato próprio. Ela nunca substitui automaticamente a correspondência regular nem é usada quando esta falta.";

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">{children}</p>;
}
function Blocked({ kind }: { kind: "profile" | "correspondence" | "association" }) {
  return (
    <p className="text-xs text-muted-foreground" data-testid={`r5-${kind}-maintain-blocked`}>
      Registrar versões exige a capacidade “{maintainCapabilityOf(kind)}” com alcance de rede, que sua sessão não possui. {POLICY_PENDING_NOTE}
    </p>
  );
}
function Sel({ id, label, value, onChange, options, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
const refKey = (r: CatalogRef) => `${r.scheme}|${r.value}|${r.version}`;
const parseRef = (k: string): CatalogRef | null => {
  const [scheme, value, v] = k.split("|");
  return scheme && value && v ? { scheme, value, version: Number(v) } : null;
};

type Validity = { validFrom: string; validUntil: string; actRef: string; reason: string; mode: "" | "sucessao" | "retificacao" };
const emptyValidity: Validity = { validFrom: "", validUntil: "", actRef: "", reason: "", mode: "" };
function ValidityFields({ id, v, set, isNew, actLabel }: { id: string; v: Validity; set: (v: Validity) => void; isNew: boolean; actLabel: string }) {
  return (
    <>
      {!isNew && (
        <Sel id={`${id}-mode`} label="Tipo de mudança" value={v.mode} onChange={(m) => set({ ...v, mode: m as Validity["mode"] })} placeholder="Escolha…"
          options={[{ value: "sucessao", label: "Sucessão" }, { value: "retificacao", label: "Retificação" }]} />
      )}
      <div className="space-y-1"><Label htmlFor={`${id}-from`}>Início da vigência</Label>
        <DateInput id={`${id}-from`} value={v.validFrom} onChange={(e) => set({ ...v, validFrom: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`${id}-until`}>Término (opcional)</Label>
        <DateInput id={`${id}-until`} value={v.validUntil} onChange={(e) => set({ ...v, validUntil: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`${id}-act`}>{actLabel}</Label>
        <Input id={`${id}-act`} value={v.actRef} onChange={(e) => set({ ...v, actRef: e.target.value })} /></div>
      <div className="space-y-1 sm:col-span-2"><Label htmlFor={`${id}-reason`}>Motivo{isNew ? " (opcional)" : " (obrigatório)"}</Label>
        <Textarea id={`${id}-reason`} value={v.reason} onChange={(e) => set({ ...v, reason: e.target.value })} /></div>
    </>
  );
}
function useSubmit(onDone: () => void) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const run = async (fn: () => Promise<Record<string, unknown>>) => {
    setBusy(true); setErr(null); setOk(null);
    try { const r = await fn(); setOk(`Versão ${String(r["version"] ?? "")} registrada; versões anteriores preservadas.`); onDone(); void qc.invalidateQueries(); }
    catch (e) { setErr(humanR5Error((e as Error).message)); } finally { setBusy(false); }
  };
  return { busy, err, ok, run };
}
function VersionMeta({ v }: { v: { version: number; changeKind: string; validFrom: string; validUntil: string | null; actRef: string; reason: string | null } }) {
  return (
    <p className="text-xs text-muted-foreground">
      Versão {v.version} · {v.changeKind} · desde {formatAcademicDate(v.validFrom)}{v.validUntil ? ` até ${formatAcademicDate(v.validUntil)}` : " · sem término declarado"} · ato {v.actRef}{v.reason ? ` · motivo: ${v.reason}` : ""}
    </p>
  );
}

export function CurricularCorrespondencePage() {
  const [validOn, setValidOn] = useState(todayIso);
  const [knownAt] = useState(() => new Date().toISOString());
  const caps = useR5Capabilities();
  const catalog = useQuery({ queryKey: ["r5-catalog"], queryFn: loadCatalog });
  const options = useMemo(() => homologatedOptions(catalog.data ?? [], validOn), [catalog.data, validOn]);
  const matrices = useQuery({ queryKey: ["r5-matrices", validOn, knownAt], queryFn: () => loadInstitutionalMatrices({ validOn, knownAt }) });
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <Link to="/matrizes-curriculares" className="text-xs text-primary hover:underline">Matrizes curriculares</Link>
        <h1 className="text-2xl font-semibold text-foreground">Correspondência curricular</h1>
        <p className="text-sm text-muted-foreground">Perfil de correspondência, correspondência de posição para matriz e associações específicas, com versões e homologações preservadas.</p>
      </header>
      <div className="max-w-xs space-y-1">
        <Label htmlFor="r5-date">Vigente em</Label>
        <DateInput id="r5-date" value={validOn} onChange={(e) => setValidOn(e.target.value)} />
      </div>
      {(catalog.error || matrices.error) && <p role="alert" className="text-sm text-destructive">{humanR5Error(((catalog.error ?? matrices.error) as Error).message)}</p>}
      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil (E2)</TabsTrigger>
          <TabsTrigger value="correspondencia">Posição → matriz (E3)</TabsTrigger>
          <TabsTrigger value="associacao">Associação específica (E4)</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil"><ProfilesTab knownAt={knownAt} validOn={validOn} options={options} canWrite={canMaintain(caps, "profile")} catalogLoading={catalog.isLoading} /></TabsContent>
        <TabsContent value="correspondencia"><CorrespondencesTab knownAt={knownAt} validOn={validOn} options={options} matrices={matrices.data ?? []} canWrite={canMaintain(caps, "correspondence")} /></TabsContent>
        <TabsContent value="associacao"><AssociationsTab knownAt={knownAt} validOn={validOn} matrices={matrices.data ?? []} canWrite={canMaintain(caps, "association")} /></TabsContent>
      </Tabs>
    </section>
  );
}

type MatrixOpt = { matrixId: string; officialName: string };

// ------------------------------- E2 --------------------------------------
export function ProfilesTab({ knownAt, validOn, options, canWrite, catalogLoading }: {
  knownAt: string; validOn: string; options: Map<string, CatalogOption[]>; canWrite: boolean; catalogLoading?: boolean;
}) {
  const q = useQuery({ queryKey: ["r5-profiles", knownAt], queryFn: () => loadProfiles(knownAt) });
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const schemes = [...options.keys()].sort();
  return (
    <div className="space-y-3 pt-3">
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando perfis…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{humanR5Error((q.error as Error).message)}</p>}
      {q.data && q.data.size === 0 && <Empty>Nenhum perfil de correspondência registrado.</Empty>}
      {q.data && [...q.data.entries()].map(([pid, vs]) => (
        <article key={pid} className="space-y-2 rounded-md border border-border p-3">
          <h2 className="font-semibold text-foreground">Perfil {pid}</h2>
          {vs.map((v) => (
            <div key={v.versionId} className="space-y-1">
              <VersionMeta v={v} />
              <p className="text-xs text-foreground">Esquemas da chave: {v.positionKeySchemes.join(", ")} · eixo de natureza: {v.natureSchemeId ?? "nenhum"}
                {v.natureGates.length ? ` · portões: ${v.natureGates.map((g) => `${g.value} v${g.version} → ${GATE_EFFECT_LABEL[g.effect] ?? g.effect}`).join("; ")}` : ""}
                {v.applicabilityRule ? ` · aplicabilidade: ${v.applicabilityRule.scheme}=${v.applicabilityRule.value} v${v.applicabilityRule.version}` : ""}</p>
              <HomologationPanel kind="profile" versionId={v.versionId} title={`Homologação da versão ${v.version}`} />
            </div>
          ))}
          {canWrite && target === undefined && <Button size="sm" variant="outline" onClick={() => setTarget(pid)}>Nova versão deste perfil</Button>}
        </article>
      ))}
      {!canWrite ? <Blocked kind="profile" /> : catalogLoading ? null : schemes.length === 0 ? (
        <Empty>Não há valores de catálogo homologados vigentes nesta data. Sem eles, nenhum esquema de chave pode ser declarado e o perfil não pode ser registrado.</Empty>
      ) : target === undefined ? (
        <Button size="sm" onClick={() => setTarget(null)}>Constituir novo perfil</Button>
      ) : (
        <ProfileForm profileId={target} existing={target ? q.data?.get(target) ?? null : null} options={options} validOn={validOn} onClose={() => setTarget(undefined)} />
      )}
    </div>
  );
}

function ProfileForm({ profileId, existing, options, onClose }: {
  profileId: string | null; existing: { versionId: string }[] | null; options: Map<string, CatalogOption[]>; validOn: string; onClose: () => void;
}) {
  const schemes = [...options.keys()].sort();
  const [v, setV] = useState<Validity>(emptyValidity);
  const [keySchemes, setKeySchemes] = useState<string[]>([]);
  const [nature, setNature] = useState("");
  const [gates, setGates] = useState<Record<string, GateEffect | "">>({});
  const [rule, setRule] = useState("");
  const s = useSubmit(onClose);
  const all = [...options.values()].flat();
  const submit = () => s.run(async () => {
    const step = nextStep(existing as never, profileId ? (v.mode || null) as never : null);
    return recordProfileVersion({
      ...step, profileId, validFrom: v.validFrom, validUntil: v.validUntil || null, actRef: v.actRef, reason: v.reason || null,
      positionKeySchemes: keySchemes, natureSchemeId: nature || null,
      natureGates: nature ? (options.get(nature) ?? []).filter((o) => gates[o.value]).map((o) => ({ value: o.value, version: o.version, effect: gates[o.value] as GateEffect })) : [],
      applicabilityRule: rule ? parseRef(rule) : null,
    });
  }).catch(() => undefined);
  return (
    <form aria-label="Versão do perfil de correspondência" className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <fieldset className="space-y-1 sm:col-span-2">
        <legend className="text-sm font-medium">Esquemas da chave de posição (catálogos homologados)</legend>
        {schemes.map((sc) => (
          <label key={sc} className="mr-3 inline-flex items-center gap-1 text-sm">
            <input type="checkbox" checked={keySchemes.includes(sc)} onChange={(e) => setKeySchemes(e.target.checked ? [...keySchemes, sc] : keySchemes.filter((x) => x !== sc))} />{sc}
          </label>
        ))}
      </fieldset>
      <Sel id="r5p-nature" label="Eixo de natureza (opcional)" value={nature} onChange={(x) => { setNature(x); setGates({}); }} placeholder="Nenhum"
        options={schemes.map((x) => ({ value: x, label: x }))} />
      <Sel id="r5p-rule" label="Regra de aplicabilidade (opcional)" value={rule} onChange={setRule} placeholder="Nenhuma"
        options={all.map((o) => ({ value: refKey(o), label: `${o.scheme}: ${o.label} (v${o.version})` }))} />
      {nature && (
        <fieldset className="space-y-1 sm:col-span-2">
          <legend className="text-sm font-medium">Portões por valor do eixo</legend>
          {(options.get(nature) ?? []).map((o) => (
            <Sel key={o.value} id={`r5p-gate-${o.value}`} label={`${o.label} (v${o.version})`} value={gates[o.value] ?? ""} placeholder="Sem portão"
              onChange={(x) => setGates({ ...gates, [o.value]: x as GateEffect | "" })} options={GATE_EFFECTS.map((g) => ({ value: g, label: GATE_EFFECT_LABEL[g] }))} />
          ))}
        </fieldset>
      )}
      <ValidityFields id="r5p" v={v} set={setV} isNew={!profileId} actLabel="Ato que origina a versão" />
      {s.err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{s.err}</p>}
      {s.ok && <p role="status" className="text-sm text-foreground sm:col-span-2">{s.ok}</p>}
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" size="sm" disabled={s.busy}>Registrar versão</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancelar</Button></div>
    </form>
  );
}

// ------------------------------- E3 --------------------------------------
function useColumns(matrixId: string, validOn: string, knownAt: string) {
  return useQuery({
    queryKey: ["r5-columns", matrixId, validOn, knownAt], enabled: Boolean(matrixId),
    queryFn: async () => { const l = await loadInstitutionalMatrixLayout(matrixId, { validOn, knownAt }); return l ? leafColumns(l) : []; },
  });
}

export function CorrespondencesTab({ knownAt, validOn, options, matrices, canWrite }: {
  knownAt: string; validOn: string; options: Map<string, CatalogOption[]>; matrices: MatrixOpt[]; canWrite: boolean;
}) {
  const q = useQuery({ queryKey: ["r5-correspondences", knownAt], queryFn: () => loadCorrespondences(knownAt) });
  const profiles = useQuery({ queryKey: ["r5-profiles", knownAt], queryFn: () => loadProfiles(knownAt) });
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const name = (id: string) => matrices.find((m) => m.matrixId === id)?.officialName ?? id;
  const noProfiles = profiles.data && profiles.data.size === 0;
  return (
    <div className="space-y-3 pt-3">
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando correspondências…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{humanR5Error((q.error as Error).message)}</p>}
      {q.data && q.data.size === 0 && <Empty>Nenhuma correspondência de posição para matriz registrada.</Empty>}
      {q.data && [...q.data.entries()].map(([cid, vs]) => (
        <article key={cid} className="space-y-2 rounded-md border border-border p-3">
          <h2 className="font-semibold text-foreground">Correspondência {cid} · perfil {vs[0]?.profileId}</h2>
          {vs.map((v) => (
            <div key={v.versionId} className="space-y-1">
              <VersionMeta v={v} />
              <p className="text-xs text-foreground">Chave: {v.keys.map((k) => `${k.scheme}=${k.value} v${k.version}`).join(", ")} → {name(v.targetMatrixId)} · coluna {v.targetColumnKey}</p>
              <HomologationPanel kind="correspondence" versionId={v.versionId} title={`Homologação da versão ${v.version}`} />
            </div>
          ))}
          {canWrite && target === undefined && <Button size="sm" variant="outline" onClick={() => setTarget(cid)}>Nova versão desta correspondência</Button>}
        </article>
      ))}
      {!canWrite ? <Blocked kind="correspondence" /> : noProfiles ? (
        <Empty>Não há perfil de correspondência registrado; a correspondência depende dele.</Empty>
      ) : matrices.length === 0 ? (
        <Empty>Não há matriz curricular institucional vigente nesta data para ser alvo.</Empty>
      ) : options.size === 0 ? (
        <Empty>Não há valores de catálogo homologados vigentes nesta data para compor a chave de posição.</Empty>
      ) : target === undefined ? (
        <Button size="sm" onClick={() => setTarget(null)}>Constituir nova correspondência</Button>
      ) : profiles.data ? (
        <CorrespondenceForm id={target} existing={target ? q.data?.get(target) ?? null : null} profiles={profiles.data} options={options}
          matrices={matrices} validOn={validOn} knownAt={knownAt} onClose={() => setTarget(undefined)} />
      ) : null}
    </div>
  );
}

function CorrespondenceForm({ id, existing, profiles, options, matrices, validOn, knownAt, onClose }: {
  id: string | null; existing: { versionId: string; profileId: string }[] | null; profiles: Map<string, { positionKeySchemes: string[] }[]>;
  options: Map<string, CatalogOption[]>; matrices: MatrixOpt[]; validOn: string; knownAt: string; onClose: () => void;
}) {
  const [profileId, setProfileId] = useState(existing?.[0]?.profileId ?? "");
  const [matrixId, setMatrixId] = useState("");
  const [column, setColumn] = useState("");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [v, setV] = useState<Validity>(emptyValidity);
  const cols = useColumns(matrixId, validOn, knownAt);
  const pv = profileId ? profiles.get(profileId) : undefined;
  const keySchemes = pv?.[pv.length - 1]?.positionKeySchemes ?? [];
  const s = useSubmit(onClose);
  const submit = () => s.run(async () => recordCorrespondenceVersion({
    ...nextStep(existing as never, id ? (v.mode || null) as never : null),
    correspondenceId: id, profileId: id ? null : profileId || null, targetMatrixId: matrixId, targetColumnKey: column,
    keys: keySchemes.map((sc) => parseRef(keys[sc] ?? "")).filter((x): x is CatalogRef => x !== null),
    validFrom: v.validFrom, validUntil: v.validUntil || null, actRef: v.actRef, reason: v.reason || null,
  })).catch(() => undefined);
  return (
    <form aria-label="Versão da correspondência de posição" className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {!id && <Sel id="r5c-profile" label="Perfil" value={profileId} onChange={(x) => { setProfileId(x); setKeys({}); }} placeholder="Escolha…"
        options={[...profiles.keys()].map((p) => ({ value: p, label: p }))} />}
      <Sel id="r5c-matrix" label="Matriz alvo" value={matrixId} onChange={(x) => { setMatrixId(x); setColumn(""); }} placeholder="Escolha…"
        options={matrices.map((m) => ({ value: m.matrixId, label: m.officialName }))} />
      {matrixId && cols.data && cols.data.length === 0 && <p className="text-xs text-muted-foreground sm:col-span-2">A matriz escolhida não tem quadro com colunas transcritas nesta data; a coluna alvo não pode ser escolhida.</p>}
      {cols.data && cols.data.length > 0 && <Sel id="r5c-col" label="Coluna da matriz" value={column} onChange={setColumn} placeholder="Escolha…"
        options={cols.data.map((c) => ({ value: c.key, label: c.header }))} />}
      {keySchemes.map((sc) => {
        const opts = options.get(sc) ?? [];
        return opts.length === 0
          ? <p key={sc} className="text-xs text-muted-foreground sm:col-span-2">Não há valor homologado vigente no catálogo “{sc}”; a chave não pode ser composta.</p>
          : <Sel key={sc} id={`r5c-key-${sc}`} label={`Chave: ${sc}`} value={keys[sc] ?? ""} onChange={(x) => setKeys({ ...keys, [sc]: x })} placeholder="Escolha…"
              options={opts.map((o) => ({ value: refKey(o), label: `${o.label} (v${o.version})` }))} />;
      })}
      <ValidityFields id="r5c" v={v} set={setV} isNew={!id} actLabel="Ato que origina a versão" />
      {s.err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{s.err}</p>}
      {s.ok && <p role="status" className="text-sm text-foreground sm:col-span-2">{s.ok}</p>}
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" size="sm" disabled={s.busy}>Registrar versão</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancelar</Button></div>
    </form>
  );
}

// ------------------------------- E4 --------------------------------------
export function AssociationsTab({ knownAt, validOn, matrices, canWrite }: { knownAt: string; validOn: string; matrices: MatrixOpt[]; canWrite: boolean }) {
  const q = useQuery({ queryKey: ["r5-associations", knownAt], queryFn: () => loadAssociations(knownAt) });
  const classes = useQuery({ queryKey: ["r5-classes", validOn, knownAt], queryFn: () => listInstitutionalClasses({ validOn, knownAt }) });
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const name = (id: string) => matrices.find((m) => m.matrixId === id)?.officialName ?? id;
  const classOpts = (classes.data ?? []).filter((c) => c.record.kind === "one")
    .map((c) => ({ value: c.classId, label: c.record.kind === "one" ? `${c.record.value.name} · ${c.schoolName ?? c.schoolId}` : c.classId }));
  return (
    <div className="space-y-3 pt-3">
      <p className="rounded-md border border-border bg-muted p-3 text-sm text-foreground" data-testid="r5-e4-exception-note">{E4_EXCEPTION_NOTE}</p>
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando associações…</p>}
      {(q.error || classes.error) && <p role="alert" className="text-sm text-destructive">{humanR5Error(((q.error ?? classes.error) as Error).message)}</p>}
      {q.data && q.data.size === 0 && <Empty>Nenhuma associação específica registrada.</Empty>}
      {q.data && [...q.data.entries()].map(([aid, vs]) => (
        <article key={aid} className="space-y-2 rounded-md border border-border p-3">
          <h2 className="font-semibold text-foreground">Associação {aid} · turma {vs[0]?.classId}</h2>
          {vs.map((v) => (
            <div key={v.versionId} className="space-y-1">
              <VersionMeta v={v} />
              <p className="text-xs text-foreground">Matriz {name(v.targetMatrixId)}{v.targetColumnKey ? ` · coluna ${v.targetColumnKey}` : " · sem coluna declarada"}</p>
              <HomologationPanel kind="association" versionId={v.versionId} title={`Homologação da versão ${v.version}`} />
            </div>
          ))}
          {canWrite && target === undefined && <Button size="sm" variant="outline" onClick={() => setTarget(aid)}>Nova versão desta associação</Button>}
        </article>
      ))}
      {!canWrite ? <Blocked kind="association" /> : classes.isLoading ? null : classOpts.length === 0 ? (
        <Empty>Não há turma institucional registrada vigente nesta data; nenhuma associação específica pode ser criada.</Empty>
      ) : matrices.length === 0 ? (
        <Empty>Não há matriz curricular institucional vigente nesta data para ser alvo.</Empty>
      ) : target === undefined ? (
        <Button size="sm" onClick={() => setTarget(null)}>Registrar associação específica (exceção)</Button>
      ) : (
        <AssociationForm id={target} existing={target ? q.data?.get(target) ?? null : null} classes={classOpts} matrices={matrices}
          validOn={validOn} knownAt={knownAt} onClose={() => setTarget(undefined)} />
      )}
    </div>
  );
}

function AssociationForm({ id, existing, classes, matrices, validOn, knownAt, onClose }: {
  id: string | null; existing: { versionId: string }[] | null; classes: { value: string; label: string }[]; matrices: MatrixOpt[];
  validOn: string; knownAt: string; onClose: () => void;
}) {
  const [classId, setClassId] = useState("");
  const [matrixId, setMatrixId] = useState("");
  const [column, setColumn] = useState("");
  const [v, setV] = useState<Validity>(emptyValidity);
  const cols = useColumns(matrixId, validOn, knownAt);
  const s = useSubmit(onClose);
  const submit = () => s.run(async () => recordAssociationVersion({
    ...nextStep(existing as never, id ? (v.mode || null) as never : null),
    associationId: id, classId: id ? null : classId || null, targetMatrixId: matrixId, targetColumnKey: column || null,
    validFrom: v.validFrom, validUntil: v.validUntil || null, actRef: v.actRef, reason: v.reason || null,
  })).catch(() => undefined);
  return (
    <form aria-label="Versão da associação específica" className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {!id && <Sel id="r5a-class" label="Turma" value={classId} onChange={setClassId} placeholder="Escolha…" options={classes} />}
      <Sel id="r5a-matrix" label="Matriz alvo" value={matrixId} onChange={(x) => { setMatrixId(x); setColumn(""); }} placeholder="Escolha…"
        options={matrices.map((m) => ({ value: m.matrixId, label: m.officialName }))} />
      {cols.data && cols.data.length > 0 && <Sel id="r5a-col" label="Coluna (opcional)" value={column} onChange={setColumn} placeholder="Sem coluna"
        options={cols.data.map((c) => ({ value: c.key, label: c.header }))} />}
      <ValidityFields id="r5a" v={v} set={setV} isNew={!id} actLabel="Ato específico da exceção" />
      {s.err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{s.err}</p>}
      {s.ok && <p role="status" className="text-sm text-foreground sm:col-span-2">{s.ok}</p>}
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" size="sm" disabled={s.busy}>Registrar versão</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancelar</Button></div>
    </form>
  );
}
