import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  Heart,
  Home,
  Landmark,
  Loader2,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { CamposParticipante } from "@/components/proposta/participante-form/campos-participante";
import {
  Campo,
  Secao,
  SelSelect,
  SelUf,
} from "@/components/proposta/participante-form/campos-atomos";
import {
  camposFaltantes,
  envolvidoParaForm,
  formParaEnvolvido,
  mascararCep,
  type ParticipanteForm,
} from "@/components/proposta/participante-form/types";
import { QUALIFICACAO_LABEL } from "@/lib/propostas/campos-obrigatorios";
import { LABEL_POR_CHAVE } from "@/lib/propostas/campos-obrigatorios";
import { erroAgencia } from "@/lib/bancos/agencia";
import { mascararTelefone } from "@/lib/crm/documento";
import { SITUACOES_IMOVEL, TIPOS_IMOVEL, USOS_IMOVEL } from "@/lib/simulacao/schemas";
import { cn } from "@/lib/utils";

/** Campos que, alterados depois da aprovação, podem levar o banco a reanalisar o crédito. */
const CAMPOS_SENSIVEIS: Record<string, string> = {
  valor_imovel: "valor do imóvel",
  valor_financiamento: "valor financiado",
  prazo: "prazo",
  sistema_amortizacao: "sistema de amortização",
};

type DadosProposta = {
  valor_imovel: number;
  valor_financiamento: number;
  prazo: string;
  sistema_amortizacao: string;
  utiliza_fgts: boolean;
  financia_despesas_cartorarias: boolean;
  tipo_imovel: string;
  uso_imovel: string;
  situacao_imovel: string;
  cep_imovel: string;
  endereco_imovel: string;
  numero_imovel: string;
  complemento_imovel: string;
  bairro_imovel: string;
  cidade_imovel: string;
  uf: string;
  contato_avaliacao_nome: string;
  contato_avaliacao_telefone: string;
};

function propostaParaForm(p: any): DadosProposta {
  const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    valor_imovel: Number(p.valor_imovel ?? 0),
    valor_financiamento: Number(p.valor_financiamento ?? 0),
    prazo: t(p.prazo),
    sistema_amortizacao: t(p.sistema_amortizacao),
    utiliza_fgts: Boolean(p.utiliza_fgts),
    financia_despesas_cartorarias: Boolean(p.financia_despesas_cartorarias),
    tipo_imovel: t(p.tipo_imovel),
    uso_imovel: t(p.uso_imovel),
    situacao_imovel: t(p.situacao_imovel),
    cep_imovel: t(p.cep_imovel),
    endereco_imovel: t(p.endereco_imovel),
    numero_imovel: t(p.numero_imovel),
    complemento_imovel: t(p.complemento_imovel),
    bairro_imovel: t(p.bairro_imovel),
    cidade_imovel: t(p.cidade_imovel),
    uf: t(p.uf),
    contato_avaliacao_nome: t(p.contato_avaliacao_nome),
    contato_avaliacao_telefone: t(p.contato_avaliacao_telefone),
  };
}

/** O que vai para o servidor: textos vazios viram null, prazo vira número. */
function formParaProposta(f: DadosProposta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    out[k] = typeof v === "string" ? v.trim() || null : v;
  }
  out.prazo = f.prazo ? Number(f.prazo) : null;
  out.cep_imovel = f.cep_imovel.replace(/\D/g, "") || null;
  return out;
}

const igual = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");

export interface EnvioConferencia {
  proposta: Record<string, unknown>;
  envolvidos: { id: string; dados: Record<string, unknown> }[];
  conta: {
    agencia: string | null;
    conta_corrente: string | null;
    digito_conta: string | null;
  } | null;
}

export function EtapaConferencia({
  proposta,
  envolvidos,
  banco,
  salvando,
  onGravar,
  onAutosalvar,
}: {
  proposta: any;
  envolvidos: any[];
  banco: any | null;
  salvando: boolean;
  onGravar: (dados: EnvioConferencia) => Promise<void>;
  /** Grava só no CRM; `true` quando deu certo. */
  onAutosalvar: (dados: EnvioConferencia) => Promise<boolean>;
}) {
  const [dados, setDados] = useState<DadosProposta>(() => propostaParaForm(proposta));
  const [pessoas, setPessoas] = useState<Record<string, ParticipanteForm>>({});
  const [conta, setConta] = useState({ agencia: "", conta_corrente: "", digito_conta: "" });
  const [tentou, setTentou] = useState(false);
  const [confirmarSensiveis, setConfirmarSensiveis] = useState<string[] | null>(null);
  // Edição ainda não salva: enquanto houver, um refetch não recarrega o formulário.
  const edicoes = useRef(0);
  const [sujo, setSujo] = useState(false);
  const [autosalvo, setAutosalvo] = useState<{ quando: Date; erro?: string } | null>(null);
  const marcarEdicao = () => {
    edicoes.current += 1;
    setSujo(true);
  };

  // Carrega (e recarrega depois de gravar) a partir do que está salvo. A chave
  // é a versão gravada: um refetch que não mudou nada não apaga o que o
  // operador está digitando.
  const versao = [
    proposta?.updated_at,
    banco?.updated_at,
    ...envolvidos.map((e) => `${e.id}:${e.updated_at}`),
  ].join("|");
  useEffect(() => {
    if (sujo) return;
    setDados(propostaParaForm(proposta));
    setPessoas(Object.fromEntries(envolvidos.map((e) => [e.id, envolvidoParaForm(e)])));
    setConta({
      agencia: banco?.agencia ?? "",
      conta_corrente: banco?.conta_corrente ?? "",
      digito_conta: banco?.digito_conta ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, sujo]);

  const titulares = envolvidos.filter((e) => e.tipo_qualificacao !== "VD" && !e.conjuge_de);
  const vendedores = envolvidos.filter((e) => e.tipo_qualificacao === "VD" && !e.conjuge_de);
  const conjugeDe = (id: string) => envolvidos.find((e) => e.conjuge_de === id);

  const setDado = <K extends keyof DadosProposta>(k: K, v: DadosProposta[K]) => {
    marcarEdicao();
    setDados((d) => ({ ...d, [k]: v }));
  };
  const setPessoa = (id: string) => (patch: Partial<ParticipanteForm>) => {
    marcarEdicao();
    setPessoas((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  };

  const atualizarConta = (f: (c: typeof conta) => typeof conta) => {
    marcarEdicao();
    setConta(f);
  };

  /**
   * Salvamento automático, 2 s depois da última alteração: só no CRM. Valores
   * da operação e renda ficam de fora — mexem na aprovação e só vão pelo
   * "Gravar e avançar", com confirmação.
   */
  useEffect(() => {
    if (!sujo) return;
    const edicaoAoAgendar = edicoes.current;
    const t = setTimeout(async () => {
      const envio = montarEnvio();
      const original = propostaParaForm(proposta) as Record<string, unknown>;
      for (const k of Object.keys(CAMPOS_SENSIVEIS).concat([
        "utiliza_fgts",
        "financia_despesas_cartorarias",
      ])) {
        envio.proposta[k] = k === "prazo" && original[k] ? Number(original[k]) : original[k];
      }
      envio.envolvidos = envio.envolvidos.map((e) => {
        const salvo = envolvidos.find((x) => x.id === e.id);
        return { ...e, dados: { ...e.dados, renda: salvo?.renda ?? null } };
      });
      const ok = await onAutosalvar(envio);
      setAutosalvo(ok ? { quando: new Date() } : { quando: new Date(), erro: "Não salvou" });
      // Só libera a recarga se nada mudou enquanto salvava.
      if (ok && edicoes.current === edicaoAoAgendar) setSujo(false);
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, pessoas, conta, sujo]);

  // Só proponentes (comprador e cônjuge) têm os campos obrigatórios do banco.
  const pendencias = useMemo(() => {
    const out: { id: string; nome: string; campos: Set<string> }[] = [];
    for (const e of envolvidos) {
      const f = pessoas[e.id];
      if (!f || e.tipo_qualificacao === "VD") continue;
      const campos = camposFaltantes(f);
      if (campos.size > 0) out.push({ id: e.id, nome: f.nome || e.nome, campos });
    }
    return out;
  }, [envolvidos, pessoas]);

  const erroDaAgencia = erroAgencia(conta.agencia, banco?.nome_banco);

  async function buscarCep(cep: string, aplicar: (patch: Record<string, string>) => void) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((x) => x.json());
      if (r?.erro) return toast.error("CEP não encontrado.");
      aplicar({ logradouro: r.logradouro, bairro: r.bairro, municipio: r.localidade, uf: r.uf });
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    }
  }

  function montarEnvio(): EnvioConferencia {
    const env = envolvidos
      .map((e) => {
        const f = pessoas[e.id];
        if (!f) return null;
        const novo = formParaEnvolvido(f) as Record<string, unknown>;
        const mudou = Object.keys(novo).some((k) => !igual(novo[k], e[k]));
        return mudou ? { id: e.id, dados: novo } : null;
      })
      .filter((x): x is { id: string; dados: Record<string, unknown> } => x !== null);
    const contaMudou =
      banco &&
      (!igual(conta.agencia, banco.agencia) ||
        !igual(conta.conta_corrente, banco.conta_corrente) ||
        !igual(conta.digito_conta, banco.digito_conta));
    return {
      proposta: formParaProposta(dados),
      envolvidos: env,
      conta: contaMudou
        ? {
            agencia: conta.agencia.replace(/\D/g, "") || null,
            conta_corrente: conta.conta_corrente.replace(/\D/g, "") || null,
            digito_conta: conta.digito_conta.trim() || null,
          }
        : null,
    };
  }

  function gravar() {
    setTentou(true);
    if (pendencias.length > 0) {
      toast.error("Faltam dados obrigatórios, destacados em vermelho.");
      return;
    }
    if (erroDaAgencia) return toast.error(erroDaAgencia);
    if (
      !(dados.valor_imovel > 0) ||
      !(dados.valor_financiamento > 0) ||
      !(Number(dados.prazo) > 0)
    ) {
      return toast.error("Valor do imóvel, valor financiado e prazo são obrigatórios.");
    }
    const original = propostaParaForm(proposta);
    const sensiveis = Object.keys(CAMPOS_SENSIVEIS)
      .filter((k) => !igual((dados as any)[k], (original as any)[k]))
      .map((k) => CAMPOS_SENSIVEIS[k]);
    const rendaMudou = envolvidos.some(
      (e) => pessoas[e.id] && !igual(pessoas[e.id].renda || null, e.renda),
    );
    if (rendaMudou) sensiveis.push("renda");
    if (sensiveis.length > 0) return setConfirmarSensiveis(sensiveis);
    void onGravar(montarEnvio()).then(() => setSujo(false));
  }

  const Pessoa = ({ e, conjuge }: { e: any; conjuge?: boolean }) => {
    const f = pessoas[e.id];
    if (!f) return null;
    const erros = tentou
      ? (pendencias.find((p) => p.id === e.id)?.campos ?? new Set<string>())
      : new Set<string>();
    return (
      <BlocoColapsavel
        icone={conjuge ? Heart : User}
        titulo={f.nome || e.nome || "Participante"}
        subtitulo={
          conjuge ? "Cônjuge" : (QUALIFICACAO_LABEL[e.tipo_qualificacao] ?? e.tipo_qualificacao)
        }
        pendente={erros.size > 0}
        abertoInicial={!conjuge && e.tipo_qualificacao !== "VD"}
      >
        <div className="space-y-5">
          <CamposParticipante
            f={f}
            set={setPessoa(e.id)}
            erros={erros}
            buscandoCep={false}
            onBuscarCep={(cep) => buscarCep(cep, (patch) => setPessoa(e.id)(patch))}
            mostrarQualificacao={false}
            mostrarEstadoCivil={!conjuge}
            mostrarIdentificacaoExtra={false}
            idBanco={Number(banco?.homefin_id_banco) || undefined}
          />
        </div>
      </BlocoColapsavel>
    );
  };

  return (
    <div className="space-y-4">
      {titulares.length > 0 && (
        <Grupo titulo="Compradores">
          {titulares.map((e) => {
            const c = conjugeDe(e.id);
            return (
              <div key={e.id} className="space-y-2">
                {Pessoa({ e })}
                {c && <div className="pl-3 sm:pl-6">{Pessoa({ e: c, conjuge: true })}</div>}
              </div>
            );
          })}
        </Grupo>
      )}

      {banco && (
        <Grupo titulo={`Conta para o financiamento — ${banco.nome_banco ?? "banco aprovado"}`}>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Campo label="Banco">
                <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm">
                  <Landmark className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                  {banco.nome_banco ?? "—"}
                </div>
              </Campo>
              <Campo label="Agência" erro={Boolean(erroDaAgencia)}>
                <Input
                  inputMode="numeric"
                  value={conta.agencia}
                  onChange={(ev) =>
                    atualizarConta((c) => ({
                      ...c,
                      agencia: ev.target.value.replace(/\D/g, "").slice(0, 5),
                    }))
                  }
                />
              </Campo>
              <Campo label="Conta corrente">
                <Input
                  inputMode="numeric"
                  value={conta.conta_corrente}
                  onChange={(ev) =>
                    atualizarConta((c) => ({
                      ...c,
                      conta_corrente: ev.target.value.replace(/\D/g, "").slice(0, 20),
                    }))
                  }
                />
              </Campo>
              <Campo label="Dígito">
                <Input
                  value={conta.digito_conta}
                  maxLength={2}
                  onChange={(ev) =>
                    atualizarConta((c) => ({ ...c, digito_conta: ev.target.value }))
                  }
                />
              </Campo>
            </div>
            {erroDaAgencia && <p className="mt-2 text-xs text-destructive">{erroDaAgencia}</p>}
          </div>
        </Grupo>
      )}

      {vendedores.length > 0 && (
        <Grupo titulo="Vendedores">
          {vendedores.map((e) => {
            const c = conjugeDe(e.id);
            return (
              <div key={e.id} className="space-y-2">
                {Pessoa({ e })}
                {c && <div className="pl-3 sm:pl-6">{Pessoa({ e: c, conjuge: true })}</div>}
              </div>
            );
          })}
        </Grupo>
      )}

      <Grupo titulo="Imóvel">
        <BlocoColapsavel icone={Home} titulo="Dados do imóvel e da vistoria" abertoInicial>
          <div className="space-y-5">
            <Secao titulo="Imóvel">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SelSelect
                  label="Tipo"
                  value={dados.tipo_imovel}
                  options={comAtual(TIPOS_IMOVEL, dados.tipo_imovel)}
                  onChange={(v) => setDado("tipo_imovel", v)}
                />
                <SelSelect
                  label="Uso"
                  value={dados.uso_imovel}
                  options={comAtual(USOS_IMOVEL, dados.uso_imovel)}
                  onChange={(v) => setDado("uso_imovel", v)}
                />
                <SelSelect
                  label="Situação"
                  value={dados.situacao_imovel}
                  options={comAtual(SITUACOES_IMOVEL, dados.situacao_imovel)}
                  onChange={(v) => setDado("situacao_imovel", v)}
                />
              </div>
            </Secao>
            <Secao titulo="Endereço do imóvel">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Campo label="CEP" className="col-span-1 sm:col-span-2">
                  <Input
                    inputMode="numeric"
                    value={mascararCep(dados.cep_imovel)}
                    onChange={(ev) => {
                      const cep = mascararCep(ev.target.value);
                      setDado("cep_imovel", cep);
                      void buscarCep(cep, (p) =>
                        setDados((d) => ({
                          ...d,
                          endereco_imovel: p.logradouro || d.endereco_imovel,
                          bairro_imovel: p.bairro || d.bairro_imovel,
                          cidade_imovel: p.municipio || d.cidade_imovel,
                          uf: p.uf || d.uf,
                        })),
                      );
                    }}
                  />
                </Campo>
                <Campo label="Logradouro" className="col-span-2 sm:col-span-4">
                  <Input
                    value={dados.endereco_imovel}
                    onChange={(ev) => setDado("endereco_imovel", ev.target.value)}
                  />
                </Campo>
                <Campo label="Número" className="col-span-1 sm:col-span-1">
                  <Input
                    value={dados.numero_imovel}
                    onChange={(ev) => setDado("numero_imovel", ev.target.value)}
                  />
                </Campo>
                <Campo label="Complemento" className="col-span-1 sm:col-span-2">
                  <Input
                    value={dados.complemento_imovel}
                    onChange={(ev) => setDado("complemento_imovel", ev.target.value)}
                  />
                </Campo>
                <Campo label="Bairro" className="col-span-2 sm:col-span-3">
                  <Input
                    value={dados.bairro_imovel}
                    onChange={(ev) => setDado("bairro_imovel", ev.target.value)}
                  />
                </Campo>
                <Campo label="Cidade" className="col-span-1 sm:col-span-4">
                  <Input
                    value={dados.cidade_imovel}
                    onChange={(ev) => setDado("cidade_imovel", ev.target.value)}
                  />
                </Campo>
                <div className="col-span-1 sm:col-span-2">
                  <SelUf label="UF" value={dados.uf} onChange={(v) => setDado("uf", v)} />
                </div>
              </div>
            </Secao>
            <Secao titulo="Contato para a vistoria">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Nome">
                  <Input
                    value={dados.contato_avaliacao_nome}
                    onChange={(ev) => setDado("contato_avaliacao_nome", ev.target.value)}
                  />
                </Campo>
                <Campo label="Telefone">
                  <Input
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={mascararTelefone(dados.contato_avaliacao_telefone)}
                    onChange={(ev) =>
                      setDado(
                        "contato_avaliacao_telefone",
                        ev.target.value.replace(/\D/g, "").slice(0, 11),
                      )
                    }
                  />
                </Campo>
              </div>
            </Secao>
          </div>
        </BlocoColapsavel>
      </Grupo>

      <Grupo titulo="Valores">
        <BlocoColapsavel icone={Wallet} titulo="Valores da operação" abertoInicial>
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Alterar valor, prazo, amortização ou renda depois da aprovação pode levar o banco a
              reanalisar o crédito.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Campo label="Valor do imóvel" className="sm:col-span-2">
                <CurrencyInput
                  value={dados.valor_imovel}
                  onChange={(v) => setDado("valor_imovel", v)}
                />
              </Campo>
              <Campo label="Valor financiado" className="sm:col-span-2">
                <CurrencyInput
                  value={dados.valor_financiamento}
                  onChange={(v) => setDado("valor_financiamento", v)}
                />
              </Campo>
              <Campo label="Prazo (meses)">
                <Input
                  inputMode="numeric"
                  value={dados.prazo}
                  onChange={(ev) =>
                    setDado("prazo", ev.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                />
              </Campo>
              <SelSelect
                label="Amortização"
                value={dados.sistema_amortizacao}
                options={comAtual(
                  [
                    { value: "S", label: "SAC" },
                    { value: "P", label: "PRICE" },
                  ],
                  dados.sistema_amortizacao,
                )}
                onChange={(v) => setDado("sistema_amortizacao", v)}
              />
              <Interruptor
                label="Usa FGTS"
                checked={dados.utiliza_fgts}
                onChange={(v) => setDado("utiliza_fgts", v)}
              />
              <Interruptor
                label="Financiar despesas"
                checked={dados.financia_despesas_cartorarias}
                onChange={(v) => setDado("financia_despesas_cartorarias", v)}
              />
            </div>
          </div>
        </BlocoColapsavel>
      </Grupo>

      {tentou && pendencias.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {pendencias.map((p) => (
            <p key={p.id}>
              <strong>{p.nome}</strong>: falta{" "}
              {Array.from(p.campos)
                .map((c) => LABEL_POR_CHAVE[c] ?? c)
                .join(", ")}
            </p>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">
          {autosalvo?.erro
            ? `Salvamento automático falhou às ${autosalvo.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Use "Gravar e avançar".`
            : sujo
              ? "Alterações não salvas…"
              : autosalvo
                ? `Salvo no CRM às ${autosalvo.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Valores e renda vão ao gravar.`
                : 'Salva no CRM automaticamente. "Gravar e avançar" envia à HomeFin.'}
        </p>
        <Button onClick={gravar} disabled={salvando} className="gap-2">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Gravar e avançar
        </Button>
      </div>

      <AlertDialog
        open={!!confirmarSensiveis}
        onOpenChange={(o) => !o && setConfirmarSensiveis(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar dados da aprovação?</AlertDialogTitle>
            <AlertDialogDescription>
              Você alterou {confirmarSensiveis?.join(", ")}. O crédito já foi aprovado com os
              valores anteriores e o banco pode reanalisar a proposta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarSensiveis(null);
                void onGravar(montarEnvio()).then(() => setSujo(false));
              }}
            >
              Gravar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Opções de um select, mais o valor atual quando ele não está na lista (dado legado). */
function comAtual(opcoes: readonly { value: string; label: string }[], atual: string) {
  const lista = opcoes.map((o) => ({ value: o.value, label: o.label }));
  if (atual && !lista.some((o) => o.value === atual)) lista.push({ value: atual, label: atual });
  return lista;
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Interruptor({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Campo label={label}>
      <div className="flex h-9 items-center">
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </Campo>
  );
}

function BlocoColapsavel({
  icone: Icone,
  titulo,
  subtitulo,
  pendente,
  abertoInicial,
  children,
}: {
  icone: typeof User;
  titulo: string;
  subtitulo?: string;
  pendente?: boolean;
  abertoInicial?: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(Boolean(abertoInicial));
  useEffect(() => {
    if (pendente) setAberto(true);
  }, [pendente]);
  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <div
        className={cn(
          "rounded-xl border bg-card",
          pendente ? "border-destructive/50" : "border-border",
        )}
      >
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icone className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{titulo}</span>
              {subtitulo && (
                <span className="block text-xs text-muted-foreground">{subtitulo}</span>
              )}
            </span>
            {pendente && (
              <span className="text-xs font-medium text-destructive">dados pendentes</span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                aberto && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-4 py-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
