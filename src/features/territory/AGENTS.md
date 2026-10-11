## Catálogo territorial IBGE DTB (`src/features/territory/`, migrations 0379–0380)
- Catálogo central = tabelas `territorial_*` por ano-base (append-only, códigos sempre texto com comprimento e prefixo hierárquico conferidos no banco); carga só por `scripts/ibge-dtb-import.py` (ODS oficial, SHA-256 por fonte, ON CONFLICT DO NOTHING, rejeições contadas), porque cópia de planilha ou código numérico perderia zeros e proveniência.
- Novo ano DTB = novas linhas com outro `dtb_year`; novos/extintos vêm só do arquivo do IBGE (`territorial_district_changes`), nunca inferidos por diferença.
- Reconciliação (`territory-catalog.ts`) prioriza código; nome só casa com UF e resultado único; homônimo/ausente vai para fila, e o valor original nunca é sobrescrito.
- Exportação valida território só nos campos que o leiaute real declara, com ano do catálogo explícito, porque presumir distrito em todo leiaute seria regra inventada.
