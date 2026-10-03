# B3.1 — Hardening técnico da cadeia de matrícula

Base: auditoria em `.lovable/plan/auditoria-b3-commit-1345282-e-proposta-b3-1-hardening-antes-2026-10-02.md`.

## Baseline
A B3 está no commit `1345282`. O commit `8d331e8` **já continha parte da B3** (por exemplo, `institutional-enrollment-workspace.tsx`), então não é o "último antes da B3". A fronteira usada para auditar é o diff do `1345282`.

## Migrations
- `0002_b3_1_chain_hardening.sql`: registrada com só um comentário, por erro operacional. Não tem efeito.
- `0003_b3_1_chain_hardening_apply.sql`: é a B3.1 efetiva. Aditiva: redefine funções com as mesmas assinaturas e não altera as migrations históricas.

## Corrigido
1. `record_class_capacity`: a turma tem de estar ativa, e o ano compatível, em todo o período do registro (`class_fact_context`). Novo código `capacity:ends-before-start`. Não existe regra de lotação.
2. `movement_types_at(on, knownAt)`: novo reader. Devolve, por tipo, a maior versão homologada com `valid_from <= on`, conhecida em `created_at <= knownAt`. A tabela tem `created_at`, então o `knownAt` é real. Um rascunho posterior não revoga a homologada. `homologatedMovementTypes` não lê mais a tabela. `record_student_movement` exige essa versão (`movement:type-not-current`) e data efetiva.
3. Pai→filho, sem cascata:
   - término da inscrição com participação fora da janela é recusado;
   - retificação de `opened_on` revalida participações e término;
   - encurtar, adiar ou anular participação com alocação fora da janela é recusado;
   - término de alocação respeita o fim da participação e a turma ativa no intervalo;
   - anular término ou criar alocação aberta sob participação delimitada é recusado (`open-beyond-participation`).
4. Escola e ano na abertura: maior versão com `valid_from <= data`, a mesma regra de `class_record_context`. Antes, um "head" futuro podia esconder a versão vigente.
5. Tela: tipos de movimentação, ano letivo e turma por data. O rótulo da turma vem de `class_at`.
6. Segurança: `search_path = ''` nos escritores tocados e nomes qualificados. ACL reafirmada: `REVOKE PUBLIC, anon` e `GRANT authenticated`. Os auxiliares DEFINER continuam inacessíveis.

## Testes
- **Execução real no banco:** `supabase/tests/b3_1_cycle_enrollment_chain.sql` rodou na Cloud e terminou com `b31-tests-ok`. Cobre:
  - ACL e `search_path`;
  - acesso sem sessão;
  - escopo escolar;
  - turma de outra escola, de outro ano ou inativa;
  - capacidade ausente, com turma inativa ou fora do ano;
  - natureza não homologada;
  - sobreposição de participações;
  - segunda alocação;
  - término antes do início;
  - pai→filho (inscrição, participação e alocação);
  - identidade imutável;
  - retificação append-only com base esperada;
  - tipos de movimentação vigentes;
  - `knownAt` antes e depois de uma retificação;
  - RLS do reader.
  
  Depois da execução, as tabelas da cadeia, os catálogos e as políticas foram contados e estavam inalterados.
- **Somente unitários (TS):** `b3-1-hardening.test.ts` (wrappers, seleção por data, mensagens) e `b3-cycle-enrollment.test.ts`, que continua com verificações textuais da migration B3. As regras SQL não dependem mais delas.

## Continua bloqueado (norma)
- Catálogos de natureza da participação, situação do vínculo e tipos de movimentação.
- Coexistência e cardinalidade.
- Fronteira temporal da movimentação.
- Eixo da Oferta.
- Cascata de encerramento.
- Confirmação das reutilizações de capability (`manter-cadastro-de-turmas` para capacidade, `manter-catalogos-institucionais` para tipos).
- Homologação da política de capacidades.

## Pendente de ambiente
- Login institucional real e política homologada.
- `has_school_capability` avalia a data de hoje, não a data do fato.
- A lista de alunos do Diário decide a vigência pela data de hoje.

## B3.2 — Alocação com término explícito na criação
- Causa: `record_class_allocation` só criava alocação aberta; com a regra B3.1 (`open-beyond-participation`) era impossível registrar alocação contida numa participação já delimitada.
- Migration aditiva `drizzle/migrations/0004_b3_2_allocation_explicit_ending.sql`. Novo writer `record_class_allocation(_id, _participation_logical, _class, _valid_from, _act_ref, _supersedes, _correction_reason, _ended_on date, _ending_reason text)` (SECURITY DEFINER, `search_path = ''`). A assinatura de 7 argumentos virou SECURITY INVOKER e delega com término nulo (comportamento B3.1 inalterado).
- Término informado: início e término v1 (`class_allocation_ending_versions`) gravados na mesma transação; contidos na participação, na inscrição e na validade da turma/ano (`class_fact_context` sobre o intervalo inteiro). Término em correção (`_supersedes`) é recusado (`ending-on-correction-unsupported`): retificação continua por `record_class_allocation_ending`.
- Sem término: participação aberta aceita alocação aberta; participação delimitada recusa (`open-beyond-participation`). Sem término implícito, sem cascata, cardinalidade inalterada.
- Teste executado na Cloud: `supabase/tests/b3_2_allocation_explicit_ending.sql` → `b32-tests-ok`; tabelas da cadeia em zero depois.
