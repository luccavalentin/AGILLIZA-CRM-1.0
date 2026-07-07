import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { ConsultandoOverlay } from "@/components/simulacao/consultando-overlay";
import { ClienteCRMPicker } from "@/components/simulacao/cliente-crm-picker";
import { estadoCivilCrmParaCodigo } from "@/lib/propostas/dominios";
import { DicaRendaMinima } from "@/components/simulacao/dica-renda-minima";
import { avaliarRendaMinima } from "@/lib/simulacao/renda";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";

import {
  completaSchema,
  ESTADOS_CIVIS,
  TIPOS_IMOVEL,
  USOS_IMOVEL,
  SITUACOES_IMOVEL,
  PRODUTOS,
} from "@/lib/simulacao/schemas";
import { UFS, maskCpfCnpj, maskCelular, formatBRL } from "@/lib/simulacao/format";
import {
  ajustarPrazoPorIdade,
  prazoMaximoPorIdade,
  formatarMeses,
} from "@/lib/simulacao/prazo";
import {
  listarBancosAtivos,
  listarOperacoes,
  criarSimulacao,
  enviarSimulacaoBanco,
  obterSimulacao,
} from "@/lib/simulacao/simulacoes.functions";
import { baixarSimulacaoPDF } from "@/lib/simulacao/simulacao-pdf";
import { criarProposta } from "@/lib/propostas/propostas.functions";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/completa")({
  head: () => ({ meta: [{ title: "Simulação completa — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { duplicar?: string; origem?: "proposta" } => ({
    duplicar: typeof search.duplicar === "string" ? search.duplicar : undefined,
    origem: search.origem === "proposta" ? "proposta" : undefined,
  }),
  component: Pagina,
});

type Form = Record<string, any>;

function Pagina() {
  const router = useRouter();
  const { duplicar, origem: origemFluxo } = Route.useSearch();
  const modoProposta = origemFluxo === "proposta";
  const criarPropostaFn = useServerFn(criarProposta);
  const [gerarProposta, setGerarProposta] = useState(modoProposta);
  const [f, setF] = useState<Form>({
    produto: "financiamento_imobiliario",
    tipo_imovel: "",
    uso_imovel: "",
    situacao_imovel: "",
    uf: "",
    valor_imovel: 0,
    valor_entrada: 0,
    valor_financiamento: 0,
    prazo: 360,
    utiliza_fgts: "N",
    fg_financiar_despesas: false,
    sistema_amortizacao: "S",
    nome_cliente: "",
    cpf_cnpj: "",
    renda_total: 0,
    data_nascimento: "",
    estado_civil: "",
    email: "",
    celular: "",
    possui_conjuge: false,
    compoe_renda: false,
    bancos_ids: [] as string[],
    consentimento_lgpd: false,
    consentimento_scr: false,
    email_verificado_em: null,
  });
  const [enviando, setEnviando] = useState(false);
  const [concluidos, setConcluidos] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [entradaTocada, setEntradaTocada] = useState(false);
  const [confirmRenda, setConfirmRenda] = useState<null | {
    rendaMinima: number;
    rendaInformada: number;
  }>(null);

  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });
  const { data: operacoes } = useQuery({
    queryKey: ["operacoes"],
    queryFn: () => listarOperacoes(),
  });

  // Carrega a simulação de origem quando estamos duplicando.
  const { data: origem } = useQuery({
    queryKey: ["simulacao-duplicar", duplicar],
    queryFn: () => obterSimulacao({ data: { id: duplicar as string } }),
    enabled: Boolean(duplicar),
  });

  // pré-preenche do wizard (consome e limpa imediatamente para não fixar o cliente)
  useEffect(() => {
    if (duplicar) return; // ao duplicar, os dados vêm da simulação de origem
    const raw = sessionStorage.getItem("simulacao_wizard");
    if (raw) {
      sessionStorage.removeItem("simulacao_wizard");
      try {
        const w = JSON.parse(raw);
        setF((prev) => ({ ...prev, ...w }));
      } catch {
        /* ignore */
      }
    }
  }, [duplicar]);

  // pré-preenche a partir da simulação duplicada (novo nº é gerado ao salvar)
  useEffect(() => {
    if (!origem?.simulacao) return;
    const s = origem.simulacao as any;
    const valorImovel = Number(s.valor_imovel) || 0;
    const valorFin = Number(s.valor_financiamento) || 0;
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      produto: s.produto ?? prev.produto,
      tipo_imovel: s.tipo_imovel ?? "",
      uso_imovel: s.uso_imovel ?? "",
      situacao_imovel: s.situacao_imovel ?? "",
      uf: s.uf ?? "",
      cep_imovel: s.cep_imovel ?? prev.cep_imovel,
      valor_imovel: valorImovel,
      valor_entrada: Math.max(0, valorImovel - valorFin),
      valor_financiamento: valorFin,
      prazo: Number(s.prazo) || prev.prazo,
      utiliza_fgts: s.utiliza_fgts ?? "N",
      fg_financiar_despesas: Boolean(s.fg_financiar_despesas),
      sistema_amortizacao: s.sistema_amortizacao ?? "S",
      cliente_id: s.cliente_id ?? prev.cliente_id,
      nome_cliente: s.nome_cliente ?? "",
      cpf_cnpj: s.cpf_cnpj ?? "",
      renda_total: Number(s.renda_total) || 0,
      renda_conjuge: Number(s.renda_conjuge) || 0,
      data_nascimento: s.data_nascimento ?? "",
      estado_civil: s.estado_civil ?? "",
      email: s.email ?? "",
      celular: s.celular ?? "",
      possui_conjuge: Boolean(s.possui_conjuge),
      compoe_renda: Boolean(s.compoe_renda),
      consentimento_lgpd: Boolean(s.consentimento_lgpd),
      consentimento_scr: Boolean(s.consentimento_scr),
      bancos_ids: (origem.bancos ?? [])
        .map((b: any) => b.banco_id)
        .filter(Boolean),
      email_verificado_em: null,
    }));
  }, [origem]);


  // default bancos padrão
  useEffect(() => {
    if (bancos && f.bancos_ids.length === 0) {
      const padrao = bancos.filter((b) => b.flag_padrao).map((b) => b.id);
      if (padrao.length > 0) setF((prev) => ({ ...prev, bancos_ids: padrao }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancos]);

  const idOperacao = useMemo(() => {
    const op = operacoes?.find((o) => o.produto_sistema === f.produto);
    return op?.id_operacao ?? null;
  }, [operacoes, f.produto]);

  function set(k: string, v: any) {
    if (k === "valor_entrada") setEntradaTocada(true);
    setF((prev) => {
      const next = { ...prev, [k]: v };
      // Sugere 20% de entrada automaticamente enquanto o usuário não editar o campo manualmente.
      if (k === "valor_imovel" && !entradaTocada)
        next.valor_entrada = Math.round((next.valor_imovel || 0) * 0.2);
      if (k === "valor_imovel" || k === "valor_entrada")
        next.valor_financiamento = Math.max(0, next.valor_imovel - next.valor_entrada);
      if (k === "estado_civil") next.possui_conjuge = v === "CA" || v === "UE";
      return next;
    });
  }

  const maxPrazoIdade = useMemo(
    () => prazoMaximoPorIdade(f.data_nascimento),
    [f.data_nascimento],
  );

  // Melhor taxa (menor) entre os bancos selecionados — estima a renda mínima.
  const melhorTaxaAno = useMemo(() => {
    const selecionados = (bancos ?? []).filter((b) => f.bancos_ids.includes(b.id));
    const base = selecionados.length > 0 ? selecionados : (bancos ?? []);
    if (base.length === 0) return 0.1199;
    return Math.min(...base.map((b) => taxaAnoDeBanco(b.codigo_banco)));
  }, [bancos, f.bancos_ids]);

  // Renda total considerando composição de renda do cônjuge/coobrigado.
  const rendaConsiderada = useMemo(
    () => (Number(f.renda_total) || 0) + (f.compoe_renda ? Number(f.renda_conjuge) || 0 : 0),
    [f.renda_total, f.compoe_renda, f.renda_conjuge],
  );



  /** Aplica o prazo digitado, ajustando automaticamente pela regra de idade. */
  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(valor, f.data_nascimento);
    if (ajustado && mensagem) toast.warning(mensagem);
    set("prazo", prazo);
  }

  // Reajusta o prazo se a data de nascimento reduzir o máximo permitido.
  useEffect(() => {
    if (maxPrazoIdade != null && f.prazo > maxPrazoIdade) {
      const { mensagem } = ajustarPrazoPorIdade(f.prazo, f.data_nascimento);
      if (mensagem) toast.warning(mensagem);
      set("prazo", maxPrazoIdade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrazoIdade]);



  function aplicarEntradaSugerida() {
    setEntradaTocada(true);
    setF((prev) => {
      const entrada = Math.round((prev.valor_imovel || 0) * 0.2);
      return {
        ...prev,
        valor_entrada: entrada,
        valor_financiamento: Math.max(0, prev.valor_imovel - entrada),
      };
    });
  }

  // Apenas o Bradesco opera pelo sistema PRICE.
  function isBradesco(b: { codigo_banco?: number | string | null; nome_banco?: string | null }) {
    return (
      String(b.codigo_banco ?? "").replace(/^0+/, "") === "237" ||
      (b.nome_banco ?? "").toLowerCase().includes("bradesco")
    );
  }

  function setSistemaAmortizacao(v: string) {
    if (v === "P") {
      const bradesco = (bancos ?? []).filter(isBradesco).map((b) => b.id);
      if (bradesco.length === 0) {
        toast.error("O sistema PRICE está disponível apenas no Bradesco, que não está habilitado.");
      } else {
        toast.info("O sistema PRICE é oferecido somente pelo Bradesco. Apenas o Bradesco foi selecionado.");
      }
      setF((prev) => ({ ...prev, sistema_amortizacao: v, bancos_ids: bradesco }));
      return;
    }
    set("sistema_amortizacao", v);
  }

  function toggleBanco(id: string) {
    setF((prev) => {
      const banco = (bancos ?? []).find((b) => b.id === id);
      const has = prev.bancos_ids.includes(id);
      // No PRICE, só o Bradesco pode ser selecionado.
      if (prev.sistema_amortizacao === "P" && !has && banco && !isBradesco(banco)) {
        toast.info("No sistema PRICE, somente o Bradesco pode ser selecionado.");
        return prev;
      }
      return {
        ...prev,
        bancos_ids: has
          ? prev.bancos_ids.filter((x: string) => x !== id)
          : [...prev.bancos_ids, id],
      };
    });
  }


  const mostraConjuge = f.possui_conjuge || f.compoe_renda;

  // Habilita a inversão apenas quando os dados essenciais do cônjuge já existem.
  const podeInverter = useMemo(() => {
    return (
      mostraConjuge &&
      String(f.nome_conjuge ?? "").trim().length >= 3 &&
      String(f.cpf_conjuge ?? "").trim().length > 0 &&
      String(f.data_nascimento_conjuge ?? "").trim().length > 0
    );
  }, [mostraConjuge, f.nome_conjuge, f.cpf_conjuge, f.data_nascimento_conjuge]);

  /**
   * Inverte titular ⇄ cônjuge: quem era proponente vira cônjuge e vice-versa.
   * Mantém possui_conjuge/compoe_renda para o bloco do cônjuge continuar visível.
   */
  function inverterPrincipal() {
    setF((prev) => ({
      ...prev,
      // Titular recebe os dados do cônjuge
      nome_cliente: prev.nome_conjuge ?? "",
      cpf_cnpj: prev.cpf_conjuge ?? "",
      renda_total: Number(prev.renda_conjuge) || 0,
      data_nascimento: prev.data_nascimento_conjuge ?? "",
      estado_civil: prev.estado_civil_conjuge || prev.estado_civil,
      email: prev.email_conjuge ?? "",
      celular: prev.celular_conjuge ?? "",
      // Cônjuge recebe os dados do titular
      nome_conjuge: prev.nome_cliente ?? "",
      cpf_conjuge: prev.cpf_cnpj ?? "",
      renda_conjuge: Number(prev.renda_total) || 0,
      data_nascimento_conjuge: prev.data_nascimento ?? "",
      estado_civil_conjuge: prev.estado_civil || prev.estado_civil_conjuge,
      email_conjuge: prev.email ?? "",
      celular_conjuge: prev.celular ?? "",
      // O vínculo veio de um cliente do CRM que agora é o cônjuge — solta o vínculo.
      cliente_id: null,
    }));
    setErros({});
    toast.success("Titular e cônjuge invertidos. Confira os dados obrigatórios.");
  }

  /** Verifica a renda contra o sugestivo; abre o popup de confirmação se insuficiente. */
  function rendaSuficiente(): boolean {
    const av = avaliarRendaMinima({
      valor_financiamento: f.valor_financiamento,
      prazo_meses: f.prazo,
      taxa_ano: melhorTaxaAno,
      sistema: f.sistema_amortizacao === "P" ? "P" : "S",
      renda_informada: rendaConsiderada,
    });
    if (av && av.suficiente === false) {
      setConfirmRenda({ rendaMinima: av.rendaMinima, rendaInformada: rendaConsiderada });
      return false;
    }
    return true;
  }

  async function enviar() {
    const parsed = completaSchema.safeParse({ ...f, id_operacao_homefin: idOperacao });
    if (!parsed.success) {
      const novos: Record<string, string> = {};
      for (const issue of parsed.error.issues) novos[String(issue.path[0])] = issue.message;
      setErros(novos);
      toast.error("Revise os campos destacados.");
      return;
    }
    setErros({});
    if (!rendaSuficiente()) return;
    await executarEnvio();
  }

  async function executarEnvio() {
    const parsed = completaSchema.safeParse({ ...f, id_operacao_homefin: idOperacao });
    if (!parsed.success) {
      toast.error("Revise os campos destacados.");
      return;
    }
    setErros({});
    setConcluidos(0);
    setEnviando(true);
    try {
      const { id } = await criarSimulacao({
        data: {
          modo: "completa",
          dados: {
            ...parsed.data,
            id_operacao_homefin: idOperacao,
            email_verificado_em: f.email_verificado_em,
          } as any,
        },
      });
      sessionStorage.removeItem("simulacao_wizard");
      try {
        await enviarSimulacaoBanco({ data: { simulacao_id: id } });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Falha ao enviar ao banco. Você pode reenviar na tela da simulação.",
        );
      }
      // Marca todos os bancos como concluídos para a barra chegar a 100%.
      setConcluidos(f.bancos_ids.length || 1);

      // Baixa o extrato imediatamente: detalhado (1 banco) ou comparativo (2+).
      let dadosSim: any = null;
      try {
        dadosSim = await obterSimulacao({ data: { id } });
        baixarSimulacaoPDF({ simulacao: dadosSim.simulacao, bancos: dadosSim.bancos });
      } catch {
        /* download opcional — a simulação já foi criada */
      }

      // Fluxo "Nova Proposta": cria a proposta e envia direto ao banco vencedor.
      if (gerarProposta) {
        try {
          const bancos = (dadosSim?.bancos ?? []).filter(
            (b: any) => b.status_banco === "simulada",
          );
          // Escolhe o banco vencedor pela menor parcela quando houver simulação retornada.
          const vencedor = bancos
            .slice()
            .sort(
              (a: any, b: any) =>
                (Number(a.valor_parcela) || Infinity) - (Number(b.valor_parcela) || Infinity),
            )[0];
          const proposta = await criarPropostaFn({
            data: {
              simulacao_id: id,
              banco_id: vencedor?.banco_id ?? undefined,
            },
          });
          toast.success(`Proposta ${proposta.numero_proposta} criada e enviada ao banco.`);
          router.navigate({
            to: "/operacional/propostas/$id",
            params: { id: proposta.proposta_id },
            search: { complementar: 1 },
          });
          return;
        } catch (e) {
          toast.error(
            e instanceof Error
              ? `Simulação criada, mas a proposta falhou: ${e.message}`
              : "Simulação criada, mas não foi possível gerar a proposta.",
          );
        }
      }
      router.navigate({ to: "/operacional/simulacoes/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a simulação.");
      setEnviando(false);
      setConcluidos(0);
    }
  }

  const err = (k: string) => erros[k] && <p className="text-xs text-destructive">{erros[k]}</p>;
  const Ast = () => <span className="text-destructive">*</span>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        onClick={() =>
          router.history.canGoBack()
            ? router.history.back()
            : router.navigate({ to: "/operacional/simulacoes" })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <div>

        <h1 className="text-xl font-semibold text-primary">
          {modoProposta ? "Nova Proposta" : "Solicitar Simulação Completa"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {modoProposta
            ? "Preencha a simulação completa e envie direto ao banco — a proposta é criada automaticamente."
            : "Preencha os dados para enviar aos bancos parceiros."}
        </p>
      </div>

      {/* Bloco 1 — Operação/Imóvel */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Operação e imóvel</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo
            label={
              <>
                Produto <Ast />
              </>
            }
          >
            <Select value={f.produto} onValueChange={(v) => set("produto", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo
            label={
              <>
                Tipo de imóvel <Ast />
              </>
            }
          >
            <Select value={f.tipo_imovel} onValueChange={(v) => set("tipo_imovel", v)}>
              <SelectTrigger aria-invalid={!!erros.tipo_imovel}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_IMOVEL.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("tipo_imovel")}
          </Campo>
          <Campo
            label={
              <>
                Uso do imóvel <Ast />
              </>
            }
          >
            <Select value={f.uso_imovel} onValueChange={(v) => set("uso_imovel", v)}>
              <SelectTrigger aria-invalid={!!erros.uso_imovel}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {USOS_IMOVEL.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("uso_imovel")}
          </Campo>
          <Campo
            label={
              <>
                Situação do imóvel <Ast />
              </>
            }
          >
            <Select value={f.situacao_imovel} onValueChange={(v) => set("situacao_imovel", v)}>
              <SelectTrigger aria-invalid={!!erros.situacao_imovel}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {SITUACOES_IMOVEL.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("situacao_imovel")}
          </Campo>
          <Campo
            label={
              <>
                UF <Ast />
              </>
            }
          >
            <Select value={f.uf} onValueChange={(v) => set("uf", v)}>
              <SelectTrigger aria-invalid={!!erros.uf}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("uf")}
          </Campo>
        </div>
        <Separator className="border-border/60" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo
            label={
              <>
                Valor do imóvel (R$) <Ast />
              </>
            }
          >
            <CurrencyInput
              value={f.valor_imovel}
              onChange={(v) => set("valor_imovel", v)}
              placeholder="Ex: 500.000,00"
            />
            {err("valor_imovel")}
          </Campo>
          <Campo
            label={
              <>
                Valor de entrada (R$) <Ast />
              </>
            }
          >
            <CurrencyInput
              value={f.valor_entrada}
              onChange={(v) => set("valor_entrada", v)}
              placeholder="Ex: 100.000,00"
            />
            {f.valor_imovel > 0 && (
              <p className="text-xs text-muted-foreground">
                Entrada sugerida (20%):{" "}
                <span className="font-medium text-foreground">
                  {formatBRL(Math.round(f.valor_imovel * 0.2))}
                </span>
                {f.valor_entrada !== Math.round(f.valor_imovel * 0.2) && (
                  <button
                    type="button"
                    onClick={aplicarEntradaSugerida}
                    className="ml-2 font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Aplicar
                  </button>
                )}
              </p>
            )}
          </Campo>

          <Campo
            label={
              <>
                Prazo (meses) <Ast />
              </>
            }
          >
            <Input
              type="number"
              min={60}
              max={maxPrazoIdade ?? 420}
              step={12}
              value={f.prazo || ""}
              onChange={(e) => set("prazo", Number(e.target.value))}
              onBlur={(e) => definirPrazo(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              aria-invalid={!!erros.prazo}
            />
            {maxPrazoIdade != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Máximo para a idade: {maxPrazoIdade} meses ({formatarMeses(maxPrazoIdade)})
              </p>
            )}
            {err("prazo")}

          </Campo>
          <Campo
            label={
              <>
                Utiliza FGTS? <Ast />
              </>
            }
          >
            <Select value={f.utiliza_fgts} onValueChange={(v) => set("utiliza_fgts", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Sim</SelectItem>
                <SelectItem value="N">Não</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo
            label={
              <>
                Sistema de amortização <Ast />
              </>
            }
          >
            <Select
              value={f.sistema_amortizacao}
              onValueChange={setSistemaAmortizacao}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">SAC</SelectItem>
                <SelectItem value="P">PRICE</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Financiar despesas?">
            <label className="flex items-center gap-2 py-2 text-sm text-foreground">
              <Checkbox
                checked={!!f.fg_financiar_despesas}
                onCheckedChange={(v) => set("fg_financiar_despesas", v === true)}
              />
              Incluir as despesas no valor financiado
            </label>
          </Campo>
        </div>
      </section>

      <Separator className="border-border/60" />

      {/* Bloco 2 — Titular */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-foreground">Titular</h2>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="w-full sm:w-72">
              <ClienteCRMPicker
                selecionado={f.cliente_id ? f.nome_cliente : null}
                onSelect={(c) => {
                  const ec = estadoCivilCrmParaCodigo(c.estado_civil);
                  const temConjuge = ec === "CA" || ec === "UE";
                  const conjugePreenchido = Boolean(
                    c.conjuge_nome || c.conjuge_cpf || c.conjuge_renda,
                  );
                  setF((prev) => ({
                    ...prev,
                    cliente_id: c.id,
                    nome_cliente: c.nome ?? "",
                    cpf_cnpj: c.documento ? maskCpfCnpj(c.documento) : "",
                    email: c.email ?? "",
                    celular: c.telefone_celular ? maskCelular(c.telefone_celular) : "",
                    data_nascimento: c.data_nascimento ?? "",
                    estado_civil: ec || prev.estado_civil,
                    renda_total: c.renda_total_declarada ?? prev.renda_total,
                    possui_conjuge: temConjuge,
                    compoe_renda: prev.compoe_renda || (temConjuge && Number(c.conjuge_renda) > 0),
                    nome_conjuge: c.conjuge_nome ?? "",
                    cpf_conjuge: c.conjuge_cpf ? maskCpfCnpj(c.conjuge_cpf) : "",
                    renda_conjuge: c.conjuge_renda ?? 0,
                    data_nascimento_conjuge: c.conjuge_data_nascimento ?? "",
                    email_conjuge: c.conjuge_email ?? "",
                    celular_conjuge: c.conjuge_celular ? maskCelular(c.conjuge_celular) : "",
                  }));
                  toast.success(
                    conjugePreenchido
                      ? "Dados do cliente e do cônjuge preenchidos."
                      : "Dados do cliente preenchidos.",
                  );
                }}
              />
            </div>
            {f.cliente_id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setF((prev) => ({
                    ...prev,
                    cliente_id: null,
                    nome_cliente: "",
                    cpf_cnpj: "",
                    email: "",
                    celular: "",
                    data_nascimento: "",
                    estado_civil: "",
                    renda_total: 0,
                    possui_conjuge: false,
                    compoe_renda: false,
                    nome_conjuge: "",
                    cpf_conjuge: "",
                    renda_conjuge: 0,
                    data_nascimento_conjuge: "",
                    email_conjuge: "",
                    celular_conjuge: "",
                  }));
                  toast.info("Titular removido. Pesquise outro cliente ou preencha manualmente.");
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo
            label={
              <>
                Nome <Ast />
              </>
            }
          >
            <Input
              value={f.nome_cliente}
              onChange={(e) => set("nome_cliente", e.target.value)}
              aria-invalid={!!erros.nome_cliente}
            />
            {err("nome_cliente")}
          </Campo>
          <Campo
            label={
              <>
                CPF/CNPJ <Ast />
              </>
            }
          >
            <Input
              value={f.cpf_cnpj}
              onChange={(e) => set("cpf_cnpj", maskCpfCnpj(e.target.value))}
              placeholder="Apenas números"
              aria-invalid={!!erros.cpf_cnpj}
            />
            {err("cpf_cnpj")}
          </Campo>
          <Campo
            label={
              <>
                Renda total (R$) <Ast />
              </>
            }
          >
            <CurrencyInput
              value={f.renda_total}
              onChange={(v) => set("renda_total", v)}
              placeholder="Ex: 9.500,00"
            />
            {err("renda_total")}
          </Campo>
          <Campo
            label={
              <>
                Data de nascimento <Ast />
              </>
            }
          >
            <Input
              type="date"
              value={f.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
              aria-invalid={!!erros.data_nascimento}
            />
            {err("data_nascimento")}
          </Campo>
          <Campo
            label={
              <>
                Estado civil <Ast />
              </>
            }
          >
            <Select value={f.estado_civil} onValueChange={(v) => set("estado_civil", v)}>
              <SelectTrigger aria-invalid={!!erros.estado_civil}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_CIVIS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("estado_civil")}
          </Campo>
          <Campo
            label={
              <>
                E-mail <Ast />
              </>
            }
          >
            <Input
              type="email"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              readOnly={!!f.email_verificado_em}
              aria-invalid={!!erros.email}
            />
            {err("email")}
          </Campo>
          <Campo
            label={
              <>
                Celular <Ast />
              </>
            }
          >
            <Input
              value={f.celular}
              onChange={(e) => set("celular", maskCelular(e.target.value))}
              placeholder="(11) 99999-9999"
              aria-invalid={!!erros.celular}
            />
            {err("celular")}
          </Campo>
          <Campo label="Composição de renda">
            <label className="flex items-center gap-2 pt-2 text-sm">
              <Checkbox
                checked={f.compoe_renda}
                onCheckedChange={(c) => set("compoe_renda", Boolean(c))}
              />
              Incluir cônjuge/coobrigado na renda
            </label>
          </Campo>
        </div>
        {f.valor_financiamento > 0 && f.prazo >= 60 && (
          <DicaRendaMinima
            valorFinanciamento={f.valor_financiamento}
            prazoMeses={f.prazo}
            taxaAno={melhorTaxaAno}
            sistema={f.sistema_amortizacao === "P" ? "P" : "S"}
            rendaInformada={rendaConsiderada}
          />
        )}
      </section>


      {/* Bloco 3 — Cônjuge */}
      {mostraConjuge && (
        <>
          <Separator className="border-border/60" />
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-foreground">Cônjuge / coobrigado</h2>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!podeInverter}
                  onClick={inverterPrincipal}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Inverter principal
                </Button>
                {!podeInverter && (
                  <p className="text-xs text-muted-foreground">
                    Preencha nome, CPF e data de nascimento do cônjuge para inverter.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo label="Nome">
                <Input
                  value={f.nome_conjuge ?? ""}
                  onChange={(e) => set("nome_conjuge", e.target.value)}
                />
              </Campo>
              <Campo label="CPF/CNPJ">
                <Input
                  value={f.cpf_conjuge ?? ""}
                  onChange={(e) => set("cpf_conjuge", maskCpfCnpj(e.target.value))}
                />
              </Campo>
              <Campo label="Renda (R$)">
                <CurrencyInput
                  value={f.renda_conjuge ?? 0}
                  onChange={(v) => set("renda_conjuge", v)}
                />
              </Campo>
              <Campo label="Data de nascimento">
                <Input
                  type="date"
                  value={f.data_nascimento_conjuge ?? ""}
                  onChange={(e) => set("data_nascimento_conjuge", e.target.value)}
                />
              </Campo>
              <Campo label="Estado civil">
                <Select
                  value={f.estado_civil_conjuge ?? ""}
                  onValueChange={(v) => set("estado_civil_conjuge", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_CIVIS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="E-mail">
                <Input
                  type="email"
                  value={f.email_conjuge ?? ""}
                  onChange={(e) => set("email_conjuge", e.target.value)}
                />
              </Campo>
              <Campo label="Celular">
                <Input
                  value={f.celular_conjuge ?? ""}
                  onChange={(e) => set("celular_conjuge", maskCelular(e.target.value))}
                />
              </Campo>
            </div>
          </section>
        </>
      )}

      <Separator className="border-border/60" />

      {/* Bloco 4 — Bancos */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Bancos</h2>
        {f.sistema_amortizacao === "P" && (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
            O sistema PRICE é oferecido somente pelo Bradesco. Apenas o Bradesco pode ser
            selecionado enquanto esse sistema estiver escolhido.
          </div>
        )}
        {!bancos || bancos.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Nenhum banco habilitado — abra Configurações → Bancos para ativar.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bancos.map((b) => {
              const bloqueado = f.sistema_amortizacao === "P" && !isBradesco(b);
              return (
                <label
                  key={b.id}
                  className={`flex items-center gap-2 rounded-md border border-border bg-card p-3 text-sm ${
                    bloqueado ? "opacity-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={f.bancos_ids.includes(b.id)}
                    disabled={bloqueado}
                    onCheckedChange={() => toggleBanco(b.id)}
                  />
                  {b.nome_banco}
                </label>
              );
            })}
          </div>
        )}
        {err("bancos_ids")}
      </section>

      <Separator className="border-border/60" />

      {/* Bloco 5 — Consentimentos */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Consentimentos</h2>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={f.consentimento_lgpd}
            onCheckedChange={(c) => set("consentimento_lgpd", Boolean(c))}
          />
          <span>
            Autorizo o tratamento dos meus dados pessoais conforme a LGPD para fins desta simulação
            e proposta.
          </span>
        </label>
        {err("consentimento_lgpd")}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={f.consentimento_scr}
            onCheckedChange={(c) => set("consentimento_scr", Boolean(c))}
          />
          <span>
            Autorizo a consulta ao SCR/Bacen e o compartilhamento de dados com os bancos
            selecionados.
          </span>
        </label>
        {err("consentimento_scr")}
      </section>

      <Separator className="border-border/60" />

      {/* Envio ao banco como proposta */}
      <label className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <Checkbox
          checked={gerarProposta}
          onCheckedChange={(c) => setGerarProposta(Boolean(c))}
        />
        <span>
          <span className="font-medium text-foreground">Enviar direto ao banco como proposta</span>
          <span className="block text-muted-foreground">
            Ao concluir, a proposta é criada automaticamente com o banco vencedor (menor parcela) e
            enviada ao banco. Desmarque para gerar apenas a simulação.
          </span>
        </span>
      </label>

      <div className="flex justify-end pt-2">
        <Button className="h-11 px-8" onClick={enviar} disabled={enviando}>
          {gerarProposta ? "Enviar proposta ao banco" : "Enviar solicitação"}
        </Button>
      </div>


      <ConsultandoOverlay aberto={enviando} total={f.bancos_ids.length} concluidos={concluidos} />

      <AlertDialog open={!!confirmRenda} onOpenChange={(o) => !o && setConfirmRenda(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renda abaixo do sugerido</AlertDialogTitle>
            <AlertDialogDescription>
              A renda informada de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(confirmRenda?.rendaInformada ?? 0)}
              </span>{" "}
              é inferior à renda familiar mínima estimada de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(confirmRenda?.rendaMinima ?? 0)}
              </span>{" "}
              para este financiamento. O banco poderá reprovar a operação. Deseja enviar
              mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar dados</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRenda(null);
                void executarEnvio();
              }}
            >
              Enviar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function Campo({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
