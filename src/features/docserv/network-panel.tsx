import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { STATUS_LABEL, reviewNeedsNote, sha256Hex } from "./documents-model";
import { typeLabel } from "./server-portal";
import { openSigned } from "./my-documents";
import { downloadZip } from "./docserv-files";
import { useServerFn } from "@tanstack/react-start";
import { purgeDocservDocument } from "./docserv-purge.functions";
import { NETWORK_REPORT, hasSecretColumns, parseIdentityCsv, reportRows, requirementLabel, type ImportRow, type PolicyState, type Season, type SchoolRow, type TypeRule } from "./docserv-rules";

import { DateInput } from "@/components/sigem/date-input";
import { LoadingState } from "@/components/sigem/states";
const field = "h-8 rounded-md border bg-background px-2 text-sm";
type Overview = {
  season: string; can_validate: boolean;
  totals: { servidores: number; "sem-envio": number; pendente: number; problema: number; valido: number; multiescola: number; escolas_sem_servidor: number };
  schools: SchoolRow[]; queue: { document_id: string; type: string; masked_name: string | null; status: string; seq: number; path: string }[];
  requests: { request_id: string; seq: number; school_id: string; kind: string; nature: string | null; state: string; reason: string; at: string; person_masked: string | null; conflict: boolean }[];
  history: { action: string; school_id: string | null; at: string; detail: Record<string, unknown> }[];
};
const st = (s: string) => STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? "situação não reconhecida";
const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };

/** Painel central da rede do DocServ (núcleo documental; não é o NEI da inclusão). */
export function NetworkPanel() {
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<Overview | "error" | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!/^\d{4}$/.test(season)) return; setData(null);
    const r = await supabase.rpc("docserv_network_overview", { _season: season });
    setData(r.error ? "error" : (r.data as unknown as Overview));
  }, [season]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void readCurrentSchoolNames().then(setNames).catch(() => setNames(new Map())); }, []);
  const fail = (m: string) => m.includes("forbidden") ? "Sem permissão." : m.includes("stale") ? "Mudou enquanto você via; recarregado." : m.includes("reason") ? "Informe o motivo (mín. 5 caracteres)." : m.includes("self-review") ? "Ninguém valida o próprio documento." : "Não foi possível concluir.";
  const review = async (doc: string, seq: number, status: string) => {
    if (reviewNeedsNote(status) && note.trim().length < 5) return setMsg("Informe a observação (mín. 5 caracteres).");
    const r = await supabase.rpc("docserv_review_document", { _document: doc, _status: status, _note: note || null, _expected_seq: seq } as never);
    setMsg(r.error ? fail(r.error.message) : "Revisão registrada."); if (!r.error) setNote(""); void load();
  };
  const answer = async (id: string, seq: number, state: string) => {
    const r = await supabase.rpc("docserv_link_request", { _request: id, _school: null, _person: null, _kind: null, _state: state, _reason: note, _expected_seq: seq } as never);
    setMsg(r.error ? fail(r.error.message) : "Resposta registrada."); if (!r.error) setNote(""); void load();
  };
  const exportAs = async (fmt: "xlsx" | "pdf") => {
    if (!data || data === "error") return;
    const res = runReport(NETWORK_REPORT, { params: { temporada: season }, sort: [{ column: "escola", dir: "asc" }] }, reportRows(data.schools, names));
    const branding = { headerLines: ["SIGEM — DocServ"], title: `${NETWORK_REPORT.title} — ${season}` };
    const meta = [`Gerado em ${new Date().toLocaleString("pt-BR")}. Contagem por pessoa: cada servidor uma vez por escola.`];
    if (fmt === "xlsx") save(new Blob([await toXlsx(res, branding, meta)]), `docserv-rede-${season}.xlsx`);
    else save(await toPdfFile(res, branding, meta, { landscape: true }), `docserv-rede-${season}.pdf`);
  };
  const chart = useMemo(() => (data && data !== "error" ? [
    { k: "Sem envio", v: data.totals["sem-envio"] }, { k: "Aguardando", v: data.totals.pendente }, { k: "Com problema", v: data.totals.problema }, { k: "Válidos", v: data.totals.valido }] : []), [data]);

  if (data === null) return <LoadingState label="Carregando…" />;
  if (data === "error") return <p className="text-xs text-destructive">Sem acesso ao painel da rede do DocServ.</p>;
  const t = data.totals;
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-end gap-2">
        <label>Temporada <input className={`${field} w-20`} value={season} onChange={(e) => setSeason(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <Button size="sm" variant="outline" onClick={() => void exportAs("xlsx")}>Planilha</Button>
        <Button size="sm" variant="outline" onClick={() => void exportAs("pdf")}>PDF</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Indicadores">
        {[["Servidores", t.servidores], ["Sem certidão criminal", t["sem-envio"]], ["Aguardando validação", t.pendente], ["Com problema", t.problema], ["Válidos", t.valido], ["Em mais de uma escola", t.multiescola], ["Escolas sem servidor vinculado", t.escolas_sem_servidor]].map(([l, v]) => (
          <div key={l as string} className="rounded border p-2"><div className="text-muted-foreground">{l}</div><div className="text-lg font-semibold">{v as number}</div></div>))}
      </div>
      {t.servidores > 0 && <div className="h-40"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="k" fontSize={10} /><YAxis allowDecimals={false} fontSize={10} /><Tooltip /><Bar dataKey="v" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></div>}
      <input className={`${field} w-full`} placeholder="Motivo / observação" value={note} onChange={(e) => setNote(e.target.value)} />
      {msg && <p role="status">{msg}</p>}

      <details open><summary className="cursor-pointer font-semibold">Escolas ({data.schools.length})</summary>
        <table className="w-full"><thead><tr className="text-left"><th scope="col">Escola</th><th scope="col">Servidores</th><th scope="col">Sem envio</th><th scope="col">Aguardando</th><th scope="col">Problema</th><th scope="col">Válidos</th></tr></thead>
          <tbody>{data.schools.map((s) => <tr key={s.school_id} className="border-t"><td>{names.get(s.school_id) ?? s.school_id}</td><td>{s.servidores}</td><td>{s.sem_envio}</td><td>{s.pendente}</td><td>{s.problema}</td><td>{s.valido}</td></tr>)}</tbody></table>
      </details>

      <details open><summary className="cursor-pointer font-semibold">Fila de validação ({data.queue.length})</summary>
        {!data.can_validate && <p className="text-muted-foreground">Sua conta acompanha a fila mas não tem permissão de validar.</p>}
        {data.queue.length > 0 && <Button size="sm" variant="ghost" onClick={() => void downloadZip(data.queue.slice(0, 50).map((q) => ({ document_id: q.document_id, path: q.path, label: `${typeLabel(q.type)}-${q.masked_name ?? "servidor"}` })), `docserv-fila-${season}.zip`).then((m) => m && setMsg(m))}>Baixar ZIP (até 50)</Button>}
        <ul>{data.queue.map((q) => <li key={q.document_id} className="border-t py-1">{q.masked_name} · {typeLabel(q.type)} · {st(q.status)} <button className="underline" onClick={() => void openSigned(q.path)}>abrir</button>
          {data.can_validate && <span className="ml-1 space-x-1"><Button size="sm" variant="outline" onClick={() => void review(q.document_id, q.seq, "valido")}>Validar</Button><Button size="sm" variant="outline" onClick={() => void review(q.document_id, q.seq, "rejeitado")}>Rejeitar</Button><Button size="sm" variant="outline" onClick={() => void review(q.document_id, q.seq, "alerta_revisao_urgente")}>Urgente</Button></span>}</li>)}</ul>
      </details>

      <details><summary className="cursor-pointer font-semibold">Solicitações abertas ({data.requests.length})</summary>
        <ul>{data.requests.map((r) => <li key={r.request_id} className="border-t py-1">{r.at.slice(0, 10)} · {names.get(r.school_id) ?? r.school_id} · {r.kind === "solicitar-vinculo" ? "vínculo" : "desvínculo"}{r.nature ? ` (${r.nature})` : ""} · {r.person_masked} — {humanizeForScreen(r.reason)}{r.conflict ? " · CONFLITO: outro pedido de titularidade aberto" : ""}
          <span className="ml-1 space-x-1"><Button size="sm" variant="outline" onClick={() => void answer(r.request_id, r.seq, "encaminhada-ao-dp")}>Encaminhar ao DP</Button><Button size="sm" variant="ghost" onClick={() => void answer(r.request_id, r.seq, "recusada")}>Recusar</Button></span></li>)}</ul>
      </details>

      <PolicyEditor onMsg={setMsg} />
      <SeasonEditor onMsg={setMsg} />
      <ImportDryRun onMsg={setMsg} />
      <PurgeBox onMsg={setMsg} />

      <details><summary className="cursor-pointer font-semibold">Histórico (últimos 200)</summary>
        <ul>{data.history.map((h, i) => <li key={i}>{h.at.slice(0, 16).replace("T", " ")} · {h.action}{h.school_id ? ` · ${names.get(h.school_id) ?? h.school_id}` : ""}</li>)}</ul>
      </details>
    </div>
  );
}

function PolicyEditor({ onMsg }: { onMsg: (m: string) => void }) {
  const [p, setP] = useState<PolicyState | null>(null); const [rules, setRules] = useState<Record<string, TypeRule>>({}); const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    const r = await supabase.rpc("docserv_policy_current"); const v = r.data as unknown as PolicyState; setP(v);
    setRules((v?.latest?.rules as Record<string, TypeRule>) ?? {});
  }, []);
  useEffect(() => { void load(); }, [load]);
  const rec = async (status: "rascunho" | "aprovada") => {
    const r = await supabase.rpc("docserv_record_policy", { _rules: rules as never, _status: status, _reason: reason, _expected_version: p?.latest?.version ?? 0 });
    onMsg(r.error ? (r.error.message.includes("reason") ? "Informe o motivo." : r.error.message.includes("forbidden") ? "Sem permissão para registrar política." : "Política recusada.") : status === "aprovada" ? "Política aprovada e vigente." : "Rascunho registrado.");
    if (!r.error) { setReason(""); void load(); }
  };
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v))));
  return (
    <details><summary className="cursor-pointer font-semibold">Política documental — {p?.approved ? `vigente: versão ${p.approved.version}` : "nenhuma aprovada (regra legada só como rascunho)"}</summary>
      <p className="text-muted-foreground">Sem política aprovada nada é obrigatório e nenhum arquivo pode ser excluído de vez. A regra do DocServ antigo está registrada como rascunho para você revisar.</p>
      {Object.entries(rules).map(([k, r]) => (
        <div key={k} className="flex flex-wrap items-center gap-2 border-t py-1">
          <b className="w-40 capitalize">{typeLabel(k)}</b> <span className="text-muted-foreground">{requirementLabel(p, k)}</span>
          <label><input type="checkbox" checked={r.obrigatorio} onChange={(e) => setRules({ ...rules, [k]: { ...r, obrigatorio: e.target.checked } })} /> obrigatório</label>
          <label>validade (meses) <input className={`${field} w-16`} value={r.validade_meses ?? ""} onChange={(e) => setRules({ ...rules, [k]: { ...r, validade_meses: num(e.target.value) } })} /></label>
          <label>aviso (dias) <input className={`${field} w-16`} value={r.aviso_dias ?? ""} onChange={(e) => setRules({ ...rules, [k]: { ...r, aviso_dias: num(e.target.value) } })} /></label>
          <label>guardar após excluir (dias) <input className={`${field} w-20`} value={r.retencao_dias ?? ""} onChange={(e) => setRules({ ...rules, [k]: { ...r, retencao_dias: num(e.target.value) } })} /></label>
        </div>))}
      <input className={`${field} w-full`} placeholder="Motivo / ato que fundamenta" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-1 space-x-1"><Button size="sm" variant="outline" onClick={() => void rec("rascunho")}>Salvar rascunho</Button><Button size="sm" onClick={() => void rec("aprovada")}>Aprovar</Button></div>
    </details>
  );
}

function SeasonEditor({ onMsg }: { onMsg: (m: string) => void }) {
  const [list, setList] = useState<Season[]>([]); const [f, setF] = useState({ year: String(new Date().getFullYear()), cycle: 1, opens: "", closes: "", reason: "" });
  const load = useCallback(async () => { const r = await supabase.rpc("docserv_seasons_current"); setList((r.data as unknown as Season[]) ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const rec = async (status: "aberta" | "encerrada", base?: Season) => {
    const s = base ?? null;
    const r = await supabase.rpc("docserv_record_season", { _year: s?.year ?? f.year, _cycle: s?.cycle ?? f.cycle, _opens: s?.opens_on ?? f.opens, _closes: s?.closes_on ?? f.closes, _status: status, _reason: f.reason, _expected_seq: s?.seq ?? (list.find((x) => x.year === f.year && x.cycle === f.cycle)?.seq ?? 0) });
    onMsg(r.error ? (r.error.message.includes("forbidden") ? "Sem permissão." : r.error.message.includes("stale") ? "Mudou; recarregado." : "Temporada recusada (confira datas e motivo).") : "Temporada registrada.");
    void load();
  };
  return (
    <details><summary className="cursor-pointer font-semibold">Temporadas de envio ({list.length})</summary>
      <p className="text-muted-foreground">Sem temporada cadastrada no ano o envio é livre. Com temporada, só se envia em ciclo aberto.</p>
      <ul>{list.map((s) => <li key={`${s.year}-${s.cycle}`}>{s.year} · ciclo {s.cycle} · {s.opens_on} a {s.closes_on} · {s.status} {s.status === "aberta" && <Button size="sm" variant="ghost" onClick={() => void rec("encerrada", s)}>Encerrar</Button>}</li>)}</ul>
      <div className="flex flex-wrap items-end gap-1">
        <input className={`${field} w-20`} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} aria-label="Ano" />
        <select className={field} value={f.cycle} onChange={(e) => setF({ ...f, cycle: Number(e.target.value) })} aria-label="Ciclo">{[1, 2, 3].map((c) => <option key={c} value={c}>Ciclo {c}</option>)}</select>
        <DateInput className={field} value={f.opens} onChange={(e) => setF({ ...f, opens: e.target.value })} aria-label="Abre" />
        <DateInput className={field} value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} aria-label="Fecha" />
        <input className={field} placeholder="Motivo" value={humanizeForScreen(f.reason)} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <Button size="sm" onClick={() => void rec("aberta")}>Abrir ciclo</Button>
      </div>
    </details>
  );
}

function ImportDryRun({ onMsg }: { onMsg: (m: string) => void }) {
  const [rows, setRows] = useState<(ImportRow & { outcome?: string })[]>([]); const [hash, setHash] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const read = async (file: File) => {
    const buf = await file.arrayBuffer(); setHash(await sha256Hex(buf));
    const p = parseIdentityCsv(new TextDecoder().decode(buf));
    setWarn([p.truncated ? "Arquivo acima de 500 linhas: só as primeiras foram lidas." : null, hasSecretColumns(p.ignoredColumns) ? "Colunas de senha/chave foram ignoradas e não são lidas." : null].filter(Boolean).join(" ") || null);
    setRows(p.rows);
  };
  const run = async (commit: boolean) => {
    setBusy(true);
    const out: typeof rows = [];
    for (const r of rows) {
      if (r.problem) { out.push(r); continue; }
      const x = await supabase.rpc("docserv_resolve_identity", { _kind: r.kind, _matricula: r.matricula, _cpf: r.cpf, _inep: r.inep, _commit: commit } as never);
      out.push({ ...r, cpf: r.cpf ? "informado" : null, outcome: x.error ? "recusado" : (x.data as { outcome: string; written: boolean }).outcome + (commit ? ((x.data as { written: boolean }).written ? " · gravado" : " · já registrado") : "") });
    }
    setRows(out); setBusy(false); onMsg(commit ? "Correspondências aplicadas (repetir não duplica)." : "Simulação concluída; nada foi gravado.");
  };
  const sum = rows.reduce((m, r) => { const k = r.problem ? "com problema" : (r.outcome ?? "não simulado").split(" · ")[0]!; m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
  return (
    <details><summary className="cursor-pointer font-semibold">Migração histórica (simulação primeiro)</summary>
      <p className="text-muted-foreground">CSV com colunas tipo, matricula, cpf, inep. Outras colunas (inclusive senhas) são ignoradas. Simular não grava; aplicar grava só a correspondência com pessoas e escolas que já existem no SIGEM.</p>
      <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
      {hash && <p>Arquivo SHA-256 {hash.slice(0, 16)}… · {rows.length} linha(s)</p>}
      {warn && <p className="text-destructive">{warn}</p>}
      {rows.length > 0 && <div className="space-x-1"><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(false)}>Simular</Button><Button size="sm" disabled={busy || !rows.some((r) => r.outcome)} onClick={() => void run(true)}>Aplicar</Button></div>}
      {Object.keys(sum).length > 0 && <p>{Object.entries(sum).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
      <ul className="max-h-48 overflow-auto">{rows.slice(0, 200).map((r) => <li key={r.line}>linha {r.line} · {r.kind} · {r.problem ?? r.outcome ?? "—"}</li>)}</ul>
    </details>
  );
}

function PurgeBox({ onMsg }: { onMsg: (m: string) => void }) {
  const purge = useServerFn(purgeDocservDocument);
  const [doc, setDoc] = useState(""); const [reason, setReason] = useState("");
  const go = async () => {
    const r = await purge({ data: { document: doc, reason } }).catch(() => ({ ok: false as const, error: "falha" }));
    onMsg(r.ok ? `Arquivo(s) apagado(s) de vez: ${r.removed}. O registro e o hash continuam.` : r.error.includes("retention-undecided") ? "Sem prazo de guarda aprovado na política: não é possível apagar de vez." : r.error.includes("retention-not-reached") ? "O prazo de guarda ainda não terminou." : r.error.includes("not-deleted") ? "Exclua o documento antes (exclusão comum)." : "Exclusão permanente recusada.");
  };
  return (
    <details><summary className="cursor-pointer font-semibold">Exclusão permanente (sob prazo de guarda)</summary>
      <p className="text-muted-foreground">Só para documento já excluído, com prazo de guarda aprovado e cumprido. Apaga o arquivo; o registro e o hash ficam como prova.</p>
      <div className="flex flex-wrap gap-1"><input className={field} placeholder="Código do documento" value={doc} onChange={(e) => setDoc(e.target.value.trim())} /><input className={field} placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="destructive" disabled={!/^[0-9a-f-]{36}$/.test(doc) || reason.trim().length < 5} onClick={() => void go()}>Apagar de vez</Button></div>
    </details>
  );
}
