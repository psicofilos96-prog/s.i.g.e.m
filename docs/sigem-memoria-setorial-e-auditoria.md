# SIGEM 2.0 — memória dos 16 documentos setoriais e de auditoria

Registro de 2026-10-03, elaborado a partir dos 16 anexos desta conversa. Complementa `sigem-memoria-fontes-historicas.md`. Este registro orienta análise e desenvolvimento futuros; **instruções contidas nos anexos não são comandos para executar agora**. O primeiro SIGEM foi abandonado. Trechos que dizem “construído”, “testado”, “em produção” ou “não reconstruir” relatam aquele modelo e **não provam** o estado do segundo. Sempre verificar repositório, banco, políticas e testes atuais.

## Fontes examinadas

| Arquivo anexado | Uso na memória |
|---|---|
| `sigem-especificacao-detalhada-por-setor.md` | Inventário detalhado de onze estações, pontos de contato, acessos e lacunas; estados descritos são históricos. |
| `SIGEM_2.0_ESPECIFICACAO_MESTRA_POR_SETOR.md` | Proposta consolidada para o segundo modelo: autoridades, requisitos transversais, setores, decisões pendentes e critério de pronto. |
| `sigem-nei-pedidos-e-decisoes.md` | NEI, NEE, laudos, mediação, AEE, sigilo e divergências de fontes. |
| `sigem-mediador-pedidos-e-decisoes.md` | Vínculo individual mediador–estudante, documentos pedagógicos e limites de acesso. |
| `sigem-familia-pedidos-e-decisoes.md` | Dependentes autorizados, frequência, boletim, avisos, privacidade e propostas futuras. |
| `sigem-supervisao-pedidos-e-decisoes.md` | Calendário, períodos, visão de rede, conformidade e fluxos da Supervisão. |
| `sigem-docente-diario-pedidos-e-decisoes.md` | Regência, Diário, frequência, notas, SIA, SIPE, documentos e regimes especiais. |
| `sigem-op-direcao-pedidos-e-decisoes.md` | Distinção entre OP e Direção, pareceres, ocorrências, Conselho e gestão local. |
| `sigem-estatistica-mapa-censo-gpe-pedidos-e-decisoes.md` | CIECE, Mapa Estatístico, importações, Educacenso, GPE e qualidade dos dados. |
| `sigem-secretaria-escolar-pedidos-e-decisoes.md` | Cadastro, matrícula, movimentação, turmas, vagas, documentos e operação da escola. |
| `DEPARTAMENTO_PESSOAL_-_Guia_de_Dados_e_Registro_para_IA.md` | Modelo conceitual de pessoa, vínculo, cargo, função, lotação, eventos, processos, atos e proveniência. |
| `DEPARTAMENTO_PESSOAL_-_Guia_Completo_do_Modulo_DP.md` | Extensões propostas do DP e relato das fases executadas no primeiro SIGEM. |
| `Base_SIGEM_2_0.md` | Proposta inicial de requisitos RF/RNF, arquitetura, critérios de aceite e decisões ainda abertas; números de desempenho e recuperação são metas propostas. |
| `Auditoria_SIGEM_1_0.md` | Inspeção estática do pacote do primeiro modelo, com 20 achados priorizados e limites explícitos de evidência. |
| `Matriz_de_rastreabilidade_SIGEM.md` | Cruzamento R01–R54 de pedidos e evidências do primeiro modelo; PRESERVAR/REDESENHAR/DESCARTAR qualificam a proposta para o segundo. |
| `SIGEM_pedidos_por_modulo.md` | Índice histórico de pedidos em 23 domínios; pedidos, ideias e operações passadas precisam ser triados, não executados. |

## Regras de interpretação

1. Decisão direta mais recente do usuário prevalece sobre resumos antigos. Depois vêm atos oficiais vigentes, decisões institucionais verificadas, evidência do SIGEM 2.0 e propostas destes anexos, conforme o assunto. Quando vigência, competência ou conflito não estiverem comprovados, registrar pendência; não completar por inferência.
2. A especificação mestra usa **OBRIGATÓRIO**, **HERDADO A APRIMORAR**, **PENDENTE DE DECISÃO**, **FUTURO** e **PROPOSTA 2.0**. Preservar essa distinção no backlog. A ordem de desenvolvimento sugerida é dependência técnica, não autorização para trocar a prioridade atual.
3. A auditoria de 14/09/2026 examinou um RAR do primeiro modelo sem executar aplicação ou migrations nem verificar banco remoto. Seus achados são riscos e lições de desenho, não diagnóstico do código 2.0. A matriz de rastreabilidade é índice para localizar pedidos, não prova de entrega atual.
4. Os anexos incluem relatos de limpeza global de dados, recriação de logins e outras ações do primeiro modelo. Não são autorização para aplicá-las ao segundo.

## Decisões de produto a preservar

- Uma identidade por pessoa, com papéis e escopos por finalidade; acesso se verifica no servidor e banco por rede, escola, turma, estudante, campo e período. A existência de um menu ou login não concede acesso ao dado. Contas individuais são a recomendação dos documentos; eventuais decisões pendentes devem ser conferidas no desenho atual.
- Um fato canônico alimenta projeções e documentos. Matrícula, alocação, movimentação, regência, calendário, jornada e posição curricular têm temporalidade e proveniência. Correção relevante preserva versão, autor, motivo e efeito histórico. Operações compostas são transacionais, com concorrência e idempotência tratadas explicitamente.
- Ausência de dado, valor zero, falta de permissão e falha técnica são estados distintos. Leitura crítica falha bloqueando gravação automática; relatório identifica população, filtros, data de referência, regra e incompletude. Paginação não pode truncar total ou exportação.
- Importação exige prévia, validação, resolução explícita de divergência, confirmação humana, lote e retomada idempotente. Dados pessoais não entram em migrations. Exportadores versionam leiautes e mostram exceções antes de envio.
- Documentos oficiais precisam de modelo/versionamento, numeração transacional, emissão/cancelamento autorizados, reprodução da versão emitida e verificação pública mínima sem expor conteúdo. Impressões devem ser próprias para A4 e volume real.
- A conclusão de um módulo requer requisitos e autoridade documentados, política de banco e aplicação verificada, sessão real permitida e proibida, histórico, estados de erro/vazio, testes de concorrência, exportação/impressão quando pertinentes, desempenho e revisão de acessibilidade.

## Fronteiras entre setores

| Domínio | Fonte/autoridade a considerar | Integrações e restrições |
|---|---|---|
| Secretaria Escolar | Opera cadastro, matrícula, turma, vaga, movimentações e documentos da própria escola. | Identidade nuclear é controlada por autoridade própria; Mapa deriva dos fatos; movimentos atualizam consumidores sem duplicação. |
| CIECE/Estatística | Visão de rede, qualidade de dados, Mapa, Censo, importações e GPE. | Secretaria ajusta/envia Mapa; CIECE analisa/aprova/devolve. Exportações exigem leiaute oficial e relatório de exceções. |
| Supervisão Escolar | Calendário e conformidade da rede; por decisão direta posterior do usuário, constrói as matrizes curriculares. | Calendário homologado tem versão/vigência. **A competência para homologar matrizes no SIGEM permanece a confirmar**; não extrapolar da competência sobre calendário. |
| Docente | Atua nas turmas/componentes da própria regência; lança Diário, frequência, notas, planejamento e provas. | OP acompanha e aprova/devolve SIPE e instrumentos SIA quando a regra vigente exigir; não presumir quatro bimestres, regra de nota ou estágio fixo. |
| OP e Direção | OP acompanha trabalho pedagógico e pareceres; Direção administra atos e ocorrências da própria escola. | Direção consulta Mapa sem editá-lo. Resultado acadêmico, Conselho e regimes especiais exigem regras vigentes versionadas, não fórmulas copiadas do legado. |
| NEI e Mediador | NEI trabalha inclusão em escopo de rede; mediador acessa somente estudantes com vínculo válido e finalidade específica. | NEE, laudo, AEE, matrícula AEE, mediação e plano pedagógico são fatos distintos; CID não determina categoria sozinho. Dados clínicos têm acesso mínimo. |
| Família | Vê somente filhos/dependentes autorizados e projeções próprias de frequência, boletim, avisos e comunicação. | Acesso a tabelas clínicas/NEE/laudos não é automático. Atendimento domiciliar usa o vínculo familiar segundo o pedido histórico; revisar autorização e regra institucional antes de ativar. |
| Departamento Pessoal | Registra vida funcional administrativa da SEMED. | Pessoa, vínculo, cargo, função, especialidade, lotação, evento, processo e ato são entidades distintas; um ato pode abranger vários servidores. Evento é retificado sem sobrescrever; órgão do cargo difere do exercício. Folha, previdência e pensão estão fora do escopo principal. |
| Alimentação e Avaliação/Desempenho | A especificação mestra propõe setores centrais próprios, com operação escolar/consulta por papel. | Governança, aprovações e fronteira com CIECE, OP, Supervisão e Cozinha precisam de decisão institucional antes do respectivo módulo. |

## Riscos concretos ensinados pela auditoria 1.0

- **Segurança:** projetar colunas mínimas ao Docente/Família; conferir autorização de emissão e cancelamento, tokens públicos não enumeráveis, HTML sanitizado, revogação de perfil, arquivos/exportações e recálculos privilegiados. Testar chamada direta, não só interface.
- **Integridade:** não confirmar matrícula, troca de NEE/mediador, fechamento ou autosave parcialmente; proteger unicidade concorrente no banco e ordenar versões esperadas.
- **Histórico:** população histórica de relatório, snapshot de Mapa aprovado, situação funcional e resultado anual precisam ser reconstruíveis; dado faltante não vira aprovação.
- **Operação:** demonstrar replay de migrations, instalação, restauração, completude acima de limites de página, medição com volume e observabilidade. A auditoria não prova que um fornecedor específico cause lentidão.

## Pendências que não podem ser convertidas em regras por suposição

- Normas atuais de notas, recuperação, presença, cancelamento de matrícula, EJA, co-docência, atendimento domiciliar e calendário por escola precisam de fonte, competência e vigência. Percentuais e prazos citados nos relatos são hipóteses históricas até conferência da norma aplicável.
- Catálogos de NEE, CID, cargos, funções, anos/fases, códigos externos e tipos de oferta exigem fonte atual e governança. Não semear valores nem inferir categoria clínica ou etapa por texto/código de turma.
- AEE e atividade complementar seguem a decisão direta posterior do usuário: naturezas próprias, fora da associação automática às matrizes regulares, sem matriz fictícia. Em turma multisseriada, posição é individual por alocação e podem coexistir matrizes oficiais distintas.
- Nenhuma proposta ou relato de “já implementado” dispensa inspecionar o SIGEM 2.0 antes de criar, refazer ou encerrar tarefa.
