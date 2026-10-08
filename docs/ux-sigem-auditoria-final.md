# SIGEM — Auditoria final de produtização (N12.3, 2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


**Resultado: SEM PASS.** O acervo inteiro não foi cruzado requisito a requisito neste lote, e há gaps técnicos já decididos ainda abertos (listados abaixo, não ignorados).

## Gates executados
| Gate | Resultado |
|---|---|
| Suíte completa (`bunx vitest run`) | 337 arquivos, 3946 testes — PASS |
| Typecheck (`tsgo --noEmit`) | limpo |
| Deep 31/31, build, migration integrity, diff-check, security scan, route smoke, export ACL, a11y, regressão visual, zero resíduo | NÃO EXECUTADOS neste lote |

## Completo tecnicamente (com prova em lote anterior)
Secretaria N5.1–N5.4 (matrícula, vagas/livro, turmas, documentos versionados, transferência, remanejamento, renovação); calendário 2027 e modelos externos (CAL.EXT.*); histórico do aluno com saídas da Secretaria (0226); ciclo da avaliação (0227); filtros da fiscalização do Diário; fila de termos de inclusão (0228/0229); emissão/verificação de carteirinha (0230); agenda docente (lógica pura); busca global INVOKER; modelo de notificações; modelo de auditoria.

## Gaps técnicos JÁ DECIDIDOS ainda abertos (não ignorados)
- N5.5: pendências documentais, comunicação multi-turma com prévia/confirmação, "Serviços da escola", home da Secretaria, auditoria da estação.
- N6.2.1: home, heatmap completo, evolução, drill-down, importação, relatórios da Avaliação.
- N7.2.1: UI da fiscalização do Diário, Dossiê da Direção, SIPE ponta a ponta, SIA, Conselho/ata, relatórios OP/Direção.
- N8.2.1: registro restrito CID/laudo, AEE, PEI/PAEE, mediador, relatório NEI.
- N9.2.1: foto, PDF frente/verso, página pública do QR, portal da família, autorizações, portaria.
- N10.2.1: autosave EI, SIPE/SIA docente, agenda no Meu Diário, regressão mobile.
- N11.2.1: telas do DP, transporte, infraestrutura, construtor de documentos, assistente de relatórios, UX da Alimentação.
- N4.4: central do Censo, dry-run de reconciliação, importações na estação CIECE, painel de qualidade, relatórios.
- NCFG.1: dry-run professores × 551 vínculos, jornadas, turmas.
- NADM.2: telas da Central de acessos, busca, notificações, auditoria, home Admin.
- N3.3: 25 rotas ANTIGAS, homes de estação, login, breakpoints.

## Pendente por decisão
Quem revisa termos de inclusão; quem emite carteirinha; autoridade final da Busca Ativa; documentos obrigatórios da Secretaria; programas sociais/PSE; probatório/quinquênio/aposentadoria/acúmulo; quem exporta auditoria; termo de uso de imagem.

## Pendente por dado
BNCC↔SAEB; modelos oficiais GPE (`modelo_profissional_1.xlsx`, `modelo_estudante.xlsx`); fonte 2027 de turmas; mapeamento humano das planilhas sem cabeçalho; matriz curricular oficial da rede.

## Pendente por template
Ficha de matrícula, Declaração de Transferência, Atestado de Escolaridade, renovação.

## Pendente por browser approval
Validação por usuário autenticado clicando em todas as estações (INTERACTIVE_BROWSER_VALIDATION_PENDING).

## 20 próximos passos operacionais
1. Escolher UMA ronda aberta e fechá-la até o PASS. 2. Atribuir `revisar-termos-inclusao`. 3. Atribuir `emitir-carteirinha-estudantil`. 4. Definir autoridade da Busca Ativa. 5. Enviar os modelos GPE. 6. Mapear colunas das planilhas sem cabeçalho. 7. Homologar templates de documentos da Secretaria. 8. Decidir termo de imagem. 9. Definir documentos obrigatórios. 10. Decidir quem exporta auditoria. 11. Fornecer fonte oficial BNCC↔SAEB ou dispensar. 12. Decidir regras de probatório/quinquênio. 13. Abrir 2027 (fora deste lote). 14. Cadastrar turmas 2027 com fonte real. 15. Importar escolas por código Educacenso via staging. 16. Conferir professores × 551 vínculos. 17. Rodar deep 31/31 + security scan. 18. Validar estações no navegador autenticado. 19. Migrar as 25 rotas ANTIGAS. 20. Publicar após os gates.

A matriz `docs/matriz-completude-produto-sigem.md` ainda não tem uma linha por requisito do acervo; essa conversão está pendente.

STOP — configuração oficial 2027 não iniciada.

## N11.2.2 (parcial)
- /departamento-pessoal: "Linha do tempo funcional" por pessoa (vínculo, lotação, exercício, eventos, processos); fato sem data fica ao final, nunca data inventada; textos da página corrigidos (DP administrativo dentro do SIGEM).
- Pendentes: home de atenção do DP, transporte, infraestrutura, construtor de documentos, wizard de relatórios, UX NAE.

## N12.4 — Reauditoria final (2026-10-07; substitui a N12.3)
**Resultado: NÃO PASS.** Restam gaps técnicos já decididos (ver matriz, seção N12.4): telas com texto técnico do servidor (21), aplicação das primitivas NUX.4 por rota, Docente (autosave EI, SIPE/SIA, PEI/PAEE), Apoio além do DP, tela Censo/Qualidade, revisão das 427 funções DEFINER.

Próximos passos não técnicos (dependem de pessoas):
1. Decidir quem revisa termos de inclusão, quem emite carteirinha, quem exporta auditoria, autoridade da Busca Ativa.
2. Enviar redação oficial dos modelos (ficha de matrícula, declaração de transferência, atestado, renovação).
3. Enviar modelos GPE oficiais, fonte 2027 de turmas, matriz curricular oficial, BNCC↔SAEB.
4. Uma sessão de navegador aprovada por pessoa para a validação visual.

## N12.5 — auditoria final (2026-10-07)
Resultado: NÃO PASS — gaps técnicos já decididos continuam abertos, todos listados (nenhum oculto).
Gates: 4.029/4.029 testes (357 arquivos); typecheck 0 erros; integridade de migrations ok; contagens oficiais inalteradas; nenhum 2027 configurado.
Gaps técnicos abertos (COMPLETO_TECNICAMENTE pendente):
- 34 telas .tsx ainda leem error.message (NOBS.1/NUI.1).
- 5 arquivos com window.confirm (bloqueio de navegação síncrono + restantes).
- checkUpload não ligado nos 5 uploads (NFILE.1.1).
- Catálogo ui-vocabulary não aplicado tela a tela; screen pieces NUX.4 não aplicados por rota.
- Autosave Docente EI/SIPE/SIA/PEI/PAEE; Apoio (transporte, infra, construtor, relatórios, NAE); tela Censo/Qualidade.
- 427 funções DEFINER sem revisão item a item; NDB.1.1 (índices/FKs/constraints).
INTERACTIVE_BROWSER_VALIDATION_PENDING: visual, PDFs com login, a11y em contraste/zoom.
INFRAESTRUTURA: backup/restauração, rate limiting, tipos por bucket.
DEPENDE_DECISAO / ASSIGNMENT_PENDING: revisar-termos-inclusao, emitir-carteirinha, exportar-auditoria, homologar matrizes, calendário público.
DEPENDE_DADO: BNCC↔SAEB, modelos GPE, fonte 2027 de turmas, matriz curricular oficial, catálogos.
TEMPLATE_INSTITUCIONAL_PENDENTE: matrícula, transferência, atestado, renovação.

## NFINAL.7 — auditoria de fechamento (2026-10-08) — substitui a N12.5
**Resultado: NÃO PASS.** `SIGEM_TECHNICAL_CLOSURE_AUDIT_COMPLETE` não é declarado: ainda restam gaps técnicos já decididos, todos listados abaixo (nenhum oculto).

### Gates
- `npm run verify`: 10/10 OK (migrations, tipos, suíte, profundas, a11y, segurança SQL, segredos, diff, build, smoke de 11 rotas).
- Após as correções desta rodada: suíte 402 arquivos / 4.296 testes; profundas 7 arquivos / 53 testes (o "31/31" de N12.4 mudou de formato); typecheck 0 erros.
- Harness de 69 perfis: só camada **estática** — sem credencial técnica do ambiente, a camada autenticada não roda nesta sessão (INTERACTIVE_BROWSER_VALIDATION_PENDING).
- Varredura de segurança: 26 avisos, todos de leitura ampla por quem tem login em tabelas de norma, catálogo ou estrutura (referências curriculares, homologações, tipos de movimentação, escolas, instalação, workflow). Nenhuma tem dado pessoal; a leitura é intencional e o acesso anônimo continua zero.
- Contagens oficiais inalteradas: 55 escolas, 9.763 alunos, 698 turmas, 10.822 pessoas. Resíduo 0 (0 fixtures, 0 contas de teste); 0 carteirinhas emitidas; 0 versões de ano 2027 (STOP respeitado).
- PDFs: os seis PDFs CAL.EXT.2.2 seguem válidos (nenhum código de calendário alterado). Exportações: nenhum caminho novo.

### Corrigido nesta rodada
- Leituras que pediam `.limit(2000/5000)` e eram cortadas em 1.000 linhas, sem aviso: anomalias, planejamento, itens/instrumentos docentes e turmas do acompanhamento do Diário. Agora usam `readPages`. No limite, falham como "indisponível" ou com aviso, nunca como lista parcial. Teste permanente: `src/test/invariants/nfinal7-silent-limit.test.ts`.
- Reavaliados e fechados: todos os 5 envios de arquivo passam por `guardUpload`. O vínculo estudante↔ponto do transporte já tem formulário. A tela Censo/Qualidade foi entregue (N4.4.2) e o assistente de relatórios também (NREL.2). A carteirinha está completa (NFAM.1).

### Gaps técnicos já decididos AINDA ABERTOS
1. Listas de alunos e profissionais com login real fora da paginação comum (NPAG.1).
2. Central de Importações sem `readFileSafely`/`exceptionReportCsv` (NIMPORT.2).
3. Status de fechamentos, conselho e regras avaliativas definidos por tela, fora de `state-presentation.ts`; estoque e recebimento da alimentação com botões decididos direto pelo status (NSTATE.1).
4. Troca de mediador em um passo (NINC.1).
5. Autosave docente além da EI (SIPE/SIA/PEI docente) e recuperação após recarregar (N10.2.3).
6. Revisão item a item das funções DEFINER de authenticated (a gate profunda cobre search_path e grants, não a lógica de cada uma).
7. Primitivas NUX.4 e vocabulário aplicados tela a tela; telas que ainda propagam texto do servidor (34 arquivos leem `error.message`; sem medição de quantos exibem texto cru).
8. Erros de validação por campo/célula e persistência da "Nova turma" (NFORM.1); botões "Tentar novamente" sem ligação com a trilha (NOBS.3).

### Restante, por classe
- INTERACTIVE_BROWSER_VALIDATION_PENDING: todas as estações com login real, impressão/PDF com login, leitor de tela, celular.
- OPERATIONAL_CONFIGURATION_PENDING: políticas que atribuam `emitir-carteirinha-estudantil`, `revisar-termos-inclusao`, permissões de inclusão, transporte e `localizar-estudante-para-matricula`; composições das 698 turmas; grades.
- DEPENDE_DECISAO: quem exporta a auditoria; autoridade da Busca Ativa; peso dos remanejados; carência de mediador; prazos do DP; termo de imagem/foto; numeração do Livro; fila de vagas; dimensões A/B/C; 198 dias letivos de 2027 abaixo do mínimo de 200.
- DEPENDE_DADO: BNCC↔SAEB; modelos GPE; fonte 2027 de turmas; matriz curricular oficial; catálogos.
- TEMPLATE_INSTITUCIONAL_PENDENTE: ficha de matrícula, transferência, atestado, renovação, PEI/PAEE/relatório NEI.
- HOMOLOGACAO: regra do Mapa 2027 (CI-01/CI-02).

STOP — 2027 não configurado oficialmente.
