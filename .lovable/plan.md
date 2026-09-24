# Etapa 11E — Consolidação do Diário Inteligente e Jornada Docente

## Objetivo
Unificar agenda, registro, chamada, Educação Infantil e histórico em uma única jornada docente orientada por "O que preciso fazer agora e onde parei?", sem novos módulos, sem redesign e sem avaliações.

## Camada de leitura integrada
- Novo `src/features/diary/diary-journey.ts`, com funções separadas (sem god object):
  - `journeyContext(search)` — professor, vínculo, atuação, turma, componente/campo, data e condição histórica/futura.
  - `agendaFor(context, date)` — projeção dos blocos da fonte integrada de Horários, sem cópia.
  - `lessonState(item)` — prevista, registro em elaboração, registrada, chamada pendente/em elaboração/concluída.
  - `nextAction(item)` — ação determinística única (Registrar aula/experiência, Continuar registro, Fazer/Continuar chamada, Ver registro).
  - `legitimatePending(context)` — somente rascunhos, chamadas parciais e aulas registradas sem chamada; datas futuras e aulas não ocorridas nunca geram pendência.
  - `resumeItems()` — itens "Continuar de onde parei" a partir dos stores de sessão.
  - `journeyHistory(filters)` — leitura temporal única de aulas, experiências EI e chamadas, com identidade estável por registro.
- Páginas passam a consumir essa camada; condicionais de status duplicadas em `diary-pages`, `lesson-pages`, `attendance-pages` e `infant-experience-pages` são removidas.

## Meu Diário
- Topo compacto: saudação discreta, data com anterior/hoje/próximo/seletor, contexto resumido e "Alterar contexto".
- Área dominante "Hoje": linha do tempo cronológica (hora, turma, componente/campo, situação em texto, uma ação).
- "Continuar de onde parei" discreto, só quando houver itens, com aviso de perda ao recarregar.
- Pendências compactas com linguagem neutra ("Pendente", "Em elaboração", "A concluir").
- Terminologia EI automática ("Registrar experiência").

## Contexto persistente e navegação
- Parâmetro `retorno`/search compartilhado preservando data, turma, componente e atuação em agenda → registro → chamada → detalhe → volta.
- Após concluir registro: "Fazer chamada" como ação principal; após chamada: "Voltar para Meu Diário" ou próxima ação legítima.
- Context switcher compacto (sheet no mobile): escola, atuação e turma/componente compatíveis; vínculo exibido quando ambíguo; nunca por lotação.
- Auditoria de todas as rotas do Diário: breadcrumbs, voltar, deep links, sem becos sem saída.

## Telas auditadas
- Registro: contexto vindo da agenda pré-preenchido e recolhido; opcionais preservados.
- Página da turma: identificação, atuação, próxima atividade, registros recentes, situação de chamadas, acesso ao histórico.
- Histórico, chamadas e frequência: busca + filtros principais, secundários sob "Filtros", chips ativos e "Limpar".
- Estados distintos: sem aulas, sem registros, sem atuação vigente, erro, acesso indisponível, não encontrado.
- Redução de badges redundantes e de cards aninhados, trocando por seções e divisores.

## Fixtures
- Complementar apenas o necessário para os cenários A–X (duas escolas no dia, dois vínculos, chamada parcial, tudo concluído, corresponsabilidade, conteúdo longo), sem registros contraditórios.

## Qualidade
- `diary-journey.test.tsx` com testes de percurso cobrindo os 40 itens pedidos.
- Suíte completa (>= 705), typecheck, lint e build.
- Playwright nas 11 telas em 390, 768, 1024, 1366×768, 1440, 1920, zoom 125%/150%, sidebar aberta/recolhida; corrigir e reinspecionar.
- Auditoria de esforço (contagem de ações por percurso) no relatório.

## Fora de escopo
Backend, persistência, autenticação/autorização reais, avaliações, notas, médias, recuperação, frequência normativa, abono, documentos oficiais, auditoria definitiva, Módulos 12/13.
