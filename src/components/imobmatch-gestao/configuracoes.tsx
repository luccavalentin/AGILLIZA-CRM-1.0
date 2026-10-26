/**
 * ImobMatch Gestão › Configurações: os limites do ImobMatch (denúncias por dia, vídeos do
 * Reels…) e dos banners (frequência, limites por rede…), e — só para consulta — a
 * recomendação que aprende e o feed para portais.
 *
 * Gravar passa por `plataforma.imobmatch_salvar_parametro` (0460 do Corretor), que aceita só
 * inteiro e recusa os parâmetros que mexem em dinheiro ou em segurança da loja (vencimento e
 * validade do pacote de banner, compra de teste valendo como real): esses ficam nas
 * Configurações do Agilliza Tech, com quem cuida da plataforma.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  Home,
  Lock,
  Megaphone,
  Pencil,
  RefreshCw,
  Rss,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CabecalhoGestao,
  EstadoErro,
  ListaCarregando,
  PaginaGestao,
  Secao,
} from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import {
  lerParametrosImobMatch,
  salvarParametroImobMatch,
  type ParametroImobMatch,
} from "@/lib/plataforma/imobmatch-gestao.functions";
import { cn } from "@/lib/utils";
import { CHAVE_IMOBMATCH_GESTAO } from "./comum";

const CHAVE = [...CHAVE_IMOBMATCH_GESTAO, "parametros"] as const;

const ROTULO_RECOMENDACAO: Record<string, string> = {
  aprendizado_ligado: "Aprendizado ligado",
  controle_pct: "Grupo de controle (%)",
  minimo_amei: "Mínimo de AMEI",
  minimo_pessoas: "Mínimo de pessoas",
  minimo_avaliacoes: "Mínimo de avaliações",
  minimo_dias_uso: "Mínimo de dias de uso",
  ruido_pessoas: "Ruído (pessoas)",
};
const ROTULO_FEED: Record<string, string> = {
  intervalo_horas: "Intervalo entre gerações (horas)",
  max_itens: "Imóveis por feed",
  max_fotos_item: "Fotos por imóvel",
  max_bytes: "Tamanho máximo do feed (bytes)",
  max_bytes_foto: "Tamanho máximo por foto (bytes)",
  max_fotos_leitura: "Fotos lidas por rodada",
  tempo_max_s: "Tempo máximo (s)",
  tempo_max_fotos_s: "Tempo máximo das fotos (s)",
  tempo_max_foto_s: "Tempo máximo por foto (s)",
};

export function ConfiguracoesImobMatchTela() {
  const fn = useServerFn(lerParametrosImobMatch);
  const q = useQuery({ queryKey: CHAVE, queryFn: () => fn(), staleTime: 30_000 });
  const editarModulo = usePermissao("imobmatch.config", "edit");
  const podeEditar = editarModulo && !!q.data?.pode_editar;
  const params = q.data?.parametros ?? [];
  const imob = params.filter((p) => p.chave.startsWith("imobmatch."));
  const banners = params.filter((p) => p.chave.startsWith("patrocinio."));

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Configurações do ImobMatch"
        icone={<SlidersHorizontal />}
        descricao="Os limites do portal e dos banners. Cada alteração fica registrada com quem mudou e o valor de antes."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-1.5 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />
      {!podeEditar && q.data && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Só leitura: alterar pede o módulo “ImobMatch —
          Configurações” com editar.
        </p>
      )}
      {q.isError && (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível ler as configurações.")}
          onTentar={() => q.refetch()}
        />
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Secao semRespiro titulo="Portal ImobMatch" icone={<Home />}>
          {q.isLoading ? (
            <ListaCarregando linhas={4} />
          ) : (
            <ListaParametros itens={imob} podeEditar={podeEditar} />
          )}
        </Secao>
        <Secao semRespiro titulo="Banners patrocinados" icone={<Megaphone />}>
          {q.isLoading ? (
            <ListaCarregando linhas={4} />
          ) : (
            <ListaParametros itens={banners} podeEditar={podeEditar} />
          )}
        </Secao>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Secao
          titulo="Recomendação que aprende"
          descricao="Para consulta. Ajustar continua com a equipe da plataforma."
          icone={<Sparkles />}
        >
          <ListaFixa
            dados={q.data?.recomendacao ?? null}
            rotulos={ROTULO_RECOMENDACAO}
            carregando={q.isLoading}
          />
        </Secao>
        <Secao
          titulo="Feed para portais"
          descricao="Para consulta. Limites da geração do XML."
          icone={<Rss />}
        >
          <ListaFixa dados={q.data?.feed ?? null} rotulos={ROTULO_FEED} carregando={q.isLoading} />
        </Secao>
      </div>
    </PaginaGestao>
  );
}

function ListaParametros({
  itens,
  podeEditar,
}: {
  itens: ParametroImobMatch[];
  podeEditar: boolean;
}) {
  if (!itens.length) return <p className="p-4 text-sm text-muted-foreground">Nenhum parâmetro.</p>;
  return (
    <ul className="divide-y divide-border/70">
      {itens.map((p) => (
        <LinhaParametro key={p.chave} p={p} podeEditar={podeEditar} />
      ))}
    </ul>
  );
}

function valorTexto(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (typeof v === "string") return /^\d+$/.test(v) ? Number(v).toLocaleString("pt-BR") : v;
  return JSON.stringify(v);
}

function LinhaParametro({ p, podeEditar }: { p: ParametroImobMatch; podeEditar: boolean }) {
  const qc = useQueryClient();
  const fn = useServerFn(salvarParametroImobMatch);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(p.valor ?? ""));
  const salvar = useMutation({
    mutationFn: () => {
      const n = Number(valor.trim().replace(/\./g, ""));
      if (!/^\d+$/.test(valor.trim().replace(/\./g, "")) || !Number.isSafeInteger(n)) {
        throw new Error("Use um número inteiro (sem vírgula).");
      }
      return fn({ data: { chave: p.chave, valor: n } });
    },
    onSuccess: () => {
      toast.success("Parâmetro salvo.");
      setEditando(false);
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o parâmetro.")),
  });
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{p.descricao ?? p.chave}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {p.chave} · alterado em {formatData(p.atualizado_em)}
        </p>
      </div>
      {editando ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <Input
            autoFocus
            inputMode="numeric"
            aria-label={`Novo valor de ${p.descricao ?? p.chave}`}
            className="h-11 w-36 text-base tabular-nums sm:h-9 sm:text-sm"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 sm:size-9"
            disabled={salvar.isPending}
            aria-label="Salvar"
          >
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 sm:size-9"
            onClick={() => {
              setValor(String(p.valor ?? ""));
              setEditando(false);
            }}
            aria-label="Cancelar"
          >
            <X className="size-4" />
          </Button>
        </form>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium tabular-nums text-foreground">
            {valorTexto(p.valor)}
          </span>
          {p.editavel ? (
            podeEditar && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 sm:min-h-8"
                onClick={() => setEditando(true)}
              >
                <Pencil className="mr-1 size-3.5" /> Alterar
              </Button>
            )
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              title="Mexe em cobrança ou na segurança da loja: só nas Configurações do Agilliza Tech."
            >
              <Lock className="size-3.5" aria-hidden /> Agilliza Tech
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function ListaFixa({
  dados,
  rotulos,
  carregando,
}: {
  dados: { [chave: string]: unknown } | null;
  rotulos: Record<string, string>;
  carregando: boolean;
}) {
  if (carregando) return <ListaCarregando linhas={3} className="p-0" />;
  if (!dados) return <p className="text-sm text-muted-foreground">Sem configuração.</p>;
  const chaves = Object.keys(rotulos).filter((k) => k in dados);
  return (
    <dl className="divide-y divide-border/60">
      {chaves.map((k) => (
        <div key={k} className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-sm text-muted-foreground">{rotulos[k]}</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {valorTexto(dados[k])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
