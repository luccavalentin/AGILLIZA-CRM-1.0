/**
 * Orquestração dos envios de simulação (modos simples e "Ambos" SAC+PRICE).
 * Extraído de `use-simulacao-completa.ts` para reduzir a superfície do hook.
 *
 * Estas funções contêm side effects (chamadas de servidor, toasts, navegação),
 * mas recebem todas as dependências como parâmetros para permanecerem fora do
 * ciclo de vida do React e serem testáveis isoladamente.
 */
import { toast } from "sonner";
import { completaSchema, validarCepImovelHomeEquity } from "@/lib/simulacao/schemas";
import {
  criarSimulacao,
  enviarSimulacaoBanco,
  obterSimulacao,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import type { Form } from "./state";

type Router = { navigate: (opts: any) => void };

interface CtxBase {
  f: Form;
  idOperacao: number | null;
  modoProposta?: boolean;
  router: Router;
  setErros: (v: Record<string, string>) => void;
  setEnviando: (v: boolean) => void;
  setConcluidos: (v: number) => void;
  setSimulacaoResultadoId: (v: string | null) => void;
  setSimulacaoResultadoIdPrice: (v: string | null) => void;
}

function bloquearSemCepHomeEquity(f: Form, setErros: (v: Record<string, string>) => void): boolean {
  const msg = validarCepImovelHomeEquity(f as any);
  if (!msg) return false;
  setErros({ cep_imovel: msg });
  toast.error(msg);
  if (typeof document !== "undefined") {
    const el = document.getElementById("campo-cep-imovel");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const input = el?.querySelector("input") as HTMLInputElement | null;
      input?.focus();
    }, 300);
  }
  return true;
}

/**
 * Envio no modo "Ambos": cria uma simulação SAC (com renda_total) e uma
 * simulação PRICE (com renda_price). Cada simulação usa somente os bancos
 * selecionados no seu grupo. Se a renda PRICE não foi preenchida, o envio
 * é bloqueado e o usuário é levado ao campo para completar.
 */
export async function executarEnvioAmbos(ctx: CtxBase): Promise<void> {
  const { f, idOperacao, setErros, setEnviando, setConcluidos } = ctx;
  if (bloquearSemCepHomeEquity(f, setErros)) return;
  const novosErros: Record<string, string> = {};
  if (!(Number(f.renda_price) > 0)) {
    novosErros.renda_price = "Informe a renda para o sistema PRICE.";
  }
  const totalBancos = f.bancos_sac_ids.length + f.bancos_price_ids.length;
  if (totalBancos === 0) {
    novosErros.bancos_ids = "Selecione ao menos um banco em SAC ou PRICE.";
  }
  if (Object.keys(novosErros).length > 0) {
    setErros(novosErros);
    if (novosErros.renda_price) {
      toast.error("Preencha a renda para o sistema PRICE antes de enviar.");
      if (typeof document !== "undefined") {
        const el = document.getElementById("campo-renda-price");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            const input = el.querySelector("input") as HTMLInputElement | null;
            input?.focus();
          }, 300);
        }
      }
    } else {
      toast.error(novosErros.bancos_ids ?? "Revise os campos destacados.");
    }
    return;
  }
  setErros({});

  setConcluidos(0);
  setEnviando(true);
  const idsGerados: string[] = [];
  let done = 0;
  const agrupador_id =
    f.bancos_sac_ids.length > 0 && f.bancos_price_ids.length > 0
      ? (crypto.randomUUID?.() ??
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`)
      : null;
  try {
    // Simulação SAC
    if (f.bancos_sac_ids.length > 0) {
      const parsedS = completaSchema.safeParse({
        ...f,
        sistema_amortizacao: "S",
        bancos_ids: f.bancos_sac_ids,
        id_operacao_homefin: idOperacao,
      });
      if (!parsedS.success) {
        const novos: Record<string, string> = {};
        for (const issue of parsedS.error.issues) novos[String(issue.path[0])] = issue.message;
        setErros(novos);
        toast.error("Revise os campos destacados.");
        setEnviando(false);
        setConcluidos(0);
        return;
      }
      const { id } = await criarSimulacao({
        data: {
          modo: "completa",
          dados: {
            ...parsedS.data,
            id_operacao_homefin: idOperacao,
            email_verificado_em: f.email_verificado_em,
            agrupador_id,
          } as any,
        },
      });
      idsGerados.push(id);
      await Promise.all(
        f.bancos_sac_ids.map(async (bid: string) => {
          try {
            await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bid] } });
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Falha ao enviar a um banco (SAC). Você pode reenviar na tela da simulação.",
            );
          } finally {
            done++;
            setConcluidos(done);
          }
        }),
      );
    }

    // Simulação PRICE (usa a renda específica para PRICE como renda_total)
    if (f.bancos_price_ids.length > 0) {
      const parsedP = completaSchema.safeParse({
        ...f,
        sistema_amortizacao: "P",
        bancos_ids: f.bancos_price_ids,
        renda_total: Number(f.renda_price),
        id_operacao_homefin: idOperacao,
      });
      if (!parsedP.success) {
        const novos: Record<string, string> = {};
        for (const issue of parsedP.error.issues) novos[String(issue.path[0])] = issue.message;
        setErros(novos);
        toast.error("Revise os campos destacados.");
        setEnviando(false);
        setConcluidos(0);
        return;
      }
      const { id } = await criarSimulacao({
        data: {
          modo: "completa",
          dados: {
            ...parsedP.data,
            id_operacao_homefin: idOperacao,
            email_verificado_em: f.email_verificado_em,
            agrupador_id,
          } as any,
        },
      });
      idsGerados.push(id);
      await Promise.all(
        f.bancos_price_ids.map(async (bid: string) => {
          try {
            await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bid] } });
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Falha ao enviar a um banco (PRICE). Você pode reenviar na tela da simulação.",
            );
          } finally {
            done++;
            setConcluidos(done);
          }
        }),
      );
    }

    sessionStorage.removeItem("simulacao_wizard");
    ctx.setSimulacaoResultadoId(idsGerados[0] ?? null);
    ctx.setSimulacaoResultadoIdPrice(idsGerados[1] ?? null);
    setEnviando(false);
    setConcluidos(0);
    toast.success("Simulações SAC e PRICE geradas. Confira os resultados abaixo.");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Não foi possível criar as simulações.");
    setEnviando(false);
    setConcluidos(0);
  }
}

/** Envio padrão (SAC ou PRICE isolado). */
export async function executarEnvioSimples(ctx: CtxBase): Promise<void> {
  const { f, idOperacao, modoProposta, router, setErros, setEnviando, setConcluidos } = ctx;
  if (bloquearSemCepHomeEquity(f, setErros)) return;
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
    const idsBancos = f.bancos_ids.length > 0 ? f.bancos_ids : [];
    if (idsBancos.length === 0) {
      try {
        await enviarSimulacaoBanco({ data: { simulacao_id: id } });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Falha ao enviar ao banco. Você pode reenviar na tela da simulação.",
        );
      }
      setConcluidos(1);
    } else {
      let feitos = 0;
      await Promise.all(
        idsBancos.map(async (bid: string) => {
          try {
            await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bid] } });
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Falha ao enviar a um dos bancos. Você pode reenviar na tela da simulação.",
            );
          } finally {
            feitos++;
            setConcluidos(feitos);
          }
        }),
      );
    }

    // Fluxo "Nova Proposta": após simular, cria a proposta e redireciona.
    if (modoProposta) {
      try {
        const dadosSim: any = await obterSimulacao({ data: { id } });
        const bancosSim: any[] = dadosSim.bancos ?? [];
        const simulados = bancosSim.filter((b) => b.status_banco === "simulada");
        if (simulados.length === 0) {
          toast.error("Nenhum banco aceitou a proposta. Revise os dados e envie novamente.");
          setEnviando(false);
          setConcluidos(0);
          return;
        }
        const escolhidoUsuarioId = idsBancos[0] ?? null;
        const escolhido =
          simulados.find((b: any) => b.banco_id === escolhidoUsuarioId) ?? simulados[0];
        const bancoId = escolhido.banco_id as string;
        const { proposta_id } = await criarProposta({
          data: { simulacao_id: id, banco_id: bancoId },
        });
        toast.success("Proposta criada. Complete o cadastro para enviar ao banco.");
        if (f.cliente_id) {
          router.navigate({
            to: "/operacional/propostas/$id",
            params: { id: proposta_id },
            search: { complementar: 1 },
          });
        } else {
          router.navigate({
            to: "/crm/clientes/novo",
            search: { proposta: proposta_id, enviar: 1 },
          });
        }
        return;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível criar a proposta.");
        setEnviando(false);
        setConcluidos(0);
        return;
      }
    }

    ctx.setSimulacaoResultadoId(id);
    setEnviando(false);
    setConcluidos(0);
    toast.success(
      "Simulação realizada. Os extratos por banco serão baixados automaticamente assim que os retornos chegarem.",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : null;
    toast.error(
      msg ?? (modoProposta ? "Não foi possível criar a proposta." : "Não foi possível criar a simulação."),
    );
    setEnviando(false);
    setConcluidos(0);
  }
}
