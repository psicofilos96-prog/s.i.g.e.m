/**
 * NOBS.2 — fronteira de erro padrão de cada rota/estação (defaultErrorComponent do router).
 * Mostra só mensagem governada + código op-…; o erro original vai inteiro para o log interno.
 * "Tentar de novo" só refaz LEITURAS (loaders); nenhum writer é repetido.
 */
import { useEffect } from "react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { governError } from "@/lib/observability/governed-errors";

export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const g = governError(error);
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section role="alert" className="mx-auto max-w-xl space-y-3 p-6">
      <h1 className="text-xl font-semibold">Esta tela não abriu</h1>
      <p className="text-sm">{g.userMessage}</p>
      <p className="text-xs text-muted-foreground">Código para o suporte: {g.correlationId}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { reset(); void router.invalidate(); }}>Tentar de novo</Button>
        <Button asChild variant="outline"><Link to="/">Ir para o início</Link></Button>
      </div>
    </section>
  );
}
