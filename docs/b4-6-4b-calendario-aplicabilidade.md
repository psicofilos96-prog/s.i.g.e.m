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
