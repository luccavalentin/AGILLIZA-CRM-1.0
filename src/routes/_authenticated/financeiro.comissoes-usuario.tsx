import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Percent, Users } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comissões por usuário</h1>
        <p className="text-sm text-muted-foreground">
          Configure regras por corretor, imobiliária, analista, comercial e demais vínculos, e
          acompanhe os lançamentos gerados a cada contrato emitido.
        </p>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList>
          <TabsTrigger value="lancamentos" className="gap-2">
            <Percent className="size-4" /> Lançamentos
          </TabsTrigger>
          <TabsTrigger value="regras" className="gap-2">
            <Users className="size-4" /> Regras por usuário
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lancamentos" className="mt-4">
          <LancamentosComissoesUsuario />
        </TabsContent>
        <TabsContent value="regras" className="mt-4">
          <RegrasAbas />
        </TabsContent>
      </Tabs>
    </div>
  );
}
