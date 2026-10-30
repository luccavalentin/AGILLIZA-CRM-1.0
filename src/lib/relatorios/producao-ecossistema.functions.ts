/**
 * Server functions do Painel geral (produção comercial do ecossistema, C03–C06).
 * Regras e tipos em `producao-ecossistema.ts`; a parte do Agilliza Tech em
 * `producao-ecossistema.server.ts` (pela ponte, com permissão conferida no banco).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { criarEscopoEq, listarClienteIdsParceiroDoUsuario } from "@/lib/escopo";
import { grupoDoStatus } from "@/lib/propostas/status-grupos";
import { dataBR, fimDiaBR, inicioDiaBR } from "./shared";
import {
  BLOCO_VAZIO,
  blocoDosFatos,
  lerFiltros,
  resolverIntervaloProducao,
  type BlocoProducao,
  type FatoProducao,
  type FiltrosProducao,
  type Intervalo,
} from "./producao-ecossistema";

/** Status de contrato na proposta do Agilliza (o registrado também foi emitido). */
const CONTRATO_STATUS = ["contrato_emitido", "registrado"];
const AGILLIZA = { contaId: "agilliza", contaNome: "Agilliza Correspondente" };

/** Todas as linhas, em lotes de mil (o PostgREST corta em mil por resposta). */
async function todasAsLinhas<T = Record<string, unknown>>(montar: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < 25; i++) {
    const { data, error } = await montar().range(i * 1000, i * 1000 + 999);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    out.push(...lote);
    if (lote.length < 1000) return out;
  }
  throw new Error(
    "O período passou de 25 mil registros e a conta pararia no meio. Reduza o período do filtro.",
  );
}

/**
 * Fatos do Agilliza no intervalo, com o mesmo escopo das telas (responsável, criador e
 * clientes do parceiro). Contrato emitido = data de emissão na ficha do cliente, só com
 * proposta em contrato emitido/registrado (a mesma verdade do Painel operacional); valor
 * financiado = o aprovado (ou pedido) da proposta do contrato.
 */
async function fatosDoAgilliza(
  supabase: any,
  escopoEq: (q: any, ...cols: string[]) => any,
  de: string,
  ate: string,
): Promise<FatoProducao[]> {
  const ini = inicioDiaBR(de);
  const fim = fimDiaBR(ate);
  const [sims, props, clientes] = await Promise.all([
    todasAsLinhas<any>(() =>
      escopoEq(
        supabase
          .from("simulacoes")
          .select("id,created_at,usuario_responsavel_id,usuario_criador_id")
          .is("deleted_at", null)
          .gte("created_at", ini)
          .lte("created_at", fim)
          .order("id"),
        "usuario_responsavel_id",
        "usuario_criador_id",
        "@cli:cliente_id",
      ),
    ),
    todasAsLinhas<any>(() =>
      escopoEq(
        supabase
          .from("propostas")
          .select("id,status,created_at,usuario_responsavel_id,usuario_criador_id")
          .is("deleted_at", null)
          .neq("status", "rascunho")
          .gte("created_at", ini)
          .lte("created_at", fim)
          .order("id"),
        "usuario_responsavel_id",
        "usuario_criador_id",
        "@cli:cliente_id",
      ),
    ),
    todasAsLinhas<any>(() =>
      escopoEq(
        supabase
          .from("clientes")
          .select("id,contrato_emitido_em,responsavel_id,criador_id")
          .is("deleted_at", null)
          .not("contrato_emitido_em", "is", null)
          .gte("contrato_emitido_em", de)
          .lte("contrato_emitido_em", ate)
          .order("id"),
        "responsavel_id",
        "criador_id",
        "@cli:id",
      ),
    ),
  ]);

  const fatos: FatoProducao[] = [];
  const quem = (r: any) => {
    const id = r.usuario_responsavel_id ?? r.usuario_criador_id ?? r.responsavel_id ?? r.criador_id;
    return id ? `a:${id}` : null;
  };
  for (const s of sims)
    fatos.push({ tipo: "simulacao", dia: dataBR(s.created_at), usuarioId: quem(s), ...AGILLIZA });
  for (const p of props) {
    const base = { dia: dataBR(p.created_at), usuarioId: quem(p), ...AGILLIZA };
    fatos.push({ tipo: "proposta", ...base });
    if (grupoDoStatus(p.status) === "aprovadas" && !CONTRATO_STATUS.includes(p.status)) {
      fatos.push({ tipo: "aprovada", ...base });
    }
  }
  if (clientes.length) {
    const contratos = await todasAsLinhas<any>(() =>
      supabase
        .from("propostas")
        .select("cliente_id,status,valor_financiamento_aprovado,valor_financiamento")
        .in(
          "cliente_id",
          clientes.map((c: any) => c.id),
        )
        .in("status", CONTRATO_STATUS)
        .is("deleted_at", null)
        .order("id"),
    );
    const porCliente = new Map<string, { registrado: boolean; valor: number }>();
    for (const p of contratos) {
      const v = Number(p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0) || 0;
      const atual = porCliente.get(p.cliente_id) ?? { registrado: false, valor: 0 };
      porCliente.set(p.cliente_id, {
        registrado: atual.registrado || p.status === "registrado",
        valor: Math.max(atual.valor, v),
      });
    }
    for (const c of clientes) {
      const k = porCliente.get(c.id);
      // Contrato só conta com proposta de contrato real (movimento manual da esteira não).
      if (!k) continue;
      fatos.push({
        tipo: "contrato",
        dia: String(c.contrato_emitido_em).slice(0, 10),
        registrado: k.registrado,
        valor: k.valor,
        usuarioId: quem(c),
        ...AGILLIZA,
      });
    }
  }
  return fatos;
}

/** Nomes dos usuários do Agilliza nos rankings (`a:<uuid>`). */
async function nomearUsuarios(supabase: any, bloco: BlocoProducao) {
  const ids = bloco.rankingUsuarios.filter((l) => l.id.startsWith("a:")).map((l) => l.id.slice(2));
  if (!ids.length) return;
  const { data } = await supabase.from("profiles").select("id,nome").in("id", ids);
  const nomes = new Map<string, string>(((data ?? []) as any[]).map((p) => [p.id, p.nome]));
  for (const l of bloco.rankingUsuarios) {
    if (l.id.startsWith("a:")) {
      l.nome = nomes.get(l.id.slice(2)) ?? "Usuário do Agilliza";
      l.detalhe = AGILLIZA.contaNome;
    }
  }
}

/** Confere "Geral" e filtro por outra pessoa (relatório global ou de equipe). */
async function podeVerGeral(supabase: any, userId: string): Promise<boolean> {
  const [{ data: geral }, { data: equipe }] = await Promise.all([
    supabase.rpc("can_view_global_reports", { _user_id: userId }),
    supabase.rpc("can_view_team_reports", { _user_id: userId }),
  ]);
  return Boolean(geral || equipe);
}

export interface ProducaoAgilliza {
  bloco: BlocoProducao;
  intervalo: Intervalo;
  /** Filtros que valeram (sem permissão, "Geral" cai para "Minha"). */
  filtros: FiltrosProducao;
  aviso: string | null;
}

/**
 * Produção do próprio Agilliza (parte da Sua base). Qualquer pessoa logada vê a sua;
 * "Geral" e filtro por outra pessoa exigem relatório global ou de equipe, conferido AQUI
 * (a tela só esconde as opções). Sem permissão, cai para "Minha" e avisa.
 */
export const getProducaoAgilliza = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => lerFiltros(d as Record<string, unknown>))
  .handler(async ({ data: f, context }): Promise<ProducaoAgilliza> => {
    const { supabase, userId } = context;
    const intervalo = resolverIntervaloProducao(f);
    let aviso: string | null = null;
    const usuarioAgilliza = f.usuario?.startsWith("a:") ? f.usuario.slice(2) : undefined;
    if (
      (f.escopo === "geral" || (usuarioAgilliza && usuarioAgilliza !== userId)) &&
      !(await podeVerGeral(supabase, userId))
    ) {
      f.escopo = "minha";
      delete f.usuario;
      aviso = "Você vê só a sua produção: a visão Geral depende de permissão de relatórios.";
    }
    // Fora da Sua base, ou filtrando um usuário do Tech, o Agilliza não entra na conta.
    if (f.base !== "sua_base" || f.usuario?.startsWith("t:")) {
      return { bloco: BLOCO_VAZIO, intervalo, filtros: f, aviso };
    }
    const responsavel = f.usuario?.startsWith("a:") ? f.usuario.slice(2) : undefined;
    const partnerClienteIds =
      f.escopo === "minha" && !responsavel
        ? await listarClienteIdsParceiroDoUsuario(supabase, userId)
        : [];
    const escopoEq = criarEscopoEq({ userId, escopo: f.escopo, responsavel, partnerClienteIds });
    const [atual, anterior] = await Promise.all([
      fatosDoAgilliza(supabase, escopoEq, intervalo.de, intervalo.ate),
      fatosDoAgilliza(supabase, escopoEq, intervalo.anteriorDe, intervalo.anteriorAte),
    ]);
    const bloco = blocoDosFatos(atual, anterior, intervalo.de, intervalo.ate);
    await nomearUsuarios(supabase, bloco);
    return { bloco, intervalo, filtros: f, aviso };
  });

/** Quem vê a produção dos assinantes: a fila de propostas ou as licenças da plataforma. */
const guardaPlataforma = () => exigirPermissao(["saas.fila", "view"], ["saas.licencas", "view"]);

export interface ProducaoPlataforma {
  bloco: BlocoProducao;
  agregacao: "nativa" | "listas";
  assinanteNome: string | null;
}

/**
 * Produção no Agilliza Tech pela ponte: Sua base (a conta da plataforma e as vinculadas),
 * Assinantes (as licenças) ou um assinante. "Minha" = contas da carteira da pessoa. O banco
 * confere de novo a permissão de crédito da pessoa (abrir_contexto_agilliza).
 */
export const getProducaoPlataforma = createServerFn({ method: "POST" })
  .middleware([guardaPlataforma()])
  .validator((d: unknown) => lerFiltros(d as Record<string, unknown>))
  .handler(async ({ data: f, context }): Promise<ProducaoPlataforma> => {
    if (f.usuario?.startsWith("a:")) {
      return { bloco: BLOCO_VAZIO, agregacao: "listas", assinanteNome: null };
    }
    const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
    const { producaoDaPlataforma } = await import("./producao-ecossistema.server");
    return comPlataforma(context.userId, (tx) =>
      producaoDaPlataforma(tx, {
        base: f.base,
        licenca: f.licenca,
        minha: f.escopo === "minha",
        usuario: f.usuario?.startsWith("t:") ? f.usuario.slice(2) : undefined,
        intervalo: resolverIntervaloProducao(f),
      }),
    );
  });

export interface OpcoesAgilliza {
  podeGeral: boolean;
  usuarios: { id: string; nome: string; conta: string | null }[];
}

/** Permissão de "Geral" e os usuários do Agilliza para o filtro (só com permissão). */
export const getOpcoesAgilliza = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpcoesAgilliza> => {
    const { supabase, userId } = context;
    const podeGeral = await podeVerGeral(supabase, userId);
    const usuarios: OpcoesAgilliza["usuarios"] = [];
    if (podeGeral) {
      const { data: me } = await supabase
        .from("profiles")
        .select("correspondente_id")
        .eq("id", userId)
        .maybeSingle();
      if (me?.correspondente_id) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,nome")
          .eq("correspondente_id", me.correspondente_id)
          .eq("ativo", true)
          .order("nome")
          .limit(500);
        for (const p of (profs ?? []) as any[]) {
          usuarios.push({ id: `a:${p.id}`, nome: p.nome ?? "Sem nome", conta: AGILLIZA.contaNome });
        }
      }
    }
    return { podeGeral, usuarios };
  });

export interface OpcoesPlataforma {
  assinantes: { id: string; nome: string; tipo: string }[];
  usuarios: { id: string; nome: string; conta: string | null }[];
}

/** Busca de assinantes e usuários de uma conta do Tech (ou das contas da Sua base). */
export const getOpcoesPlataforma = createServerFn({ method: "POST" })
  .middleware([guardaPlataforma()])
  .validator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const f = lerFiltros(o);
    const busca = typeof o.busca === "string" ? o.busca.trim().slice(0, 80) : "";
    return { base: f.base, licenca: f.licenca, busca };
  })
  .handler(async ({ data, context }): Promise<OpcoesPlataforma> => {
    const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
    const { opcoesDaPlataforma } = await import("./producao-ecossistema.server");
    return comPlataforma(context.userId, (tx) =>
      opcoesDaPlataforma(tx, {
        busca: data.busca || undefined,
        licenca: data.base === "assinante" ? data.licenca : undefined,
        daBase: data.base === "sua_base",
      }),
    );
  });
