import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeletorDeConta } from "@/components/crm/clientes-page/seletor-de-conta";
import { PropostasAssinantesInterativas } from "@/components/plataforma/fila-assinantes/lista";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { listarPropostasDaConta, type ContaAssinante } from "@/lib/plataforma/contas.functions";
import { ROTULO_PROPOSTA_ASSINANTE, type PropostaAssinante } from "@/lib/plataforma/fila.functions";

/**
 * Propostas de uma conta assinante (corretor/imobiliária), no lugar da lista do Agilliza
 * quando o seletor "Conta" aponta para ela — com as mesmas ações da fila (ver a proposta e
 * a simulação do assinante, enviar para aprovação, designar, devolver). Simulações e
 * clientes da conta usam as telas nativas (`conta-nativa/`).
 */
export function OperacoesDaConta({
  conta,
  onConta,
}: {
  /** Mantido por compatibilidade: só propostas usam esta tela. */
  tipo?: "propostas";
  conta: ContaAssinante;
  onConta: (c: ContaAssinante | null) => void;
}) {
  const propFn = useServerFn(listarPropostasDaConta);
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [status, setStatus] = useState("todos");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(q.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPagina(1), [conta.id, status]);

  const consulta = useQuery({
    queryKey: ["conta-operacoes", "propostas", conta.id, termo, status, pagina],
    queryFn: () =>
      propFn({
        data: {
          licenca: conta.id,
          termo: termo || null,
          status: status === "todos" ? null : status,
          pagina,
        },
      }),
    staleTime: 30_000,
  });
  const total = consulta.data?.total ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Propostas</h1>
          <p className="text-sm text-muted-foreground">
            Propostas de {conta.nome} ({conta.tipo === "imobiliaria" ? "imobiliária" : "corretor"}
            ).
          </p>
        </div>
        <SeletorDeConta conta={conta} onConta={onConta} />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Propostas da conta {conta.nome}. Ver, editar e enviar funcionam como na sua base: abra a
          proposta para ver a simulação do assinante e enviar para aprovação.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-xl font-semibold tabular-nums">{consulta.data ? total : "—"}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Volume financiado</p>
          <p className="text-xl font-semibold tabular-nums">
            {consulta.data ? formatBRL(consulta.data.volume) : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 md:flex-row">
        <div className="relative flex-1">
          <Label htmlFor="conta-propostas-busca" className="sr-only">
            Buscar
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="conta-propostas-busca"
            className="h-11 pl-9 md:h-9"
            placeholder="Buscar por código ou cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 md:h-9 md:w-56" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {Object.entries(ROTULO_PROPOSTA_ASSINANTE).map(([v, r]) => (
              <SelectItem key={v} value={v}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mesmas ações da fila: ver a proposta, enviar para aprovação, designar, devolver. */}
      <PropostasAssinantesInterativas
        propostas={(consulta.data?.itens ?? []) as PropostaAssinante[]}
        carregando={consulta.isLoading}
        erro={
          consulta.isError ? mensagemDeErro(consulta.error, "Não foi possível carregar.") : null
        }
        vazio="Nenhuma proposta nesta conta."
        mostrarConta={false}
      />

      {total > 50 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            className="h-11 md:h-8"
            disabled={pagina === 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {pagina} de {Math.ceil(total / 50)}
          </span>
          <Button
            variant="outline"
            className="h-11 md:h-8"
            disabled={pagina * 50 >= total}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
