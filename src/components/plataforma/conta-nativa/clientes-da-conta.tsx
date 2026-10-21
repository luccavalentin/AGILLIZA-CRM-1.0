import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListaDesktop } from "@/components/crm/clientes-page/lista-desktop";
import { ListaMobile } from "@/components/crm/clientes-page/lista-mobile";
import type { ClienteItem } from "@/components/crm/clientes-page/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  ETAPA_CLIENTE_ASSINANTE,
  listarClientesDaConta,
  type ContaAssinante,
} from "@/lib/plataforma/contas.functions";
import { espelharClienteDaConta } from "@/lib/plataforma/conta-nativa.functions";

/**
 * Clientes de uma conta assinante com a MESMA lista da base própria. A lista vem do Corretor
 * (sem cópia), com o CPF/CNPJ completo; abrir a ficha leva o cliente ao Agilliza (o mesmo CPF é o mesmo
 * cliente, com o cadastro do assinante no padrão do Agilliza) e abre a ficha nativa.
 */
export function ClientesDaContaNativos({ conta }: { conta: ContaAssinante }) {
  const navigate = useNavigate();
  const listarFn = useServerFn(listarClientesDaConta);
  const espelharFn = useServerFn(espelharClienteDaConta);
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(q.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPagina(1), [conta.id]);

  const consulta = useQuery({
    queryKey: ["clientes-conta-nativa", conta.id, termo, pagina],
    queryFn: () => listarFn({ data: { licenca: conta.id, termo: termo || null, pagina } }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const total = consulta.data?.total ?? 0;
  const itens: ClienteItem[] = (consulta.data?.clientes ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    numero_cliente: c.codigo,
    documento: c.documento ?? c.documento_mascarado ?? "",
    documento_masc: !c.documento,
    email: c.email,
    telefone_celular: c.celular,
    etapa_nome: ETAPA_CLIENTE_ASSINANTE[c.status_funil] ?? c.status_funil,
    responsavel_nome: c.responsavel,
    portal_acesso_ativo: false,
    _conta: conta.nome,
  }));

  async function abrirFicha(id: string) {
    const aviso = toast.loading("Abrindo o cliente do assinante no Agilliza…");
    try {
      const r = await espelharFn({ data: { licenca: conta.id, clienteId: id } });
      toast.dismiss(aviso);
      navigate({ to: "/crm/clientes/$id", params: { id: r.cliente_id } });
    } catch (e) {
      toast.dismiss(aviso);
      toast.error(mensagemDeErro(e, "Não foi possível abrir este cliente no Agilliza."));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Clientes de <strong>{conta.nome}</strong> (
          {conta.tipo === "imobiliaria" ? "imobiliária" : "corretor"}). Abrir a ficha leva o cliente
          para a sua base com o cadastro do assinante, para editar, simular e enviar como sempre.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3">
        <div className="relative">
          <Label htmlFor="busca-clientes-conta" className="sr-only">
            Buscar cliente da conta
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="busca-clientes-conta"
            className="h-11 pl-9"
            placeholder="Buscar por nome, código ou e-mail"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {consulta.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(consulta.error, "Não foi possível carregar os clientes da conta.")}
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
        porPagina={50}
        setPagina={(f) => setPagina(f)}
        navigateToFicha={abrirFicha}
        podeCadastrar={false}
        filtrando={!!termo}
      />

      {/* No celular a tabela some; sem isto só os 50 primeiros clientes da conta apareciam. */}
      {total > 50 && (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm md:hidden">
          <span>
            {itens.length} de {total} clientes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina === 1 || consulta.isFetching}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <span>Página {pagina}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina * 50 >= total || consulta.isFetching}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
