import { usePermissao } from "@/hooks/use-permissao";
import type { AcaoPermissao } from "@/integrations/supabase/exigir-permissao";

/**
 * Moderação do ImobMatch (ImobMatch Gestão, 28/10/2026): vale o módulo novo
 * `imobmatch.moderacao` ou o antigo `saas.imobmatch` (quem já moderava continua moderando).
 * As server functions aceitam os dois do mesmo jeito (`exigirPermissao` com alternativas).
 */
export function useModeraImobMatch(acao: AcaoPermissao): boolean {
  const novo = usePermissao("imobmatch.moderacao", acao);
  const antigo = usePermissao("saas.imobmatch", acao);
  return novo || antigo;
}
