# Roadmap — SIGEM simples no design original

## Secretaria — complementação solicitada em 17/10/2026
- [ ] 1. CPF obrigatório para nascidos desde 01/12/2017; certidão alternativa só para anteriores; validar no formulário e no banco
- [ ] 2. Solicitação de vagas integrada à fila oficial existente
- [ ] 3. Termos legais e consentimentos no cadastro, a partir dos modelos enviados
- [ ] 4. Medidas protetivas/restrição de retirada e documentos judiciais privados
- [ ] 5. Atestados médicos integrados à frequência
- [ ] 6. Notificação automatizada de infrequência pelo canal canônico
- [ ] 7. Monitoramento vacinal com prazo de 30 dias
- [ ] 8. Ofícios escolares oficiais com numeração canônica
- [ ] 9. Listagens de alunos personalizáveis
- [ ] 10. Atendimento domiciliar/hospitalar integrado
- [ ] 11. Relatórios: CPF, aniversariantes, vacinação e renovação
- [ ] Provar cada fluxo com sessão escolar, testes de isolamento e inspeção dos documentos

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
