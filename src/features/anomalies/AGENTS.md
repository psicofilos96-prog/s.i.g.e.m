## Anomalias assistidas (`src/features/anomalies/`, `/revisao-de-anomalias`, sem migration)
- Só séries AGREGADAS lidas pela RLS de quem consulta; nunca pessoa, score individual nem previsão, porque sinal estatístico não pode virar rótulo.
- Método transparente versionado (mediana/MAD) e todo sinal carrega método, janela, população, parâmetros e limitações; grupo pequeno, dado ausente ou histórico curto ⇒ sem sinal/"não verificável", nunca zero.
- Inconsistência determinística é da Central de Qualidade; aqui só "revisar" e descartar (local), sem gravação nem sanção.
