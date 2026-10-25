/**
 * Aba "Anúncios em revisão": o mesmo endereço anunciado por duas contas (0259). A equipe
 * compara as fichas lado a lado — fotos, conta, autorização do proprietário — e decide
 * qual fica. A decisão vale para o endereço: republicar depois não volta para cá.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCheck, Copy, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import { cn } from "@/lib/utils";
import {
  lerRevisao,
  resolverRevisao,
  type ItemRevisao,
} from "@/lib/plataforma/imobmatch.functions";
import { CampoMotivo, Carregando, FichaDoAnuncio, Vazio } from "./comum";

export const CHAVE_IMOBMATCH = ["plataforma-imobmatch"];

type Decisao = "publicar" | "manter_outro" | "trocar";

const DECISOES: { id: Decisao; titulo: string; texto: string; icone: typeof CheckCheck }[] = [
  {
    id: "manter_outro",
    titulo: "Fica o que já estava no ar",
    texto: "Este sai como duplicado. O anunciante lê o motivo e não republica.",
    icone: Copy,
  },
  {
    id: "trocar",
    titulo: "Fica este",
    texto: "Este vai ao ar e o outro sai como duplicado.",
    icone: ArrowLeftRight,
  },
  {
    id: "publicar",
    titulo: "Os dois podem ficar",
    texto: "Ex.: duas imobiliárias com autorização do proprietário. Os dois ficam no ar.",
    icone: CheckCheck,
  },
];

export function AbaRevisao() {
  const lerFn = useServerFn(lerRevisao);
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "revisao", pagina],
    queryFn: () => lerFn({ data: { pagina } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });

  if (q.isLoading) return <Carregando />;
  if (q.isError)
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler os anúncios em revisão.")}
      </p>
    );
  const itens = q.data?.itens ?? [];
  if (itens.length === 0)
    return (
      <Vazio
        icone={<ScanSearch className="size-5" aria-hidden />}
        titulo="Nenhum anúncio em revisão"
        texto="Quando duas contas anunciarem o mesmo endereço sem autorização exclusiva, o segundo anúncio espera aqui a decisão da equipe."
      />
    );

  return (
    <div className="space-y-6">
      {itens.map((i) => (
        <Revisao key={i.anuncio.id} item={i} />
      ))}
      <div className="rounded-lg border border-border bg-card">
        <RodapePaginas
          pagina={pagina}
          porPagina={q.data?.por_pagina ?? 20}
          quantidade={itens.length}
          total={q.data?.total}
          carregando={q.isFetching}
          onPagina={setPagina}
        />
      </div>
    </div>
  );
}

function Revisao({ item }: { item: ItemRevisao }) {
  const podeDecidir = usePermissao("saas.imobmatch", "edit");
  const qc = useQueryClient();
  const resolverFn = useServerFn(resolverRevisao);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [motivo, setMotivo] = useState("");
  const outroNoAr = item.outros.some((o) => o.status === "publicado");

  const aplicar = useMutation({
    mutationFn: () =>
      resolverFn({ data: { anuncioId: item.anuncio.id, decisao: decisao!, motivo } }),
    onSuccess: () => {
      toast.success(
        decisao === "manter_outro"
          ? "Decidido: ficou o anúncio que já estava no ar."
          : decisao === "trocar"
            ? "Decidido: este anúncio foi ao ar e o outro saiu."
            : "Decidido: os dois anúncios ficam no ar.",
      );
      qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível decidir a revisão.")),
  });

  const motivoOk = motivo.trim().length === 0 || motivo.trim().length >= 10;

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card/60 p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Mesmo endereço · {item.anuncio.bairro ?? item.anuncio.cidade ?? "sem bairro"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {item.outros.length + 1} anúncios para comparar
        </p>
      </header>
      <div
        className={cn(
          "grid gap-3",
          item.outros.length > 0 ? "md:grid-cols-2" : "",
          item.outros.length > 1 ? "xl:grid-cols-3" : "",
        )}
      >
        <FichaDoAnuncio f={item.anuncio} rotulo="Pediu para entrar" destaque />
        {item.outros.map((o) => (
          <FichaDoAnuncio
            key={o.id}
            f={o}
            rotulo={o.status === "publicado" ? "Já está no ar" : "Mesmo endereço"}
          />
        ))}
      </div>

      {podeDecidir ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div
            role="radiogroup"
            aria-label="Decisão da revisão"
            className="grid gap-2 sm:grid-cols-3"
          >
            {DECISOES.map((d) => {
              const desabilitada = d.id === "manter_outro" && !outroNoAr;
              const Icone = d.icone;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={decisao === d.id}
                  disabled={desabilitada}
                  onClick={() => setDecisao(d.id)}
                  className={cn(
                    "flex min-h-11 items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    decisao === d.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <Icone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">{d.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {desabilitada ? "O outro anúncio já saiu do ar." : d.texto}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {decisao && (
            <CampoMotivo
              id={`motivo-rev-${item.anuncio.id}`}
              valor={motivo}
              onValor={setMotivo}
              obrigatorio={false}
              dica={
                decisao === "publicar"
                  ? "Ex.: as duas imobiliárias mostraram autorização do proprietário."
                  : "Sem texto, o anunciante que sai lê: “Duplicado: este endereço já está anunciado por outra conta”."
              }
            />
          )}
          <div className="flex justify-end">
            <Button
              disabled={!decisao || !motivoOk || aplicar.isPending}
              onClick={() => aplicar.mutate()}
              className="w-full sm:w-auto"
            >
              {aplicar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Aplicar decisão
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Você pode ver a revisão, mas não decidir.
        </p>
      )}
    </section>
  );
}
