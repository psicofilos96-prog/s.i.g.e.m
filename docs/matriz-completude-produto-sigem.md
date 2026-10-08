# Matriz de completude do produto SIGEM (N12.2)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Fontes: docs/sigem-memoria-fontes-historicas.md, docs/sigem-memoria-setorial-e-auditoria.md, documentos de produto por setor (docs/*-produto.md), docs/campanha-noturna-sigem.md e as decisões da campanha N12.1. Esta matriz foi montada a partir dos registros dos lotes e não de uma nova inspeção da tela. Também não houve execução autenticada nesta rodada.

Legenda de status: COMPLETO / PARCIAL / AUSENTE / DEPENDE_DECISAO / DEPENDE_DADO / HOMOLOGACAO. COMPLETO só quando um usuário real cumpre a tarefa, e nenhuma linha atingiu esse critério com prova.

| ID | Setor | Requisito | Decisão mais recente | Backend | UI | Dado real | PDF | Teste real | Status | Gap | Próximo passo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CI-01 | CIECE | Mapa I–VI: enviar/devolver/aprovar/retificar | N12.1 fluxo decidido | sim (0211) | sim | não (0 regras homologadas) | gerador sim, sem revisão real | unit+SQL não executado | HOMOLOGACAO | sem regra 2027 homologada | homologar regra do Mapa 2027 |
| CI-02 | CIECE | Ajustes manuais auditáveis | N4.3 | sim | sim | não | sim | unit | HOMOLOGACAO | depende de CI-01 | idem |
| CI-03 | CIECE | Peso dos remanejados | pendente | — | "aguardando regra" | — | — | — | DEPENDE_DECISAO | sem regra | decidir peso |
| CI-04 | CIECE | Carência de mediador | sem regra oficial | projeção sim | "aguardando regra" | — | — | unit | DEPENDE_DECISAO | sem regra | decidir critério de carência |
| SU-01 | Supervisão | Calendário 2027 construir/homologar | Supervisão única | sim | sim | sim (fonte 2027) | Panorâmico/Mosaico | unit | PARCIAL | sem prova autenticada no navegador | rodar fluxo com conta supervisao@ |
| SE-01 | Secretaria | Matrícula guiada em 8 etapas | N5.2.1/N5.2.2 | RPCs 0212–0216 | wizard /matriculas/nova | oficiais intactos | — | SQL rollback com contas reais + teste de tela | IMPLEMENTADO_TECNICAMENTE / E2E_NAVEGADOR_PENDENTE / CONFIGURAÇÃO_2027_PENDENTE | navegador autenticado exige aprovação de sessão; 2027 sem ano/turmas | HOMOLOGAÇÃO + DADO |
| SE-02 | Secretaria | Enturmação sem código | N5.2 | sim | sim | sim | — | unit | PARCIAL | turno/ocupação na lista | TÉCNICO |
| SE-03 | Secretaria | Capacidade/vagas | sem regra de capacidade | — | "não informada" | — | — | unit | DEPENDE_DADO | capacidade por turma | registrar capacidade |
| SE-04 | Secretaria | Livro de Matrícula | N5.3 | `secretariat_enrollment_book_at` (0217/0218) | /secretaria/livro-matricula + PDF/CSV/XLSX | oficiais intactos | — | SQL rollback + testes do modelo | COMPLETO_TECNICAMENTE / INTERACTIVE_BROWSER_VALIDATION_PENDING / DECISAO_INSTITUCIONAL_PENDENTE (numeração, assinaturas) | numeração oficial | DECISÃO |
| SE-04b | Secretaria | Vagas (capacidade/ocupação honestas) | N5.3 | `secretariat_class_vacancies_at` + bloqueio `class-full` | /secretaria/vagas | — | — | SQL rollback | COMPLETO_TECNICAMENTE / INTERACTIVE_BROWSER_VALIDATION_PENDING; solicitação de vaga DECISAO_INSTITUCIONAL_PENDENTE | prioridade da fila | DECISÃO |
| SE-05 | Secretaria | Turmas: assistente Nova turma + multisseriada + professores | N5.3.1 | `secretariat_create_class`, `class_composition_at` (0219/0220) | /turmas/nova (7 passos) + ficha | oficiais intactos | — | SQL rollback N531-PROOF-PASS + testes do modelo | Assistente e multisseriada IMPLEMENTADO_TECNICAMENTE; professores pela Secretaria PENDENTE (writer exige pessoa; sem matriz/atuação); Mapa III/Diário sem leitura da composição; INTERACTIVE_BROWSER_VALIDATION_PENDING; OPERATIONAL_CONFIGURATION_PENDING (catálogos, 2027) | ator setorial na atribuição | N5.3.2 |
| SE-05 | Secretaria | Documentos oficiais | sem textos aprovados | motor | parcial | — | parcial | — | DEPENDE_DECISAO | TEMPLATE_INSTITUCIONAL_PENDENTE | aprovar textos |
| DI-01 | Direção | Dossiê de registros/providências | N7.2 | parcial | parcial | — | ausente | — | PARCIAL | adendos, PDF | TÉCNICO |
| OP-01 | OP | Fiscalização do Diário | N7.2 | projeção pura | ausente | — | — | unit | PARCIAL | tela + leitura real | TÉCNICO |
| OP-02 | OP/Docente | SIPE enviar/aprovar/ajuste | N12.1 decidido | 0236 | integrado | teacher-work-review.test.ts | — | — | PARCIAL | Quadro Permanente, impressão, capacidade não atribuída | TÉCNICO |
| OP-03 | OP/Docente | Filas do SIA | N7.2 | motores existentes | parcial | — | — | — | PARCIAL | filas de estados | TÉCNICO |
| OP-04 | OP | Busca Ativa | autoridade configurável | ausente | ausente | — | — | — | DEPENDE_DECISAO | autoridade final | decidir quem conclui |
| AV-01 | Avaliação | Heatmap habilidade×escola | N6.2 | sim | sim | depende de importações | — | unit | PARCIAL | filtros, etapa | TÉCNICO |
| AV-02 | Avaliação | Ciclo da avaliação | N6.2 | ausente | ausente | — | — | — | AUSENTE | mudança no banco | TÉCNICO |
| AV-03 | Avaliação | Home, evolução, relatórios | N6.2 | parcial | parcial | — | ausente | — | PARCIAL | — | TÉCNICO |
| AV-04 | Avaliação | BNCC↔SAEB | sem fonte oficial | — | sem equivalência | — | — | — | DEPENDE_DADO | mapeamento oficial | fornecer planilha oficial |
| NE-01 | NEI | Registro restrito CID/laudo | N12.1 permite | ausente | ausente | — | — | — | AUSENTE | banco + acesso | TÉCNICO (decidido) |
| NE-02 | NEI | Fila de termos | N8.2 | projeção pura | ausente | — | — | unit | PARCIAL | persistência + tela | TÉCNICO |
| NE-03 | NEI | PEI/PAEE/relatório NEI | N8.2 | parcial | parcial | — | parcial | — | PARCIAL | versões, assinaturas | TÉCNICO |
| DO-01 | Docente | Autosave EI | N10.2 | controlador | não ligado | — | — | unit | PARCIAL | ligar às telas | TÉCNICO |
| DO-02 | Docente | Meu Diário no celular | N10.2 | sim | sim | sim | — | sem teste mobile | PARCIAL | verificação por viewport | TÉCNICO |
| FA-01 | Família | Carteirinha emissão/QR/PDF | N9.2 | verificação pura | visual parcial | — | ausente | unit | PARCIAL | emissão, página pública | TÉCNICO |
| FA-02 | Família | Autorizações/portaria | N9.2 | ausente | ausente | — | — | — | AUSENTE | regras de saída sozinho | parte DECISÃO |
| FA-03 | Família | Ficha de saúde | fora até política | — | — | — | — | — | DEPENDE_DECISAO | política de acesso | decidir quem lê |
| AL-01 | Alimentação | NAE.0–8 | preservar | sim | sim | parcial | parcial | unit | PARCIAL | revisão visual | TÉCNICO |
| TR-01 | Transporte | Rotas/pontos/vínculos | N11.2.3 (0237) | append-only, writer com capacidade | /transporte-escolar | impressão | — | unit | PARCIAL | tela de vínculo aluno↔ponto; capacidades não atribuídas | TÉCNICO |
| IN-01 | Infraestrutura | Histórico e fila da rede | N11.2.3 | fatos 0105 | /infraestrutura (cobertura) | impressão | — | unit | COMPLETO_TECNICAMENTE | solicitações de manutenção (regra) | DEPENDE_DECISAO |
| DP-01 | DP | Atenção/linha do tempo | N12.1 DP no SIGEM | projeção pura | ausente | — | — | unit | PARCIAL | tela | TÉCNICO |
| DP-02 | DP | Probatório/quinquênio/aposentadoria | sem regra | — | "aguardando regra" | — | — | — | DEPENDE_DECISAO | regras | decidir regras |
| RE-01 | Relatórios | Assistente passo a passo | N11.2 | motor com ACL | central catálogo | — | sim | unit | PARCIAL | assistente | TÉCNICO |
| AD-01 | Admin | Central de Acessos | N1 | sim | sim (visual antigo) | sim | — | unit | PARCIAL | redesign | TÉCNICO |
| UX-01 | Global | Redesign das rotas | N3.2 | — | 130 novas / 28 antigas | — | — | sem regressão visual | PARCIAL | 28 rotas + homes | TÉCNICO |
| HO-01 | Horários | Grades turma/professor | B4.4 | sim | sim (visual antigo) | depende de grade | — | unit | PARCIAL | próxima aula | TÉCNICO |
| IM-01 | Importações | Educacenso/avaliações | — | sim | sim | parcial | — | unit | PARCIAL | integração à estação | TÉCNICO |
| BU-01 | Busca/Notificações | Busca e notificações globais | — | parcial | parcial | — | — | — | PARCIAL | sem prova | TÉCNICO |
| AU-01 | Auditoria | Central de auditoria | sem migration | projeção | sim | sim | via relatórios | unit | PARCIAL | exportar sem política | DECISÃO (atribuir exportar-auditoria) |

- SE-05 Turmas (N5.3.2): COMPLETO_TECNICAMENTE — assistente 7 passos, simples/multisseriada, jornada, professores pela Secretaria, Mapa III e Diário lendo a composição; prova N532-PROOF-PASS. OPERATIONAL_CONFIGURATION_PENDING — PROFESSIONALS_CURRICULUM_JOURNEYS. INTERACTIVE_BROWSER_VALIDATION_PENDING.

## N5.4 — Documentos, transferências, renovação
Ver `docs/secretaria-documentos-transferencias-renovacao.md`. Técnico: PASS na prova SQL; templates oficiais pendentes; validação no navegador pendente.

- N6.2.1 Avaliação: ciclo versionado COMPLETO (backend, 0227); home/heatmap/evolução/drill-down/relatórios PENDENTE; BNCC↔SAEB DEPENDE_DADO.
- N7.2.1 OP/Direção: filtros da fiscalização COMPLETO (puro); UI real, Dossiê, SIPE, SIA, Conselho, relatórios PENDENTE; busca ativa DEPENDE_DECISAO.
- N8.2.1 NEI: fila de termos backend COMPLETO (0228/0229); demais itens PENDENTE.
- N9.2.1 Carteirinha: emissão/reemissão/cancelamento + verificação pública backend COMPLETO (0230); PDF/portal/autorizações PENDENTE.
- N10.2.1 Docente: agenda pura COMPLETO; autosave EI, SIPE, SIA, mobile, PEI/PAEE PENDENTE.
- N11.2.1 Apoio: correção documental do DP COMPLETO; demais domínios PENDENTE; nenhum PASS de domínio declarado.

## N6.2.2 (parcial)
- Tela do ciclo ligada a `assessment_edition_cycle_events` na aba Avaliações (estado, próxima ação, histórico, confirmação para publicar/arquivar) e contagem por estado na Visão Geral. Pendentes: heatmap, evolução, drill-down, importação, relatórios. BNCC↔SAEB: DEPENDE_DADO.

## N7.2.2 (parcial)
- Fiscalização do Diário ligada à grade publicada (`class_schedule_at`) e aos registros reais em /acompanhamento-diarios: aula prevista × aula/chamada registrada, filtros turma/professor, sem ranking; sem grade nada é faltante. Limite: turmas sem nenhum registro no período não aparecem (falta leitor de turmas da escola). Pendentes: Dossiê, SIPE, SIA, Conselho, relatórios, Busca Ativa (DEPENDE_DECISAO).

## N8.2.2 (parcial)
- Capability `revisar-termos-inclusao`: nenhuma política homologada atribui capability de inclusão (auditado) ⇒ ASSIGNMENT_PENDING, sem bloquear.
- Tela da fila em /inclusao: adicionar termo, validar (alias) / recusar, histórico; sem permissão mostra ASSIGNMENT_PENDING. Pendentes: CID/laudo restrito, AEE UI, PEI/PAEE, mediador, relatório NEI.

## N9.2.2 (parcial)
- Página pública `/verificar/carteirinha/<código>.<versão>` (QR) sobre `verify_student_card`: só status (válida/expirada/cancelada/substituída/não encontrada), nome, escola, turma, ano letivo; formato inválido responde igual a inexistente. Emissão: ASSIGNMENT_PENDING (sem política). Pendentes: foto, PDF, Secretaria UI, portal, autorizações, portaria.

## N12.4 — Reauditoria final (2026-10-07) — substitui a N12.3
Estados: COMPLETO_TECNICAMENTE · INTERACTIVE_BROWSER_VALIDATION_PENDING · OPERATIONAL_CONFIGURATION_PENDING · DEPENDE_DADO · DEPENDE_DECISAO · TEMPLATE_INSTITUCIONAL_PENDENTE · HOMOLOGACAO.

| Área | Estado |
|---|---|
| Secretaria (matrícula, turmas, enturmação, transferência, renovação, Livro, vagas) | COMPLETO_TECNICAMENTE; TEMPLATE_INSTITUCIONAL_PENDENTE (ficha, declaração de transferência, atestado, renovação); DEPENDE_DECISAO (numeração do Livro, fila de vagas) |
| Calendário 2026/2027, modelos Panorâmico/Mosaico | COMPLETO_TECNICAMENTE; 2027 operacional NÃO aberto (STOP) |
| Avaliação (ciclo, importação, agregados) | COMPLETO_TECNICAMENTE; DEPENDE_DADO (BNCC↔SAEB) |
| OP/Direção (filas, fiscalização do Diário) | COMPLETO_TECNICAMENTE; OPERATIONAL_CONFIGURATION_PENDING (grades/composições: 698 turmas sem composição) |
| Docente (Meu Diário) | COMPLETO_TECNICAMENTE; autosave EI ligado (N10.2.3, sem recuperação após recarregar); SIPE/SIA, PEI/PAEE docente = gap técnico aberto |
| Inclusão/AEE/mediador | fila de termos COMPLETO_TECNICAMENTE; DEPENDE_DECISAO (quem revisa termos); PEI/PAEE/relatório NEI = gap técnico aberto |
| Família/carteirinha | verificação pública COMPLETO_TECNICAMENTE; DEPENDE_DECISAO (quem emite; termo de imagem) |
| Apoio (DP, transporte, infra, construtor, relatórios, NAE) | DP timeline COMPLETO_TECNICAMENTE; demais = gap técnico aberto (N11.2.2); DEPENDE_DECISAO (prazos DP) |
| CIECE (dry-runs escolas/turmas, qualidade) | COMPLETO_TECNICAMENTE p/ dry-runs; tela Censo/Qualidade e importações = gap técnico aberto; DEPENDE_DADO (modelos GPE) |
| Pré-importação 2027 | plano professores/turmas COMPLETO_TECNICAMENTE; DEPENDE_DADO (fonte 2027) |
| Segurança | anon sem privilégio; armazenamento privado; 427 funções DEFINER de authenticated sem revisão item a item = gap aberto (NSEC.1 p2) |
| Erros/observabilidade | governError COMPLETO; 21 telas ainda exibem/propagam texto técnico do servidor = gap técnico aberto (NOBS.1 p2) |
| Acessibilidade | primitivas NUX.4 COMPLETO; aplicação por rota pendente; INTERACTIVE_BROWSER_VALIDATION_PENDING |
| Harness/testes | NTEST.1 COMPLETO (69/69, 0 resíduo) |
| Auditoria (exportação) | DEPENDE_DECISAO (`exportar-auditoria` sem política) |

## Gates N12.4
Suíte completa 351 arquivos / 4004 testes PASS · deep 31/31 · typecheck 0 erros (2 corrigidos em guidance.tsx) · build OK · migrations congeladas (sem nova) · secret scan limpo · harness 69/69 com smoke autenticado e export negado a quem não tem capability · resíduo 0 (0 contas/0 fixtures) · contagens oficiais inalteradas: 55 escolas, 9.763 alunos, 698 turmas, 10.822 pessoas.
Corrigido nesta auditoria: rolagem horizontal da Central de acessos no celular (identificadores longos agora quebram).
Não executado: regressão visual por breakpoint com login humano (INTERACTIVE_BROWSER_VALIDATION_PENDING).

## N12.5 (2026-10-07)
Matriz reconfirmada: ver docs/ux-sigem-auditoria-final.md seção N12.5 para estado por requisito; nenhum requisito promovido a COMPLETO_TECNICAMENTE nesta rodada.

## N11.2.3 — Apoio (2026-10-07)
- Transporte: migration 0237 `school_transport_facts` (rota/ponto/vínculo, append-only, base esperada, rota/ponto da mesma escola, estudante só com matrícula na escola); leitura por `consultar-transporte-escolar`/`manter-transporte-escolar` (não atribuídas → ASSIGNMENT_PENDING); tela `/transporte-escolar` (rotas, pontos, contagem, impressão). Elegibilidade/distância/capacidade = DEPENDE_DECISAO. Tela de vínculo estudante↔ponto = PENDENTE (writer pronto).
- Infraestrutura: `/infraestrutura` cobertura por escola (informado ≠ ausente; sem nota de condição nem prioridade).
- DP home/linha do tempo: já entregue (Departamento Pessoal: atenção por término declarado + linha do tempo por pessoa); prazos sem regra seguem DEPENDE_DECISAO.
- Construtor de Documentos: PENDENTE — depende de templates institucionais (TEMPLATE_INSTITUCIONAL_PENDENTE).
- Assistente de Relatórios: PENDENTE — não iniciado nesta rodada.
- UX do NAE: PENDENTE — revisão visual com login (INTERACTIVE_BROWSER_VALIDATION_PENDING).

## N4.4.2 — Censo/Qualidade (2026-10-07)
- `/censo-escolar`: cada ciclo agora tem abas Cobertura, Escolas, Turmas, Alunos, Profissionais, Importações e reconciliação, Relatórios (CSV/PDF pelo motor de relatórios). Nomes de escola no lugar de identificadores; desconhecido nunca vira zero; inconsistências estruturais por domínio.
- Importação: prévia por rejeições por linha, hash SHA-256, mesmo arquivo nunca recebido duas vezes (tela + UNIQUE no banco), histórico datado; nada do SIGEM é corrigido automaticamente.
- Educacenso oficial e GPE = BLOCKED_BY_OFFICIAL_SOURCE / EXTERNAL_INTEGRATION_UNDEFINED (sem layout, nada inventado). Homologação do Censo = DEPENDE_DECISAO.
- Visão com login real da rede = INTERACTIVE_BROWSER_VALIDATION_PENDING.
