# Mapa da documentação vigente (NDOCS.1, 2026-10-08)

Gerado por varredura de `docs/` contra o HEAD. Prevalência: `AGENTS.md` (raiz e por diretório) > `sigem-documentacao-canonica.md` > Referência vigente > Registro de lote > Histórico. Nenhum segredo é reproduzido; a varredura de `sb_secret_`/JWT/`sk_live_` não encontrou chaves.

## Resultado da varredura
- Caminhos de código citados (`src/`, `supabase/`, `scripts/`): todos existem no HEAD.
- Comandos `bun/npm run …` citados: todos existem em `package.json`.
- Afirmação superada corrigida: "DP é externo / RH não é módulo" em `sigem-documentacao-canonica.md` (decisão N12.1).
- Documentos com contagens instantâneas sinalizadas: 65.
- Cada documento ganhou a seção "Situação atual" com classe e prevalência; o texto histórico foi preservado.

## NDOCS.2 (2026-10-08)
- As 72 referências vigentes foram revisadas contra HEAD, AGENTS, migrations, rotas e decisões recentes; 15 corrigidas, original preservado como histórico.
- Canônicos por domínio e lista de correções: `documentos-canonicos-por-dominio-ndocs2.md`.

## NDOCS.3 (2026-10-08)
- Reconciliação final com o HEAD (após NSEC.4, NDB.4, NIMPORT.4, NTEST.4, NVERIFY.2, NOPS.3, NDATA.3).
- Rebaixados a Histórico por superação: `concorrencia-nconc1.md` (→ NCONC.2), `seguranca-leitura-ampla-nsec3.md` (→ NSEC.4), `auditoria-pdfs-ndoc2.md` (→ NPDF.3/NPRINT.4).
- Contradição eliminada: baseline de contagens vigente é `auditoria-dados-oficiais-ndata3.md`; `qualidade-integridade-dados-oficiais.md` mantém só os contratos de verificação.
- CAL.COUNT.1: PASS (200 dias) em `cal-count-1-reconciliacao.md`; menções a "198 sem PASS" em relatórios anteriores são históricas.
- Canônicos finais por tema: verificação `rotina-de-verificacao.md`; segurança `seguranca-verificacao-final-nsec4.md`; schema `integridade-schema-final-ndb4.md`; arquivos `storage-arquivos-privados.md`; importações `importacoes-nimport2.md`; testes `matriz-fluxo-teste.md`; operação `prontidao-operacional-recuperacao.md`; dados `auditoria-dados-oficiais-ndata3.md`; desempenho `performance-escala-sigem.md`.

## Índice por módulo
- Índice técnico único por domínio (vigente, lotes, pendências, histórico): `indice-tecnico-documentacao.md`.
- Arquitetura e regras: `sigem-documentacao-canonica.md`, `invariantes-do-sigem.md`, `mapa-contratos-db-ndb2.md`, `security-definer-function-inventory.md`.
- Verificação e release: `rotina-de-verificacao.md`, `prontidao-operacional-recuperacao.md`, `engenharia-de-release.md`, `matriz-fluxo-teste.md`, `test-harness-institucional.md`.
- Observabilidade: `observabilidade-nobs3.md`, `recuperacao-erros-nobs4.md`, `observabilidade-e-incidentes.md`, `runbook-integridade-e-recuperacao.md`.
- Acessos e sessão: `central-de-acessos.md`, `auditoria-autenticacao-sessao-nauth2.md`, `sigem-contas-padrao.md`.
- Calendário: `calendario-modelos-externos.md`, `b4-6-*` (histórico de construção).
- Secretaria e documentos: `secretaria-escolar-produto-completo.md`, `documentos-escolares-motor.md`, `idempotencia-nidem1.md`.
- Segurança, schema e dados: `seguranca-verificacao-final-nsec4.md`, `integridade-schema-final-ndb4.md`, `storage-arquivos-privados.md`, `auditoria-dados-oficiais-ndata3.md`, `performance-escala-sigem.md`.
- Importações: `importacoes-nimport2.md`, `frente-bg-importacoes-governadas.md`.
- Interface: `vocabulario-interface-nui2.md`, `ux-sigem-design-system.md`, `ux-sigem-migracao-rotas.md`, `ux-premium-sigem-2027.md` (registro UX.PREMIUM.0), `ux-premium-inventario-rotas.md` (inventário UX.PREMIUM.4).

## Todos os documentos
| Documento | Título | Classe | Contagens instantâneas | Atualização |
|---|---|---|---|---|
| `documentos-canonicos-por-dominio-ndocs2.md` | NDOCS.2 — Documentos canônicos por domínio (2026-10-08) | Canônico | — | — |
| `aceite-avancado-sigem.md` | Reaceite avançado do SIGEM — estado reconciliado (2026-10-05) | Histórico | sim | — |
| `aceite-definitivo-piloto.md` | Aceite definitivo — SIGEM pronto para piloto? | Histórico | sim | — |
| `acompanhamento-avaliacao-produto.md` | Acompanhamento e Avaliação — matriz de produto (Lote N6) | Histórico | — | — |
| `isolamento-demonstracao-ndemo2.md` | NDEMO.2 — Sessão real nunca recebe demonstração (2026-10-08) | Registro de lote | — | — |
| `admin-busca-notificacoes-auditoria-nadm2.md` | NADM.2 — Admin, busca, notificações e auditoria (2026-10-07) | Registro de lote | — | — |
| `ambiente-canonico-sigem.md` | Ambiente canônico do SIGEM | Referência vigente | — | — |
| `ano-operacional-2027-e-virada.md` | Ano operacional 2027 e virada de ano | Referência vigente | sim | — |
| `api-de-integracao.md` | API de integração v1 e webhooks | Referência vigente | — | — |
| `auditoria-autenticacao-sessao-nauth2.md` | NAUTH.2 — Autenticação e ciclo de sessão (2026-10-07) | Registro de lote | — | — |
| `auditoria-central-naud2.md` | NAUD.2 — Central de Auditoria (2026-10-08) | Registro de lote | — | — |
| `auditoria-do-amanhecer.md` | Auditoria do amanhecer — consolidação após AQ–BA (2026-10-06) | Histórico | sim | — |
| `auditoria-estrutural-final-pre-2027.md` | Auditoria estrutural final pré-2027 (Frente BP) | Histórico | sim | — |
| `auditoria-exportacoes-nexp.md` | Auditoria de exportação e download (2026-10-07) | Registro de lote | sim | — |
| `auditoria-integrada-bb-bl.md` | Auditoria integrada BB–BK (Frente BL) — 2026-10-06 | Histórico | sim | — |
| `auditoria-integrada-pos-lotes-2.md` | Auditoria integrada pós W.2/Z.2/AA.2/AB.2/AC.2/AD.2 (2026-10-06) | Histórico | — | — |
| `auditoria-pdfs-ndoc2.md` | NDOC.2 — Auditoria de PDFs (2026-10-07) | Histórico | — | — |
| `auditoria-pdfs-npdf3.md` | NPDF.3 — Revalidação de PDFs pelo harness (2026-10-08) | Registro de lote | — | — |
| `auditoria-impressao-nprint4.md` | NPRINT.4 — Consistência final de impressão (2026-10-08) | Registro de lote | — | — |
| `auditoria-pre-cloud-diario.md` | Auditoria pré-Cloud do Diário (somente leitura) | Histórico | — | — |
| `auditoria-roadmap-a-r.md` | Auditoria do roadmap A–R (Cloud real, 05/10/2026) | Histórico | sim | — |
| `auditoria-sistemica-pos-nae8.md` | Auditoria sistêmica pós-NAE.8 (Frente BN) — 2026-10-06 | Histórico | sim | — |
| `auditoria-temporal-ntemp1.md` | NTEMP.1 — Auditoria de consistência temporal (2026-10-08) | Registro de lote | — | — |
| `avaliacao-arquitetura.md` | Módulo 12 — Arquitetura do domínio de avaliação (Etapa 12A) | Referência vigente | — | — |
| `avaliacao-desempenho-rede.md` | Avaliação e Desempenho — camada analítica da rede (migration 0075) | Referência vigente | — | — |
| `b1-2-administrador-geral.md` | B1.2 — Administrador Geral do SIGEM (login mestre) | Histórico | sim | — |
| `b1-3-ativacao-inicial.md` | B1.3 — Ativação institucional inicial sem ato externo | Histórico | sim | — |
| `b1-4-fechamento-operacional.md` | B1.4 — fechamento operacional da fundação | Histórico | sim | — |
| `b2-4-anos-e-organizacoes.md` | B2.4 — Ano e organização de períodos letivos | Histórico | sim | — |
| `b2-5-1-turmas-contrato-autorizacao.md` | B2.5.1 — Contrato e autorização de Turmas | Histórico | — | — |
| `b2-5-2-turmas-historico-cadastral.md` | B2.5.2 — identidade e histórico cadastral da Turma | Histórico | sim | — |
| `b2-b3-gate-primeira-escola.md` | Gate B2/B3 — primeira escola real | Histórico | — | — |
| `b3-1-hardening-cadeia-matricula.md` | B3.1 — Hardening técnico da cadeia de matrícula | Histórico | sim | — |
| `b3-3-posicao-curricular-alocacao.md` | B3.3 — Posição curricular individual da alocação | Histórico | — | — |
| `b4-0-auditoria-organizacao-pedagogica.md` | B4.0 — Auditoria preparatória da Organização Pedagógica (contrato da B4) | Histórico | — | — |
| `b4-1-matriz-curricular.md` | B4.1 — Matriz curricular canônica (estrutura institucional) | Histórico | sim | — |
| `b4-2-0-contrato-correspondencia-posicao-matriz.md` | B4.2.0 — Contrato técnico: correspondência posição individual → matriz curricular | Histórico | sim | — |
| `b4-2-1-homologacao-versao-matriz.md` | B4.2.1 — Base estrutural da homologação de versões de matriz (E1) | Histórico | — | — |
| `b4-2-2a-perfil-correspondencia.md` | B4.2.2a — Estrutura do perfil de correspondência (E2) | Histórico | — | — |
| `b4-2-2b-correspondencia-posicao-matriz.md` | B4.2.2b — Correspondência E3: chave de posição individual → matriz lógica + coluna | Histórico | — | — |
| `b4-2-3-associacao-especifica.md` | B4.2.3 — Associação explícita específica da turma (E4) | Histórico | — | — |
| `b4-2-4-resolucao-integrada.md` | B4.2.4 — Resolução integrada E1–E4 (somente leitura) | Histórico | — | — |
| `b4-2-5-projecao-turma-ui-readonly.md` | B4.2.5 — Projeção da turma, fonte TS e painel somente leitura | Histórico | — | — |
| `b4-2-classificacao-proposta-d1.md` | B4.2 — Proposta de classificação (D1) — PROPOSTA, NÃO NORMA HOMOLOGADA | Histórico | — | — |
| `b4-2-d1-catalogo-proposto-22-posicoes.md` | B4.2 — D1: contrato canônico das 22 posições e importação governada | Histórico | — | — |
| `b4-2-planejamento-turma-matriz.md` | B4.2 — Turma → Matriz (planejamento; NÃO iniciada) | Histórico | — | — |
| `b4-3-4-5-prontidao-e-quadro-de-decisao.md` | B4.3/B4.4/B4.5 — Prontidão técnica e quadro de decisão (2026-10-05) | Histórico | — | — |
| `b4-3-jornada-turma.md` | B4.3 — Jornada canônica da turma | Histórico | — | — |
| `b4-4-grade-turma.md` | B4.4 — Grade semanal recorrente canônica da turma | Histórico | — | — |
| `b4-5-horario-profissional.md` | B4.5 — Horário do profissional como projeção | Histórico | sim | — |
| `b4-6-0-contrato-calendario-institucional.md` | B4.6.0 — Auditoria e contrato do calendário institucional (somente documentação) | Histórico | sim | — |
| `b4-6-1-calendario-estrutura.md` | B4.6.1 — Calendário institucional: estrutura + readers fechados | Histórico | — | — |
| `b4-6-2a-calendario-source-rotas.md` | B4.6.2a — Calendário: source institucional + fronteira das três rotas | Histórico | — | — |
| `b4-6-2b-auditoria-consumidores-calendario.md` | B4.6.2b.0 — Auditoria dos consumidores do calendário (diagnóstico + plano) | Histórico | sim | — |
| `b4-6-3a-calendario-motor-efeitos.md` | B4.6.3a — Calendário operacional: decisão de competência + motor de efeitos | Histórico | sim | — |
| `b4-6-4b-calendario-aplicabilidade.md` | B4.6.4b — Aplicabilidade explícita do calendário (estrutura D5) | Histórico | — | — |
| `b4-6-5a-norma-composicao-calendario.md` | B4.6.5a — Estrutura da norma de seleção/composição de calendários | Histórico | — | — |
| `b4-6-5b-motor-composicao-calendario.md` | B4.6.5b — Motor puro de composição de calendários | Histórico | — | — |
| `b4-6-5c-ponte-composicao-efeitos.md` | B4.6.5c — Ponte composição → efeitos dos dias (origem verificada, acesso fechado) | Histórico | sim | — |
| `b4-6-6-calendario-autorizado.md` | B4.6.6 — Calendário: autorização, writers da norma, homologação funcional e leitores | Histórico | sim | — |
| `b4-8-atribuicao-docente.md` | B4.8 — Atribuição docente (turma ↔ elemento curricular ↔ profissional) | Histórico | — | — |
| `b4-v1-fechamento-oferta.md` | Frente V.1 — Fechamento da oferta/grade/regência 2027 | Histórico | sim | — |
| `baseline-2026-vs-operacao-2027.md` | Baseline 2026 × Operação 2027 | Histórico | sim | — |
| `n2026-importacao-base-oficial.md` | N2026.IMPORT.0 — inventário e plano de carga 2026 | Referência vigente | sim | — |
| `n2026-import-1-escolas-infraestrutura.md` | N2026.IMPORT.1 — escolas e infraestrutura | Registro de lote | sim | — |
| `n2026-import-2-profissionais-jornadas.md` | N2026.IMPORT.2 — profissionais, vínculos, lotações, jornadas | Registro de lote | sim | — |
| `n2026-import-3-turmas-alunos-matriculas.md` | N2026.IMPORT.3 — turmas, alunos, matrículas, enturmação | Registro de lote | sim | — |
| `n2026-import-4-censo-snapshot-oficial.md` | N2026.IMPORT.4 — snapshot oficial do Censo 2026 | Registro de lote | sim | — |
| `n2026-reconciliacao-censo.md` | N2026 — reconciliação Censo × base individualizada | Registro de lote | sim | — |
| `n2026-referencia-2027.md` | N2026.REFERENCE.2027 — 2026 como referência de 2027 | Referência vigente | sim | — |
| `homologacao-real-por-perfil.md` | HOMO.REAL.1 — homologação operacional por perfil | Registro de lote | sim | — |
| `central-documentos-institucionais.md` | DOCS.PRO.1 — Central de Documentos e modelos | Registro de lote | sim | — |
| `gerador-universal-relatorios.md` | REPORT.PRO.1 — gerador universal de relatórios | Registro de lote | sim | — |
| `mapa-estatistico-final.md` | NMAP.FINAL.1 — Remanejados e Mapa I–VI | Registro de lote | sim | — |
| `bq0-preflight-configuracao-2027.md` | BQ.0 — Pré-flight da configuração institucional controlada 2027 | Histórico | sim | — |
| `bq1-contas-estacoes-setoriais.md` | BQ.1 — Contas institucionais/setoriais e estações (estado: PARTIAL) | Histórico | sim | — |
| `busca-ativa-alunos-servidores.md` | Busca ativa de alunos e servidores | Referência vigente | — | — |
| `busca-e-avisos-nsearch2.md` | NSEARCH.2 — Busca global e avisos | Registro de lote | — | — |
| `calendario-modelos-externos.md` | Calendário — modelos externos de apresentação (CAL.EXT.1) | Referência vigente | sim | — |
| `campanha-noturna-sigem.md` | Campanha noturna SIGEM — registro de produtização | Histórico | sim | — |
| `carga-educacenso-2026-lote-1.md` | Carga real EducaCenso 2026 — LOTE 1 (Frentes B–E) | Histórico | — | — |
| `carga-educacenso-2026-lote-2.md` | Carga EducaCenso 2026 — Lote 2 (correção temporal C + Frente F) | Histórico | sim | — |
| `central-de-acessos.md` | Central de acessos — inventário de logins e redefinição de senha (Lote N1) | Referência vigente | — | — |
| `ciece-inventario-fontes-censo.md` | Inventário das fontes de Censo/INEP/consolidados (N4.4, 2026-10-07) | Referência vigente | — | — |
| `ciece-mapa-censo-gpe-produto.md` | CIECE / Mapa / Censo / GPE — matriz de produto (Lote N4) | Referência vigente | sim | — |
| `ciece-mapa-projecao-rede.md` | CIECE / Mapa Estatístico — projeção canônica da rede | Referência vigente | — | — |
| `ciece-operacional.md` | Frente O — CIECE operacional | Referência vigente | — | — |
| `comunicacao-notificacoes.md` | Comunicação e notificações (migration 0077) | Referência vigente | — | — |
| `concorrencia-nconc1.md` | NCONC.1 — Concorrência e cabeça esperada (stale-head) | Histórico | — | — |
| `concorrencia-nconc2.md` | NCONC.2 — Prova de concorrência com rollback | Registro de lote | — | — |
| `database-constraints-indexes-batch-readers.md` | NDB.1.1 — Índices, FKs, constraints e readers em lote | Referência vigente | — | — |
| `database-contracts-audit.md` | Auditoria de contratos do banco (NDB.1, 2026-10-07) | Referência vigente | sim | — |
| `departamento-pessoal-vida-funcional.md` | Dados funcionais do DP externo (migration 0076) | Referência vigente | — | — |
| `dependencias-ndep1.md` | NDEP.1 — Auditoria de dependências (2026-10-08) | Referência vigente | — | — |
| `design-system-sigem.md` | Design System SIGEM — consolidação (2026-10-05) | Referência vigente | — | ver também `ux-sigem-design-system.md` e `vocabulario-interface-nui2.md` (vocabulário vigente) |
| `diario-gate-e2e-real.md` | Diário — gate end-to-end real (2026-10-05) | Referência vigente | — | — |
| `diario-professor-e2e.md` | Frente L — Diário do professor E2E | Referência vigente | — | — |
| `docente-diario-produto.md` | Docente / Diário — produto | Referência vigente | — | — |
| `documentos-escolares-motor.md` | Documentos escolares oficiais — motor de emissão versionado | Referência vigente | — | — |
| `documentos-impressao-auditoria.md` | Auditoria de impressão e documentos — NDOC.1 (2026-10-07) | Referência vigente | — | — |
| `dp-externo-arquitetura.md` | DP — fronteira do SIGEM | Referência vigente | — | decisão N12.1: DP administrativo é do SIGEM (fora só folha/previdência/pensão/consignações); a fronteira "DP externo" descrita aqui é histórica |
| `engenharia-de-release.md` | Engenharia de release do SIGEM | Referência vigente | — | — |
| `estado-final-do-sigem.md` | Estado final do SIGEM — gate de integração (2026-10-05) | Histórico | sim | — |
| `familia-carteirinha-autorizacoes.md` | Família, carteirinha e autorizações | Referência vigente | — | — |
| `formularios-assistentes-nform1.md` | NFORM.1 — Formulários e assistentes (2026-10-07) | Registro de lote | — | — |
| `frente-aa-avaliacao-2027.md` | Frente AA — Avaliação, recuperação, conselho e fechamento 2027 | Histórico | — | — |
| `frente-aa2-avaliacao-2027.md` | Frente AA.2 — Conclusão da Avaliação/Fechamento 2027 | Histórico | — | — |
| `frente-ab2-acompanhamento-2027.md` | Frente AB.2 — Acompanhamento pedagógico e ficha longitudinal | Histórico | sim | — |
| `frente-ad2-inteligencia-rede.md` | Frente AD.2 — Inteligência da rede (CIECE) | Histórico | — | — |
| `frente-be-network-analytics.md` | Frente BE — fechamento da AM (CIECE analytics) | Histórico | — | — |
| `frente-bf-administracao-governada.md` | Frente BF — administração governada, matriz de acesso e escalada de privilégio | Histórico | sim | — |
| `frente-bg-importacoes-governadas.md` | Frente BG — Importações governadas (fechamento da AO) | Histórico | — | núcleo comum de importações em `importacoes-nimport2.md` |
| `frente-bh-privacidade.md` | Frente BH — Controles técnicos de privacidade (fechamento da AS) | Histórico | — | — |
| `frente-bm-inteligencia-educacional.md` | Frente BM.0–BM.1 — Inteligência Educacional e setor Acompanhamento e Avaliação | Histórico | — | — |
| `frente-bo-fechamento-tecnico-academico.md` | Frente BO — fechamento técnico acadêmico | Histórico | sim | — |
| `frente-bt-writers-regras-institucionais.md` | Frente BT — Writers governados para regras institucionais | Histórico | sim | — |
| `frente-nae-auditoria-final.md` | Frente NAE — Auditoria final do Núcleo de Alimentação Escolar (NAE.7) | Histórico | sim | — |
| `auditoria-alimentacao-nae9.md` | Auditoria final da Alimentação Escolar (NAE.9) | Registro de lote | sim | — |
| `auditoria-transporte-ntransp3.md` | Auditoria do Transporte escolar (NTRANSP.3) | Registro de lote | sim | — |
| `auditoria-infraestrutura-revisao.md` | Revisão técnica da Infraestrutura | Registro de lote | sim | — |
| `frente-nae-nucleo-alimentacao-escolar.md` | Frente NAE.0 — Núcleo de Alimentação Escolar (reabertura controlada) | Histórico | — | — |
| `frente-u-organizacao-pedagogica-2027.md` | Frente U — Matriz curricular, organização pedagógica 2027 e designação das turmas | Histórico | — | — |
| `frente-w-diario-professor-2027.md` | Frente W — Diário do Professor 2027 | Histórico | — | — |
| `frente-x-necessidade-professor.md` | frente-x-necessidade-professor.md | Histórico | — | — |
| `frente-y-repositorio-curricular.md` | Frente Y — Repositório curricular canônico (BNCC + SAEB + glossário + relações) | Histórico | sim | — |
| `frente-z-planejamento-2027.md` | Frente Z — Planejamento pedagógico 2027 | Histórico | — | — |
| `gate-base-real-educacional-2026.md` | Frente J — Gate da base real 2026 | Histórico | — | — |
| `gerador-relatorios-nrel2.md` | NREL.2 — Gerador transversal de relatórios | Registro de lote | — | — |
| `governanca-alunos-educacenso-2026.md` | Alunos, matrículas e participações EducaCenso 2026 (Frente F) | Histórico | — | — |
| `governanca-execucao-tecnica-desenvolvimento.md` | Execução técnica de desenvolvimento (migration 0100) | Referência vigente | — | — |
| `governanca-infraestrutura-escolar.md` | Infraestrutura escolar — fatos versionados (Frente B, migration 0105) | Referência vigente | — | — |
| `governanca-jornadas-profissionais-educacenso-2026.md` | Jornadas profissionais EducaCenso 2026 (Frente E) | Histórico | — | — |
| `governanca-profissionais-educacenso-2026.md` | Profissionais EducaCenso 2026: matching e carga (Frente D) | Histórico | — | — |
| `governanca-referencias-documentais.md` | Governança das referências documentais (Frente A) | Referência vigente | — | — |
| `governanca-turmas-educacenso-2026.md` | Turmas EducaCenso 2026: contrato de staging e carga canônica (Frente C) | Histórico | — | — |
| `guias-por-perfil-ba.md` | Guias operacionais por perfil (Frente BA) | Referência vigente | — | — |
| `hardening-prontidao-producao-2026-10-05.md` | Hardening operacional / prontidão de produção — 2026-10-05 | Histórico | sim | — |
| `human-interface-language.md` | Human Interface Language — SIGEM 2.0 | Referência vigente | — | — |
| `idempotencia-nidem1.md` | NIDEM.1 — Idempotência dos writers e ações repetíveis (2026-10-08) | Registro de lote | — | — |
| `importacoes-interoperabilidade.md` | Importações — camada de interoperabilidade segura | Referência vigente | — | núcleo comum de importações em `importacoes-nimport2.md` |
| `importacoes-nimport2.md` | NIMPORT.2 — Infraestrutura comum de importações | Registro de lote | — | — |
| `invariantes-do-sigem.md` | Invariantes do SIGEM — testes automáticos | Referência vigente | — | — |
| `inventario-visual-rotas.md` | Inventário visual final das rotas (N3.4, 2026-10-07) | Histórico | sim | — |
| `laboratorio-6D.3.2.5-B.md` | 6D.3.2.5 Parte B — Laboratório de Campo A–I (relatório observacional) | Histórico | — | — |
| `mapa-contratos-db-ndb2.md` | NDB.2 — Mapa final de contratos do banco (2026-10-07) | Registro de lote | sim | — |
| `mapa-estatistico-2027.md` | Mapa Estatístico 2027 — Frente T | Referência vigente | — | — |
| `mapa-estatistico-projecao-canonica.md` | Frente H — Mapa Estatístico como projeção canônica | Referência vigente | sim | — |
| `matriz-completude-produto-sigem.md` | Matriz de completude do produto SIGEM (N12.2) | Referência vigente | sim | — |
| `matriz-curricular-catalogos-produto.md` | Matriz curricular, catálogos e referências — produto (NCURR.1) | Referência vigente | sim | — |
| `matriz-de-acesso-az.md` | Frente AZ — Matriz de acesso por perfil (homologação técnica) | Referência vigente | sim | — |
| `matriz-fluxo-teste.md` | Matriz fluxo → teste de regressão | Referência vigente | sim | — |
| `matriz-rastreabilidade.md` | matriz-rastreabilidade.md | Referência vigente | — | — |
| `mobile-pwa-acessibilidade-aa.md` | Mobile, PWA e acessibilidade AA — revisão transversal (2026-10-05) | Referência vigente | — | — |
| `modulos-apoio-produto.md` | Módulos de apoio — produto | Referência vigente | — | — |
| `necessidade-professor-calculo-canonico.md` | Frente M — Necessidade de professor | Referência vigente | — | — |
| `nei-aee-mediador-produto.md` | NEI / AEE / Mediador — produto | Referência vigente | — | — |
| `nucleo-curricular-academico.md` | Frente K — Núcleo curricular/acadêmico | Referência vigente | — | — |
| `o1-auditoria-prontidao-operacional.md` | O1 — Auditoria de prontidão operacional do SIGEM | Histórico | sim | — |
| `o2-dossie-decisao-b1.md` | O2 — Dossiê de decisão B1 (destravar operação) | Histórico | sim | — |
| `observabilidade-e-incidentes.md` | Observabilidade e resposta a incidentes | Referência vigente | — | complementado por `observabilidade-nobs3.md` (IDs de correlação, classificação e trilha de recuperação) |
| `observabilidade-erros-recuperacao.md` | NOBS — Erros, observabilidade e recuperação | Referência vigente | — | complementado por `observabilidade-nobs3.md` |
| `formularios-nform2.md` | NFORM.2 — Erros por campo e por célula | Registro de lote | — | complementa `formularios-assistentes-nform1.md` |
| `vocabulario-telas-nui3.md` | NUI.3 — Vocabulário e status canônicos nas telas | Registro de lote | — | complementa NUI.2 |
| `relatorios-modelos-nrel3.md` | NREL.3 — Modelos pessoais do gerador no servidor | Registro de lote | — | complementa NREL.2 |
| `horarios-conflito-entre-turmas-nhor4.md` | NHOR.4 — Conflito do mesmo profissional entre turmas e PDF da grade | Registro de lote | — | complementa NHOR.2/NHOR.3 |
| `recuperacao-erros-nobs4.md` | NOBS.4 — Trilha de recuperação dos erros | Registro de lote | — | complementa `observabilidade-nobs3.md` |
| `observabilidade-nobs3.md` | NOBS.3 — Observabilidade técnica (2026-10-08) | Registro de lote | — | — |
| `op-direcao-produto.md` | OP e Direção — produto | Referência vigente | — | — |
| `orientacao-direcao-gestao.md` | Frente Q — Orientação Pedagógica + Direção | Referência vigente | — | — |
| `performance-baseline-au.md` | Linha de base de desempenho — Frente AU (2026-10-06) | Histórico | sim | — |
| `performance-escala-sigem.md` | Performance e escala do SIGEM — NPERF.1 (2026-10-07) | Referência vigente | — | — |
| `piloto-e2e-escola-2026.md` | Frente I — Piloto E2E (escola 2026) | Histórico | — | — |
| `portal-familia.md` | Portal da Família — projeção read-only (migration 0069) | Referência vigente | — | — |
| `preparacao-operacional-2027-fontes.md` | Preparação operacional 2027 — inventário de fontes (NCFG.1, 2026-10-07) | Histórico | sim | — |
| `privacidade-e-ciclo-de-vida.md` | Privacidade e ciclo de vida dos dados — auditoria técnica | Referência vigente | — | — |
| `prontidao-operacional-recuperacao.md` | Prontidão operacional e recuperação (NOPS.1 → NOPS.2) | Referência vigente | sim | — |
| `publicacoes-verificacao-publica.md` | Publicações e verificação pública (NPUB.1) | Referência vigente | sim | — |
| `qualidade-dados-filas-ndata2.md` | NDATA.2 — Filas de revisão da qualidade dos dados | Registro de lote | — | — |
| `auditoria-dados-oficiais-ndata3.md` | NDATA.3 — Auditoria somente leitura dos dados oficiais | Registro de lote | — | — |
| `qualidade-integridade-dados-oficiais.md` | Qualidade e integridade dos dados oficiais — NDATA.1 (2026-10-07) | Referência vigente | — | — |
| `r5-competencia-e1-e4.md` | R5 — Competência institucional para E1–E4 | Histórico | — | — |
| `r5-gate-operacional.md` | R5 — Gate operacional antes de importar/homologar as 22 posições e matrizes | Histórico | sim | — |
| `reconciliacao-censo-escolar-2026.md` | Reconciliação Censo Escolar 2026 — Frente G | Histórico | sim | — |
| `referencias-curriculares-bncc-saeb.md` | Referências curriculares (BNCC, SAEB) — camada canônica | Referência vigente | — | — |
| `relatorio-interoperabilidade-nqa2.md` | NQA.2 — Simulação operacional integrada e relatório de interoperabilidade (2026-10-07) | Histórico | sim | — |
| `relatorio-pos-campanha-sigem.md` | Relatório pós-campanha SIGEM (2026-10-07) | Histórico | — | — |
| `relatorio-simulacao-piloto-2026-10-05.md` | Relatório de simulação do piloto — 2026-10-05 | Histórico | — | — |
| `release-candidate-ax.md` | SIGEM — Release Candidate técnico (AX, 2026-10-06) | Histórico | sim | — |
| `repositorio-curricular-bncc-saeb.md` | Frente P — Repositório curricular BNCC + SAEB | Referência vigente | — | — |
| `responsividade-nmobile2.md` | NMOBILE.2 — Fechamento dos gaps mobile (2026-10-08) | Registro de lote | — | — |
| `responsividade-nmobile1.md` | NMOBILE.1 — Responsividade (2026-10-08) | Registro de lote | — | — |
| `roadmap-pos-base-real.md` | Roadmap pós-base real | Histórico | — | — |
| `rotina-de-verificacao.md` | Rotina única de verificação (`npm run verify`) | Referência vigente | — | — |
| `runbook-integridade-e-recuperacao.md` | Runbook — integridade, continuidade e recuperação (AW) | Referência vigente | — | — |
| `runbook-piloto.md` | Runbook — entrada da primeira escola real (piloto) | Referência vigente | — | rotina de checagem vigente é `npm run verify` (`rotina-de-verificacao.md`) |
| `secretaria-documentos-transferencias-renovacao.md` | Secretaria — Documentos, transferências, remanejamento e renovação (N5.4) | Referência vigente | — | — |
| `secretaria-escolar-produto-completo.md` | Secretaria Escolar — checklist de produto (Lote N5) | Referência vigente | — | — |
| `secretaria-fluxo-real-pos-diario.md` | Secretaria Escolar — fluxo real pós-Diário (2026-10-05) | Referência vigente | — | — |
| `secretaria-vida-escolar.md` | Frente N — Secretaria / Vida escolar | Referência vigente | — | — |
| `seguranca-leitura-ampla-nsec3.md` | NSEC.3 — Leituras amplas reavaliadas (2026-10-08) | Histórico | — | — |
| `seguranca-verificacao-final-nsec4.md` | NSEC.4 — Verificação final de segurança (2026-10-08) | Registro de lote | — | — |
| `contratos-de-banco-vigentes-ndb3.md` | NDB.3 — Mapa final de contratos de banco (2026-10-08) | Registro de lote | — | — |
| `security-definer-function-inventory.md` | Inventário das funções SECURITY DEFINER (NSEC.2) | Referência vigente | — | — |
| `security-hardening-final.md` | NSEC.1 — Hardening de segurança (2026-10-07, parcial) | Histórico | — | — |
| `sigem-contas-padrao.md` | Padrões de contas institucionais (somente documentação) | Referência vigente | — | — |
| `sigem-continuidade-tecnica-2026-10-03.md` | SIGEM — Memória de continuidade técnica (2026-10-03) | Histórico | sim | — |
| `sigem-documentacao-canonica.md` | SIGEM — documentação canônica atual (2026-10-06) | Canônico | — | — |
| `sigem-memoria-fontes-historicas.md` | SIGEM 2.0 — memória de referência dos 12 arquivos históricos | Histórico | sim | — |
| `sigem-memoria-setorial-e-auditoria.md` | SIGEM 2.0 — memória dos 16 documentos setoriais e de auditoria | Histórico | — | — |
| `simulacao-operacional-integrada.md` | NQA.1 — Simulação operacional integrada (estado em 2026-10-07) | Histórico | sim | — |
| `storage-arquivos-privados.md` | Storage e arquivos privados (NFILE.1) | Referência vigente | sim | — |
| `superficies-publicas-npub2.md` | NPUB.2 — Auditoria das superfícies públicas | Registro de lote | — | — |
| `supervisao-escolar-produto.md` | Supervisão Escolar — produto (NSUP.1) | Referência vigente | — | — |
| `test-harness-institucional.md` | NTEST.1 — Harness institucional de testes | Referência vigente | — | — |
| `usabilidade-acessibilidade-final.md` | NUX.4 — Usabilidade e acessibilidade (estado em 2026-10-07) | Histórico | sim | — |
| `ux-sigem-arquitetura-informacao.md` | SIGEM — Arquitetura de informação | Referência vigente | — | — |
| `ux-sigem-auditoria-final.md` | SIGEM — Auditoria final de produtização (N12.3, 2026-10-07) | Histórico | sim | — |
| `ux-sigem-design-system.md` | SIGEM — Design system | Referência vigente | — | — |
| `ux-sigem-migracao-rotas.md` | Migração visual das rotas (N3.2 — inventário automático) | Referência vigente | sim | — |
| `varredura-demonstracao-contexto-real.md` | Varredura: demonstração × contexto real (2026-10-07) | Referência vigente | sim | — |
| `vocabulario-interface-nui2.md` | NUI.2 — Vocabulário, status e microtextos | Registro de lote | — | — |
| `ajuda-contextual-nhelp1.md` | NHELP.1 — Ajuda contextual curta | Registro de lote | — | — |
| `estados-rotulos-nstate1.md` | NSTATE.1 — Estados e rótulos visuais | Registro de lote | — | — |
| `inclusao-ninc1.md` | NINC.1 — Fechamento técnico da Inclusão | Registro de lote | — | — |

| `docs/familia-carteirinha-nfam1.md` | Registro de lote | Portal da Família e carteirinha (NFAM.1) |
- [docs/superficies-publicas-nrate1.md](superficies-publicas-nrate1.md) — Registro de lote: verificação pública contra abuso (NRATE.1).
- [docs/formatacao-ptbr-nformat1.md](formatacao-ptbr-nformat1.md) — Referência vigente: formatação pt-BR (NFORMAT.1).
- [docs/menu-rotas-capacidades-nperm3.md](menu-rotas-capacidades-nperm3.md) — Registro de lote: menu × rotas × capacidades (NPERM.3).
- [NCSS.2 tokens visuais](tokens-visuais-ncss2.md) — Registro de lote
- [NBUNDLE.1 bundle e carregamento](bundle-carregamento-nbundle1.md) — Registro de lote
- [NEMPTY.3 estados de ausência](estados-de-ausencia-nempty3.md) — Registro de lote
- [NNAV.2 continuidade de navegação](navegacao-continuidade-nnav2.md) — Registro de lote
- [NRELEASE.2 preparação de release](release-preparacao-nrelease2.md) — Registro de lote
- [NASSET.1 assets institucionais](assets-institucionais-nasset1.md) — Registro de lote
- [NCROSSLINK.1 links e continuidade](links-continuidade-ncrosslink1.md) — Registro de lote
- [NRELEASE.1 checklist de release](release-checklist-nrelease1.md) — Referência vigente
- `docs/tabelas-densas-ntable1.md` — Registro de lote NTABLE.1
- `docs/filtros-estado-nfilter1.md` — Registro de lote NFILTER.1

- `docs/auditoria-mapa-nmap5.md` — Registro de lote (NMAP.5).
- `docs/cal-count-1-reconciliacao.md` — Registro de lote (CAL.COUNT.1).

- `docs/auditoria-secretaria-n56.md` — Registro de lote (N5.6).
- `docs/auditoria-avaliacao-n625.md` — Registro de lote (N6.2.5).
- `docs/auditoria-op-direcao-n725.md` — Registro de lote (N7.2.5).
- `docs/auditoria-inclusao-n825.md` — Registro de lote (N8.2.5).
- `docs/auditoria-familia-carteirinha-n925.md` — Registro de lote: auditoria final Família/Carteirinha (N9.2.5).
- `docs/auditoria-ciece-n443.md` — Registro de lote: auditoria final do CIECE (N4.4.3).
- `docs/auditoria-supervisao-nsup3.md` — Registro de lote: auditoria final da Supervisão (NSUP.3).
- `docs/auditoria-matriz-catalogos-ncurr3.md` — Registro de lote: auditoria final de matrizes e catálogos (NCURR.3).
- `docs/revisao-busca-notificacoes.md` — Registro de lote: revisão de Busca Global e Notificações.
- `docs/auditoria-central-auditoria-naud3.md` — Registro de lote: auditoria final da Central de Auditoria (NAUD.3).
- `docs/auditoria-docente-n1025.md` — Registro de lote: auditoria final do ambiente Docente (N10.2.5).
- `docs/auditoria-autenticacao-nauth3.md` — Registro de lote: autenticação e sessão (NAUTH.3).
- `docs/auditoria-acessibilidade-na11y3.md` — Registro de lote: acessibilidade (NA11Y.3).
- `integridade-schema-final-ndb4.md` — Registro de lote: verificação final de integridade do schema (NDB.4).
- [Minimização NPRIV.1](privacidade-minimizacao-npriv1.md) — registro de lote
- [Validação de fronteiras NVALID.1](validacao-fronteiras-nvalid1.md) — registro de lote
- [Fronteiras NARCH.2](arquitetura-fronteiras-narch2.md) — registro de lote
- [Tipagem NTYPE.1](tipagem-auditoria-ntype1.md) — registro de lote
- [Regressão visual NVIS.1](regressao-visual-nvis1.md) — registro de lote
- [Resiliência a conexão (NRESILIENCE.1)](resiliencia-conexao-nresilience1.md) — Registro de lote
- [Trajetória do estudante (NSTUDENT.1)](trajetoria-estudante-nstudent1.md) — Registro de lote
- [Trajetória do profissional (NPROF.1)](trajetoria-profissional-nprof1.md) — Registro de lote

## NSCHOOL.1
- [Unidades escolares — coerência](unidades-escolares-nschool1.md) — Registro de lote

## NPREP.1
- [Prontidão 2027](prontidao-2027-nprep1.md) — Registro de lote

## NLOGIN.2
- [Tela de login](login-nlogin2.md) — Registro de lote

## NDESIGN.QA
- [Acabamento visual](acabamento-visual-ndesignqa.md) — Registro de lote

## NLINK.1
- [Links e ações navegacionais](links-navegacao-nlink1.md) — Registro de lote; smoke test de destinos e botões sem ação.

## NWEBSEC.1
- [Segurança web e cabeçalhos](seguranca-web-nwebsec1.md) — Registro de lote; cabeçalhos, no-store, limites.

## NKEY.1
- [Atalhos de teclado e foco](teclado-foco-nkey1.md) — Registro de lote.
- `auditoria-final-nfinal10.md` — Registro de lote: auditoria final de fechamento técnico e classes finais.
- `revisao-final-pos-fila-2026-10-09.md` — Registro de lote: revisão final pós-fila, verificação e pendências externas.
- `credenciais-desenvolvimento-naccess3.md` — Registro de lote: senhas temporárias no desenvolvimento.
- `isolamento-setorial-nsector4.md` — Registro de lote: matriz de isolamento por setor e escola.
- `docs/bq1-matriz-autoridades-institucionais.md` — Canônico — matriz real de autoridades (BQ.1).
| docs/alimentacao-escolar-produto-final.md | Registro de lote |
| docs/secretaria-escolar-produto-final.md | Registro de lote |
| docs/direcao-escolar-produto-final.md | Registro de lote |
| docs/orientacao-pedagogica-produto-final.md | Registro de lote |
| docs/mediador-escolar-produto-final.md | Registro de lote |
| docs/portal-familia-produto-final.md | Registro de lote |
| docs/ciece-produto-final.md | Registro de lote |
| docs/integracao-transversal-final.md | Registro de lote |
| docs/campanha-zero-erros.md | Registro de lote |
| docs/hotfix-performance-loading.md | Registro de lote |
- `document-studio-docs-pro-3.md` — Registro de lote: persistência, homologação e QR do Document Studio.
- `diario-ndiary-final-2.md` — Registro de lote: autosave, 7 impressões e relatórios do Diário.
- `ciece-nciece-final-2.md` — Registro de lote: Censo oficial × base, Mapa no gerador e regra-base.
