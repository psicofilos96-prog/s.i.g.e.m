# PRD — Acompanhamento das Unidades Escolares (SIGEM)
**Status:** primeira versão funcional implementada em PR #7 (rascunho), com testes automatizados e banco efêmero; implantação institucional e validação com contas reais pendentes.  
**Origem:** seção 4, “Planilha de acompanhamento das unidades escolares”, e seção 5, “Considerações finais”, de documento apresentado pelo solicitante em 03/11/2026.  
**Princípio:** apoiar o acompanhamento sistemático da Rede Municipal de Ensino sem transformar o registro da equipe em procedimento de fiscalização formal.

## 1. Objetivo
Registrar visitas periódicas a unidades escolares, o diagnóstico observado, os aspectos positivos, as fragilidades, o que precisa ser realizado, quem ficou indicado como responsável, os prazos declarados e o que foi ou não executado ao longo do tempo. O Gabinete da Secretaria Municipal de Educação terá visão consolidada para tomar decisões e cobrar providências fora do fluxo de registro.

**Não é escopo do MVP:** o sistema cobrar automaticamente providências, sancionar, aprovar, homologar, emitir notificações oficiais, avaliar desempenho individual, classificar escolas por notas, ou alterar registros da equipe por ação do Gabinete.

## 2. Aderência ao documento recebido

| Item literal | Comportamento exigido |
| --- | --- |
| Unidade escolar | Seleção de cadastro canônico do SIGEM, exibindo nome e INEP quando disponíveis; evitar digitação duplicada |
| Diagnóstico da realidade | Relato descritivo, datado, atribuído à visita e a seu autor |
| Pontos fortes | Zero ou vários registros positivos, com descrição e categoria configurável, facultativa |
| Pontos de fragilidade | Zero ou vários registros de necessidades/dificuldades, com descrição e categoria configurável, facultativa |
| Plano de ação | Uma ou mais medidas vinculáveis à fragilidade; objetivo/descrição, data de proposição, histórico |
| Responsáveis | Rótulo de pessoa, função, equipe ou setor responsável declarado; não pressupor atribuição formal automática |
| Prazos | Data ou período declarado, podendo ser não informado; não criar prazo implícito |
| Acompanhamento | Registros sucessivos do que foi realizado, não realizado, em andamento, resultados e encaminhamentos, sem apagar o passado |

Atualização periódica, planejamento e tomada de decisões exigem histórico por unidade e período, consulta ampla pelo Gabinete e relatórios.

## 3. Papéis e fronteiras
1. **Equipe de acompanhamento (dois servidores autorizados):** consultar unidades em escopo, criar registros de visita, registrar diagnóstico/pontos fortes/fragilidades, cadastrar ações e atualizações, anexar evidências não sensíveis e fazer correções justificadas, preservando versões e autoria. Cada registro possui um autor identificado; a visita pode citar ambos os participantes. Não exigir assinatura conjunta para salvar.
2. **Gabinete:** consultar todas as unidades autorizadas, histórico, painel consolidado, filtros, documentos e exportações. Acesso de leitura; sem editar os registros da equipe, sem alterar situação das ações, sem criar cobrança oficial no MVP.
3. **Administrador institucional:** atribuir explicitamente capacidades e escopos, gerir parametrizações autorizadas, sem adulterar registros históricos.

As permissões devem ser concedidas por capacidades institucionais explícitas e aplicadas no banco, não apenas por ocultação de botões. A presença no Gabinete ou em outro setor não deve conceder acesso automaticamente.

## 4. Experiência de uso — equipe
**Tela A — Escolas:** pesquisa por nome ou INEP, últimas visitas, ações ainda abertas e data da próxima visita se informada. Estados “nunca visitada” e “sem dado” são distintos de zero.

**Tela B — Nova visita:** escola, data, autores/participantes, objetivo opcional, diagnóstico geral, pontos fortes e fragilidades; campos repetíveis; botão “Salvar rascunho” e “Finalizar registro”. Não presumir completude quando o registro está em rascunho.

**Tela C — Plano de ação:** na visita, para cada fragilidade, cadastrar ações com descrição objetiva, responsável declarado, prazo se houver e observações. Permitir ação sem fragilidade vinculada quando houver melhoria preventiva justificada; conservar vínculo com visita de origem.

**Tela D — Retorno/acompanhamento:** mostrar ações abertas da escola antes de nova visita; para cada uma, registrar data, situação declarada, o que foi feito, o que não foi feito, resultado/encaminhamento e evidência opcional. Atualização gera novo evento, nunca sobrescreve a anterior. A ação pode permanecer aberta por várias visitas.

**Tela E — Histórico da escola:** linha do tempo de visitas, fragilidades, ações, atualizações e correções com motivo.

Usabilidade: responsivo para celular, poucos cliques, campos longos adequados, rascunho explícito, mensagens de erro compreensíveis e prevenção de duplicidade por envio repetido. Respeitar a política atual do SIGEM: sem armazenamento privado offline por service worker.

## 5. Experiência de uso — Gabinete
**Painel da rede:** filtros por ano/período, escola, região/distrito (se disponíveis no cadastro), equipe, situação declarada e categoria configurada. Cards: escolas acompanhadas no período/total com acesso, escolas ainda não visitadas, visitas realizadas, ações registradas, ações abertas, ações concluídas conforme registro da equipe, ações com prazo declarado ultrapassado, ações sem prazo informado.

**Gráficos:** visitas por mês; ações por situação; ações por categoria; evolução das ações por mês; escolas por quantidade de pendências (visão de distribuição, não ranking de qualidade). Todos permitem abrir as linhas que compõem a contagem. Indicadores comparativos usam denominador publicado, sem atribuir qualidade ou eficácia de gestão por contagem de registros.

**Detalhamento da escola:** identificação, última visita, histórico cronológico, pontos fortes recorrentes, fragilidades por período, ações abertas e concluídas, prazos, responsáveis declarados, evidências e relatórios.

**Relatórios:** relatório por visita, ficha de acompanhamento da unidade, consolidado do período e lista de ações por situação; PDF A4 e CSV/XLSX pela infraestrutura de relatórios homologada do SIGEM, com filtros, data de emissão e fonte.

O Gabinete consulta e atua administrativamente fora deste módulo. Um eventual processo futuro de cobrança precisará de novo escopo e decisão institucional.

## 6. Modelo conceitual de dados
- **escolas:** reutilizar o identificador canônico da unidade existente no SIGEM; não duplicar nome/INEP como fonte oficial.
- **visitas_acompanhamento:** id, escola_id, data, autor_id, participantes autorizados/nomes declarados, diagnóstico, objetivo opcional, estado técnico, criado_em e versão.
- **observacoes_visita:** id, visita_id, tipo (ponto forte/fragilidade), descrição, categoria configurada opcional, criado_em, versão/correção.
- **acoes_acompanhamento:** id, escola_id, visita_origem_id, fragilidade_origem_id opcional, medida_proposta, responsável_declarado, prazo_declarado opcional, criado_em, autor_id.
- **atualizacoes_acao:** id, acao_id, visita_id opcional, data_efetiva, situação_configurada, descrição_do_que_foi_feito, descrição_do_que_não_foi_feito, resultado, encaminhamento, autor_id, criado_em, versão.
- **anexos_acompanhamento:** id, vínculo tipado (visita/observação/atualização), caminho privado e metadados; nunca URL pública permanente.
- **eventos_auditoria:** autor, momento, operação, identificador, base anterior e motivo para correção/anulação; append-only.

**Regra central:** visita é um evento datado; ação é uma obrigação/medida que pode atravessar muitas visitas; atualização é um novo evento do histórico da ação. Não substituir relatório anterior pelo mais recente.

Categorias e situações com impacto institucional devem ser catálogos configuráveis, versionados e aprovados conforme governança normativa do SIGEM; não fixar regras administrativas no código. Não fabricar exigências nem prazos.

## 7. Regras e integridade
- Não é permitido transformar ausência de registro em “não executado” nem em zero de execução.
- Status “concluída” significa **conclusão declarada pela equipe**, não homologação pelo Gabinete.
- Prazo vencido: prazo declarado anterior à data consultada e ação ainda aberta, sem inferir prazos ausentes.
- Visita salva/finalizada não é apagada; erros são retificados ou anulados com justificativa e vínculo a versão anterior.
- Várias visitas no mesmo dia e mesma escola são possíveis, se forem eventos distintos; duplicação de envio não cria novas visitas.
- Não registrar dados pessoais de estudantes ou laudos nos campos livres/anexos; aplicar orientações de minimização de dados e acesso privado.
- Datas devem seguir o fuso operacional institucional e indicadores devem explicitar período de apuração.
- Nenhuma tela deve mostrar dados de escola fora do escopo do servidor.
- Gabinete não pode registrar, editar, anular ou retificar visitas ou ações por falta de capacidade de escrita, inclusive por acesso direto à API.

## 8. Relação com módulos SIGEM já existentes
Inspecionados no GitHub em 03/11/2026:
- src/features/school-followup/: acompanhamento pedagógico e trajetória estudantil; não é o mesmo instrumento.
- src/features/school-visits/: registro institucional de visitantes; não é visita técnica da equipe.
- src/features/school-supervision/: supervisão formal com procedimentos, catálogo, autorização, auditoria e painel; pode fornecer componentes e padrões, mas não deve receber silenciosamente um fluxo distinto e mais simples.
- src/features/reports/: relatório e exportação comuns, preferir reutilização.

**Diretriz de implementação:** criar domínio próprio, por exemplo src/features/school-institutional-followup/, com páginas adequadas à equipe e ao Gabinete, integrando cadastro de escolas, sessão, capacidades, relatório e componentes visuais do SIGEM. Não duplicar fonte canônica de escolas nem mudar supervisão formal sem necessidade.

## 9. Decisão sobre a ferramenta oficial (03/11/2026)
O solicitante possui autonomia para substituir a planilha idealizada no documento por um sistema web. **Não haverá dependência de Google Drive ou Google Sheets.** O SIGEM será a fonte institucional para visitas, ações, evolução e indicadores. Exportações em PDF e CSV/Excel continuam desejáveis para consultas e reuniões do Gabinete, mas não constituem segunda base editável.

## 10. Sequência de implementação
**Fase 0 — validação institucional:** confirmar campos obrigatórios e opcionais, escopo de escolas, perfis autorizados, catálogo de situações e se a planilha do Drive deve continuar existindo.

**Fase 1 — MVP confiável:** banco/controle de acesso, seleção de escola, visita, observações, plano de ação, atualizações, histórico, testes de autorização e integridade. Testar com dois usuários reais em ambiente controlado.

**Fase 2 — Gabinete:** painel de rede, filtros, indicadores com fórmulas e fontes, detalhamento por escola e relatórios.

**Fase 3 — melhoria contínua:** anexos, agenda de visitas, notificações internas de pendências se autorizadas, exportação, refinamento da visualização e acessibilidade.

**Não fazer sem escopo posterior:** fiscalização automática, rankings de escolas, IA para afirmar conformidade, cobrança formal e acesso irrestrito por cargo.

## 11. Critérios de aceite do MVP
- [ ] Os dois usuários autorizados podem registrar visitas para escolas de seu escopo.
- [ ] O formulário permite preencher os oito itens do documento de origem, mantendo histórico de visitas e de ações.
- [ ] Uma ação pode ser atualizada em muitas visitas sem perder status/descrição anterior.
- [ ] O Gabinete pode consultar toda a rede autorizada e filtrar escolas/ações, mas não consegue escrever via UI ou API.
- [ ] O painel distingue “não visitada”, “não informado”, “zero” e “sem acesso”, e cada contagem deriva de registros consultáveis.
- [ ] Ações com prazo ausente não aparecem como vencidas.
- [ ] PDFs e tabelas exportadas reproduzem os filtros e distinguem versão/autor/data.
- [ ] Nenhum registro ou evidência de escola fora do escopo pode ser lido.
- [ ] Correções são justificadas e preservam histórico.
- [ ] Build, lint, testes e invariantes relevantes do SIGEM passam após implementação.
- [ ] O sistema é a ferramenta oficial do acompanhamento, sem planilha paralela.

## 11.2. Recursos operacionais acrescentados em 04/11/2026
- **Acompanhamento contínuo:** após registrar uma visita, a equipe pode acrescentar medidas ao respectivo plano, sem criar nova visita nem alterar o texto anterior. A medida recebe autoria, data de registro, prazo opcional e chave de idempotência.
- **Identificação das escolas:** o painel apresenta o INEP, quando informado no cadastro oficial, e permite pesquisa por nome ou código INEP. O relatório consolidado inclui esse identificador sem replicar o cadastro.
- **Ficha cronológica por unidade:** exportação em PDF, XLSX e CSV com as versões de visitas, medidas, situação vigente, prazos, autores, registros do que foi e não foi executado, resultados e encaminhamentos. Os dados vêm somente da consulta por escola já autorizada.
- **Limite da implementação:** as medidas do MVP são descritivas e não constituem cobrança administrativa do Gabinete. Rascunhos formais, anexos de evidências privadas, categorias configuráveis, filtros de região/equipe e paginação do histórico ainda dependem de implementação e/ou decisão institucional.

## 11.1. Reforços de integridade implementados em PR #7
- As visitas e os respectivos planos são gravados no mesmo ato transacional, com assinatura SHA-256 do conteúdo completo, evitando repetição de chave com ações distintas.
- Retificação de visita: somente o autor original com competência de escrita; nova versão com justificativa; anteriores consultáveis sem apagamento de ações e atualizações já vinculadas.
- Consulta de históricos: se ultrapassar o limite interno do MVP, a leitura é recusada explicitamente, nunca apresentada como um histórico completo falso. Paginação futura deverá eliminar esse limite sem perda de registros.
- Testes SQL reproduzíveis em PostgreSQL 17 descartável: equipes autorizadas, Gabinete leitor, pessoa sem acesso, idempotência, rollback, histórico de retificação e proteção contra truncamento.
- O teste com fixture isolada não substitui a homologação no esquema integral do SIGEM nem as decisões institucionais sobre quem recebe capacidades.

## 12. Pendências para homologação
- Quem é o setor dono do instrumento e quem autoriza as contas da equipe e do Gabinete?
- Quais campos são obrigatórios no primeiro registro? “Responsável” pode ser só setor/função?
- Quais categorias de pontos fortes e fragilidades serão usadas, se houver?
- Quais valores de situação serão aprovados e como representar ação não realizada?
- É necessário visibilidade às escolas ou, inicialmente, apenas à equipe e ao Gabinete?

Estas pendências não impedem projetar a arquitetura e as interfaces, mas impedem transformar opções em normas institucionais definitivas.

## 11.3. Roteiro de homologação para ativação institucional
**Nenhuma das verificações abaixo deve modificar a base oficial sem aprovação da gestão técnica.**

1. Criar um ambiente isolado com cópia **do esquema**, contendo as migrações efetivamente aplicadas no SIGEM, e dados sintéticos suficientes para testar unidades, pessoas e capacidades. Não clonar dados de estudantes para esse teste.
2. Rodar `0613_school_institutional_followup.sql` e os cenários em `supabase/tests/0613_school_institutional_followup.sql` / `supabase/tests/0613_followup_isolated_positive.sql`, adaptados à política institucional efetiva (o fixture mínimo do CI não substitui esta etapa).
3. Validar os dois servidores nominados como pessoas naturais com `registrar-acompanhamento-institucional` nos escopos aprovados. Um servidor sem tal capacidade não registra nem retifica, mesmo com URL ou UUID da escola.
4. Validar contas de leitura do Gabinete com `consultar-acompanhamento-institucional`: podem ver apenas escolas em escopo e gerar relatórios, nunca escrever, corrigir ou alterar situações.
5. Validar a presença/ausência de INEP diretamente no cadastro de escola; a pesquisa deve encontrar códigos existentes e não fabricar códigos não cadastrados.
6. Executar fluxo real de interface: visita com mais de uma medida, adicionar medida posterior, registrar duas evoluções contraditórias por datas efetivas, retificar a visita com justificativa e confirmar histórico completo.
7. Conferir o mesmo período no painel, gráfico, lista e exportação, inclusive a distinção entre data da visita e situação vigente da ação.
8. Confirmar revisão de privacidade, política de retenção, tratamento de erros e procedimento de suporte para volume que exceda o limite de consulta por escola.
9. Somente após validação técnica e autorização institucional explícita: planejar a aplicação da migration e a concessão versionada de capacidades pela administração do SIGEM.

**Pendências identificadas:** não há ambiente staging institucional comprovado com o esquema completo; os identificadores das contas autorizadas e o ato que homologa os escopos ainda não estão definidos neste PR. Nenhuma capacidade é concedida automaticamente.

## 11.4. Consulta operacional, filtros e cronologia
- **Unidades:** filtro por visita realizada no período, unidade sem visita no período e unidade com medidas vencidas. O painel e os gráficos mantêm o denominador da rede autorizada; a lista e os relatórios consolidados refletem a seleção atual, explicitada na tela.
- **Medidas:** filtros por situação declarada, sem atualização, sem prazo e prazo vencido, além de pesquisa por descrição, responsável e data. A ordenação usa prazo informado crescente, deixando prazos ausentes por último, sem atribuir notas ou ranking.
- **Linha do tempo coerente:** evolução não pode ser registrada antes da data vigente da visita que originou a medida. O mesmo vale para visita associada à atualização. Retificação da data é recusada quando produziria evolução anterior à visita ou ultrapassaria prazo já cadastrado.
- **Mensagem ao usuário:** erros de cronologia são traduzidos em linguagem operacional; a causa detalhada permanece na validação SQL. Os cenários negativos são testados no PostgreSQL descartável.
- **Eficiência do CI:** novas revisões de um mesmo PR cancelam as execuções obsoletas, mantendo idêntica cobertura para a revisão mais recente. O `main` e outros PRs usam grupos independentes.

## 11.5. Quadro de providências da rede
- Consulta transversal das medidas ainda não declaradas concluídas, com unidade, INEP oficial quando disponível, descrição, responsável informado, prazo, situação vigente e data efetiva da última evolução.
- Filtros por texto, responsável, situação, prazo vencido, falta de prazo e falta de atualização. Paginação da tabela em 25 itens; exportação PDF, XLSX ou CSV das linhas filtradas autorizadas.
- O PostgreSQL verifica o escopo de cada escola antes de agregar o resultado, inclusive para contas do Gabinete; não permite que um usuário escolar consulte registros da outra escola. A leitura usa JSONB para não sofrer o limite de linhas da API. Se houver mais de 5.000 medidas abertas autorizadas, interrompe com erro explícito para evitar informações parcialmente exportadas.
- Provas SQL incluem uma providência sentinela na escola B, inacessível para o servidor da escola A e visível ao Gabinete leitor, além de teste de carga da proteção contra truncamento.
- Nenhum controle de cobrança, sanção, aprovação ou alteração de situação foi acrescentado para o Gabinete.
## 11.6. Navegação do quadro transversal para a medida
- O botão **Ver medida** transfere os identificadores de unidade e medida da RPC autorizada para a ficha escolar, restabelecendo a visão integral dos registros e focalizando o item correto depois do carregamento.
- Os filtros anteriores da escola não escondem a medida selecionada. A navegação é apenas de leitura; a escrita segue exigindo permissão própria no PostgreSQL.
- Se a medida não constar do snapshot autorizado, o sistema informa que os dados devem ser atualizados, sem navegar para outra unidade ou fabricar registro.
## 11.7. Vínculo da evolução com visita de retorno
- Ao atualizar uma medida, a equipe pode associar a evolução a uma visita vigente da própria unidade, ocorrida até a data informada para o fato. O vínculo é opcional, pois a equipe também pode receber atualizações sem deslocamento presencial.
- A visita de retorno não substitui a visita original do plano: a origem permanece em `action.visit_logical_id`; o registro evolutivo guarda `update.visit_logical_id` da visita em que o fato foi observado.
- A referência aparece no histórico da ação, na ficha da unidade e no relatório individual da visita de origem. Retificações de visitas mantêm o vínculo lógico e a data vigente é exibida; registros de outras escolas não podem ser associados.
- Testes verificam candidatos disponíveis, exclusão de outras escolas e de visitas futuras, vínculo lógico persistido e recusas SQL para vínculo entre escolas e evolução anterior à visita.
## 11.8. Identificação de participantes e objetivo da visita
- Os dois servidores podem registrar quem mais participou da visita em campo opcional, com a indicação de um objetivo específico para aquela atividade. Esses textos são **declarações**, não assinaturas ou concessões de acesso.
- O autor responsável por gravar o fato permanece identificado automaticamente pelo usuário e pessoa natural autenticados, sem depender dos participantes digitados.
- Objetivo e participantes são mantidos na versão original e nas retificações, com exportação na ficha da unidade e no relatório da visita. Retentativas idempotentes recusam alterações desses conteúdos sem nova chave.
- O teste PostgreSQL assegura persistência, identificação do autor e detecção de conflito de chave. Dados pessoais de estudantes e laudos não devem ser incluídos.
## 11.9. Preparação da visita — providências ainda abertas
- Ao abrir a ficha de uma unidade autorizada, antes do formulário de visita, o SIGEM destaca as medidas sem conclusão declarada, com contagens de prazos vencidos e ausência de atualizações.
- Exibe cinco itens prioritários por prazo inicialmente e oferece `Mostrar todas` para consultar o restante. A ausência de prazo não é considerada vencimento; uma declaração de conclusão não constitui homologação.
- `Ver acompanhamento` abre diretamente o histórico completo da medida dentro da mesma escola, removendo filtros locais que poderiam ocultá-la. Não descarta textos de formulários em edição nem concede capacidade de escrita.
- O painel reutiliza o snapshot escolar já verificado no SQL (sem nova RPC), com testes de situação, vencimento, expansão e navegação. Continua sendo necessário homologar em clone e com contas reais antes de publicar.

## 11.10. Roteiro de preparação da próxima visita — 04/11/2026
- O painel da ficha escolar oferece **Roteiro PDF / Excel / CSV** para levar à visita, quando existem medidas ainda não declaradas concluídas.
- Exporta **todas** as medidas não concluídas do snapshot escolar autorizado, inclusive além das cinco exibidas inicialmente no painel. Ordena pelo prazo declarado; sem prazo vai ao final, sem presumir vencimento.
- Para cada medida, exibe visita de origem vigente, responsável declarado, prazo, situação, data efetiva da evolução mais recente e o relato daquela evolução (feito, não feito, resultados e encaminhamentos), preservando lacunas como dados não informados.
- Nome e INEP vêm da consulta autorizada e do cadastro canônico. O relatório é apenas um roteiro informativo, **não registra visita, não substitui evolução no SIGEM, não homologa e não cobra**.
- Testes unitários cobrem ordenação, exclusão de conclusão, escopo de unidade, cronologia da última atualização, ausência de dados e neutralização de fórmulas em CSV. Nenhuma RPC, capability ou migration nova é necessária.
- A publicação institucional continua condicionada à homologação com contas autorizadas e esquema completo isolado.


## 11.11. Evolução diretamente do roteiro de preparação — 04/11/2026
- Cada medida sem conclusão declarada na ficha autorizada pode apresentar **Registrar evolução** ao lado de **Ver acompanhamento**. O botão de escrita só é ofertado à equipe com capacidade de registro no escopo da unidade; o Gabinete continua com leitura e exportações, sem poder gravar.
- O atalho **somente abre** o formulário existente da medida selecionada e foca a área de preenchimento; não altera situação, não antecipa conclusão e não cria evolução automática. A RPC de escrita continua validando pessoa natural e escopo no PostgreSQL.
- O formulário informa qual medida foi selecionada. Textos, data, situação e vínculo a visita anterior começam limpos ao iniciar uma nova evolução. Dados em edição não são apagados silenciosamente: para trocar de medida, a equipe deve concluir ou cancelar o formulário corrente.
- Ao cancelar, o rascunho local é limpo. Trocar de escola com evolução em preenchimento é bloqueado até salvar ou cancelar; quando não houver edição em andamento, a troca limpa o formulário para evitar reaproveitamento de textos entre unidades. O mesmo fluxo é utilizado pelo atalho do painel e pelo botão do histórico.
- Testes verificam que o Gabinete não recebe o botão de escrita, que a ação concluída não aparece no roteiro, que o callback recebe o identificador correto e que o detector de rascunho reconhece alterações em data, visita, situação ou textos.
- Não foram criadas migrations, RPCs, permissões novas nem automações administrativas. A homologação continua condicionada a CI e clone institucional integral isolado.

## 11.12. Proteção de preenchimentos ainda não registrados — 04/11/2026

A seleção de outra escola, incluindo o quadro transversal de providências e o comando **Fechar escola**, não descarta silenciosamente formulários em edição. Antes de trocar, a interface verifica, nesta ordem:

- **Visita/retificação:** diagnóstico, objetivo, participantes, pontos fortes, fragilidades, observações, data, justificativa, medidas do plano e contexto de retificação; impede a troca enquanto houver dados em edição ou gravação em curso.
- **Medida adicional:** descrição, responsável, prazo e tentativa de gravação pendente; orienta salvar ou cancelar a medida aberta.
- **Evolução de medida:** data, situação, visita vinculada, o que foi/não foi feito, resultados e encaminhamentos; preserva o formulário até registro ou cancelamento.

A abertura de outra visita para retificação ou de outra medida também protege o respectivo formulário já preenchido. **Descartar preenchimento** limpa a visita nova mediante ação explícita; **Cancelar retificação**, **Cancelar** medida e **Cancelar** evolução continuam disponíveis, mas não durante o envio para o servidor. Depois de salvar, os campos voltam ao estado inicial.

**Limites:** não há persistência de rascunho no servidor nem armazenamento offline. A proteção cobre a navegação dentro deste módulo; encerramento da aba, saída para outra rota ou perda de sessão ainda podem perder conteúdo em edição. A futura funcionalidade de **Salvar rascunho** prevista no PRD depende de decisão sobre segurança, persistência e autorização; não é simulada por este mecanismo.

Testes unitários validam detecção de alterações substantivas (inclusive prazo sem descrição e correção aberta) e preservam o caso de linhas adicionais totalmente vazias.

## 11.13. Alerta de saída do navegador com formulário não registrado — 04/11/2026

Complemento aos bloqueios de troca de escola dentro do módulo: enquanto existir visita, retificação, medida adicional ou evolução em preenchimento, ou uma requisição de escrita em andamento, o SIGEM registra um `beforeunload` temporário. Navegadores compatíveis **podem** apresentar confirmação ao tentar **recarregar a página, fechar a aba ou sair da página por navegação completa**; o diálogo é controlado pelo navegador, não pelo SIGEM.

- O alerta é desativado quando a equipe salva/cancela o último formulário ainda pendente e é removido ao desmontar o componente.
- Uma mensagem discreta na ficha indica a existência de preenchimento ainda não registrado.
- Nenhum campo é copiado para `localStorage`, `sessionStorage`, armazenamento offline ou API externa; o alerta não representa salvamento de rascunho.
- **Limites importantes:** o navegador pode suprimir o diálogo em certas situações, sobretudo em aparelhos móveis. Navegações internas client-side (SPA), saída forçada do aplicativo, perda de sessão e falhas do dispositivo **não** estão cobertas de maneira garantida. Persistência real e bloqueio de rotas são etapas futuras independentes.
- Um teste jsdom valida montagem/desmontagem do listener e ativação/desativação mediante o estado de rascunho.


## 11.14. Proteção de navegação entre telas internas — 04/11/2026

O alerta nativo `beforeunload` não cobre de modo confiável as transições dentro do aplicativo. O módulo agora utiliza também o bloqueador de rotas do TanStack Router, seguindo a mesma interface de confirmação institucional já presente em Diário de Classe e Avaliação.

- Com dados de visita, retificação, medida ou evolução ainda em edição, a tentativa de sair para outra rota do SIGEM solicita confirmação para **Sair e descartar**. Cancelar mantém a pessoa na tela atual com os campos preenchidos.
- A confirmação explicita que o preenchimento ainda não registrado será perdido; não envia os dados para outra aplicação e não modifica os registros históricos.
- Sem dados em edição, nenhuma confirmação aparece. Caso a infraestrutura de confirmação esteja indisponível, a operação falha fechada (não descarta silenciosamente).
- A proteção de rotas internas e o alerta de recarga/fechamento são separados para evitar ouvintes duplicados de `beforeunload`.
- Os testes incluem navegação limpa, cancelamento, confirmação positiva, falha do diálogo e desativação após salvar/cancelar.

**Limites:** isso não cria salvamento persistente, não garante proteção contra crash ou encerramento forçado e não substitui a validação de navegação real em desktop e celular. O Gabinete permanece sem acesso às operações de escrita.

Complemento de segurança: durante uma gravação ativa de visita, medida ou evolução, a navegação interna é **bloqueada sem opção de descarte** até a resposta do servidor. O diálogo de descarte só pode ser apresentado para campos em edição, nunca para uma RPC cujo resultado ainda é desconhecido. A proteção de recarregamento/fechamento segue dependente dos limites do navegador.

## 11.15. Testes integrados da página com capacidades simuladas — 04/11/2026

Além dos testes de componentes e dos testes SQL em PostgreSQL descartável, a página inteira passa a ter cenários de integração React para ausência de sessão, Gabinete com consulta sem botão de gravação, servidor com autorização de registro e fluxo de visita/plano, e navegação protegida quando o diagnóstico ainda não foi salvo. A gravação de visita e plano verifica um único envio atômico ao `recordVisitBundle`, com idempotência e vínculo correto da escola; o conteúdo só é enviado quando o servidor escolhe salvar.

Esses testes usam **mocks de dados e capacidades** e não são prova de concessão institucional, de autorização real em RLS/RPC, de desempenho em navegador ou de aceitação dos usuários. A migração 0613 continua dependente da homologação no clone integral isolado e dos perfis reais autorizados.


## 11.16. Edição de medidas no plano antes de salvar — 04/11/2026

O formulário de visita permite retirar **qualquer medida proposta**, inclusive a intermediária, sem apagar o conteúdo das demais. As linhas possuem identidade local estável (somente React) e continuam ordenadas conforme a digitação; cada botão informa o número da medida. O último campo vazio permanece para permitir criar um plano novo. A remoção é exclusivamente **anterior ao registro**: após a gravação institucional, medidas e evoluções permanecem no histórico e nunca são apagadas por essa interface.

O sistema não permite remover uma medida ou acrescentar outra enquanto a visita estiver sendo enviada. Os testes integrados verificam exclusão da segunda entre três medidas e persistência das descrições/responsáveis da primeira e terceira no envio final.

## 11.17. Ordenação manual de medidas propostas — 04/11/2026

Antes de salvar uma visita, a equipe pode usar **Subir** e **Descer** em cada medida proposta para organizar a **sequência do envio**. A identificação local estável da linha preserva descrição, responsável e prazo, independentemente da posição. **A posição não é persistida** na estrutura atual do banco: as consultas posteriores podem ordenar as medidas por prazo ou outros critérios. Não afirmar que a sequência visual do rascunho será exibida de forma idêntica no histórico. Os movimentos inválidos nas extremidades e todas as operações de reorganização durante o envio ficam desabilitados.

A alteração atinge exclusivamente a lista em memória ainda não registrada; a assinatura de tentativa de gravação anterior é invalidada quando a ordem muda. Após a confirmação de gravação, o histórico institucional é imutável pelo módulo, sem remoção ou reorganização retroativa. Testes puros e de integração cobrem reordenação e sequência final enviada, além de escrita limitada à escola com capacidade explícita. A UI de permissões não substitui a validação da RPC/RLS no banco.

## 11.18. Confirmação antes de descartar informações ainda não gravadas — 04/11/2026

As ações **Remover esta medida** (quando a linha tiver descrição, responsável ou prazo), **Descartar preenchimento**, **Cancelar retificação**, **Cancelar medida** e **Cancelar evolução** exigem confirmação destrutiva institucional quando houver texto, seleção ou tentativa de gravação ainda pendente. Cancelar a confirmação preserva integralmente os campos e a escola ativa; se o diálogo não estiver disponível, a exclusão não ocorre. A remoção de uma linha totalmente vazia pode ser imediata, pois não há conteúdo a perder.

A confirmação é oferecida somente para **rascunhos locais**, sem tocar em medidas, evoluções ou revisões já registradas. Durante a escrita em andamento, os comandos de descarte continuam bloqueados. Testes de integração simulam aceitação e recusa e verificam preservação de dados e ausência de chamada de gravação quando a pessoa cancela.

## 11.19. Validação antecipada de medidas do plano — 04/11/2026

Na ficha da visita, cada linha de medida proposta apresenta **erro contextual imediatamente durante o preenchimento**, quando existe responsável/prazo sem descrição ou quando o prazo informado é anterior à data da visita. Os avisos têm identificação da linha, associação de acessibilidade com o campo incorreto (`aria-invalid` e `aria-describedby`) e desaparecem após a correção. Um resumo indica quantas medidas já possuem descrição e quantas precisam ser corrigidas; a ação **Salvar visita e plano** fica indisponível enquanto houver inconsistências, mas o servidor continua podendo editar, ordenar ou remover medidas em segurança.

A validação reage também quando a data da visita é alterada depois de cadastrar prazos. Linhas totalmente vazias são opcionais e não são tratadas como falha. A regra final ainda é aplicada no evento de envio e verificada no PostgreSQL institucional; esta melhoria não substitui a autorização do banco. Não foi criada persistência de rascunho nem alterada a migration.

## 11.20. Última evolução na preparação da visita — 04/11/2026

O quadro **Antes da próxima visita** mostra a última evolução declarada em um bloco expansível por medida ainda não concluída, exibindo data efetiva, situação, autoria, o que foi feito, o que não foi feito, resultados e encaminhamentos. A consulta permanece inicialmente compacta e não cria requisições adicionais ao banco: utiliza o mesmo histórico de leitura autorizado da unidade. Quando não há evolução, informa **Sem evolução registrada** sem deduzir omissão ou inexecução.

O resumo utiliza a função canônica `currentUpdate`, inclusive a regra de desempate entre evoluções de mesma data, e não substitui a trilha completa de histórico ou o roteiro PDF/Excel/CSV. A visualização está disponível ao Gabinete, enquanto **Registrar evolução** continua exclusivo de capacidades explícitas de escrita. Os testes cobrem a última atualização, exclusão das anteriores do resumo, ausência de evolução e separação de leitura/escrita.

## 11.21. Filtros locais para preparação da visita — 05/11/2026

O quadro **Antes da próxima visita** permite selecionar **todas as medidas sem conclusão declarada**, **com prazo vencido**, **sem atualização registrada** ou **sem prazo declarado**, além de pesquisar descrição ou responsável sem distinção de acentos e maiúsculas/minúsculas. Os filtros atuam exclusivamente nas medidas autorizadas já consultadas da escola, sem novas RPCs nem mutações. A lista respeita a ordenação por prazo, e a prévia volta aos cinco primeiros itens ao alterar os filtros. Se a seleção não tiver resultados, a tela esclarece que nenhum registro foi apagado.

Os indicadores de pendências não são recalculados pela pesquisa, preservando a noção do conjunto inteiro. **Roteiro PDF/Excel/CSV continua exportando todas as providências sem conclusão declarada**, inclusive as ocultadas pelo filtro ou pela prévia; a interface informa expressamente essa diferença para evitar relatórios aparentemente incompletos. Gabinete conserva acesso somente à consulta; apenas a equipe com capacidade explícita vê o botão de registrar evolução. Os testes verificam situações, busca sem acentos, contagens estáveis, vazio filtrado e paginação compacta.

## 11.22. Comparação descritiva de duas visitas — 05/11/2026

A ficha escolar apresenta **Comparar duas visitas da unidade**, exclusivamente para leitura. O servidor e o Gabinete podem escolher duas visitas vigentes daquela escola e confrontar lado a lado objetivo, diagnóstico, pontos fortes, fragilidades, observações e participantes informados. A ordenação dos dois relatos respeita a data efetiva da visita; encontros no mesmo dia permanecem distintos e identificados pela autoria. O bloco começa com as duas visitas distintas mais recentes, quando existirem.

Retificações da mesma visita lógica não são contadas como uma visita adicional: a comparação utiliza somente a versão vigente. O histórico anterior de cada visita e as evoluções das medidas continuam consultáveis no quadro original. Se houver menos de duas visitas, a interface informa essa condição; selecionar o mesmo registro nos dois campos não gera comparação. **Não se calculam índices de melhoria, eficácia ou cumprimento**, tampouco se interpreta ausência de relato como ausência de atividade. A consulta é feita sobre o retrato já autorizado, sem novas RPCs e sem escrita. Testes verificam versão lógica, escopo escolar, estados vazios, seleção manual e leitura do Gabinete.

## 11.23. Congelamento dos formulários durante escrita institucional — 05/11/2026

Os três formulários de escrita (**nova visita/retificação**, **medida adicional** e **evolução**) desabilitam todos os controles, incluindo campos de texto, datas, seletores e botões, desde o início da gravação até sua confirmação ou falha. Isso mantém coerência entre o conteúdo visualizado durante o envio e o payload idempotente efetivamente transmitido, sem aceitar uma alteração tardia que pudesse ser descartada pelo reset após salvar. O agrupamento semântico por `fieldset disabled` cobre também o componente de data brasileiro e impede eventos de preenchimento durante a operação; a página já bloqueia troca de escola ou saída sem autorização.

Após êxito, o formulário é limpo/fechado como já ocorria; em falha, permanece com seus dados e volta a permitir edição, sem apagar a chave de repetição do mesmo payload. Testes de integração com gravações simuladas em espera asseguram bloqueio simultâneo dos controles e comportamento após resposta, sem acessar o Supabase real. Não houve alteração de banco, política de acesso ou contrato RPC.

## 11.24. Regressão da espera de dados e das chaves de idempotência — 05/11/2026

A suíte de integração agora aguarda explicitamente os botões operacionais que dependem do carregamento assíncrono do histórico da escola, evitando falhas espúrias por tentar interagir antes de o dado autorizado chegar. Em testes com promessas controladas, os formulários preservam o relato após falha de rede, liberam novamente os campos e verificam que uma repetição **sem alteração de conteúdo** reaproveita a chave de idempotência da visita e das medidas propostas ou da medida adicional. Depois de alterar o diagnóstico e iniciar uma nova tentativa, a operação recebe nova chave. Trata-se de cobertura da lógica já implementada; não há nova RPC nem gravação em banco oficial.

## 11.25. Confirmações condicionadas ao conteúdo vigente — 05/11/2026

Descarte de visita/retificação, cancelamento de medida adicional ou evolução e remoção de linha do plano exigem não apenas confirmação institucional, mas também que **o conteúdo e o contexto da operação permaneçam exatamente os mesmos** após a resposta da janela de confirmação. Uma nova digitação, alteração de prazo, troca de medida ou modificação das solicitações idempotentes torna a confirmação anterior obsoleta. Nesses casos a ação é recusada, o relato é preservado e a interface explica que é necessário conferir e solicitar novamente. A comparação considera também o identificador da escola, destino da medida, visita associada e todas as linhas do plano, prevenindo descarte de texto alterado em outra linha. Confirmações simultâneas de descarte na mesma tela falham fechadas; erro ou ausência do host também não apaga registros.

A proteção é exclusivamente local e não modifica o contrato de escrita, as políticas do banco ou o histórico append-only. Os testes de integração usam promessas de confirmação controladas para simular edição após abrir o diálogo, em cada um dos quatro fluxos.

## 11.26. Validação do contrato de leitura da ficha escolar — 05/11/2026

A fronteira de leitura `schoolFollowup` deixou de fazer conversão direta do JSON de resposta para `SchoolSnapshot`. O novo validador `parseSchoolFollowupSnapshot` recusa o retrato inteiro se vier incompleto, com linhas malformadas, dados de **outra unidade**, medida sem visita de origem, evolução sem medida associada, visita de retorno não reconhecida, identificadores duplicados ou volume além dos limites já declarados pela RPC. A interface usa seu estado existente de erro e não apresenta nem exporta uma ficha parcialmente filtrada como se estivesse íntegra. Respostas consistentes, inclusive retificações históricas, permanecem sem mutações ou alterações de ordem. Essa validação é defesa em profundidade: **a autorização e a RLS continuam obrigatórias no PostgreSQL**, não sendo substituídas pelo navegador. Testes puros cobrem leituras válidas e condições de recusa.

## 11.27. Integridade dos indicadores, da série mensal e das situações — 05/11/2026

Os resultados das RPCs de panorama, gráfico mensal e distribuição das situações são validados antes de chegar à tela e às exportações. O contrato `network-read-contract.ts` recusa unidades sem identificação, IDs duplicados, datas inválidas, contadores ausentes, negativos, fracionários ou não numéricos, bem como conclusões/vencimentos inconciliáveis com o total de medidas. Para o gráfico mensal, cada mês deve estar dentro do intervalo solicitado e aparecer no máximo uma vez. Para as situações, cada categoria deve estar no catálogo atualmente admitido pelas RPCs, com contagem válida e sem duplicação. Uma resposta inválida produz erro explícito, nunca zero ou `NaN` nos indicadores.

Listas vazias continuam legítimas; meses sem registro não são inventados. A consulta e a autorização permanecem exclusivamente nas RPCs; a validação TypeScript no cliente é proteção adicional de integridade, não controle de acesso. Testes puros cobrem dados corretos, ausências, duplicações, meses fora da seleção e categorias desconhecidas. Nenhuma estrutura SQL ou permissão foi alterada.

## 11.28. Contrato de integridade do quadro de providências — 05/11/2026

O quadro de providências consultado pelo Gabinete passa a usar `parseNetworkPendingFollowup` para validar **integralmente** o JSONB recebido da RPC institucional antes de alimentar busca, filtros, indicadores e exportações. Dados obrigatórios (ID da medida, ID/nome da escola, descrição, situação e registro temporal) não podem estar ausentes ou vazios; INEP, responsável e prazos opcionais não são convertidos de tipos inválidos em texto. Prazos e última atualização devem ter datas civis válidas; a data de criação deve ser um instante com fuso; identificadores duplicados, situações fora do catálogo e medidas declaradas concluídas no quadro de não concluídas provocam erro explícito. Uma linha `sem atualização` não pode conter data da última evolução, nem uma linha com situação atualizada pode omiti-la. O limite de 5.000 medidas é novamente conferido no cliente, além do bloqueio existente em SQL.

O validador **não corrige ou elimina linhas**, não atribui obrigações ou sanções e não substitui a autorização da RPC no PostgreSQL. Lista vazia é válida, sem equivaler a falta de execução. Testes específicos cobrem dados válidos, campos ausentes, duplicações, datas inválidas e situação inconsistentes. Sem alteração de banco ou de poderes de consulta.

## 11.29. Roteiro de foco com seleção de providências — 05/11/2026

O painel **Antes da próxima visita** permite selecionar medidas específicas pendentes com caixas individuais ou o comando `Selecionar todas do filtro` (incluindo itens além da prévia). A seleção permanece apenas na interface, não cria nova medida nem substitui a evolução histórica: o servidor registra os resultados na medida original por `Registrar evolução`. A escolha de escopo antes de exportar distingue explicitamente **roteiro integral** (todas as pendências autorizadas, mesmo escondidas por filtros) de **roteiro de foco** (somente IDs selecionados, inclusive se o filtro visual for alterado). Os arquivos de foco usam prefixo próprio e identificação de escopo em PDF/XLSX/CSV.

O motor do roteiro valida os IDs selecionados contra a ficha vigente autorizada, rejeitando seleções vazias, repetidas, de outra escola, já concluídas ou removidas. Caso uma medida deixe de ser pendente após atualização da consulta, o painel mantém a seleção, avisa sobre o descompasso e impede exportação seletiva até revisão/limpeza, sem descartar dados silenciosamente. Testes cobrem seleção, filtro, limites de prévia, versão atualizada e exportações; nenhuma RPC, autorização, tabela ou writer é alterado.

## 11.30. Seleção obsoleta mesmo sem pendências — 05/11/2026

Quando o último item marcado é declarado concluído em uma consulta atualizada, o painel de preparação passa a exibir o alerta de seleção desatualizada **fora da seção condicionada à existência de pendências**. Dessa forma, o servidor recebe o aviso e pode limpar a seleção mesmo quando restam zero medidas não concluídas. Quando há outras medidas ainda pendentes, o aviso permanece, a exportação de foco é bloqueada, mas a exportação integral pode continuar com a lista vigente. Os testes de integração cobrem tanto zero quanto algumas pendências remanescentes, além da cópia atual do texto explicativo da exportação. Nenhum fato é reaberto, copiado ou apagado.

## 11.31. Revisão de seleções e limpeza seletiva de pendências obsoletas — 05/11/2026

O filtro local de preparação ganhou `Somente selecionadas`, permitindo revisar ou desmarcar as medidas escolhidas mesmo após trocar os filtros originais. Ele mostra apenas medidas que **continuam pendentes**; não altera o escopo do roteiro integral nem o registro de evolução. Ao atualizar o snapshot e detectar IDs que deixaram de estar pendentes, o alerta agora oferece `Retirar medidas não pendentes`, removendo somente as obsoletas, preservando as que permanecem válidas. Se não houver pendências, continua disponível a limpeza da seleção desatualizada. A exportação seletiva é liberada novamente apenas após a seleção inteira ser válida. Testes de interface cobrem revisão, desmarcação, permanência após atualização e exportação do subconjunto restante, sem alterar SQL, permissões ou dados oficiais.

## 11.32. Proteção de seleção durante exportação de roteiros — 05/11/2026

O painel de preparação agora bloqueia temporariamente seleção individual, seleção em massa, limpeza (inclusive de seleções obsoletas), filtros, pesquisa, escopo da exportação e atalhos de consulta/evolução enquanto o arquivo PDF/Excel/CSV está sendo produzido. Exibe um estado acessível de preparação para download. Isso impede que o operador altere o conjunto de medidas no meio de uma exportação assíncrona e confunda o resultado com um estado posterior da tela. Ao concluir ou falhar, a seleção original é preservada, os controles são liberados e a falha segue para o alerta já existente, sem registro no banco. A proteção é verificada por teste de integração com uma promessa de exportação controlada; não muda a geração, os dados nem a RPC.

## 11.33. Recuperação de falhas e proteção contra exportação duplicada — 05/11/2026

Se a geração de um roteiro falhar, o painel mantém a seleção de providências e o formato escolhido, mostra o erro governado e oferece o botão **Tentar novamente o PDF/Excel/CSV**. Essa repetição é uma nova ação explícita do servidor e utiliza a **consulta vigente** da escola, sem persistir ou reaproveitar uma cópia antiga de dados pessoais. O botão só é oferecido enquanto escola, escopo e conjunto de IDs escolhidos permanecerem os mesmos; se o operador editar a seleção, deve iniciar nova exportação pelo botão de formato normal. Se uma seleção ficou obsoleta por atualização do histórico, a tentativa é bloqueada até revisão da escolha. Uma trava síncrona em `useRef` impede duas exportações concorrentes por cliques rápidos antes do React atualizar o estado, além do bloqueio visual já existente. O aviso de geração distingue roteiro integral de selecionado. Testes simulam falha de conexão, repetição bem-sucedida, mudança de escolha e cliques duplos; nenhuma escrita institucional nem novo serviço foi introduzido.

## 11.34. Cancelamento de downloads ao sair da ficha da unidade — 05/11/2026

Quando um servidor inicia a geração de um roteiro e muda de escola ou sai da ficha antes de terminar, o painel desfaz a autorização de baixar aquele arquivo **na sessão atual da interface** por meio de `AbortController`. O sinal é enviado à função de exportação: geração PDF/Excel ainda pode concluir internamente, mas **não aciona o download** depois de cancelada. A conversão que ainda nem começou também é descartada. O painel cancela no unmount e ao trocar `schoolId`; não há persistência local nem cache do conteúdo da escola. A exportação CSV e conversões normalmente concluídas continuam funcionando. Testes cobrem unmount em operação e cancelamento após iniciar a conversão de PDF/Excel, garantindo que `downloadBlob` não seja chamado. Não substitui autorização da RPC e não muda SQL nem capacidade do Gabinete.
