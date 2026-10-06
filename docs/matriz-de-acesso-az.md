# Frente AZ — Matriz de acesso por perfil (homologação técnica)

Fonte: política `politica-capacidades-diario`, versão homologada vigente (lida no banco em 2026-10-06).
"Disponível" = a política concede ao tipo de atuação. "Atribuída" = existe atuação real registrada.

| Perfil (tipo de atuação) | Escopo | Capabilities disponíveis | Atuações atribuídas |
|---|---|---|---|
| administrador-geral-do-sigem | rede | 110 | 1 (admin@) |
| cadastro-institucional-da-rede | rede | 13 | 0 |
| gestao-pedagogica-da-rede | rede | 23 | 0 |
| ciece-auditoria-coordenacao | rede | 9 | 0 |
| ciece-estatistica | rede | 5 | 0 |
| rh-profissionais-da-rede (LEGADO — não é perfil operacional futuro; DP é externo) | rede | 2 | 0 |
| secretaria-escolar | escola / turma+período | 37 | 0 |
| direcao-escolar | escola / turma+período | 36 | 0 |
| orientacao-pedagogica | escola / turma / turma+período | 17 | 0 |
| professor | escola / turma+componente+período | 19 | 0 |

Perfis fora da política de capabilities (autorização própria, explícita):
- Supervisão Escolar — designação de calendário (`calendar_authority_designations`), conta-órgão.
- Família — `guardian_authorizations` por educando/seção/vigência; recusa uniforme `family:not-authorized`.
- Mediador/AEE — `inclusion_mediation_assignments` vigente + `consultar-apoio-inclusivo`.
- Alimentação/Cozinha — vínculo cozinha↔escola; capabilities sem política concedida.
- Comunicação, integração, autorização de responsável, exportar-auditoria: capability existe, nenhuma política concede ⇒ fail-closed.

## UI × banco
Rotas são públicas como casca; todo dado vem de readers SECURITY INVOKER/RLS ou writers DEFINER que revalidam
`has_capability` no escopo. Esconder botão (`sessionActor()`) é só conveniência; a recusa é do banco.

## Provas E2E sintéticas (rollback, zero resíduos)
`supabase/tests/` (86 arquivos) cobrem por perfil: permitido, outra escola, IDOR, writer indevido, revogação,
vigência e ator técnico — ex.: `af_secretariat_e2e`, `ak_school_management_e2e`, `al_supervision_e2e`,
`ac2_family_e2e`, `ah_inclusion_e2e`, `ai_school_meals_e2e`, `aj_communication_e2e`, `aq_school_profile_e2e`,
`b1_4_security_hardening`, `b2_5_2_class_record_privileges`.

## Menor privilégio — achados (decisão humana, não corrigidos)
1. Administrador geral concentra 110 capabilities de rede, incluindo homologar a própria política — amplo por desenho de ativação; recomenda-se separar após atribuição real.
2. 315 funções DEFINER executáveis por autenticado (Advisor) — todas revalidam capability internamente; não é concessão.
3. Tabelas de configuração normativa legíveis por qualquer conta logada (26 achados da varredura) — decisão pendente.
Nenhum defeito técnico inequívoco encontrado; nada alterado no banco.

## Pendências
REAL_ROLE_ASSIGNMENT_PENDING · HUMAN_ROLE_VALIDATION_PENDING

## Atualização BF
- GOVERNANCE_REVIEW_PENDING: Administrador geral concentra 110 de 271 regras da v8, incluindo redigir e homologar a política. Ver `docs/frente-bf-administracao-governada.md`.
- RH permanece apenas como identificador LEGADO; o perfil operacional não existe (DP externo).
