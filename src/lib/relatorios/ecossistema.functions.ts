/**
 * Server functions dos relatórios gerenciais do ecossistema (C47). Regras em `ecossistema.ts`.
 *
 * Cada ponta confere a permissão no próprio banco:
 *   · Agilliza: `relatorio_eco_agilliza` / `relatorio_operacional_agilliza` (relatorios.geral;
 *     "Geral" só com escopo de equipe ou de todos — sem isso o banco devolve "Minha");
 *   · Agilliza Tech: `plataforma.relatorio_ecossistema` pela ponte (permissão de crédito da
 *     pessoa conferida em `abrir_contexto_agilliza` e de novo na função).
 * Se a ponte não responder, o relatório sai com a parte do Agilliza e um aviso — nunca com um
 * número do ecossistema calado como se fosse completo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import {
  intervaloDoRelatorio,
  lerFiltrosRelatorio,
  normalizarBloco,
  planoDeLeitura,
  type BlocoEco,
  type FiltrosRelatorio,
} from "./ecossistema";
import type { Intervalo } from "./producao-ecossistema";

/** Quem vê as contas do Agilliza Tech nos relatórios (mesma regra do Painel geral e do filtro de base). */
const MODULOS_TECH = [
  ["saas.contas", "view"],
  ["saas.fila", "view"],
  ["saas.licencas", "view"],
] as const;

async function podeVerTech(supabase: any, userId: string): Promise<boolean> {
  for (const [modulo, acao] of MODULOS_TECH) {
    const { data } = await supabase.rpc("usuario_tem_permissao", { _user_id: userId, _modulo: modulo, _acao: acao });
    if (data) return true;
  }
  return false;
}

function filtrosDoBanco(f: FiltrosRelatorio, i: Intervalo) {
  return {
    de: i.de,
    ate: i.ate,
    anterior_de: i.anteriorDe,
    anterior_ate: i.anteriorAte,
    escopo: f.escopo,
    ...(f.banco ? { banco: f.banco } : {}),
  };
}

export interface ParteAgilliza {
  intervalo: Intervalo;
  /** null quando o recorte não inclui a operação do Agilliza. */
  bloco: BlocoEco | null;
  /** O que o banco aplicou ("minha" quando a pessoa não vê a equipe). */
  escopo: "minha" | "geral";
  podeTech: boolean;
  avisos: string[];
}

const entrada = (d: unknown) => lerFiltrosRelatorio((d ?? {}) as Record<string, unknown>);

/** Parte do Agilliza (operação própria) no recorte pedido. */
export const getRelatorioAgilliza = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["relatorios.geral", "view"])])
  .validator(entrada)
  .handler(async ({ data: f, context }): Promise<ParteAgilliza> => {
    const { supabase, userId } = context;
    const intervalo = intervaloDoRelatorio(f);
    const podeTech = await podeVerTech(supabase, userId);
    const plano = planoDeLeitura(f, podeTech);
    const avisos: string[] = [];
    if (!podeTech && (f.visao === "ecossistema" || f.base.base === "assinantes" || f.base.origem === "vinculados")) {
      avisos.push("Você vê só a operação do Agilliza: os números dos assinantes dependem da permissão de contas da plataforma.");
    }
    if (!plano.agilliza) return { intervalo, bloco: null, escopo: f.escopo, podeTech, avisos };
    const { data, error } = await (supabase as any).rpc("relatorio_eco_agilliza", {
      p_filtros: {
        ...filtrosDoBanco(f, intervalo),
        ...(f.usuario?.startsWith("a:") ? { usuario: f.usuario.slice(2) } : {}),
      },
    });
    if (error) throw new Error(error.message);
    const escopo = (data as any)?.escopo === "minha" ? "minha" : "geral";
    if (f.escopo === "geral" && escopo === "minha") {
      avisos.push("Você vê só a sua produção no Agilliza: a visão Geral depende do escopo de relatórios.");
    }
    return { intervalo, bloco: normalizarBloco(data, "agilliza"), escopo, podeTech, avisos };
  });

/** Quem vê as contas do Agilliza Tech nos relatórios (mesma regra do Painel geral e do filtro de base). */
const guardaContas = exigirPermissao(["saas.contas", "view"], ["saas.fila", "view"], ["saas.licencas", "view"]);

export interface ParteContas {
  bloco: BlocoEco | null;
  avisos: string[];
}

/**
 * Parte das contas do Agilliza Tech (vinculados e assinantes) pela ponte. A guarda de módulo
 * da plataforma vale aqui (endereço HTTP) e o banco confere de novo a permissão de crédito.
 * Se a ponte não responder, volta vazia com aviso — nunca um número calado como completo.
 */
export const getRelatorioContas = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["relatorios.geral", "view"]), guardaContas])
  .validator(entrada)
  .handler(async ({ data: f, context }): Promise<ParteContas> => {
    const plano = planoDeLeitura(f, true);
    if (!plano.tech) return { bloco: null, avisos: [] };
    const intervalo = intervaloDoRelatorio(f);
    try {
      const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
      const r = await comPlataforma(context.userId, (tx) =>
        tx.uma<{ r: unknown }>("select plataforma.relatorio_ecossistema($1::jsonb) as r", [
          JSON.stringify({
            ...filtrosDoBanco(f, intervalo),
            grupo: plano.tech!.grupo,
            licenca: plano.tech!.licenca,
            sem_no_agilliza: plano.tech!.semNoAgilliza,
            minha: f.escopo === "minha",
            ...(f.usuario?.startsWith("t:") ? { usuario: f.usuario.slice(2) } : {}),
          }),
        ]),
      );
      const bloco = r?.r ? normalizarBloco(r.r, "tech") : null;
      return {
        bloco,
        avisos: bloco?.truncado ? ["O recorte das contas passou do limite de linhas: reduza o período ou escolha uma conta."] : [],
      };
    } catch (e) {
      return {
        bloco: null,
        avisos: [
          `Os números das contas do Agilliza Tech não vieram agora (${(e as Error).message}). O relatório mostra só o Agilliza.`,
        ],
      };
    }
  });

export interface PessoaOperacao {
  id: string | null;
  nome: string;
  demandas: number;
  demandas_concluidas: number;
  demandas_no_prazo: number;
  demandas_vencidas: number;
  tarefas: number;
  tarefas_concluidas: number;
  tarefas_no_prazo: number;
  tarefas_atrasadas: number;
  propostas: number;
  propostas_enviadas: number;
  horas_ate_envio: number;
}

export interface RelatorioOperacional {
  demandas: { total: number; concluidas: number; no_prazo: number; vencidas_abertas: number; abertas: number; horas_conclusao: number };
  tarefas: { total: number; concluidas: number; no_prazo: number; atrasadas_abertas: number; abertas: number; horas_conclusao: number };
  propostas: { total: number; enviadas: number; enviadas_24h: number; horas_ate_envio: number };
  por_pessoa: PessoaOperacao[];
  escopo: "minha" | "geral";
}

/** SLA da operação do Agilliza (propostas até o envio, demandas e tarefas), por responsável. */
export const getRelatorioOperacional = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["relatorios.geral", "view"])])
  .validator(entrada)
  .handler(async ({ data: f, context }): Promise<RelatorioOperacional> => {
    const intervalo = intervaloDoRelatorio(f);
    const { data, error } = await (context.supabase as any).rpc("relatorio_operacional_agilliza", {
      p_filtros: {
        ...filtrosDoBanco(f, intervalo),
        ...(f.usuario?.startsWith("a:") ? { usuario: f.usuario.slice(2) } : {}),
      },
    });
    if (error) throw new Error(error.message);
    return data as RelatorioOperacional;
  });

// ----------------------------------------------------- relatórios personalizados --

const CODIGO_PERSONALIZADO = "eco-personalizado";

export interface RelatorioSalvo {
  id: string;
  nome: string;
  metricas: string[];
  dimensao: string;
  filtros: Record<string, string>;
  criado_em: string;
}

const salvoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Dê um nome ao relatório.").max(80),
  metricas: z.array(z.string().regex(/^[a-z_]{2,30}$/)).min(1, "Escolha ao menos uma métrica.").max(8),
  dimensao: z.enum(["mes", "grupo", "conta", "banco", "usuario", "parceiro"]),
  filtros: z.record(z.string().regex(/^[a-z_]{2,20}$/), z.string().max(80)).default({}),
});

/** Relatórios personalizados da própria pessoa. */
export const listarRelatoriosSalvos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["relatorios.geral", "view"])])
  .handler(async ({ context }): Promise<RelatorioSalvo[]> => {
    const { data, error } = await context.supabase
      .from("report_saved_filters")
      .select("id,nome,filtros,colunas,view_base,created_at")
      .eq("report_codigo", CODIGO_PERSONALIZADO)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      nome: r.nome,
      metricas: Array.isArray(r.colunas) ? r.colunas.map(String) : [],
      dimensao: String(r.view_base ?? "mes"),
      filtros: (r.filtros ?? {}) as Record<string, string>,
      criado_em: r.created_at,
    }));
  });

export const salvarRelatorio = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["relatorios.geral", "view"])])
  .validator((d: unknown) => salvoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const linha = {
      nome: data.nome,
      colunas: data.metricas as any,
      view_base: data.dimensao,
      filtros: data.filtros as any,
      visibilidade: "private",
    };
    if (data.id) {
      const { error } = await supabase
        .from("report_saved_filters")
        .update(linha as any)
        .eq("id", data.id)
        .eq("user_id", userId)
        .eq("report_codigo", CODIGO_PERSONALIZADO);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    const { data: nova, error } = await supabase
      .from("report_saved_filters")
      .insert({ ...linha, correspondente_id: corr as string, user_id: userId, report_codigo: CODIGO_PERSONALIZADO } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (nova as any).id as string };
  });

export const excluirRelatorio = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["relatorios.geral", "view"])])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_saved_filters")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("report_codigo", CODIGO_PERSONALIZADO);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
