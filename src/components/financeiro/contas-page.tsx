import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  excluirConta,
  excluirContasEmLote,
  listarConfigs,
  listarContas,
  resumoContas,
  type ContaTipo,
} from "@/lib/financeiro/financeiro.functions";
import { formatData } from "@/lib/financeiro/format";
import { BaixarDialog } from "@/components/financeiro/baixar-dialog";
import { ContaDrawer } from "@/components/financeiro/conta-drawer";
import { EditarContaDialog } from "@/components/financeiro/editar-conta-dialog";
import { EstornarDialog } from "@/components/financeiro/estornar-dialog";

import { AlertExcluirConta } from "./contas/alert-excluir-conta";
import { ContasCardsMobile } from "./contas/contas-cards-mobile";
import { ContasFiltros } from "./contas/contas-filtros";
import { ContasExport } from "./contas/contas-export";
import { ContasHeader } from "./contas/contas-header";
import { ContasKpis } from "./contas/contas-kpis";
import { ContasKpiDialog, type KpiDetalheFiltro } from "./contas/contas-kpi-dialog";
import { ContasTabela, type ContaItem } from "./contas/contas-tabela";

/**
 * Página de contas a pagar/receber. Responsável apenas pela composição
 * das seções (header, KPIs, filtros, listas e diálogos) e pelo estado
 * de UI que orquestra tudo. Cada seção vive em seu próprio módulo em
 * `./contas/*`, mantendo o mesmo layout e comportamento anterior.
 */
export function ContasPage({ tipo }: { tipo: ContaTipo }) {
  const [status, setStatus] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const [baixarConta, setBaixarConta] = useState<ContaItem | null>(null);
  const [estorno, setEstorno] = useState<{ id: string; acao: "estornar" | "cancelar" } | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<{ id: string; numero: string } | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [kpiDetalhe, setKpiDetalhe] = useState<KpiDetalheFiltro | null>(null);
  const [excluindoLote, setExcluindoLote] = useState(false);

  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirConta);
  const excluirLote = useServerFn(excluirContasEmLote);

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["fin-contas"] });
    queryClient.invalidateQueries({ queryKey: ["fin-contas-resumo"] });
    queryClient.invalidateQueries({ queryKey: ["fin-contas-kpi-detalhe"] });
  }

  async function handleExcluir() {
    if (!excluirAlvo) return;
    try {
      await excluir({ data: { tipo, id: excluirAlvo.id } });
      toast.success("Conta excluída.");
      recarregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir a conta.");
    } finally {
      setExcluirAlvo(null);
    }
  }


  async function handleExcluirSelecionadas() {
    if (!selecionados.length) return;
    setExcluindoLote(true);
    try {
      const r = await excluirLote({ data: { tipo, ids: selecionados } });
      toast.success(
        `${r.excluidas} conta(s) excluída(s).` +
          (r.bloqueadas ? ` ${r.bloqueadas} com pagamento não puderam ser excluídas.` : ""),
      );
      setSelecionados([]);
      recarregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir as contas selecionadas.");
    } finally {
      setExcluindoLote(false);
    }
  }


  const { data: cfg } = useQuery({ queryKey: ["fin-configs"], queryFn: () => listarConfigs() });
  const { data, isLoading } = useQuery({
    queryKey: ["fin-contas", tipo, status, categoriaId, busca, de, ate],
    queryFn: () =>
      listarContas({
        data: {
          tipo,
          status: status || undefined,
          categoria_id: categoriaId || undefined,
          contraparte: busca || undefined,
          de: de || undefined,
          ate: ate || undefined,
          pagina: 1,
          porPagina: 50,
        },
      }),
  });

  const { data: resumo } = useQuery({
    queryKey: ["fin-contas-resumo", tipo, status, categoriaId, busca, de, ate],
    queryFn: () =>
      resumoContas({
        data: {
          tipo,
          status: status || undefined,
          categoria_id: categoriaId || undefined,
          contraparte: busca || undefined,
          de: de || undefined,
          ate: ate || undefined,
        },
      }),
  });

  const temFiltro = !!(de || ate || status || categoriaId || busca);
  const itens = (data?.itens ?? []) as ContaItem[];

  const acoes = {
    onDetalhe: (id: string) => setDetalheId(id),
    onEditar: (id: string) => setEditarId(id),
    onBaixar: (c: ContaItem) => setBaixarConta(c),
    onEstornar: (id: string) => setEstorno({ id, acao: "estornar" }),
    onCancelar: (id: string) => setEstorno({ id, acao: "cancelar" }),
    onExcluir: (c: ContaItem) => setExcluirAlvo({ id: c.id, numero: c.numero ?? "" }),
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-3 sm:p-4 md:p-6">
      <ContasHeader
        tipo={tipo}
        extraActions={
          <ContasExport
            tipo={tipo}
            itens={itens}
            resumo={resumo ?? null}
            meta={[
              `Período: ${de ? formatData(de) : "início"} a ${ate ? formatData(ate) : "hoje"}`,
              `Status: ${status || "todos"}`,
              `Registros: ${itens.length}`,
              `Emitido em ${new Date().toLocaleString("pt-BR")}`,
            ]}
          />
        }
      />

      <ContasKpis
        tipo={tipo}
        resumo={resumo}
        onSelecionar={(k) =>
          setKpiDetalhe({
            titulo: k.titulo,
            status: k.status,
            categoria_id: categoriaId || undefined,
            contraparte: busca || undefined,
            de: de || undefined,
            ate: ate || undefined,
          })
        }
      />


      <ContasFiltros
        tipo={tipo}
        status={status}
        onStatus={setStatus}
        categoriaId={categoriaId}
        onCategoriaId={setCategoriaId}
        categorias={(cfg?.categorias ?? []) as Array<{ id: string; nome: string }>}
        de={de}
        onDe={setDe}
        ate={ate}
        onAte={setAte}
        contraparte={contraparte}
        onContraparte={setContraparte}
        onSubmitBusca={() => setBusca(contraparte)}
        temFiltro={temFiltro}
        onLimpar={() => {
          setDe("");
          setAte("");
          setStatus("");
          setCategoriaId("");
          setContraparte("");
          setBusca("");
        }}
      />

      {selecionados.length > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <span className="text-sm font-medium">
            {selecionados.length} conta(s) selecionada(s)
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>
              <X className="mr-1.5 size-4" /> Limpar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={excluindoLote}
              onClick={() => void handleExcluirSelecionadas()}
            >
              {excluindoLote ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-4" />
              )}
              Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      <ContasTabela
        tipo={tipo}
        itens={itens}
        isLoading={isLoading}
        acoes={acoes}
        selecionados={selecionados}
        onToggle={(id) =>
          setSelecionados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
        }
        onToggleTodos={(marcar) => setSelecionados(marcar ? itens.map((i) => i.id) : [])}
      />
      <ContasCardsMobile tipo={tipo} itens={itens} isLoading={isLoading} acoes={acoes} />

      <ContasKpiDialog
        tipo={tipo}
        filtro={kpiDetalhe}
        onOpenChange={(o) => !o && setKpiDetalhe(null)}
        onAbrirConta={(id) => {
          setKpiDetalhe(null);
          setDetalheId(id);
        }}
      />


      <BaixarDialog
        tipo={tipo}
        conta={baixarConta}
        open={!!baixarConta}
        onOpenChange={(o) => !o && setBaixarConta(null)}
      />
      <EstornarDialog
        tipo={tipo}
        acao={estorno?.acao ?? "estornar"}
        contaId={estorno?.id ?? null}
        open={!!estorno}
        onOpenChange={(o) => !o && setEstorno(null)}
      />
      <EditarContaDialog
        tipo={tipo}
        contaId={editarId}
        open={!!editarId}
        onOpenChange={(o) => !o && setEditarId(null)}
      />
      <ContaDrawer
        tipo={tipo}
        contaId={detalheId}
        open={!!detalheId}
        onOpenChange={(o) => !o && setDetalheId(null)}
      />

      <AlertExcluirConta
        alvo={excluirAlvo}
        onCancel={() => setExcluirAlvo(null)}
        onConfirm={() => void handleExcluir()}
      />
    </div>
  );
}
