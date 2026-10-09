# BQ.1 — Matriz real de autoridades institucionais

## Situação atual
- Classe: **Canônico** (decisão do gestor do SIGEM, 2026-10-09). Prevalece sobre propostas/diretrizes históricas conflitantes.
- Migrations: `0253_bq1_institutional_authority_matrix`, `0254_bq1_actor_accepts_declared_institutional_organ`, `0255_bq1_revoke_identity_direct_dml`.
- Prova de execução: `supabase/tests/bq1_authority_matrix.sql` (termina em RAISE; nada persiste). Prova estática: `src/test/invariants/bq1-authority-matrix.test.ts`.

## Mecanismo
- Catálogo explícito `sigem_capability_catalog` (183 capabilities). Regras de estação v3 homologadas. Admin recebe **cada** capability do catálogo, sem curinga; `sector_admin_coverage_issues()` recusa lacuna. Capability nova = nova linha no catálogo + regra Admin explícita.
- Nada de service_role na UI, RLS desligada, SQL arbitrário ou DML direto por papel do app (provado por `has_table_privilege`).
- Autoria: `institutional_actor_person()` grava o ator real da sessão — pessoa natural, órgão institucional declarado (caso do Admin) ou principal de setor (`*_principal_id`). Nunca executor técnico.

## Matriz
| Estação | Alcance | Pode |
|---|---|---|
| Supervisão | rede | construir, editar, homologar, publicar calendário; modelos externos; histórico |
| Avaliação | rede | programas/ciclos, importação, validação, publicação, indicadores, painéis, consulta rede→estudante, relatórios, qualidade |
| CIECE | rede | consulta de rede, Mapa (receber/devolver/aprovar), fontes censitárias, relatórios, **correção cadastral** via `record_student_identity_version` com autoria principal CIECE |
| Alimentação | rede | todo o domínio NAE, ciclo autônomo (sem dupla conferência de outro setor); consulta restrições individuais |
| Direção | própria escola | solicitações e registros de Alimentação, restrição alimentar individual, retorno dos pedidos, evidências |
| Inclusão/NEI | rede | visão AEE/NEI, registros restritos, termos, mediação, relatórios |
| Admin Geral | rede | tudo, por capability explícita |
| Família | matrícula ativa | acesso derivado de `family_enrollment_school()` (matrícula aberta); termina na data do encerramento e volta na nova escola sem nova concessão |

Auditoria: Admin consulta/exporta tudo com minimização; demais setores sem acesso transversal novo.

## Diretrizes históricas substituídas
- “CIECE só aponta erro” → CIECE corrige cadastro por writer governado.
- “Alimentação exige dupla conferência por outro setor” → ciclo autônomo.
- “Família: revogação manual por transferência” → derivação automática da matrícula.
- “Writers NAE/Avaliação exigem pessoa natural” → aceitam ator institucional real.

## Pendência
`ACCOUNT_IDENTIFIER_PENDING — INCLUSAO_NEI_CENTRAL`: nenhum endereço definido no acervo; estação, regras e capabilities prontas, conta não criada.
