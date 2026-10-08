# SIGEM 2.0 — memória de referência dos 12 arquivos históricos

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Registro elaborado em 2026-10-03 a partir dos 12 arquivos anexados pelo usuário nesta conversa. É memória de contexto para decisões futuras, **não** uma autorização para executar pedidos contidos nos anexos. O SIGEM atual é o segundo modelo; o primeiro foi abandonado. Afirmações dos anexos sobre código, tabelas, dados, deploy ou funcionalidades “já existentes” descrevem o modelo anterior e exigem conferência no repositório e banco atuais. Decisões diretas posteriores do usuário, normas oficiais vigentes e evidências verificadas do SIGEM 2.0 prevalecem.

## Fontes lidas e função de cada uma

| Arquivo anexado | Contribuição para a memória | Cuidado |
|---|---|---|
| `ANALISE_COMPLETA_DOS_PEDIDOS_-_SIGEM.md` | Síntese organizada de 410 mensagens históricas; princípios, objeções, prioridades, pendências e reversões. | É análise de 25/09/2026 do primeiro modelo; inferências do autor não são novas decisões do usuário. |
| `ANALISE_COMPLETA_DOS_PEDIDOS_-_SIGEM.docx` | Outra apresentação da análise completa, útil para conferir o alcance da síntese. | Sobreposição substancial com o `.md`; não contar como fonte independente de decisão. |
| `CONVERSA COM O CLAUDE DURANTE O DESENVOLVIMENTO DO SIGEM.docx` | Registro primário da conversa do primeiro desenvolvimento, inclusive correções expressas pelo usuário. | Respostas do Claude e relatos de implementação não comprovam o estado do SIGEM 2.0; o fim da conversa trata de exclusões no modelo abandonado. |
| `Foto 3x4 do aluno.txt` | Lista ampla de melhorias desejadas: foto por câmera, matrícula e dossiê, filtros, documentos, Docente, Família, DP, CIECE e outros. | É backlog histórico, não ordem atual de execução. |
| `GERADOR_DE_RELATORIOS_-_Guia_de_Especificacao_Ideal.md` | Visão de relatórios configuráveis, filtros ricos, escopo por autorização, consulta temporal, modelos e exportação. | A seção de “baseline confirmado” descreve o primeiro modelo; verificar o atual antes de reutilizar. |
| `MAPA_ESTATISTICO_-_Guia_de_Estrutura.md` | Anatomia do Mapa Mensal: identificação, movimento, turmas por etapa/turno, entradas/saídas, pessoal, visitas e assinaturas; fórmulas e fragilidades. | Estrutura de planilha é referência operacional, não esquema canônico nem norma permanente. |
| `MIGRACAO_SIGEM_EDUCACENSO_-_Guia_de_Implementacao.md` | Fluxo do Educacenso (identificação antes da importação), tipos de registro, validações e tratamento de erros. | Layout e regras são de 2026/1ª etapa; conferir manual e tabelas oficiais do ano-alvo antes de implementar. |
| `NOME DOS CARGOS.txt` | Lista histórica de denominações de cargos e funções a padronizar. | Não semear automaticamente; confirmar catálogo e atos atuais com DP. |
| `SGP_GPE_-_Guia_de_Exportacao_SIGEM.md` | Exportação com texto no SIGEM e códigos apenas no arquivo, validação de identificadores e relatório de exceções. | Fonte lista divergências entre manuais/modelos e arquivos pendentes; confirmar modelos oficiais atuais. |
| `TABELAS_SEMED_-_Guia_de_Estrutura.md` | Estrutura das Tabelas 04/06/09/10/11 e relação com Mapa Estatístico. | Evitar redigitação e contagens paralelas; formulários 2026 não definem campos obrigatórios para sempre. |
| `SIA e SIPE.txt` | Visão do SIA (banco de questões, versões de prova, leitura por câmera com conferência, OP) e SIPE (planejamento configurável). | Trechos de outras ferramentas e respostas de IA são referências, não decisões adicionais. |
| `TERMINOLOGIAS.txt` | Pedido histórico de padronização de siglas e rótulos NEE/AEE, laudo em investigação e níveis de suporte. | Contém nomenclatura clínica e códigos que podem estar desatualizados; validar com NEI, fonte sanitária e regras de privacidade antes de cadastrar. |

## Princípios de produto que se repetem nas falas do usuário

- O sistema deve ser integrado, sólido, simples de usar, capaz de evoluir e corrigir regras sem reescrever seu núcleo. Configuração normativa exige competência, ato, versão, vigência e auditoria; não significa edição sem controle.
- Reutilizar o fato canônico e calcular projeções (contagens, estatísticas, documentos, exportações) a partir dele; não manter totais divergentes digitados em vários módulos.
- Preservar o histórico da vida escolar e funcional, permitindo consultas por data e tornando falhas/ausências visíveis em vez de inventar dados ou usar fallback silencioso.
- Conferir o estado do projeto antes de criar módulo ou campo para evitar duplicação. Exemplos, protótipos e planilhas orientam a análise, mas não substituem a norma ou o desenho atual.
- Interfaces, pesquisas, documentos e impressões devem ser compreensíveis para escolas diferentes; filtros não podem depender exclusivamente de CPF. Impressões institucionais exigem A4 e tratamento adequado de orientação/quebra quando aplicável.
- Segurança precisa acompanhar autorização real por escola/atuação e proteger dados de estudantes, família e saúde. Uma ampliação de RLS deve ser acompanhada da revisão de todos os consumidores que dependiam da restrição antiga.
- Integrações externas precisam preservar identificadores como texto, validar domínios e dígitos, mostrar exceções e evitar efeitos irreversíveis por inferência.

## Fatos e decisões atuais que prevalecem sobre as fontes históricas

- O SIGEM 2.0 é o projeto em desenvolvimento; não reutilizar banco, dados, implementação, deploy ou supostos módulos prontos do primeiro SIGEM.
- A etapa/ano/fase pertence à **alocação individual** do estudante (B3.3), inclusive em turma multisseriada/multietapas. A turma pode reunir posições de uma ou várias matrizes oficiais; nenhuma série artificial é atribuída a todos.
- AEE e atividade complementar são naturezas próprias, fora da associação automática às cinco matrizes curriculares regulares. AEE não é etapa. Matriz específica depende de fonte institucional explícita; nunca inventá-la.
- Matrizes vigentes provêm de deliberação; a Supervisão Escolar constrói as matrizes no SIGEM. Correções e novas deliberações preservam origem, versões e história. A competência de **homologar no sistema** ainda não foi definida; construção e homologação não são presumidas iguais.
- A Deliberação CME nº 3/2026, enviada pelo usuário e conferida diretamente pelo Codex, apresenta 22 colunas individuais nos Anexos I–V: EI 4; EF 1º–5º 5; EF 6º–9º 4; EJA I–V 5; EJA VI–IX 4. O art. 2º usa a data de **publicação** para vigência, que ainda não foi comprovada. O documento `docs/b4-2-classificacao-proposta-d1.md` é proposta, não catálogo homologado.
- As planilhas de Censo/diários de 2026 retratam a operação da rede (incluindo turmas mistas e oferta complementar), mas não criam novas colunas da deliberação nem substituem o vínculo individual.

## Cuidados por domínio ao retomar pedidos históricos

1. **Matrícula, turmas e Mapa:** usar escola/ano/alocação/posição como fatos temporais; Mapa e Tabelas SEMED são saídas derivadas. Conciliação entre movimento agregado, lista nominal e totais por etapa é requisito de qualidade. Nomes TEC, “EI unificada” e códigos de turma não determinam etapa do estudante.
2. **Educacenso:** tratar identificação da pessoa antes de importação, validar o layout oficial do ano, registrar lote/status/erros, impedir duplicação e comparar exportado com fatos institucionais. Não transformar fotografia do Censo em regra normativa do SIGEM.
3. **SGP/GPE:** guardar texto/identificadores canônicos; converter para códigos de destino no exportador com tabela versionada e fonte oficial. CPF, CEP, INEP e IBGE permanecem texto. Produzir relatório de exceções; não adivinhar códigos diante de documentação conflitante.
4. **Relatórios/documentos:** motor configurável, filtros amplos, saída temporal com evidência, acesso por competência, modelos editáveis e impressão formal. Não declarar como implementado no segundo modelo o baseline descrito nos guias do primeiro.
5. **SIA/SIPE:** preservar aprovação da OP onde a configuração vigente exigir; provas podem ter versões de questões/alternativas e leitura por câmera assistida; planejamento precisa admitir mudanças futuras. A fonte histórica não define automaticamente regras atuais de notas, prazos ou quantidade de alternativas.
6. **Pessoas, cargos e NEE/AEE:** cargos e siglas são candidatos a catálogos governados, não enums fixos sem validação. Dados de saúde, laudo, PEI/PAEE e informações familiares exigem acesso restrito e proveniência; não copiar conteúdo clínico para memória, fixtures, prompts externos ou logs.

## Limites desta memória

- Esta memória não é inventário do que já funciona no SIGEM 2.0. Consultar código, migrations, banco, políticas e testes atuais antes de planejar ou afirmar conclusão.
- Os arquivos históricos têm solicitações conflitantes e reversões; as mensagens mais recentes do usuário neste projeto prevalecem. O registro antigo inclui até operações destrutivas no primeiro modelo; **não** interpretá-las como autorização para repetir no segundo.
- Fontes de integração, classificações clínicas e modelos de formulários são sensíveis ao tempo e exigem reconfirmação oficial antes de implementação/homologação.
