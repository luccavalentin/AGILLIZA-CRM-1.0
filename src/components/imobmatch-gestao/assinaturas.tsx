/**
 * ImobMatch Gestão › Profissionais e anunciantes › Assinaturas: as contas do Pro avulso e
 * dos anunciantes particulares — plano, situação, até quando vale o acesso, se renova pela
 * loja e se pediu cancelamento. De `plataforma.imobmatch_assinaturas` (0460 do Corretor).
 * Só leitura: cobrança e baixa continuam em Gestão de sistemas › Receita e cobrança.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Apple,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Play,
  Repeat,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarraFiltros,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  Secao,
  Selo,
  type OpcaoChip,
} from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import {
  lerAssinaturasImobMatch,
  type AssinaturaImobMatch,
  type SituacaoAssinatura,
} from "@/lib/plataforma/imobmatch-gestao.functions";
import { CHAVE_IMOBMATCH_GESTAO, inteiro } from "./comum";

type Produto = "todos" | "pro" | "anunciante";
type Situacao = "todas" | SituacaoAssinatura;

const STATUS: Record<
  string,
  { rotulo: string; tom: "sucesso" | "info" | "alerta" | "perigo" | "neutro" }
> = {
  ativo: { rotulo: "Ativa", tom: "sucesso" },
  trial: { rotulo: "Em teste", tom: "info" },
  somente_leitura: { rotulo: "Só leitura", tom: "alerta" },
  suspenso: { rotulo: "Suspensa", tom: "perigo" },
  cancelado: { rotulo: "Cancelada", tom: "neutro" },
};

function useDebounce<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function AbaAssinaturasImobMatch() {
  const fn = useServerFn(lerAssinaturasImobMatch);
  const [produto, setProduto] = useState<Produto>("todos");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const termo = useDebounce(busca.trim());
  useEffect(() => setPagina(1), [produto, situacao, termo]);

  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH_GESTAO, "assinaturas", produto, situacao, termo, pagina],
    queryFn: () =>
      fn({
        data: {
          produto: produto === "todos" ? null : produto,
          situacao: situacao === "todas" ? null : situacao,
          busca: termo,
          pagina,
        },
      }),
    staleTime: 30_000,
    placeholderData: (a) => a,
  });
  const d = q.data;
  const c = d?.contagem;
  const opcoesSituacao: OpcaoChip<Situacao>[] = [
    { valor: "todas", rotulo: "Todas" },
    { valor: "ativo", rotulo: "Ativas", contagem: c?.ativo },
    { valor: "trial", rotulo: "Em teste", contagem: c?.trial },
    { valor: "vencendo", rotulo: "Vencem em 7 dias", contagem: c?.vencendo, tom: "perigo" },
    { valor: "cancelando", rotulo: "Cancelamento pedido", contagem: c?.cancelando, tom: "perigo" },
    { valor: "inativo", rotulo: "Suspensas ou canceladas", contagem: c?.inativo },
  ];
  const paginas = Math.max(1, Math.ceil((d?.total ?? 0) / 50));

  return (
    <div className="space-y-4">
      <BarraFiltros>
        <ChipsFiltro
          rotulo="Produto"
          valor={produto}
          onChange={setProduto}
          opcoes={[
            { valor: "todos", rotulo: "Pro e anunciantes" },
            { valor: "pro", rotulo: "Pro avulso" },
            { valor: "anunciante", rotulo: "Anunciantes particulares" },
          ]}
        />
        <CampoBusca
          valor={busca}
          onChange={setBusca}
          placeholder="Buscar conta"
          rotulo="Buscar conta"
          className="md:ml-auto"
        />
      </BarraFiltros>
      <ChipsFiltro
        rotulo="Situação"
        valor={situacao}
        onChange={setSituacao}
        opcoes={opcoesSituacao}
      />

      <Secao
        semRespiro
        titulo="Assinaturas do ImobMatch"
        descricao={`${inteiro(d?.total)} conta(s) neste recorte · o Pro que vem junto do CRM não entra aqui`}
      >
        {q.isError ? (
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível ler as assinaturas.")}
            onTentar={() => q.refetch()}
          />
        ) : q.isLoading ? (
          <ListaCarregando />
        ) : !d?.itens.length ? (
          <EstadoVazio
            icone={<UserRound />}
            titulo="Nenhuma assinatura neste recorte"
            descricao="Troque o produto, a situação ou a busca."
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {d.itens.map((a) => (
              <LinhaAssinatura key={a.tenant_id} a={a} />
            ))}
          </ul>
        )}
      </Secao>

      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <span className="tabular-nums">
            {pagina} de {paginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={pagina >= paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function LinhaAssinatura({ a }: { a: AssinaturaImobMatch }) {
  const st = STATUS[a.status] ?? { rotulo: a.status, tom: "neutro" as const };
  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{a.conta}</p>
        <p className="truncate text-xs text-muted-foreground">
          {a.plano} · {a.tipo_conta === "particular" ? "particular" : a.tipo_conta} · desde{" "}
          {formatData(a.criado_em)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={st.tom} ponto={a.status === "ativo"}>
          {st.rotulo}
        </Selo>
        {a.cancela_em && <Selo tom="alerta">Cancela em {formatData(a.cancela_em)}</Selo>}
        {a.loja && (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
            title={a.renova_na_loja ? "Renova sozinha pela loja" : undefined}
          >
            {a.loja === "apple" ? (
              <Apple className="size-3" aria-hidden />
            ) : (
              <Play className="size-3" aria-hidden />
            )}
            {a.loja === "apple" ? "App Store" : "Google Play"}
            {a.renova_na_loja && <Repeat className="size-3" aria-label="renova sozinha" />}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden />
          {a.acesso_ate
            ? `acesso até ${formatData(a.acesso_ate)}`
            : a.trial_ate
              ? `teste até ${formatData(a.trial_ate)}`
              : "sem prazo"}
        </span>
        <span className="tabular-nums">{inteiro(a.anuncios_no_ar)} no ar</span>
        {a.ultimo_pagamento && <span>pago em {formatData(a.ultimo_pagamento)}</span>}
      </div>
    </li>
  );
}
