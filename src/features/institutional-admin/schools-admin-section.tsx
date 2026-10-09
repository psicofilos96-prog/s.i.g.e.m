import { operationalToday } from "@/lib/academic-date";
import { unitKindLabel } from "./school-source-import";
import { ADMIN_FIELDS, ADMIN_FIELD_LABEL, adminCoherenceWarnings, adminFieldArgs, resultingAdmin, type AdminField, type AdminFieldState } from "./school-admin-fields";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { loadSchoolRegistryRows } from "@/features/units/school-registry-source";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { parseAcademicDate } from "@/lib/academic-date";
const isoOf = (v: FormDataEntryValue | null) => { const t = String(v ?? "").trim(); return t ? parseAcademicDate(t) ?? t : null; };
import {
  currentSchoolVersion,
  schoolIdentifier,
  schoolVersionAt,
  unitsFromRows,
  type SchoolRecordVersion,
  type SchoolUnit,
} from "@/features/schools/school-registry";

/**
 * B2.1 — Administração de Unidades Escolares sobre o cadastro canônico 14.1.1/14.11.
 * Só lê as tabelas institucionais e grava pelas funções do banco; nunca usa
 * unidades demonstrativas. Ausência continua ausência ("não informado").
 */
type LinkRow = {
  id: string; logical_link_id: string; version: number; principal_school_id: string; linked_school_id: string;
  link_kind_id: string; link_kind_version: number; valid_from: string; valid_until: string | null; originating_act_ref: string;
};
type VersionMeta = { id: string; justification: string | null; registered_at: string; author_person_id: string | null };
type LinkKind = { value_id: string; version: number; label: string };

const ERR: Record<string, string> = {
  "school:inep-in-use": "Este INEP já pertence a outra unidade. Nada foi gravado.",
  "school:network-code-in-use": "Este código da rede já pertence a outra unidade. Nada foi gravado.",
  "school:valid-from-required": "Informe a data de início da vigência.",
  "INEP divergente": "O INEP desta unidade já está registrado e não muda.",
  "Código de rede divergente": "O código da rede desta unidade já está registrado e não muda.",
  "Justificativa obrigatória": "Uma nova versão exige justificativa.",
  "Versão base superada": "Outra pessoa registrou uma versão antes de você. Recarregue e confira.",
  "Nome oficial obrigatório": "Informe o nome oficial.",
  "E-mail institucional inválido": "O e-mail institucional parece inválido.",
  "school-link:kind-not-homologated": "Tipo de vínculo não homologado para a data informada.",
  "school-link:unknown-school": "Escolha as duas unidades pela lista; não há associação por nome.",
  "school:clear-and-set-conflict": "Um campo não pode ser alterado e limpo ao mesmo tempo.",
  "capability:": "Sua atuação vigente não concede a manutenção do cadastro de unidades com alcance de rede.",
};
const human = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ""] ?? "Operação recusada; nada foi gravado.";
const NI = "não informado";
const yn = (v: boolean | null | undefined) => (v == null ? NI : v ? "sim" : "não");
const opt = (s: FormDataEntryValue | null) => { const t = String(s ?? "").trim(); return t === "" ? null : t; };
const triBool = (s: FormDataEntryValue | null) => (s === "sim" ? true : s === "nao" ? false : null);
const selectCls = "h-10 rounded-md border border-input bg-background px-3 text-sm";

/**
 * `focus` (ONDA 2): abre direto em "nova" (schoolId null) ou "editar" de uma unidade,
 * sem a lista lateral; ao salvar ou cancelar chama `onExit`. O writer é o mesmo.
 */
export function SchoolsAdminSection({ canMaintain, focus, onExit }: { canMaintain: boolean; focus?: { schoolId: string | null }; onExit?: (saved: boolean) => void }) {
  const [units, setUnits] = useState<SchoolUnit[]>([]);
  const [meta, setMeta] = useState<Record<string, VersionMeta>>({});
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [kinds, setKinds] = useState<LinkKind[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(focus?.schoolId ?? null);
  const [mode, setModeRaw] = useState<"view" | "new" | "edit">(focus ? (focus.schoolId ? "edit" : "new") : "view");
  const savedRef = useRef(false);
  const setMode = useCallback((m: "view" | "new" | "edit") => {
    if (focus && m === "view") { onExit?.(savedRef.current); return; }
    setModeRaw(m);
  }, [focus, onExit]);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  const load = useCallback(async () => {
    const [rows, l, k] = await Promise.all([
      loadSchoolRegistryRows(),
      supabase.from("institutional_school_links").select("id, logical_link_id, version, principal_school_id, linked_school_id, link_kind_id, link_kind_version, valid_from, valid_until, originating_act_ref"),
      supabase.from("attribute_value_definitions").select("value_id, version, label, status").eq("scheme_id", "vinculo-entre-unidades"),
    ]);
    if (!rows || l.error) { setLoadErr(true); return; }
    setLoadErr(false);
    setUnits(unitsFromRows(rows.schools, rows.identifiers, rows.versions));
    setMeta(Object.fromEntries(rows.versions.map((r) => [r.id, { id: r.id, justification: r.justification, registered_at: r.registered_at, author_person_id: r.author_person_id }])));
    setLinks((l.data ?? []) as LinkRow[]);
    setKinds(((k.data ?? []) as (LinkKind & { status: string })[]).filter((x) => x.status === "homologated" || x.status === "homologado" || x.status === "homologada"));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const name = useCallback((id: string) => { const u = units.find((x) => x.schoolId === id); return (u && currentSchoolVersion(u)?.officialName) ?? id; }, [units]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return units
      .map((u) => ({ u, cur: currentSchoolVersion(u) }))
      .filter(({ u, cur }) => !t || `${cur?.officialName ?? ""} ${schoolIdentifier(u, "inep") ?? ""} ${schoolIdentifier(u, "codigo-rede") ?? ""}`.toLowerCase().includes(t))
      .sort((a, b) => (a.cur?.officialName ?? "").localeCompare(b.cur?.officialName ?? "", "pt-BR"));
  }, [units, q]);
  const unit = units.find((u) => u.schoolId === sel) ?? null;

  async function submit(e: FormEvent<HTMLFormElement>, base: SchoolUnit | null, activeOverride?: boolean) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cur = base ? currentSchoolVersion(base) : null;
    const rooms = opt(f.get("rooms"));
    const loc = opt(f.get("loc"));
    const adm = adminFieldArgs(statesFromForm(f));
    if (!adm.ok) return setErr(`Informe o novo valor de "${ADMIN_FIELD_LABEL[adm.field]}" ou escolha "Manter valor anterior"/"Limpar".`);
    const { data, error } = await supabase.rpc("register_school_record_version", {
      _school: (base?.schoolId ?? null) as string,
      _base_version_id: (cur?.id ?? null) as string,
      _official_name: String(f.get("oname") ?? ""),
      _address: opt(f.get("addr")) as string,
      _district: opt(f.get("dist")) as string,
      _location_kind: loc as string,
      _active: activeOverride ?? (cur?.active ?? true),
      _valid_from: String(isoOf(f.get("from")) ?? ""),
      _justification: opt(f.get("just")) as string,
      _act_ref: opt(f.get("act")) as string,
      _inep: (base ? schoolIdentifier(base, "inep") ?? opt(f.get("inep")) : opt(f.get("inep"))) as string,
      _network_code: (base ? schoolIdentifier(base, "codigo-rede") ?? opt(f.get("code")) : opt(f.get("code"))) as string,
      _phone: opt(f.get("phone")) as string,
      _email: opt(f.get("email")) as string,
      _own_building: triBool(f.get("own")) as boolean,
      _hard_access: triBool(f.get("hard")) as boolean,
      _classroom_count: (rooms === null ? null : Number(rooms)) as number,
      _administrative_dependency: adm.args._administrative_dependency as string,
      _private_school_category: adm.args._private_school_category as string,
      _partnership_public_authority: adm.args._partnership_public_authority as string,
      _clear_administrative: adm.args._clear_administrative as string[],
    });
    if (error) return setErr(human(error.message));
    setErr(null);
    savedRef.current = true;
    await load();
    if (!base && data) {
      const r = await supabase.from("institutional_school_record_versions").select("school_id").eq("id", data).maybeSingle();
      if (r.data) setSel(r.data.school_id);
    }
    setMode("view");
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="schools-h">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="schools-h" className="font-display text-lg font-semibold text-foreground">Unidades escolares</h2>
        {canMaintain && <Button size="sm" onClick={() => { setMode("new"); setSel(null); setErr(null); }}>Cadastrar unidade</Button>}
      </div>
      {loadErr && <p className="text-sm text-destructive">Não foi possível ler o cadastro institucional de unidades. Nenhuma unidade demonstrativa é exibida no lugar.</p>}
      {mode === "new" && canMaintain && (
        <SchoolForm title="Nova unidade" onSubmit={(e) => submit(e, null)} onCancel={() => setMode("view")} err={err} />
      )}
      {focus ? (
        focus.schoolId && (unit ? (
          <SchoolDetail
            unit={unit} meta={meta} links={links} kinds={kinds} units={units} name={name} canMaintain={canMaintain}
            mode={mode} setMode={setMode} err={err} setErr={setErr} submit={submit} reload={load}
          />
        ) : <p className="text-sm text-muted-foreground">{loadErr ? "" : "Carregando a unidade…"}</p>)
      ) : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Input placeholder="Localizar por nome, INEP ou código" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Localizar unidade" className="mb-2" />
          <ul className="grid max-h-[28rem] gap-1 overflow-y-auto text-sm">
            {shown.map(({ u, cur }) => (
              <li key={u.schoolId}>
                <button type="button" onClick={() => { setSel(u.schoolId); setMode("view"); setErr(null); }}
                  className={`w-full rounded-md px-2 py-1.5 text-left break-words hover:bg-muted ${sel === u.schoolId ? "bg-muted font-medium" : ""}`}
                  aria-current={sel === u.schoolId}>
                  {cur?.officialName ?? u.schoolId}
                  <span className="block text-xs text-muted-foreground">INEP {schoolIdentifier(u, "inep") ?? NI}{cur && !cur.active ? " · inativa" : ""}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && !loadErr && <li className="text-muted-foreground">{units.length === 0 ? "Nenhuma unidade cadastrada no SIGEM." : "Nenhuma unidade encontrada."}</li>}
          </ul>
        </div>
        <div className="min-w-0">
          {unit ? (
            <SchoolDetail
              unit={unit} meta={meta} links={links} kinds={kinds} units={units} name={name} canMaintain={canMaintain}
              mode={mode} setMode={setMode} err={err} setErr={setErr} submit={submit} reload={load}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione uma unidade para ver a identidade, as versões e os vínculos.</p>
          )}
        </div>
      </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (<div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-2 py-0.5"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>);
}

function VersionFacts({ v }: { v: SchoolRecordVersion }) {
  return (
    <dl className="text-sm">
      <Row k="Nome oficial" v={v.officialName} />
      <Row k="Situação" v={v.active ? "ativa" : "inativa"} />
      <Row k="Endereço" v={v.address ?? NI} />
      <Row k="Distrito" v={v.district ?? NI} />
      <Row k="Localização" v={v.locationKind ?? NI} />
      <Row k="Telefone" v={v.phone ?? NI} />
      <Row k="E-mail institucional" v={v.institutionalEmail ?? NI} />
      <Row k="Prédio próprio" v={yn(v.ownBuilding)} />
      <Row k="Difícil acesso" v={yn(v.hardAccess)} />
      <Row k="Salas de aula" v={v.classroomCount == null ? NI : String(v.classroomCount)} />
      <Row k="Tipo de unidade" v={unitKindLabel(v.administrativeDependency ?? null, v.partnershipPublicAuthority ?? null)} />
      <Row k="Categoria (privada)" v={v.privateSchoolCategory ?? NI} />
      <Row k="Vigência desde" v={v.validFrom} />
      <Row k="Referência documental/fonte" v={v.originatingActRef ?? NI} />
    </dl>
  );
}

function SchoolDetail(props: {
  unit: SchoolUnit; meta: Record<string, VersionMeta>; links: LinkRow[]; kinds: LinkKind[]; units: SchoolUnit[];
  name: (id: string) => string; canMaintain: boolean; mode: string; setMode: (m: "view" | "new" | "edit") => void;
  err: string | null; setErr: (s: string | null) => void;
  submit: (e: FormEvent<HTMLFormElement>, base: SchoolUnit | null, active?: boolean) => Promise<void>; reload: () => Promise<void>;
}) {
  const { unit, meta, links, kinds, units, name, canMaintain, mode, setMode, err, setErr, submit, reload } = props;
  const cur = currentSchoolVersion(unit);
  const [on, setOn] = useState(operationalToday());
  const atDate = schoolVersionAt(unit, on);
  const [toggle, setToggle] = useState(false);
  const versions = [...unit.versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const mine = links.filter((l) => l.principal_school_id === unit.schoolId || l.linked_school_id === unit.schoolId);
  const currentLinks = Object.values(mine.reduce<Record<string, LinkRow>>((acc, l) => { if (!acc[l.logical_link_id] || acc[l.logical_link_id]!.version < l.version) acc[l.logical_link_id] = l; return acc; }, {}));

  async function addLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const [kid, kv] = String(f.get("lkind") ?? "").split("@");
    const { error } = await supabase.rpc("record_school_link", {
      _logical: null as unknown as string, _base: null as unknown as string,
      _principal: unit.schoolId, _linked: String(f.get("lschool")), _kind: kid ?? "", _kind_version: Number(kv),
      _valid_from: String(isoOf(f.get("lfrom")) ?? ""), _valid_until: (isoOf(f.get("luntil")) ?? null) as string,
      _act_ref: String(f.get("lact") ?? ""), _correction_reason: null as unknown as string,
    });
    if (error) return setErr(human(error.message));
    setErr(null);
    savedRef.current = true;
    await reload();
  }

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="font-display text-base font-semibold break-words">{cur?.officialName ?? unit.schoolId}</h3>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <Badge variant="secondary">INEP {schoolIdentifier(unit, "inep") ?? NI}</Badge>
          <Badge variant="secondary">Código da rede {schoolIdentifier(unit, "codigo-rede") ?? NI}</Badge>
          {cur && <Badge variant={cur.active ? "outline" : "destructive"}>{cur.active ? "ativa" : "inativa"}</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground break-all">Identificador interno permanente: {unit.schoolId}</p>
      </div>

      {mode === "edit" && canMaintain && cur ? (
        <SchoolForm title={toggle ? (cur.active ? "Inativar unidade" : "Reativar unidade") : "Nova versão dos dados"} base={cur}
          lockedIds={{ inep: schoolIdentifier(unit, "inep"), code: schoolIdentifier(unit, "codigo-rede") }}
          onSubmit={(e) => submit(e, unit, toggle ? !cur.active : undefined)} onCancel={() => setMode("view")} err={err} statusOnly={toggle} />
      ) : (
        <>
          {cur && <VersionFacts v={cur} />}
          {canMaintain && cur && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setToggle(false); setMode("edit"); setErr(null); }}>Registrar nova versão</Button>
              <Button size="sm" variant="outline" onClick={() => { setToggle(true); setMode("edit"); setErr(null); }}>{cur.active ? "Inativar" : "Reativar"}</Button>
            </div>
          )}
        </>
      )}

      <div>
        <h4 className="mb-1 text-sm font-semibold">Consulta pela vigência</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1"><Label htmlFor="on">Data</Label><DateInput id="on" value={on} onChange={(e) => setOn(e.target.value)} className="w-44" /></div>
          <p className="text-sm">{atDate ? `Versão ${atDate.versionNumber} — ${atDate.officialName} (${atDate.active ? "ativa" : "inativa"})` : "Nenhuma versão vigente nessa data."}</p>
        </div>
      </div>

      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Histórico de versões ({versions.length})</summary>
        <ol className="mt-2 grid gap-3">
          {versions.map((v) => (
            <li key={v.id} className="border-t border-border pt-2 text-sm">
              <p className="font-medium">Versão {v.versionNumber}{v.supersedesVersionId ? " (substitui a anterior)" : " (registro inicial)"}</p>
              <p className="text-xs text-muted-foreground">Registrada em {meta[v.id]?.registered_at?.slice(0, 16).replace("T", " ") ?? NI} · autoria {meta[v.id]?.author_person_id ?? NI}</p>
              {meta[v.id]?.justification && <p className="text-xs">Justificativa: {meta[v.id]!.justification}</p>}
              <VersionFacts v={v} />
            </li>
          ))}
        </ol>
      </details>

      <div>
        <h4 className="mb-1 text-sm font-semibold">Unidades vinculadas (anexos)</h4>
        <ul className="grid gap-1 text-sm">
          {currentLinks.map((l) => (
            <li key={l.id} className="break-words">
              {l.principal_school_id === unit.schoolId ? `Principal de ${name(l.linked_school_id)}` : `Vinculada a ${name(l.principal_school_id)}`} · {kinds.find((k) => k.value_id === l.link_kind_id)?.label ?? l.link_kind_id} v{l.link_kind_version} · {l.valid_from} a {l.valid_until ?? "sem fim"} · ato {l.originating_act_ref}
            </li>
          ))}
          {currentLinks.length === 0 && <li className="text-muted-foreground">Nenhum vínculo registrado.</li>}
        </ul>
        {canMaintain && (
          kinds.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Não há tipo de vínculo entre unidades homologado; nenhum vínculo pode ser registrado.</p>
          ) : (
            <form onSubmit={addLink} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1"><Label htmlFor="lschool">Unidade vinculada</Label>
                <select id="lschool" name="lschool" required className={selectCls}>
                  {units.filter((u) => u.schoolId !== unit.schoolId).map((u) => <option key={u.schoolId} value={u.schoolId}>{currentSchoolVersion(u)?.officialName ?? u.schoolId} — INEP {schoolIdentifier(u, "inep") ?? NI}</option>)}
                </select></div>
              <div className="grid gap-1"><Label htmlFor="lkind">Tipo de vínculo (homologado)</Label>
                <select id="lkind" name="lkind" required className={selectCls}>
                  {kinds.map((k) => <option key={`${k.value_id}@${k.version}`} value={`${k.value_id}@${k.version}`}>{k.label} (v{k.version})</option>)}
                </select></div>
              <div className="grid gap-1"><Label htmlFor="lfrom">Início</Label><DateInput id="lfrom" name="lfrom" required /></div>
              <div className="grid gap-1"><Label htmlFor="luntil">Fim (opcional)</Label><DateInput id="luntil" name="luntil" /></div>
              <div className="grid gap-1 sm:col-span-2"><Label htmlFor="lact">Ato originador</Label><Input id="lact" name="lact" required /></div>
              <div className="sm:col-span-2"><Button type="submit" size="sm">Registrar vínculo</Button></div>
            </form>
          )
        )}
      </div>
      {err && mode === "view" && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}

function F({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (<div className="grid gap-1 min-w-0"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} {...rest} /></div>);
}
function Tri({ id, label, value }: { id: string; label: string; value: boolean | null | undefined }) {
  return (
    <div className="grid gap-1"><Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} defaultValue={value == null ? "" : value ? "sim" : "nao"} className={selectCls}>
        <option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option>
      </select></div>
  );
}

function SchoolForm({ title, base, lockedIds, onSubmit, onCancel, err, statusOnly }: {
  title: string; base?: SchoolRecordVersion; lockedIds?: { inep: string | null; code: string | null };
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void; err: string | null; statusOnly?: boolean;
}) {
  const hide = statusOnly ? "hidden" : "";
  return (
    <form onSubmit={onSubmit} className="mb-4 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <h3 className="font-display text-base font-semibold sm:col-span-2">{title}</h3>
      {statusOnly && <p role="status" className="text-sm text-muted-foreground sm:col-span-2">A mudança de situação cria nova versão; as anteriores e os fatos já registrados permanecem.</p>}
      <div className={`${hide} sm:col-span-2`}><F id="oname" label="Nome oficial" required defaultValue={base?.officialName} /></div>
      <div className={hide}><F id="inep" label="INEP" inputMode="numeric" defaultValue={lockedIds?.inep ?? ""} disabled={!!lockedIds?.inep} /></div>
      <div className={hide}><F id="code" label="Código da rede" defaultValue={lockedIds?.code ?? ""} disabled={!!lockedIds?.code} /></div>
      <div className={`${hide} sm:col-span-2`}><F id="addr" label="Endereço" defaultValue={base?.address ?? ""} /></div>
      <div className={hide}><F id="dist" label="Distrito" defaultValue={base?.district ?? ""} /></div>
      <div className={`grid gap-1 ${hide}`}><Label htmlFor="loc">Localização</Label>
        <select id="loc" name="loc" defaultValue={base?.locationKind ?? ""} className={selectCls}>
          <option value="">Não informada</option><option value="urbana">Urbana</option><option value="rural">Rural</option>
        </select></div>
      <div className={hide}><F id="phone" label="Telefone" defaultValue={base?.phone ?? ""} /></div>
      <div className={hide}><F id="email" label="E-mail institucional" type="email" defaultValue={base?.institutionalEmail ?? ""} /></div>
      <div className={hide}><Tri id="own" label="Prédio próprio" value={base?.ownBuilding} /></div>
      <div className={hide}><Tri id="hard" label="Difícil acesso" value={base?.hardAccess} /></div>
      <div className={hide}><F id="rooms" label="Salas de aula" type="number" min={0} defaultValue={base?.classroomCount ?? ""} /></div>
      <div className={`sm:col-span-2 ${hide}`}><AdminFields base={base} /></div>
      <div className="grid gap-1 min-w-0"><Label htmlFor="from">Vigência a partir de</Label><DateInput id="from" name="from" required /></div>
      <F id="act" label="Referência documental/fonte (opcional)" />
      {base && <div className="sm:col-span-2"><F id="just" label="Justificativa" required /></div>}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" size="sm">Registrar</Button><Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button></div>
      {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
    </form>
  );
}

function statesFromForm(f: FormData): Partial<Record<AdminField, AdminFieldState>> {
  const out: Partial<Record<AdminField, AdminFieldState>> = {};
  for (const k of ADMIN_FIELDS) {
    const m = String(f.get(`adm_mode_${k}`) ?? "manter");
    out[k] = m === "alterar" ? { mode: "alterar", value: String(f.get(`adm_val_${k}`) ?? "") } : m === "limpar" ? { mode: "limpar" } : { mode: "manter" };
  }
  return out;
}

/** Classificação administrativa: manter (herda), alterar ou limpar explicitamente; avisos nunca preenchem valores. */
function AdminFields({ base }: { base?: SchoolRecordVersion | undefined }) {
  const prev: Record<AdminField, string | null> = {
    administrative_dependency: base?.administrativeDependency ?? null,
    private_school_category: base?.privateSchoolCategory ?? null,
    partnership_public_authority: base?.partnershipPublicAuthority ?? null,
  };
  const [st, setSt] = useState<Partial<Record<AdminField, AdminFieldState>>>({});
  const warnings = adminCoherenceWarnings(resultingAdmin(prev, st));
  return (
    <fieldset className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
      <legend className="px-1 text-sm font-semibold">Classificação administrativa</legend>
      {ADMIN_FIELDS.map((k) => {
        const s = st[k] ?? { mode: "manter" as const };
        return (
          <div key={k} className="grid gap-1 min-w-0">
            <Label htmlFor={`adm_mode_${k}`}>{ADMIN_FIELD_LABEL[k]}</Label>
            <p className="text-xs text-muted-foreground break-words">{base ? `Atual: ${prev[k] ?? NI}` : NI}</p>
            <select id={`adm_mode_${k}`} name={`adm_mode_${k}`} value={s.mode} className={selectCls}
              onChange={(e) => setSt({ ...st, [k]: e.target.value === "alterar" ? { mode: "alterar", value: "" } : { mode: e.target.value as "manter" | "limpar" } })}>
              <option value="manter">{base ? "Manter valor anterior" : "Não informar"}</option>
              <option value="alterar">{base ? "Alterar" : "Informar"}</option>
              {base && prev[k] != null && <option value="limpar">Limpar</option>}
            </select>
            {s.mode === "alterar" && (
              <Input name={`adm_val_${k}`} aria-label={`Novo valor: ${ADMIN_FIELD_LABEL[k]}`} required value={s.value}
                onChange={(e) => setSt({ ...st, [k]: { mode: "alterar", value: e.target.value } })} />
            )}
          </div>
        );
      })}
      {warnings.length > 0 && (
        <ul className="grid gap-1 text-xs text-muted-foreground sm:col-span-3" role="status">
          {warnings.map((w) => <li key={w}>Atenção: {w}</li>)}
        </ul>
      )}
    </fieldset>
  );
}
