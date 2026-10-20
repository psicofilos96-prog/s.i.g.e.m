# Roadmap — SIGEM simples no design original

## Acesso docente indevido (19/10/2026)
- [ ] Continuação PERF.LOADING.1: Administrador medido; Administração 22,1 s, Central de acessos 9,7 s; investigar consultas repetidas de atuações e três respostas 403 na trilha da Estação administrativa. Integrações recusa antes de ler domínio; 17,8 s fria → 3,6 s repetida (módulos locais até 9,9 s), não atribuir a demora ao overview que não foi chamado.
- [x] Integrações: leitura interna por autoridade efetiva, sessão, prazo 15 s e validação; 29 testes PASS (incluem aborto/recuperação e dados malformados), build OK; navegador administrativo confirmou recusa e nenhuma chamada ao overview. Leitura positiva no navegador aguarda conta com capacidade de rede, sem concedê-la para teste.
- [x] Avaliações docentes: consultas montadas somente após autoridade/pathAllowed, chaves por sessão e prazo de 15 s, recuperação explícita inclusive em anexos/cabeçalhos. Corrigido leitor curricular que perdia o contexto do cliente. 35 testes PASS; docente real abriu avaliações e recuperou consulta de itens retida. Conta sem regência vigente: criação/publicação não exercitadas e nenhuma atribuição inventada. Auditoria global de lentidão continua aberta.
- [x] Confirmação inicial da sessão e das permissões limitada a 15 s; login reutiliza a origem compartilhada e oferece recuperação sem assumir saída. 36 testes PASS; consulta de concessões retida no navegador docente mostrou erro recuperável e só quatro consultas de autoridade, nenhuma de domínio; Tentar novamente reabriu Minhas turmas. Não encerra a auditoria global PERF.LOADING.1.
- [x] /administracao deixou de ler cadastros para conta sem capacidade administrativa (48→10 leituras, 16,9→3,6 s). Medição com sessão docente registrada; faltam outros setores.
- [x] Continuação: Central de acessos e Estação administrativa montam leitores só após pathAllowed; espera limitada a 15 s, isolamento por sessão e descarte de respostas tardias. Docente: Central recusada e zero consultas à política/regras/atuações/encerramentos (antes: 5 consultas); testes de montagem sem sessão e docente. Continuação administrativa: ambas abriram; três fontes alheias à trilha administrativa retornaram 403 no loader global, investigação registrada no item PERF.LOADING.1.
- [x] Sessão docente reproduziu o acesso indevido; portões por capacidades removem Gestão Escolar e outras estações, inclusive acesso direto. Diário continua acessível; permissões do banco não foram alteradas. Testes de regressão e navegador com a conta da imagem.

## Mensagens para o usuário (19/10/2026)
- [x] Retirado o “Itaperuna” repetido sobre a imagem; identificação institucional preservada e conferida no navegador.
- [x] Avisos compartilhados traduzem títulos, texto e fragmentos; códigos removidos da Cozinha, execução, governança, diagnóstico e validação do Studio. Erro de tramitação recebe mensagem governada. Varredura preservou mensagens já traduzidas, dados/identificadores e falhas necessárias; não houve mudanças no banco.

## Continuação por perfil — Supervisão primeiro (19/10/2026)
- [x] Painel da rede em consulta: 56 escolas lidas, busca TESTE encontrou uma, detalhe selecionou inep-99999901; reconciliação HTTP 200, sem alerta. Números somente da reconciliação canônica, sem consultas por escola ou estimativas.
- [x] Consultas da Supervisão por autoridade/sessão, limite de 15 s, nova tentativa e falha sem lista vazia; controles por pessoa/capacidade/escola. 59 testes PASS, build OK; Administrador carregou 56 escolas, selecionou escola de teste/2026 e abriu situação sem espera indefinida; acompanhamento recusado pelo reader com mensagem e retentativa.
- [ ] Acompanhamento positivo e gravação no navegador: conta administrativa não tem leitura efetiva na escola consultada; depende de conta com capacidade e autoria humana aptas, sem conceder permissão para teste.
- [ ] Visitas, instrumentos e expedientes oficiais: dependem da implementação dos escritores canônicos e da autoridade efetiva; não simular aprovação ou autoria.
- [ ] Família e Mediador: continuar após a proteção das consultas; vínculos reais e autoria humana não serão presumidos.

## CIECE — velocidade do Mapa da rede (18/10/2026)
- [x] Reduzir os dados transportados sem alterar leitores canônicos, valores ou permissões
- [x] Executar nomes de turmas em paralelo, em lotes limitados, sem consultas individuais
- [x] Conferir totais, filtros, detalhamento e CSV com sessão CIECE; 80,77 s → 22,13 s no navegador local
- [x] Nomes de turmas em leitura única em conjunto (`class_names_for_schools`, 0577/0578): 9,2 s → 0,8 s; página 22,13 s → 11,76 s
- [x] Tentativa de leitura em conjunto único medida e revertida (0579–0581): mais lenta sob as permissões por linha; equivalência provada antes de reverter
- [x] Permissão verificada uma vez por consulta (0582, decisão do proprietário em 18/10/2026): equivalência e fronteira provadas; página 11,8 s → 5,9 s

## Secretaria — complementação solicitada em 17/10/2026
- [x] Registrar os anexos reenviados como referências de termos e ofícios, sem importar pessoas ou atos (modelos já abrangidos pelo plano)
- [x] Conferir o segundo lote de modelos: Educação Especial, justificativa de faltas, pré-matrícula, retirada de aluno, atas, ofícios e Bolsa Família; aproveitar estruturas sem importar fatos pessoais
- [x] 1a. CPF obrigatório desde 01/12/2017 e certidão para anteriores: validação no formulário e no banco, parâmetro versionado, 21 testes e seis limites com sessão escolar
- [x] 1b. Conclusão completa provada com sec.99999901 (escola de teste): 6 limites (2018 sem CPF recusa; 2016 sem certidão recusa; 2016 com certidão, 2018 com CPF e 30/11/2017 com certidão aceitos; 01/12/2017 só com certidão recusa). Alunos de teste: "TESTE CPF …"
- [x] 2. Fila de vagas da escola (/secretaria/fila-de-vagas): pedido com protocolo SV-ano-nº, ordem de protocolo por etapa (padrão do sistema), convocar com prazo (padrão 5 dias), matriculado/não compareceu/desistiu/cancelar/voltar à fila; testado com sec.99999901 (pedido "TESTE FILA ALUNO UM"); comprovante A4 em PDF por pedido
- [x] 3. Termos na ficha do aluno (uso de imagem, ciência de faltas, saída desacompanhada): texto versionado, PDF A4 para assinar, resposta real do responsável com histórico; testado com sec.99999901 (outra escola recusada)
- [x] 4. Proteção judicial na ficha: impedimento de retirada/medida protetiva/guarda, alerta "NÃO ENTREGAR a…", teor e mandado sigilosos com registro de cada abertura, encerramento com motivo; testado com sec.99999901. Falta: aplicar o alerta à Família e a futuras telas de retirada
- [ ] 5. Atestados médicos integrados à frequência
- [ ] 6. Notificação automatizada de infrequência pelo canal canônico
- [x] Configuração versionada dos avisos em Parâmetros: RPCs 0570 versionam texto/regra atomicamente, seção frequência, sem criar vínculos; 11 testes PASS e build OK.
- [ ] Gravação da configuração pelo navegador: Administrador e Supervisão não possuem a capacidade efetiva exigida na sessão. Nenhuma permissão foi fabricada; modelo não ativado. Definir autoridade efetiva de comunicação para permitir uso.
- [x] Continuação: emissão ligada à comunicação canônica (0569), reutilização do aviso no mesmo dia/período, PDF usa contagens emitidas; 8 testes PASS, consulta autenticada e atualização sem erros na escola de teste.
- [ ] Entrega digital de infrequência ponta a ponta: nenhum modelo/regra de destinatários e nenhum responsável autorizado na base; não fabricar configuração/autoria/vínculo. Não há envio externo nem varredura automática. Emissão/retentativa com chamada sintética ainda precisa de prova integrada.
- [x] 7. Monitoramento vacinal: ficha do aluno registra em dia/pendente (prazo 30 dias), histórico append-only, testado
- [x] Prazo vacinal em Parâmetros: padrão 30 dias; writer usa o valor vigente e preserva prazos antigos. 8 testes passaram; admin abriu o valor e edição; Secretaria registrou pendência em TESTE CPF C com prazo 16/11/2026 no navegador.
- [x] Motor vacinal: teste transacional com 45 dias confirmou novo prazo e preservação do anterior; revertido, padrão permanece 30. Alteração pelo formulário do Administrador ainda não exercitada.
- [x] Proteção na Família implementada: indicação/retirada explícitas na ficha, aviso genérico sem teor/documento; testes SQL com papel authenticated provaram destinatário, não destinatário, concorrência, IDOR e tabela inacessível; fixtures revertidas.
- [ ] Proteção na Família ponta a ponta no navegador — não há vínculo de responsável na base (0 autorizações); não fabricar autorização humana. Demais fluxos recentes seguem com verificação pendente.
- [x] 8. Ofícios: emissão com sec.99999901, leitura na lista, PDF A4 de 5 páginas inspecionado e cancelamento com motivo; documento explicitamente sintético e sem assinatura humana.
- [x] 9. Listagens: conta da escola de teste leu 3 alunos e baixou PDF/Excel; PDF inspecionado. Paginação da tela substitui corte de 300 e leitura paginada recusa total truncado.
- [x] 10. Atendimento domiciliar/hospitalar: abertura, atividade e encerramento pela ficha de TESTE CPF C no navegador; histórico lido na tela e no banco, sem diagnóstico real.
- [x] 11. Relatórios: sem CPF, aniversariantes, vacinação pendente e renovação pendente 2026→2027 (própria escola)
- [ ] Provar cada fluxo com sessão escolar, testes de isolamento e inspeção dos documentos
- [x] Revisão atual: infrequência voltou a abrir na Secretaria; Ofícios/atendimento/avisos não apresentam erro como lista vazia (3 regressões, 8 testes focados PASS); PDF/Excel e fluxos de teste conferidos; build OK.
- [ ] Infrequência: emissão com chamada sintética e prova numérica da agregação ainda pendentes; integração canônica implementada na ação de emitir, automação em segundo plano não implementada. Abertura da consulta autenticada provada.

- [x] 1. Voltar o design anterior (início e menu originais; tela azul desligada)
- [x] 2. Início por setor (até 6 cartões) e menu enxuto
- [ ] 3. Tirar travas e textos técnicos, setor por setor ([x] Secretaria, [x] Direção, [x] Orientação, [x] Supervisão, [x] CIECE, [x] Inclusão, [x] Alimentação; DP: páginas Departamento Pessoal/Gestão de Pessoas conferidas pelo Administrador, sem conta própria de DP encontrada; Professor e Família aguardam conta apta, sem troca de senha real)
- [x] Alimentação: reabertura após correções confirmou ausência dos avisos indisponíveis de saldo/conversão, sem erros; DP: escola de teste selecionada e painel com seis turmas conferido; 27 testes focados passaram. Conferência de abertura e leitura, sem atos oficiais de teste.
- [x] 4. Unificar cadastros: /cadastro/*, /chamada e /numeros levam às telas oficiais; dados das planilhas preservados
- [ ] 5. Conferir cada setor no navegador

- [x] Diário de Classe — novo visual (tela única, abas, semana, cartão da aula, tabela, quadros)
- [x] Diário — campo "Recursos utilizados" (gravado com histórico)
- [x] Diário — chamada direta na tabela (mesma gravação oficial da tela de chamada); conteúdo e notas seguem nas telas próprias
- [ ] Diário — provar a chamada direta com conta de professor e aula registrada

- [ ] Parâmetros por setor: atalhos de Matrículas/Avaliação nas telas desses setores; onda 3 (capacidade máxima de turma, prazo de protocolos, limiar de infrequência, carga contratual) com padrão editável
- [x] Registrar jornadas escolares de 2026 como base histórica das turmas, sem alterar calendário, matrículas ou grade docente
- [x] Registrar confirmação do merge comum da PR #1 lovable-sync → main, commit 03ad07913e5f153b40893dbce215cda6ea8086c1
- [x] Registrar os lotes de mapas estatísticos enviados como referência histórica de 2026, sem vigência operacional antes de 2027
- [x] Registrar/conferir o lote de 10 mapas estatísticos reenviados em 2026, mantendo idempotência e sem duplicar registros
- [x] Registrar/conferir novo lote de 10 mapas estatísticos de 2026, mantendo idempotência e sem duplicar registros
- [x] Registrar/conferir novo lote de 10 mapas estatísticos rurais de 2026, mantendo idempotência e sem duplicar registros
- [x] Registrar/conferir lote de 5 mapas estatísticos de 2026, mantendo idempotência e sem duplicar registros

- [ ] Enturmar 35 alunos novos de 2026 com turma ambígua (aba "Para decidir" de proposta-enturmacao-alunos-novos-2026.xlsx) — aguarda decisão do proprietário
- [ ] 21 nomes parecidos e 18 sem nascimento — aguarda decisão

- [ ] 43 professores da rede sem login (22 nome parecido na folha, 21 fora da folha) — deixado para depois pelo proprietário
- [x] Disciplina de cada professor nas turmas (parcial, 18/10/2026): catálogo de 10 componentes criado; 255 atuações com disciplina única gravadas a partir da planilha oficial 5º/9º ano (ago/2026); 162 com mais de uma disciplina possível e demais fora do escopo da planilha ficaram sem disciplina
- [x] Conferir a possibilidade de resolver as disciplinas ambíguas pela referência de turma: 138 linhas revisadas, 25 linhas com múltiplas disciplinas; nenhuma declara qual disciplina corresponde a cada turma. Integridade das 255 atuações já preenchidas: nenhuma referência de componente/turma ausente.
- [ ] Completar as 162 atuações ambíguas — aguarda indicação explícita de professor × turma × disciplina; nenhuma nova atribuição gravada nesta conferência e nenhuma regência canônica/homologação presumida.

## Mapa Estatístico — especificação SIGEM 2.0 (16/10/2026)
- [x] Etapa 1: impressão A4 paisagem azul/branco, capa opcional, modelos Institucional/Administrativo, rodapé "Página X de Y", assinaturas manuais
- [x] Etapa 2 (mapa declarado 2026): tabelas da Seção III por etapa × turno (1º/2º/3º/integral) e Seção II em grade por ano
- [x] Etapa 3: Seção IV em A–D + E Remanejados (grupamento próprio) com nome/ID/data e Seção V por categorias A–K
- [ ] Etapa 4: editor de aparência salvo (fonte, cores, margens) e fotos oficiais da capa (aguardam envio)
- [x] Reconstrução do Mapa: PDF direto A4 deitado com paginação física real, estrutura I–VI fiel (A–D, A–K, visitas), sem estados técnicos
- [x] Mapa vivo: tela e PDF montados dos registros da escola (turmas, entradas/saídas, pessoal A–K, visitas) para todas as escolas e meses
- [ ] Mapa: etapa das turmas sem etapa no cadastro (planilha turmas-sem-etapa-2026-2027.xlsx enviada, aguarda preenchimento); cargo dos professores sem matrícula ligada; nomes de turmas do mapa declarado 2026
- [x] Mapa: Conferência em aba própria do Mapa da escola (já existente)
- [x] Mapa: CIECE congela as movimentações do mês; registros posteriores entram no mês seguinte com observação
- [x] Matrícula: forma de ingresso (aluno novo × transferência, escola de origem da rede/privada/outra)

## Conta de escola sem seletor de escola (16/10/2026)
- [x] Contas de Secretaria/Direção/Orientação: nenhuma tela pede para escolher a escola; dados sempre só da própria escola (Quadro docente, Turmas e demais)
- [x] Turmas: lista "demorou demais" na conta da Secretaria

## Ficha de Matrícula — impressão A4 (16/10/2026)
- [x] Conferir com sec.33001987 a abertura da Secretaria, prévia da rematrícula (541), busca com campos obrigatórios e câmera simulada 3x4; entregar PDFs sintéticos inspecionados
- [ ] Concluir transferência, salvamento de foto e renovação no navegador — falta fixture descartável com identidade exata e transição apta; não usar os 541 alunos reais
- [ ] Provar óbito com gravação e bloqueio — falta ambiente/fixture com descarte documentado; registro é irreversível e cleanup atual não o remove
- [x] Modelo preenchido e em branco, PDF direto, impressão, anexo de Educação Especial e Controle de Renovação
- [ ] Homologação visual — aguarda conferência do proprietário nos PDFs de exemplo
- [ ] Campos sem fonte no SIGEM (ver docs/ficha-matricula-impressao.md) — aguarda decisão

## Mapa da rede — permissão uma vez por consulta (18/10/2026)
- [x] Leitura em lote com verificação de capacidade única (0582): equivalência provada em 8 escolas × 4 fontes; fronteira negativa com conta de escola OK; Mapa da rede em 5,9 s (era 81 s)

## Login do professor (19/10/2026)
- [x] Resumo diário: aulas registradas × horários previstos × vínculos explícitos, sem consulta adicional; fontes não lidas indisponíveis. 37 testes PASS, build OK; navegador confirmou portão de senha e zero consultas antecipadas. Carga do período e conferência real continuam pendentes.
- [x] Continuação: PDF retenta com mesma identidade/bytes/hash em memória; download confirmado reutiliza emissão, clique duplo e resposta após desmontagem recusados. Testes passaram; emissão real continua aguardando conta docente apta.
- [x] Continuação: mediação vigente consulta só após autoridade pessoal e espelho aceitos; conta/revisão/contexto isolados, resposta validada, prazo de 15 s, erro e retentativa. 32 testes focados PASS; navegador em /diario preserva troca de senha e zero consultas antes dela, build OK. Mediação positiva no navegador aguarda conta apta.
- [x] Continuação atual: PDF A4 de registro de aulas por regência, motor comum e emissão com hash exato antes do download; sem notas/chamada/assinatura presumida. Leitura em páginas ordenadas recusa truncamento; 52 testes PASS. PDF sintético de 3 páginas inspecionado, início/fim preservados; navegador preserva portão de senha. Emissão real aguarda conta docente apta.
- [x] Continuação atual: envio de aula/chamada único com prazo de 15 s e UUID confirmado; erro preserva formulário, incerteza mantém payload/identidade para retentativa, conta desmontada ignora resposta. 30 testes PASS; navegador confirmou portão de senha e zero consultas antes dele. Gravação real aguarda troca de senha pelo titular; PDF segue pendente.
- [x] Continuação atual: Meus diários, horários, aulas e chamada com chave conta/revisão, prazo de 15 s, resposta validada e nova tentativa; 23 testes passaram, build OK. Navegador: portão de senha preservado, zero consultas do Diário antes dele. Fluxo completo aguarda troca da senha pelo titular.
- [x] Continuação: anexos SIPE com erro/carregamento/retentativa, acesso privado e isolamento por conta; planejamento sem leitura antes da sessão. 44 testes passaram, build OK. Navegador confirmou troca de senha obrigatória; envio/abertura reais aguardam conta apta.
- [x] Continuação: correção oficial antes do cartão avulso; consultas por conta/sessão/versão com prazo e retentativa, gabaritos em paralelo limitado e descarte da conferência ao trocar prova/versão. 18 testes passaram; build OK; navegador confirmou o portão de troca de senha, sem expor a correção. Gravação real ainda não verificada.
- [x] Pendências: consultas isoladas por conta/sessão, prazo de 15 segundos, resposta validada, erro explícito e nova tentativa; ausência não vira zero.
- [x] Corrigir montagem antecipada durante verificação da senha inicial: falha fechada, limite de 15 segundos e confirmação por conta.
- [ ] Continuação solicitada: integrar acompanhamento dos alunos ao início, proteger consultas por sessão e conferir estados de falha sem apresentar ausência de dados como zero
- [x] CPF centralizado em todo o sistema + conferência em Diagnóstico
- [x] Mural de avisos da rede na tela inicial do professor (escolas das atuações vigentes)
- [x] Pendências próprias de planos/provas com a OP e aulas registradas sem chamada nos últimos 14 dias
- [ ] Painel: chamada do dia pendente, alunos em risco, pendências SIPE/SIA
- [ ] Contagem aulas dadas × carga prevista; Diário completo em PDF A4 (registro de aulas em PDF implementado; notas/frequência e conferência real ainda pendentes)
- [ ] Pauta AV1/AV2/IV/PA e consolidado da turma (média: regra ainda sem lugar, aguarda decisão)
- [ ] Correção por câmera e anexos SIPE: serviços canônicos integrados e protegidos; gravação/envio/abertura no navegador aguardam conta docente apta.
- [ ] PEI/PAEE/relatórios evolutivos e atendimento domiciliar no acesso do professor
- [ ] Bilhetes individuais às famílias
- [ ] Teste com conta de professor — sessão autorizada m504211 emitida; exige troca da senha inicial pelo titular. Não alterar senha real nem dispensar proteção; fluxos completos aguardam conta apta.

- [ ] Alimentação Escolar (em andamento; feito: confirmação de itens zerados, recebimento com data real, NF, checklist e não conformidade; diário da cozinha e filtros feitos; cardápio 4 semanas feito; faltam teto, ANAE, distribuição, POPs/etiquetas, remanejamento): implementar especificação enviada (especificacao_setor_alimentacao_escolar_sigem_lovable.md)
