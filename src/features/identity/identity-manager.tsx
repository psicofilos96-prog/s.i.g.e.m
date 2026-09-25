import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/sigem/date-input";
import { StatusBadge } from "@/components/sigem/patterns";
import { formatAcademicDate, formatDateTime } from "@/lib/academic-date";
import {
  KIND_LABEL,
  MAX_LOGO_BYTES,
  canManage,
  identityStore,
  validateLogoBytes,
  type IdentityActor,
  type IdentityFile,
  type IdentityKind,
  type IdentityStore,
} from "./identity-store";
import { useIdentityAssets } from "./institutional-logo";

/** Lê o arquivo no navegador, valida assinatura, confirma decodificação e mede dimensões. */
export async function readLogoFile(
  file: File,
): Promise<{ ok: true; file: IdentityFile } | { ok: false; error: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateLogoBytes({ bytes, declaredType: file.type, size: file.size });
  if (!check.ok) return check;
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const dims = await new Promise<{ width: number; height: number } | null>((res) => {
    const img = new Image();
    img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => res(null);
    img.src = url;
  });
  if (!dims) return { ok: false, error: "Imagem corrompida: o navegador não conseguiu abri-la." };
  return {
    ok: true,
    file: {
      url,
      mimeType: check.mimeType,
      originalFileName: file.name,
      size: file.size,
      hasTransparency: check.hasTransparency,
      ...dims,
    },
  };
}

const STATUS = { ativo: "Ativo", substituido: "Substituído", removido: "Removido" } as const;
const kb = (n: number) => `${(n / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;

export function IdentityManager({
  kind,
  ownerId,
  actor,
  withValidity = false,
  allowRemove = false,
  missingLabel,
  store = identityStore,
}: {
  kind: IdentityKind;
  ownerId?: string;
  actor: IdentityActor;
  withValidity?: boolean;
  allowRemove?: boolean;
  missingLabel: string;
  store?: IdentityStore;
}) {
  useIdentityAssets(store);
  const history = store.history(kind, ownerId);
  const current = store.resolve({ kind, ownerId });
  const owner = ownerId ?? history[0]?.ownerId ?? "";
  const allowed = canManage(actor, kind, owner || (ownerId ?? ""));
  const [pending, setPending] = useState<IdentityFile | null>(null);
  const [alt, setAlt] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const inputId = `upload-${kind}-${ownerId ?? "rede"}`;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = await readLogoFile(f);
    if (!r.ok) {
      setPending(null);
      setMessage({ tone: "danger", text: r.error });
      return;
    }
    setPending(r.file);
    setMessage(null);
  }
  function submit() {
    if (!pending) return;
    const r = store.register(actor, {
      kind,
      ownerId,
      file: pending,
      altText: alt || undefined,
      validFrom: withValidity ? from : undefined,
      validUntil: withValidity ? until : undefined,
    });
    setMessage(r.ok ? { tone: "success", text: `Versão ${r.asset.version} cadastrada.` } : { tone: "danger", text: r.error });
    if (r.ok) {
      setPending(null);
      setAlt("");
      setFrom("");
      setUntil("");
    }
  }

  return (
    <section className="space-y-4 border border-border bg-card p-4" aria-label={KIND_LABEL[kind]}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-36 items-center justify-center border border-dashed border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2">
          {current ? (
            <img src={current.file.url} alt={current.altText} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-center text-xs text-muted-foreground">{missingLabel}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <h3 className="font-semibold">{KIND_LABEL[kind]}</h3>
          {current ? (
            <>
              <p>
                Vigente hoje: versão {current.version} · {current.file.originalFileName} ·{" "}
                {kb(current.file.size)}
              </p>
              <p className="text-xs text-muted-foreground">
                Vigência: {formatAcademicDate(current.validFrom, "sem início definido")} até{" "}
                {formatAcademicDate(current.validUntil, "sem fim definido")} · cadastrada por{" "}
                {current.createdBy} em {formatDateTime(current.createdAt)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">{missingLabel}</p>
          )}
          {!allowed ? (
            <p className="text-xs text-muted-foreground">Somente consulta para este perfil.</p>
          ) : null}
        </div>
      </div>

      {allowed ? (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor={inputId}>
                {kind === "education-department-logo" ? "Cadastrar nova logo" : current ? "Substituir arquivo" : "Anexar logo"}
              </Label>
              <Input id={inputId} type="file" accept="image/png,image/jpeg" onChange={onFile} />
              <p className="text-xs text-muted-foreground">
                PNG (transparência preservada) ou JPEG, até {kb(MAX_LOGO_BYTES)}. Arquivo original mantido sem compressão.
              </p>
            </div>
            {pending ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor={`${inputId}-alt`}>Texto alternativo</Label>
                  <Input id={`${inputId}-alt`} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={KIND_LABEL[kind]} />
                </div>
                {withValidity ? (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor={`${inputId}-from`}>Vigência a partir de</Label>
                      <DateInput id={`${inputId}-from`} value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${inputId}-until`}>Vigência até (opcional)</Label>
                      <DateInput id={`${inputId}-until`} value={until} onChange={(e) => setUntil(e.target.value)} />
                    </div>
                  </>
                ) : null}
                <Button onClick={submit}>Salvar versão</Button>
              </>
            ) : null}
            {allowRemove && current ? (
              <Button variant="outline" onClick={() => store.remove(actor, current.id)}>
                Remover logo
              </Button>
            ) : null}
          </div>
          {pending ? (
            <div className="flex items-center gap-3 text-xs">
              <img src={pending.url} alt="Pré-visualização do arquivo enviado" className="h-16 w-auto max-w-40 object-contain" />
              <span>
                {pending.originalFileName} · {pending.width}×{pending.height} px ·{" "}
                {pending.hasTransparency ? "com transparência" : "sem transparência"}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p role="status" className={message.tone === "danger" ? "text-sm text-destructive" : "text-sm text-success"}>
          {message.text}
        </p>
      ) : null}

      {history.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Histórico ({history.length})</summary>
          <ul className="mt-2 divide-y divide-border text-xs">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                <img src={a.file.url} alt={a.altText} className="h-10 w-16 object-contain" />
                <span className="font-medium">Versão {a.version}</span>
                <StatusBadge tone={a.status === "ativo" ? "success" : "neutral"}>{STATUS[a.status]}</StatusBadge>
                <span>
                  {formatAcademicDate(a.validFrom, "sem início")} – {formatAcademicDate(a.validUntil, "sem fim")}
                </span>
                <span className="text-muted-foreground">
                  {a.file.originalFileName} · {a.createdBy} · {formatDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
