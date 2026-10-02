# Auditoria B3 (commit 1345282) e proposta B3.1 — hardening antes da B4

Diagnóstico feito por leitura da migration `0001_b3_...sql`, de `cycle-enrollment-source.ts`, `institutional-enrollment-workspace.tsx`, `institutional-roster.ts`, `fact-loader.ts`, `statistical-map.functions.ts` e da migration histórica dos tipos de movimentação. Nada foi editado nem executado no banco. Fronteira usada: o diff do commit 1345282, não o 8d331e8.

## Respostas pontuais

1. **record_class_capacity**: só confere se a turma existe (`institutional_classes`), a capacidade na escola atual, o limite, a base e a sobreposição. Não chama `class_at` em `_valid_from`/`_valid_until` e não confere o ano letivo. **Lacuna técnica (B).** Correção sem norma nova: exigir `class_at(_class, _valid_from, NULL)` ativa (e em `_valid_until`, se informado), reaproveitando o padrão de `record_class_allocation` / `class_fact_context`. Recusar com `capacity:class-inactive-on-date` quando a turma não estiver ativa na data.
2. **homologatedMovementTypes()**: `select ... eq(status,'homologada')` direto na tabela. Não resolve a versão vigente, ignora `valid_from` e não tem `knownAt`. Pode devolver várias versões do mesmo tipo, incluindo uma substituída ou uma com vigência futura. **Defeito técnico (B).** O mesmo vale para `record_student_movement`, que aceita qualquer `(id, version)` homologada. Proposta: reader `movement_types_at(_on, _known_at)` (SECURITY INVOKER, versão mais alta homologada com `valid_from <= _on`, ambiguidade = erro) e o writer de movimentação validando a mesma regra.
3. **Leituras diretas da UI B3**:
   - `institutional_academic_year_versions`: só o nome e o "head" por `supersedes_id`, ignorando a data de referência. Serve de apoio para rótulo, mas pode oferecer um ano inativo na data. O escritor recusa. **Aceitável, mas deve passar a usar o reader por data (B, baixa).**
   - `institutional_classes` (`id`, `academic_year_id`): identidade estrutural. Pode listar turma inativa na data, e o escritor recusa. **Aceitável.** O rótulo deveria vir de `class_at`.
   - `movement_type_definitions`: **atalho perigoso** (item 2).
   - Roster: `institutional_students` / `institutional_schools` para identidade. **Aceitável** (dívida B2.7 conhecida).
   - CIECE: `institutional_classes`.`school_id` é identidade e é aceitável. `student_identity_versions` é anterior à B3, fora do escopo.
4. **SECURITY DEFINER**: todos os escritores fazem `auth.uid() IS NULL → recusa`, conferem a capacidade por escola ou rede e têm `SET search_path = public`. Os auxiliares `b3_*_head` / `b3_allocation_ended_on` (DEFINER) estão sem EXECUTE para PUBLIC/anon/authenticated. Escritores: EXECUTE só para authenticated. DML direto revogado de anon/authenticated/sandbox_exec nas 10 tabelas. Os 4 escritores antigos estão revogados. **Nenhuma vulnerabilidade concreta encontrada.** Ressalvas:
   - `has_school_capability` avalia "agora", não a data do fato (dívida conhecida).
   - `search_path = public` em vez de `''` nos DEFINER: aceitável porque as tabelas são qualificadas ou estão em `public` e não há esquema gravável por usuário. Vale endurecer.
5. **Readers bitemporais**: o head por `knownAt` filtra a supersessão por `created_at`, então uma correção posterior não reescreve o passado. A ambiguidade é recusada. Ausência devolve lista vazia, e capacidade ausente aparece como "não registrada". Achados:
   - `_known_at NULL` = "tudo o que se conhece agora". Isso é aceito pelo SQL e é aceitável só se o chamador declarar a intenção. O workspace B3 passa `knownAt: null` sempre, o que é correto para operação, mas não há registro explícito disso.
   - Em `class_allocations_at`, o CTE `ends` não filtra escola/turma (só desempenho) e o teste de ambiguidade das alocações ignora `_class` (é mais rígido do que precisa, não é inseguro).
   - Término anulado volta a "sem término": coerente.
   - Inscrição não tem anulação: é lacuna funcional, não defeito de leitura.
6. **Escritores**:
   - Pontos confirmados: identidade imutável na correção (estudante, escola, ano; participação da alocação; turma da capacidade); escola e ano ativos em `opened_on`; turma da mesma escola e ano e ativa em `valid_from` da alocação; participação dentro da inscrição; alocação dentro da participação no início; base esperada e lock em todos; término antes do início recusado.
   - **Lacunas (B):**
     - (a) Encerrar a alocação não confere se o fim cabe na participação e na turma ativa.
     - (b) Encurtar ou encerrar a participação, ou encerrar a inscrição, não confere filhos vigentes depois da nova data. Isso pode gerar alocação órfã no período.
     - (c) Retificar `opened_on` da inscrição não revalida participações anteriores à nova data.
     - (d) O ano letivo é conferido só na abertura, não na vigência da participação ou da alocação.
     - (e) A escola ativa é resolvida por `ORDER BY valid_from, version_number`, sem excluir versão substituída. Convém alinhar ao head canônico.
   - Recusar é o comportamento seguro. Nenhuma norma de cascata é inventada.
7. **Consumidores**:
   - CIECE: sem `temporal`, as fontes B3 entram em `failedSources`. Não há demonstração com sessão.
   - Mapa: herda do `loadClassCanonicalFacts` com contexto declarado.
   - Diário: `isDiaryCloud() ? cloud : demo`; falha da fonte gera lista vazia e "indisponível". **Confirmado.**
   - Ressalva (B, baixa): o roster decide a vigência por `today` local, não por uma data de referência do Diário.
8. **Testes**:
   - Executados de fato: wrappers TS sobre um cliente simulado (o filtro bitemporal é do mock, então o SQL não é testado), `capacityOccupancy`, `b3Message`, `allocationMoveAvailability` e os argumentos que o CIECE passa aos readers.
   - Só por busca de texto na migration: todas as regras SQL (códigos de erro, REVOKE/GRANT, SECURITY INVOKER, ausência de INSERT).
   - Mínimo de testes SQL antes de homologar (`supabase/tests/b3_*.sql`, no padrão de `b2_*`, em transação com ROLLBACK):
     - antes/depois da correção com `knownAt`;
     - ambiguidade forçada;
     - turma de outra escola, de outro ano, ou inativa na data;
     - término antes do início;
     - retificação que preserva a versão anterior;
     - natureza não homologada;
     - sobreposição de participações;
     - segunda alocação vigente;
     - capacidade ausente e capacidade com turma inativa;
     - ACL: anon sem EXECUTE, authenticated sem INSERT, auxiliares DEFINER inacessíveis;
     - sem sessão → `session-required`;
     - capacidade fora do escopo escolar.
9. **Reutilização de capability**:
   - `manter-cadastro-de-turmas` para capacidade: coerente (a capacidade é atributo temporal da turma, e o escopo é a escola).
   - `manter-catalogos-institucionais` para tipos de movimentação: coerente (catálogo de rede, mesmo escopo da B2.6).
   - Nenhuma das duas tem contrato anterior que a determine. **Ambas ficam em validação institucional (C).**

## Quatro grupos

**(A) Concluído tecnicamente:**
- Cadeia inscrição → participação → alocação, com términos versionados e capacidade temporal fora da turma.
- Ocupação derivada e não gravada.
- Readers bitemporais com recusa de ambiguidade.
- Escritores com sessão, capacidade, lock e base esperada.
- ACL fechada e escritores antigos revogados.
- Consumidores sem demonstração com sessão.
- Falha fechada sem data.

**(B) Corrigir antes de homologar a B3:**
1. Validação temporal da turma em `record_class_capacity`.
2. Reader `movement_types_at` e validação da vigência em `record_student_movement`.
3. Limites dos filhos ao encerrar ou encurtar inscrição/participação, e o fim da alocação dentro da participação e da turma ativa.
4. Revalidação de filhos na retificação de `opened_on`.
5. Head canônico da escola ativa.
6. Testes SQL executáveis (item 8).
7. Baixa prioridade: anos letivos da UI por data, rótulo de turma por `class_at`, data de referência do roster e `search_path = ''` nos DEFINER.

**(C) Bloqueado por norma (permanece vazio):**
- Catálogos `natureza-da-participacao-educacional`, `situacao-do-vinculo` e tipos de movimentação.
- Regras de coexistência e cardinalidade.
- Política temporal da movimentação (`activeBoundaryDefinitionId`).
- Eixo da Oferta ↔ `educationalOfferId`.
- Cascata de encerramento (se o fim da inscrição encerra os filhos).
- Confirmação das duas reutilizações de capability.
- Homologação da política de capacidades v2.

**(D) Ambiente e login pendentes:**
- Execução real dos escritores com login institucional e atuação vigente.
- Política homologada (hoje nenhuma, então toda capacidade efetiva é vazia).
- Verificação do ACL efetivo no Cloud (`has_function_privilege`).
- Teste de RLS dos readers INVOKER com usuários de escolas diferentes.
- `has_school_capability` pela data do fato.

## B4 em paralelo?

Sim, a B4 pode começar em paralelo. Matriz, componentes, docentes, horários e calendário dependem de turma (B2.5), ano letivo e organização de períodos (B2.4) e atuações (B1), não da cadeia de matrícula. A dependência só aparece em pontos de integração da B4 com estudantes, como frequência ou diário por aluno sobre a grade persistida. Esses consumirão `class_allocations_at` por data, já estável. Os itens B1 a B6 devem fechar antes de qualquer consumidor da B4 ler alocações, e nenhum deles muda a forma dos readers.

## Se aprovado (B3.1, sem semear, sem norma nova)

- Uma migration nova que:
  - redefine `record_class_capacity`, `record_class_allocation_ending`, `declare_cycle_participation`, `record_cycle_enrollment_ending`, `constitute_cycle_enrollment` e `record_student_movement` com as validações do grupo B, recusando por código, sem cascata;
  - cria `movement_types_at` (INVOKER, REVOKE PUBLIC/anon, GRANT authenticated).
- `homologatedMovementTypes(on, knownAt)` passa a usar o reader; a UI passa a usar `class_at` e o reader de ano.
- Arquivo `supabase/tests/b3_cycle_enrollment.sql` com os cenários do item 8, mais a atualização do teste TS e do `AGENTS.md`.
