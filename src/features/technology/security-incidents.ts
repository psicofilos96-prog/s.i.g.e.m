// L17 Tecnologia — incidentes de segurança de acesso restrito (0490). Espelha as regras do banco para a tela;
// o banco é a garantia. Relator nunca vê detalhes da equipe nem decide triagem/encerramento.
export type SecKind = "triagem" | "contencao" | "erradicacao" | "recuperacao" | "decisao-comunicacao" | "encerramento" | "descarte";
export interface SecEvent { seq: number; kind: SecKind; personalData?: boolean | null; personId: string }

export const SECURITY_RESTRICTED_CAPABILITY = "tratar-incidentes-de-seguranca";

export function canRecordSec(reporter: string, ev: readonly SecEvent[], kind: SecKind, actor: string): string | null {
  const last = [...ev].sort((a, b) => b.seq - a.seq)[0];
  if (last && (last.kind === "encerramento" || last.kind === "descarte")) return "encerrado";
  if (!last && kind !== "triagem" && kind !== "descarte") return "transicao-invalida";
  if (last && kind === "descarte") return "transicao-invalida";
  if (actor === reporter && (kind === "triagem" || kind === "encerramento" || kind === "descarte")) return "relator-nao-decide";
  if (kind === "encerramento") {
    const tri = [...ev].filter((e) => e.kind === "triagem").sort((a, b) => b.seq - a.seq)[0];
    if (!tri || tri.personalData == null) return "sem-triagem";
    if (!ev.some((e) => e.kind === "contencao")) return "sem-contencao";
    if (tri.personalData && !ev.some((e) => e.kind === "decisao-comunicacao")) return "sem-decisao-de-comunicacao";
  }
  return null;
}

export const reporterView = (r: { code: string; phase: string }) => ({ code: r.code, phase: r.phase });
