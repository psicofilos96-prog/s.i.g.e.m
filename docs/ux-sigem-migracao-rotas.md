# Migração visual das rotas (N3.2 — inventário automático)

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
