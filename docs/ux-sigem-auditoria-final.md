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
