import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCliente, getEndereco } from "@/lib/crm/clientes.functions";
import { ClienteForm } from "@/components/crm/cliente-form";
import { VendedoresTab } from "@/components/crm/vendedores-tab";
import { ImovelTab, IqTab } from "@/components/crm/imovel-iq-tab";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import { VincularClienteDialog } from "@/components/proposta/vincular-cliente-dialog";

export type SecaoCliente = "comprador" | "vendedores" | "imovel" | "iq" | "documentos";

/**
 * Renderiza as seções do CADASTRO DE CLIENTE (mesmas tabelas, mesmos componentes)
 * dentro da ficha da proposta, chaveado pelo cliente vinculado à proposta.
 * Comprador → clientes; Vendedores → cliente_vendedores; Imóvel/IQ → clientes;
 * Documentos → cliente_documentos.
 */
export function ClienteSecao({
  clienteId,
  secao,
  propostaId,
  destacarObrigatorios,
  onSalvoComprador,
  idBanco,
}: {
  clienteId: string | null | undefined;
  secao: SecaoCliente;
  propostaId?: string;
  destacarObrigatorios?: boolean;
  onSalvoComprador?: () => void;
  idBanco?: number;
}) {


  const getCli = useServerFn(getCliente);
  const getEnd = useServerFn(getEndereco);


  const { data: det, isLoading } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: () => getCli({ data: { id: clienteId as string } }),
    enabled: Boolean(clienteId),
  });
  const { data: endereco } = useQuery({
    queryKey: ["cliente-endereco", clienteId],
    queryFn: () => getEnd({ data: { cliente_id: clienteId as string } }),
    enabled: Boolean(clienteId) && secao === "comprador",
  });

  if (!clienteId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <UserPlus className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Nenhum cadastro de cliente vinculado a esta proposta.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vincule um cliente já cadastrado no CRM ou abra o cadastro já preenchido com os dados
          desta proposta — em ambos os casos o cliente fica vinculado automaticamente à proposta.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {propostaId && <VincularClienteDialog propostaId={propostaId} />}
          {propostaId && (
            <Button asChild size="sm">
              <Link to="/crm/clientes/novo" search={{ proposta: propostaId }}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Cadastrar cliente
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/crm/clientes">Abrir CRM de clientes</Link>
          </Button>
        </div>
      </div>
    );
  }


  if (isLoading || !det) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dados do cliente…
      </div>
    );
  }

  const c = det.cliente as any;

  if (secao === "vendedores") return <VendedoresTab clienteId={clienteId} idBanco={idBanco} />;
  if (secao === "imovel") return <ImovelTab clienteId={clienteId} cliente={c} />;
  if (secao === "iq") return <IqTab clienteId={clienteId} cliente={c} />;
  if (secao === "documentos") return <DocumentosTab clienteId={clienteId} />;

  // comprador
  return (
    <ClienteForm
      embutido
      vincularPropostaId={propostaId}
      onSalvoEmbutido={onSalvoComprador}
      destacarObrigatorios={destacarObrigatorios}
      idBanco={idBanco}

      portalAtivo={c.portal_acesso_ativo}


      enderecoInicial={endereco as any}
      inicial={{
        id: c.id,
        tipo_pessoa: c.tipo_pessoa,
        nome: c.nome,
        documento: c.documento,
        documento_secundario: c.documento_secundario ?? "",
        data_nascimento: c.data_nascimento ?? "",
        estado_civil: c.estado_civil ?? "solteiro",
        regime_casamento: c.regime_casamento ?? "",
        mae: c.mae ?? "",
        pai: c.pai ?? "",
        sexo: c.sexo ?? "",
        nacionalidade: c.nacionalidade ?? "",
        naturalidade: c.naturalidade ?? "",
        tipo_documento_identidade: c.tipo_documento_identidade ?? "",
        numero_documento: c.numero_documento ?? "",
        orgao_expedidor: c.orgao_expedidor ?? "",
        uf_expedicao: c.uf_expedicao ?? "",
        data_expedicao: c.data_expedicao ?? "",
        profissao: c.profissao ?? "",
        empresa: c.empresa ?? "",
        banco_conta: c.banco_conta ?? "",
        agencia: c.agencia ?? "",
        conta_corrente: c.conta_corrente ?? "",
        digito_conta: c.digito_conta ?? "",
        email: c.email ?? "",
        telefone_celular: c.telefone_celular ?? "",
        renda_total_declarada:
          c.renda_total_declarada != null ? String(c.renda_total_declarada) : "",
        uf_interesse: c.uf_interesse ?? "",
        utiliza_fgts: c.utiliza_fgts ?? false,
        fg_autorizacao_dados: c.fg_autorizacao_dados ?? false,
        origem: c.origem,
        conjuge_nome: c.conjuge_nome ?? "",
        conjuge_cpf: c.conjuge_cpf ?? "",
        conjuge_data_nascimento: c.conjuge_data_nascimento ?? "",
        conjuge_nome_mae: c.conjuge_nome_mae ?? "",
        conjuge_sexo: c.conjuge_sexo ?? "",
        conjuge_nacionalidade: c.conjuge_nacionalidade ?? "",
        conjuge_tipo_documento_identidade: c.conjuge_tipo_documento_identidade ?? "",
        conjuge_numero_documento: c.conjuge_numero_documento ?? "",
        conjuge_orgao_expedidor: c.conjuge_orgao_expedidor ?? "",
        conjuge_uf_expedicao: c.conjuge_uf_expedicao ?? "",
        conjuge_data_expedicao: c.conjuge_data_expedicao ?? "",
        conjuge_profissao: c.conjuge_profissao ?? "",
        conjuge_empresa: c.conjuge_empresa ?? "",
        conjuge_renda: c.conjuge_renda != null ? String(c.conjuge_renda) : "",
        conjuge_email: c.conjuge_email ?? "",
        conjuge_celular: c.conjuge_celular ?? "",
        conjuge_banco_conta: c.conjuge_banco_conta ?? "",
        conjuge_agencia: c.conjuge_agencia ?? "",
        conjuge_conta_corrente: c.conjuge_conta_corrente ?? "",
        conjuge_digito_conta: c.conjuge_digito_conta ?? "",
      }}
    />
  );
}
