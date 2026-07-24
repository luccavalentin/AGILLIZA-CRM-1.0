import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  criarCliente,
  atualizarCliente,
  salvarEndereco,
  definirAcessoPortal,
  listarParceirosDisponiveis,
  vincularParceiro,
  TIPOS_VINCULO,
  TIPO_VINCULO_PESSOA,
  type TipoVinculo,
} from "@/lib/crm/clientes.functions";
import { enviarPropostaHomeFin, vincularClienteAProposta } from "@/lib/propostas/propostas.functions";
import {
  validarDocumento,
  validarCPF,
  soDigitos,
  validarEmail,
  validarTelefone,
  mascararTelefone,
  mascararCPF,
  mascararDocumentoTipo,
} from "@/lib/crm/documento";
import { CriarVinculoInline } from "@/components/crm/criar-vinculo-inline";
import {
  emptyValues,
  formatarMoedaBR,
  normalizarSexo,
  type ClienteFormValues,
  type EnderecoValues,
} from "./cliente-form/constants";
import { VinculosSection } from "./cliente-form/vinculos-section";
import { PortalSection } from "./cliente-form/portal-section";
import { DadosBasicosSection } from "./cliente-form/dados-basicos-section";
import { ConjugeSection } from "./cliente-form/conjuge-section";
import { IdentidadeSection } from "./cliente-form/identidade-section";
import { EnderecoSection } from "./cliente-form/endereco-section";
import { FgtsSection } from "./cliente-form/fgts-section";
import { BancariosSection } from "./cliente-form/bancarios-section";

export type { ClienteFormValues } from "./cliente-form/constants";

export function ClienteForm({
  inicial,
  portalAtivo,
  enderecoInicial,
  vincularPropostaId,
  embutido,
  destacarObrigatorios,
  enviarBancoAposVincular,
  onSalvoEmbutido,
}: {
  inicial?: Partial<ClienteFormValues>;
  portalAtivo?: boolean;
  enderecoInicial?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  } | null;
  /** Quando presente, ao criar o cliente ele é vinculado a esta proposta e o usuário volta para a ficha. */
  vincularPropostaId?: string;
  /** Quando true, o formulário é renderizado embutido (ex.: ficha da proposta). Ao salvar, não navega — mantém o usuário na tela atual. */
  embutido?: boolean;
  /** Quando true, destaca em vermelho os campos obrigatórios ainda pendentes para envio da proposta. */
  destacarObrigatorios?: boolean;
  /** Fluxo de nova proposta direta: após vincular o cliente, envia a proposta ao banco selecionado. */
  enviarBancoAposVincular?: boolean;
  /** Chamado após salvar com sucesso no modo embutido (ex.: para direcionar ao envio ao banco). */
  onSalvoEmbutido?: () => void;
}) {

  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarCliente);
  const atualizar = useServerFn(atualizarCliente);
  const salvarEnd = useServerFn(salvarEndereco);
  const definirPortal = useServerFn(definirAcessoPortal);
  const listarParceiros = useServerFn(listarParceirosDisponiveis);
  const vincular = useServerFn(vincularParceiro);
  const vincularProposta = useServerFn(vincularClienteAProposta);
  const enviarProposta = useServerFn(enviarPropostaHomeFin);


  const [v, setV] = useState<ClienteFormValues>(() => {
    const base = { ...emptyValues, ...inicial };
    // Formata a renda inicial (vinda como número cru) para exibição em R$.
    if (base.renda_total_declarada) {
      const n = Number(base.renda_total_declarada);
      if (!isNaN(n)) base.renda_total_declarada = formatarMoedaBR(n);
    }
    // Normaliza o sexo para o valor canônico ("M"/"F") aceito pelo <Select>.
    base.sexo = normalizarSexo(base.sexo);
    base.conjuge_sexo = normalizarSexo(base.conjuge_sexo);
    // Aplica máscaras de exibição em documentos/telefones vindos crus do banco.
    if (base.documento) base.documento = mascararDocumentoTipo(base.documento, base.tipo_pessoa);
    if (base.conjuge_cpf) base.conjuge_cpf = mascararCPF(base.conjuge_cpf);
    if (base.telefone_celular) base.telefone_celular = mascararTelefone(base.telefone_celular);
    if (base.conjuge_celular) base.conjuge_celular = mascararTelefone(base.conjuge_celular);
    if (base.conjuge_renda) {
      const n = Number(base.conjuge_renda);
      if (!isNaN(n)) base.conjuge_renda = formatarMoedaBR(n);
    }
    return base;
  });
  const [end, setEnd] = useState<EnderecoValues>({
    cep: enderecoInicial?.cep ?? "",
    logradouro: enderecoInicial?.logradouro ?? "",
    numero: enderecoInicial?.numero ?? "",
    bairro: enderecoInicial?.bairro ?? "",
    cidade: enderecoInicial?.cidade ?? "",
    uf: enderecoInicial?.uf ?? "",
  });
  const [portal, setPortal] = useState(Boolean(portalAtivo));
  const [portalSalvando, setPortalSalvando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Vínculos de atendimento: usuários a vincular ao criar um novo cliente, por tipo.
  const novoCadastro = !v.id;
  const [vinculos, setVinculos] = useState<Array<{ parceiro_id: string; tipo_vinculo: TipoVinculo }>>(
    [],
  );
  const [vinculoSel, setVinculoSel] = useState<Record<string, string>>({});
  const [criarTipo, setCriarTipo] = useState<TipoVinculo | null>(null);
  const parceiros = useQuery({
    queryKey: ["parceiros-disponiveis"],
    queryFn: () => listarParceiros(),
    enabled: novoCadastro,
  });
  const nomeParceiro = (id: string) => {
    const p = (parceiros.data ?? []).find((x) => x.id === id);
    return p?.nome ?? p?.email ?? id;
  };
  const adicionarVinculo = (tipo: TipoVinculo, parceiroId?: string) => {
    const id = parceiroId ?? vinculoSel[tipo];
    if (!id) return;
    setVinculos((prev) => [...prev, { parceiro_id: id, tipo_vinculo: tipo }]);
    setVinculoSel((prev) => ({ ...prev, [tipo]: "" }));
  };
  const removerVinculo = (parceiro_id: string, tipo: TipoVinculo) =>
    setVinculos((prev) =>
      prev.filter((x) => !(x.parceiro_id === parceiro_id && x.tipo_vinculo === tipo)),
    );

  async function alternarPortal(ativo: boolean) {
    if (!v.id) return;
    setPortal(ativo);
    setPortalSalvando(true);
    try {
      await definirPortal({ data: { cliente_id: v.id, ativo } });
      toast.success(ativo ? "Acesso ao portal habilitado." : "Acesso ao portal desabilitado.");
      qc.invalidateQueries({ queryKey: ["cliente", v.id] });
    } catch (err: any) {
      setPortal(!ativo);
      toast.error(err?.message ?? "Não foi possível salvar o acesso.");
    } finally {
      setPortalSalvando(false);
    }
  }
  const set = <K extends keyof ClienteFormValues>(k: K, val: ClienteFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // Busca automática do endereço pelo CEP (ViaCEP) — apenas visual/preenchimento.
  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resp.json();
      if (dados?.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setEnd((p) => ({
        ...p,
        logradouro: dados.logradouro || p.logradouro,
        bairro: dados.bairro || p.bairro,
        cidade: dados.localidade || p.cidade,
        uf: dados.uf || p.uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ehPF = v.tipo_pessoa === "PF";

    // Nome / razão social
    if (!v.nome.trim()) {
      return toast.error(ehPF ? "Informe o nome completo." : "Informe a razão social.");
    }

    // Documento: CPF (11 dígitos) para PF, CNPJ (14 dígitos) para PJ
    const docDigitos = soDigitos(v.documento);
    if (!docDigitos) {
      return toast.error(ehPF ? "Informe o CPF." : "Informe o CNPJ.");
    }
    if (ehPF && docDigitos.length !== 11) {
      return toast.error("O CPF deve conter 11 dígitos.");
    }
    if (!ehPF && docDigitos.length !== 14) {
      return toast.error("O CNPJ deve conter 14 dígitos.");
    }
    if (!validarDocumento(docDigitos, v.tipo_pessoa)) {
      return toast.error(ehPF ? "CPF inválido." : "CNPJ inválido.");
    }

    // Data de nascimento (PF) / abertura (PJ)
    if (!v.data_nascimento) {
      return toast.error(ehPF ? "Informe a data de nascimento." : "Informe a data de abertura.");
    }

    if (!validarEmail(v.email)) return toast.error("E-mail inválido.");
    if (!validarTelefone(v.telefone_celular)) {
      return toast.error("Celular inválido. Informe DDD + número (ex.: (11) 99999-9999).");
    }
    const renda = Number(v.renda_total_declarada.replace(/\./g, "").replace(",", "."));
    if (isNaN(renda) || renda < 0) return toast.error("Renda inválida.");

    // Estado civil e cônjuge só se aplicam a Pessoa Física.
    const casado =
      ehPF && (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel");
    // Cônjuge é opcional no cadastro: permite salvar mesmo sem os dados preenchidos.
    if (casado && v.conjuge_cpf && !validarCPF(v.conjuge_cpf)) {
      return toast.error("CPF do cônjuge inválido.");
    }
    if (casado && v.conjuge_email && !validarEmail(v.conjuge_email)) {
      return toast.error("E-mail do cônjuge inválido.");
    }
    if (casado && v.conjuge_celular && !validarTelefone(v.conjuge_celular)) {
      return toast.error("Celular do cônjuge inválido.");
    }
    const rendaConjuge = v.conjuge_renda
      ? Number(v.conjuge_renda.replace(/\./g, "").replace(",", "."))
      : null;

    setSalvando(true);
    // Padrão do sistema: todos os campos de texto do cadastro são gravados
    // em MAIÚSCULAS. E-mails (case-sensitive para autenticação/entrega) e
    // valores puramente numéricos/mascarados ficam de fora.
    const up = (s: string | null | undefined) =>
      s ? s.trim().toLocaleUpperCase("pt-BR") : s ?? null;
    try {
      const payload = {
        tipo_pessoa: v.tipo_pessoa,
        nome: up(v.nome),
        documento: soDigitos(v.documento),
        documento_secundario: up(v.documento_secundario) || null,
        data_nascimento: v.data_nascimento,
        estado_civil: v.estado_civil as any,
        regime_casamento: (v.regime_casamento || null) as any,
        mae: up(v.mae) || null,
        pai: up(v.pai) || null,
        sexo: v.sexo || null,
        nacionalidade: up(v.nacionalidade) || null,
        naturalidade: up(v.naturalidade) || null,
        tipo_documento_identidade: v.tipo_documento_identidade || null,
        numero_documento: up(v.numero_documento) || null,
        orgao_expedidor: up(v.orgao_expedidor) || null,
        uf_expedicao: v.uf_expedicao || null,
        data_expedicao: v.data_expedicao || null,
        profissao: up(v.profissao) || null,
        empresa: up(v.empresa) || null,
        banco_conta: up(v.banco_conta) || null,
        agencia: up(v.agencia) || null,
        conta_corrente: up(v.conta_corrente) || null,
        digito_conta: up(v.digito_conta) || null,
        email: v.email.trim(),
        telefone_celular: soDigitos(v.telefone_celular),
        renda_total_declarada: renda,
        uf_interesse: v.uf_interesse || null,
        utiliza_fgts: v.utiliza_fgts,
        fg_autorizacao_dados: v.fg_autorizacao_dados,
        origem: v.origem as any,
        // Cônjuge: só envia quando casado/união estável; caso contrário limpa.
        conjuge_nome: casado ? up(v.conjuge_nome) || null : null,
        conjuge_cpf: casado ? soDigitos(v.conjuge_cpf) || null : null,
        conjuge_data_nascimento: casado ? v.conjuge_data_nascimento || null : null,
        conjuge_nome_mae: casado ? up(v.conjuge_nome_mae) || null : null,
        conjuge_sexo: casado ? v.conjuge_sexo || null : null,
        conjuge_nacionalidade: casado ? up(v.conjuge_nacionalidade) || null : null,
        conjuge_tipo_documento_identidade: casado ? v.conjuge_tipo_documento_identidade || null : null,
        conjuge_numero_documento: casado ? up(v.conjuge_numero_documento) || null : null,
        conjuge_orgao_expedidor: casado ? up(v.conjuge_orgao_expedidor) || null : null,
        conjuge_uf_expedicao: casado ? v.conjuge_uf_expedicao || null : null,
        conjuge_data_expedicao: casado ? v.conjuge_data_expedicao || null : null,
        conjuge_profissao: casado ? up(v.conjuge_profissao) || null : null,
        conjuge_empresa: casado ? up(v.conjuge_empresa) || null : null,
        conjuge_renda: casado ? rendaConjuge : null,
        conjuge_email: casado ? v.conjuge_email.trim() || null : null,
        conjuge_celular: casado ? soDigitos(v.conjuge_celular) || null : null,
        conjuge_banco_conta: casado ? up(v.conjuge_banco_conta) || null : null,
        conjuge_agencia: casado ? up(v.conjuge_agencia) || null : null,
        conjuge_conta_corrente: casado ? up(v.conjuge_conta_corrente) || null : null,
        conjuge_digito_conta: casado ? up(v.conjuge_digito_conta) || null : null,
      };
      let id = v.id;
      if (id) {
        await atualizar({ data: { id, ...payload } });
      } else {
        const r = await criar({ data: payload });
        id = r.id;
        // Cria os vínculos de atendimento selecionados no novo cadastro.
        const falhas: string[] = [];
        for (const vinc of vinculos) {
          try {
            await vincular({
              data: { cliente_id: id, parceiro_id: vinc.parceiro_id, tipo_vinculo: vinc.tipo_vinculo },
            });
          } catch (e: any) {
            falhas.push(`${nomeParceiro(vinc.parceiro_id)}: ${e?.message ?? "falha ao vincular"}`);
          }
        }
        if (falhas.length) {
          toast.error(`Não foi possível gravar alguns vínculos:\n${falhas.join("\n")}`);
        }

      }
      if (id && (end.cep || end.logradouro)) {
        const endUp = Object.fromEntries(
          Object.entries(end).map(([k, val]) => [
            k,
            typeof val === "string" && k !== "cep" ? up(val) : val,
          ]),
        );
        await salvarEnd({ data: { cliente_id: id, ...(endUp as typeof end) } });
      }
      // Cadastro criado a partir de uma proposta direta: vincula e volta à ficha.
      if (id && !v.id && vincularPropostaId) {
        try {
          await vincularProposta({ data: { proposta_id: vincularPropostaId, cliente_id: id } });
          await qc.invalidateQueries({ queryKey: ["proposta", vincularPropostaId] });
          if (enviarBancoAposVincular) {
            const tid = toast.loading("Cliente vinculado. Enviando proposta ao banco…");
            try {
              const r: any = await enviarProposta({ data: { proposta_id: vincularPropostaId } });
              const numero =
                r?.bancos?.find((x: any) => x?.numero_proposta_banco)?.numero_proposta_banco ?? null;
              toast.success(
                numero
                  ? `Proposta enviada ao banco. Nº do banco: ${numero}`
                  : "Proposta enviada ao banco. O número será atualizado em instantes.",
                { id: tid },
              );
              await qc.invalidateQueries({ queryKey: ["proposta", vincularPropostaId] });
              navigate({ to: "/operacional/propostas/$id", params: { id: vincularPropostaId } });
              return;
            } catch (envioErr: any) {
              toast.error(envioErr?.message ?? "Cliente salvo, mas o envio ao banco falhou.", { id: tid });
              navigate({
                to: "/operacional/propostas/$id",
                params: { id: vincularPropostaId },
                search: { complementar: 1 },
              });
              return;
            }
          }
          toast.success("Cliente cadastrado e vinculado à proposta.");
          navigate({ to: "/operacional/propostas/$id", params: { id: vincularPropostaId } });
          return;
        } catch (e: any) {
          toast.error(e?.message ?? "Cliente salvo, mas falhou ao vincular à proposta.");
        }
      }
      if (embutido) {
        // Embutido na ficha da proposta: apenas atualiza os dados e permanece na tela atual.
        if (id && v.id && vincularPropostaId) {
          await vincularProposta({ data: { proposta_id: vincularPropostaId, cliente_id: id } });
          await qc.invalidateQueries({ queryKey: ["proposta", vincularPropostaId] });
        }
        await qc.invalidateQueries({ queryKey: ["cliente", id] });
        toast.success("Cadastro salvo.");
        onSalvoEmbutido?.();
        return;
      }
      toast.success("Cliente salvo.");
      navigate({ to: "/crm/clientes/$id", params: { id: id! } });

    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const ehPF = v.tipo_pessoa === "PF";
  const casadoPF = ehPF && (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel");

  // Campos obrigatórios pendentes para envio da proposta ao banco (destaque em vermelho).
  const erros = useMemo(() => {
    const s = new Set<string>();
    if (!destacarObrigatorios) return s;
    const vazio = (x?: string | null) => !x || !String(x).trim();
    // Dados básicos / contato
    if (vazio(v.documento)) s.add("documento");
    if (vazio(v.nome)) s.add("nome");
    if (vazio(v.data_nascimento)) s.add("data_nascimento");
    if (vazio(v.email)) s.add("email");
    if (vazio(v.telefone_celular)) s.add("telefone_celular");
    if (vazio(v.renda_total_declarada)) s.add("renda_total_declarada");
    // Profissão
    if (vazio(v.profissao)) s.add("profissao");
    // Endereço
    if (vazio(end.cep)) s.add("cep");
    if (vazio(end.logradouro)) s.add("logradouro");
    if (vazio(end.numero)) s.add("numero");
    if (vazio(end.bairro)) s.add("bairro");
    if (vazio(end.cidade)) s.add("cidade");
    if (vazio(end.uf)) s.add("uf");
    // Autorização
    if (!v.fg_autorizacao_dados) s.add("fg_autorizacao_dados");
    // Somente PF
    if (ehPF) {
      if (vazio(v.estado_civil)) s.add("estado_civil");
      if (vazio(v.mae)) s.add("mae");
      if (vazio(v.sexo)) s.add("sexo");
    }
    return s;
  }, [destacarObrigatorios, v, end, ehPF]);

  // Ao acionar o destaque de obrigatórios (envio bloqueado por cadastro
  // incompleto), rola até o primeiro campo pendente e o foca, para que o
  // usuário veja imediatamente onde está o problema.
  const formRef = useRef<HTMLFormElement>(null);
  const focouObrigatoriosRef = useRef(false);
  useEffect(() => {
    if (!destacarObrigatorios) {
      focouObrigatoriosRef.current = false;
      return;
    }
    if (erros.size === 0 || focouObrigatoriosRef.current) return;
    focouObrigatoriosRef.current = true;
    const t = setTimeout(() => {
      const alvo = formRef.current?.querySelector<HTMLElement>(".border-destructive");
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof alvo.focus === "function") {
        try {
          alvo.focus({ preventScroll: true });
        } catch {
          /* ignora se o elemento não for focável */
        }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [destacarObrigatorios, erros.size]);


  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6 form-cadastro-upper">
      {novoCadastro && (
        <VinculosSection
          parceiros={(parceiros.data ?? []) as any}
          vinculos={vinculos}
          vinculoSel={vinculoSel}
          setVinculoSel={setVinculoSel}
          adicionarVinculo={adicionarVinculo}
          removerVinculo={removerVinculo}
          nomeParceiro={nomeParceiro}
          onCriarTipo={setCriarTipo}
        />
      )}

      {criarTipo && (
        <CriarVinculoInline
          aberto={criarTipo !== null}
          onOpenChange={(open) => {
            if (!open) setCriarTipo(null);
          }}
          tipoPessoa={TIPO_VINCULO_PESSOA[criarTipo][0]}
          rotuloTipo={TIPOS_VINCULO.find((t) => t.valor === criarTipo)?.rotulo ?? ""}
          onCriado={(id) => {
            const tipo = criarTipo;
            if (!tipo) return;
            setVinculos((prev) =>
              prev.some((x) => x.parceiro_id === id && x.tipo_vinculo === tipo)
                ? prev
                : [...prev, { parceiro_id: id, tipo_vinculo: tipo }],
            );
            parceiros.refetch();
          }}
        />
      )}

      <PortalSection
        temId={Boolean(v.id)}
        portal={portal}
        portalSalvando={portalSalvando}
        alternarPortal={alternarPortal}
      />

      <DadosBasicosSection v={v} set={set} setV={setV} erros={erros} />

      {casadoPF && <ConjugeSection v={v} set={set} />}

      <IdentidadeSection v={v} set={set} erros={erros} />

      <EnderecoSection
        end={end}
        setEnd={setEnd}
        buscandoCep={buscandoCep}
        buscarCep={buscarCep}
        erros={erros}
      />

      <FgtsSection v={v} set={set} erros={erros} />


      <BancariosSection v={v} set={set} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/crm/clientes" })}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar cliente"}
        </Button>
      </div>
    </form>
  );
}
