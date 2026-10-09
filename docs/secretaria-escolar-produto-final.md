# Secretaria Escolar — produto final (NSECRETARIA.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — SCHOOL_SECRETARIAT_FULLY_OPERATIONAL.

## Estado do banco (conferido)
class_enrollment_episodes 10.295 (convertidos em 2026-10-09 por decisão do proprietário; valid_from = fotografia 2026-07-31, não data de ingresso; 1 operação técnica `technical_convert_2026_class_bonds_to_episodes`, idempotente) · movement_type_definitions 0 · class_capacity_records 0. Ano 2026 = `historico-importado` (writers da Secretaria só aceitam `em-preparacao`/`operacional`).

## Jornadas × situação
| Jornada | Writer/reader existente | Bloqueio |
|---|---|---|
| Cadastrar/matricular | `enrollment_draft_*` → `enrollment_draft_complete` | sem ano operacional aberto |
| Colocar/trocar de turma | `secretariat_allocate_to_class`, `secretariat_reassign_class` | enturmação 2026 carregada; gravação exige ano aberto |
| Renovar | N5.4 | sem ano destino aberto |
| Transferir | `secretariat_record_exit` | 0 tipos de movimentação homologados |
| Emitir documento | `emit_school_document_v3` | modelos da Central não homologados (DOCS_LIFECYCLE_DB_PENDING) |
| Vida escolar | `student_school_life` | sem enturmação 2026 |
| Vagas | `secretariat_class_vacancies_at` | 0 capacidades registradas ⇒ "não informado" |
| Livro | `secretariat_enrollment_book_at` | sem enturmação 2026 |
| Mapa | fluxo N4.3/NMAP | regra do Mapa não homologada (MAP_RULE_PENDING) |
| Alimentação da escola | writers NAE | sem capabilities atribuídas |
| Relatórios | pack Secretaria (turmas pronto) | demais bloqueados pela enturmação |

## Decisões necessárias
1. ~~Converter vínculos 2026~~ — feito.
2. Homologar tipos de movimentação (transferência, evasão, cancelamento, remanejamento entre unidades).
3. Abrir 2027 (`em-preparacao`) — proprietário decidiu "não agora".
4. Homologar os modelos de documento da Secretaria.
5. Testes autenticados (escola A/B, mobile, PDF) — ambiente sem login.
