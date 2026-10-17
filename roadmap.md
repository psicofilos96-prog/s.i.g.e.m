# Roadmap — SIGEM simples no design original

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
- [ ] 3. Tirar travas e textos técnicos, setor por setor (Secretaria, Direção, Professor, Supervisão, CIECE, Orientação, NEI, Alimentação, DP, Família)
- [ ] 4. Unificar cadastros (sg_* → cadastros oficiais) e modo rápido em Relatórios
- [ ] 5. Conferir cada setor no navegador

- [x] Diário de Classe — novo visual (tela única, abas, semana, cartão da aula, tabela, quadros)
- [x] Diário — campo "Recursos utilizados" (gravado com histórico)
- [ ] Diário — lançamento inline de chamada/conteúdo/notas

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
- [ ] Disciplina de cada professor nas turmas — a fazer

## Mapa Estatístico — especificação SIGEM 2.0 (16/10/2026)
- [x] Etapa 1: impressão A4 paisagem azul/branco, capa opcional, modelos Institucional/Administrativo, rodapé "Página X de Y", assinaturas manuais
- [x] Etapa 2 (mapa declarado 2026): tabelas da Seção III por etapa × turno (1º/2º/3º/integral) e Seção II em grade por ano
- [ ] Etapa 3: Seção IV em quatro grupos A–D com nome/ID/data e Seção V por categorias A–K
- [ ] Etapa 4: editor de aparência salvo (fonte, cores, margens) e fotos oficiais da capa (aguardam envio)
- [x] Reconstrução do Mapa: PDF direto A4 deitado com paginação física real, estrutura I–VI fiel (A–D, A–K, visitas), sem estados técnicos
- [x] Mapa vivo: tela e PDF montados dos registros da escola (turmas, entradas/saídas, pessoal A–K, visitas) para todas as escolas e meses
- [ ] Mapa: etapa das turmas sem etapa no cadastro; cargo dos professores sem matrícula ligada; nomes de turmas do mapa declarado 2026
- [ ] Mapa: tela própria de Conferência (hoje as pendências seguem na tela de gestão)
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
