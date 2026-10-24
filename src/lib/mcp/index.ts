import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchHelp from "./tools/search-help";
import myPermissions from "./tools/my-permissions";
import findActions from "./tools/find-actions";
import runAction from "./tools/run-action";

// Ref estável embutido no build; a URL publicada pode ser um proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "s-i-g-e-m",
  title: "S.I.G.E.M",
  version: "0.1.0",
  instructions: "Ferramentas do SIGEM que consultam e gravam como a conta conectada. Use find_sigem_actions para achar a ação e run_sigem_action para executá-la; o SIGEM recusa o que a conta não pode fazer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchHelp, myPermissions, findActions, runAction],
});
