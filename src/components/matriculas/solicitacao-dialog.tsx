import { useCallback, useMemo, useState } from "react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";
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
import { hojeISO } from "@/lib/financeiro/format";
import { exibirDocumento } from "@/lib/crm/documento";

const hoje = () => hojeISO();

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
  // Nova = "Matrículas: solicitar"; editar = "Matrículas: editar" (o servidor confere).
  const podeCriar = usePermissao("documentos.matriculas", "create");
  const podeEditar = usePermissao("documentos.matriculas", "edit");

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
        [c.documento ? exibirDocumento(c.documento) : null, c.email].filter(Boolean).join(" · ") ||
        undefined,
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

  // Ao marcar o reembolso, a data já vem com hoje (antes ficava em branco).
  function marcarReembolso(v: boolean) {
    setReembolsado(v);
    if (v && !dataPagto) setDataPagto(hoje());
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
      toast.error(mensagemDeErro(e, "Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  }

  if (inicial ? !podeEditar : !podeCriar) return null;

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
              <Label htmlFor="matricula-solicitante">Solicitante</Label>
              {/* Quem pediu costuma ser corretor de fora da equipe: aceita qualquer nome,
                  com a equipe como sugestão (antes só dava para escolher usuários internos). */}
              <Input
                id="matricula-solicitante"
                list="matricula-solicitantes"
                value={corretor}
                onChange={(e) => setCorretor(e.target.value)}
                placeholder="Nome do corretor ou de quem pediu"
                autoComplete="off"
              />
              <datalist id="matricula-solicitantes">
                {nomesUsuarios.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
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
            <Switch
              aria-label="Reembolso recebido do corretor"
              checked={reembolsado}
              onCheckedChange={marcarReembolso}
            />
            <Label className="cursor-pointer" onClick={() => marcarReembolso(!reembolsado)}>
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
