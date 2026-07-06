import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageSquare, UserRound, Clock } from "lucide-react";
import { clienteObterVisaoGeral } from "@/lib/portal/cliente.functions";
import { TimelineCliente } from "@/components/cliente/timeline-cliente";
import { ChipDocumento } from "@/components/cliente/chip-documento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/cliente/visao-geral")({
  head: () => ({ meta: [{ title: "Início — Meu Financiamento" }] }),
  component: VisaoGeral,
});

function diasNaEtapa(iso: string | null) {
  if (!iso) return null;
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return dias;
}

function moeda(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function VisaoGeral() {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "visao-geral"],
    queryFn: () => clienteObterVisaoGeral(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 4000),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  const { processo, etapas, contato, propostas, documentos_pendentes } = data;
  const dias = diasNaEtapa(processo.ultima_atualizacao);
  const progresso =
    processo.total > 0 ? Math.round((processo.ordem_atual / processo.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Etapa atual */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-primary">
            {processo.etapa_atual ?? "Processo em andamento"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {processo.descricao && <p className="text-foreground">{processo.descricao}</p>}
          <div className="space-y-1">
            <Progress value={progresso} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Etapa {processo.ordem_atual} de {processo.total}
            </p>
          </div>
          {dias != null && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {dias === 0 ? "Atualizado hoje" : `Há ${dias} dia${dias > 1 ? "s" : ""} nesta etapa`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Seu processo</CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineCliente etapas={etapas} />
        </CardContent>
      </Card>

      {/* Próximas ações */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Próximas ações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentos_pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum documento pendente. Tudo em dia! 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {documentos_pendentes.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{d.tipo_documento ?? d.nome_arquivo}</span>
                  <ChipDocumento status={d.status} />
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/cliente/acompanhar-minha-proposta"
            search={{ tab: "documentos" }}
            className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-2"
          >
            Ver documentos
          </Link>
        </CardContent>
      </Card>

      {/* Propostas */}
      {propostas.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Minhas propostas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {propostas.map((p) => (
              <div key={p.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{p.banco ?? "Banco"}</p>
                <p className="text-sm text-muted-foreground">
                  {p.produto ?? "Financiamento"} · {moeda(p.valor)}
                </p>
                <p className="mt-1 text-sm text-primary">{p.status_amigavel}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contato */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" /> Meu contato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contato?.nome ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {contato.foto_url ? (
                  <AvatarImage src={contato.foto_url} alt={contato.nome} />
                ) : null}
                <AvatarFallback>{contato.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{contato.nome}</p>
                <p className="text-sm text-muted-foreground">Responsável pelo seu processo</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Em breve um responsável será atribuído ao seu processo.
            </p>
          )}
          <Link
            to="/cliente/acompanhar-minha-proposta"
            search={{ tab: "mensagens" }}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2"
          >
            <MessageSquare className="h-4 w-4" /> Falar com o time
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
