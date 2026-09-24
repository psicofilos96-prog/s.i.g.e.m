# Etapa 12B.1 (revisão) — Calendário da rede, governado pela Supervisão

## Objetivo
Substituir o calendário demonstrativo atual por um calendário **central da rede**, de propriedade exclusiva da Supervisão de Ensino, com ciclo RASCUNHO → EM_REVISÃO → HOMOLOGADO (imutável) → ARQUIVADO. Reproduzir fielmente os documentos 2027 (Regular anual e EJA semestral) a partir da especificação fornecida. Escolas apenas consultam.

## Observação sobre os arquivos recebidos
- O arquivo `calendario-2027-assets.rar` não pôde ser aberto (formato não reconhecido). As imagens de referência do Regular e do EJA estavam dentro dele. Usarei como referência visual a especificação completa (grade, cores, tamanhos, CSS da tela de impressão e resultado esperado linha a linha) e os logos já enviados (brasão e "Prefeitura de Itaperuna · Educação"). A comparação lado a lado com as imagens ficará pendente até o reenvio (ZIP ou PNG).

## O que muda para o usuário
1. **Supervisão** (`/calendario-escolar`): lista de calendários por ano/modalidade com estado; editor em RASCUNHO (selecionar dia, definir tipo, aplicar faixa, férias, recessos, feriados, feriados letivos, início/retorno/término, Conselhos, períodos), totais automáticos, colisões e inconsistências, "Enviar para revisão", "Homologar" (com responsável e data), "Duplicar para o próximo ano", "Arquivar".
2. **Escola/professor**: mesma rota, somente consulta do calendário homologado da rede; nenhum botão de edição, sem ajuste local.
3. **Documento**: visualização e impressão A4 paisagem, uma página por modalidade, reproduzindo o modelo interno (cabeçalho com dois logos, grade Mês/Dia × 31 colunas, coluna de total com divisão por período, tarja FÉRIAS, siglas e cores, legenda sem PP, lista de feriados, períodos, Conselhos, rótulos de assinatura sem caixa). EJA com corte em 25/07, julho duplicado e subtotais semestrais.
4. **Estrutura avaliativa**: períodos passam a vir do calendário homologado por ID; a avaliação deixa de ter datas próprias.

## Regras de governança
- Toda mutação passa por uma única função de domínio que recusa se o estado não for RASCUNHO ou se o perfil não tiver a capacidade `editar` (Supervisão). HOMOLOGADO e ARQUIVADO são snapshots congelados (objeto congelado + recusa explícita). Sem retorno a rascunho.
- Auditoria conceitual em memória: criado por/em, cada alteração (quem, quando, o quê), homologado por/em.
- Escolas resolvem o calendário por `(anoLetivo, modalidade)` → mesmo `calendarId`; nenhuma cópia por unidade.
- Permissões apenas modeladas (Supervisão / escola / professor), com pontos marcados como dependentes de backend/RBAC.

## Motor e dados
- Motor comum com a precedência da especificação (sobrescrita > evento pontual > FL > feriado > feriado herdado > recesso > férias > fim de semana > letivo) e a regra de "conta como letivo" como **atributo do tipo de dia**, não `if` por sigla.
- Fixture 2027 Regular e EJA transcrita da especificação (marcada como referência de reprodução, estado RASCUNHO como na origem; o teste de imutabilidade homologa uma cópia).
- Decisões de 2027 (CC na sexta, 67/68 dias, ≥100 por semestre, ≥200 no ano) viram **validações configuradas no calendário**, não regras universais.
- Duplicação: novo calendário RASCUNHO no ano seguinte, recalcula fins de semana e datas fixas, lista colisões (evento fixo que cai em fim de semana, CC fora do dia configurado, totais abaixo do mínimo configurado) sem corrigir nada automaticamente.
- O calendário demonstrativo 2026 atual e o "ajuste local" são removidos; a 2026 passa a "não cadastrado" (ou é removida da fixture), evitando dois modelos.

## Testes novos (além dos 800 atuais)
Escola e professor não editam; RASCUNHO editável pela Supervisão; HOMOLOGADO e ARQUIVADO rejeitam mutação; homologação registra data/responsável; todas as escolas resolvem o mesmo calendário; nenhuma cópia por escola; período avaliativo referencia período oficial por ID; troca de nome não quebra referências; duplicação cria RASCUNHO sem alterar original e recalcula; colisões pós-duplicação listadas; 2027 inalterado após homologar; grade Regular e EJA iguais ao "resultado esperado" linha a linha (totais 200, 15+4, 7+14, 100/100, 67/67/66, 52/48 e 49/51, dezembro R/F/D/CF T).

## Detalhes técnicos
- `src/features/calendar/`: reescrever `calendar-types`, `calendar-rules` (motor + validações + grade documental), `calendar-store` (repositório com guarda de estado e auditoria), `calendar-fixtures` (2027), `calendar-governance` (capacidades, transições, duplicação), `calendar-document.tsx` (documento fiel, CSS dedicado em `styles.css` com as medidas da especificação), páginas Supervisão/escola.
- `assessment-*`: `AssessmentPeriod` passa a guardar `calendarPeriodId`; datas resolvidas do calendário; testes da 12A/12B ajustados sem mudar significado.
- PDF: impressão pelo navegador com stylesheet A4 paisagem e ajuste de escala para caber em 1 página (sem @react-pdf, sem infraestrutura nova).
- Validação visual com Playwright em 390–1920px, zoom 125/150%, sidebar aberta/recolhida, impressão e PDF de 1 página por modalidade.
- Relatório final com todos os itens pedidos; parar sem iniciar a 12C.
