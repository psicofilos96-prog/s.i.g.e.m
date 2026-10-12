-- Lote 18: única função sem search_path fixo apontada pelo linter (corpo não referencia objetos).
ALTER FUNCTION public.ops_no_truncate() SET search_path = '';