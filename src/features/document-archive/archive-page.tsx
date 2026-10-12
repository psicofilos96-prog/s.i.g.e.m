/** ACV.1 — Acervo Documental. Nada é lido antes da sessão; toda leitura pela RLS; toda escrita por acv_*. */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PageHeader } from "@/components/sigem/patterns";
import { askText, confirmAction } from "@/components/sigem/confirm-action";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { AbsenceState, ErrorState, LoadingState } from "@/components/sigem/states";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { STATION_LABEL } from "@/features/authority/station-navigation";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { supabase } from "@/integrations/supabase/client";
import { NetworkArchivePanel, ShareDialog, SpaceAdminPanel } from "./archive-admin";
import { breadcrumbs, can, checkFile, listChildren, previewKind, reasonText, sha256Hex, type ArchiveNode, type SortKey } from "./archive-core";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any; storage: typeof supabase.storage };
const BUCKET = "acervo-documental";
const key = () => crypto.randomUUID();
const errMsg = (e: unknown) => reasonText(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "");

interface Space { id: string; station_code: string; school_id: string | null; quota_bytes: number | null }
interface Version { id: string; node_id: string; version: number; storage_path: string; mime: string; size_bytes: number; created_at: string }
type UploadRow = { name: string; state: "verificando" | "reservando" | "enviando" | "confirmando" | "concluido" | "erro"; detail?: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await db.rpc(fn, args);
  if (r.error) throw r.error;
  return r.data as T;
}

export function ArchivePage() {
  const auth = useSessionAuthority();
  if (auth.status === "signed-out") return <SignInRequired title="Acervo Documental" what="as pastas e arquivos do seu setor" />;
  if (auth.status === "loading") return auth.error ? <ErrorState description={auth.error} /> : <LoadingState />;
  return <ArchiveWorkspace isSector={!!auth.principal} />;
}

function ArchiveWorkspace({ isSector }: { isSector: boolean }) {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [rank, setRank] = useState(0);
  const [nodes, setNodes] = useState<ArchiveNode[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState<string | null>(null);
  const [view, setView] = useState<"pastas" | "favoritos" | "lixeira">("pastas");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"" | "pasta" | "arquivo">("");
  const [sort, setSort] = useState<SortKey>("nome");
  const [asc, setAsc] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [preview, setPreview] = useState<{ name: string; kind: string; url?: string; text?: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [sharing, setSharing] = useState<ArchiveNode | null>(null);

  const loadSpaces = useCallback(async () => {
    try {
      if (isSector) await rpc("acv_ensure_space", {});
      const r = await db.from("acv_spaces").select("id, station_code, school_id, quota_bytes").order("station_code");
      if (r.error) throw r.error;
      setSpaces(r.data);
      setSpaceId((cur) => cur ?? r.data[0]?.id ?? null);
    } catch (e) { setError(errMsg(e)); setSpaces([]); }
  }, [isSector]);

  const loadSpace = useCallback(async (id: string) => {
    try {
      const [n, v, f, rk] = await Promise.all([
        db.from("acv_nodes").select("id, parent_id, kind, name, updated_at, trashed_at, current_version").eq("space_id", id).limit(1000),
        db.from("acv_file_versions").select("id, node_id, version, storage_path, mime, size_bytes, created_at").limit(1000),
        db.from("acv_favorites").select("node_id"),
        db.rpc("acv_space_rank", { _space: id }),
      ]);
      for (const r of [n, v, f, rk]) if (r.error) throw r.error;
      const vs: Version[] = v.data;
      setVersions(vs);
      setNodes(n.data.map((x: any) => {
        const cur = vs.find((y) => y.node_id === x.id && y.version === x.current_version);
        return { id: x.id, parentId: x.parent_id, kind: x.kind, name: x.name, updatedAt: x.updated_at, trashedAt: x.trashed_at, mime: cur?.mime ?? null, size: cur?.size_bytes ?? null };
      }));
      setFavs(new Set(f.data.map((x: any) => x.node_id)));
      setRank(rk.data ?? 0);
    } catch (e) { setError(errMsg(e)); }
  }, []);

  useEffect(() => { void loadSpaces(); }, [loadSpaces]);
  useEffect(() => { if (spaceId) { setFolder(null); void loadSpace(spaceId); } }, [spaceId, loadSpace]);

  const refresh = () => spaceId && loadSpace(spaceId);
  const act = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setError(null);
    try { await rpc(fn, { ...args, _key: key() }); setNotice(ok); await refresh(); } catch (e) { setError(errMsg(e)); }
  };

  const crumbs = useMemo(() => breadcrumbs(nodes, folder), [nodes, folder]);
  const rows = useMemo(() => {
    if (view === "lixeira") return nodes.filter((n) => n.trashedAt);
    if (view === "favoritos") return nodes.filter((n) => favs.has(n.id) && !n.trashedAt);
    return listChildren(nodes, folder, { query, kind }, sort, asc);
  }, [nodes, folder, query, kind, sort, asc, view, favs]);
  const folders = useMemo(() => nodes.filter((n) => n.kind === "pasta" && !n.trashedAt), [nodes]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!spaceId) return;
    const list = [...files];
    setUploads(list.map((f) => ({ name: f.name, state: "verificando" })));
    const set = (i: number, patch: Partial<UploadRow>) => setUploads((u) => u.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!;
      try {
        const buf = await file.arrayBuffer();
        const check = checkFile(file.name, file.size, new Uint8Array(buf.slice(0, 64)));
        if (!check.ok) throw { message: check.reason };
        const sha = await sha256Hex(buf);
        set(i, { state: "reservando" });
        const idem = `up:${spaceId}:${folder ?? "raiz"}:${file.name}:${sha}`;
        const res = await rpc<{ upload_id: string; storage_path: string }[]>("acv_begin_upload", { _key: idem, _space: spaceId, _parent: folder, _node: null, _name: file.name, _sha: sha, _size: file.size, _mime: check.mime });
        const slot = res[0]!;
        set(i, { state: "enviando" });
        const up = await db.storage.from(BUCKET).upload(slot.storage_path, file, { contentType: check.mime, upsert: false });
        if (up.error && !/exists|duplicate/i.test(up.error.message)) throw up.error; // retomada: objeto já enviado ⇒ só confirma
        set(i, { state: "confirmando" });
        await rpc("acv_commit_upload", { _upload: slot.upload_id });
        set(i, { state: "concluido" });
      } catch (e) { set(i, { state: "erro", detail: errMsg(e) }); }
    }
    await refresh();
  };

  const currentVersion = (n: ArchiveNode) => versions.filter((v) => v.node_id === n.id).sort((a, b) => b.version - a.version)[0];
  const signed = async (n: ArchiveNode) => {
    const v = currentVersion(n);
    if (!v) throw { message: "indisponivel" };
    await rpc("acv_log_download", { _version: v.id });
    const r = await db.storage.from(BUCKET).createSignedUrl(v.storage_path, SIGNED_URL_TTL_SECONDS, { download: n.name });
    if (r.error) throw r.error;
    return { url: r.data.signedUrl, v };
  };
  const download = async (n: ArchiveNode) => { try { const { url } = await signed(n); window.location.assign(url); } catch (e) { setError(errMsg(e)); } };
  const openPreview = async (n: ArchiveNode) => {
    const k = previewKind(n.mime ?? "");
    if (k === "nenhuma") { setNotice("Este formato não tem pré-visualização segura; use Baixar."); return; }
    try {
      const v = currentVersion(n)!;
      await rpc("acv_log_download", { _version: v.id });
      const r = await db.storage.from(BUCKET).createSignedUrl(v.storage_path, SIGNED_URL_TTL_SECONDS);
      if (r.error) throw r.error;
      if (k === "texto") { const t = await (await fetch(r.data.signedUrl)).text(); setPreview({ name: n.name, kind: k, text: t.slice(0, 200_000) }); }
      else setPreview({ name: n.name, kind: k, url: r.data.signedUrl });
    } catch (e) { setError(errMsg(e)); }
  };
  const toggleFav = async (n: ArchiveNode) => {
    const r = favs.has(n.id) ? await db.from("acv_favorites").delete().eq("node_id", n.id) : await db.from("acv_favorites").insert({ node_id: n.id });
    if (r.error) setError(errMsg(r.error)); else await refresh();
  };
  const ask = async (msg: string, def = "") => { const v = await askText(msg, def); return v === null ? null : v.trim(); };
  const pickTarget = async (n: ArchiveNode): Promise<string | null | undefined> => {
    const opts = folders.filter((f) => f.id !== n.id);
    const txt = ["0 — Raiz do acervo", ...opts.map((f, i) => `${i + 1} — ${breadcrumbs(nodes, f.id).map((x) => x.name).join(" / ")}`)].join("\n");
    const v = await ask(`Destino (número):\n${txt}`, "0");
    if (v === null) return undefined;
    const i = Number(v);
    return i === 0 ? null : opts[i - 1]?.id;
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length && can(rank, "enviar")) void uploadFiles(e.dataTransfer.files); };

  if (spaces === null) return <LoadingState />;
  const space = spaces.find((s) => s.id === spaceId);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <PageHeader title="Acervo Documental" description="Pastas e arquivos do setor. Arquivos aqui não são documentos oficiais assinados; o acesso é verificado pelo servidor a cada ação." />
      {spaceId && rank >= 7 && <SpaceAdminPanel spaceId={spaceId} />}
      {!isSector && <NetworkArchivePanel />}
      {spaceId && <ShareDialog node={sharing} spaceId={spaceId} onClose={() => setSharing(null)} />}
      {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-md border border-border bg-muted p-3 text-sm">{notice}</div>}
      {spaces.length === 0 ? (
        <AbsenceState kind="sem-permissao" description="Nenhum acervo disponível para a sua conta. O acervo de um setor é aberto pela conta do setor, que concede acesso aos servidores." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0 text-sm">
              <span className="sr-only">Acervo</span>
              <select value={spaceId ?? ""} onChange={(e) => setSpaceId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">
                {spaces.map((s) => <option key={s.id} value={s.id}>{(STATION_LABEL as Record<string, string>)[s.station_code] ?? s.station_code}{s.school_id ? ` · ${s.school_id}` : " · Rede"}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Visualização">
              {(["pastas", "favoritos", "lixeira"] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md border px-3 py-2 text-sm ${view === v ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{v[0]!.toUpperCase() + v.slice(1)}</button>
              ))}
            </div>
          </div>

          {view === "pastas" && (
            <nav aria-label="Caminho" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
              <button className="underline-offset-2 hover:underline" onClick={() => setFolder(null)}>Raiz</button>
              {crumbs.map((c) => <span key={c.id} className="flex min-w-0 items-center gap-1"><span aria-hidden>/</span><button className="truncate hover:underline" onClick={() => setFolder(c.id)}>{c.name}</button></span>)}
            </nav>
          )}

          <div className="flex flex-wrap gap-2">
            <input aria-label="Buscar por nome" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as any)} className="rounded-md border border-input bg-background px-2 py-2 text-sm"><option value="">Tudo</option><option value="pasta">Pastas</option><option value="arquivo">Arquivos</option></select>
            <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-input bg-background px-2 py-2 text-sm"><option value="nome">Nome</option><option value="data">Data</option><option value="tamanho">Tamanho</option></select>
            <button onClick={() => setAsc(!asc)} className="rounded-md border border-border px-3 py-2 text-sm" aria-label="Inverter ordem">{asc ? "↑" : "↓"}</button>
            {view === "pastas" && can(rank, "organizar") && <button onClick={async () => { const name = await ask("Nome da nova pasta"); if (name) void act("acv_create_folder", { _space: spaceId, _parent: folder, _name: name }, "Pasta criada."); }} className="rounded-md border border-border px-3 py-2 text-sm">Nova pasta</button>}
            {view === "pastas" && can(rank, "enviar") && <>
              <button onClick={() => fileInput.current?.click()} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Enviar arquivos</button>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
            </>}
          </div>

          {uploads.length > 0 && (
            <ul aria-live="polite" className="space-y-1 rounded-md border border-border p-3 text-sm">
              {uploads.map((u, i) => <li key={i} className="flex min-w-0 justify-between gap-2"><span className="truncate">{u.name}</span><span className={u.state === "erro" ? "text-destructive" : "text-muted-foreground"}>{u.state}{u.detail ? ` — ${u.detail}` : ""}</span></li>)}
            </ul>
          )}

          <section
            aria-label="Itens"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border ${dragging ? "border-primary bg-accent" : "border-border"} bg-card`}
          >
            {rows.length === 0 ? (
              <div className="p-6"><AbsenceState kind={query ? "nenhum-resultado" : "nenhum-registro"} compact {...(view === "pastas" && can(rank, "enviar") ? { description: "Arraste arquivos para cá ou use Enviar arquivos." } : {})} /></div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((n) => (
                  <li key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      {n.kind === "pasta" && view === "pastas"
                        ? <button className="truncate font-medium hover:underline" onClick={() => { setFolder(n.id); setQuery(""); }}>📁 {n.name}</button>
                        : <span className="block truncate">{n.kind === "pasta" ? "📁" : "📄"} {n.name}</span>}
                      <span className="block text-xs text-muted-foreground">{new Date(n.updatedAt).toLocaleString("pt-BR")}{n.size != null ? ` · ${(n.size / 1024).toFixed(0)} KB` : ""}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {view === "lixeira" ? (
                        can(rank, "excluir") && <button className="rounded border border-border px-2 py-1" onClick={() => act("acv_restore", { _node: n.id }, "Item restaurado.")}>Restaurar</button>
                      ) : (<>
                        {n.kind === "arquivo" && <button className="rounded border border-border px-2 py-1" onClick={() => openPreview(n)}>Ver</button>}
                        {n.kind === "arquivo" && <button className="rounded border border-border px-2 py-1" onClick={() => download(n)}>Baixar</button>}
                        <button className="rounded border border-border px-2 py-1" aria-pressed={favs.has(n.id)} onClick={() => toggleFav(n)}>{favs.has(n.id) ? "★" : "☆"}</button>
                        {can(rank, "compartilhar") && <button className="rounded border border-border px-2 py-1" onClick={() => setSharing(n)}>Compartilhar</button>}
                        {can(rank, "organizar") && <button className="rounded border border-border px-2 py-1" onClick={async () => { const v = await ask("Novo nome", n.name); if (v && v !== n.name) void act("acv_rename", { _node: n.id, _name: v }, "Renomeado."); }}>Renomear</button>}
                        {can(rank, "organizar") && <button className="rounded border border-border px-2 py-1" onClick={async () => { const t = await pickTarget(n); if (t !== undefined) void act("acv_move", { _node: n.id, _space: spaceId, _parent: t }, "Movido."); }}>Mover</button>}
                        <button className="rounded border border-border px-2 py-1" onClick={async () => { const t = await pickTarget(n); if (t === undefined) return; const name = await ask("Nome da cópia", `Cópia de ${n.name}`); if (name) void act("acv_copy", { _node: n.id, _space: spaceId, _parent: t, _name: name }, "Copiado."); }}>Copiar</button>
                        {can(rank, "excluir") && <button className="rounded border border-destructive/50 px-2 py-1 text-destructive" onClick={async () => { if (await confirmAction({ title: `Enviar "${n.name}" para a lixeira?`, consequence: "O item sai da pasta e pode ser restaurado pela Lixeira.", actionLabel: "Enviar para a lixeira", destructive: true })) void act("acv_trash", { _node: n.id }, "Enviado para a lixeira."); }}>Lixeira</button>}
                      </>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {space && <p className="text-xs text-muted-foreground">Cota: {space.quota_bytes ? `${(space.quota_bytes / 1_048_576).toFixed(0)} MB` : "não definida (limite de 50 MB por arquivo)"} · Itens na lixeira nunca são eliminados.</p>}
        </>
      )}

      {preview && (
        <div role="dialog" aria-modal="true" aria-label={`Pré-visualização de ${preview.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border p-3">
              <p className="truncate font-medium">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="rounded border border-border px-3 py-1 text-sm">Fechar</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {preview.kind === "imagem" && <img src={preview.url} alt={preview.name} className="mx-auto max-h-full" />}
              {preview.kind === "pdf" && <iframe title={preview.name} src={preview.url} className="h-full w-full" />}
              {preview.kind === "texto" && <pre className="whitespace-pre-wrap p-3 text-sm">{preview.text}</pre>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
