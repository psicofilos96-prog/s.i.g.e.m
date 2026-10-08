-- NDB.4: dívida técnica inequívoca. Nada de dado tocado; nenhum acesso ampliado.
-- Índices idênticos (mesma tabela, colunas, ordem, sem predicado) a outro já existente.
DROP INDEX IF EXISTS public.meal_inventory_movements_school_day;
DROP INDEX IF EXISTS public.meal_daily_executions_school_day;
-- Porta DEPRECATED (B1.3) sem consumidor no app nem no banco: retira EXECUTE de contas.
REVOKE EXECUTE ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean) FROM PUBLIC, anon, authenticated;