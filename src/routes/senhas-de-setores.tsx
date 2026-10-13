import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSectorLogins, setSectorPassword } from "@/features/authority/sector-passwords.functions";

export const Route = createFileRoute("/senhas-de-setores")({
  head: () => ({
    meta: [
      { title: "Senhas dos setores — SIGEM Itaperuna" },
      { name: "description", content: "A administração define a senha de cada conta de setor do SIGEM." },
      { property: "og:title", content: "Senhas dos setores — SIGEM Itaperuna" },
      { property: "og:description", content: "Definição de senhas das contas de setor pela administração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SectorPasswordsPage,
});

function SectorPasswordsPage() {
  const list = useServerFn(listSectorLogins);
  const save = useServerFn(setSectorPassword);
  const q = useQuery({ queryKey: ["sector-logins"], queryFn: () => list(), retry: false });
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sel) return;
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { userId: sel, password: String(f.get("pw")), password2: String(f.get("pw2")) } });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) e.currentTarget.reset();
    } catch { setMsg({ ok: false, text: "Sem permissão ou falha ao gravar." }); }
    finally { setBusy(false); }
  }

  const rows = (q.data ?? []).filter((r) => r.login.includes(filter.toLowerCase()));
  return (
    <section aria-labelledby="sp-title" className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 id="sp-title" className="text-2xl font-semibold">Senhas dos setores</h1>
      <p className="text-sm text-muted-foreground">Escolha a conta do setor e defina a senha. Depois repasse a senha ao setor; ele entra direto, sem precisar trocar.</p>
      {q.isLoading ? <p role="status">Carregando contas…</p> : q.isError ? <p role="alert" className="text-destructive">Só a administração pode usar esta tela.</p> : (
        <>
          <label className="block text-sm">Buscar conta<input value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
          <ul className="max-h-72 overflow-auto rounded-md border" aria-label="Contas de setor">
            {rows.length === 0 ? <li className="p-3 text-sm text-muted-foreground">Nenhuma conta encontrada.</li> : rows.map((r) => (
              <li key={r.id}><button type="button" onClick={() => { setSel(r.id); setMsg(null); }} aria-pressed={sel === r.id} className={`block min-h-11 w-full px-3 text-left text-sm ${sel === r.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{r.login}</button></li>
            ))}
          </ul>
          {sel ? (
            <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Conta: {q.data?.find((r) => r.id === sel)?.login}</p>
              <label className="block text-sm">Nova senha<input name="pw" type="text" autoComplete="off" required className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
              <label className="block text-sm">Repita a senha<input name="pw2" type="text" autoComplete="off" required className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" /></label>
              <p className="text-xs text-muted-foreground">Pelo menos 6 caracteres, com letra maiúscula, minúscula, número e símbolo.</p>
              {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm" : "text-sm text-destructive"}>{msg.text}</p> : null}
              <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground">Definir senha</button>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
