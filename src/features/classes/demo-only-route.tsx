import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/sigem/patterns";
import { ClassRouteGate } from "./class-route-gate";

/** NDEMO.2 — destinos reais que já existem para cada tela de demonstração. */
export type RealDestination = "/administracao" | "/departamento-pessoal" | "/matrizes-curriculares" | "/enturmacoes" | "/regras-institucionais";

/**
 * Tela que só sabe ler dados de demonstração. Com sessão institucional NADA de demonstração é
 * renderizado: mostra estado vazio honesto e, quando existe, o caminho para a tela real.
 * Sem sessão, o laboratório continua (identificado como demonstração pela própria tela).
 */
export function DemoOnlyRoute({ children, what, real, realLabel }: { children: () => ReactNode; what: string; real?: RealDestination; realLabel?: string }) {
  return (
    <ClassRouteGate
      laboratoryHasHeading
      laboratory={children}
      institutional={() => (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold text-foreground">Tela de demonstração</h1>
          <EmptyState
            title="Esta tela ainda não lê os dados da rede"
            description={`${what} Com login, o SIGEM não mostra dados de demonstração aqui; nenhum registro real foi omitido nem inventado.`}
          />
          {real && <p className="text-sm"><Link to={real} className="underline">{realLabel ?? "Abrir a tela com os dados da rede"}</Link></p>}
        </div>
      )}
    />
  );
}
