# PRD — Acompanhamento das Unidades Escolares (SIGEM)
**Status:** proposta funcional inicial, para validação institucional.  
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

## 9. Compatibilidade com a exigência de Google Drive
O documento de origem menciona expressamente uma planilha compartilhada no Google Drive. Um sistema web não cumpre literalmente essa forma de entrega sem anuência do solicitante. Opções:
1. Obter validação formal para o sistema substituir a planilha como instrumento oficial, preservando exportação Excel/CSV.
2. Se a planilha for obrigatória, prover uma visão de consulta sincronizada e unidirecional em Google Sheets, derivada do banco (nunca manter duas fontes editáveis concorrentes). A sincronização exigirá escopo e autorização específicos.

Não prometer integração com Drive antes de definir governança e acesso.

## 10. Sequência de implementação
**Fase 0 — validação institucional:** confirmar campos obrigatórios e opcionais, escopo de escolas, perfis autorizados, catálogo de situações e se a planilha do Drive deve continuar existindo.

**Fase 1 — MVP confiável:** banco/controle de acesso, seleção de escola, visita, observações, plano de ação, atualizações, histórico, testes de autorização e integridade. Testar com dois usuários reais em ambiente controlado.

**Fase 2 — Gabinete:** painel de rede, filtros, indicadores com fórmulas e fontes, detalhamento por escola e relatórios.

**Fase 3 — melhoria contínua:** anexos, agenda de visitas, notificações internas de pendências se autorizadas, exportação/sincronização, refinamento da visualização e acessibilidade.

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
- [ ] A estratégia formal de cumprimento da planilha no Google Drive está acordada.

## 12. Pendências para homologação
- Quem é o setor dono do instrumento e quem autoriza as contas da equipe e do Gabinete?
- Quais campos são obrigatórios no primeiro registro? “Responsável” pode ser só setor/função?
- Quais categorias de pontos fortes e fragilidades serão usadas, se houver?
- Quais valores de situação serão aprovados e como representar ação não realizada?
- É necessário visibilidade às escolas ou, inicialmente, apenas à equipe e ao Gabinete?
- O Google Drive precisa de planilha sincronizada ou a substituição pelo sistema será autorizada?

Estas pendências não impedem projetar a arquitetura e as interfaces, mas impedem transformar opções em normas institucionais definitivas.
