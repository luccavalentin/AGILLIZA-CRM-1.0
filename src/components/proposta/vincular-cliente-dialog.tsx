import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import { vincularClienteAProposta } from "@/lib/propostas/propostas.functions";
import { formatarDocumento } from "@/lib/crm/documento";

/**
 * Permite VINCULAR um cliente já existente no CRM a uma proposta que ainda não
 * tem vínculo (ex.: simulação/aprovação feita sem setar o cliente).
 * Diferente de "Cadastrar cliente", que cria um novo registro.
 */
export function VincularClienteDialog({ propostaId }: { propostaId: string }) {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const buscar = useServerFn(buscarClientesCRM);
  const vincular = useServerFn(vincularClienteAProposta);

  const termoBusca = termo.trim();
  const { data: resultados, isFetching } = useQuery({
    queryKey: ["buscar-clientes-vincular", termoBusca],
    queryFn: () => buscar({ data: { q: termoBusca } }),
    enabled: open && termoBusca.length >= 2,
  });

  async function vincularCliente(clienteId: string) {
    setSalvandoId(clienteId);
    try {
      await vincular({ data: { proposta_id: propostaId, cliente_id: clienteId } });
      await queryClient.invalidateQueries();
      toast.success("Cliente vinculado à proposta.");
      setOpen(false);
      setTermo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível vincular o cliente.");
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 className="mr-1.5 h-4 w-4" />
          Vincular cliente existente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular cliente existente</DialogTitle>
          <DialogDescription>
            Busque um cliente já cadastrado no CRM por nome, documento ou e-mail e vincule-o a esta
            proposta.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Nome, CPF/CNPJ ou e-mail…"
            className="pl-9"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {termoBusca.length < 2 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Digite ao menos 2 caracteres para buscar.
            </p>
          ) : isFetching ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
            </div>
          ) : !resultados || resultados.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          ) : (
            resultados.map((c: any) => (
              <button
                key={c.id}
                type="button"
                disabled={salvandoId !== null}
                onClick={() => vincularCliente(c.id)}
                className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent disabled:opacity-60"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.documento ? formatarDocumento(c.documento) : "Sem documento"}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
                {salvandoId === c.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
