# Secretaria Escolar — complementação integrada

## Resultado esperado
Implementar as onze frentes na Secretaria, com a escola da conta já definida, informações compartilhadas com os registros oficiais e documentos profissionais em A4. Preservar o visual atual, o calendário e a regra de média. Os anexos fornecem a estrutura dos modelos; seus nomes, assinaturas, datas e números não serão importados como fatos.

## 1. Identificação e relatórios básicos
- Aplicar a regra de CPF para nascimento em **01/12/2017 ou depois**, inclusive. Antes dessa data, aceitar certidão como alternativa. INEP não substitui CPF quando este é obrigatório.
- Validar nascimento e documento na tela e na conclusão da matrícula no banco; conferir também os caminhos de transferência e renovação, sem apagar matrículas históricas.
- Permitir completar a identificação de aluno já cadastrado sem criar outro cadastro. Nascimento desconhecido precisa de regularização, nunca classificação presumida.
- Manter a exigência como configuração versionada, com o valor solicitado como padrão inicial identificado, consumida pela matrícula e pelo relatório.
- Disponibilizar os relatórios de alunos sem CPF na faixa exigida, aniversariantes da escola no mês e pendentes de renovação, com filtros por ano e turma.

## 2. Solicitação de vagas e fila oficial
- Conectar a Secretaria aos registros existentes de solicitação, protocolo, distribuição, reserva e lista de espera; não criar outro banco de alunos ou outro saldo de vagas.
- Oferecer cadastro assistido, acompanhamento, convocação e encaminhamento à matrícula, deixando claro que pedido não é matrícula nem promessa de vaga.
- Usar os avisos de pré-matrícula enviados como modelos de checklist: Infantil e 2º–5º ano compartilham documentos, mas apenas o segundo menciona histórico escolar. Datas de 2025 e prazo de 45 dias do exemplar não serão aplicados automaticamente a 2027 nem convertidos em novas exigências.
- Ordem oficial segue o critério versionado da fila existente; apresentar a configuração na tela, sem escolher silenciosamente um critério de prioridade.
- Vagas continuam específicas de cada escola/turma e derivadas da capacidade e ocupação reais. Capacidade ausente não vira zero nem teto geral da rede.

## 3. Termos e proteção do estudante
- Integrar termos legais ao cadastro com texto versionado, responsável, manifestação explícita, data e histórico. Não pré-marcar consentimentos nem impedir matrícula por recusa de imagem.
- Reproduzir o modelo enviado de uso de imagem, com finalidades institucionais, vedação comercial e revogação. Aproveitar o termo de ciência de faltas na frente de infrequência.
- Cada consentimento tem sua própria finalidade; não criar aceites genéricos ou termos inexistentes. O termo de suspensão permanece referência para o fluxo disciplinar, sem automatizar punições nesta etapa.
- Criar seção restrita para medida protetiva e impedimento de retirada por genitor, com vigência, pessoa identificada, documento judicial privado e histórico de correção/encerramento.
- Separar o alerta operacional de retirada do conteúdo judicial: somente quem tem autorização específica lê o documento. Conferir os pontos de retirada e acesso familiar que precisam aplicar a restrição; não presumir que impedimento de retirada revoga todo acesso à família.
- Incorporar o modelo de autorização de retirada: responsável, estudante, pessoa autorizada identificada, vínculo, início da validade, contatos e assinatura. Retirada autorizada deve respeitar restrição judicial vigente, sem publicar seu conteúdo.

## 4. Saúde e frequência
- Registrar atestados médicos com período, recebimento, documento privado e revisão. Vinculá-los às ocorrências canônicas de frequência; atestado não transforma falta em presença nem apaga a chamada.
- Reproduzir a listagem de justificativas enviada: aluno, ano/turma, período de falta, existência de atestado e justificativa minimizada. O arquivo de licença médica de servidor não será usado como atestado de estudante.
- Integrar notificação de infrequência à apuração existente e ao canal único de notificações, com destinatários autorizados, regra versionada e prevenção de duplicidade.
- Gerar o termo de ciência de faltas conforme o modelo, preenchendo somente frequência efetivamente registrada. Não simular entrega externa ou assinatura.
- Registrar conferência vacinal, pendências e regularização, com prazo padrão editável de **30 dias corridos desde o registro da pendência**, exibindo início e vencimento. Não afirmar vacina aplicada nem regularidade sem evidência.
- Disponibilizar relatório de vacinação pendente, distinguindo dentro do prazo, vencida e ainda não conferida, sem incluir conteúdo clínico.
- Registrar atendimento domiciliar/hospitalar com período, fundamento, plano e acompanhamento, integrado aos vínculos escolares e ao Diário. Efeito na frequência depende do regime formal registrado e da política existente; simples atestado ou visita não concede presença.
- Confrontar o formulário de Educação Especial com os registros restritos já existentes de NEI/AEE, planos e apoios. Não duplicar cadastro clínico, exigir laudo para acesso educacional ou inferir diagnóstico; divergências do modelo com regras vigentes serão documentadas antes da integração.

## 5. Ofícios e listagens personalizáveis
- Formulário de ofício com número por escola/ano, data, destinatário, assunto, corpo, anexos e signatário autorizado; reutilizar o registro documental e sua numeração canônica, acrescentando controle transacional somente se necessário.
- Oferecer modelos editáveis para os tipos presentes nos anexos. Prévia, PDF direto e impressão A4 preservam margens e paginação; rascunho e emissão são distintos, sem assinatura ou homologação fictícia.
- Listagens com seleção de colunas permitidas, filtros, ordenação e modelos pessoais; geração em PDF/XLSX pelo motor de relatórios existente, sem exportador paralelo.
- Dados judiciais, clínicos e documentos privados não entram em listagens comuns, notificações amplas ou busca geral.
- Os novos ofícios de férias/licença e a ata serão referências de estrutura para a biblioteca, não novos atos funcionais. A planilha Bolsa Família será referência para conferência: seus limiares e fórmulas divergentes não alteram a regra acadêmica nem serão adotados silenciosamente.

## Integração técnica e segurança
- Reutilizar os writers e readers canônicos de matrícula, identidade, frequência, vagas, notificações, documentos e relatórios. Novas tabelas somente para fatos que ainda não tenham fonte própria.
- Toda alteração estrutural é aditiva; registros oficiais são versionados, com base esperada, autoria real e idempotência. Não modificar migrations já aplicadas.
- Conferir capacidade e escola no banco; a tela nunca concede acesso. Dados sensíveis exigem funções específicas e armazenamento privado, com trilha de acesso e inventário de privacidade atualizado.
- Leituras só após sessão e autorização; listas grandes paginadas e filtradas no servidor, sem consultas por aluno em cascata nem carregamento infinito.
- Registrar arquitetura nos AGENTS relevantes, evidências e lacunas na documentação vigente, e progresso no roadmap.

## Provas antes de concluir
- Testes de limite: **30/11/2017**, **01/12/2017** e **02/12/2017**, com CPF, certidão e nascimento ausente; verificar que tentativa sem documento exigido não deixa matrícula parcial.
- Testar vacinação no início, no 30º dia, após o vencimento e após regularização; renovação e relatórios devem refletir os fatos lidos.
- Provar isolamento entre escolas, negação de leitura judicial/clínica, concorrência de vagas e numeração de ofícios, idempotência e consentimento não presumido.
- Executar os fluxos na tela com conta escolar autorizada e dados de teste isolados; jamais usar estudantes reais para gravações destrutivas.
- Gerar PDFs sintéticos com nomes/endereço longos, campos vazios e várias páginas; inspecionar visualmente e conferir equivalência com a prévia.
- Entregar exemplos para inspeção e informar separadamente o que foi implementado, testado e ainda não provado. Homologação humana não será declarada pelo sistema.