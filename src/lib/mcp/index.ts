import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchHelp from "./tools/search-help";
import myPermissions from "./tools/my-permissions";

// Ref estável embutido no build; a URL publicada pode ser um proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "s-i-g-e-m",
  title: "S.I.G.E.M",
  version: "0.1.0",
  instructions: "Ferramentas somente leitura do SIGEM. Atuam como a conta conectada; as permissões do SIGEM continuam valendo.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchHelp, myPermissions],
});
