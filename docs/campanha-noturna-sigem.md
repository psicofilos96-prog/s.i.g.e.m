# Campanha noturna SIGEM — registro de produtização

Registro de continuidade (não normativo). Sem senhas ou segredos.

## Regras gerais (orquestração mestra, 2026-10-07)
- Antes de cada lote: investigar código, schema real, migrations, testes e todo o acervo enviado (SIGEM 1.0/2.0, planilhas, PDFs, conversas). Acervo é referência a reinventar, não a copiar; decisão explícita mais recente do usuário vence. "Já existe" só com fluxo real provado.
- UX: uma ação principal por tela, texto curto e cotidiano, ícone + texto, contexto claro (onde estou / o que fazer / o que acontece depois), passos guiados, feedback imediato, prevenção de erro, revelação progressiva; estética institucional premium; desktop primeiro nos setores, mobile excelente nos fluxos de celular.
- Dados/segurança: sem alterar dado oficial para teste visual, sem demo em sessão real, sem enfraquecer RLS/capabilities, sem pessoa inventada, preservar principais setoriais, 169 contas e isolamento por estação, sem e-mail como autorização.
- Execução: implementar, um lote lógico por vez; DECISÃO PENDENTE registrada sem parar a campanha; após cada lote: testes focais, typecheck, build, diff-check, migrations/segurança; marcos maiores: suíte completa/profunda e perfis reais.

## Modelo de entrada por lote
- Lote:
- Fontes/acervo consultado:
- Estado antes:
- Gaps:
- Alteração:
- Testes:
- Commit:
- Pendências reais:
- Próximo lote:

## Lotes
### N1 — Central de acessos e inventário de logins — PARTIAL
- Fontes: `0080/0081` (admin_account_overview), `0205` BQ.1C (169 principais setoriais: 4 rede + 55×3 escolas), memórias de contas (admin@, supervisao@), docs B1.x.
- Estado antes: central listava pessoas/atuações; contas setoriais invisíveis; reset gerava senha provisória só para contas humanas.
- Alteração: migration `0210` (holder, inventário, autorização e auditoria de reset), seção "Logins do SIGEM", exportação XLSX/CSV, reset individual/lote setorial. Doc `docs/central-de-acessos.md`.
- Testes: 5 focais + invariantes/institutional-admin/privacy (96) verdes; typecheck limpo; diff-check limpo; anônimo recusado pela API.
- Pendência: teste autenticado como Administrador Geral (precisa aprovação do usuário para sessão de teste).
- Próximo: lote N2 (próximo prompt da fila).

CONTINUE_FROM=N3

## Lote N2 — Calendários externos: fidelidade visual — PARTIAL
- Fontes: os dois prompts-guia (`TAREFA_Implemente_um_componente_de_Calendário_pasted.md`, `TAREFA_pasted.md`), `docs/calendario-modelos-externos.md`, imagens `itaperuna-home` e `logo-sigem`.
- Antes: PASS técnico, desenho rejeitado (topo azul chapado, rodapé sem identidade, legenda incompleta, matriz com número+sigla).
- Alteração: folhas Panorâmico/Mosaico redesenhadas conforme os guias; perfil visual ampliado; legenda da mesma tabela das células; auto-fit; editor com os novos controles. Interno e fatos 2027 intocados.
- Testes: calendar-external-n2 + calendário/invariantes/a11y 430/430; build OK; 2 PDFs de 1 página com o 2027 completo.
- Pendência: 6 PDFs no fluxo autenticado da Supervisão (aprovação de sessão indisponível).
- CONTINUE_FROM=N3

## Lote N3 — Redesign global (PARTIAL)
- Fontes: tokens existentes em src/styles.css (navy/azul/teal, Figtree/Outfit), App Shell 2.0, assets reais (foto Itaperuna, brasão, logo SIGEM).
- Feito: login /auth em tela cheia (foto real + brasão, campos grandes, mostrar senha, erro claro, carregando); shell sem "Verificando sua área…" (esqueleto elegante + erro com "Tentar de novo"); página "de outro setor" orientadora.
- Testes: src/components (a11y) verdes. Screenshots: docs/img/n3/.
- Pendente: homes de estação como caixa de trabalho, inventário/redução de páginas, regressão visual autenticada (central, Secretaria, Direção, OP, Admin) — exige sessão aprovada.
- CONTINUE_FROM=N3.2 (homes de estação)

## Lote N4 — CIECE/Mapa/Censo/GPE (PARTIAL)
- Feito: painel do Mapa da rede com andamento, situação por escola, filtro, mês por nome e painel "De onde veio este valor".
- Matriz: docs/ciece-mapa-censo-gpe-produto.md.
- Pendente: seis estruturas como seções, PDF dedicado, home CIECE, GPE (sem leiaute), testes autenticados.
- CONTINUE_FROM=N4.2 (Mapa da escola em seções I–VI)

## Lote N5 — Secretaria Escolar (PARTIAL)
- Feito: home da Secretaria como caixa de trabalho (3 cartões de trabalho, ações rápidas, números recolhidos, escolha automática de escola/ano).
- Checklist: docs/secretaria-escolar-produto-completo.md.
- CONTINUE_FROM=N5.2 (enturmar escolhendo turma da lista; matrícula em etapas)

## Lote N6 — Acompanhamento e Avaliação (PARTIAL)
- Feito: gráfico descritivo por grupo e linha de cobertura em cada métrica.
- Matriz: docs/acompanhamento-avaliacao-produto.md.
- CONTINUE_FROM=N6.2 (home da avaliação + heatmap por habilidade)

## Lote N7 — OP + Direção — PARTIAL
- Feito: página inicial com sessão de /direcao e /orientacao virou "O que depende de você hoje": pendências agrupadas em 3 cartões (alunos sem turma, turmas sem frequência fechada, turmas sem notas fechadas), ações principais distintas por estação, escola única auto-selecionada, "registrado até" recolhido.
- Fontes: school-followup (readers canônicos), AGENTS.md de school-followup/institutional-decisions/pedagogical-guidance.
- Pendente: Ocorrências em dossiê, fila SIPE/SIA da OP, fiscalização do Diário por turma, Busca Ativa (autoridade Secretaria×OP indefinida — DECISÃO PENDENTE), relatórios, testes autenticados (mint indisponível).
- CONTINUE_FROM=N7.2

## Lote N8 — NEI/AEE/Mediador — PARTIAL
- Feito: /inclusao com título de tarefa; mediação em cartões (Em andamento / Fora do período, contagem, "Abrir aluno"), sem expor identificador no Nível 1.
- PRECEDÊNCIA (N12.1): a decisão mais recente do usuário (lote N8) exige CID original, laudos e A/B/C com governança; a proibição de 0072/AGENTS derivava da Frente AH, que só vedava diagnóstico "sem fonte, necessidade e governança explícitas". Antes: o lote pede CID original, dimensões A/B/C, laudo e nível de suporte; a regra vigente (AGENTS inclusão, migrations 0072/0073) proíbe campo de diagnóstico/CID. Nada clínico foi criado até decisão explícita.
- Pendente: fila de termos não reconhecidos, Relatório NEI com CID (depende da decisão), PAEE/PEI, substituição de mediador na UI, testes autenticados.
- CONTINUE_FROM=N8.2

## Lote N9 — Família + Carteirinha — PARTIAL
- Feito: carteirinha frente/verso (brasão, foto da cidade e logo SIGEM reais) no Portal da Família, só com fatos autorizados (nome, escola, turma, ano); turno, foto 3×4, matrícula SIGEM e QR aparecem "não registrado" até haver emissão pela Secretaria. QR só com URL https.
- Pendente: emissão/reemissão pela Secretaria com versionamento e página pública de verificação (exige migration), PDF frente/verso, autorizações digitais, portaria, boletim PDF. Ficha de saúde do filho: DECISÃO PENDENTE (política de acesso).
- CONTINUE_FROM=N9.2

## Lote N10 — Docente/Diário — PARTIAL
- Auditoria: Meu Diário já tem ação principal, retomada, agenda do dia (grade B4.4) e pendências; chamada rápida (6D.1.x) e registro versionado existem.
- Feito: saudação usava a 3ª palavra do nome (defeito) → primeiro nome; subtítulo de tarefa; removido identificador técnico de vínculo do Nível 1; descrição da rota sem "demonstrativo".
- Pendente: autosave de EI, SIPE envio/retorno à OP (decisão vigente: rascunho → enviado → OP aprova ou solicita ajuste; falta implementar), SIA separação Criar/Aguardando/Aplicar/Corrigir, documentos PEI/PAEE (depende de N8), testes mobile autenticados.
- CONTINUE_FROM=N10.2

## Lote N11 — Módulos de apoio — PARTIAL
- Feito: títulos de tarefa em Relatórios, Alimentação Escolar e Profissionais (DP).
- Conflito registrado: o lote pede férias/licenças/PAD/quinquênio/aposentadoria no DP; a decisão vigente (memória "DP externo") diz que vida funcional fica no sistema próprio do DP e a planilha oficial é a fronteira. CORRIGIDO em N12.1: decisão vigente é DP administrativo dentro do SIGEM (vínculos, lotações, atos, eventos, férias/licenças, designações, PAD); fora ficam folha, previdência, pensão e consignações.
- Transporte: sem geodado confiável, nenhum mapa/coordenada. Pendentes: UX transporte/infraestrutura, Construtor (paginação de assinaturas longas), gerador de relatórios, testes autenticados.
- CONTINUE_FROM=N11.2

## Lote N12 — Homologação sistêmica — PARTIAL

Gates após a última alteração (2026-10-07): suíte completa 321 arquivos / 3876 testes OK; invariantes profundas 4/31 OK; typecheck OK; diff-check OK; varredura de segredos sem valor real (só detectores e nomes de prefixo). Simulação autenticada por estação NÃO executada: a conta do solicitante não existe no Auth do app e o login de contas setoriais exige aprovação explícita por conta.

| Lote | Estado | O que o usuário já consegue fazer | Pendência real |
|---|---|---|---|
| N1 Central de acessos | PARTIAL | Listar/filtrar/exportar contas; redefinir senha com auditoria | Teste vivo como Administrador Geral |
| N2 Calendários externos | PARTIAL | Panorâmico e Mosaico em PDF A4 de 1 página | 6 PDFs pela Supervisão logada; aceite visual |
| N3 Design/shell | PARTIAL | Login novo, carregamento elegante, aviso de outra área | Homes de estação restantes; screenshots por perfil |
| N4 CIECE/Mapa | PARTIAL | Andamento da rede, filtro, "De onde veio este valor" | Mapa I–VI, PDF do Mapa, home CIECE, Censo, GPE (sem leiaute) |
| N5 Secretaria | PARTIAL | Home "O que precisa de você hoje" | Enturmar por lista, matrícula em etapas, Livro de Matrícula |
| N6 Avaliação | PARTIAL | Gráfico e cobertura por avaliação | Home, ciclo de situação, heatmap, relatórios, BNCC↔SAEB |
| N7 OP/Direção | PARTIAL | Home com pendências agrupadas e ações distintas | Ocorrências, filas SIPE/SIA, Busca Ativa |
| N8 NEI/AEE | PARTIAL | Mediação em cartões | CID/laudo (decisão), PAEE/PEI, Relatório NEI |
| N9 Família/Carteirinha | PARTIAL | Carteirinha frente/verso com fatos reais | Emissão, QR/verificação, PDF, autorizações |
| N10 Docente | PARTIAL | Meu Diário corrigido | Aprovação SIPE (decisão), SIA por etapas, autosave EI |
| N11 Apoio | PARTIAL | Títulos de tarefa em Relatórios/Alimentação/DP | Transporte, Infra, Construtor, gerador de relatórios |
| N12 Homologação | PARTIAL | Gates técnicos verdes | Simulação autenticada por estação; inspeção visual multirresolução |

Nenhum PASS de produto é sustentado nesta campanha.

CONTINUE_FROM=N12.1 (obter sessão autenticada por estação → simulação ponta a ponta) e, em paralelo, N4.2 (Mapa da escola em seções I–VI).


## N12.1 — Recuperação do registro + Mapa I–VI (2026-10-07)
Correções do registro:
- Testes autenticados não são decisão do usuário: usar `lovable auth-session` (mint); só a aprovação HITL de mint por usuário específico é limite real.
- Mapa: fluxo Secretaria envia → Estatística aprova ou devolve é DECIDIDO; devolvido é estado normal; reabertura após aprovação = retificação com versão anterior preservada.
- SIPE: decisão vigente rascunho → enviado → OP aprova/solicita ajuste (não é pendente).
- DP: administrativo dentro do SIGEM; fora só folha/previdência/pensão/consignações (`docs/dp-externo-arquitetura.md` corrigido).
- NEI/CID: decisão N8 prevalece sobre a restrição técnica da 0072; implementação exige registro clínico restrito próprio (N8.2).
- Deep invariants: 31/31 testes passaram (o "4/31" anterior contava 4 arquivos, não falhas).

Entregue (Mapa): `map-structures.ts` (+ teste): seis estruturas I–VI com índice fixo, rótulos "Calculado pelo SIGEM / Precisa revisar / Sem fonte", fluxo rascunho→enviado→devolvido→reenviado→aprovado→retificação projetado da cadeia persistida (conferência = envio, abertura de correção = devolução/retificação, oficialização = aprovação), PDF oficial A4 dedicado (cabeçalho, competência, situação, revisão, I–VI, assinaturas) e PDF de cada revisão histórica a partir do snapshot congelado.
Gates: focais 68/68, typecheck, deep 31/31, suíte completa verde, diff-check.

Status: **PARTIAL** — CONTINUE_FROM=N4.3. Faltam: devolução como ato próprio da Estatística (hoje a "devolução" usa abertura de correção, que exige capacidade de correção) com migration; override com valor calculado × efetivo, motivo, autor e histórico (tabela append-only + writer); regra "próxima competência só após aprovação" no `open_statistical_map` (função pura `canOpenNext` pronta); projeção de mediadores dos vínculos de mediação da Inclusão; testes autenticados por perfil (Secretaria isolada, CIECE rede, Direção leitura) em duas escolas; peso do remanejamento (pendente real).

## N4.3 — PARTIAL (CONTINUE_FROM=N4.4)
Devolução, ajustes auditáveis, exigência da competência anterior e mediadores reais implementados (0211). Não é PASS: não há regra do Mapa homologada nem Mapa aberto no banco, então fluxo real, PDFs de revisões e testes por perfil não puderam ser executados; os testes SQL exigem execução privilegiada (CI). N4.4 = homologar regra 2027 (com `adjustableCellIds`/`requirePreviousCompetenceOfficial` decididos), abrir Mapas de duas escolas e rodar os perfis.

## N5.2 — PARTIAL (CONTINUE_FROM=N5.2.1)
Entregue: enturmação por lista de turmas (sem digitar identificador). Faltam matrícula guiada, vagas, Livro de Matrícula, revisão de turmas/professores, documentos e testes com duas escolas — ver docs/secretaria-escolar-produto-completo.md.

## N6.2 — PARTIAL (CONTINUE_FROM=N6.2.1)
Heatmap habilidade × escola entregue; demais itens pendentes (ver docs/acompanhamento-avaliacao-produto.md).

## N7.2 — PARTIAL (CONTINUE_FROM=N7.2.1)
Núcleo da fiscalização do Diário (projeção pura); demais fluxos OP/Direção pendentes.

## N8.2 — PARTIAL (CONTINUE_FROM=N8.2.1)
Núcleo da fila de termos não reconhecidos; demais itens pendentes.

## N9.2 — PARTIAL (CONTINUE_FROM=N9.2.1)
Regra de verificação pública da carteirinha; demais itens pendentes.

## N10.2 — PARTIAL (CONTINUE_FROM=N10.2.1)
Controlador de autosave testado; integração EI, SIPE, SIA, horários e mobile pendentes.

## N11.2 — PARTIAL (CONTINUE_FROM=N11.2.1)
Regras de atenção/linha do tempo do DP; demais domínios pendentes.

## N3.2 — PARTIAL (CONTINUE_FROM=N3.2.1)
Inventário de rotas em docs/ux-sigem-migracao-rotas.md (classificação heurística). Homes de estação, sidebar/topbar, migração das rotas ANTIGA e regressão visual por breakpoint pendentes.

## N12.2 — PARTIAL (CONTINUE_FROM=N12.2.1)
Matriz em docs/matriz-completude-produto-sigem.md; relatório em docs/ux-sigem-auditoria-final.md. Gaps técnicos decididos ainda abertos impedem o PASS.

## N5.2.1 — Matrícula guiada (SE-01) — PARTIAL
- Entregue: `/matriculas/nova` com sessão = wizard de 8 passos (`src/features/school-secretariat/enrollment-wizard*.ts(x)`), rascunho append-only no banco (0212/0213), CPF só HMAC + final, autosave com expected-head, retomada, descarte confirmado, dedupe por CPF/INEP sem mescla, lista visual de turmas com "capacidade não informada", conclusão transacional estudante→matrícula→turma.
- 0214: tabelas de rascunho sem privilégio direto para anon/authenticated/sandbox_exec. 0215: enturmação recusa turma sem cadastro ativo na data.
- Prova SQL com contas setoriais reais (rollback, `supabase/tests/n5_2_1_enrollment_wizard.sql`): `N521-PROOF-PASS A,C,D B E DIR/OP/CIECE ACL` — retomada, stale-head, CPF fora do texto, turma de outra escola/inativa e data fora do ano sem fato parcial, dedupe/reuso, isolamento A×B, school_id adulterado, Direção/OP/CIECE sem writer, tabela fechada.
- Gates: 6 testes de modelo, typecheck, 31/31 invariantes, freeze de hashes, diff-check. Não executados: full suite, build, browser/mobile, Security Advisor.
- BLOQUEIO real de uso: nenhum ano letivo está aberto (2026 = histórico importado; 2027 sem ato de abertura e sem turmas). A prova usou abertura simulada revertida. Precisa: ato de abertura do ano 2027 pela rede e turmas 2027.
- Foto 3×4: bucket privado existe, upload pela UI ainda não ligado. Contas setoriais não geram `student_registration_events` (exige pessoa); autoria fica no evento de conclusão do rascunho.
- CONTINUE_FROM=N5.2.2 (browser E2E autenticado + foto + full suite/build).

## N5.2.2 — Fechamento técnico do wizard — PARTIAL (só falta E2E em navegador autenticado)
- Foto 3×4 ligada ao wizard (0216: `student_photo_versions`, `enrollment_photo_bind`, `student_photo_current`, envio só JPG/PNG/WEBP, remoção só de foto não vinculada). Inventário de privacidade atualizado.
- UX: "Etapa X de 8", faltas contadas, confirmação de conclusão, foto na ficha final; mensagens do banco sempre traduzidas (teste garante ausência de P0001/PL/pgSQL/UUID).
- Provas: SQL rollback N5.2.1 (fluxo/dedupe/falha/isolamento) + `N522-PHOTO-PASS bind,idempotente,reader direcao-leitura-sem-escrita isolamento ACL`; teste de tela jsdom (rascunho, sair/retomar só pelo banco, foto falsa recusada, JPEG aceito, capacidade não informada, recusa legível, conclusão confirmada, base esperada sequencial, axe sem violações).
- Gates: full suite 3.910/3.910, deep 31/31, typecheck, build real OK, freeze de hashes, diff-check, secret scan limpo, Security Advisor sem achado novo.
- Fixture efêmera: estado "operacional" de 2026 marcado `technical:n522-e2e:op-7a1c`, removido. Contagens finais: 9.763 alunos, 9.811 matrículas, 0 enturmações, 0 rascunhos, 0 fotos, 1 estado de ano. 2027 intocado.
- BLOQUEIO de gate (não é defeito): navegador autenticado como Secretaria exige mint de sessão com aprovação humana, indisponível nesta execução; conta própria do solicitante inexistente; link gerado pelo serviço é proibido. Desktop 1366×768, mobile 390×844 e Secretaria B no navegador NÃO executados. "69 perfis" depende de credencial de ambiente ausente — não executado.
- 2027: abrir ano = `record_academic_year_operational_state` (`preparar-ano-letivo`, Administrador Geral, rede, exige pessoa vinculada); turmas = `register_institutional_class` (`manter-cadastro-de-turmas`, Secretaria). Sem fonte oficial 2027 de turmas no acervo. OPERATIONAL_CONFIGURATION_PENDING — 2027_YEAR_AND_CLASSES.
- Para fechar: aprovar uma vez o login de teste como sec.33001260@ e sec.33001464@; rodar E2E com a mesma fixture marcada.
- CONTINUE_FROM=N5.2.2-E2E (depois N5.3).

## Estado da matrícula guiada (SE-01)
BUILT / INTERACTIVE_BROWSER_VALIDATION_PENDING / OPERATIONAL_CONFIGURATION_PENDING_2027 — sem PASS do wizard até o navegador autenticado.

## N5.3 — Turmas, Vagas e Livro de Matrícula
- 0217/0218: `secretariat_class_vacancies_at` (capacidade só com 1 registro vigente; ausente = `capacidade-nao-informada`, vagas NULL), `secretariat_enrollment_book_at` (projeção bitemporal por knownAt das matrículas vigentes; nome da identidade versionada ou do registro), e `sec_allocate_core` bloqueia `secretariat:class-full` só quando a capacidade é conhecida (lock por turma). Nenhuma tabela nova.
- UI: `/secretaria/vagas` e `/secretaria/livro-matricula` (pesquisa, filtros turma/situação, PDF A4 com páginas numeradas, CSV/XLSX pelo motor comum); atalhos Turmas/Vagas/Livro na estação.
- Prova SQL com rollback (`supabase/tests/n5_3_vacancies_book.sql`): `N53-PROOF-PASS D,E,F,H,I K direcao-le op-le ciece-sem-leitura` — há vaga→lotada, ausente não bloqueia, lotada recusa sem fato parcial e mantém rascunho, Livro reflete matrícula e reproduz knownAt, B não lê A, Direção/OP/CIECE sem enturmar.
- Gates: 331 arquivos de teste, deep 31/31, typecheck, build, freeze, diff-check, secret scan (só padrões de teste/chave pública). Zero resíduo: 9.763 alunos, 9.811 matrículas, 0 enturmações, 0 rascunhos, 0 capacidades de fixture, 1 estado de ano.
- Turmas: lista/criação/edição versionada/turno/oferta/professores já existiam (B2.5.4, B2.6, alocação docente) e foram reaproveitadas, não refeitas; o assistente de 7 passos para criar turma NÃO foi construído neste lote.
- DECISAO_INSTITUCIONAL_PENDENTE: numeração oficial do Livro (ordem exibida é cronológica, não oficial); assinaturas do Livro; critério de prioridade da lista de espera (solicitação de vaga não implementada).
- INTERACTIVE_BROWSER_VALIDATION_PENDING: telas novas sem navegador autenticado; 69 perfis idem.
- Resultado: sem PASS geral do lote — Vagas e Livro COMPLETO_TECNICAMENTE; Turmas (assistente guiado, multietapa, painel docente unificado) e solicitação de vaga em aberto.
- CONTINUE_FROM=N5.3.1 (assistente de turma + multietapa), depois N5.4.

## N5.3.1 — Assistente "Nova turma" + multisseriada + professores (2026-10-07)
- Migrations 0219/0220: composição declarada (`class_composition_versions`/`_positions`, `record_class_composition`, `class_composition_at`); autoria do principal setorial no cadastro (`recorded_by_principal_id`); `secretariat_create_class` transacional.
- UI: `/turmas/nova` = assistente de 7 passos (`class-wizard-page.tsx`, modelo puro `class-wizard-model.ts` + testes); ficha com "Etapa / composição", "Capacidade" e "Professores da turma".
- Prova SQL com rollback (`supabase/tests/n5_3_1_class_wizard.sql`): `N531-PROOF-PASS Y,A,B,C D O L,E,F,M J direcao-sem-writer op-sem-writer ciece-sem-writer` — ano histórico recusa; simples/2 anos/3 anos; catálogo misto, posição repetida, não homologada, capacidade 0, nome duplicado e turno inválido recusados sem turma parcial; autoria = principal setorial sem pessoa; nova versão preserva a anterior; Vagas (há vaga / não informada); enturmação + Livro na turma criada; B não cria/lê/altera A; Direção/OP/CIECE sem writer.
- Gates: 332 arquivos de teste, deep 31/31, typecheck, build, freeze, diff-check, secret scan. Zero resíduo (698 turmas, 0 composições, 0 catálogo, 9.763 alunos, 9.811 matrículas, 0 enturmações, 0 rascunhos, 1 estado de ano).
- Pendências: Professores — vínculo na UI NÃO entregue: o writer de atribuição exige pessoa natural + atuação (principal setorial não assina) e não há matriz curricular nem atuação docente cadastrada; jornada fica em Horários. Mapa III/Diário não leem composição ainda. INTERACTIVE_BROWSER_VALIDATION_PENDING. OPERATIONAL_CONFIGURATION_PENDING — 2027_YEAR_AND_CLASSES e catálogos homologados (etapas/anos, turno) vazios.
- Resultado: PARTIAL (sem PASS SCHOOL_CLASS_MANAGEMENT_TECHNICALLY_COMPLETE). CONTINUE_FROM=N5.3.2 (professores pela Secretaria + leitura da composição no Mapa III/Diário), depois N5.4.
