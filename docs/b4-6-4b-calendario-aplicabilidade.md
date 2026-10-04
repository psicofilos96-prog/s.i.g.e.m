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
