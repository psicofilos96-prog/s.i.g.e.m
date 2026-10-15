# Diário de Classe — novo visual igual à imagem de referência

## Diagnóstico do que já existe
- O Diário já tem telas próprias: início do professor, chamada, registro de aula, avaliações (instrumentos, pauta, fechamento), alunos por turma, documentos e relatórios. Cada uma fica numa página separada, e o professor precisa ir de uma para outra.
- As regras já existem e continuam valendo: chamada só com Presente/Ausente/sem marcação, registro de aula com histórico de versões, notas pela Pauta, situação do aluno calculada pelas regras da rede.
- Já temos no projeto o logo do SIGEM, o brasão e as fotos de Itaperuna. **Não temos foto do Cristo de Itaperuna**: o rodapé do menu fica sem ela até você enviar uma.

## O que muda (só a aparência e a organização)
1. **Uma tela única do Diário** em `/diario`, com a composição da imagem:
   - título "Diário de Classe" com ícone de livro, caminho (Início › Docente › Diário de Classe);
   - à direita, 4 seletores: Ano letivo, Escola, Turma, Disciplina — só com as turmas em que o professor atua;
   - abas: Lançamento de Aulas, Frequência, Conteúdos, Avaliações, Observações, Relatórios. Cada aba abre a função que já existe, sem recarregar a página.
2. **Faixa da semana**: setas, "Semana de … a …", cartões dos dias com a quantidade de aulas tirada do horário publicado e do calendário; botões "Copiar aula" e "Nova aula".
3. **Cartão da aula**: número e horário, conteúdo, habilidades BNCC, metodologia, recursos (Lousa, Projetor, Livro, Vídeo, Atividade impressa, Outro) e um selo discreto (Aula registrada / Rascunho / Pendente). Aviso antes de sair com alterações não salvas.
4. **Tabela de estudantes**: nº, foto ou iniciais, nome, chamada por aula (verde/vermelho), notas das avaliações cadastradas, média, situação, observação e ações; busca, paginação de 10/20/50, teclado. Chamada e notas aparecem juntas, mas continuam gravadas cada uma no seu lugar.
5. **Quatro quadros embaixo**: Resumo da turma (presentes, ausentes, aulas registradas, conteúdos — com a data de referência), Habilidades BNCC trabalhadas, Próximas avaliações (só as já cadastradas) e Observações gerais da turma.
6. **Cores e letras** da referência (azul-marinho, azul de ação, fundo cinza claro, cartões brancos) entram como tokens do Diário, sem trocar o visual do resto do SIGEM. Menu lateral e faixa de Itaperuna do topo são os do SIGEM atual, só ajustados para ficarem iguais à imagem (largura, item ativo azul, botão "Recolher menu").

## O que NÃO muda
- Nenhuma tabela nova no banco, nenhuma regra de nota, frequência ou permissão alterada.
- Nada de dado inventado: sem registro, aparece vazio ("Sem aulas nesta semana"), nunca zero.
- As páginas antigas do Diário continuam funcionando por baixo das abas.

## Ordem de trabalho
1. Tokens de cor/tipo do Diário e as peças: seletores, abas, faixa da semana, cartão da aula, tabela, quadros.
2. Montar a tela única e ligar às fontes já existentes.
3. Conferir no navegador com a escola de teste (1366, 1920, 2560 e celular), como professor.

## Detalhes técnicos
- Nova composição em `src/features/diary/class-diary-workspace.tsx` (+ subcomponentes em `src/features/diary/class-diary/`), montada por `src/routes/diario.index.tsx`; abas por search param `?aba=` para não recarregar.
- Dados: `teacher-context.ts` (minhas turmas), `lesson-central.ts`/`teacher-agenda.ts` (semana e aulas), `attendance-temporal.ts`/`attendanceStore` (chamada), `lesson-versions.ts` (registro), Pauta/`teacher-grades.ts` (notas), `learning-record.ts` (resumo). Primitivas de `components/sigem/attendance-speed.tsx` e `states.tsx` reaproveitadas.
- Tokens em `src/styles.css` com escopo `.diary-premium` (oklch), sem cores cruas nos componentes; teste de tokens existente continua valendo.
- Recursos utilizados: se o registro de aula ainda não tiver campo para isso, a seção fica visível mas desligada com a frase "Ainda não disponível", e peço sua autorização antes de criar o campo no banco.
