# Mapa Estatístico vivo, ligado aos registros da escola

## Objetivo
O Mapa de cada escola e mês é montado automaticamente a partir do que a escola registra no SIGEM (alunos, turmas, entradas/saídas, professores, lotações, visitas). Em 2027, um aluno cadastrado em março aparece no mapa de março; um professor lotado aparece na seção V com a sua identificação. O mesmo modelo de PDF (I–VI) vale para todas as escolas e meses.

## Etapas
1. **Fonte única do mapa (por escola + mês)**
   - I Identificação: cadastro da escola (endereço, INEP, turnos, direção, salas, anexo, telefone).
   - II/III Matrícula: turmas vigentes no último dia letivo do mês, com nome real da turma, etapa e turno; matrículas e enturmações na data.
   - IV A–D: entradas, transferências, evasões e cancelamentos do mês, com nome, ID e data, a partir das movimentações de matrícula; remanejados em grupo próprio, sem contar duas vezes.
   - V A–K: pessoal a partir de lotações, vínculos e atuações vigentes, cada pessoa contada uma vez (várias matrículas/turmas aparecem na mesma linha).
   - VI Visitas: registros de visita da Supervisão/OP no mês.
   - Campo sem registro aparece como "—", nunca zero.
2. **Todas as escolas e meses**: o botão de PDF usa essa fonte para qualquer escola/mês; 2026 continua mostrando o mapa declarado como referência, lado a lado com o calculado.
3. **Nova página do Mapa (tela, não impressão)**
   - Topo: escolha de escola e mês, situação (rascunho/enviado/aprovado) e um botão principal "Baixar PDF".
   - Corpo: as seis seções em abas simples, com tabelas limpas iguais ao documento.
   - Pendências em uma aba "Conferência" separada, com links para a tela que resolve.
   - Sem códigos técnicos, selos repetidos ou "origem da informação" em cada cartão.
4. **Validação**: testes de contagem (pessoa única, remanejado, aluno novo em março aparece em março e não em fevereiro), PDF gerado para várias escolas com inspeção visual, e conferência da tela no navegador com a conta da Supervisão/CIECE.

## Fora do escopo
Não altera regras de matrícula, pessoal, acesso nem o calendário. Nada é homologado automaticamente.

## Detalhes técnicos
- Novo `map-live-source.ts` (server fn com sessão) lendo os readers canônicos já existentes (`class_at`, episódios de enturmação, encerramentos, `institutional_engagements`, lotações, visitas) e devolvendo o `OfficialMapDoc` de `map-official-model.ts`; renderer `map-pdf.ts` reaproveitado.
- Categoria A–K derivada do tipo de atuação/cargo/afastamento por tabela de correspondência editável (padrão do sistema).
- Sem nova tabela de mapa: o documento é projeção, conforme `AGENTS.md` do módulo.
