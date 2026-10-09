# Migração visual das rotas (N3.2 — inventário automático)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Critério: MIGRADA = rota ou componente renderizado usa `PageHeader`/`StatePanel` do design system; TÉCNICA = api/laboratório/diagnóstico/design-system; DOCUMENTO = impressão/documento; ANTIGA = demais (exige revisão manual). Heurística, não inspeção visual.

| Rota | Classe |
|---|---|
| `__root` | TÉCNICA |
| `acompanhamento-avaliacao` | MIGRADA |
| `acompanhamento-diarios` | MIGRADA |
| `acompanhamento-planejamento` | MIGRADA |
| `administracao-geral` | ANTIGA |
| `administracao` | MIGRADA |
| `ajuda` | MIGRADA |
| `alimentacao-escolar` | MIGRADA |
| `alimentacao-escolar_.cozinha` | MIGRADA |
| `alunos.$id` | MIGRADA |
| `alunos.editar.$id` | ANTIGA |
| `alunos.index` | MIGRADA |
| `alunos.novo` | ANTIGA |
| `alunos` | LAYOUT (só Outlet) |
| `assistente` | ANTIGA |
| `atuacoes-pedagogicas.index` | MIGRADA |
| `atuacoes-pedagogicas.nova` | MIGRADA |
| `atuacoes-pedagogicas` | LAYOUT (só Outlet) |
| `auditoria` | MIGRADA |
| `auth` | ANTIGA |
| `autorizacoes-familia` | MIGRADA |
| `avaliacao-desempenho` | MIGRADA |
| `avaliacoes-do-professor` | MIGRADA |
| `avisos` | MIGRADA |
| `base-de-conhecimento` | ANTIGA |
| `calendario-escolar.$calendarioId.documento` | DOCUMENTO |
| `calendario-escolar.$calendarioId.index` | ANTIGA |
| `calendario-escolar.index` | ANTIGA |
| `censo-escolar` | MIGRADA |
| `central-de-acessos` | ANTIGA |
| `central-de-integracoes` | ANTIGA |
| `ciece` | MIGRADA |
| `comunicacao-escolar` | MIGRADA |
| `configuracao-inicial` | MIGRADA |
| `departamento-pessoal` | MIGRADA |
| `design-system` | TÉCNICA |
| `diagnostico` | TÉCNICA |
| `diario.aulas` | MIGRADA |
| `diario.chamada.$registroId` | MIGRADA |
| `diario.chamadas` | MIGRADA |
| `diario.documentos` | DOCUMENTO |
| `diario.frequencia` | MIGRADA |
| `diario.index` | MIGRADA |
| `diario.registrar` | MIGRADA |
| `diario.registros.$registroId` | MIGRADA |
| `diario` | LAYOUT (só Outlet) |
| `diario.turmas.$turmaId.alunos.$alunoId.avaliacao` | MIGRADA |
| `diario.turmas.$turmaId.alunos.$alunoId.index` | MIGRADA |
| `diario.turmas.$turmaId.alunos.$alunoId` | LAYOUT (só Outlet) |
| `diario.turmas.$turmaId.alunos.index` | MIGRADA |
| `diario.turmas.$turmaId.alunos` | LAYOUT (só Outlet) |
| `diario.turmas.$turmaId.avaliacao.conselho` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.consolidacao` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.fechamento` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.index` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.instrumentos.$instrumentoId` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.instrumentos.novo` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.pauta.$instrumentoId` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.periodo` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao.situacao` | MIGRADA |
| `diario.turmas.$turmaId.avaliacao` | LAYOUT (só Outlet) |
| `diario.turmas.$turmaId.encerramento` | MIGRADA |
| `diario.turmas.$turmaId.frequencia.fechamento` | MIGRADA |
| `diario.turmas.$turmaId.index` | MIGRADA |
| `diario.turmas.$turmaId.projecao` | MIGRADA |
| `diario.turmas.$turmaId` | LAYOUT (só Outlet) |
| `diario.turmas.index` | MIGRADA |
| `diario.turmas` | LAYOUT (só Outlet) |
| `direcao` | MIGRADA |
| `documentos-escolares` | DOCUMENTO |
| `enturmacoes.index` | ANTIGA |
| `enturmacoes.movimentar` | ANTIGA |
| `enturmacoes.nova` | ANTIGA |
| `enturmacoes` | LAYOUT (só Outlet) |
| `estacao-administrativa` | ANTIGA |
| `familia` | MIGRADA |
| `ficha-longitudinal.$id` | MIGRADA |
| `gestao-escolar` | MIGRADA |
| `horarios.index` | MIGRADA |
| `horarios.profissionais.$profissionalId.impressao` | DOCUMENTO |
| `horarios.profissionais.$profissionalId.index` | MIGRADA |
| `horarios.profissionais.$profissionalId` | LAYOUT (só Outlet) |
| `horarios.profissionais.index` | MIGRADA |
| `horarios.profissionais` | LAYOUT (só Outlet) |
| `horarios.revisoes` | MIGRADA |
| `horarios` | MIGRADA |
| `horarios.turmas.$turmaId.alteracoes.index` | MIGRADA |
| `horarios.turmas.$turmaId.alteracoes.nova` | MIGRADA |
| `horarios.turmas.$turmaId.alteracoes` | LAYOUT (só Outlet) |
| `horarios.turmas.$turmaId.documentos.$tipo.$referenciaId` | DOCUMENTO |
| `horarios.turmas.$turmaId.editar` | MIGRADA |
| `horarios.turmas.$turmaId.impressao` | DOCUMENTO |
| `horarios.turmas.$turmaId.index` | MIGRADA |
| `horarios.turmas.$turmaId.nova` | MIGRADA |
| `horarios.turmas.$turmaId.publicar` | MIGRADA |
| `horarios.turmas.$turmaId.revisar` | MIGRADA |
| `horarios.turmas.$turmaId` | LAYOUT (só Outlet) |
| `horarios.turmas.$turmaId.versoes.$versaoId.comparar` | MIGRADA |
| `horarios.turmas.$turmaId.versoes.$versaoId.index` | MIGRADA |
| `horarios.turmas.$turmaId.versoes.$versaoId` | LAYOUT (só Outlet) |
| `horarios.turmas.$turmaId.versoes.index` | MIGRADA |
| `horarios.turmas.$turmaId.versoes` | LAYOUT (só Outlet) |
| `horarios.turmas.index` | MIGRADA |
| `horarios.turmas` | LAYOUT (só Outlet) |
| `horarios.unidades.$unidadeId.impressao` | DOCUMENTO |
| `horarios.unidades.$unidadeId.index` | MIGRADA |
| `horarios.unidades.$unidadeId` | LAYOUT (só Outlet) |
| `identidade-institucional` | MIGRADA |
| `importacoes` | MIGRADA |
| `inclusao` | MIGRADA |
| `index` | ANTIGA |
| `integracoes` | ANTIGA |
| `laboratorio.ciece` | TÉCNICA |
| `laboratorio.recuperacao` | TÉCNICA |
| `login` | ANTIGA |
| `mapa-estatistico-rede` | MIGRADA |
| `mapa-estatistico` | MIGRADA |
| `matriculas.nova` | ANTIGA |
| `matriculas` | LAYOUT (só Outlet) |
| `matrizes-curriculares.$id` | MIGRADA |
| `matrizes-curriculares.correspondencia` | ANTIGA |
| `matrizes-curriculares.importacao` | ANTIGA |
| `matrizes-curriculares.impressao.$id` | DOCUMENTO |
| `matrizes-curriculares.index` | MIGRADA |
| `matrizes-curriculares.nova-versao.$id` | MIGRADA |
| `matrizes-curriculares.nova` | MIGRADA |
| `matrizes-curriculares.rascunho.$id` | MIGRADA |
| `matrizes-curriculares` | LAYOUT (só Outlet) |
| `meus-diarios` | MIGRADA |
| `orientacao` | MIGRADA |
| `paineis` | MIGRADA |
| `pendencias` | MIGRADA |
| `planejamento` | MIGRADA |
| `preparacao-2027` | MIGRADA |
| `preparacao-ano` | MIGRADA |
| `profissionais.$id.atuacoes.$atuacaoId.editar` | MIGRADA |
| `profissionais.$id.atuacoes.$atuacaoId.encerrar` | MIGRADA |
| `profissionais.$id.atuacoes.$atuacaoId.index` | MIGRADA |
| `profissionais.$id.atuacoes.$atuacaoId.substituir` | MIGRADA |
| `profissionais.$id.atuacoes.$atuacaoId` | LAYOUT (só Outlet) |
| `profissionais.$id.atuacoes.index` | MIGRADA |
| `profissionais.$id.atuacoes.nova` | MIGRADA |
| `profissionais.$id.atuacoes` | LAYOUT (só Outlet) |
| `profissionais.$id.index` | MIGRADA |
| `profissionais.$id` | LAYOUT (só Outlet) |
| `profissionais.$id.vinculos.$vinculoId.editar` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.funcoes.$atribuicaoId.editar` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.funcoes.$atribuicaoId.encerrar` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.funcoes.$atribuicaoId.index` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.funcoes.$atribuicaoId` | LAYOUT (só Outlet) |
| `profissionais.$id.vinculos.$vinculoId.funcoes.index` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.funcoes.nova` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.funcoes` | LAYOUT (só Outlet) |
| `profissionais.$id.vinculos.$vinculoId.index` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.lotacoes.$lotacaoId.editar` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.lotacoes.$lotacaoId.index` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.lotacoes.$lotacaoId` | LAYOUT (só Outlet) |
| `profissionais.$id.vinculos.$vinculoId.lotacoes.index` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.lotacoes.movimentar` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.lotacoes.nova` | MIGRADA |
| `profissionais.$id.vinculos.$vinculoId.lotacoes` | LAYOUT (só Outlet) |
| `profissionais.$id.vinculos.$vinculoId` | LAYOUT (só Outlet) |
| `profissionais.$id.vinculos.novo` | MIGRADA |
| `profissionais.editar.$id` | MIGRADA |
| `profissionais.index` | MIGRADA |
| `profissionais.novo` | MIGRADA |
| `profissionais` | LAYOUT (só Outlet) |
| `prontidao-piloto` | MIGRADA |
| `publicacoes` | MIGRADA |
| `publico.$slug` | ANTIGA |
| `publico.index` | ANTIGA |
| `quadro-docente` | MIGRADA |
| `qualidade-dos-dados` | MIGRADA |
| `referencias-curriculares` | MIGRADA |
| `regras-avaliativas.$regraId.comparar` | MIGRADA |
| `regras-avaliativas.$regraId.editar` | MIGRADA |
| `regras-avaliativas.$regraId.index` | MIGRADA |
| `regras-avaliativas.index` | MIGRADA |
| `regras-avaliativas` | LAYOUT (só Outlet) |
| `regras-de-situacao.$regraId` | MIGRADA |
| `regras-de-situacao.index` | MIGRADA |
| `regras-de-situacao` | LAYOUT (só Outlet) |
| `regras-institucionais` | ANTIGA |
| `relatorios` | MIGRADA |
| `revisao-de-anomalias` | ANTIGA |
| `secretaria` | MIGRADA |
| `simulador` | MIGRADA |
| `sugestoes-de-horario` | MIGRADA |
| `supervisao-escolar` | MIGRADA |
| `tarefas` | ANTIGA |
| `transferencias.nova` | ANTIGA |
| `transferencias` | LAYOUT (só Outlet) |
| `turmas.$id` | MIGRADA |
| `turmas.designacao-previa` | ANTIGA |
| `turmas.editar.$id` | MIGRADA |
| `turmas.index` | MIGRADA |
| `turmas.nova` | MIGRADA |
| `turmas.oferta.$id` | MIGRADA |
| `turmas` | LAYOUT (só Outlet) |
| `unidades.$id` | MIGRADA |
| `unidades.index` | MIGRADA |
| `unidades` | LAYOUT (só Outlet) |
| `verificar.$codigo` | ANTIGA |
| `vinculos-letivos.novo` | MIGRADA |
| `vinculos-letivos` | LAYOUT (só Outlet) |

## Resumo N3.2
{'TÉCNICA': 5, 'MIGRADA': 130, 'ANTIGA': 28, 'LAYOUT': 34, 'DOCUMENTO': 8}

ANTIGA = migração visual pendente; nenhuma inspeção por breakpoint/zoom feita neste lote. PASS — SIGEM_GLOBAL_UX_REDESIGN_COMPLETE não declarado.

## N3.3 — revalidação (2026-10-07)
Mesma heurística, agora seguindo um nível de importação `@/…` da rota. Das 28 ANTIGAS: `index`, `publico.index` e `turmas.designacao-previa` passam a MIGRADA (o componente importado usa `PageHeader`/`StatePanel`). Nenhuma das 25 restantes é só redirecionamento; todas renderizam tela própria e continuam ANTIGA:
administracao-geral, alunos.editar.$id, alunos.novo, assistente, auth, base-de-conhecimento, calendario-escolar.$calendarioId.index, calendario-escolar.index, central-de-acessos, central-de-integracoes, enturmacoes.index, enturmacoes.movimentar, enturmacoes.nova, estacao-administrativa, integracoes, login, matriculas.nova, matrizes-curriculares.correspondencia, matrizes-curriculares.importacao, publico.$slug, regras-institucionais, revisao-de-anomalias, tarefas, transferencias.nova, verificar.$codigo.
Nenhuma tela migrada neste lote; homes, login, breakpoints e regressão visual pendentes. Sem PASS.

## NROUTE.2 — varredura final (2026-10-07)
Classificação pelo inventário automático (`classifyRoutes` em `src/components/sigem/route-visual-inventory.test.ts`, três níveis de importação), 210 arquivos de rota:
- **MIGRADA 163** — inclui as 25 ANTIGAS do N3.3, todas já sobre primitivas do design system (PageHeader/StatePanel/StationHome/…). Técnicas (`design-system`, `diagnostico`, laboratórios) contam aqui.
- **LAYOUT 34** — só `<Outlet />`.
- **DOCUMENTO 5** — impressões de horário (3), matriz e documento do calendário.
- **PÚBLICA/ENTRADA 6** — `login`, `auth`, `publico.index`, `publico.$slug`, `verificar.$codigo`, `verificar.carteirinha.$codigo` (visual próprio do portal público/entrada).
- **ANTIGA com justificativa 2** — `index` (capa institucional própria, só tokens) e `diario.turmas.$turmaId.avaliacao` (layout por parâmetros de busca). **ANTIGA sem justificativa: 0.**
- **PARCIAL corrigida neste lote:** título fora do padrão (h1 solto) passou a `PageHeader` em Variações para revisar, Matrizes curriculares, Correspondência curricular, Calendários (lista e calendário), Matrícula/participação/enturmação, Estação administrativa, Administração Geral e Nova matrícula; estado vazio genérico de Variações virou `StatePanel` explicado; rótulo "DP externo" do menu/Administração Geral alinhado à decisão vigente (DP administrativo no SIGEM). Guardado por teste novo no inventário. Nenhuma regra de negócio alterada.

### Smoke e screenshots por estação
`scripts/nroute2-station-screens.mjs`: 8 contas sintéticas efêmeras (@bo-fixture.invalid) — Secretaria, Direção, Professor, OP, CIECE, Gestão Pedagógica da Rede, Administrador Geral, RH — 33 telas principais. Resultado (`docs/nroute2/smoke-estacoes.json`): 32/32 rotas existentes com status 200, título de página presente, 0 erros de execução, 0 textos genéricos ("undefined", "[object Object]", "Not Found"); `/professor` não é rota (a home do docente é `/diario`) e cai na página "Página não encontrada" padronizada. Limpeza: 0 contas e 0 resíduos restantes. Screenshots em Files, pasta `nroute2-screenshots`.

**PASS técnico — nenhuma rota principal antiga sem justificativa.** INTERACTIVE_BROWSER_VALIDATION_PENDING: conferência humana com logins reais de setor (Supervisão, Avaliação, Alimentação não têm perfil sintético — ASSIGNMENT_PENDING), celular e zoom.

## NROUTE.3 — revarredura pós-campanha (2026-10-08)
Inventário automático (`route-visual-inventory.test.ts`) verde: nenhuma rota principal voltou a ANTIGA sem justificativa.

### Smoke headless por estação
`scripts/nroute3-station-smoke.mjs` + `scripts/nroute3/station_smoke.py`: 8 contas sintéticas efêmeras, 41 aberturas (computador + celular), resultado em `docs/nroute3/smoke-estacoes.json`, fotos em Files `nroute3-screenshots`.
- Todas as rotas existentes: status 200, título da aba "<página> — SIGEM", 0 erros de execução, 0 textos crus (undefined/NaN/[object Object]), 0 rolagem lateral no celular.
- Endereço inexistente: status 404 e "Página não encontrada" padronizada.
- Limpeza: 0 contas e 0 resíduos (a 1ª execução esgotou o tempo da limpeza; repetida até zerar; o script agora tenta 3 vezes).

### Corrigido
- Tela "Abrindo sua área" (carregamento) não tinha título principal: agora tem h1 oculto com o nome da página (13 aberturas sem h1 eram esse estado).
- Página não encontrada deixava a aba sem título: agora "Página não encontrada — SIGEM".
- Rota técnica `/design-system` aparecia como produto ("Padrões visuais" em Mais funções e link no rodapé da capa): removida do menu e do rodapé; a rota segue acessível por endereço.
- Teste novo `src/components/sigem/nroute3.test.ts` (menu sem rota técnica, todo item com título, 404 e carregamento com título).

### Pendências
- REVISAR/DEPENDE_DECISAO: breadcrumbs não são padrão do produto (componente existe, 0 telas usam); navegação = menu lateral + título da página. Adotar exige decisão.
- ASSIGNMENT_PENDING: Supervisão, Avaliação e Alimentação sem perfil sintético; smoke não as cobre com login.
- Smoke não reexecutado após as correções; INTERACTIVE_BROWSER_VALIDATION_PENDING com logins reais.

## UX.PREMIUM.0 (2026-10-09)
Fundação premium (tokens, AppShell, PageHeader, Card, Table) descrita em `ux-premium-sigem-2027.md`; migração das rotas piloto pendente (UX.PREMIUM.1).

## UX.PREMIUM.1 (2026-10-09) — PARCIAL
- Barra superior: trilha "domínio do menu › página" (`breadcrumbForPath`, teste `src/config/breadcrumb.test.ts`); rota fora do menu mostra só a página.
- Homes de estação (Admin, CIECE, Supervisão, Secretaria, Direção, OP, Avaliação, Alimentação, Docente, NEI, Família): já seguem tarefas por estação dos lotes NSEC/NAVAL/CIECE/admin/docente; reestruturação visual para "mesa de trabalho" premium NÃO migrada.
- Screenshots das homes: não produzidos — ambiente sem sessão autenticada.

## UX.PREMIUM.2 (2026-10-09) — PARCIAL
- Controles: botão padrão e campo de texto com 40px e raio da fundação (todas as telas de formulário herdam).
- Fluxos de Secretaria, Docente, OP/Direção, CIECE, Avaliação, Alimentação e NEI: NÃO migrados individualmente; harness e screenshots autenticados não executados (sem sessão).
