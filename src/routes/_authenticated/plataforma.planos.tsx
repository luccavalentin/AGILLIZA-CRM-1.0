import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Coins, Gauge, Store, Tags, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  BarraFiltros,
  CabecalhoGestao,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  PaginaGestao,
} from "@/components/plataforma/kit";
import { AbaComContagem, TrilhoAbas } from "@/components/plataforma/receita/comum";
import { CartaoPlano, GavetaPlano, NovoPlano } from "@/components/plataforma/planos/plano";
import { CartaoCusto, LinhaPacote, LinhaSla } from "@/components/plataforma/planos/creditos";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerCatalogoPlanos } from "@/lib/plataforma/planos.functions";

export const Route = createFileRoute("/_authenticated/plataforma/planos")({
  head: () => ({ meta: [{ title: "Planos, preços e créditos — Gestão de sistemas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.planos"),
  component: Pagina,
});

type Publico = "todos" | "corretor" | "imobiliaria" | "parceiro";
type Aba = "planos" | "pacotes" | "custos" | "sla";

/**
 * Planos, preços e créditos (C53, 26/10/2026): o catálogo como o assinante o vê — cartões
 * com o preço "a partir de" e os períodos à venda, edição numa gaveta em abas —, mais os
 * pacotes de crédito, o custo de cada operação e os prazos de suporte por plano.
 */
function Pagina() {
  const lerFn = useServerFn(lerCatalogoPlanos);
  const q = useQuery({ queryKey: ["plataforma-planos"], queryFn: () => lerFn() });
  const pode = usePermissao("saas.planos", "edit");
  const [aba, setAba] = useState<Aba>("planos");
  const [publico, setPublico] = useState<Publico>("todos");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const planos = q.data?.planos ?? [];
  const pacotes = q.data?.pacotes ?? [];
  // Operações de teste (ex.: "teste_cpf") não são cobradas de ninguém.
  const custos = (q.data?.custos ?? []).filter((c) => !/^teste/i.test(c.operacao));
  const slas = q.data?.slas ?? [];
  // A gaveta acompanha a versão mais recente do plano (depois de salvar).
  const aberto = planos.find((p) => p.id === abertoId) ?? null;

  const contagem = useMemo(() => {
    const c: Record<Publico, number> = { todos: planos.length, corretor: 0, imobiliaria: 0, parceiro: 0 };
    for (const p of planos) if (p.publico in c && p.publico !== "todos") c[p.publico as Publico]++;
    return c;
  }, [planos]);
  const visiveis = planos.filter((p) => publico === "todos" || p.publico === publico || p.publico === "todos");
  const aVenda = planos.filter((p) => p.ativo).length;
  const assinaturas = planos.reduce((s, p) => s + p.assinaturas, 0);

  return (
    <PaginaGestao>
      <CabecalhoGestao
        icone={<Tags />}
        titulo="Planos, preços e créditos"
        descricao="Catálogo dos assinantes. Plano com dias de acesso e à venda aparece na página de vendas: o cliente paga e a conta fica liberada pelos dias."
        acoes={pode ? <NovoPlano /> : undefined}
      />

      {q.isError && (
        <div className="rounded-[14px] border border-border/80 bg-card">
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar o catálogo.")}
            onTentar={() => q.refetch()}
          />
        </div>
      )}

      <FaixaIndicadores>
        <Indicador
          rotulo="Planos à venda"
          icone={<Store />}
          tom="sucesso"
          carregando={q.isLoading}
          valor={`${aVenda}`}
          detalhe={`de ${planos.length} no catálogo`}
        />
        <Indicador
          rotulo="Assinaturas ativas"
          icone={<Users />}
          carregando={q.isLoading}
          valor={assinaturas.toLocaleString("pt-BR")}
          detalhe="somando todos os planos"
        />
        <Indicador
          rotulo="Pacotes de crédito"
          icone={<Coins />}
          carregando={q.isLoading}
          valor={`${pacotes.filter((p) => p.ativo).length}`}
          detalhe={`à venda de ${pacotes.length}`}
          onClick={() => setAba("pacotes")}
          ativo={aba === "pacotes"}
        />
        <Indicador
          rotulo="Operações cobradas"
          icone={<Gauge />}
          carregando={q.isLoading}
          valor={`${custos.filter((c) => c.creditos > 0).length}`}
          detalhe={`de ${custos.length} com custo em créditos`}
          onClick={() => setAba("custos")}
          ativo={aba === "custos"}
        />
      </FaixaIndicadores>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="space-y-3">
        <TrilhoAbas>
          <AbaComContagem value="planos" rotulo="Planos" icone={<Tags />} contagem={planos.length} />
          <AbaComContagem value="pacotes" rotulo="Pacotes de crédito" icone={<Coins />} contagem={pacotes.length} />
          <AbaComContagem value="custos" rotulo="Custo por operação" icone={<Gauge />} contagem={custos.length} />
          <AbaComContagem value="sla" rotulo="Prazos de suporte" icone={<Clock3 />} contagem={slas.length} />
        </TrilhoAbas>

        <TabsContent value="planos" className="mt-0 space-y-3">
          <BarraFiltros>
            <ChipsFiltro<Publico>
              rotulo="Para quem é o plano"
              valor={publico}
              onChange={setPublico}
              opcoes={[
                { valor: "todos", rotulo: "Todos", contagem: contagem.todos },
                { valor: "corretor", rotulo: "Corretor", contagem: contagem.corretor },
                { valor: "imobiliaria", rotulo: "Imobiliária", contagem: contagem.imobiliaria },
                { valor: "parceiro", rotulo: "Parceiro", contagem: contagem.parceiro },
              ]}
            />
            <p className="text-xs text-muted-foreground md:ml-auto">
              Tracejado = fora da venda (rascunho ou retirado da vitrine).
            </p>
          </BarraFiltros>
          {q.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-72 rounded-[14px]" />
              ))}
            </div>
          ) : visiveis.length === 0 ? (
            <div className="rounded-[14px] border border-border/80 bg-card">
              <EstadoVazio
                icone={<Tags />}
                titulo="Nenhum plano para este público"
                descricao={pode ? "Crie um em “Novo plano”, no topo da tela." : undefined}
              />
            </div>
          ) : (
            <div data-tour="plataforma-planos-cartoes" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((p) => (
                <CartaoPlano key={p.id} plano={p} pode={pode} onAbrir={() => setAbertoId(p.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pacotes" className="mt-0 space-y-2">
          <p className="px-1 text-sm text-muted-foreground">
            Créditos que o assinante compra para consultas pagas e outras operações.
          </p>
          {pacotes.length === 0 && !q.isLoading ? (
            <div className="rounded-[14px] border border-border/80 bg-card">
              <EstadoVazio icone={<Coins />} titulo="Nenhum pacote de crédito cadastrado" />
            </div>
          ) : (
            pacotes.map((p) => <LinhaPacote key={p.id} pacote={p} pode={pode} />)
          )}
        </TabsContent>

        <TabsContent value="custos" className="mt-0 space-y-2">
          <p className="px-1 text-sm text-muted-foreground">
            Quantos créditos cada operação consome. 0 = gratuita para o assinante.
          </p>
          {custos.length === 0 && !q.isLoading ? (
            <div className="rounded-[14px] border border-border/80 bg-card">
              <EstadoVazio icone={<Gauge />} titulo="Nenhuma operação com custo cadastrado" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {custos.map((c) => (
                <CartaoCusto key={c.operacao} custo={c} pode={pode} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sla" className="mt-0 space-y-2">
          <p className="px-1 text-sm text-muted-foreground">
            Prazo de cada chamado na Central de suporte, pelo plano da conta. A resolução não pode
            ser menor que a primeira resposta.
          </p>
          {slas.length === 0 && !q.isLoading ? (
            <div className="rounded-[14px] border border-border/80 bg-card">
              <EstadoVazio icone={<Clock3 />} titulo="Nenhum prazo de suporte cadastrado" />
            </div>
          ) : (
            slas.map((s) => <LinhaSla key={s.plano_codigo} sla={s} pode={pode} />)
          )}
        </TabsContent>
      </Tabs>

      <GavetaPlano plano={aberto} pode={pode} aoFechar={() => setAbertoId(null)} />
    </PaginaGestao>
  );
}
