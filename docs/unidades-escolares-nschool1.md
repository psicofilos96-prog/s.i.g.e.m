# NSCHOOL.1 — Coerência do cadastro e histórico das unidades escolares

**Situação atual:** Registro de lote (2026-10-08).

## Achado
Seletores e listas de escolas (Preparação do ano, Secretaria, Censo, Autorizações da família, Carteirinhas, Montador de relatórios) escolhiam a versão cadastral de **maior número**, ignorando `valid_from`. Uma renomeação ou mudança de situação gravada com vigência futura apareceria antes da data. Dados atuais: 55 escolas, 1 versão cada, nenhuma futura — divergência latente, sem efeito hoje.

## Correção (só projeção, nenhum dado alterado)
`src/features/units/current-school-names.ts` (`currentSchoolNames`/`readCurrentSchoolNames`): versão vigente = maior número com `valid_from <= data`. Teste `current-school-names.test.ts` com escola municipal (renomeação futura) e conveniada.

## Já coerente
Ficha da unidade (`school-profile.ts`, asOf/knownAt), CIECE e Diário (`school-dimensions` / `institutional-teaching`, cadeia por data), matriz curricular (`lte valid_from`), importação do Censo (compara identidade por INEP; escola cadastrada nunca regravada), calendários (aplicabilidade por escola_id).

## Pendente
- Demais telas (Alimentação, Comunicação, Transporte, Gestão, Supervisão, Painel executivo, Vida funcional) ainda escolhem a maior versão; migram ao próximo trabalho na tela.
- Listar ou não escolas inativas nos seletores: DEPENDE_DECISAO.
- Validação com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.
