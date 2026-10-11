import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { STATUS_LABEL, fileProblem, sha256Hex, storagePath, type DocRow } from "./documents-model";
import { canReplace, currentByType, deriveAlerts, typeLabel } from "./server-portal";
import { extractPdfSuggestion } from "./docserv-files";
import { extractionRecord, requirementLabel, submissionWindow, suggestedValidUntil, type Extraction, type PolicyState, type Season } from "./docserv-rules";

const field = "h-8 rounded-md border bg-background px-2 text-sm";
const TYPES = ["antecedente_criminal", "antecedente_civil"];
type History = { versions: { version: number; size: number; mime: string; issuer: string | null; valid_until: string | null; submitted_at: string; via_school: boolean; path: string }[];
  events: { seq: number; kind: string; status: string | null; note: string | null; version: number; at: string; by_me: boolean }[] };

export async function openSigned(path: string) {
  const r = await supabase.storage.from("docserv-documentos").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (r.error || !r.data) return false;
  window.open(r.data.signedUrl, "_blank", "noopener"); return true;
}

/** "Meus documentos": só os documentos da pessoa ligada ao login. O banco recusa qualquer outra pessoa. */
export function MyDocuments({ person }: { person: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [season, setSeason] = useState(today.slice(0, 4));
  const [rows, setRows] = useState<DocRow[] | "error" | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [hist, setHist] = useState<{ id: string; data: History } | null>(null);
  const [policy, setPolicy] = useState<PolicyState | null>(null); const [seasons, setSeasons] = useState<Season[]>([]);
  useEffect(() => { void supabase.rpc("docserv_policy_current").then((r) => setPolicy(r.data as unknown as PolicyState)); void supabase.rpc("docserv_seasons_current").then((r) => setSeasons((r.data as unknown as Season[]) ?? [])); }, []);
  const win = submissionWindow(seasons, season, today);
  const load = useCallback(async () => {
    setRows(null);
    const [r, a] = await Promise.all([
      supabase.rpc("docserv_documents_at", { _person: person, _school: null, _include_deleted: true } as never),
      supabase.rpc("docserv_alert_reads_mine"),
    ]);
    setRows(r.error ? "error" : (r.data as unknown as DocRow[])); setRead((a.data as string[] | null) ?? []);
  }, [person]);
  useEffect(() => { void load(); }, [load]);

  const list = rows === null || rows === "error" ? [] : rows;
  const alerts = useMemo(() => deriveAlerts(list, today, season, TYPES).filter((a) => !read.includes(a.key)), [list, today, season, read]);
  const current = useMemo(() => currentByType(list, season), [list, season]);

  const markRead = async (key: string) => { const r = await supabase.rpc("docserv_mark_alert_read", { _key: key }); if (!r.error) setRead((x) => [...x, key]); };
  const showHistory = async (id: string) => {
    if (hist?.id === id) return setHist(null);
    const r = await supabase.rpc("docserv_document_history", { _document: id });
    if (r.error) setMsg("Histórico indisponível."); else setHist({ id, data: r.data as unknown as History });
  };

  if (rows === null) return <p className="text-xs text-muted-foreground">Carregando…</p>;
  if (rows === "error") return <p className="text-xs text-destructive">Não foi possível ler seus documentos.</p>;
  return (
    <div className="space-y-3">
      <label className="text-xs">Período <input className={`${field} w-20`} value={season} onChange={(e) => setSeason(e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Período" /></label>
      <p className="text-xs text-muted-foreground">{win.reason}</p>
      {alerts.length > 0 && <ul className="space-y-1" aria-label="Alertas">{alerts.map((a) => (
        <li key={a.key} className={`flex items-center justify-between gap-2 rounded border p-2 text-xs ${a.tone === "danger" ? "border-destructive text-destructive" : ""}`}>
          <span>{a.text}</span>{a.tone !== "info" && <Button size="sm" variant="ghost" onClick={() => void markRead(a.key)}>Marcar como lido</Button>}
        </li>))}</ul>}
      {msg && <p className="text-xs" role="status">{msg}</p>}
      <div className="grid gap-2 md:grid-cols-2">{TYPES.map((t) => {
        const d = current.get(t);
        return (
          <div key={t} className="rounded border p-2 text-xs">
            <div className="font-semibold capitalize">{typeLabel(t)}</div><div className="text-muted-foreground">{requirementLabel(policy, t)}</div>
            {d ? <>
              <div>Situação: <b>{STATUS_LABEL[d.status]}</b> · versão {d.version}{d.valid_until ? ` · validade ${d.valid_until}` : ""}</div>
              {d.note && <div>Observação do revisor: {d.note}</div>}
              <div className="mt-1 flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => void openSigned(d.path).then((ok) => !ok && setMsg("Arquivo indisponível."))}>Baixar</Button>
                <Button size="sm" variant="ghost" onClick={() => void showHistory(d.document_id)}>{hist?.id === d.document_id ? "Ocultar histórico" : "Histórico"}</Button>
              </div>
              {hist?.id === d.document_id && <HistoryView h={hist.data} />}
              {canReplace(d) && win.allowed && <Upload person={person} type={t} season={season} cycles={win.cycles} policy={policy} document={d.document_id} expected={d.version} label="Enviar substituto" onDone={(m) => { setMsg(m); void load(); }} />}
            </> : <>
              <div className="text-muted-foreground">Nenhum envio para {season}.</div>
              {win.allowed && <Upload person={person} type={t} season={season} cycles={win.cycles} policy={policy} document={null} expected={0} label="Enviar" onDone={(m) => { setMsg(m); void load(); }} />}
            </>}
          </div>);
      })}</div>
    </div>
  );
}

function HistoryView({ h }: { h: History }) {
  return (
    <ol className="mt-1 space-y-0.5 border-l pl-2">
      {h.events.map((e) => <li key={e.seq}>{e.at.slice(0, 10)} · v{e.version} · {e.kind === "enviado" ? "enviado" : e.kind === "revisado" ? `revisado: ${STATUS_LABEL[(e.status ?? "pendente_validacao") as keyof typeof STATUS_LABEL] ?? "situação não reconhecida"}` : e.kind === "excluido-logico" ? "excluído" : e.kind}{e.note ? ` — ${e.note}` : ""}{e.by_me ? " (você)" : ""}</li>)}
      {h.versions.filter((v) => v.version < (h.versions[0]?.version ?? 0)).map((v) => (
        <li key={v.version} className="text-muted-foreground">Versão anterior {v.version}: {v.submitted_at.slice(0, 10)}{v.via_school ? " (enviada pela escola)" : ""} <button className="underline" onClick={() => void openSigned(v.path)}>baixar</button></li>))}
    </ol>
  );
}

function Upload({ person, type, season, cycles, policy, document, expected, label, onDone }: { person: string; type: string; season: string; cycles: number[]; policy: PolicyState | null; document: string | null; expected: number; label: string; onDone: (m: string) => void }) {
  const [file, setFile] = useState<File | null>(null); const [issuer, setIssuer] = useState(""); const [issued, setIssued] = useState(""); const [until, setUntil] = useState(""); const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState<number | null>(cycles[0] ?? null); const [sug, setSug] = useState<Extraction | null>(null);
  const pick = async (f: File | null) => {
    setFile(f); setSug(null); if (!f) return;
    const s = await extractPdfSuggestion(f); setSug(s);
  };
  const apply = () => { if (!sug) return; if (sug.issued) setIssued(sug.issued); if (sug.validUntil) setUntil(sug.validUntil); else { const v = suggestedValidUntil(policy, type, sug.issued); if (v) setUntil(v); } if (sug.issuer) setIssuer(sug.issuer); };
  const send = async () => {
    if (!file) return onDone("Escolha o arquivo.");
    const p = fileProblem(file); if (p) return onDone(p);
    if (!/^\d{4}$/.test(season)) return onDone("Período inválido.");
    if (cycles.length && !cycle) return onDone("Escolha o ciclo.");
    setBusy(true);
    try {
      const doc = document ?? crypto.randomUUID(); const path = storagePath(person, doc, file.name);
      const sha = await sha256Hex(await file.arrayBuffer());
      const up = await supabase.storage.from("docserv-documentos").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return onDone("Envio do arquivo recusado.");
      const r = await supabase.rpc("docserv_submit_document_v2", { _document: doc, _person: person, _type: type, _season: season, _cycle: cycle, _school: null, _path: path, _sha: sha, _mime: file.type, _size: file.size, _issuer: issuer || null, _issued: issued || null, _valid_until: until || null, _extraction: extractionRecord(sug, { issued: issued || null, validUntil: until || null, issuer: issuer || null }), _expected_version: expected } as never);
      onDone(r.error ? (r.error.message.includes("stale") ? "O documento mudou; recarregado." : r.error.message.includes("dates") ? "Validade anterior à emissão." : r.error.message.includes("season") ? "Ciclo de envio fechado." : "Registro recusado.") : "Documento enviado; aguarda validação humana.");
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-1 flex flex-wrap items-end gap-1">
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => void pick(e.target.files?.[0] ?? null)} aria-label={`Arquivo ${typeLabel(type)}`} />
      {sug && sug.confidence !== "nenhuma" && <span className="rounded border px-1">Leitura do PDF sugere: {sug.issued ? `emissão ${sug.issued} ` : ""}{sug.validUntil ? `validade ${sug.validUntil} ` : ""}{sug.issuer ? `· ${sug.issuer}` : ""} <button className="underline" onClick={apply}>usar</button> — confira antes de enviar.</span>}
      {sug && sug.confidence === "nenhuma" && <span className="text-muted-foreground">Não foi possível ler datas do arquivo; preencha manualmente.</span>}
      {cycles.length > 0 && <select className={field} value={cycle ?? ""} onChange={(e) => setCycle(Number(e.target.value))} aria-label="Ciclo">{cycles.map((c) => <option key={c} value={c}>Ciclo {c}</option>)}</select>}
      <input className={field} placeholder="Emissor" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
      <label>Emissão <input type="date" className={field} value={issued} onChange={(e) => setIssued(e.target.value)} /></label>
      <label>Validade <input type="date" className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      <Button size="sm" disabled={busy} onClick={() => void send()}>{busy ? "Enviando…" : label}</Button>
    </div>
  );
}
