import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileWarning, FolderOpen, XCircle } from "lucide-react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { clienteDocumentos, type DocumentoDoCliente } from "@/lib/portal/cliente-portal.functions";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { EnviarNovoDocumento, EnviarPendencia } from "@/components/cliente/portal/enviar-documento";
import { Bloco, Carregando, ErroCarregar, Selo, Vazio } from "@/components/cliente/portal/partes";
import type { TomStatus } from "@/lib/portal/jornada";

export const Route = createFileRoute("/cliente/documentos")({
  head: () => ({ meta: [{ title: "Meus documentos — Meu Financiamento" }] }),
  component: Documentos,
});

const STATUS: Record<DocumentoDoCliente["status"], { rotulo: string; tom: TomStatus; icone: typeof Clock }> = {
  pendente: { rotulo: "Pendente", tom: "alerta", icone: FileWarning },
  reprovado: { rotulo: "Enviar de novo", tom: "perigo", icone: XCircle },
  recebido: { rotulo: "Em conferência", tom: "info", icone: Clock },
  aprovado: { rotulo: "Aprovado", tom: "sucesso", icone: CheckCircle2 },
  expirado: { rotulo: "Vencido", tom: "neutro", icone: Clock },
};

/**
 * Meus documentos (C15): o que falta (com envio direto, que cai na pasta certa), e cada
 * pasta do cliente com o que já foi entregue e onde está na conferência.
 */
function Documentos() {
  const q = useQuery({ queryKey: ["cliente", "documentos"], queryFn: () => clienteDocumentos() });
  const docs = q.data?.documentos ?? [];
  const pendencias = docs.filter((d) => d.status === "pendente" || d.status === "reprovado");
  const porPasta = useMemo(() => {
    const m = new Map<string, DocumentoDoCliente[]>();
    for (const d of docs.filter((x) => x.status !== "pendente")) {
      m.set(d.pasta, [...(m.get(d.pasta) ?? []), d]);
    }
    return [...m.entries()];
  }, [docs]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <CabecalhoPagina
        icon={FolderOpen}
        titulo="Meus documentos"
        subtitulo="Envie pelo celular: cada arquivo entra direto na pasta certa do seu processo."
        acao={q.data ? <EnviarNovoDocumento pastas={q.data.pastas} /> : undefined}
      />
      {q.isError && !q.data ? (
        <ErroCarregar
          mensagem={mensagemDeErro(q.error, "Não foi possível carregar seus documentos.")}
          aoTentar={() => q.refetch()}
          ocupado={q.isFetching}
        />
      ) : !q.data ? (
        <Carregando linhas={2} />
      ) : (
        <>
          <Bloco titulo={pendencias.length ? `Faltam ${pendencias.length} com você` : "Nada pendente com você"} icone={FileWarning}>
            {pendencias.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-success-texto">
                <CheckCircle2 className="size-4" /> Tudo entregue. A equipe avisa por aqui se precisar de mais algum.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {pendencias.map((d) => (
                  <li key={d.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{d.tipo_documento ?? "Documento"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.status === "reprovado" ? "A equipe pediu de novo" : "Pendente"} · {d.pasta}
                      </p>
                    </div>
                    <EnviarPendencia documentoId={d.id} rotulo={d.status === "reprovado" ? "Reenviar" : "Enviar"} />
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          {porPasta.length === 0 ? (
            <Vazio
              icone={FolderOpen}
              titulo="Nenhum documento entregue ainda"
              texto="Os documentos que você e a equipe enviarem aparecem aqui, organizados por pasta."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {porPasta.map(([pasta, lista]) => (
                <Bloco key={pasta} titulo={pasta} icone={FolderOpen}>
                  <ul className="divide-y divide-border">
                    {lista.map((d) => {
                      const st = STATUS[d.status] ?? STATUS.recebido;
                      const Icone = st.icone;
                      return (
                        <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                          <Icone className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{d.tipo_documento ?? d.nome_arquivo ?? "Documento"}</p>
                            {d.versao > 1 && <p className="text-[11px] text-muted-foreground">versão {d.versao}</p>}
                          </div>
                          {/* O reenvio fica nas pendências, logo acima: aqui só a situação. */}
                          <Selo tom={st.tom}>{st.rotulo}</Selo>
                        </li>
                      );
                    })}
                  </ul>
                </Bloco>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
