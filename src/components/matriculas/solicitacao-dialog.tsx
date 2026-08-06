import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Combobox, AsyncCombobox } from "@/components/ui/combobox";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import { maskBRLInput, maskBRLCents, parseBRL } from "@/lib/simulacao/format";
import {
  atualizarSolicitacaoMatricula,
  criarSolicitacaoMatricula,
  listarUsuariosCorrespondente,
  type MatriculaSolicitacao,
} from "@/lib/matriculas/matriculas.functions";

const hoje = () => new Date().toISOString().slice(0, 10);

export function SolicitacaoDialog({
  onMudou,
  inicial,
}: {
  onMudou: () => void;
  inicial?: MatriculaSolicitacao;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(inicial?.data_solicitacao ?? hoje());
  const [solicitante, setSolicitante] = useState(inicial?.solicitante ?? "");
  const [corretor, setCorretor] = useState(inicial?.corretor ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente ?? "");
  const [numero, setNumero] = useState(inicial?.numero_matricula ?? "");
  const [valor, setValor] = useState(inicial?.valor ? maskBRLInput(inicial.valor) : "");
  const [reembolsado, setReembolsado] = useState(inicial?.reembolsado ?? false);
  const [dataPagto, setDataPagto] = useState(inicial?.data_pagto_reembolso ?? "");
  const [obs, setObs] = useState(inicial?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  const { data: usuarios } = useQuery({
    queryKey: ["matriculas-usuarios"],
    queryFn: () => listarUsuariosCorrespondente(),
    staleTime: 5 * 60 * 1000,
  });
  const nomesUsuarios = useMemo(() => (usuarios ?? []).map((u) => u.nome), [usuarios]);

  const buscarClientes = useCallback(async (term: string) => {
    const rows = await buscarClientesCRM({ data: { q: term } });
    return (rows ?? []).map((c: any) => ({
      value: c.id,
      label: c.nome,
      description:
        [c.documento, c.email].filter(Boolean).join(" · ") || undefined,
    }));
  }, []);

  function reset() {
    setData(inicial?.data_solicitacao ?? hoje());
    setSolicitante(inicial?.solicitante ?? "");
    setCorretor(inicial?.corretor ?? "");
    setCliente(inicial?.cliente ?? "");
    setNumero(inicial?.numero_matricula ?? "");
    setValor(inicial?.valor ? maskBRLInput(inicial.valor) : "");
    setReembolsado(inicial?.reembolsado ?? false);
    setDataPagto(inicial?.data_pagto_reembolso ?? "");
    setObs(inicial?.observacao ?? "");
  }

  async function salvar() {
    if (!solicitante.trim()) {
      toast.error("Informe o solicitante.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        data_solicitacao: data,
        solicitante: solicitante.trim(),
        corretor: corretor.trim() || null,
        cliente: cliente.trim() || null,
        numero_matricula: numero.trim() || null,
        valor: parseBRL(valor),
        reembolsado,
        data_pagto_reembolso: reembolsado ? dataPagto || null : null,
        observacao: obs.trim() || null,
      };
      if (inicial) await atualizarSolicitacaoMatricula({ data: { ...payload, id: inicial.id } });
      else await criarSolicitacaoMatricula({ data: payload });
      toast.success(inicial ? "Solicitação atualizada." : "Solicitação registrada.");
      setOpen(false);
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        {inicial ? (
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nova solicitação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar solicitação" : "Nova solicitação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Data da solicitação</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor pago</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(maskBRLCents(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Operador</Label>
            <Combobox
              value={solicitante}
              onValueChange={setSolicitante}
              options={nomesUsuarios}
              placeholder="Selecione o operador"
              searchPlaceholder="Buscar operador…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Solicitante</Label>
              <Combobox
                value={corretor}
                onValueChange={setCorretor}
                options={nomesUsuarios}
                placeholder="Nome do solicitante"
                searchPlaceholder="Buscar solicitante…"
              />
            </div>
            <div className="space-y-1">
              <Label>Nº da matrícula</Label>
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex.: 52592"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Cliente</Label>
            <AsyncCombobox
              value={cliente}
              onValueChange={(v) => setCliente(v)}
              onSearch={buscarClientes}
              placeholder="Selecione o cliente do CRM"
              searchPlaceholder="Nome, CPF/CNPJ ou e-mail…"
              emptyText="Nenhum cliente encontrado."
            />
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Switch checked={reembolsado} onCheckedChange={setReembolsado} />
            <Label className="cursor-pointer" onClick={() => setReembolsado((v) => !v)}>
              Reembolso recebido do corretor
            </Label>
          </div>
          {reembolsado && (
            <div className="space-y-1">
              <Label>Data do reembolso</Label>
              <Input type="date" value={dataPagto} onChange={(e) => setDataPagto(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
