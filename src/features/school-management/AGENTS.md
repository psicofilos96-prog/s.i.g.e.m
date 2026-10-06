## Estação da Direção (AK — `src/features/school-management/`, `/gestao-escolar`, sem migration)
- Painel é projeção pura (`buildPanel`) dos readers canônicos lidos com a sessão; nenhuma tabela de resumo nem função DEFINER própria, porque agregado gravado ou reader privilegiado viraria segunda verdade e ampliaria poder.
- Cada bloco tem estado AVAILABLE/ZERO/UNKNOWN/UNAVAILABLE/BLOCKED com motivo; recusa de autorização é UNAVAILABLE e ausência de informação de serviço é UNKNOWN, porque fonte não configurada nunca é zero.
- Pendências só de invariantes existentes (fato ausente, ambiguidade, conferência, bloqueio normativo, fonte não lida), sem score nem alerta; ações são links aos módulos donos.
- Fonte sem `knownAt` é marcada como "estado atual da fonte"; o relatório `situacao-operacional-escola` declara ser projeção, não documento oficial.
