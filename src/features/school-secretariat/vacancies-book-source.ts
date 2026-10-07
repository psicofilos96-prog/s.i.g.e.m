import { supabase } from "@/integrations/supabase/client";
import type { BookRow, VacancyRow } from "./vacancies-book";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: { message: string } | null }>;
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const readVacancies = (school: string, year: string, on: string) =>
  call<VacancyRow[]>("secretariat_class_vacancies_at", { _school: school, _year: year, _on: on });
export const readEnrollmentBook = (school: string, year: string, knownAt: string | null) =>
  call<BookRow[]>("secretariat_enrollment_book_at", { _school: school, _year: year, _known_at: knownAt });

/** INEP só quando o identificador da escola segue a fonte curada `inep-<código>`; senão, ausente. */
export const inepOf = (schoolId: string) => (/^inep-(\d{8})$/.exec(schoolId)?.[1] ?? null);
