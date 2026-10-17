/** Listagens personalizáveis da escola: colunas e filtros escolhidos na tela, sobre a leitura canônica. */
import type { ReportDefinition } from "@/features/reports/report-engine";

export type ListingRow = { student_id: string; student_name: string; birth_date: string | null; class_id: string | null; class_label: string | null; has_cpf: boolean; vaccination: string | null };
export type ListingColumn = "numero" | "nome" | "nascimento" | "idade" | "turma" | "cpf" | "vacinacao" | "assinatura" | "observacao";

export const LISTING_COLUMNS: { id: ListingColumn; label: string }[] = [
  { id: "numero", label: "Nº" }, { id: "nome", label: "Nome" }, { id: "nascimento", label: "Nascimento" },
  { id: "idade", label: "Idade" }, { id: "turma", label: "Turma" }, { id: "cpf", label: "CPF registrado" },
  { id: "vacinacao", label: "Vacinação" }, { id: "assinatura", label: "Assinatura (em branco)" }, { id: "observacao", label: "Observação (em branco)" },
];

export function ageOn(birth: string | null, on: string): number | null {
  if (!birth) return null;
  const [by, bm, bd] = birth.split("-").map(Number); const [y, m, d] = on.split("-").map(Number);
  return y! - by! - (m! < bm! || (m === bm && d! < bd!) ? 1 : 0);
}

export type ListingFilter = { classId: string; birthMonth: string; search: string; noCpf: boolean };
export function filterListing(rows: readonly ListingRow[], f: ListingFilter): ListingRow[] {
  const q = f.search.trim().toLocaleLowerCase("pt-BR");
  return rows.filter((r) => (!f.classId || (f.classId === "sem-turma" ? !r.class_id : r.class_id === f.classId))
    && (!f.birthMonth || r.birth_date?.slice(5, 7) === f.birthMonth)
    && (!q || r.student_name.toLocaleLowerCase("pt-BR").includes(q))
    && (!f.noCpf || !r.has_cpf));
}

const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "Não registrado");
const vac = (v: string | null) => (v === "em-dia" ? "Em dia" : v === "pendente" ? "Pendente" : "Não registrado");

export function listingReport(cols: readonly ListingColumn[], title: string): ReportDefinition {
  return {
    id: "listagem-personalizada", version: 1, title, description: "Listagem personalizada da escola.",
    source: "secretariat_own_student_listing", params: [],
    columns: LISTING_COLUMNS.filter((c) => cols.includes(c.id)).map((c) => ({ id: c.id, label: c.label, kind: c.id === "numero" || c.id === "idade" ? "number" : "text" })),
    formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 20000,
  };
}

export function listingRows(rows: readonly ListingRow[], on: string) {
  return rows.map((r, i) => ({
    numero: i + 1, nome: r.student_name, nascimento: br(r.birth_date), idade: ageOn(r.birth_date, on),
    turma: r.class_label ?? "Sem turma", cpf: r.has_cpf ? "Sim" : "Não", vacinacao: vac(r.vaccination), assinatura: "", observacao: "",
  }));
}
