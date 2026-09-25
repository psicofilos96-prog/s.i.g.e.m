import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { identityStore, type IdentityKind, type IdentityStore } from "./identity-store";

/** Lista reativa dos ativos (hidrata do armazenamento após montagem). */
export function useIdentityAssets(store: IdentityStore = identityStore) {
  useEffect(() => store.hydrate(), [store]);
  return useSyncExternalStore(store.subscribe, store.list, store.list);
}

/**
 * Logo institucional resolvida semanticamente. Preserva proporção (object-contain),
 * suporta PNG transparente e funciona na tela e na impressão. Sem logo: não inventa substituta.
 */
export function InstitutionalLogo({
  kind,
  ownerId,
  date,
  className,
  missing = null,
  store = identityStore,
}: {
  kind: IdentityKind;
  ownerId?: string;
  /** Data de referência (ISO). Padrão: hoje. */
  date?: string;
  className?: string;
  missing?: React.ReactNode;
  store?: IdentityStore;
}) {
  useIdentityAssets(store);
  const asset = store.resolve({ kind, ownerId, date });
  if (!asset) return <>{missing}</>;
  return (
    <img
      src={asset.file.url}
      alt={asset.altText}
      data-identity-id={asset.id}
      className={cn("object-contain", className)}
      style={{ objectFit: "contain" }}
    />
  );
}
