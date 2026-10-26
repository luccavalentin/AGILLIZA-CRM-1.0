import { AdminHero } from "@/components/admin/admin-hero";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  Search,
  ShieldCheck,
  Wallet,
  X,
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
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { Icone3D } from "@/components/ui/icone-3d";
import {
  AbasSituacao,
  CartaoPedido,
  SeloStatusCompra,
  SubNavCompras,
  brl,
} from "@/components/compras/compras-ui";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { resumoCompras } from "@/lib/admin/compras-regras";
import { listarCompras, decidirCompra, type CompraLinha } from "@/lib/admin/compras.functions";

export const Route = createFileRoute("/_authenticated/admin/compras/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovação de compras — Agilliza" }] }),
  // Ver = módulo; aprovar/recusar = "edit" (escondido abaixo; o servidor confere).
  beforeLoad: () => assertModuloPermitido("admin.compras.aprovacoes", ["admin.compras"]),
  component: Pagina,
});

type Aba = "pendente" | "aprovada" | "recusada" | "todas";

/**
 * Diversos > Aprovação de compras (C67, 26/10/2026): fila de pedidos aguardando, com o
 * valor em jogo; aprovar com observação opcional e RECUSAR com motivo obrigatório (o
 * servidor também exige); histórico de quem decidiu, quando e por quê.
 */
function Pagina() {
  const qc = useQueryClient();
  const podeDecidir = usePermissao("admin.compras.aprovacoes", "edit");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("pendente");
  const [dialogo, setDialogo] = useState<{ compra: CompraLinha; aprovar: boolean } | null>(null);
  const [observacao, setObservacao] = useState("");

  const q = useQuery({ queryKey: ["admin-compras"], queryFn: () => listarCompras() });
  const todas = q.data ?? [];
  const resumo = useMemo(() => resumoCompras(todas), [todas]);
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (
      todas
        .filter((c) => aba === "todas" || c.status === aba)
        .filter((c) =>
          t
            ? `${c.descricao} ${c.categoria ?? ""} ${c.solicitante_nome ?? ""} ${c.numero ?? ""}`
                .toLowerCase()
                .includes(t)
            : true,
        )
        // Na fila, o mais antigo primeiro (quem espera há mais tempo).
        .sort((a, b) =>
          aba === "pendente"
            ? a.created_at.localeCompare(b.created_at)
            : b.created_at.localeCompare(a.created_at),
        )
    );
  }, [todas, aba, busca]);

  const motivoOk = dialogo?.aprovar || observacao.trim().length >= 5;
  const decidir = useMutation({
    mutationFn: (v: { id: string; aprovar: boolean; observacao: string | null }) =>
      decidirCompra({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.aprovar ? "Pedido aprovado." : "Pedido recusado.");
      qc.invalidateQueries({ queryKey: ["admin-compras"] });
      setDialogo(null);
      setObservacao("");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar a decisão.")),
  });

  const abrir = (compra: CompraLinha, aprovar: boolean) => {
    setObservacao("");
    setDialogo({ compra, aprovar });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:p-4 md:space-y-6 md:p-6">
      <AdminHero
        secao="Diversos"
        tom="sucesso"
        icon={<ShieldCheck className="h-5 w-5" />}
        titulo="Aprovação de compras"
        descricao="Decida os pedidos da equipe: aprovar com observação ou recusar com o motivo, que fica no histórico."
      />
      <SubNavCompras />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador3D
          destaque
          icone={Hourglass}
          tom="alerta"
          rotulo="Aguardando decisão"
          valor={resumo.pendentes}
          detalhe={
            resumo.pendentes
              ? `mais antigo de ${new Date(
                  [...todas]
                    .filter((c) => c.status === "pendente")
                    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at,
                ).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
              : "fila zerada"
          }
          carregando={q.isLoading}
          onClick={() => setAba("pendente")}
        />
        <Indicador3D
          icone={Wallet}
          tom="marca"
          rotulo="Valor aguardando"
          natureza="R$"
          valor={brl(resumo.valorPendente)}
          carregando={q.isLoading}
          onClick={() => setAba("pendente")}
        />
        <Indicador3D
          icone={CheckCircle2}
          tom="sucesso"
          rotulo="Aprovados"
          valor={resumo.aprovadas}
          detalhe={brl(resumo.valorAprovado)}
          carregando={q.isLoading}
          onClick={() => setAba("aprovada")}
        />
        <Indicador3D
          icone={XCircle}
          tom="perigo"
          rotulo="Recusados"
          valor={resumo.recusadas}
          detalhe="com motivo registrado"
          carregando={q.isLoading}
          onClick={() => setAba("recusada")}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AbasSituacao
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { id: "pendente", texto: "Aguardando", n: resumo.pendentes },
            { id: "aprovada", texto: "Aprovados", n: resumo.aprovadas },
            { id: "recusada", texto: "Recusados", n: resumo.recusadas },
            { id: "todas", texto: "Todos", n: resumo.total },
          ]}
        />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar solicitante, descrição ou nº"
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
        <Estado3D tipo="carregando" titulo="Carregando os pedidos" compacto />
      ) : filtradas.length === 0 ? (
        <Estado3D
          icone={ClipboardCheck}
          tom={aba === "pendente" ? "sucesso" : "neutro"}
          titulo={aba === "pendente" ? "Nenhum pedido aguardando" : "Nenhum pedido nesta visão"}
          descricao={
            aba === "pendente"
              ? "Tudo decidido. Os pedidos novos da equipe aparecem aqui."
              : "Mude a situação ou limpe a busca."
          }
        />
      ) : (
        <div className="compra-lista">
          {filtradas.map((c) => (
            <CartaoPedido
              key={c.id}
              pedido={c}
              mostrarSolicitante
              acoes={
                podeDecidir && c.status === "pendente" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => abrir(c, false)}>
                      <X className="mr-1.5 size-4 text-destructive" /> Recusar
                    </Button>
                    <Button size="sm" onClick={() => abrir(c, true)}>
                      <Check className="mr-1.5 size-4" /> Aprovar
                    </Button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader className="dialogo-cabecalho">
            <DialogTitle className="flex items-center gap-3">
              <Icone3D
                icone={dialogo?.aprovar ? CheckCircle2 : XCircle}
                tom={dialogo?.aprovar ? "sucesso" : "perigo"}
                tamanho="md"
              />
              {dialogo?.aprovar ? "Aprovar pedido" : "Recusar pedido"}
            </DialogTitle>
            <DialogDescription>
              {dialogo?.aprovar
                ? "A aprovação fica no histórico com o seu nome."
                : "O motivo é obrigatório e o solicitante vê no histórico do pedido."}
            </DialogDescription>
          </DialogHeader>
          {dialogo && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium break-words">{dialogo.compra.descricao}</p>
                  <SeloStatusCompra status={dialogo.compra.status} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  {dialogo.compra.solicitante_nome ?? "Solicitante"} ·{" "}
                  <b className="text-foreground tabular-nums">{brl(dialogo.compra.valor)}</b>
                  {dialogo.compra.categoria ? ` · ${dialogo.compra.categoria}` : ""}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs">
                  {dialogo.aprovar ? "Observação (opcional)" : "Motivo da recusa"}
                </Label>
                <Textarea
                  id="obs"
                  rows={3}
                  maxLength={500}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  aria-invalid={!dialogo.aprovar && observacao.length > 0 && !motivoOk}
                  placeholder={
                    dialogo.aprovar
                      ? "Ex.: Aprovado dentro do orçamento do mês."
                      : "Ex.: Fora do orçamento deste mês; refaça em novembro."
                  }
                />
                {!dialogo.aprovar && !motivoOk && (
                  <p className="text-xs text-muted-foreground">Pelo menos 5 caracteres.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="dialogo-rodape">
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button
              variant={dialogo?.aprovar ? "default" : "destructive"}
              disabled={decidir.isPending || !motivoOk}
              onClick={() =>
                dialogo &&
                decidir.mutate({
                  id: dialogo.compra.id,
                  aprovar: dialogo.aprovar,
                  observacao: observacao.trim() || null,
                })
              }
            >
              {decidir.isPending
                ? "Registrando…"
                : dialogo?.aprovar
                  ? "Confirmar aprovação"
                  : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
