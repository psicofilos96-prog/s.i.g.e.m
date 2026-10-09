/**
 * ONDA 2 — Nova escola / Editar escola em tela própria. Grava só pelo writer
 * `register_school_record_version` (via SchoolsAdminSection); o banco revalida
 * capacidade de rede, base esperada e unicidade de INEP/código.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { RegistryHero, RegistryEmpty } from "@/components/sigem/registry-layout";
import { SkeletonState } from "@/components/sigem/guidance";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { SchoolsAdminSection } from "@/features/institutional-admin/schools-admin-section";

export const SCHOOL_MAINTAIN_CAPABILITY = "manter-cadastro-unidade-escolar";

export function UnitEditorPage({ schoolId }: { schoolId: string | null }) {
  const authority = useSessionAuthority();
  const navigate = useNavigate();
  const canMaintain = authority.status === "signed-in" && authority.capabilities.some((c) => c.capabilityId === SCHOOL_MAINTAIN_CAPABILITY);
  const back = (saved: boolean) => {
    if (saved) toast.success(schoolId ? "Nova versão da unidade registrada." : "Unidade cadastrada.");
    void navigate({ to: "/unidades" });
  };
  return (
    <div className="space-y-6">
      <Link to="/unidades" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar às unidades</Link>
      <RegistryHero
        eyebrow="Rede Municipal de Itaperuna · Cadastro institucional"
        title={schoolId ? "Editar unidade escolar" : "Nova unidade escolar"}
        lede={schoolId ? "Cada alteração vira uma nova versão com vigência; a versão anterior é preservada." : "Informe os dados essenciais. O identificador interno nasce no banco; INEP e código da rede não mudam depois."}
      />
      {authority.status === "loading" && <SkeletonState label="Conferindo sua permissão" />}
      {authority.status !== "loading" && !canMaintain && (
        <RegistryEmpty title="Sem permissão para alterar o cadastro" description="Sua atuação vigente não concede a manutenção do cadastro de unidades com alcance de rede." />
      )}
      {canMaintain && <SchoolsAdminSection canMaintain focus={{ schoolId }} onExit={back} />}
    </div>
  );
}
