import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePermissao, usePermissoesCarregadas } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import {
  listarContasDaFila,
  listarFilaAssinantes,
  ROTULO_PROPOSTA_ASSINANTE,
} from "@/lib/plataforma/fila.functions";
import { AvisoPermissao, MENSAGEM_SEM_FILA } from "./aviso-permissao";
import { PropostasAssinantesInterativas } from "./lista";

export type Aceite = "pendentes" | "minhas" | "todas";
const POR_PAGINA = 50;

const ABAS: { id: Aceite; rotulo: string }[] = [
  { id: "pendentes", rotulo: "Pendentes" },
  { id: "minhas", rotulo: "Minhas" },
  { id: "todas", rotulo: "Todas" },
];

/**
 * A fila de propostas dos assinantes (corretores e imobiliárias): pendentes até um
 * analista assumir ou ser designado. Mora em Operacional › Propostas (aba "Dos
 * assinantes"); o item do menu Plataforma leva para cá.
 */
export function FilaDosAssinantes() {
  const carregadas = usePermissoesCarregadas();
  const pode = usePermissao("saas.fila", "view");
  if (!carregadas) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (!pode)
    return <AvisoPermissao titulo="Fila de propostas dos assinantes" texto={MENSAGEM_SEM_FILA} />;
  return <Fila />;
}

function Fila() {
  const listarFn = useServerFn(listarFilaAssinantes);
  const contasFn = useServerFn(listarContasDaFila);
  const contas = useQuery({
    queryKey: ["plataforma-fila", "contas"],
    queryFn: () => contasFn(),
    staleTime: 5 * 60_000,
  });
  const [aceite, setAceite] = useState<Aceite>("pendentes");
  const [licenca, setLicenca] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setTermo(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPagina(1), [aceite, licenca, status, termo]);

  const consulta = useQuery({
    queryKey: ["plataforma-fila", aceite, licenca, status, termo, pagina],
    queryFn: () =>
      listarFn({
        data: {
          aceite,
          licenca: licenca === "todas" ? null : licenca,
          status: status === "todos" ? null : status,
          termo: termo || null,
          pagina,
        },
      }),
    refetchInterval: 60_000,
    placeholderData: (anterior) => anterior,
  });
  const f = consulta.data?.fila;
  const total = f?.total ?? 0;
  const contador: Record<Aceite, number | undefined> = {
    pendentes: f?.pendentes,
    minhas: f?.minhas,
    todas: undefined,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Propostas enviadas por corretores e imobiliárias, com a simulação que eles já fizeram.
          Abra a proposta para conferir os bancos, os dados e os documentos e use{" "}
          <strong>Enviar para aprovação</strong> no banco escolhido. Ao agir, a proposta passa a ser
          sua.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Esperando analista" valor={f?.pendentes} destaque />
        <Indicador rotulo="Minhas" valor={f?.minhas} />
        <Indicador rotulo="Prazo estourado" valor={f?.atrasadas} alerta={(f?.atrasadas ?? 0) > 0} />
        <Indicador rotulo="Volume da lista" valor={f ? formatBRL(f.volume) : undefined} />
      </div>

      <div
        role="tablist"
        aria-label="Filtro da fila"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:inline-grid sm:w-auto"
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aceite === a.id}
            onClick={() => setAceite(a.id)}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors sm:h-9",
              aceite === a.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
            {contador[a.id] !== undefined && contador[a.id]! > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs tabular-nums text-primary">
                {contador[a.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 md:flex-row">
        <div className="relative flex-1">
          <Label htmlFor="fila-assinantes-busca" className="sr-only">
            Buscar proposta
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="fila-assinantes-busca"
            className="h-11 pl-9 md:h-9"
            placeholder="Código, cliente ou número no banco"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={licenca} onValueChange={setLicenca}>
          <SelectTrigger className="h-11 md:h-9 md:w-56" aria-label="Conta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as contas</SelectItem>
            {(contas.data ?? []).map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 md:h-9 md:w-52" aria-label="Situação da proposta">
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

      <PropostasAssinantesInterativas
        propostas={f?.propostas ?? []}
        carregando={consulta.isLoading}
        erro={
          consulta.isError
            ? mensagemDeErro(consulta.error, "Não foi possível carregar a fila.")
            : null
        }
        vazio={
          aceite === "pendentes"
            ? "Nenhuma proposta esperando um analista."
            : aceite === "minhas"
              ? "Nenhuma proposta com você."
              : "Nenhuma proposta com estes filtros."
        }
      />

      {total > POR_PAGINA && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            className="h-11 md:h-9"
            disabled={pagina === 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {pagina} de {Math.ceil(total / POR_PAGINA)}
          </span>
          <Button
            variant="outline"
            className="h-11 md:h-9"
            disabled={pagina * POR_PAGINA >= total}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  alerta,
  destaque,
}: {
  rotulo: string;
  valor?: number | string;
  alerta?: boolean;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 sm:p-4",
        alerta ? "border-destructive/50" : destaque ? "border-primary/30" : "border-border/60",
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      {valor === undefined ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1 break-words text-lg font-semibold tabular-nums sm:text-2xl">{valor}</p>
      )}
    </div>
  );
}
