## Orientação Pedagógica (13H — `src/features/pedagogical-guidance/`)

Módulo próprio porque acompanhamento pedagógico é domínio novo, e não uma tela
sobre o Diário: ele referencia fatos canônicos e acrescenta apenas os fatos que
pertencem ao acompanhamento.

- Princípio formal: nenhuma inferência do motor de sinais constitui diagnóstico,
  classificação pessoal, ocorrência disciplinar, decisão, abertura de
  acompanhamento ou consequência institucional.
- Cadeia obrigatória `definição → avaliação → ocorrência`; a ocorrência congela
  versão e fatos, para que mudar a configuração nunca reescreva o histórico.
- Estado de sinal e de caso são projeções do ledger; nenhum campo de estado é
  persistido, e ausência de acompanhamento nunca é fato positivo.
- Caso admite múltiplos sujeitos e pode nascer sem sinal; responsabilidade é
  temporal e distinta de participação; plano evolui por versão encadeada.
- Encerrar ≠ resolver, e resultado observado ≠ eficácia: estado, motivo,
  observação e avaliação de efetividade são registros independentes.
- Comunicação exige responsabilidade vigente com capacidade (13F); relação
  pessoal não confere poder e capacidade não declarada falha fechada.
- A tela é segunda perspectiva do Workspace Projection Framework (13G): nenhuma
  fila, contagem ou visão de turma cria segunda verdade, e indicadores são CIECE.

## OP por escola (Lote 01 — `op-unit-architecture.ts`)
- Matriz das 34 seções → tabela/função/rota/capacidade/teste vive só aqui e o teste exige que tudo citado exista; orientador da unidade = capacidade escopo escola da própria escola, coordenação central = escopo rede só para consulta (nunca registra pela unidade), e nenhum regimento no acervo ⇒ atribuições parametrizáveis, porque hierarquia ou matriz manual concederiam poder não verificado.
- Lote 02 (`op-designations.ts`): designação orientador→escola(→turmas)→período e central→rede/escolas→período é ledger append-only (seq contínuo, sem autodesignação, encerramento com motivo, substituto só dentro do período/escola/papel do titular); acesso = designação vigente × capacidade efetiva na escola × finalidade; central vê agregado (supressão 1–4) por padrão, individual só com capacidade de rede e nunca registra pela unidade, porque cargo ou hierarquia não concedem leitura de menor. Gravação no banco aguarda decisão de quem designa.
- Lote 03 (`op-central.ts`): Central = 8 blocos (professores, turmas, planejamentos, devolutivas, intervenções, reuniões, prioridades, alertas) projetados de fontes canônicas já lidas, cada um com estado disponível/zero/não lido/sem permissão/bloqueado, fonte e data; leitura sem data não vale, alerta sem regra homologada é bloqueado, devolutiva pendente é derivada e drill-down fica em /orientacao, porque número ilustrativo ou zero no lugar de ausência seriam fato falso.
- Lote 04 (`op-panorama.ts`): panorama por escola/etapa/modalidade/turma/componente/período é projeção pura de vínculos oficiais lidos; estudante e professor contam como pessoa distinta (alocação vigente na data, atribuição no período), vínculo múltiplo é declarado, oferta ausente não entra por suposição e fonte não lida = null; central só recebe agregado por escola com supressão 1–4, porque contar vínculo ou presumir etapa inflaria número e exporia menor.
- Lote 05 (`op-teacher-followup.ts`): ficha de acompanhamento docente (8 tipos) é ledger append-only com chave de idempotência e base esperada; retificar/anular/encerrar só pelo autor com motivo, devolutiva do professor só pelo próprio sujeito, sem autoacompanhamento, prazo ausente nunca vira atraso e `functionalEffect` é sempre false (termos de avaliação funcional/sanção bloqueados), porque acompanhamento formativo convertido em ato funcional seria poder disciplinar não homologado. Gravação no banco aguarda writer.
- Lote 06 (`op-planning-flow.ts`): fluxo de planejamento compõe o MESMO plano do Docente, o MESMO ledger de envio (`reviewState`) e o MESMO ledger de devolutivas; versão gravada por não autor, resposta/ciência por terceiro ou autovalidação tornam o fluxo "inconsistente"; editar conteúdo pela OP é sempre recusado; submissão/validação só existem por regra homologada (null ⇒ OP acompanha sem portão), porque a orientação nunca reescreve autoria docente.
- Lote 07 (`op-curriculum-skills.ts`): análise de habilidades reaproveita o vínculo do Docente (`skill-links.ts`) e separa quatro dimensões independentes — prevista (plano), trabalhada (aula/atividade/intervenção realizada), avaliada (avaliação aplicada) e demonstrada (só resultado sob critério homologado, por estudante distinto); previsto vem só da posição registrada e edição vigente, fonte não lida = null com limitação por extenso, e central recebe só contagens com supressão 1–4, porque plano declarado como trabalhado ou avaliação lida como aprendizagem seriam fatos falsos.
- Lote 08 (`op-lesson-execution.ts`): painel de aulas é projeção somente leitura sobre `lessonSituation` (grade publicada + versão vigente + atos) e vínculos de habilidade; sem grade nada é previsto, aula passada sem registro é só "conferir registro" (nunca "não ministrada"), evidência exige referência anexada, divergência plano × diário só com ambas as fontes lidas, e a OP só confere/comenta — registrar, retificar ou declarar não realização é do professor, porque ausência de registro não prova falta e autoria docente não se transfere.
