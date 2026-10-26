/**
 * Aba "Denúncias": o que os compradores denunciaram no portal, agrupado por anúncio (mais
 * denunciados primeiro). Denúncia nunca tira o anúncio do ar sozinha — a equipe julga:
 * procedente modera o anúncio com o motivo; improcedente mantém. Quem denunciou aparece
 * mascarado, com quantas denúncias já fez (para enxergar abuso).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flag, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import { cn } from "@/lib/utils";
import {
  decidirDenuncias,
  lerDenuncias,
  SITUACOES_DENUNCIA,
  type GrupoDenuncias,
  type MotivoDenuncia,
} from "@/lib/plataforma/imobmatch.functions";
import { CHAVE_IMOBMATCH } from "./aba-revisao";
import { CampoMotivo, Carregando, dataHora, FichaDoAnuncio, MOTIVO_DENUNCIA, Vazio } from "./comum";
import { useModeraImobMatch } from "@/hooks/use-permissao-imobmatch";

type Situacao = (typeof SITUACOES_DENUNCIA)[number];
const ROTULO: Record<Situacao, string> = {
  abertas: "A julgar",
  decididas: "Julgadas",
  todas: "Todas",
};

export function AbaDenuncias() {
  const lerFn = useServerFn(lerDenuncias);
  const [situacao, setSituacao] = useState<Situacao>("abertas");
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "denuncias", situacao, pagina],
    queryFn: () => lerFn({ data: { situacao, pagina } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });
  const itens = q.data?.itens ?? [];

  return (
    <div className="space-y-4">
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Situação das denúncias"
      >
        {SITUACOES_DENUNCIA.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={situacao === s ? "default" : "outline"}
            aria-pressed={situacao === s}
            className="shrink-0 rounded-full"
            onClick={() => {
              setSituacao(s);
              setPagina(1);
            }}
          >
            {ROTULO[s]}
          </Button>
        ))}
      </div>

      {q.isLoading ? (
        <Carregando />
      ) : q.isError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler as denúncias.")}
        </p>
      ) : itens.length === 0 ? (
        <Vazio
          icone={<ShieldCheck className="size-5" aria-hidden />}
          titulo={situacao === "abertas" ? "Nenhuma denúncia a julgar" : "Nada por aqui"}
          texto="Quando um comprador denunciar um anúncio pelo botão “Denunciar anúncio” do portal, ele aparece aqui para a equipe julgar."
        />
      ) : (
        <>
          {itens.map((g) => (
            <Grupo key={g.anuncio.id} g={g} />
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
        </>
      )}
    </div>
  );
}

function Grupo({ g }: { g: GrupoDenuncias }) {
  const podeJulgar = useModeraImobMatch("edit");
  const qc = useQueryClient();
  const decidirFn = useServerFn(decidirDenuncias);
  const [decisao, setDecisao] = useState<"procedente" | "improcedente" | null>(null);
  const [motivo, setMotivo] = useState("");
  const motivos = Object.entries(g.motivos).sort((a, b) => Number(b[1]) - Number(a[1])) as [
    MotivoDenuncia,
    number,
  ][];
  const exigeMotivo = decisao === "procedente";
  const tam = motivo.trim().length;
  // O banco aceita motivo vazio no improcedente; escrito, precisa de 10 caracteres.
  const motivoOk = exigeMotivo ? tam >= 10 : tam === 0 || tam >= 10;

  const julgar = useMutation({
    mutationFn: () => decidirFn({ data: { anuncioId: g.anuncio.id, decisao: decisao!, motivo } }),
    onSuccess: (r) => {
      toast.success(
        decisao === "procedente"
          ? `Procedente: anúncio fora do ar (${r.decididas} denúncia(s)).`
          : `Improcedente: o anúncio continua no ar (${r.decididas} denúncia(s)).`,
      );
      qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível julgar as denúncias.")),
  });

  return (
    <section className="grid min-w-0 gap-3 rounded-xl border border-border bg-card/60 p-3 sm:p-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <FichaDoAnuncio f={g.anuncio} />
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-semibold",
              g.abertas > 0 ? "text-destructive" : "",
            )}
          >
            <Flag className="size-4" aria-hidden />
            {g.abertas > 0 ? `${g.abertas} a julgar` : "Todas julgadas"}
          </span>
          <span className="text-xs text-muted-foreground">
            {g.total} no total · última em {dataHora(g.ultima)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {motivos.map(([m, n]) => (
            <Badge key={m} variant="outline">
              {MOTIVO_DENUNCIA[m] ?? m} <span className="ml-1 tabular-nums opacity-70">{n}</span>
            </Badge>
          ))}
        </div>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {g.denuncias.map((d) => (
            <li key={d.id} className="space-y-0.5 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{MOTIVO_DENUNCIA[d.motivo] ?? d.motivo}</span>
                {d.status !== "aberta" && (
                  <Badge variant={d.status === "procedente" ? "destructive" : "secondary"}>
                    {d.status === "procedente" ? "Procedente" : "Improcedente"}
                  </Badge>
                )}
              </div>
              {d.detalhe && <p className="break-words text-muted-foreground">“{d.detalhe}”</p>}
              <p className="break-all text-[11px] tabular-nums text-muted-foreground">
                {dataHora(d.criado_em)} · {d.denunciante ?? "comprador"}
                {d.denuncias_da_pessoa > 3 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="size-3" aria-hidden /> {d.denuncias_da_pessoa} denúncias
                    feitas
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>

        {g.abertas > 0 &&
          (podeJulgar ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div role="radiogroup" aria-label="Julgamento" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "improcedente",
                      titulo: "Improcedente",
                      texto: "O anúncio continua no ar.",
                    },
                    {
                      id: "procedente",
                      titulo: "Procedente",
                      texto: "O anúncio sai do ar e o anunciante lê o motivo.",
                    },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={decisao === o.id}
                    onClick={() => setDecisao(o.id)}
                    className={cn(
                      "min-h-11 rounded-lg border p-3 text-left text-sm transition-colors",
                      decisao === o.id
                        ? o.id === "procedente"
                          ? "border-destructive bg-destructive/5 ring-1 ring-destructive/30"
                          : "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <span className="block font-medium">{o.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{o.texto}</span>
                  </button>
                ))}
              </div>
              {decisao && (
                <CampoMotivo
                  id={`motivo-den-${g.anuncio.id}`}
                  valor={motivo}
                  onValor={setMotivo}
                  obrigatorio={exigeMotivo}
                  dica={
                    exigeMotivo
                      ? "Ex.: fotos de outro imóvel, confirmado pela equipe."
                      : "Opcional: o que a equipe conferiu."
                  }
                />
              )}
              <div className="flex justify-end">
                <Button
                  variant={decisao === "procedente" ? "destructive" : "default"}
                  disabled={!decisao || !motivoOk || julgar.isPending}
                  onClick={() => julgar.mutate()}
                  className="w-full sm:w-auto"
                >
                  {julgar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {decisao === "procedente" ? "Tirar do ar" : "Registrar julgamento"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Você pode ver as denúncias, mas não julgar.
            </p>
          ))}
      </div>
    </section>
  );
}
