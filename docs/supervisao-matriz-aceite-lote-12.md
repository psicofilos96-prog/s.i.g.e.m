# Supervisão Escolar — Matriz de aceite técnico (Lote 12)

Situação atual: Registro de lote. Homologação institucional humana: NÃO ocorreu.

Fonte: o documento de 31 seções não está nos uploads; a matriz segue os 12 lotes pedidos.

| Lote | Núcleo | Tela | Fonte/gravação | Permissão | Teste | Status |
|---|---|---|---|---|---|---|
| 01 Acesso | supervision-access.ts | — | ledger em memória | papel×atribuição×capability | supervision-access.test, acceptance | regra pronta; ledger/RLS no banco BLOQUEADO (coordenador) |
| 02 Painel/Dossiê | supervision-dashboard.ts | /supervisao-escolar (Situação) | readers canônicos com sessão | RLS dos readers | supervision-dashboard.test | tela parcial (abas, sem dossiê completo) |
| 03 Visitas | supervision-visits.ts | Percurso (aguardando) | sem tabela | nível registrar | supervision-visits.test | BLOQUEADO (coordenador) |
| 04 Instrumentos | supervision-instruments.ts | — | sem tabela | conferir para publicar | supervision-instruments.test | BLOQUEADO (quem publica) |
| 05 Auditor | supervision-regularity.ts | — | regularityAudit da Secretaria | escolas visíveis | supervision-regularity.test, acceptance | regra pronta, sem tela |
| 06 Pedagogia | supervision-pedagogy.ts | — | dados entregues | escolas visíveis | supervision-pedagogy.test | regra pronta, sem tela |
| 07 Funcionamento | supervision-operations.ts | — | demand-center | registrar | supervision-operations.test | regra pronta, sem tela |
| 08 Não conformidades | supervision-nonconformity.ts | — | sem tabela | conferir/coordenar, pessoa ≠ observador | supervision-nonconformity.test, acceptance | BLOQUEADO (coordenador, prioridades) |
| 09 Orientações | supervision-guidance.ts | — | demand-center | destinatário elegível | supervision-guidance.test, acceptance | BLOQUEADO (modelos) |
| 10 GED/Indicadores | supervision-records.ts | — | report-engine | interno/restrito | supervision-records.test | BLOQUEADO (retenção) |
| 11 Interface | supervision-journey.ts | /supervisao-escolar (abas) | record_school_supervision (real) | registrar-acompanhamento-da-supervisao | supervision-journey.test | parcial: 1 de 7 etapas grava |
| 12 Aceite | supervision-acceptance.test.ts | — | — | 6 perfis sintéticos | acceptance (3) | regras provadas; E2E autenticado BLOQUEADO |

## Bloqueios
- E2E autenticado entre escolas/perfis: `SIGEM_TEST_HARNESS` ausente; contas sintéticas não podem ser criadas por esta sessão.
- Ledgers de visita, instrumento, não conformidade, expediente e acervo no banco + RLS: aguardam decisão de quem é o coordenador da Supervisão.
- PDF, anexos reais e rollback de migration: não há migration nova neste ciclo (nada a reverter); PDF/anexo só existem como regra.
- Catálogos pendentes: prioridades, modelos de expediente, retenção documental, termos de "laudo técnico".
