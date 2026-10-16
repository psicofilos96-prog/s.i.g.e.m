import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, fileProblem, reviewNeedsNote, sha256Hex, storagePath } from "./documents-model";
import { typeLabel } from "./server-portal";
import { openSigned } from "./my-documents";
import { downloadZip } from "./docserv-files";
import { TYPES, applyFilter, counters, linkLabel, validationQueue, type Filter, type Roster, type RosterPerson } from "./school-portal";

import { DateInput } from "@/components/sigem/date-input";
import { LoadingState } from "@/components/sigem/states";
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const FILTERS: { v: Filter; l: string }[] = [{ v: "todos", l: "Todos" }, { v: "sem-envio", l: "Sem envio" }, { v: "pendente", l: "Aguardando validação" }, { v: "problema", l: "Rejeitado/vencido/urgente" }, { v: "valido", l: "Válido" }];
const REQ_STATE: Record<string, string> = { aberta: "aberta", "encaminhada-ao-dp": "encaminhada ao DP", recusada: "recusada", cancelada: "cancelada" };
const st = (s: string) => STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? "situação não reconhecida";

/** Painel DocServ da escola: servidores vinculados (atuação OU lotação vigente), certidões, envio assistido, fila e solicitações. */
export function SchoolDocsPanel({ school }: { school: string }) {
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<Roster | "error" | null>(null);
  const [filter, setFilter] = useState<Filter>("todos"); const [q, setQ] = useState("");
  const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<RosterPerson | null>(null);
  const load = useCallback(async () => {
    if (!/^\d{4}$/.test(season)) return; setData(null);
    const r = await supabase.rpc("docserv_school_roster", { _school: school, _season: season });
    setData(r.error ? "error" : (r.data as unknown as Roster));
  }, [school, season]);
  useEffect(() => { void load(); }, [load]);
  const c = useMemo(() => (data && data !== "error" ? counters(data) : null), [data]);
  const list = useMemo(() => (data && data !== "error" ? applyFilter(data, filter, q) : []), [data, filter, q]);
  const queue = useMemo(() => (data && data !== "error" ? validationQueue(data) : []), [data]);
  const fail = (m: string) => m.includes("forbidden") ? "Sem permissão para esta ação." : m.includes("stale") ? "Mudou enquanto você via; recarregado." : m.includes("reason") ? "Informe o motivo (mín. 5 caracteres)." : m.includes("self-review") ? "Ninguém valida o próprio documento." : m.includes("conflict-titular") ? "Já há pedido de titularidade aberto em outra escola." : m.includes("conflict") ? "Já existe pedido aberto igual." : m.includes("already") ? "Servidor já vinculado à escola." : m.includes("not-linked") ? "Servidor não está vinculado à escola." : "Não foi possível concluir.";

  const review = async (doc: string, seq: number, status: string) => {
    if (reviewNeedsNote(status) && note.trim().length < 5) return setMsg("Informe a observação (mín. 5 caracteres).");
    const r = await supabase.rpc("docserv_review_document", { _document: doc, _status: status, _note: note || null, _expected_seq: seq } as never);
    setMsg(r.error ? fail(r.error.message) : "Revisão registrada."); if (!r.error) setNote(""); void load();
  };
  const [nature, setNature] = useState("nao-informado");
  const request = async (person: string, kind: string) => {
    const r = await supabase.rpc("docserv_link_request_v2", { _request: crypto.randomUUID(), _school: school, _person: person, _kind: kind, _nature: kind === "solicitar-vinculo" ? nature : null, _state: "aberta", _reason: note, _expected_seq: 0 } as never);
    setMsg(r.error ? fail(r.error.message) : "Solicitação registrada e encaminhada à rede."); if (!r.error) setNote(""); void load();
  };
  const cancel = async (id: string, seq: number) => {
    const r = await supabase.rpc("docserv_link_request", { _request: id, _school: school, _person: null, _kind: null, _state: "cancelada", _reason: note, _expected_seq: seq } as never);
    setMsg(r.error ? fail(r.error.message) : "Solicitação cancelada."); if (!r.error) setNote(""); void load();
  };

  const confirmAnnual = async () => {
    const r = await supabase.rpc("docserv_snapshot_school", { _school: school, _season: season, _cycle: null, _kind: "confirmacao-anual", _reason: note || "Confirmação anual de vínculos" } as never);
    setMsg(r.error ? fail(r.error.message) : "Vínculos do ano confirmados (fotografia registrada)."); void load();
  };
  const zip = async () => {
    if (!data || data === "error") return;
    const items = data.people.flatMap((p) => TYPES.flatMap((t) => (p.docs[t] ? [{ document_id: p.docs[t]!.document_id, path: p.docs[t]!.path, label: `${typeLabel(t)}-${p.masked_name ?? "servidor"}` }] : [])));
    const m = await downloadZip(items, `docserv-${school}-${season}.zip`); if (m) setMsg(m);
  };
  if (data === null) return <LoadingState label="Carregando…" />;
  if (data === "error") return <p className="text-xs text-destructive">Não foi possível ler os servidores desta escola.</p>;
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-end gap-2">
        <label>Período <input className={`${field} w-20`} value={season} onChange={(e) => setSeason(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <select className={field} value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filtro">{FILTERS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</select>
        <input className={field} placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => void confirmAnnual()}>Confirmar vínculos do ano</Button>
        <Button size="sm" variant="outline" onClick={() => void zip()}>Baixar ZIP</Button>
      </div>
      {c && <p aria-label="Contadores">{c.servidores} servidores vinculados · {c["sem-envio"]} sem certidão criminal · {c.pendente} aguardando validação · {c.problema} com problema · {c.valido} válidos · {c.multiplos} com mais de um vínculo{data.staff_records_without_person > 0 ? ` · ${data.staff_records_without_person} registros de pessoal ainda sem pessoa conciliada (fora da lista)` : ""}</p>}
      <input className={`${field} w-full`} placeholder="Motivo / observação (obrigatório para rejeitar, alertar e solicitar)" value={note} onChange={(e) => setNote(e.target.value)} />
      {msg && <p role="status">{msg}</p>}

      {list.length === 0 ? <p className="text-muted-foreground">Nenhum servidor neste filtro.</p> : (
        <table className="w-full"><thead><tr className="text-left"><th scope="col">Servidor</th><th scope="col">Vínculo</th>{TYPES.map((t) => <th scope="col" key={t} className="capitalize">{typeLabel(t)}</th>)}<th scope="col" /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.person_id} className="border-t align-top">
              <td>{p.masked_name ?? "sem nome"}{p.other_schools > 0 ? ` (+${p.other_schools} escola${p.other_schools > 1 ? "s" : ""})` : ""}</td>
              <td>{linkLabel(p)}</td>
              {TYPES.map((t) => { const d = p.docs[t]; return <td key={t}>{d ? <><span>{st(d.status)}</span>{d.by_school ? " (pela escola)" : ""} <button className="underline" onClick={() => void openSigned(d.path).then((ok) => !ok && setMsg("Arquivo indisponível."))}>abrir</button></> : <span className="text-muted-foreground">sem envio</span>}</td>; })}
              <td className="space-x-1 whitespace-nowrap"><Button size="sm" variant="outline" onClick={() => setSel(p)}>Enviar</Button><Button size="sm" variant="ghost" onClick={() => void request(p.person_id, "solicitar-desvinculo")}>Pedir desvínculo</Button></td>
            </tr>))}</tbody></table>)}

      {sel && <AssistedUpload school={school} person={sel} season={season} onDone={(m) => { setMsg(m); setSel(null); void load(); }} />}

      <section className="rounded border p-2"><h3 className="font-semibold">Fila de validação</h3>
        {!data.can_validate ? <p className="text-muted-foreground">Esta escola não tem permissão para validar certidões; a validação fica com quem tiver essa permissão.</p>
          : queue.length === 0 ? <p className="text-muted-foreground">Nada aguardando.</p>
          : <ul className="space-y-1">{queue.map((x) => <li key={x.doc.document_id}>{x.person.masked_name} · {typeLabel(x.type)} · {st(x.doc.status)}
              <Button size="sm" variant="outline" className="ml-1" onClick={() => void review(x.doc.document_id, x.doc.seq, "valido")}>Validar</Button>
              <Button size="sm" variant="outline" className="ml-1" onClick={() => void review(x.doc.document_id, x.doc.seq, "rejeitado")}>Rejeitar</Button>
              <Button size="sm" variant="outline" className="ml-1" onClick={() => void review(x.doc.document_id, x.doc.seq, "alerta_revisao_urgente")}>Urgente</Button></li>)}</ul>}
      </section>

      <section className="rounded border p-2"><h3 className="font-semibold">Solicitações de vínculo</h3>
        <p className="text-muted-foreground">A escola pede; a rede encaminha ao Departamento Pessoal, que registra o vínculo. O pedido sozinho não vincula ninguém.</p>
        <select className={field} value={nature} onChange={(e) => setNature(e.target.value)} aria-label="Natureza do vínculo"><option value="nao-informado">Natureza não informada</option><option value="titular">Titular</option><option value="dobra">Dobra</option><option value="ajt">AJT</option></select>
        <RequestLink onPick={(person) => void request(person, "solicitar-vinculo")} />
        {data.requests.length === 0 ? <p className="text-muted-foreground">Nenhuma solicitação.</p> : <ul>{data.requests.map((r) => <li key={r.request_id}>{r.at.slice(0, 10)} · {r.kind === "solicitar-vinculo" ? "vínculo" : "desvínculo"} · {r.person_masked} · {REQ_STATE[r.state] ?? "situação não reconhecida"} — {humanizeForScreen(r.reason)}
          {r.state === "aberta" && <Button size="sm" variant="ghost" onClick={() => void cancel(r.request_id, r.seq)}>Cancelar</Button>}</li>)}</ul>}
      </section>
    </div>
  );
}

function RequestLink({ onPick }: { onPick: (person: string) => void }) {
  const [id, setId] = useState("");
  return <div className="my-1 flex gap-1"><input className={field} placeholder="Código da pessoa no cadastro" value={id} onChange={(e) => setId(e.target.value.trim())} /><Button size="sm" variant="outline" disabled={!/^[0-9a-f-]{36}$/.test(id)} onClick={() => onPick(id)}>Solicitar vínculo</Button></div>;
}

function AssistedUpload({ school, person, season, onDone }: { school: string; person: RosterPerson; season: string; onDone: (m: string) => void }) {
  const [type, setType] = useState<string>("antecedente_criminal"); const [file, setFile] = useState<File | null>(null);
  const [issuer, setIssuer] = useState(""); const [issued, setIssued] = useState(""); const [until, setUntil] = useState(""); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!file) return onDone("Escolha o arquivo."); const pr = fileProblem(file); if (pr) return onDone(pr);
    setBusy(true);
    try {
      const cur = person.docs[type]; const replace = cur && cur.status !== "valido";
      const doc = replace ? cur.document_id : crypto.randomUUID(); const path = storagePath(person.person_id, doc, file.name);
      const up = await supabase.storage.from("docserv-documentos").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return onDone("Envio do arquivo recusado.");
      const r = await supabase.rpc("docserv_submit_document_v2", { _document: doc, _person: person.person_id, _type: type, _season: season, _cycle: null, _school: school, _path: path, _sha: await sha256Hex(await file.arrayBuffer()), _mime: file.type, _size: file.size, _issuer: issuer || null, _issued: issued || null, _valid_until: until || null, _extraction: null, _expected_version: replace ? cur.version : 0 } as never);
      onDone(r.error ? "Registro recusado." : "Documento enviado pela escola; aguarda validação.");
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-end gap-1 rounded border p-2">
      <span>Enviar para {person.masked_name}:</span>
      <select className={field} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</select>
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input className={field} placeholder="Emissor" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
      <label>Emissão <DateInput className={field} value={issued} onChange={(e) => setIssued(e.target.value)} /></label>
      <label>Validade <DateInput className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      <Button size="sm" disabled={busy} onClick={() => void send()}>{busy ? "Enviando…" : "Enviar"}</Button>
    </div>
  );
}
