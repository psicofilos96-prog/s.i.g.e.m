# Análise dos arquivos SIGEM.rar e DOCUMENTOS_PRO_CHATGPT.rar

## O que chegou (conferido pela listagem dos arquivos)
- **SIGEM.rar (17 MB):** um protótipo anterior do SIGEM, feito em outra tecnologia (Next.js), com cerca de 1.300 arquivos. Ele tem 282 alterações de banco e telas para Secretaria (119 arquivos), Docente (105), Estatística (80), Coordenação (71), DP (52), Direção (46), Relatórios (27), Calendário (26), Família, Supervisão, Mediador, Aluno, Modelos de documento, Cozinha, NEI e Documentos pedagógicos.
- **DOCUMENTOS_PRO_CHATGPT.rar (80 MB):** 140 documentos (93 planilhas xlsx, 3 xls, 22 docx, 2 doc, 17 PDFs, 1 md e 1 atalho gdoc). Entre eles: Todos os alunos, turmas, professores e jornadas; os mapas estatísticos e as tabelas urbanas, rurais e conveniadas; as tabelas SEMED 2026; SAEB; NEE/AEE; FUNDEB; servidores do tempo integral; os relatórios de fechamento; e modelos de pré-matrícula, termos e autorização de imagem.

## Como vou tratar
O protótipo é **referência histórica**, não código a copiar. A regra do projeto diz que fontes antigas não autorizam importar regras, dados ou código. Os documentos são **fonte de requisitos e de dados**: nada vira dado oficial sem prévia e conferência.

## Etapas
1. **Inventário verificável** de cada arquivo, numa planilha em Arquivos (fora do repositório):
   - nome, tipo, tamanho e código de conferência (hash);
   - classificação: modelo, dado, norma, evidência ou proposta;
   - status de leitura;
   - duplicatas em relação aos arquivos que você já enviou antes (por exemplo, Todas as jornadas e os mapas mensais).
2. **Comparação protótipo × SIGEM atual** por módulo. Para cada tela, regra e tabela do protótipo: já existe no SIGEM, existe em parte, ou falta. Com referência ao arquivo de origem e sem copiar código.
3. **Lista de requisitos novos** que só aparecem no protótipo ou nos documentos novos. Exemplos: TABELA 09, termo de ciência de faltas, termo de suspensão, pré-matrícula, folha de ponto, FUNDEB, SAEB. Cada item separado em regra documentada, observação de arquivo e a confirmar.
4. **Dados ainda não importados** (SAEB, NEE × Censo, servidores do tempo integral, FUNDEB): só identificação e prévia. Importação apenas em lote separado, com conferência, como nos lotes anteriores.
5. **Entrega:** a planilha de inventário, a matriz de comparação e um resumo curto com os lotes de implementação sugeridos, em ordem de prioridade.

## Fora deste plano
- Copiar telas ou alterações de banco do protótipo.
- Gravar qualquer dado no banco.

## Detalhes técnicos
- Os arquivos compactados serão descompactados numa pasta temporária, sem executar nenhum script do protótipo.
- Planilhas e documentos Word são lidos por estrutura (abas e cabeçalhos), sem dados pessoais nos relatórios do repositório.
- Arquivos com dados pessoais ficam em pasta restrita, como hoje.
