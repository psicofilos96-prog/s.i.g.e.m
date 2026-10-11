-- Mesma regra de leitura do quadro de pessoal, avaliada uma vez por consulta (initplan) em vez de por linha.
-- Rede: capacidade de rede (inalterado). Escola: school_id pertence ao conjunto de escolas em que has_school_capability é verdadeiro (mesma função).
DROP POLICY "Leitura por quem consulta quadro ou registro funcional" ON public.staff_administrative_records;
CREATE POLICY "Leitura por quem consulta quadro ou registro funcional" ON public.staff_administrative_records
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_network_capability('consultar-quadro-profissional-da-rede'::text))
    OR (SELECT public.has_network_capability('consultar-registro-funcional'::text))
    OR (school_id IS NOT NULL AND school_id = ANY (ARRAY(
          SELECT s.id FROM public.institutional_schools s
          WHERE public.has_school_capability('consultar-quadro-profissional-da-escola'::text, s.id))))
  );