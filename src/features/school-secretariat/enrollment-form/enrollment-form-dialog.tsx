import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { institution } from "@/config/institution";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";
import brasao from "@/assets/calendar-premium/brasao.png.asset.json";
import { blankFormData, type EnrollmentFormData, type FormMode } from "./model";
import { layoutEnrollmentForm, type Layout } from "./layout";
import { createMeasure, pageSvg, printHtml, renderPdf, type ImageSrc, type Images } from "./render";
import { loadFilledForm, loadSchoolHeader } from "./source";

/** Capacidade que libera o anexo de Educação Especial (dado sensível). */
export const SPECIAL_ED_CAPABILITY = "consultar-casos-de-inclusao";

async function toPng(url: string): Promise<ImageSrc | null> {
  try {
    const res = await fetch(url); if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const max = 900; const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return { src: c.toDataURL("image/png"), w: c.width, h: c.height };
  } catch { return null; }
}

type Props = { trigger: React.ReactNode } & ({ kind: "preenchida"; studentId: string } | { kind: "branco"; schoolId: string | null; yearLabel: string | null });

export function EnrollmentFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.kind === "branco" ? "Ficha de Matrícula em branco" : "Ficha de Matrícula"}</DialogTitle>
          <DialogDescription>Folha A4. O arquivo PDF e a impressão saem iguais a esta prévia. Nada é alterado no cadastro.</DialogDescription>
        </DialogHeader>
        {open ? <FormPreview {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function FormPreview(props: Props) {
  const auth = useSessionAuthority();
  const canSpecial = auth.status === "signed-in" && auth.capabilities.some((c) => c.capabilityId === SPECIAL_ED_CAPABILITY);
  const [mode, setMode] = useState<FormMode>(props.kind === "branco" ? "branco" : "preenchida");
  const [annex, setAnnex] = useState(false);
  const [renewal, setRenewal] = useState(true);
  const [data, setData] = useState<EnrollmentFormData | null>(null);
  const [images, setImages] = useState<Images>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = props.kind === "preenchida" ? `p|${props.studentId}` : `b|${props.schoolId ?? ""}|${props.yearLabel ?? ""}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let d: EnrollmentFormData; let photo: string | null = null;
        if (props.kind === "preenchida") {
          const f = await loadFilledForm(props.studentId);
          if (!f) { if (alive) setErr("Este aluno não está no alcance da sua conta."); return; }
          d = f.data; photo = f.photoUrl;
        } else {
          const header = props.schoolId ? await loadSchoolHeader(props.schoolId) : { government: institution.documentGovernmentName, department: institution.departmentName };
          d = blankFormData(header, props.yearLabel);
        }
        const [b, s, p] = await Promise.all([toPng(brasao.url), toPng(sigemLogo.url), photo ? toPng(photo) : Promise.resolve(null)]);
        if (!alive) return;
        setImages({ ...(b ? { brasao: b } : {}), ...(s ? { sigem: s } : {}), ...(p ? { photo: p } : {}) });
        setData(d);
      } catch { if (alive) setErr("Não foi possível ler os dados da ficha. Tente de novo."); }
    })();
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useMemo(() => createMeasure(), []);
  const layout: Layout | null = useMemo(() => data ? layoutEnrollmentForm(data, { mode, specialEdAnnex: annex && canSpecial, renewal }, measure, !!images.photo) : null, [data, mode, annex, canSpecial, renewal, measure, images.photo]);
  const fileName = `ficha-de-matricula${mode === "branco" ? "-em-branco" : ""}${data?.student.name ? `-${slug(data.student.name)}` : ""}.pdf`;

  function download() {
    if (!layout) return;
    setBusy(true);
    try {
      const blob = renderPdf(layout, images, "Ficha de Matrícula").output("blob");
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } finally { setBusy(false); }
  }
  function print() {
    if (!layout) return;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const doc = f.contentDocument!; doc.open(); doc.write(printHtml(layout, images, "Ficha de Matrícula")); doc.close();
    setTimeout(() => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 60_000); }, 300);
  }

  if (err) return <p role="alert" className="text-sm text-destructive">{err}</p>;
  return (
    <div className="space-y-4">
      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <legend className="sr-only">Opções da ficha</legend>
        {props.kind === "preenchida" ? (
          <div className="flex gap-3" role="radiogroup" aria-label="Modo">
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "preenchida"} onChange={() => setMode("preenchida")} /> Ficha preenchida</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "branco"} onChange={() => setMode("branco")} /> Ficha em branco</label>
          </div>
        ) : null}
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={renewal} onChange={(e) => setRenewal(e.target.checked)} /> Controle de Renovação</label>
        {canSpecial ? <label className="flex items-center gap-1.5"><input type="checkbox" checked={annex} onChange={(e) => setAnnex(e.target.checked)} /> Anexo de Educação Especial</label> : null}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button onClick={download} disabled={!layout || busy}>Baixar PDF</Button>
        <Button variant="outline" onClick={print} disabled={!layout}>Imprimir</Button>
        {layout ? <span className="self-center text-sm text-muted-foreground">{layout.pages.length} página(s)</span> : null}
      </div>
      {!layout ? <p className="text-sm text-muted-foreground">Preparando a ficha…</p> : (
        <div className="space-y-4 rounded-md bg-muted p-3">
          {layout.pages.map((_, i) => (
            <div key={i} className="mx-auto w-full max-w-[210mm] bg-card shadow-sm [&_svg]:h-auto [&_svg]:w-full" aria-label={`Página ${i + 1}`}
              dangerouslySetInnerHTML={{ __html: pageSvg(layout, i, images) }} />
          ))}
        </div>
      )}
    </div>
  );
}

const slug = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
