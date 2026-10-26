import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CabecalhoGestao, PaginaGestao } from "@/components/plataforma/kit";
import { AbaAnunciantes } from "@/components/plataforma/imobmatch/aba-anunciantes";
import { AbaProfissionais } from "@/components/plataforma/imobmatch/aba-profissionais";
import { AbaAssinaturasImobMatch } from "@/components/imobmatch-gestao/assinaturas";
import { usePermissao, usePermissoesCarregadas } from "@/hooks/use-permissao";
import { useModeraImobMatch } from "@/hooks/use-permissao-imobmatch";
import { assertModuloPermitido } from "@/lib/route-guards";

const ABAS = ["assinaturas", "profissionais", "anunciantes"] as const;
type Aba = (typeof ABAS)[number];
const ROTULO: Record<Aba, string> = {
  assinaturas: "Planos Pro e assinaturas",
  profissionais: "Profissionais (CRECI)",
  anunciantes: "Anunciantes e compradores",
};

/**
 * ImobMatch Gestão › Profissionais e anunciantes: as assinaturas do Pro avulso e dos
 * anunciantes particulares (0460), a verificação de CRECI e a lista de anunciantes e
 * compradores (0283). As duas últimas são da moderação; as assinaturas também abrem para o
 * Financeiro do ImobMatch.
 */
export const Route = createFileRoute("/_authenticated/imobmatch/profissionais")({
  head: () => ({ meta: [{ title: "Profissionais e anunciantes — ImobMatch Gestão — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba:
      typeof s.aba === "string" && (ABAS as readonly string[]).includes(s.aba)
        ? (s.aba as Aba)
        : undefined,
  }),
  beforeLoad: () =>
    assertModuloPermitido("imobmatch.moderacao", ["saas.imobmatch", "imobmatch.financeiro"]),
  component: Pagina,
});

function Pagina() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const moderar = useModeraImobMatch("view");
  const carregadas = usePermissoesCarregadas();
  const financeiro = usePermissao("imobmatch.financeiro", "view");
  const abas = ABAS.filter((a) => a === "assinaturas" || moderar || !carregadas);
  const aba: Aba = busca.aba && abas.includes(busca.aba) ? busca.aba : "assinaturas";
  const irPara = (a: Aba) => void navigate({ search: { aba: a }, replace: true });

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Profissionais e anunciantes"
        icone={<BadgeCheck />}
        descricao={
          moderar
            ? "Quem assina o Pro avulso e quem anuncia como particular, a conferência do CRECI dos profissionais e a lista de anunciantes e compradores."
            : "Quem assina o Pro avulso e quem anuncia como particular: plano, prazo de acesso, renovação pela loja e cancelamentos."
        }
      />
      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        {abas.length > 1 && (
          <div
            data-tour="imobmatch-profissionais-abas"
            className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0"
          >
            <TabsList className="h-auto min-h-10 w-max">
              {abas.map((a) => (
                <TabsTrigger key={a} value={a} className="min-h-11 sm:min-h-8">
                  {ROTULO[a]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}
        <TabsContent value="assinaturas" className="mt-4">
          <AbaAssinaturasImobMatch />
          {!financeiro && (
            <p className="mt-3 text-xs text-muted-foreground">
              Datas de pagamento e valores ficam com quem tem o Financeiro do ImobMatch.
            </p>
          )}
        </TabsContent>
        {moderar && (
          <>
            <TabsContent value="profissionais" className="mt-4">
              <AbaProfissionais />
            </TabsContent>
            <TabsContent value="anunciantes" className="mt-4">
              <AbaAnunciantes />
            </TabsContent>
          </>
        )}
      </Tabs>
    </PaginaGestao>
  );
}
