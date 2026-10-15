# SIGEM: um visual só, menos telas cheias, e as planilhas usadas como base

## O que já está guardado (conferido agora)
- 9.813 alunos das planilhas, com 10.413 enturmações e a ficha completa de cada um (pais, nascimento, telefones, turma).
- Servidores da SEMED (matrícula, nascimento, vínculo) e professores das jornadas.
- O problema não é falta de dados. O problema é que as telas não usam esses dados: a Secretaria não encontra o aluno já cadastrado, e as telas novas criaram uma segunda lista (7.657 alunos) separada da oficial.

## 1. Uma base só, pronta para continuar
- A Secretaria digita nome, data de nascimento ou INEP e o aluno da planilha aparece com tudo já preenchido. Ela confere, completa o que falta e salva. Não precisa redigitar nada.
- O mesmo vale para servidor (busca por matrícula ou nome), turma e escola.
- A segunda lista criada pelas telas novas é ligada à oficial e deixa de existir como cadastro separado. Nada é apagado.

## 2. Tirar as travas do dia a dia
- Matricular, enturmar, transferir, remanejar, lotar servidor, ligar professor à turma, chamada e notas: preencher e salvar.
- Onde hoje aparece "sem regra homologada", o sistema usa a regra padrão: 200 dias letivos, 75% de frequência e média 6. Você poderá mudá-la depois em Configurações.
- Cada setor continua vendo só o que é dele, e você vê tudo.
- O histórico continua guardado.

## 3. Um visual só no sistema inteiro
- O Diário segue as mesmas cores, cartões, títulos e botões das outras telas.
- Cada tela traz um título, uma frase e a ação principal. O resto fica em "Mais detalhes", fechado.
- Saem do uso diário: códigos, versões, "fonte", "homologação", "rascunho" e selos repetidos.
- O Início de cada setor mostra até 6 atalhos grandes.

## Ordem
1. Busca e continuação do cadastro de aluno na Secretaria, que é o seu exemplo.
2. Ligar a segunda lista à oficial. Servidores e turmas pelo mesmo caminho.
3. Regra padrão e fim das travas.
4. Padronizar o visual do Diário e das demais telas.
5. Conferir no navegador com os logins de Secretaria, Direção e Professor.

## Detalhes técnicos
- Busca: função leitora sobre `institutional_student_persons` + `student_registration_observations` (INEP exato, nome+nascimento), retornando ficha para pré-preencher; gravação pelo writer canônico existente.
- `sg_*`: migração de reconciliação para as tabelas institucionais por chave (INEP/matrícula/nome+nascimento), deixando `sg_*` somente leitura e as rotas `/cadastro/*` lendo a base oficial.
- Regra padrão: versão de configuração registrada como decisão do proprietário e editável; os writers deixam de recusar quando falta uma norma.
- Visual: o Diário passa a usar `PageHeader`, os tokens de `styles.css` e os cartões compartilhados; a limpeza de textos é feita de forma central, em `ui-vocabulary`/`states.tsx`.
