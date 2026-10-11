import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Source = { id: string; reference_year: string; table_key: string; title: string; file_name: string; sheet_name: string; file_sha256: string; in_package: boolean; row_count: number; extracted_count: number; notes: string | null; recorded_at: string };
type Code = { code: string; label: string | null; parent_code: string | null; row_no: number };
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const RESULT: Record<string, string> = { permitido: "Permitido pela tabela", "nao-previsto": "Não previsto na tabela", "nao-habilitado": "Etapa não habilitada", "nao-pertence": "Não pertence", existe: "Código existe", inexistente: "Código inexistente", "sem-tabela-do-ano": "Sem tabela deste ano (outro ano não é aplicado)" };

/** Inspeção das tabelas auxiliares (fonte documental; não é homologação de leiaute). */
export function AuxTablesPanel({ year }: { year: string }) {
  const [sources, setSources] = useState<Source[] | "error" | null>(null);
  const [sel, setSel] = useState<string>(""); const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  const [codes, setCodes] = useState<Code[]>([]);
  const [chk, setChk] = useState({ kind: "transtorno-recurso", a: "", b: "", c: "" }); const [res, setRes] = useState<string | null>(null);
  useEffect(() => { void supabase.from("educacenso_aux_sources").select("*").order("table_key").then((r) => setSources(r.error ? "error" : (r.data as Source[]))); }, []);
  useEffect(() => {
    const s = Array.isArray(sources) ? sources.find((x) => x.id === sel) : null; if (!s) { setCodes([]); return; }
    let b = supabase.from("educacenso_aux_codes").select("code,label,parent_code,row_no").eq("source_id", s.id).order("row_no").range(page * 50, page * 50 + 49);
    if (q.trim()) b = b.or(`code.eq.${q.trim().replace(/[,()]/g, "")},label.ilike.%${q.trim().replace(/[,()%]/g, "")}%`);
    void b.then((r) => setCodes((r.data ?? []) as Code[]));
  }, [sel, q, page, sources]);
  const check = async () => {
    const r = await supabase.rpc("educacenso_aux_check", { _year: year, _kind: chk.kind, _a: chk.a, ...(chk.b ? { _b: chk.b } : {}), ...(chk.c ? { _c: chk.c } : {}) });
    setRes(r.error ? "Não foi possível conferir." : `${RESULT[(r.data as { result: string }).result] ?? (r.data as { result: string }).result}`);
  };
  if (sources === null) return <section className="rounded-md border p-3"><p role="status" className="text-xs">Carregando tabelas auxiliares…</p></section>;
  if (sources === "error") return null;
  return (
    <section className="rounded-md border p-3" aria-label="Tabelas auxiliares">
      <h2 className="text-sm font-semibold">Tabelas auxiliares do Censo Escolar</h2>
      <p className="mb-2 text-xs text-muted-foreground">Catálogos e regras carregados dos arquivos do INEP enviados à rede, com impressão digital (SHA-256), ano e origem. São fonte de códigos e validação; não homologam leiaute nem importação.</p>
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead><tr className="text-left"><th scope="col">Tabela</th><th scope="col">Ano</th><th scope="col">Linhas</th><th scope="col">Códigos/regras</th><th scope="col">Pacote RAR</th><th scope="col">SHA-256</th><th scope="col" /></tr></thead>
        <tbody>{sources.map((s) => <tr key={s.id} className="border-t">
          <td title={s.file_name + " · " + s.sheet_name}>{s.title}{s.notes ? <div className="text-muted-foreground">{s.notes}</div> : null}</td><td>{s.reference_year}</td><td>{s.row_count}</td><td>{s.extracted_count}</td>
          <td>{s.in_package ? "idêntico ao avulso" : "só avulso"}</td><td className="font-mono">{s.file_sha256.slice(0, 12)}…</td>
          <td><button type="button" className="underline" onClick={() => { setSel(s.id); setPage(0); }}>Ver</button></td></tr>)}</tbody>
      </table></div>
      {sel && <div className="mt-3">
        <input aria-label="Buscar código ou nome" placeholder="Código exato ou parte do nome" className={field} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <table className="mt-2 w-full text-xs"><thead><tr className="text-left"><th scope="col">Linha</th><th scope="col">Código</th><th scope="col">Nome</th><th scope="col">Superior</th></tr></thead>
          <tbody>{codes.map((c) => <tr key={c.row_no}><td>{c.row_no}</td><td className="font-mono">{c.code}</td><td>{c.label}</td><td className="font-mono">{c.parent_code ?? "—"}</td></tr>)}</tbody></table>
        {codes.length === 0 && <p className="text-xs text-muted-foreground">Esta tabela guarda regras, não códigos, ou a busca não encontrou nada.</p>}
        <div className="mt-1 flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={codes.length < 50} onClick={() => setPage(page + 1)}>Próxima</Button></div>
      </div>}
      <div className="mt-3 rounded-md border p-2"><h3 className="text-xs font-semibold">Conferência cruzada (ano {year})</h3>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <select aria-label="Tipo de conferência" className={field} value={chk.kind} onChange={(e) => setChk({ ...chk, kind: e.target.value })}>
            <option value="transtorno-recurso">Transtorno × recurso</option><option value="deficiencia-recurso">Deficiência × recurso</option>
            <option value="etapa-tipo-turma">Mediação × tipo de turma × etapa</option><option value="distrito-municipio">Distrito × município</option>
            <option value="orgao-municipio">Órgão regional × município</option></select>
          <input aria-label="Valor A" placeholder={chk.kind === "etapa-tipo-turma" ? "Mediação" : chk.kind.endsWith("municipio") ? "Código" : "Transtorno/deficiência"} className={field} value={chk.a} onChange={(e) => setChk({ ...chk, a: e.target.value })} />
          <input aria-label="Valor B" placeholder={chk.kind === "etapa-tipo-turma" ? "Tipo de turma" : chk.kind.endsWith("municipio") ? "Código do município" : "Recurso"} className={field} value={chk.b} onChange={(e) => setChk({ ...chk, b: e.target.value })} />
          {chk.kind === "etapa-tipo-turma" && <input aria-label="Etapa" placeholder="Código da etapa" className={field} value={chk.c} onChange={(e) => setChk({ ...chk, c: e.target.value })} />}
          <Button size="sm" onClick={() => void check()}>Conferir</Button>
        </div>
        {res && <p role="status" className="mt-1 text-xs">{res}</p>}
      </div>
    </section>
  );
}
