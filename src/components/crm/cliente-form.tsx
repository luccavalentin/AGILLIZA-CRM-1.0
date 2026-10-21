import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  criarCliente,
  clientePorDocumento,
  type ClienteDoDocumento,
  atualizarCliente,
  salvarEndereco,
  definirAcessoPortal,
  listarParceirosDisponiveis,
  vincularParceiro,
  TIPOS_VINCULO,
  TIPO_VINCULO_PESSOA,
  type TipoVinculo,
} from "@/lib/crm/clientes.functions";
import { vincularClienteAProposta } from "@/lib/propostas/propostas.functions";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
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
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { EmpresaSection } from "./cliente-form/empresa-section";
import { EnderecoSection } from "./cliente-form/endereco-section";
import { FgtsSection } from "./cliente-form/fgts-section";
import { BancariosSection } from "./cliente-form/bancarios-section";

import { mensagemDeErro } from "@/lib/erros/mensagem";
import { hojeISO } from "@/lib/financeiro/format";
import { usePermissao } from "@/hooks/use-permissao";

/** Documento que veio mascarado do servidor ("***.***.123-**") para quem não vê dados sensíveis. */
const ehMascarado = (doc: string | null | undefined) => Boolean(doc && doc.includes("*"));

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
  idBanco,
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
  vincularPropostaId?: string;
  embutido?: boolean;
  destacarObrigatorios?: boolean;
  enviarBancoAposVincular?: boolean;
  onSalvoEmbutido?: () => void;
  idBanco?: number;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarCliente);
  const buscarPorDocumento = useServerFn(clientePorDocumento);
  /** Documento já cadastrado: o operador decide antes de qualquer gravação. */
  const [duplicado, setDuplicado] = useState<
    (ClienteDoDocumento & { responder: (r: "atualizar" | "abrir" | "cancelar") => void }) | null
  >(null);
  const perguntarDuplicado = (c: ClienteDoDocumento) =>
    new Promise<"atualizar" | "abrir" | "cancelar">((responder) =>
      setDuplicado({ ...c, responder }),
    );
  const responderDuplicado = (r: "atualizar" | "abrir" | "cancelar") => {
    duplicado?.responder(r);
    setDuplicado(null);
  };
  const atualizar = useServerFn(atualizarCliente);
  const salvarEnd = useServerFn(salvarEndereco);
  const definirPortal = useServerFn(definirAcessoPortal);
  const listarParceiros = useServerFn(listarParceirosDisponiveis);
  const vincular = useServerFn(vincularParceiro);
  const vincularProposta = useServerFn(vincularClienteAProposta);
  const { enviar: handleEnviarHook } = useEnviarProposta();

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
    // Documento que já chega mascarado ("***.***.123-**", sem "Ver dados sensíveis")
    // fica como veio: a máscara de digitação comeria os asteriscos.
    if (base.documento && !ehMascarado(base.documento))
      base.documento = mascararDocumentoTipo(base.documento, base.tipo_pessoa);
    if (base.conjuge_cpf && !ehMascarado(base.conjuge_cpf))
      base.conjuge_cpf = mascararCPF(base.conjuge_cpf);
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
  // Cadastro novo exige "Criar"; alterar um existente (e o acesso ao portal) exige "Editar".
  // O servidor recusa sem elas: aqui só some o botão.
  const podeCriarCliente = usePermissao("crm.clientes", "create");
  const podeEditarCliente = usePermissao("crm.clientes", "edit");
  const podeSalvar = v.id ? podeEditarCliente : podeCriarCliente;
  const [portal, setPortal] = useState(Boolean(portalAtivo));
  const [portalSalvando, setPortalSalvando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Vínculos de atendimento: usuários a vincular ao criar um novo cliente, por tipo.
  const novoCadastro = !v.id;
  const [vinculos, setVinculos] = useState<
    Array<{ parceiro_id: string; tipo_vinculo: TipoVinculo }>
  >([]);
  const [vinculoSel, setVinculoSel] = useState<Record<string, string>>({});
  /** Campo recusado na última tentativa de salvar; some quando o cadastro muda. */
  const [campoComErro, setCampoComErro] = useState<string | null>(null);
  useEffect(() => {
    setCampoComErro(null);
  }, [v]);
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
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["clientes-stats"] });
    } catch (err: any) {
      setPortal(!ativo);
      toast.error(mensagemDeErro(err, "Não foi possível salvar o acesso."));
    } finally {
      setPortalSalvando(false);
    }
  }
  const set = <K extends keyof ClienteFormValues>(k: K, val: ClienteFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // Foca no primeiro campo com erro quando destacarObrigatorios é ativado
  useEffect(() => {
    if (destacarObrigatorios) {
      const t = setTimeout(() => {
        const alvo = document.querySelector<HTMLElement>(".border-destructive");
        // Rola no container pai com scroll (DialogContent ou o próprio div se não houver Dialog)
        alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
        alvo?.focus?.();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [destacarObrigatorios]);

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
    setCampoComErro(null);
    /** Avisa e marca o campo em vermelho, levando o cursor até ele. */
    const falhar = (campo: string, msg: string) => {
      setCampoComErro(campo);
      // Mesmo id: o aviso novo substitui o anterior em vez de empilhar.
      toast.error(msg, { id: "cliente-form-validacao" });
    };

    // Nome / razão social
    if (!v.nome.trim()) {
      return falhar("nome", ehPF ? "Informe o nome completo." : "Informe a razão social.");
    }

    // Documento: CPF (11 dígitos) para PF, CNPJ (14 dígitos) para PJ. Mascarado (quem não
    // vê dados sensíveis editando a ficha): não se valida nem se grava — o servidor ignora.
    const docMascarado = Boolean(v.id) && ehMascarado(v.documento);
    const docDigitos = soDigitos(v.documento);
    if (!docMascarado) {
      if (!docDigitos) {
        return falhar("documento", ehPF ? "Informe o CPF." : "Informe o CNPJ.");
      }
      if (ehPF && docDigitos.length !== 11) {
        return falhar("documento", "O CPF deve conter 11 dígitos.");
      }
      if (!ehPF && docDigitos.length !== 14) {
        return falhar("documento", "O CNPJ deve conter 14 dígitos.");
      }
      if (!validarDocumento(docDigitos, v.tipo_pessoa)) {
        return falhar("documento", ehPF ? "CPF inválido." : "CNPJ inválido.");
      }
    }

    // Data de nascimento (PF) / abertura (PJ)
    if (!v.data_nascimento) {
      return falhar(
        "data_nascimento",
        ehPF ? "Informe a data de nascimento." : "Informe a data de abertura.",
      );
    }
    if (v.data_nascimento > hojeISO()) {
      return falhar(
        "data_nascimento",
        ehPF
          ? "A data de nascimento não pode estar no futuro."
          : "A data de abertura não pode estar no futuro.",
      );
    }

    if (!validarEmail(v.email)) return falhar("email", "E-mail inválido.");
    if (!validarTelefone(v.telefone_celular)) {
      return falhar(
        "telefone_celular",
        "Celular inválido. Informe DDD + número (ex.: (11) 99999-9999).",
      );
    }
    const renda = Number(v.renda_total_declarada.replace(/\./g, "").replace(",", "."));
    /** "1.234,56" -> 1234.56; vazio/invalido -> null. */
    const numeroOuNulo = (txt?: string | null) => {
      const limpo = String(txt ?? "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();
      if (!limpo) return null;
      const n = Number(limpo);
      return Number.isFinite(n) ? n : null;
    };
    if (isNaN(renda) || renda < 0) return falhar("renda_total_declarada", "Renda inválida.");

    // Estado civil e cônjuge só se aplicam a Pessoa Física.
    const casado = ehPF && (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel");
    // Cônjuge é opcional no cadastro: permite salvar mesmo sem os dados preenchidos.
    // Erros do cônjuge também marcam o campo (antes só aparecia o aviso flutuante).
    if (casado && v.conjuge_cpf && !ehMascarado(v.conjuge_cpf) && !validarCPF(v.conjuge_cpf)) {
      return falhar("conjuge_cpf", "CPF do cônjuge inválido.");
    }
    if (casado && v.conjuge_data_nascimento && v.conjuge_data_nascimento > hojeISO()) {
      return falhar(
        "conjuge_data_nascimento",
        "A data de nascimento do cônjuge não pode estar no futuro.",
      );
    }
    if (casado && v.conjuge_email && !validarEmail(v.conjuge_email)) {
      return falhar("conjuge_email", "E-mail do cônjuge inválido.");
    }
    if (casado && v.conjuge_celular && !validarTelefone(v.conjuge_celular)) {
      return falhar("conjuge_celular", "Celular do cônjuge inválido.");
    }
    const rendaConjuge = v.conjuge_renda
      ? Number(v.conjuge_renda.replace(/\./g, "").replace(",", "."))
      : null;

    setSalvando(true);
    // Padrão do sistema: todos os campos de texto do cadastro são gravados
    // em MAIÚSCULAS. E-mails (case-sensitive para autenticação/entrega) e
    // valores puramente numéricos/mascarados ficam de fora.
    const up = (s: string | null | undefined) =>
      s ? s.trim().toLocaleUpperCase("pt-BR") : (s ?? null);
    try {
      const payload = {
        tipo_pessoa: v.tipo_pessoa,
        nome: up(v.nome),
        documento: docMascarado ? v.documento : soDigitos(v.documento),
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
        // Campos da empresa: só fazem sentido em PJ; em PF vão nulos para não
        // deixar resíduo de um cadastro que trocou de tipo.
        tipo_empresa: ehPF ? null : v.tipo_empresa || null,
        faturamento_empresa: ehPF ? null : numeroOuNulo(v.faturamento_empresa),
        patrimonio_liquido_empresa: ehPF ? null : numeroOuNulo(v.patrimonio_liquido_empresa),
        capital_social_empresa: ehPF ? null : numeroOuNulo(v.capital_social_empresa),
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
        conjuge_tipo_documento_identidade: casado
          ? v.conjuge_tipo_documento_identidade || null
          : null,
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
        await atualizar({
          data: { id, ...payload, endereco_em_seguida: Boolean(end.cep || end.logradouro) },
        });
      } else {
        const existente = await buscarPorDocumento({ data: { documento: payload.documento } });
        if (existente) {
          const escolha = await perguntarDuplicado(existente);
          if (escolha === "abrir" && existente.id) {
            navigate({ to: "/crm/clientes/$id", params: { id: existente.id } });
            return;
          }
          if (escolha !== "atualizar") return;
        }
        const r = await criar({ data: { ...payload, atualizar_existente: Boolean(existente) } });
        id = r.id;
        // Cria os vínculos de atendimento selecionados no novo cadastro.
        const falhas: string[] = [];
        for (const vinc of vinculos) {
          try {
            await vincular({
              data: {
                cliente_id: id,
                parceiro_id: vinc.parceiro_id,
                tipo_vinculo: vinc.tipo_vinculo,
              },
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
            await handleEnviarHook({
              propostaId: vincularPropostaId,
              bancoId: "todos",
            });
            await qc.invalidateQueries({ queryKey: ["proposta", vincularPropostaId] });

            navigate({ to: "/operacional/propostas/$id", params: { id: vincularPropostaId } });
            return;
          }
          toast.success("Cliente cadastrado e vinculado à proposta.");
          navigate({ to: "/operacional/propostas/$id", params: { id: vincularPropostaId } });
          return;
        } catch (e: any) {
          toast.error(mensagemDeErro(e, "Cliente salvo, mas falhou ao vincular à proposta."));
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
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      await qc.invalidateQueries({ queryKey: ["clientes-stats"] });
      // A ficha (cabeçalho e resumo) lê ["cliente", id]: sem isto ficava com os dados antigos.
      await qc.invalidateQueries({ queryKey: ["cliente", id] });
      await qc.invalidateQueries({ queryKey: ["cliente-hist", id] });
      await qc.invalidateQueries({ queryKey: ["cliente-historico", id] });
      toast.success("Cliente salvo.");
      navigate({ to: "/crm/clientes/$id", params: { id: id! } });
    } catch (err: any) {
      toast.error(mensagemDeErro(err, "Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  }

  const ehPF = v.tipo_pessoa === "PF";
  const casadoPF = ehPF && (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel");

  // Campos obrigatórios pendentes para envio da proposta ao banco (destaque em vermelho).
  const erros = useMemo(() => {
    const s = new Set<string>();
    // Campo recusado na última tentativa de salvar (vale sempre).
    if (campoComErro) s.add(campoComErro);
    if (!destacarObrigatorios) return s;
    const vazio = (x?: string | null) => !x || !String(x).trim();
    // Dados básicos / contato
    if (vazio(v.documento)) s.add("documento");
    if (vazio(v.nome)) s.add("nome");
    // Vale para os dois tipos: em PF é a data de nascimento, em PJ a data de
    // abertura (a integração pede `dataRegistroEmpresa`). O rótulo do campo
    // já muda conforme o tipo.
    if (vazio(v.data_nascimento)) s.add("data_nascimento");
    if (vazio(v.email)) s.add("email");
    if (vazio(v.telefone_celular)) s.add("telefone_celular");
    if (
      idBanco === 33 &&
      ehPF &&
      (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") &&
      vazio(v.regime_casamento)
    ) {
      s.add("regime_casamento");
    }

    if (vazio(v.renda_total_declarada)) s.add("renda_total_declarada");
    // Profissão só faz sentido para pessoa física; a empresa informa
    // faturamento, não profissão.
    if (ehPF && vazio(v.profissao)) s.add("profissao");
    // Endereço
    if (vazio(end.cep)) s.add("cep");
    if (vazio(end.logradouro)) s.add("logradouro");
    if (vazio(end.numero)) s.add("numero");
    if (vazio(end.bairro)) s.add("bairro");
    if (vazio(end.cidade)) s.add("cidade");
    if (vazio(end.uf)) s.add("uf");
    // Autorização
    if (!v.fg_autorizacao_dados) s.add("fg_autorizacao_dados");
    // Somente PJ — a integração recusa o participante sem natureza jurídica.
    if (!ehPF && vazio(v.tipo_empresa)) s.add("tipo_empresa");
    // Somente PF
    if (ehPF) {
      if (vazio(v.estado_civil)) s.add("estado_civil");
      if (vazio(v.mae)) s.add("mae");
      if (vazio(v.sexo)) s.add("sexo");
    }
    return s;
  }, [destacarObrigatorios, v, end, ehPF, campoComErro]);

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

  // Ao salvar com erro, leva o cursor ao campo recusado (antes só aparecia a
  // mensagem flutuante e a pessoa tinha que procurar o campo no formulário).
  useEffect(() => {
    if (!campoComErro) return;
    const t = setTimeout(() => {
      const alvo = formRef.current?.querySelector<HTMLElement>(".border-destructive");
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      try {
        alvo.focus({ preventScroll: true });
      } catch {
        /* ignora se o elemento não for focável */
      }
    }, 100);
    return () => clearTimeout(t);
  }, [campoComErro]);

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

      {(!v.id || podeEditarCliente) && (
        <PortalSection
          temId={Boolean(v.id)}
          portal={portal}
          portalSalvando={portalSalvando}
          alternarPortal={alternarPortal}
        />
      )}

      <DadosBasicosSection v={v} set={set} setV={setV} erros={erros} idBanco={idBanco} />

      {casadoPF && <ConjugeSection v={v} set={set} erros={erros} />}

      {/* Profissão e empresa onde trabalha são de pessoa física; a empresa
          informa faturamento, não profissão. */}
      {ehPF && <IdentidadeSection v={v} set={set} erros={erros} />}
      {!ehPF && <EmpresaSection v={v} set={set} erros={erros} />}

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
        {podeSalvar && (
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar cliente"}
          </Button>
        )}
      </div>

      <AlertDialog
        open={!!duplicado}
        onOpenChange={(aberto) => !aberto && responderDuplicado("cancelar")}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {duplicado?.excluido
                ? "Este documento é de um cliente excluído"
                : "Este documento já está cadastrado"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {duplicado?.nome
                ? `${duplicado.nome} (${duplicado.numero_cliente}) já usa este ${ehPF ? "CPF" : "CNPJ"}.`
                : `Já existe um cliente com este ${ehPF ? "CPF" : "CNPJ"}, fora da sua carteira.`}{" "}
              {duplicado?.excluido
                ? "Salvar restaura esse cadastro com os dados deste formulário."
                : "Salvar substitui os dados dele pelos deste formulário — não cria um cliente novo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* flex-wrap: com três botões, "Voltar" ficava cortado à esquerda. */}
          <AlertDialogFooter className="flex-wrap gap-2 sm:space-x-0">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            {duplicado?.id && !duplicado.excluido && (
              <Button type="button" variant="outline" onClick={() => responderDuplicado("abrir")}>
                Abrir cadastro existente
              </Button>
            )}
            <Button type="button" onClick={() => responderDuplicado("atualizar")}>
              {duplicado?.excluido ? "Restaurar e atualizar" : "Atualizar o existente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
