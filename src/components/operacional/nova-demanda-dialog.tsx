import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Paperclip, X, FileText, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { criarDemanda, registrarAnexoDemanda } from "@/lib/operacional/demandas.functions";
import { listarColegas, buscarClientesOpcoes } from "@/lib/operacional/shared.functions";

interface OpcaoId {
  id: string;
  label: string;
}

function ComboSelect({
  value,
  onValueChange,
  options,
  placeholder,
  emptyText,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: OpcaoId[];
  placeholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !selecionado && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selecionado ? selecionado.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.label}
                  onSelect={() => {
                    onValueChange(o.id === value ? "" : o.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const TIPOS = [
  { v: "diversos", l: "Diversos" },
  { v: "simulacao", l: "Simulação" },
];

export function NovaDemandaDialog({ onCriada, trigger }: { onCriada: () => void; trigger?: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("diversos");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dadosSimulacao, setDadosSimulacao] = useState("");
  const [prioridade, setPrioridade] = useState<"p1" | "p2" | "p3">("p2");
  const [responsavel, setResponsavel] = useState("");
  const [cliente, setCliente] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const criarFn = useServerFn(criarDemanda);
  const registrarAnexoFn = useServerFn(registrarAnexoDemanda);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSimulacao = tipo === "simulacao";

  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    enabled: aberto,
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-opcoes"],
    queryFn: () => buscarClientesOpcoes({ data: {} }),
    enabled: aberto,
  });

  function limpar() {
    setTipo("diversos");
    setTitulo("");
    setDescricao("");
    setDadosSimulacao("");
    setPrioridade("p2");
    setResponsavel("");
    setCliente("");
    setArquivos([]);
  }

  function adicionarArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const novos = Array.from(e.target.files ?? []);
    if (novos.length) setArquivos((prev) => [...prev, ...novos]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function salvar() {
    if (titulo.trim().length < 2) return toast.error("Informe um título.");
    if (!responsavel) return toast.error("Selecione o responsável.");
    setSalvando(true);
    try {
      const { id } = await criarFn({
        data: {
          tipo,
          titulo,
          descricao: descricao || undefined,
          dados_simulacao: isSimulacao && dadosSimulacao.trim() ? dadosSimulacao : undefined,
          prioridade,
          responsavel_id: responsavel,
          cliente_id: cliente || undefined,
        },
      });

      // Envia os documentos anexados (quando for simulação).
      for (const file of arquivos) {
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("demanda-anexos").upload(path, file);
        if (error) throw error;
        await registrarAnexoFn({
          data: { demanda_id: id, nome: file.name, storage_path: path, tamanho: file.size },
        });
      }

      toast.success("Demanda enviada.");
      setAberto(false);
      limpar();
      onCriada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setSalvando(false);
    }
  }


  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nova demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar demanda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">P1 — Alta</SelectItem>
                  <SelectItem value="p2">P2 — Média</SelectItem>
                  <SelectItem value="p3">P3 — Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Analisar documento X"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>

          {isSimulacao && (
            <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Calculator className="h-4 w-4" /> Dados da simulação
              </div>
              <div className="space-y-1.5">
                <Label>Digite os dados para o analista realizar</Label>
                <Textarea
                  value={dadosSimulacao}
                  onChange={(e) => setDadosSimulacao(e.target.value)}
                  rows={4}
                  placeholder="Ex.: Valor do imóvel, renda, prazo desejado, banco preferido, observações…"
                />
              </div>
              <div className="space-y-2">
                <Label>Ou anexe documentos</Label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={adicionarArquivos}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="mr-1.5 h-4 w-4" /> Anexar documentos
                </Button>
                {arquivos.length > 0 && (
                  <ul className="space-y-1.5">
                    {arquivos.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setArquivos((prev) => prev.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável (destinatário)</Label>
              <ComboSelect
                value={responsavel}
                onValueChange={setResponsavel}
                options={(colegas ?? []).map((c) => ({
                  id: c.id,
                  label: c.nome ?? c.email ?? "",
                }))}
                placeholder="Selecione"
                emptyText="Nenhum responsável encontrado."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente-alvo (opcional)</Label>
              <ComboSelect
                value={cliente}
                onValueChange={setCliente}
                options={(clientes ?? []).map((c) => ({
                  id: c.id,
                  label: c.nome ?? c.numero_cliente ?? "",
                }))}
                placeholder="Nenhum"
                emptyText="Nenhum cliente encontrado."
              />
            </div>

          </div>
          <p className="text-xs text-muted-foreground">
            O prazo (SLA) é calculado automaticamente em horas úteis conforme o tipo e a prioridade.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            Enviar demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
