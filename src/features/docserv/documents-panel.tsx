import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, fileProblem, reviewNeedsNote, sha256Hex, storagePath, type DocRow } from "./documents-model";

const field = "h-8 rounded-md border bg-background px-2 text-sm";
const TYPES = [{ code: "antecedente_criminal", label: "Antecedentes criminais" }, { code: "antecedente_civil", label: "Antecedentes cíveis (complementar)" }];

/** Lista + envio + revisão. Quem vê e quem revisa é decidido no banco; a tela só mostra o que veio. */
export function DocumentsPanel({ mode, person, school }: { mode: "servidor" | "escola" | "rede"; person?: string | undefined; school?: string | undefined }) {
  const [rows, setRows] = useState<DocRow[] | "error" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    setRows(null);
    const r = await supabase.rpc("docserv_documents_at", { _person: mode === "servidor" ? person ?? null : null, _school: mode === "escola" ? school ?? null : null, _include_deleted: false } as never);
    setRows(r.error ? "error" : (r.data as unknown as DocRow[]));
  }, [mode, person, school]);
  useEffect(() => { void load(); }, [load]);

  const err = (m: string) => m.includes("forbidden") ? "Sem permissão para esta ação." : m.includes("stale") ? "O documento mudou; recarregado." : m.includes("reason") ? "Informe a observação (mín. 5 caracteres)." : m.includes("self-review") ? "Ninguém valida o próprio documento." : "Não foi possível concluir.";

  const open = async (d: DocRow) => {
    const r = await supabase.storage.from("docserv-documentos").createSignedUrl(d.path, 60);
    if (r.error || !r.data) { setMsg("Arquivo indisponível para você."); return; }
    window.open(r.data.signedUrl, "_blank", "noopener");
  };
  const review = async (d: DocRow, status: string) => {
    if (reviewNeedsNote(status) && note.trim().length < 5) { setMsg("Informe a observação (mín. 5 caracteres)."); return; }
    const r = await supabase.rpc("docserv_review_document", { _document: d.document_id, _status: status, _note: note || null, _expected_seq: d.seq } as never);
    setMsg(r.error ? err(r.error.message) : "Revisão registrada."); if (!r.error) setNote(""); void load();
  };
  const remove = async (d: DocRow) => {
    const r = await supabase.rpc("docserv_delete_document", { _document: d.document_id, _reason: note, _expected_seq: d.seq } as never);
    setMsg(r.error ? err(r.error.message) : "Documento excluído (fica no histórico)."); if (!r.error) setNote(""); void load();
  };

  return (
    <div className="space-y-2">
      {person && <UploadForm person={person} school={mode === "escola" ? school ?? null : null} onDone={(m) => { setMsg(m); void load(); }} />}
      {msg && <p className="text-xs" role="status">{msg}</p>}
      {mode !== "servidor" && <input className={`${field} w-full`} placeholder="Observação (obrigatória para rejeitar, alertar ou excluir)" value={note} onChange={(e) => setNote(e.target.value)} />}
      {rows === null ? <p className="text-xs text-muted-foreground">Carregando…</p> : rows === "error" ? <p className="text-xs text-destructive">Não foi possível ler os documentos.</p> : rows.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum documento.</p> : (
        <ul className="space-y-1 text-xs">{rows.map((d) => (
          <li key={d.document_id} className="rounded border p-2">
            <div><b>{TYPES.find((t) => t.code === d.type)?.label ?? d.type}</b> · {d.season} · {STATUS_LABEL[d.status]} · versão {d.version}{mode !== "servidor" && d.masked_name ? ` · ${d.masked_name}` : ""}</div>
            <div className="text-muted-foreground">{d.issuer ? `Emissor: ${d.issuer} · ` : ""}{d.valid_until ? `Validade: ${d.valid_until} · ` : ""}Enviado em {d.submitted_at.slice(0, 10)} · {(d.size / 1024).toFixed(0)} KB · SHA-256 {d.sha256.slice(0, 12)}…</div>
            {d.note && <div>Observação: {d.note}</div>}
            <div className="mt-1 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => void open(d)}>Abrir</Button>
              {mode !== "servidor" && <>
                <Button size="sm" variant="outline" onClick={() => void review(d, "valido")}>Validar</Button>
                <Button size="sm" variant="outline" onClick={() => void review(d, "rejeitado")}>Rejeitar</Button>
                <Button size="sm" variant="outline" onClick={() => void review(d, "alerta_revisao_urgente")}>Revisão urgente</Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(d)}>Excluir</Button>
              </>}
            </div>
          </li>))}</ul>)}
    </div>
  );
}

function UploadForm({ person, school, onDone }: { person: string; school: string | null; onDone: (m: string) => void }) {
  const [type, setType] = useState("antecedente_criminal"); const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [issuer, setIssuer] = useState(""); const [issued, setIssued] = useState(""); const [until, setUntil] = useState("");
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!file) return onDone("Escolha o arquivo.");
    const p = fileProblem(file); if (p) return onDone(p);
    setBusy(true);
    try {
      const doc = crypto.randomUUID(); const path = storagePath(person, doc, file.name);
      const sha = await sha256Hex(await file.arrayBuffer());
      const up = await supabase.storage.from("docserv-documentos").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return onDone("Envio do arquivo recusado.");
      const r = await supabase.rpc("docserv_submit_document", { _document: doc, _person: person, _type: type, _season: season, _school: school, _path: path, _sha: sha, _mime: file.type, _size: file.size, _issuer: issuer || null, _issued: issued || null, _valid_until: until || null, _expected_version: 0 } as never);
      onDone(r.error ? "Registro do documento recusado." : "Documento enviado; aguarda validação.");
      if (!r.error) setFile(null);
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-end gap-2 rounded border p-2">
      <select className={field} value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">{TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}</select>
      <input className={`${field} w-20`} value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Temporada" />
      <input className={field} placeholder="Emissor" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
      <label className="text-xs">Emissão <input type="date" className={field} value={issued} onChange={(e) => setIssued(e.target.value)} /></label>
      <label className="text-xs">Validade <input type="date" className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
      <Button size="sm" disabled={busy} onClick={() => void send()}>{busy ? "Enviando…" : "Enviar"}</Button>
    </div>
  );
}
