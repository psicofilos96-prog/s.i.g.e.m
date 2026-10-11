# Secretaria Escolar — Lote 1/4 (auditoria e lacunas)

Situação atual: Registro de lote (2026-10-11).

Fonte "Secretaria 2026.rar": não encontrada no projeto nem nos arquivos enviados; nada foi lido dela.

## Já existente (não refeito)
| Função | Onde |
|---|---|
| Matrícula guiada (rascunho → conclusão) | `/matriculas/nova`, `enrollment_draft_*` |
| Enturmação, remanejamento, encerramento | `secretariat_allocate_to_class`, `secretariat_reassign_class`, `secretariat_end_class_episode` |
| Transferência / saída | `/transferencias`, `secretariat_record_exit` |
| Vagas e Livro de matrícula | `/secretaria/vagas`, `/secretaria/livro-matricula`, `vacancy-center.ts` |
| Declaração de início da matrícula | `secretariat_declare_enrollment_start` |
| Família | autorizações por educando (`/autorizacoes-familia`) |
| Educacenso | leitura do cadastro canônico (`educacenso_people_at`) |
| Diário | estudantes só por `rosterStudents()` |

## Novo neste lote
`src/features/school-secretariat/service-desk.ts` (+ teste, 8 casos): protocolo de atendimento (tipo homologado, requerente só por HMAC, estado por eventos com base esperada, encaminhamento entre escolas, cancelamento com motivo, prazo só com calendário lido) e pré-matrícula (pedido; conversão só em rascunho da matrícula guiada; fila só com critério homologado).

## Lacunas
- Tabelas de protocolo/pré-matrícula no banco e tela da central: não criadas (dependem do catálogo de tipos de atendimento e prazos — decisão institucional).
- Rematrícula: sem rito configurado pela rede; não implementada como fluxo próprio.
- Critério da fila de pré-matrícula: decisão institucional.
- Dados: 9.811 matrículas sem início declarado; 48 estudantes em mais de uma escola a revisar.
- E2E autenticado escola A/B: não executado (sem conta sintética no ambiente).
