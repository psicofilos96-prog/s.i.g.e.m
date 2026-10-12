# Perfil Docente — Matriz de aceite (Lote 20)

**Situação atual:** Registro de lote (2026-10-12, base 674a0fb1). Não é homologação institucional: nenhum responsável humano validou estes fluxos.

## Evidências executadas
- Vitest: 23 arquivos / 108 testes do Perfil Docente passam (inclui `teacher-acceptance-l20.test.ts`, 7 cenários integrados com fixtures sintéticas em memória).
- Typecheck (`tsgo --noEmit`) limpo; build do preview OK.
- Banco (consulta somente leitura): `attendance_record_versions`, `assessment_entry_versions`, `assessment_instruments`, `attendance_closing_versions`, `descriptive_report_versions` com RLS ativo, sem SELECT para anon e sem INSERT/UPDATE direto para authenticated (escrita só por writers).

## Cenários (camada provada = núcleo puro)
| Cenário | Teste | Status |
|---|---|---|
| Professor escola A/B | acceptance L20 · teacher-security | OK núcleo |
| Substituto (período) | acceptance L20 · teacher-context | OK núcleo |
| Vínculo encerrado (leitura, histórico preservado) | acceptance L20 · teacher-history-closing | OK núcleo |
| Transferência / chamada retroativa | acceptance L20 · attendance-temporal | OK núcleo |
| EI sem nota/retenção | infant-portfolio · acceptance L20 | OK núcleo |
| EF iniciais/finais, EJA semestral | segment-profile | OK núcleo |
| AEE / NEI | inclusion-teacher-view | OK núcleo |
| Diário / ocorrência da aula | lesson-occurrence · lesson-central | OK núcleo |
| Notas / recuperação | teacher-grades · learning-record | OK núcleo |
| Fechamento / reabertura | teacher-history-closing · acceptance L20 | OK núcleo |
| PDF | teacher-reports | OK núcleo (geração no report-engine) |
| Família | teacher-security · teacher-requests | OK núcleo |
| RLS | consulta acima | Parcial: grants verificados; sem chamada autenticada |

## Matriz das 34 seções
O mapa seção → rota/módulo/tabela/lacuna vive em `src/features/teacher-diary/teacher-architecture.ts` e é verificado por `teacher-architecture.test.ts`. Lotes 04–19 adicionaram núcleos; **nenhum foi conectado a tela ou writer novo nesta frente**.

## Bloqueios reais
1. E2E/SQL autenticado não executado: `SIGEM_TEST_HARNESS` ausente; `teaching_assignment_versions` sem linhas; psql restrito não executa funções.
2. Núcleos L04–L19 sem tela e sem persistência própria (registro, chamada, materiais, solicitações, fechamento docente).
3. Normas não homologadas: avaliação EI/EF/EJA, frequência, supressão, política de fechamento/reabertura e de correção; capacidades sem titular.
4. 90 modelos de diário não enviados.
5. CI completo (`npm run verify`) não rodado nesta sessão por tempo; rodar antes da publicação.
