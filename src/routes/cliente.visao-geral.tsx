import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  FolderOpen,
  Landmark,
  MessageCircle,
  Route as IconeRota,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { pollingPortal } from "@/lib/portal/polling";
import { clienteInicio } from "@/lib/portal/cliente-portal.functions";
import { etapaAtual, nomeEtapa, primeiroNome, progressoJornada, saudacao } from "@/lib/portal/jornada";
import { JornadaCompra } from "@/components/cliente/portal/jornada-compra";
import { EnviarPendencia } from "@/components/cliente/portal/enviar-documento";
import { Atalho, Bloco, CartaoProposta, Carregando, ErroCarregar } from "@/components/cliente/portal/partes";

export const Route = createFileRoute("/cliente/visao-geral")({
  head: () => ({ meta: [{ title: "Início — Meu Financiamento" }] }),
  component: Inicio,
});

function quandoAtualizou(iso: string | null) {
  if (!iso) return null;
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "atualizado hoje";
  if (dias === 1) return "atualizado ontem";
  return `atualizado há ${dias} dias`;
}

/**
 * Início do portal do cliente do correspondente (C15). Responde à única pergunta do
 * cliente — "e aí, como está?": onde a compra está, o que falta da parte dele (com o
 * botão que resolve) e quem cuida do caso. Mesmo desenho do início do portal do cliente
 * dos assinantes do Agilliza Tech.
 */
function Inicio() {
  const q = useQuery({
    queryKey: ["cliente", "inicio"],
    queryFn: () => clienteInicio(),
    ...pollingPortal(30_000),
  });

  if (q.isError && !q.data) {
    return (
      <ErroCarregar
        mensagem={mensagemDeErro(q.error, "Não foi possível carregar seus dados.")}
        aoTentar={() => q.refetch()}
        ocupado={q.isFetching}
      />
    );
  }
  if (!q.data) return <Carregando />;

  const d = q.data;
  const atual = etapaAtual(d.jornada);
  const progresso = progressoJornada(d.jornada);
  const pendentes = d.pendencias.length;
  const contato = d.contato?.nome ? primeiroNome(d.contato.nome) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Onde está a compra */}
      <section data-tour="cliente-inicio-andamento" className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-[0_18px_40px_-24px_rgba(0,15,159,0.8)] sm:p-6">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-white/10" />
        <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full border border-white/10" />
        <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm text-primary-foreground/80">
              {saudacao()}, {primeiroNome(d.cliente.nome)}
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">
              {atual ? nomeEtapa(atual.nome) : "Compra concluída"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-primary-foreground/85">
              {atual?.descricao_cliente ?? "Seu contrato foi registrado. Parabéns pela conquista!"}
            </p>
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-xs text-primary-foreground/80">
                <span>{progresso}% da jornada</span>
                <span>{quandoAtualizou(d.ultima_atualizacao)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          </div>
          {d.contato?.nome && (
            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <Avatar className="size-10 ring-2 ring-white/30">
                {d.contato.foto_url ? <AvatarImage src={d.contato.foto_url} alt={d.contato.nome} /> : null}
                <AvatarFallback className="bg-white text-primary">{(contato ?? "?")[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-primary-foreground/70">Quem cuida do seu caso</p>
                <p className="truncate text-sm font-semibold">{d.contato.nome}</p>
              </div>
              <Button asChild size="sm" variant="secondary" className="ml-auto min-h-9 shrink-0">
                <Link to="/cliente/chat">
                  <MessageCircle className="mr-1 size-4" /> Falar
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* O que falta da parte do cliente */}
      {pendentes > 0 && (
        <section data-tour="cliente-inicio-pendencias" className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm font-medium text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {pendentes === 1 ? "Falta 1 documento seu para seguir." : `Faltam ${pendentes} documentos seus para seguir.`}
            </p>
            <Button asChild size="sm" variant="outline" className="min-h-9 border-warning/50 bg-background">
              <Link to="/cliente/documentos">
                Resolver agora <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {d.pendencias.slice(0, 4).map((p) => (
              <li key={p.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-background p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.tipo_documento ?? "Documento"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.status === "reprovado" ? "Precisa enviar de novo" : "Pendente"} · {p.pasta}
                  </p>
                </div>
                <EnviarPendencia documentoId={p.id} rotulo={p.status === "reprovado" ? "Reenviar" : "Enviar"} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div data-tour="cliente-inicio-atalhos" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Atalho
          icone={FolderOpen}
          rotulo="Documentos aprovados"
          valor={`${d.documentos.aprovados}/${d.documentos.total}`}
          dica={pendentes ? `${pendentes} com você` : d.documentos.em_analise ? `${d.documentos.em_analise} em conferência` : "Tudo em dia"}
          to="/cliente/documentos"
          destaque={pendentes > 0}
        />
        <Atalho
          icone={Calculator}
          rotulo="Simulações"
          valor={String(d.simulacoes.total)}
          dica={d.simulacoes.melhor_parcela ? `Menor parcela ${formatBRL(d.simulacoes.melhor_parcela)}` : undefined}
          to="/cliente/simulacoes"
        />
        <Atalho
          icone={Landmark}
          rotulo="Propostas"
          valor={String(d.propostas.length)}
          dica={d.propostas[0] ? d.propostas[0].banco ?? undefined : "Depois da aprovação"}
          to="/cliente/acompanhar-minha-proposta"
        />
        <Atalho
          icone={MessageCircle}
          rotulo="Mensagens novas"
          valor={String(d.mensagens_nao_lidas)}
          dica="Converse com a equipe"
          to="/cliente/chat"
        />
      </div>

      <div data-tour="cliente-inicio-jornada" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Bloco titulo="Sua jornada" icone={IconeRota} className="lg:col-span-3">
          <JornadaCompra etapas={d.jornada} />
        </Bloco>
        <Bloco
          titulo="Sua proposta"
          icone={Landmark}
          className="lg:col-span-2"
          acao={
            d.propostas.length > 0 ? (
              <Link to="/cliente/acompanhar-minha-proposta" className="text-xs font-medium text-primary hover:underline">
                Ver detalhes
              </Link>
            ) : undefined
          }
        >
          {d.propostas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Quando o banco aprovar o seu crédito, a proposta aparece aqui com o número dela e as
              condições aprovadas.
            </p>
          ) : (
            <div className="space-y-3">
              {d.propostas.slice(0, 2).map((p) => (
                <CartaoProposta key={p.id} p={p} />
              ))}
            </div>
          )}
        </Bloco>
      </div>
    </div>
  );
}
