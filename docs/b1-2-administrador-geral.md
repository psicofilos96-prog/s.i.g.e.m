# B1.2 — Administrador Geral do SIGEM (login mestre)

Data: 2026-10-04. Decisão institucional do usuário: deve existir um login mestre /
Administrador Geral que visualize e controle todos os setores. Esta etapa entrega a
arquitetura e a política; **não instala o SIGEM, não cria a conta e não troca o instalador.**

## Desenho

```text
conta própria do mestre → pessoa → atuação vigente "administrador-geral-do-sigem" (rede)
  → política homologada (v3) → 78 regras explícitas [network] → capacidade → escopo → ato
```

- Tipo de atuação próprio e transversal: não é Supervisão, CIECE, Secretaria, Direção etc.
- Sem flag, sem bypass de RLS, sem service_role no cliente, sem impersonação, sem wildcard.
- Cada ação fica atribuída à atuação do mestre (`capability_grant` devolve o engagement do mestre).
- Writers mantêm todas as invariantes (ato, vigência, versão, homologação, fail-closed).
- Capacidade futura não é herdada: entra no mestre só por nova versão explícita da política.

## Política v3 (draft)

| Versão | Status | Regras | Capacidades distintas | Supersedes |
|---|---|---|---|---|
| v1 | draft | 108 | 67 | — |
| v2 | draft | 121 | 78 | v1 |
| v3 | draft | 199 = 121 de v2 inalteradas + 78 do mestre | 78 | v2 |

Cada uma das 78 capacidades distintas presentes nos 9 tipos setoriais tem uma regra
`administrador-geral-do-sigem` com `scope_dimensions = {network}`. Inclui as 5 de
`sigem_administrative_capabilities()`. Nenhuma capacidade nova foi inventada.

## Por que `[network]` basta (auditoria dos helpers)

- `effective_scope_capabilities`/`has_network_capability`: atuação `rede` ⇒ linha `scope_level='rede'`.
- `school_capability_grant`/`has_school_capability`: aceita `rede` para escola existente.
- `effective_capabilities`/`has_capability`/`capability_grant`: atuação `rede` alcança toda turma;
  componente/período nulos (dimensão não restrita) casam com qualquer valor.
- Dois gates nomeavam o tipo de atuação e foram tornados semânticos (0052):
  `b2_4_authorizing_engagement` (anos/períodos: qualquer capacidade efetiva em rede) e
  `class_registry_school_grant` (turmas/organização de períodos: regra `[school]` em escola
  OU regra `[network]` em rede). Em v2 ambos continuam equivalentes ao comportamento anterior.
- `school_engagements_of_kinds` e o vínculo docente da grade continuam por tipo: designam
  QUEM leciona, não autoridade. O mestre não vira professor de um bloco.

## Invariante de completude

`sigem_general_admin_coverage_issues(policy)` (interna) devolve problemas quando a política
tem regras do mestre: `missing-sector-capability`, `missing-administrative-capability`,
`scope-not-network`, `master-only-capability`. `install_sigem` (`install:general-admin-coverage-incomplete`)
e `homologate_capability_policy` (`policy:general-admin-coverage-incomplete`) recusam política
incompleta. Nunca concede nada em runtime. Política sem mestre (v1, v2) não é afetada.

## UI

- `/administracao-geral`: aparece só se `general_admin_session()` devolver atuação vigente do
  mestre com capacidade homologada; lista os módulos existentes cujas capacidades vêm dessa atuação.
- Faixa: "Você está atuando como Administrador Geral do SIGEM", sem troca de perfil.
- Cabeçalho mostra o atalho "Administração Geral" só nessa condição. Telas e logins setoriais intactos.

## Testes

- `supabase/tests/b1_2_general_administrator.sql` (rollback): contagens, preservação, cobertura,
  instalação v3+mestre aceita só em sub-bloco, remoção/capacidade fictícia/capacidade futura detectadas,
  rede/escola/turma/componente/período, autoria, setor e Supervisão sem mestre, ACL.
- Regressões B1/B1.1 (`b1_1_…`, `b4_6_7d`, `b4_6_7e`) passam.
- `src/features/institutional-admin/general-admin.test.ts`.

## Fluxo futuro de instalação real (não executado)

1. Usuário informa o login mestre (identificador `@sigem.itap.gov.br`) e o ato institucional.
2. Migration explícita troca `sigem_installer_designation` (hoje imutável, `supervisao@…`) com origem auditada.
3. Conta criada pelo fluxo administrativo suportado (Admin Auth oficial), senha provisória entregue só ao usuário.
4. Revisão das 199 regras na tela de instalação (impressão digital de v3).
5. `install_sigem_reviewed(..., 'administrador-geral-do-sigem', v3, fingerprint, true)`.

## Bloqueios para a instalação real

- E-mail/login mestre ainda não informado.
- Ato institucional real de instalação (referência) ainda não informado.
- Natureza do ator (pessoa natural ou órgão) e nome a registrar.
- Troca da designação do instalador exige migration explícita (a designação atual é imutável e só é inserida se inexistente).
- Instalar com v3 deixa v1 e v2 permanentemente em rascunho (histórico).
