# B4.6.5a — Estrutura da norma de seleção/composição de calendários

Status: **só estrutura (migration `0030`, aditiva; 0023–0029 intactas).** Não há writer, capacidade, conteúdo nem seed. O resolver de aplicabilidade, `homologate_calendar_version`, `calendar_at` e `calendar_day_at` não mudaram. As políticas continuam v1=108 e v2=119, ambas draft.

## Contrato
- **Identidade e versões:** `calendar_composition_norms` (`ccn-…`) e `calendar_composition_norm_versions`.
  - As versões são append-only.
  - Cada versão guarda constituição, sucessão ou retificação, vigência, predecessor (+1, mesma norma, raiz única), ato, motivo e proveniência (usuário, pessoa e atuação, com FK).
  - Uma sucessão precisa começar depois da predecessora.
- **Primitivas declaradas** (filhas da versão; ausência nunca vira default):
  - `multiplicity.operation`: `exigir-exclusividade` (mais de um candidato ⇒ diagnóstico de conflito) ou `compor-por-dimensao`.
  - `dimension_rules(dimension_id aberto, operation, on_absence)`:
    - operation: `exigir-concordancia` ou `uniao-com-diagnostico`;
    - on_absence: `indeterminado` ou `desconsiderar-candidato-sem-declaracao`.
  - Não existe primitiva de prioridade, especificidade ou escola dominante. Conflito sempre conserva diagnóstico.
  - Nada se refere a etapa, AEE ou modalidade. A dimensão é um identificador aberto.
- **Marcador `configuration_records`:** sem ele, a configuração é **não registrada**. Filhos e marcador só entram na mesma transação da versão (`created_at ≥ now()`), e nenhum filho entra depois do marcador.
- **Configuração completa** (`calendar_composition_norm_configuration_issue`) exige o marcador e a multiplicidade.
  - `compor-por-dimensao` exige pelo menos uma regra.
  - `exigir-exclusividade` com regras de dimensão é incoerente.
- **Ledger de homologação:**
  - sequência +1 com predecessor da mesma versão e raiz única;
  - a decisão alterna entre homologada e revogada;
  - `effective_from` fica dentro da vigência;
  - não se homologa configuração incompleta;
  - guarda `exercised_capability_id` como texto. Nenhuma capacidade foi definida.
- **Imutabilidade:** `forbid_mutation` em todas as tabelas.
- **ACL:**
  - tabelas com RLS e sem policy, sem privilégio para anon ou authenticated;
  - helpers INVOKER, com `search_path=''` e sem EXECUTE para clientes.

## Inspeção bitemporal (privada)
- `calendar_composition_norm_versions_at(on, knownAt)`: versões conhecidas que cobrem a data. Uma retificação conhecida substitui a anterior. Uma sucessão conhecida encerra a predecessora na véspera.
- `calendar_composition_norm_homologation_state_at(version, on, knownAt)` devolve `nao-homologada`, `homologada`, `revogada` ou `ambigua:cadeia-de-homologacao`.
- `calendar_composition_norm_state_at(on, knownAt)` devolve uma linha por versão e uma linha final.
  - Linha final: `sem-norma`, `configuracao-<motivo>`, `norma-nao-homologada`, `norma-homologada`, `ambigua:multiplas-normas-homologadas` ou `ambigua:versoes-concorrentes`.
  - Nunca escolhe uma norma dominante.

## Prova
`supabase/tests/b4_6_5a_calendar_composition_norm.sql` → `b465a-tests-ok`. Fixtures sintéticas inseridas pelo dono, com rollback total. Resíduos: zero. Cobre:
- ACL e RLS;
- ausência de writer e de capacidade, sem seed;
- ausência, não registrada, incompleta, incoerente e versão fechada;
- cadeia de versões;
- configuração sintética válida;
- knownAt passado sem ler o futuro;
- cadeia de homologação, vigência e revogação;
- ambiguidade explícita;
- sucessão;
- imutabilidade;
- cliente autenticado negado e leitores `access-denied`.

## Limites / pendências
- Não há writer: competência de construção/homologação da norma não decidida (não reutiliza capacidades do calendário).
- Integração ao resolver/homologação do calendário é etapa futura; primitivas são técnicas, não escolha da rede.
- Dimensões não têm catálogo; a semântica de cada `dimension_id` será fixada quando o motor consumir a norma.
- A regra "mesma transação" usa `created_at ≥ now()`; dentro de uma transação privilegiada o dono ainda poderia anexar filhos antes do marcador.
