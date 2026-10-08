# B4.8 — Atribuição docente (turma ↔ elemento curricular ↔ profissional)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


**Status: modelo, leitores, writer fechado e painel somente leitura prontos; escrita depende de uma decisão.**

## Auditoria
- `institutional_engagements` já guarda `class_id`/`component_id`, mas é imutável e sem versão: serve para autorizar, não para registrar a regência ao longo do tempo.
- `institutional_engagement_scope_classes` dá alcance de turma, sem componente.
- A grade B4.4 liga blocos a atuações sem papel; B4.5 projeta o horário da própria pessoa a partir da grade.
- Não existia nenhum registro temporal da atribuição docente.

## Modelo (0063, 0064, 0065)
- `teaching_assignments` (`ta-<uuid>`, turma) + `teaching_assignment_versions` (append-only; constituição/sucessão/retificação; cadeia linear por `supersedes_id`; motivo exigido fora da constituição).
- Alvo = **versão de matriz + item** (`matrix_version_id`, `item_key`): cobre componente e elemento (campos de experiência da EI) sem forçar "disciplina".
- Papel = eixo aberto opcional (`role_scheme_id/value_id/version`) validado no catálogo homologado; sem taxonomia própria.
- Co-responsabilidade = várias atuações distintas no mesmo elemento, sem significado atribuído. Substituição (D8) **não** foi modelada.
- Proveniência: usuário, pessoa, atuação usada, instante; referência documental opcional.

## Writer `record_teaching_assignment_version` (fechado)
Sessão → capability `manter-atribuicao-docente` (escola da turma ou rede, política homologada) → validações → atuação da mesma escola e vigente em toda a janela → elemento existe na versão de matriz → matriz aplicável à turma (`class_curricular_matrices_at`) no início e no fim da janela → lock por turma → cabeça esperada (`stale-head`) → sucessão começa depois → **sobreposição** da mesma atuação no mesmo elemento em outra atribuição ⇒ recusa.
Nenhuma política concede a capability: hoje sempre falha com `capability:manter-atribuicao-docente`.
Limite declarado: aplicabilidade da matriz é verificada nos pontos de início/fim, não em cada dia intermediário; o leitor a revalida na data consultada.

## Leitores (INVOKER, RLS)
- `teaching_assignments_at(turma, data, knownAt)`: versões efetivas, com estado `vigente` / `matriz-nao-aplicavel-na-data` / `atuacao-nao-vigente` / `elemento-inexistente` e co-atuações.
- `my_teaching_assignments_at(data, knownAt)`: só as da própria pessoa.
- Retificação conhecida oculta a anterior; sucessão encerra a anterior na véspera; correção posterior não muda leitura antiga por knownAt.

## UI
Painel "Atribuição docente" na ficha da turma (`/turmas/$id`), somente leitura, com carregando/erro/vazio honestos. Sem botão de atribuir.

## Decisão mínima necessária
| Operação | Capability | Escopo | Atuações candidatas |
|---|---|---|---|
| Atribuir, substituir ou corrigir docente de um elemento da turma | `manter-atribuicao-docente` | escola da turma (ou rede) | `direcao-escolar`, `coordenacao-pedagogica` ou `secretaria-escolar` [school]; `gestao-pedagogica-da-rede` [network]; Administrador Geral só por regra explícita |

Abertas: D8 (papéis e substituições), uso do papel pelo Diário, migração das atuações com `component_id` legado (não é feita automaticamente).

## Testes
`supabase/tests/b4_8_teaching_assignments.sql` → `b48-tests-ok` (ACL, RLS, leitores INVOKER, nenhuma regra, falha fechada, sessão exigida; rollback). A 0065 corrigiu privilégios padrão que davam escrita direta nas tabelas novas. `src/features/classes/teaching-assignment.test.ts` (forma, falha fechada, mensagens).
Ainda não testados contra dados reais (a Cloud não tem turma, matriz ou atuação docente para montar um cenário com rollback): sobreposição, sucessão e knownAt do writer.

## N10.2.2 parte 2 (2026-10-07)
- Verificação automática em navegador sem janela, sem login, nos tamanhos 390×844 e 820×1180: /diario, /diario/chamada e /planejamento sem rolagem lateral; sem login o planejamento mostra "Entre para planejar".
- Não verificado com login (chamada/registro/troca de turma com dados reais).
- Pendentes: autosave EI nas telas reais, SIPE docente, SIA, PEI/PAEE no contexto do docente (N8.2.2 não concluído).
- Não passou: TEACHER_CLASSROOM_CORE_TECHNICALLY_COMPLETE.
