import { useMemo } from "react";
import qrcode from "qrcode-generator";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import cidade from "@/assets/itaperuna-home.png.asset.json";
import sigem from "@/assets/logo-sigem.png.asset.json";
import { cardValue, safeVerifyUrl, type StudentCard } from "./student-card";

/** Frente e verso em proporção de cartão (85,6 × 54 mm). */
const face = "relative aspect-[85.6/54] w-full max-w-[340px] overflow-hidden rounded-xl border shadow-sm print:w-[85.6mm] print:max-w-none print:break-inside-avoid print:shadow-none";

export function StudentCardView({ card }: { card: StudentCard }) {
  const url = safeVerifyUrl(card.verifyUrl);
  const qr = useMemo(() => { if (!url) return null; const q = qrcode(0, "M"); q.addData(url); q.make(); return q.createDataURL(4, 0); }, [url]);
  const Row = ({ l, v }: { l: string; v: string | null }) => (
    <p className="leading-tight"><span className="block text-[9px] uppercase tracking-wide text-muted-foreground">{l}</span>
      <span className={`text-[11px] font-medium ${v ? "" : "italic text-muted-foreground"}`}>{cardValue(v)}</span></p>);
  return (
    <div className="flex flex-wrap gap-4" aria-label="Carteirinha do estudante">
      <div className={`${face} bg-card`}>
        <div className="flex items-center gap-2 bg-primary px-3 py-1.5 text-primary-foreground">
          <img src={brasao.url} alt="Brasão de Itaperuna" className="h-6 w-auto" />
          <p className="text-[10px] font-semibold leading-tight">Prefeitura de Itaperuna<br />Carteirinha do Estudante</p>
          {card.year && <span className="ml-auto text-sm font-bold">{card.year}</span>}
        </div>
        <div className="flex gap-3 p-3">
          <div className="flex aspect-[3/4] w-[72px] shrink-0 items-center justify-center rounded border bg-muted text-center text-[9px] text-muted-foreground">
            {card.photoUrl ? <img src={card.photoUrl} alt="Foto do estudante" className="h-full w-full object-cover" /> : "Foto não registrada"}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-bold">{cardValue(card.name)}</p>
            <Row l="Escola" v={card.school} />
            <div className="flex gap-3"><Row l="Turma" v={card.className} /><Row l="Turno" v={card.shift} /></div>
            <Row l="Matrícula SIGEM" v={card.code} />
          </div>
        </div>
      </div>
      <div className={`${face} bg-primary text-primary-foreground`}>
        <img src={cidade.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="relative flex h-full flex-col justify-between p-3">
          <div className="flex items-center gap-2"><img src={sigem.url} alt="SIGEM" className="h-6 w-auto" /><p className="text-[10px]">Itaperuna — educação para todos</p></div>
          <div className="flex items-end justify-between">
            <p className="text-[10px]">{card.status === "vigente" ? "Matrícula vigente" : "Sem matrícula vigente"}</p>
            {qr ? <img src={qr} alt="QR de verificação" className="h-16 w-16 rounded bg-background p-1" />
              : <p className="max-w-[120px] text-right text-[9px] opacity-80">Verificação por QR ainda não emitida pela Secretaria</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
