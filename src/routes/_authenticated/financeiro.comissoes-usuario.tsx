import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Percent, Users } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PanelHeader } from "@/components/common/dashboard";
import { RecalcularComissoesButton } from "@/components/financeiro/comissoes-usuario/recalcular-button";
import { RegrasAbas } from "@/components/financeiro/comissoes-usuario/regras-abas";
import { LancamentosComissoesUsuario } from "@/components/financeiro/comissoes-usuario/lancamentos-tabela";

export const Route = createFileRoute("/_authenticated/financeiro/comissoes-usuario")({
  head: () => ({ meta: [{ title: "Comissões por usuário — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.comissoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">
      Não foi possível carregar as comissões.
    </div>
  ),
});

function Pagina() {
  const [aba, setAba] = useState<"lancamentos" | "regras">("lancamentos");
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:p-6">
      <PanelHeader
        eyebrow="Financeiro · Comissões"
        titulo="Comissões por usuário"
        descricao="Configure regras por corretor, imobiliária, analista, comercial e demais vínculos, e acompanhe os lançamentos gerados a cada contrato emitido."
        actions={<RecalcularComissoesButton />}
      />

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="h-auto gap-1 rounded-xl bg-muted/50 p-1.5 shadow-sm">
          <TabsTrigger
            value="lancamentos"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:shadow-md"
          >
            <Percent className="size-4" /> Lançamentos
          </TabsTrigger>
          <TabsTrigger
            value="regras"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:shadow-md"
          >
            <Users className="size-4" /> Regras por usuário
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lancamentos" className="mt-4">
          <LancamentosComissoesUsuario
            usuarioId={usuarioId}
            onLimparUsuario={() => setUsuarioId(null)}
          />
        </TabsContent>
        <TabsContent value="regras" className="mt-4">
          <RegrasAbas
            onVerLancamentos={(id) => {
              setUsuarioId(id);
              setAba("lancamentos");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

