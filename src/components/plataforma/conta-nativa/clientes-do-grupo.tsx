import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Network, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListaDesktop } from "@/components/crm/clientes-page/lista-desktop";
import { ListaMobile } from "@/components/crm/clientes-page/lista-mobile";
import type { ClienteItem } from "@/components/crm/clientes-page/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { ETAPA_CLIENTE_ASSINANTE } from "@/lib/plataforma/contas.functions";
import { espelharClienteDaConta } from "@/lib/plataforma/conta-nativa.functions";
import { listarClientesDoGrupo } from "@/lib/plataforma/filtro-base.functions";
import { documentoSeguro, type Grupo } from "@/lib/plataforma/filtro-base";

const POR_PAGINA = 20;

/**
 * Carteiras de clientes de um grupo do Agilliza Tech ("Sua base": contas vinculadas; ou todos os
 * assinantes), com a MESMA lista da base própria e o selo da conta em cada linha. O CPF/CNPJ vem
 * mascarado (LGPD). Abrir a ficha leva o cliente ao Agilliza (o mesmo CPF é o mesmo cliente),
 * pela conta da própria linha.
 */
export function ClientesDoGrupo({
  grupo,
  licenca = null,
  termo = "",
  secao = false,
}: {
  grupo: Grupo;
  licenca?: string | null;
  /** Busca vinda da barra da tela (já com debounce). */
  termo?: string;
  /** Mostrada abaixo da base do Agilliza, com título próprio. */
  secao?: boolean;
}) {
  const navigate = useNavigate();
  const listarFn = useServerFn(listarClientesDoGrupo);
  const espelharFn = useServerFn(espelharClienteDaConta);
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [grupo, licenca, termo]);

  const consulta = useQuery({
    queryKey: ["clientes-do-grupo", grupo, licenca, termo, pagina],
    queryFn: () =>
      listarFn({
        data: { grupo, licenca, termo: termo || null, pagina, porPagina: POR_PAGINA },
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const linhas = consulta.data?.clientes ?? [];
  const total = consulta.data?.total ?? 0;
  const itens: ClienteItem[] = linhas.map((c) => ({
    id: c.id,
    nome: c.nome,
    numero_cliente: c.codigo,
    documento: documentoSeguro(c.documento_mascarado),
    documento_masc: true,
    email: c.email,
    telefone_celular: c.celular,
    etapa_nome: ETAPA_CLIENTE_ASSINANTE[c.status_funil] ?? c.status_funil,
    responsavel_nome: c.responsavel,
    portal_acesso_ativo: false,
    _conta: c.conta,
  }));

  async function abrirFicha(id: string) {
    const linha = linhas.find((c) => c.id === id);
    if (!linha) return;
    const aviso = toast.loading(`Abrindo o cliente de ${linha.conta} no Agilliza…`);
    try {
      const r = await espelharFn({ data: { licenca: linha.licenca_id, clienteId: id } });
      toast.dismiss(aviso);
      navigate({ to: "/crm/clientes/$id", params: { id: r.cliente_id } });
    } catch (e) {
      toast.dismiss(aviso);
      toast.error(mensagemDeErro(e, "Não foi possível abrir este cliente no Agilliza."));
    }
  }

  if (secao && !consulta.isLoading && total === 0 && !termo) return null;

  return (
    <section className="space-y-3" aria-label={secao ? "Clientes de corretores vinculados" : undefined}>
      {secao && (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary ring-1 ring-inset ring-primary/12">
              <Network className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                Corretores e parceiros vinculados
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                Contas do Agilliza Tech que fazem parte da sua base.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {consulta.data ? total : "—"}
          </span>
        </div>
      )}

      {!secao && consulta.data && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {total} cliente{total === 1 ? "" : "s"}
          {consulta.data.contas > 1 ? ` em ${consulta.data.contas} contas` : ""}. CPF/CNPJ mascarado; a
          ficha completa abre ao clicar.
        </p>
      )}

      {consulta.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(consulta.error, "Não foi possível carregar os clientes.")}
        </p>
      )}

      <ListaMobile
        isLoading={consulta.isLoading}
        itens={itens}
        navigateToFicha={abrirFicha}
        podeCadastrar={false}
        filtrando={!!termo}
      />
      <ListaDesktop
        isLoading={consulta.isLoading}
        isFetching={consulta.isFetching}
        itens={itens}
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        setPagina={(f) => setPagina(f)}
        navigateToFicha={abrirFicha}
        podeCadastrar={false}
        filtrando={!!termo}
      />

      {total > POR_PAGINA && (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm md:hidden">
          <span>
            Página {pagina} de {Math.ceil(total / POR_PAGINA)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={pagina === 1 || consulta.isFetching}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={pagina * POR_PAGINA >= total || consulta.isFetching}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
