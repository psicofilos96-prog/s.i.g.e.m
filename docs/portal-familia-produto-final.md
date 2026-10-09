# Portal da Família — produto final (NFAMILY.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — FAMILY_PORTAL_FULLY_OPERATIONAL.

## Estado do banco (conferido)
guardian_authorizations 0 · student_card_issuances 0 · user_person_links 2 (nenhuma conta de responsável). Não existe tabela de vínculo responsável↔estudante importada: as planilhas 2026 não trazem responsáveis com identificador forte.

## Conflito de regra a decidir (ACCESS_MODEL_DECISION_PENDING)
O lote pede acesso **derivado** de vínculo responsável↔estudante + matrícula ativa, reaparecendo sozinho em outra escola. A regra vigente (`family-portal/AGENTS.md`) exige **autorização explícita** por educando, por seções e com vigência, concedida pela escola (`record_guardian_authorization_v3`), justamente para não inferir acesso. Hoje a autorização é por educando (não por escola), então a mudança de escola já não exige reset por escola; o que falta decidir é se a matrícula ativa passa a ser condição adicional automática. Não alterei a regra sem decisão.

## Itens × situação
| Item | Existente | Bloqueio |
|---|---|---|
| Home (estudantes, escola/turma) | portal + enturmação 2026 (10.295) | sem contas/autorizações de responsável |
| Comunicados | AJ (publicação + audiência derivada) | sem comunicados; envio externo pendente |
| Documentos | `emit_school_document_v3` | modelos não homologados |
| Carteirinha (foto privada, PDF, QR, status, histórico) | `record_student_card`, `verify_student_card`, `family_student_cards` | 0 emissões; fotos não carregadas |
| Autorizações (portaria/retirada) | só seções decididas | tipos de portaria/retirada não documentados ⇒ não criados |
| Frequência/notas | "aguardando publicação" até ato de publicação | regra de publicação à família não decidida |
| CID/laudo | nunca chega à família | — |

## Decisões necessárias
1. Modelo de acesso (acima).
2. Fonte de responsáveis com identificador forte (CPF) e criação das contas.
3. Tipos de autorização de portaria/retirada, se existirem.
4. Testes autenticados (2 filhos, transferência, família A/B, QR, mobile) — ambiente sem login.
