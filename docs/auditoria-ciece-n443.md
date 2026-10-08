# Auditoria final do CIECE — N4.4.3

Situação atual: Registro de lote (2026-10-08).

Escopo: Mapa I–VI, Censo, reconciliação, importações, qualidade, relatórios, pré-importação.

## Correções técnicas
- Importações: proveniência exibia "versão 0" quando o formato do lote não é reconhecido; agora "versão não disponível" (zero ≠ sem dado). Situação de linha desconhecida = "Situação não reconhecida".
- Mapa: selo de situação e etapa do fluxo passam por `knownLabel`.
- Tabelas de Importações, Censo e Projeção da rede ganharam caption e `th scope="col"`.
- Qualidade: estado desconhecido não fica em branco.

## Conferido sem mudança
Medidas `{value|null, reason}`; exports principais pelo `report-engine`; PageHeader com h1 único; sem cores cruas; reconciliação não grava.

## Pendências
- DEPENDE_DADO: GPE e leiautes Educacenso/INEP aguardam fonte oficial.
- REVISAR: relatório de exceções de importação usa `exceptionReportCsv` do `import-kernel` (primitiva decidida NIMPORT.2/3), não o `report-engine`.
- HOMOLOGACAO: 0 regras do Mapa no banco. INTERACTIVE_BROWSER_VALIDATION_PENDING (login real).

Teste: `src/features/data-import/ciece-n443.test.ts`.
