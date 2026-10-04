# B4.6.7 — Calendário institucional operacional (UI + consumidores + instalação)

Escopo grande demais para uma única execução segura; dividido em 4 fatias sequenciais, cada uma com testes, rollback e registro na continuidade. Nenhuma fatia declara o calendário operacional até a última confirmar fonte positiva, login legítimo e importação ativa.

## Fatia 1 — Fonte estrita e leitura positiva
- `institutional-calendar-source.ts`: parsers estritos para as formas SQL atuais de `calendar_at`, `calendar_day_at`, `calendar_days_at`, `calendar_list_at`, `calendar_day_types_at`, `calendar_composition_norm_at` (snapshot µs, chaves exatas, access-denied preservado, erro de forma visível).
- Chaves de cache `userId#sessionRevision`; resposta de outra sessão descartada.
- Telas: listagem e consulta (grade + totais por período B2.4) só com dados homologados; IDs só no painel de auditoria.
- Se faltar snapshot completo para edição: reader autorizado por capacidade exata de construção (migration aditiva 0034 + teste Cloud rollback).

## Fatia 2 — Edição, norma e homologação pela Supervisão
- Editor versionado: tipos de dia com `school_day_effect` explícito (true/false/indeterminado), feriado/recesso/férias/conselho por tipo, base esperada, ato, motivo.
- Norma de exclusividade: criar e homologar (capacidades exatas próprias).
- Salvar/homologar/revogar calendário; botões só por capacidade efetiva; carregando nunca mostra demo.
- Importação 2027: lê `sigem.calendarios.v1` apenas quando a Supervisão pede; prévia com personalizações; original preservado; sem storage ⇒ referência marcada como referência. Conversão para snapshot concreto (sem precedência/fim de semana como norma; `countsAsSchoolDay` nulo continua indeterminado); documento/simbologia/layout/assinaturas guardados em snapshot de apresentação versionado (migration aditiva se necessário).
- Pré-requisitos (ano, organização e períodos B2.4, escolas, valores de oferta) explicados com links para Administração; importação bloqueada não finge sucesso. Vínculos Regular/EJA escolhidos por rótulos humanos; AEE nunca associado automaticamente.

## Fatia 3 — Consumidores ligados ao servidor
- `institutional-calendar-days.ts` passa a chamar `calendar_composed_days_at` por alocação canônica, UM knownAt por intervalo (≤400 dias), cache por sessão; nunca `structure.calendarId` do laboratório nem `calendars[0]`.
- Agenda, aulas previstas, chamada, horários, fechamento de período/frequência, documentos e `calendar-basis` usam contagens positivas com proveniência do servidor; feriado suprime só previsão.
- Turma multietapa: resultado por alocação, agregado preserva conflitos sem dominante.
- Conselhos por tipos declarados; impacto de alteração exibe alertas sem tocar registros fechados.

## Fatia 4 — Instalação legítima
- Migration aditiva: designação condicional de instalador para `supervisao@sigem.itap.gov.br` com registro da decisão do usuário (sem conta criada, sem senha, sem homologar política).
- Tela de instalação: cadastro pelo fluxo normal de autenticação (confirmação por e-mail mantida), formulário de pessoa/ato, política exibida para revisão antes de `install_sigem`; nenhuma pessoa, cargo ou regra atribuída automaticamente.
- Padrões das outras contas apenas documentados.

## Verificação (todas as fatias)
- Testes de UI positivos e negativos; teste Cloud fim a fim com rollback: feriado alterado em nova versão muda efeito, knownAt antigo preservado.
- Regressões calendário/diário/avaliação/horários/ciclo, typecheck, build, diff.
- Atualizar mapa de consumidores, continuidade e AGENTS.

## Ordem de execução
Começo pela Fatia 1 imediatamente após aprovação e sigo pelas demais sem parar, salvo bloqueio real (falta de conta ou de dado institucional), que será relatado por extenso.
