# B4.6.1 — Calendário institucional: estrutura + readers fechados

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Status: **estrutura técnica pronta; uso institucional INDISPONÍVEL.** Não existe calendário oficial operante.
Revisão técnica do contrato B4.6.0 feita pelo Codex; isso **não** é homologação institucional.

## O que existe (migration `0023_b4_6_1_calendar_structure.sql`; 0000–0022 intocadas)

| Tabela | Papel |
|---|---|
| `institutional_calendars` | identidade lógica (`cal-<uuid>`) |
| `calendar_versions` | versão append-only: `constituicao`/`sucessao`/`retificacao`, cadeia linear (versão+1, mesmo calendário), ato obrigatório, vigência, justificativa (exceto constituição), `recorded_by`, `created_at` (= knownAt). Ano + organização B2.4 por FK composta `(organização, ano)`; **escopo imutável na cadeia** |
| `calendar_version_periods` | relação explícita versão → período B2.4 (sem nome/datas copiados); período deve pertencer à mesma organização/ano |
| `calendar_day_types` / `calendar_day_type_versions` | tipos abertos; `school_day_effect` booleano **nulo = não declarado**, `false` é dado válido; cadeia linear própria |
| `calendar_version_ranges` / `_events` / `_day_assignments` | conteúdo filho imutável; cada linha **fixa a versão do tipo** (`day_type_version_id`), nunca "a última"; tipo deve ser conhecido até a criação da versão |
| `calendar_version_homologations` | ledger append-only por versão (`homologada`/`revogada`, sequência +1 com predecessor, `effective_from`, ato, capability exercida, engagement). Revogação e restauração são novos fatos. Aprova o **snapshot inteiro**: versão + filhos + versões de tipo fixadas. As referências B2.4 continuam resolvidas no tempo e são revalidadas na leitura |

- Todas as tabelas: RLS ativa **sem policy**; sem SELECT/DML para PUBLIC/anon/authenticated (e sem DML para `sandbox_exec`); `forbid_mutation` em UPDATE/DELETE; `service_role` mantém o acesso administrativo padrão.
- Filhos só entram na transação que criou a versão (marcador transacional do guard, padrão B4.3.1).
- Não há writer, capability, policy, seed, tipo, feriado nem data. Também não há regra de precedência/composição nem JSON de normas: **regras e motor estão fora do escopo**.

## Fronteira pública

`calendar_at(_calendar_id, _on, _known_at)` e `calendar_day_at(_calendar_id, _date, _known_at)`:
- `SECURITY INVOKER`, `search_path=''`, EXECUTE só para `authenticated`;
- devolvem **uma única linha `access-denied`**, sem tocar em tabela. A resposta é idêntica para calendário existente, inexistente, NULL ou ID arbitrário, e para conta com ou sem pessoa vinculada. Não revelam existência, conteúdo nem contagem.

Motivo: não há decisão sobre quem lê rascunho (D4) nem sobre quem consulta conteúdo homologado. A leitura de anos/períodos B2.4 não autoriza ver calendário.

## Núcleo técnico privado (EXECUTE revogado de PUBLIC/anon/authenticated; INVOKER; `search_path=''`)

- `calendar_effective_version(cal, on, knownAt)`:
  - verifica a cadeia conhecida; cadeia corrompida ⇒ `calendar:invalid-chain`;
  - retificação conhecida substitui a predecessora inteira; sucessão a substitui a partir do seu `valid_from`;
  - mais de uma versão efetiva ⇒ `calendar:ambiguous-effective-version`.
- `calendar_version_reference_issue(version, knownAt)`:
  - ano, organização e cada período ligado precisam estar ativos em **todos** os pontos de segmento. Pontos de segmento: início da versão + cada `valid_from` de versão B2.4 dentro da janela, com versões B2.4 escolhidas por maior número com `valid_from ≤ ponto` e `created_at ≤ knownAt`;
  - o conteúdo precisa estar dentro do ano vigente em cada ponto;
  - **não** se exige que um evento caia em período avaliativo (não há norma que o exija).
- `calendar_version_homologation_state(version, on, knownAt)`: estado `nao-homologada`, `homologada` ou `revogada`; cadeia inválida ⇒ exceção.
- `calendar_day_declarations(cal, date, knownAt)`: devolve as declarações cruas da data **sem precedência**. Estados:
  - `sem-versao-vigente`;
  - `referencia-b2-4-invalida`;
  - `nao-declarado`: nunca vira letivo nem fim de semana;
  - `declarado`;
  - `conflito-sem-regra`: só quando declarações com efeito letivo **declarado** divergem (true × false). Efeito nulo não participa nem vira false; eventos informativos coexistem com atribuições sem gerar conflito. Todas as declarações são devolvidas, também no conflito.

Esses helpers existem para preparar leituras futuras e para testar a estrutura. Não são RPC públicas.

## Prova

Arquivo `supabase/tests/b4_6_1_calendar_structure.sql` → `b46-tests-ok` (transação encerrada por RAISE, rollback). Cobre:
- ACL das tabelas e dos helpers; anon; conta com e sem pessoa; IDs existentes, inexistentes e NULL com resposta igual;
- ausência de writer e de capability;
- append-only (inclusive filhos); cadeias; proveniência;
- tipos com efeito nulo, false e true e versão fixada;
- B2.4 inexistente, incompatível, inativo, com mudança intermediária e por knownAt;
- retificação × knownAt; sucessão; escopo imutável;
- homologação, revogação e restauração;
- data não declarada (inclusive sábado); evento fora de período avaliativo aceito;
- ano inativo e organização inativa (B4.6.2a), antes e depois do knownAt.

As provas de conteúdo e temporalidade usam papel privilegiado: **provam o núcleo técnico, não autorização institucional nem uso público.**

Achado de teste: as versões B2.4 gravam `created_at = now()`, isto é, o início da transação. Por isso, no teste, o instante conhecido das mudanças B2.4 é explícito. Em produção cada gravação é uma transação própria.

## Fora do escopo / pendências

- Source/UI (B4.6.2); D5/aplicabilidade (B4.6.1b); governança/escrita (B4.6.3, depende de D4, R5 e capability exata); apresentação (B4.7); integrações (B4.10).
- Ainda não decidido: quem lê rascunho e quem consulta homologado; catálogo semântico de tipos; regras de precedência/composição; D6.
