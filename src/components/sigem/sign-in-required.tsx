/** Visitante sem sessão: nenhum dado (nem fictício) é mostrado nos cadastros reais. */
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RegistryHero, RegistryEmpty } from "@/components/sigem/registry-layout";

export function SignInRequired({ title, what }: { title: string; what: string }) {
  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Rede Municipal de Itaperuna" title={title} lede={`Entre no SIGEM para consultar ${what}. Sem sessão nenhum dado é exibido — nem de exemplo.`} />
      <RegistryEmpty title="Acesso restrito" description="O cadastro só é lido com a sua conta, no seu alcance de acesso." action={<Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>} />
    </div>
  );
}
