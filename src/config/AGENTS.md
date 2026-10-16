## Parâmetros por setor
- Parâmetro de setor só existe com catálogo no banco (`sector_parameter_catalog`), leitura real por função (`sector_parameter_value`) e entrada em `src/config/sector-parameters.ts` (teste recusa sem consumidor); versões append-only por `record_sector_parameter`, porque parâmetro sem efeito enganaria quem configura.
