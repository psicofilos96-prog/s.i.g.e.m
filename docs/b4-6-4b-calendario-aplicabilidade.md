# B4.6.4b — Aplicabilidade explícita do calendário (estrutura D5)

Status: **estrutura e writer prontos; calendário NÃO operacional.** Não há norma homologada de seleção/composição, leitura pública continua `access-denied`, políticas v1=108 e v2=119 continuam draft.

## Estrutura (migration `0025`, aditiva)
- `calendar_version_applicability_scopes`: recortes filhos da versão (`scope_key` aberto, rótulo opcional).
- `calendar_version_applicability_conditions`: conjunção por recorte. Cada condição aponta para uma referência canônica: `escola` (B2.1), `valor-de-eixo` (B2.6, FK para valor+versão do catálogo), `alocacao` (B3 logical_id) ou `posicao-curricular` (B3.3). Não há enum de etapa ou modalidade, e nada é inferido de nome, código ou cargo.
- `calendar_version_applicability_records`: marcador "aplicabilidade registrada". Versão sem marcador = **não registrada** (sem default).
- Tudo imutável (`forbid_mutation`), filhos só na transação da versão, RLS sem policy, nenhum privilégio para anon/authenticated.

## Escrita
- `record_calendar_version_with_applicability(...13 args 0024..., _applicability)`: snapshot completo numa transação, com ≥1 recorte e ≥1 condição. Validação em **toda a vigência**: escola ativa por segmentos, valor homologado por segmentos, alocação/posição vigentes em toda a janela e no mesmo ano letivo, coerência com a escola do recorte, sem condições conflitantes nem recorte duplicado. Qualquer falha recusa tudo.
- O writer 0024 perdeu EXECUTE de `authenticated` (não há contorno sem recortes).
- Uma turma multietapa recebe vários recortes (por posição ou valor), todos preservados. Ela não ganha etapa única nem é duplicada.
- Uma retificação grava recortes próprios, e a predecessora mantém os seus.

## Resolução e homologação
- `calendar_applicability_candidates` (privado, INVOKER, sem EXECUTE do cliente) devolve candidatos, linhas `aplicabilidade-nao-registrada` e uma linha final: `bloqueado:regra-de-selecao-composicao-nao-homologada` ou `sem-candidato`. Nunca escolhe um calendário dominante, nem com candidato único. Ter vários candidatos não é tratado como ambiguidade.
- `homologate_calendar_version` dá dois retornos: sem marcador, `blocked-applicability-undeclared-d5`; com marcador, `blocked-applicability-composition-rule-not-homologated`. Nada é gravado.
- AEE ou complementar só entram por condição declarada. Nada vira calendário regular automaticamente.

## Prova
`supabase/tests/b4_6_4b_calendar_applicability.sql` → `b464b-tests-ok`. Usa o papel authenticated com claims, política sintética e rollback. Cobre ACL, ausência de capacidade, writer antigo negado, escola inexistente ou inativa, valor em rascunho ou revogado no meio da vigência, alocação encerrada, de outro ano ou inexistente, posição inexistente, escola cruzada, conflito, duplicata, atomicidade, multietapa, versão sem marcador, imutabilidade, retificação, resolver (antes e depois do knownAt, único não dominante, sem candidato), homologação distinta, resolver privado e leitor negado.

## Próximo passo exato
1. Estrutura da **norma de seleção/composição** como dado versionado e homologado: o que fazer com vários candidatos (compor ou exigir exclusividade) e precedência entre recortes. Pode ser construída tecnicamente agora (reversível), sem conteúdo.
2. Homologação da política v2 pela instituição (capacidades reais da Supervisão).
3. Habilitar o ledger em `homologate_calendar_version` quando houver norma homologada aplicável.
4. Decisão de quem consulta (pendente) → abrir leitores. 5. D6 publicação, se distinta. 6. Categorias de tipo de dia.

## B4.6.4c — Hardening (migration `0026`, aditiva; 0025 intacta)
- **Bug confirmado pela auditoria:** com contexto `NULL`, `NOT (predicado)` virava UNKNOWN e a condição exigida deixava de excluir o recorte. A consulta toda nula devolvia 2 candidatos falsos. Agora a condição só é satisfeita com predicado TRUE (`... IS NOT TRUE`). Dimensão ausente nunca corresponde nem é "adivinhada".
- **Contradição alocação × posição no mesmo recorte:** o risco foi confirmado. Uma posição de outra alocação (outro estudante, mesma escola) era aceita. O writer agora recusa com `calendar-applicability:allocation-position-contradiction`.
- **Prova:** o script passou a cobrir contexto todo nulo, eixo `[]` ou NULL, recorte sem escola, alocação ou posição ausente em recortes que as exigem, candidatos legítimos preservados e bloqueio pela regra não homologada → `b464b-tests-ok`, com rollback.

## Limitações conhecidas
- Uma condição de alocação ou posição hoje exige vigência em **toda** a versão do calendário. Isso é limite técnico desta estrutura, **não** regra institucional que obrigue o estudante a estar presente o ano todo. Entrada tardia e remanejamento exigirão futuramente recortes com janela temporal própria (não implementado).
- A norma de seleção/composição continua inexistente, e o resolver devolve só bloqueio.

## B4.6.4d — Janelas temporais por recorte (migration 0027; 0023–0026 intactas)

Contrato:
- Tabela `calendar_version_applicability_scope_windows` (scope_id, window_from, window_until; inclusivos; imutável; filho só na transação da versão; sem privilégio para anon/authenticated).
- Writer `record_calendar_version_with_windowed_applicability` (mesma assinatura de 14 argumentos): snapshot completo atômico; cada recorte exige `window_from`/`window_until`; recusa `window-required`, `window-inverted`, `window-outside-version`, `window-outside-academic-year`; condições validadas ao longo da JANELA (escola ativa e valor homologado por segmentos; alocação/posição vigentes; mesmo ano letivo); coerência escola × alocação/posição e alocação × posição mantidas; duplicata = mesmas condições com janelas sobrepostas (janelas disjuntas são recortes distintos).
- Writer 0025/0026 sem EXECUTE para clientes (DEPRECATED); 0024 continuava revogado.
- Resolver privado `calendar_applicability_candidates`: recorte só considerado se a data está na janela; knownAt e `IS NOT TRUE` (0026) preservados; recorte antigo sem janela devolve `janela-nao-registrada` (nunca candidato, nunca janela inferida) e a linha final vira `indeterminado:janela-nao-registrada` quando não há candidato; múltiplos candidatos ⇒ `bloqueado:regra-de-selecao-composicao-nao-homologada`.
- Homologação inalterada (bloqueada por norma inexistente).

Prova: `supabase/tests/b4_6_4d_calendar_applicability_windows.sql` → `b464d-tests-ok` (entrada tardia, remanejamento A→B por janelas próprias, limites inclusivos, janelas fora/invertidas/data inválida, refs inválidas durante a janela, contexto ausente, contradição, imutabilidade, retificação e consulta histórica por knownAt, ACL com papel authenticated). Rollback completo; pós-teste 0 calendários/versões/tipos/homologações/recortes/janelas/políticas de teste; v1=108, v2=119 draft.

Limitações:
- Janela é única e contínua por recorte; períodos descontínuos exigem vários recortes.
- A validação usa o conhecimento no momento da gravação; correções posteriores de alocação/posição não invalidam o recorte retroativamente (o resolver não revalida vigência da referência na data consultada).
- O marcador de "versão aberta" é por transação: dentro da mesma transação privilegiada o dono ainda poderia anexar filhos; clientes não têm privilégio de tabela.
- `b41_*_active_throughout` checa pontos de mudança > início; o estado no próprio início segue a regra herdada de B4.1.1.
- Versões gravadas por 0025/0026 permanecem sem janela: precisam de nova versão (sucessão/retificação) para entrar no resolver.
- O script b4_6_4b é histórico após 0027.

## B4.6.4e — Revalidação bitemporal na resolução (migration 0028; 0023–0027 intactas)
- Helpers privados INVOKER (`search_path=''`, sem EXECUTE do cliente): `calendar_allocation_state_at`, `calendar_condition_state_at`, `calendar_year_state_at`.
- O resolver privado revalida cada recorte que casaria na data `_on`, com o conhecimento `_known_at`: ano letivo ativo, escola ativa (versão vigente conhecida), valor homologado vigente, alocação conhecida/vigente/não encerrada (fim inclusivo), mesma escola/ano, posição não anulada e vigente, posição→alocação válida e sem contradição. Só registros com `created_at`/`registered_at` ≤ knownAt são lidos (nunca head futuro).
- Estados: `referencia-invalida:<motivo>` / `referencia-indeterminada:<motivo>` (nunca candidato). Sem candidato válido e com referências inválidas ⇒ linha final `indeterminado:referencia-nao-revalidada`. Recortes e fatos não são alterados.
- Mantidos: `IS NOT TRUE` (contexto NULL nunca corresponde), janela inclusiva, legado `janela-nao-registrada`, múltiplos candidatos com bloqueio de composição.
- Prova: `supabase/tests/b4_6_4e_calendar_applicability_revalidation.sql` → `b464e-tests-ok` (rollback; correções pelos writers reais; knownAt antes/depois deslocando `created_at` só dentro do teste).
- Limites: escola/valor/ano corrigidos fora de writer dependem dos carimbos de registro; o teste desloca carimbos para simular conhecimento posterior; norma de composição continua inexistente.
