import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Minus,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Selo } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import {
  converterTipoLicenca,
  previaConverterTipoLicenca,
  type Licenca,
  type PlanoLicenca,
  type TipoConversivel,
} from "@/lib/plataforma/licencas.functions";
import { ROTULO_TIPO } from "./rotulos";

/*
 * Mudar o tipo da conta (0590 do Corretor, pedido do dono de 26/10/2026): corretor ↔
 * imobiliária, mantendo clientes, imóveis, propostas, faturas, créditos, indicação e a
 * situação da licença. Tipo e plano mudam juntos (o plano do tipo novo); o banco diz o que a
 * conta ganha ou perde e o que impede (equipe, convites ou locação em aberto para virar
 * corretor) antes de confirmar. Parceiro não troca de tipo.
 */

const OUTRO: Record<TipoConversivel, TipoConversivel> = {
  corretor: "imobiliaria",
  imobiliaria: "corretor",
};
const ICONE: Record<TipoConversivel, typeof UserRound> = {
  corretor: UserRound,
  imobiliaria: Building2,
};

export function TipoDaLicenca({ licenca, planos }: { licenca: Licenca; planos: PlanoLicenca[] }) {
  const qc = useQueryClient();
  const previaFn = useServerFn(previaConverterTipoLicenca);
  const converterFn = useServerFn(converterTipoLicenca);
  const atual = licenca.tipo as TipoConversivel;
  const novo = OUTRO[atual];
  const planosDoNovo = planos.filter((p) => p.publico === novo);

  const [planoId, setPlanoId] = useState(planosDoNovo.length === 1 ? planosDoNovo[0].id : "");
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const previa = useQuery({
    queryKey: ["plataforma-licenca-previa-tipo", licenca.id, novo],
    queryFn: () => previaFn({ data: { id: licenca.id, tipo: novo } }),
  });
  const p = previa.data;
  const impedida = (p?.impedimentos.length ?? 0) > 0;

  const converter = useMutation({
    mutationFn: () => converterFn({ data: { id: licenca.id, tipo: novo, planoId, motivo } }),
    onSuccess: (r) => {
      toast.success(`A conta agora é ${ROTULO_TIPO[r.tipo].toLowerCase()}, no plano ${r.plano}.`);
      setConfirmar(false);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      qc.invalidateQueries({ queryKey: ["plataforma-licenca", licenca.id] });
      qc.invalidateQueries({ queryKey: ["plataforma-licenca-previa-tipo", licenca.id] });
    },
    onError: (e) => {
      setConfirmar(false);
      toast.error(mensagemDeErro(e, "Não foi possível mudar o tipo da conta."));
    },
  });

  const plano = planosDoNovo.find((x) => x.id === planoId);
  const pronto = !impedida && !!p && !!planoId && motivo.trim().length >= 5 && !converter.isPending;
  const IconeAtual = ICONE[atual];
  const IconeNovo = ICONE[novo];

  return (
    <div className="space-y-3">
      {/* De → para */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <CartaoTipo
          icone={<IconeAtual />}
          rotulo="Hoje"
          tipo={ROTULO_TIPO[atual]}
          plano={licenca.plano}
        />
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        <CartaoTipo
          icone={<IconeNovo />}
          rotulo="Passa a ser"
          tipo={ROTULO_TIPO[novo]}
          plano={plano?.nome ?? null}
          destaque
        />
      </div>

      <Select value={planoId} onValueChange={setPlanoId}>
        <SelectTrigger
          aria-label={`Plano de ${ROTULO_TIPO[novo].toLowerCase()}`}
          className="min-h-11 sm:min-h-9"
        >
          <SelectValue placeholder={`Escolha o plano de ${ROTULO_TIPO[novo].toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {planosDoNovo.map((x) => (
            <SelectItem key={x.id} value={x.id}>
              {x.nome} · {formatBRL(x.preco_mensal)}/mês
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {planosDoNovo.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum plano ativo de {ROTULO_TIPO[novo].toLowerCase()}.
        </p>
      )}

      {/* O que muda */}
      <div className="rounded-lg border border-border/70 bg-secondary/30 p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          O que muda
        </p>
        {previa.isLoading && <Skeleton className="h-16 rounded-md" />}
        {previa.isError && (
          <p className="text-xs text-destructive">
            {mensagemDeErro(previa.error, "Não foi possível calcular a mudança.")}
          </p>
        )}
        {p && (
          <div className="space-y-2 text-sm">
            {p.modulos_ganhos.length > 0 && (
              <ListaModulos
                icone={<Plus />}
                rotulo="Ganha"
                itens={p.modulos_ganhos}
                tom="sucesso"
              />
            )}
            {p.modulos_perdidos.length > 0 && (
              <ListaModulos
                icone={<Minus />}
                rotulo="Deixa de ter"
                itens={p.modulos_perdidos}
                tom="alerta"
              />
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {novo === "imobiliaria"
                ? "Mantém clientes, imóveis, propostas, faturas, créditos, indicação e a situação da licença. O titular entra com o mesmo acesso, já no portal da imobiliária, e pode cadastrar a equipe dentro do limite do plano."
                : "Mantém clientes, imóveis, propostas, faturas, créditos, indicação e a situação da licença. Conta de corretor é só do titular."}
            </p>
            {impedida && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5"
              >
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <CircleAlert className="size-3.5" aria-hidden /> Antes de mudar
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive">
                  {p.impedimentos.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <Textarea
        aria-label="Motivo da mudança de tipo"
        rows={2}
        placeholder="Motivo (fica no histórico da conta)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        disabled={impedida}
      />
      <Button
        size="sm"
        className="min-h-11 w-full sm:min-h-9 sm:w-auto"
        onClick={() => setConfirmar(true)}
        disabled={!pronto}
      >
        Mudar para {ROTULO_TIPO[novo].toLowerCase()}
      </Button>

      <AlertDialog open={confirmar} onOpenChange={(v) => !converter.isPending && setConfirmar(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon>
              <IconeNovo className="size-6" />
            </AlertDialogIcon>
            <AlertDialogTitle>
              Mudar {licenca.nome} para {ROTULO_TIPO[novo].toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A conta passa de {ROTULO_TIPO[atual].toLowerCase()} para{" "}
              {ROTULO_TIPO[novo].toLowerCase()} no plano {plano?.nome ?? "escolhido"}. Os dados e a
              situação da licença ficam como estão; a mudança e o motivo vão para o histórico da
              conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 sm:min-h-9" disabled={converter.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 sm:min-h-9"
              disabled={converter.isPending}
              onClick={(e) => {
                e.preventDefault();
                converter.mutate();
              }}
            >
              {converter.isPending ? "Mudando…" : `Mudar para ${ROTULO_TIPO[novo].toLowerCase()}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CartaoTipo({
  icone,
  rotulo,
  tipo,
  plano,
  destaque,
}: {
  icone: ReactNode;
  rotulo: string;
  tipo: string;
  plano: string | null;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2",
        destaque ? "border-primary/40 bg-primary/5" : "border-border/70",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icone}
        <span className="truncate">{tipo}</span>
      </p>
      <p className="truncate text-xs text-muted-foreground">{plano ?? "—"}</p>
    </div>
  );
}

function ListaModulos({
  icone,
  rotulo,
  itens,
  tom,
}: {
  icone: ReactNode;
  rotulo: string;
  itens: string[];
  tom: "sucesso" | "alerta";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground [&_svg]:size-3">
        {icone}
        {rotulo}
      </span>
      {itens.map((m) => (
        <Selo key={m} tom={tom}>
          {m}
        </Selo>
      ))}
    </div>
  );
}
