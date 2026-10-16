import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/sigem/patterns";
import { SectorParametersPanel } from "@/components/sigem/sector-parameters-panel";
import { EXISTING_PARAMETER_SCREENS, SECTOR_PARAMETERS } from "@/config/sector-parameters";
import { brand } from "@/config/branding";

const title = `Parâmetros — ${brand.name}`;
const description = "Prazos, fórmulas e limites de cada setor, num só lugar. Altere quando quiser; o histórico fica guardado.";

const SECTOR_LABEL: Record<string, string> = { alimentacao: "Alimentação Escolar", matriculas: "Matrículas", avaliacao: "Avaliação e frequência", frequencia: "Frequência e busca ativa", protocolos: "Protocolos e processos" };

export const Route = createFileRoute("/parametros")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParametersHub,
});

function ParametersHub() {
  const sectors = [...new Set([...Object.keys(SECTOR_PARAMETERS), ...Object.keys(EXISTING_PARAMETER_SCREENS)])];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuração" title="Parâmetros" description={description} />
      {sectors.map((s) => (
        <section key={s} className="space-y-3">
          <h2 className="font-display text-lg font-semibold">{SECTOR_LABEL[s] ?? s}</h2>
          {(SECTOR_PARAMETERS[s] ?? []).length > 0
            ? <SectorParametersPanel sector={s} id={`parametros-${s}`} />
            : <ul className="flex flex-wrap gap-2 text-sm">{EXISTING_PARAMETER_SCREENS[s]!.map((l) => <li key={l.href}><a href={l.href} className="block rounded-full border px-3 py-1.5 hover:bg-accent">{l.label}</a></li>)}</ul>}
        </section>
      ))}
    </div>
  );
}
