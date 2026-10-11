import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { MATRIX_FAMILIES } from "./matrix-skills";

/** Lote 2: famílias de matriz e regras da análise por habilidade. Conteúdo só por fonte verificada. */
export function SkillsPanel() {
  return (
    <div className="space-y-3">
      <StatePanel tone="info" title="Matrizes e habilidades" description="Códigos e descritores entram apenas por importação de fonte verificada (arquivo com impressão digital) no repositório curricular. Relações entre matrizes têm natureza e confiança; equivalência só com fonte oficial." />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-2">Matriz</th><th className="p-2">Códigos</th><th className="p-2">Componentes</th><th className="p-2">Anos</th><th className="p-2">Ciclos I/II/III</th><th className="p-2">Conteúdo</th></tr></thead>
          <tbody>{MATRIX_FAMILIES.map((m) => (
            <tr key={m.key} className="border-t"><td className="p-2 font-medium">{m.name}<div className="text-xs text-muted-foreground">{m.source}</div></td>
              <td className="p-2">{m.codeScheme}</td><td className="p-2">{m.components.join(", ")}</td><td className="p-2">{m.grades}</td>
              <td className="p-2">{m.hasCyclePresence ? "sim" : "não se aplica"}</td>
              <td className="p-2"><StatusBadge tone="warning">Aguardando fonte</StatusBadge></td></tr>))}</tbody>
        </table>
      </div>
      <StatePanel title="Domínio por habilidade" description="Questão do SIA → habilidade → correção conferida → domínio agregado. Não lidas e anuladas ficam fora da conta e são mostradas. Sem regra homologada de mínimo de itens e respondentes, nenhuma taxa é calculada; habilidade sem questão é lacuna de cobertura, não baixo domínio." />
      <StatePanel title="Intervenção (SIPE/OP)" description="Só habilidades apuradas abaixo de um limiar homologado são sugeridas ao planejamento. Sem limiar, nada é apontado." />
    </div>
  );
}
