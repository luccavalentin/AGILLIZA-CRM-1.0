import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Building2,
  Handshake,
  HeartHandshake,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  abrirPortalMaster,
  prepararAcessoMaster,
  type PortalMaster,
} from "@/lib/plataforma/acesso-master.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/acesso-master")({
  head: () => ({ meta: [{ title: "Acesso master — Gestão de Tecnologia — Agilliza" }] }),
  component: AcessoMaster,
});

const PORTAIS: {
  id: PortalMaster;
  titulo: string;
  texto: string;
  icone: LucideIcon;
  tom: TomIcone3D;
}[] = [
  {
    id: "corretor",
    titulo: "Corretor",
    texto: "Conta de demonstração do master no portal do corretor.",
    icone: UserRound,
    tom: "marca",
  },
  {
    id: "imobiliaria",
    titulo: "Imobiliária",
    texto: "Conta de demonstração do master no portal da imobiliária.",
    icone: Building2,
    tom: "violeta",
  },
  {
    id: "parceiro",
    titulo: "Parceiro",
    texto: "Conta de demonstração do master no portal do parceiro.",
    icone: Handshake,
    tom: "ciano",
  },
  {
    id: "cliente",
    titulo: "Cliente",
    texto: "O cliente de demonstração da imobiliária do master.",
    icone: KeyRound,
    tom: "sucesso",
  },
  {
    id: "imobmatch",
    titulo: "ImobMatch",
    texto: "O comprador de demonstração do master no portal ImobMatch.",
    icone: HeartHandshake,
    tom: "perigo",
  },
];

/**
 * Acesso master (0581): o login adm@agilliza.net.br abre todos os portais. Cada cartão pede
 * uma entrada de uso único (2 minutos) e abre o portal já logado, numa aba nova. As contas
 * são de demonstração do próprio master — nenhum dado de assinante aparece por aqui.
 */
function AcessoMaster() {
  const abrirFn = useServerFn(abrirPortalMaster);
  const prepararFn = useServerFn(prepararAcessoMaster);
  const [abrindo, setAbrindo] = useState<PortalMaster | null>(null);

  const abrir = useMutation({
    mutationFn: async (portal: PortalMaster) => {
      setAbrindo(portal);
      // A aba abre no clique (o navegador não bloqueia) e recebe o endereço quando chega.
      const aba = window.open("about:blank", "_blank");
      try {
        const r = await abrirFn({ data: { portal } });
        if (aba) aba.location.href = r.url;
        else window.location.href = r.url;
      } catch (e) {
        aba?.close();
        throw e;
      }
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível abrir o portal.")),
    onSettled: () => setAbrindo(null),
  });

  const preparar = useMutation({
    mutationFn: () => prepararFn(),
    onSuccess: (r) =>
      toast.success(
        r.criado
          ? "Acesso master preparado. Usuário e senha: o seu e-mail."
          : "Senha do acesso master refeita: de novo o seu e-mail.",
      ),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível preparar o acesso master.")),
  });

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 px-3 py-5 sm:px-6">
      <PageHeader
        secao="Gestão de Tecnologia"
        titulo="Acesso master"
        descricao="Um login só para todos os portais. Usuário e senha: adm@agilliza.net.br. Também entra direto pelo login de cada portal."
        icone={<ShieldCheck />}
        acoes={
          <Button
            data-tour="acesso-master-preparar"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            onClick={() => preparar.mutate()}
            disabled={preparar.isPending}
          >
            {preparar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Preparar ou refazer a senha
          </Button>
        }
      />

      <div data-tour="acesso-master-portais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PORTAIS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => abrir.mutate(p.id)}
            disabled={abrir.isPending}
            className="group flex min-h-24 items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:opacity-60"
          >
            <Icone3D icone={p.icone} tom={p.tom} tamanho="lg" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                {p.titulo}
                {abrindo === p.id ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                )}
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                {p.texto}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Cada abertura usa um link que vale uma vez, por 2 minutos, e fica registrada na auditoria. O
        correspondente você já está usando: é este login.
      </p>
    </div>
  );
}
