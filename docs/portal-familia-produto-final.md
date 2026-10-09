# Portal da Família — produto final (NFAMILY.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — FAMILY_PORTAL_FULLY_OPERATIONAL.

## Estado do banco (conferido)
guardian_authorizations 0 · student_card_issuances 0 · user_person_links 2 (nenhuma conta de responsável). Não existe tabela de vínculo responsável↔estudante importada: as planilhas 2026 não trazem responsáveis com identificador forte.

## Modelo de acesso (decidido pelo proprietário em 2026-10-09: automático pela matrícula)
Conferido no banco: `family_authorization` já exige (a) vínculo responsável↔estudante vigente (registro por educando, não por escola, ligado à pessoa da conta) **e** (b) matrícula ativa na data, resolvendo a escola em tempo de leitura (`family_enrollment_school`). Logo: término/transferência encerra o acesso ao contexto da escola; matrícula em outra escola da rede faz o acesso reaparecer no novo contexto; não há reset por escola. O registro do vínculo responsável continua sendo ato da escola (`record_guardian_authorization_v3`), porque o vínculo não pode ser inferido de sobrenome/endereço. Nenhuma migration foi necessária.

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
1. ~~Modelo de acesso~~ — decidido.
2. Fonte de responsáveis com identificador forte (CPF) e criação das contas.
3. Tipos de autorização de portaria/retirada, se existirem.
4. Testes autenticados (2 filhos, transferência, família A/B, QR, mobile) — ambiente sem login.
