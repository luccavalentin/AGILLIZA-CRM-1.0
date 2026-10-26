import { AdminHero } from "@/components/admin/admin-hero";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";
import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Hourglass,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { AbasSituacao, CartaoPedido, SubNavCompras, brl } from "@/components/compras/compras-ui";
import { assertModuloPermitido } from "@/lib/route-guards";
import { getMinhaSessao } from "@/lib/session.functions";
import { lerValor, resumoCompras } from "@/lib/admin/compras-regras";
import {
  listarCompras,
  criarCompra,
  editarCompra,
  excluirCompra,
  type CompraLinha,
} from "@/lib/admin/compras.functions";

export const Route = createFileRoute("/_authenticated/admin/compras/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos de compras — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.compras.pedidos", ["admin.compras"]),
  component: Pagina,
});

type Filtro = "todos" | "pendente" | "aprovada" | "recusada";

/**
 * Diversos > Pedidos de compras (C67, 26/10/2026): quem pede vê os SEUS pedidos em
 * cartões (valor, situação, histórico com quem decidiu e o motivo), envia um pedido novo
 * e edita/exclui só enquanto está aguardando.
 */
function Pagina() {
  const qc = useQueryClient();
  const [formulario, setFormulario] = useState<CompraLinha | "novo" | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const sessao = useQuery({ queryKey: ["minha-sessao"], queryFn: () => getMinhaSessao() });
  const meuId = sessao.data?.profile?.id ?? null;
  // Mesmas alternativas do servidor (criarCompra): o módulo novo ou o legado.
  const podeCriarPedidos = usePermissao("admin.compras.pedidos", "create");
  const podeCriarLegado = usePermissao("admin.compras", "create");
  const podeCriar = podeCriarPedidos || podeCriarLegado;
  const podeEditar = usePermissao("admin.compras.pedidos", "edit");

  const q = useQuery({ queryKey: ["admin-compras"], queryFn: () => listarCompras() });
  const meus = useMemo(
    () => (q.data ?? []).filter((c) => (meuId ? c.solicitante_id === meuId : false)),
    [q.data, meuId],
  );
  const resumo = useMemo(() => resumoCompras(meus), [meus]);
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return meus
      .filter((c) => filtro === "todos" || c.status === filtro)
      .filter((c) =>
        t
          ? `${c.descricao} ${c.categoria ?? ""} ${c.numero ?? ""}`.toLowerCase().includes(t)
          : true,
      );
  }, [meus, filtro, busca]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["admin-compras"] });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:p-4 md:space-y-6 md:p-6">
      <AdminHero
        secao="Diversos"
        icon={<ShoppingCart className="h-5 w-5" />}
        titulo="Pedidos de compras"
        descricao="Peça o que a operação precisa e acompanhe a decisão da gestão, com o motivo e quem decidiu."
        acoes={
          podeCriar && (
            <Button onClick={() => setFormulario("novo")}>
              <Plus className="mr-1.5 size-4" /> Novo pedido
            </Button>
          )
        }
      />
      <SubNavCompras />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador3D
          icone={ShoppingCart}
          rotulo="Meus pedidos"
          valor={resumo.total}
          detalhe="no total"
          carregando={q.isLoading}
          onClick={() => setFiltro("todos")}
        />
        <Indicador3D
          icone={Hourglass}
          tom="alerta"
          rotulo="Aguardando"
          valor={resumo.pendentes}
          detalhe={brl(resumo.valorPendente)}
          carregando={q.isLoading}
          onClick={() => setFiltro("pendente")}
        />
        <Indicador3D
          icone={CheckCircle2}
          tom="sucesso"
          rotulo="Aprovados"
          valor={resumo.aprovadas}
          detalhe={brl(resumo.valorAprovado)}
          carregando={q.isLoading}
          onClick={() => setFiltro("aprovada")}
        />
        <Indicador3D
          icone={XCircle}
          tom="perigo"
          rotulo="Recusados"
          valor={resumo.recusadas}
          detalhe="com o motivo no histórico"
          carregando={q.isLoading}
          onClick={() => setFiltro("recusada")}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AbasSituacao
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { id: "todos", texto: "Todos", n: resumo.total },
            { id: "pendente", texto: "Aguardando", n: resumo.pendentes },
            { id: "aprovada", texto: "Aprovados", n: resumo.aprovadas },
            { id: "recusada", texto: "Recusados", n: resumo.recusadas },
          ]}
        />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar descrição, categoria ou nº"
            aria-label="Buscar pedidos"
            className="pl-9"
          />
        </div>
      </div>

      {q.isError ? (
        <Estado3D
          tipo="erro"
          titulo="Não foi possível carregar os pedidos"
          descricao={mensagemDeErro(q.error, "Tente de novo em instantes.")}
          acao={
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : q.isLoading ? (
        <Estado3D tipo="carregando" titulo="Carregando seus pedidos" compacto />
      ) : lista.length === 0 ? (
        <Estado3D
          icone={PackageSearch}
          titulo={
            meus.length ? "Nenhum pedido neste filtro" : "Você ainda não fez pedidos de compra"
          }
          descricao={
            meus.length
              ? "Mude a situação ou limpe a busca."
              : "Descreva o que precisa, o valor estimado e a justificativa: a gestão aprova ou recusa com o motivo."
          }
          acao={
            !meus.length && podeCriar ? (
              <Button onClick={() => setFormulario("novo")}>
                <Plus className="mr-1.5 size-4" /> Fazer o primeiro pedido
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="compra-lista">
          {lista.map((c) => (
            <CartaoPedido
              key={c.id}
              pedido={c}
              acoes={
                podeEditar && c.status === "pendente" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setFormulario(c)}>
                      <Pencil className="mr-1.5 size-3.5" /> Editar
                    </Button>
                    <ConfirmDelete
                      descricao={`Excluir o pedido “${c.descricao}”? Essa ação não pode ser desfeita.`}
                      onConfirm={async () => {
                        try {
                          await excluirCompra({ data: { id: c.id } });
                          toast.success("Pedido excluído.");
                          recarregar();
                        } catch (e) {
                          toast.error(mensagemDeErro(e, "Não foi possível excluir o pedido."));
                        }
                      }}
                    />
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <FormularioPedido
        alvo={formulario}
        onFechar={() => setFormulario(null)}
        onSalvo={() => {
          setFormulario(null);
          recarregar();
        }}
      />
    </div>
  );
}

/** Pedido novo ou edição de um pendente (o servidor recusa editar o que já foi decidido). */
function FormularioPedido({
  alvo,
  onFechar,
  onSalvo,
}: {
  alvo: CompraLinha | "novo" | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = alvo && alvo !== "novo" ? alvo : null;
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const chave = alvo === null ? null : alvo === "novo" ? "novo" : alvo.id;
  if (chave !== aberto) {
    // Abriu outro alvo: carrega os campos uma vez (sem efeito, sem piscar).
    setAberto(chave);
    setDescricao(editando?.descricao ?? "");
    setValor(editando ? String(editando.valor).replace(".", ",") : "");
    setCategoria(editando?.categoria ?? "");
    setJustificativa("");
  }
  const numero = lerValor(valor);
  const valido = descricao.trim().length >= 3 && numero > 0;

  const salvar = useMutation({
    mutationFn: () => {
      const texto =
        !editando && justificativa.trim()
          ? `${descricao.trim()} — ${justificativa.trim()}`
          : descricao.trim();
      const dados = { descricao: texto, valor: numero, categoria: categoria.trim() || null };
      return editando
        ? editarCompra({ data: { id: editando.id, ...dados } })
        : criarCompra({ data: dados });
    },
    onSuccess: () => {
      toast.success(editando ? "Pedido atualizado." : "Pedido enviado para aprovação.");
      onSalvo();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o pedido.")),
  });

  return (
    <Dialog open={alvo !== null} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader className="dialogo-cabecalho">
          <DialogTitle>{editando ? "Editar pedido" : "Novo pedido de compra"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Só pedidos aguardando aprovação podem mudar."
              : "Vai para a Aprovação de compras; você acompanha a decisão aqui."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">O que precisa ser comprado?</Label>
            <Textarea
              id="c-desc"
              rows={2}
              maxLength={500}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: 4 cadeiras ergonômicas para a sala de atendimento"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="c-valor">Valor estimado (R$)</Label>
              <Input
                id="c-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                aria-invalid={valor.trim() !== "" && !(numero > 0)}
              />
              {valor.trim() !== "" && !(numero > 0) && (
                <p className="text-xs text-destructive">Use só números, ex.: 1.250,00</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-cat">Categoria</Label>
              <Input
                id="c-cat"
                maxLength={60}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex.: Mobiliário, TI, Marketing"
              />
            </div>
          </div>
          {!editando && (
            <div className="space-y-1.5">
              <Label htmlFor="c-just">Justificativa (opcional)</Label>
              <Textarea
                id="c-just"
                rows={3}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Por que essa compra é necessária agora?"
              />
            </div>
          )}
        </div>
        <DialogFooter className="dialogo-rodape">
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !valido}>
            {salvar.isPending ? "Salvando…" : editando ? "Salvar" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
