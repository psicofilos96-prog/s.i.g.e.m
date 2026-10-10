/**
 * LOTE 5/14 — Pessoal 2026 por escola: registros ADMINISTRATIVOS (planilhas de servidores por escola
 * e SEMED por setor) em `staff_administrative_records`. Leitura só com a sessão (RLS), paginada e
 * filtrada no servidor; nada gravado. Registro administrativo ≠ declaração censitária ≠ lotação
 * oficial ≠ autorização no sistema: nenhum valor daqui concede acesso ou cria vínculo.
 */
import { supabase } from "@/integrations/supabase/client";

export const STAFF_SOURCES = {
  "servidores-por-escola": "Planilha de servidores por escola",
  "funcionarios-semed-por-setor": "Planilha SEMED por setor",
} as const;
export type StaffSource = keyof typeof STAFF_SOURCES;

export const RECORD_KINDS = [
  { key: "administrativo", label: "Registro administrativo", text: "Linha das planilhas de pessoal 2026. Mostra o que a fonte declara; não é ato funcional." },
  { key: "censitario", label: "Declaração censitária", text: "Profissional declarado no Censo Escolar 2026 (lista Profissionais). Fonte e finalidade diferentes." },
  { key: "lotacao", label: "Lotação oficial", text: "Só existe quando registrada no Departamento Pessoal do SIGEM. Hoje: nenhuma registrada." },
  { key: "autorizacao", label: "Autorização no sistema", text: "Só uma atuação vigente com política homologada dá acesso. Nada nesta tela concede acesso." },
] as const;

export type StaffFilters = { source: StaffSource | ""; schoolId: string; sector: string; situacao: string; search: string };
export type StaffRow = Readonly<{
  id: string; sourceKind: string; sourceLabel: string; sourceFile: string; sheet: string; rowNo: number; referencePeriod: string | null;
  schoolId: string | null; schoolNameSource: string | null; sector: string | null; fullName: string; registration: string | null;
  cargo: string | null; funcao: string | null; vinculo: string | null; situacao: string | null; grantsAccess: false;
}>;

export const STAFF_PAGE_SIZE = 50;
export const sanitizeTerm = (q: string) => q.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80);

type Raw = { id: string; source_kind: string; source_file: string; sheet: string; row_no: number; reference_period: string | null; school_id: string | null;
  school_name_source: string | null; sector: string | null; full_name: string; registration: string | null; cargo: string | null; funcao: string | null; vinculo: string | null; situacao: string | null };

export function projectStaff(r: Raw): StaffRow {
  return {
    id: r.id, sourceKind: r.source_kind, sourceLabel: STAFF_SOURCES[r.source_kind as StaffSource] ?? "Fonte não reconhecida",
    sourceFile: r.source_file, sheet: r.sheet, rowNo: r.row_no, referencePeriod: r.reference_period, schoolId: r.school_id,
    schoolNameSource: r.school_name_source, sector: r.sector, fullName: r.full_name, registration: r.registration,
    cargo: r.cargo, funcao: r.funcao, vinculo: r.vinculo, situacao: r.situacao, grantsAccess: false,
  };
}

export async function readStaffRecords(f: StaffFilters, page: number, signal?: AbortSignal) {
  let b = supabase.from("staff_administrative_records")
    .select("id, source_kind, source_file, sheet, row_no, reference_period, school_id, school_name_source, sector, full_name, registration, cargo, funcao, vinculo, situacao", { count: "exact" });
  if (f.source) b = b.eq("source_kind", f.source);
  if (f.schoolId) b = b.eq("school_id", f.schoolId);
  const sector = sanitizeTerm(f.sector); if (sector) b = b.ilike("sector", `%${sector}%`);
  const sit = sanitizeTerm(f.situacao); if (sit) b = b.ilike("situacao", `%${sit}%`);
  const q = sanitizeTerm(f.search); if (q) b = b.or(`full_name.ilike.%${q}%,cargo.ilike.%${q}%,funcao.ilike.%${q}%`);
  b = b.order("full_name").order("id");
  if (signal) b = b.abortSignal(signal);
  const from = Math.max(0, page) * STAFF_PAGE_SIZE;
  const { data, error, count } = await b.range(from, from + STAFF_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: ((data ?? []) as Raw[]).map(projectStaff), total: count ?? 0 };
}

export async function readStaffSchools(signal?: AbortSignal) {
  let b = supabase.from("institutional_schools").select("id, institutional_school_record_versions(name)").limit(200);
  if (signal) b = b.abortSignal(signal);
  const { data, error } = await b;
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.id as string, name: ((s.institutional_school_record_versions as unknown as Array<{ name: string }> | null)?.[0]?.name) ?? "Escola sem nome registrado" }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
