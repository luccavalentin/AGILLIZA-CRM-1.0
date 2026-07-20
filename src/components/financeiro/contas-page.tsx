import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  excluirConta,
  listarConfigs,
  listarContas,
  resumoContas,
  type ContaTipo,
} from "@/lib/financeiro/financeiro.functions";
import { BaixarDialog } from "@/components/financeiro/baixar-dialog";
import { ContaDrawer } from "@/components/financeiro/conta-drawer";
import { EstornarDialog } from "@/components/financeiro/estornar-dialog";

import { AlertExcluirConta } from "./contas/alert-excluir-conta";
import { ContasCardsMobile } from "./contas/contas-cards-mobile";
import { ContasFiltros } from "./contas/contas-filtros";
import { ContasHeader } from "./contas/contas-header";
import { ContasKpis } from "./contas/contas-kpis";
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
  const [excluirAlvo, setExcluirAlvo] = useState<{ id: string; numero: string } | null>(null);

  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirConta);

  async function handleExcluir() {
    if (!excluirAlvo) return;
    try {
      await excluir({ data: { tipo, id: excluirAlvo.id } });
      toast.success("Conta excluída.");
      queryClient.invalidateQueries({ queryKey: ["fin-contas"] });
    } catch {
      toast.error("Não foi possível excluir a conta.");
    } finally {
      setExcluirAlvo(null);
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
    onBaixar: (c: ContaItem) => setBaixarConta(c),
    onEstornar: (id: string) => setEstorno({ id, acao: "estornar" }),
    onCancelar: (id: string) => setEstorno({ id, acao: "cancelar" }),
    onExcluir: (c: ContaItem) => setExcluirAlvo({ id: c.id, numero: c.numero ?? "" }),
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-3 sm:p-4 md:p-6">
      <ContasHeader tipo={tipo} />

      <ContasKpis tipo={tipo} resumo={resumo} />

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

      <ContasTabela tipo={tipo} itens={itens} isLoading={isLoading} acoes={acoes} />
      <ContasCardsMobile tipo={tipo} itens={itens} isLoading={isLoading} acoes={acoes} />

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
