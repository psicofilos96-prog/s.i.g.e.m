# B4.1 — Matriz curricular canônica (estrutura institucional)

Migrations: `drizzle/migrations/0005_b4_1_curricular_matrix_structure.sql` e correção aditiva
`drizzle/migrations/0006_b4_1_1_matrix_validity_hardening.sql` (B4.1.1; 0005 intacta).

## Decisão institucional D4 (explícita, aprovada pelo usuário em 2026-10-03)
- Nova capability `manter-matrizes-curriculares`, escopo `{network}`.
- Concedida somente à nova atuação `gestao-pedagogica-da-rede`, somente na política v2 **draft**
  (v1 intacta: 108 regras, md5 `a9f922024fe7dd2e2db2fa49ae85057c`; v2: 116 → 117 regras, continua draft).
- Não reutiliza `manter-componentes-curriculares`: manter o catálogo de componentes e manter a
  estrutura da matriz são competências distintas. Nenhuma atuação existente recebeu a capability.
- Tipos de atuação não têm catálogo próprio no banco (são `engagement_kind_id` nas regras da política);
  por isso a atuação nasce só como regra da v2. Nenhuma pessoa/atuação real foi criada; política não homologada.

## Modelo
- `institutional_curricular_matrices` — identidade lógica (`mat-<uuid>`), imutável.
- `curricular_matrix_versions` — append-only; `version`, `supersedes_id`, `change_kind`
  (`constituicao` | `sucessao` | `retificacao` — natureza estrutural do registro, não estado normativo),
  `valid_from`/`valid_until`, ato, `recorded_by`/pessoa/atuação, `created_at` (knownAt).
- `curricular_matrix_items` — filhos imutáveis da versão: componente B2.3 por ID (nome só como
  `component_label_snapshot`, evidência) OU elemento do catálogo `elemento-de-matriz-curricular`;
  quantidade separada da unidade (catálogo `unidade-de-carga-da-matriz`). Mudança de item = nova versão.
- `curricular_matrix_applicability` — ano letivo (B2.4), escola (B2.1) ou valor homologado de catálogo
  (B2.6) por ID. Não escolhe qual eixo é "oferta educacional" (D1 continua aberta).
- Sem estado rascunho/homologada da matriz: não existe mecanismo genérico; workflow de homologação fica para decisão posterior.

## Reader / writer
- `curricular_matrices_at(on, knownAt)`, `curricular_matrix_items_at(matrix, on, knownAt)`,
  `curricular_matrix_applicability_at(matrix, on, knownAt)` — SECURITY INVOKER; datas obrigatórias.
  Retificação conhecida oculta a retificada; sucessão encerra a anterior na véspera (derivado, nunca gravado);
  mais de uma versão na data ⇒ `matrix:ambiguous` (estruturalmente inalcançável pela cadeia linear; guarda defensiva).
- `record_curricular_matrix_version(...)` — SECURITY DEFINER, `search_path=''`, auth.uid, capability de rede,
  base esperada + advisory lock, valida componente, ano letivo e escola ativos em TODA a vigência
  (B4.1.1, ver abaixo), catálogos homologados; catálogo vazio ⇒ recusa explícita, nunca default.
- ACL: EXECUTE só `authenticated`; PUBLIC/anon revogados; DML direto revogado; triggers `forbid_mutation`.

## Testes
- `supabase/tests/b4_1_curricular_matrix.sql` — executado na Cloud (`b41-tests-ok`), fixture descartado.
- `src/features/curriculum/b4-1-curricular-matrix.test.ts` — unitários de TS (não provam regra do banco).

## Não decidido (continua bloqueado)
Eixo da oferta (D1), critério de aplicabilidade turma→matriz (D2-critério, B4.2; cardinalidade D2 decidida, ver abaixo), unidade de carga, elementos não disciplinares,
etapa/modalidade, regras de composição/carga (D7), homologação/publicação da matriz e da política (D4 parcial: só quem mantém).

## Relação com B4.2
B4.2 vinculará turma → versão de matriz consumindo `curricular_matrices_at`; não iniciada.

## B4.1.1 — Correções da auditoria técnica (Codex)
1. **Vigência inteira.** O writer 0005 validava ano/escola só no início (`valid_from <= início`, maior versão).
   Agora `b41_school_active_throughout` / `b41_year_active_throughout` / `b41_component_active_throughout`
   segmentam a vigência pelos `valid_from` das versões B2.1/B2.4/B2.3 dentro dela e, em cada ponto, usam a
   mesma regra canônica de `class_record_context`/`curricular_components_at` (maior versão com `valid_from <= ponto`).
   Versão futura não vale antes do seu início; inativação posterior dentro da vigência recusa; vigência aberta
   considera todas as mudanças após o início. B2.1/B2.4 não têm `valid_until` nem reader bitemporal próprio:
   encerramento é nova versão inativa, captada pelos segmentos. knownAt do writer = agora (todas as versões conhecidas).
   Helpers sem EXECUTE para PUBLIC/anon/authenticated. Casos que o 0005 aceitava e agora são recusados (teste):
   escola inativada em 2026-06-01 com matriz aberta desde 2026-01-01; ano inativado em 2026-09-01; ano inativo
   até ativação futura em 2027. Vigências limitadas ao segmento ativo seguem aceitas.
2. **Ambiguidade.** Estruturalmente inalcançável no reader: para versões efetivas a<b, `eff_until(a) <= valid_from(b)-1`,
   logo nenhuma data cobre ambas; `supersedes_id` único impede duas retificações do mesmo alvo. O teste deixou de
   "amostrar datas": grava como dono, sem writer, uma cadeia adversarial (sucessões fora de ordem, sobrepostas,
   retificação com início anterior) e verifica dia a dia (2023-06 a 2028-06) que nunca há 2 linhas nem `matrix:ambiguous`.
   A guarda `matrix:ambiguous` permanece defensiva. Writer passou a recusar retificação que apagaria a predecessora
   efetiva (`matrix:retification-must-start-after-predecessor`), que o 0005 aceitava silenciosamente.
3. **`dimension`.** `ano-letivo | escola | atributo` são tipos técnicos de referência (qual FK/tabela canônica),
   não taxonomia normativa: `atributo` aceita qualquer esquema de catálogo homologado (eixos abertos). Não fixa
   eixo de oferta (D1), nem semântica de combinação (E/OU) entre aplicabilidades, nem cardinalidade turma→matriz (D2).
   Nenhuma aplicabilidade autorizada fica bloqueada; nada a ajustar no schema.

### Remanescentes (não corrigidos por dependerem de B2.6/norma)
- `attribute_value_homologated` (B2.6) checa catálogo só na data de início e não tem término/revogação temporal;
  unidade, elemento e aplicabilidade por atributo herdam isso. Mudança é decisão de B2.6, não B4.1.
- Limites `starts_on/ends_on` do ano letivo não restringem a vigência da matriz (relação matriz↔calendário é normativa).
- Capability avaliada em `CURRENT_DATE` (autoridade de quem registra agora), como nos demais writers.

## D2 — cardinalidade temporal (decidida em 2026-10-03)
Decisão institucional do usuário ("Só existe uma matriz vigente, nunca mais de uma"): para cada turma e data, nunca mais de UMA matriz curricular vigente. Obrigatoriedade de haver matriz para toda turma/data não decidida; ausência de vínculo não é declarada válida, nunca é preenchida por default e a leitura a sinaliza.
Não decidido: critério de escolha/aplicabilidade da matriz à turma e eixo de oferta (D1); não inferidos de documentos normativos nem escolhidos por padrão.
B4.1 não muda (sem schema/código). B4.2 (não iniciada) deve recusar sobreposição por turma e tratar duplicidade na data como inconsistência fail-closed.
