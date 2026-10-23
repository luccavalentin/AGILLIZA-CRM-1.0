/**
 * Gestão de Tecnologia — leituras e ações (ponte para o banco da plataforma, migração 0233
 * do Corretor; também 0098/0099/0171).
 *
 * Toda leitura passa por `exigirPermissao(["saas.tecnologia", "view"])` no Agilliza e,
 * dentro da ponte, pelas permissões de plataforma do banco (monitoramento.ver /
 * integracoes.ver; tenants.ler para nomes; incidentes.gerir para editar). O banco é quem
 * decide: aqui não há regra copiada.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { TxPlataforma } from "@/lib/plataforma/ponte.server";

export const JANELAS = ["1h", "6h", "24h", "7d"] as const;
export type Janela = (typeof JANELAS)[number];

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface Coleta<T = Record<string, unknown>> {
  coletado_em: string;
  dados: T;
}

export interface DadosHost {
  discos?: { ponto: string; uso_pct: number | null; livre_gb?: number | null }[];
  memoria?: { uso_pct: number | null; total_gb?: number | null };
  cpu?: { nucleos?: number | null; carga_1m?: number | null; carga_5m?: number | null };
  containers?: { nome: string; estado: string }[];
  containers_parados?: string[];
  backup?: { ultimo_ok: string | null; tipo?: string | null; erro?: string };
  certificado?: { dominio: string | null; dias_restantes: number | null; erro?: string };
}

export interface ResumoTecnologia {
  gerado_em: string;
  requisicoes_5min: {
    total: number;
    falhas: number;
    recusas: number;
    p95_ms: number | null;
    por_minuto: number;
  };
  requisicoes_15min: { total: number; falhas: number; p95_ms: number | null; taxa_falha: number };
  online_agora: number;
  incidentes: { abertos: number; criticos: number };
  fila: { pendentes: number; mortas_24h: number; mais_antiga: string | null };
  jobs_com_erro: number;
  coletas: {
    host?: Coleta<DadosHost>;
    worker?: Coleta<{ nome?: string; memoria_mb?: number; faixas?: string[] }>;
    apifull?: Coleta<{ saldo: number | null; erro?: string }>;
  };
  erros_cliente: { abertos: number; novos_1h: number; ocorrencias_1h: number };
  telemetria_desde: string | null;
}

export interface PontoOperacao {
  inicio: string;
  requisicoes: number;
  falhas: number;
  recusas: number;
  p50_ms: number | null;
  p95_ms: number | null;
  licencas: number;
  sessoes: number;
  provedor_chamadas: number;
  provedor_falhas: number;
  fila: number;
  jobs_falhas: number;
}

export interface Sonda {
  sistema: "agilliza" | "corretor";
  ok: boolean;
  ms: number | null;
  banco: string | null;
  detalhe: string | null;
}

export interface ResumoOperacao {
  janela: Janela;
  de: string;
  passo_s: number;
  requisicoes: number;
  falhas: number;
  recusas: number;
  taxa_falha: number;
  p50_ms: number | null;
  p95_ms: number | null;
  licencas: number;
  anterior: { requisicoes: number; falhas: number; p95_ms: number | null };
  sessoes_ativas: number;
  provedor_chamadas: number;
  provedor_falhas: number;
  fila_pendentes: number;
  fila_mortas: number;
  jobs_falhas: number;
  telemetria_desde: string | null;
}

export interface LicencaOperacao {
  tenant_id: string;
  nome: string;
  tipo: string;
  status: string;
  requisicoes: number;
  falhas: number;
  recusas: number;
  p95_ms: number | null;
  sessoes: number;
  ultima_atividade: string | null;
  tendencia: number[];
}

export interface RotaOperacao {
  rota: string;
  tipo: string;
  requisicoes: number;
  falhas: number;
  recusas: number;
  p50_ms: number | null;
  p95_ms: number | null;
  max_ms: number | null;
}

export interface SeriesServidor {
  janela: Janela;
  de: string;
  passo_s: number;
  gerado_em: string;
  ultimo: {
    host?: Coleta<DadosHost>;
    worker?: Coleta<{ nome?: string; memoria_mb?: number; faixas?: string[] }>;
    apifull?: Coleta<{ saldo: number | null; erro?: string }>;
    banco?: Coleta<Record<string, number | null>>;
  };
  host: {
    em: string;
    disco_pct: number | null;
    memoria_pct: number | null;
    carga_1m: number | null;
    carga_5m: number | null;
    nucleos: number | null;
    containers: number;
    containers_parados: number;
    backup_idade_h: number | null;
    certificado_dias: number | null;
  }[];
  worker: { em: string; memoria_mb: number | null; faixas: number }[];
  apifull: { em: string; saldo: number | null }[];
  banco: {
    em: string;
    uso_pct: number | null;
    conexoes: number | null;
    cache_hit_pct: number | null;
    tamanho_mb: number | null;
    transacao_mais_longa_s: number | null;
  }[];
}

export interface ErroAgrupado {
  id: number;
  sistema: "corretor" | "agilliza";
  origem: "navegador" | "servidor";
  tipo: string | null;
  mensagem: string;
  pilha: string | null;
  rota: string | null;
  versao: string | null;
  navegador: string | null;
  sistema_op: string | null;
  perfil: string | null;
  conta: string | null;
  ocorrencias: number;
  ocorrencias_24h: number;
  primeira_em: string;
  ultima_em: string;
  status: "aberto" | "resolvido";
  resolvido_em: string | null;
  tendencia: number[];
}

export interface ListaErros {
  gerado_em: string;
  resumo: {
    abertos: number;
    novos_24h: number;
    corretor: number;
    agilliza: number;
    ocorrencias_24h: number;
  };
  serie_24h: { hora: string; corretor: number; agilliza: number }[];
  itens: ErroAgrupado[];
}

export interface LinhaLogUnificado {
  fonte: "requisicao" | "provedor" | "rotina";
  criado_em: string;
  nivel: "erro" | "aviso" | "info";
  tenant_id: string | null;
  conta: string | null;
  rota: string | null;
  status: number | null;
  codigo: string | null;
  duracao_ms: number | null;
  detalhe: string | null;
}

export interface UsuariosAtivos {
  gerado_em: string;
  janela: "agora" | "24h" | "30d";
  online_agora: number;
  ativos_24h: number;
  ativos_30d: number;
  por_perfil: Record<string, number>;
  por_uf: Record<string, number>;
  sem_uf: number;
  lista_permitida: boolean;
  online:
    | {
        nome: string;
        conta: string | null;
        perfil: string;
        uf: string | null;
        ultimo_uso_em: string;
      }[]
    | null;
  tendencia_30d: { dia: string; usuarios: number }[];
  retrato_desde: string | null;
}

export interface EventoAtividade {
  em: string;
  tipo:
    | "incidente_aberto"
    | "incidente_resolvido"
    | "alerta"
    | "licenca_criada"
    | "erro_novo"
    | "rotina_erro";
  titulo: string;
  nivel: string;
  detalhe: string | null;
}

export interface LicencaRecente {
  tenant_id: string;
  conta: string;
  tipo: string;
  plano: string | null;
  status: string;
  criado_em: string;
  uf: string | null;
  inadimplente: boolean | null;
  responsavel: string | null;
  email: string | null;
}

export interface PainelTecnologia {
  gerado_em: string;
  lista_permitida: boolean;
  licencas: {
    total: number;
    ativas: number;
    teste: number;
    novas_7d: number;
    travadas: number;
    inadimplentes: number;
  };
  atividade: EventoAtividade[];
  recentes: LicencaRecente[] | null;
}

export interface LimitesAlertas {
  valores: Record<string, number>;
  atualizado_em: string | null;
  atualizado_por: string | null;
  pode_editar: boolean;
}

export interface IncidenteResumo {
  id: string;
  severidade: "info" | "aviso" | "alta" | "critica";
  categoria: string;
  titulo: string;
  status: "aberto" | "reconhecido" | "resolvido";
  ocorrencias: number;
  primeira_em: string;
  ultima_em: string;
  resolvido_em: string | null;
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

async function ponte<R>(userId: string, fn: (tx: TxPlataforma) => Promise<R>): Promise<R> {
  const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
  return comPlataforma(userId, fn);
}

async function pode(tx: TxPlataforma, permissao: string): Promise<boolean> {
  const r = await tx.uma<{ ok: boolean }>("select seguranca.auth_e_plataforma($1) as ok", [
    permissao,
  ]);
  return Boolean(r?.ok);
}

/** Sonda o `/api/saude` do Corretor pela rede interna (o navegador nunca fala com ele). */
async function sondarCorretor(): Promise<Sonda> {
  const base = (process.env.CORRETOR_INTERNO_URL ?? "http://corretor-web:3000").replace(/\/$/, "");
  const t0 = performance.now();
  try {
    const r = await fetch(`${base}/api/saude`, {
      signal: AbortSignal.timeout(3000),
      headers: { "cache-control": "no-store" },
    });
    const ms = Math.round(performance.now() - t0);
    const corpo = (await r.json().catch(() => null)) as {
      banco?: string;
      banco_ms?: number;
    } | null;
    return {
      sistema: "corretor",
      ok: r.ok,
      ms,
      banco: r.ok ? `${corpo?.banco_ms ?? "?"} ms` : (corpo?.banco ?? null),
      detalhe: r.ok ? null : `HTTP ${r.status}`,
    };
  } catch (e) {
    return {
      sistema: "corretor",
      ok: false,
      ms: null,
      banco: null,
      detalhe: (e as Error)?.name === "TimeoutError" ? "sem resposta em 3 s" : "inalcançável",
    };
  }
}

async function sondarAgilliza(): Promise<Sonda> {
  const { sondarPonte } = await import("@/lib/plataforma/ponte.server");
  const t0 = performance.now();
  const p = await sondarPonte();
  return {
    sistema: "agilliza",
    ok: !p.configurada || p.ok,
    ms: Math.round(performance.now() - t0),
    banco: p.configurada ? (p.ok ? `${p.ms} ms` : "indisponível") : "ponte não configurada",
    detalhe: null,
  };
}

const janela = z.enum(JANELAS).default("1h");

// ---------------------------------------------------------------------------
// Visão geral (ao vivo)
// ---------------------------------------------------------------------------

export const lerVisaoGeral = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .handler(async ({ context }) => {
    const [corretor, agilliza, dados] = await Promise.all([
      sondarCorretor(),
      sondarAgilliza(),
      ponte(context.userId, async (tx) => {
        const resumo = await tx.uma<{ r: ResumoTecnologia }>(
          "select plataforma.tecnologia_resumo() as r",
        );
        const serie = (await pode(tx, "integracoes.ver"))
          ? await tx.consultar<PontoOperacao>(
              "select (to_jsonb(inicio) #>> '{}') as inicio, requisicoes, falhas, recusas, p50_ms, p95_ms, licencas, sessoes, provedor_chamadas, provedor_falhas, fila, jobs_falhas from plataforma.operacao_serie('1h')",
            )
          : [];
        const painel = await tx.uma<{ r: PainelTecnologia }>(
          "select plataforma.tecnologia_painel() as r",
        );
        const online = await tx.uma<{ r: UsuariosAtivos }>(
          "select plataforma.usuarios_ativos('agora') as r",
        );
        return {
          resumo: resumo?.r ?? null,
          serie,
          painel: painel?.r ?? null,
          online: online?.r ?? null,
        };
      }),
    ]);
    return { sondas: [agilliza, corretor], ...dados };
  });

/** Série do gráfico "Acessos e latência" (janela escolhida no próprio cartão). */
export const lerAcessos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .inputValidator((d: unknown) => z.object({ janela }).parse(d ?? {}))
  .handler(async ({ data, context }) =>
    ponte(context.userId, async (tx) =>
      (await pode(tx, "integracoes.ver"))
        ? tx.consultar<PontoOperacao>(
            "select (to_jsonb(inicio) #>> '{}') as inicio, requisicoes, falhas, recusas, p50_ms, p95_ms, licencas, sessoes, provedor_chamadas, provedor_falhas, fila, jobs_falhas from plataforma.operacao_serie($1)",
            [data.janela],
          )
        : [],
    ),
  );

// ---------------------------------------------------------------------------
// Operação
// ---------------------------------------------------------------------------

export const lerOperacao = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .inputValidator((d: unknown) => z.object({ janela }).parse(d ?? {}))
  .handler(async ({ data, context }) =>
    ponte(context.userId, async (tx) => {
      const resumo = await tx.uma<{ r: ResumoOperacao }>(
        "select plataforma.operacao_resumo($1) as r",
        [data.janela],
      );
      const serie = await tx.consultar<PontoOperacao>(
        "select (to_jsonb(inicio) #>> '{}') as inicio, requisicoes, falhas, recusas, p50_ms, p95_ms, licencas, sessoes, provedor_chamadas, provedor_falhas, fila, jobs_falhas from plataforma.operacao_serie($1)",
        [data.janela],
      );
      const lentas = await tx.consultar<RotaOperacao>(
        "select * from plataforma.operacao_rotas($1, 'lentas', 10)",
        [data.janela],
      );
      const licencas = await tx.consultar<LicencaOperacao>(
        `select tenant_id, nome, tipo, status, requisicoes, falhas, recusas, p95_ms, sessoes,
                (to_jsonb(ultima_atividade) #>> '{}') as ultima_atividade, tendencia
           from plataforma.operacao_licencas($1, 'falhas', 10)`,
        [data.janela],
      );
      return {
        resumo: resumo?.r ?? null,
        serie,
        lentas,
        licencas: licencas.filter((l) => l.falhas > 0 || l.recusas > 0 || l.requisicoes > 0),
      };
    }),
  );

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

export const lerServidor = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .inputValidator((d: unknown) =>
    z.object({ janela: z.enum(["24h", "7d"]).default("24h") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) =>
    ponte(context.userId, async (tx) => {
      const r = await tx.uma<{ r: SeriesServidor }>("select plataforma.metricas_series($1) as r", [
        data.janela,
      ]);
      return r?.r ?? null;
    }),
  );

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export const lerErros = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        sistema: z.enum(["corretor", "agilliza"]).nullable().default(null),
        origem: z.enum(["navegador", "servidor"]).nullable().default(null),
        status: z.enum(["aberto", "resolvido", "todos"]).default("aberto"),
        busca: z.string().trim().max(80).default(""),
        ordem: z.enum(["recentes", "frequentes"]).default("recentes"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) =>
    ponte(context.userId, async (tx) => {
      const r = await tx.uma<{ r: ListaErros }>(
        "select plataforma.erros_cliente_listar($1, $2, $3, $4, $5, 150) as r",
        [data.sistema, data.origem, data.status, data.busca || null, data.ordem],
      );
      const editar = await pode(tx, "incidentes.gerir");
      return { lista: r?.r ?? null, podeResolver: editar };
    }),
  );

export const marcarErro = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.tecnologia", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: z.number().int().positive(), status: z.enum(["aberto", "resolvido"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ponte(context.userId, (tx) =>
      tx.consultar("select plataforma.erros_cliente_marcar($1, $2)", [data.id, data.status]),
    );
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export const FONTES_LOG = ["requisicao", "provedor", "rotina"] as const;

export const lerLogs = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        fontes: z
          .array(z.enum(FONTES_LOG))
          .min(1)
          .default([...FONTES_LOG]),
        periodo: z.enum(["1h", "6h", "24h", "3d", "7d", "14d"]).default("24h"),
        tenant: z.string().uuid().nullable().default(null),
        rota: z.string().trim().max(120).default(""),
        codigo: z.string().trim().max(40).default(""),
        busca: z.string().trim().max(80).default(""),
        soErro: z.boolean().default(true),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const horas = { "1h": 1, "6h": 6, "24h": 24, "3d": 72, "7d": 168, "14d": 336 }[data.periodo];
    return ponte(context.userId, async (tx) => {
      const linhas = await tx.consultar<LinhaLogUnificado>(
        `select fonte, (to_jsonb(criado_em) #>> '{}') as criado_em, nivel, tenant_id, conta, rota, status, codigo,
                duracao_ms, detalhe
           from plataforma.logs_unificados($1::text[], now() - make_interval(hours => $2), now(),
                                            $3::uuid, $4, $5, $6, $7, 300)`,
        [
          data.fontes,
          horas,
          data.tenant,
          data.rota || null,
          data.codigo || null,
          data.busca || null,
          data.soErro,
        ],
      );
      // Contas para o filtro: as que aparecem nos logs + as com mais uso agora.
      const contas = await tx.consultar<{ id: string; nome: string }>(
        `select tenant_id as id, nome from plataforma.operacao_licencas('24h', 'uso', 50)`,
      );
      return { linhas, contas };
    });
  });

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export const lerUsuarios = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .inputValidator((d: unknown) =>
    z.object({ janela: z.enum(["agora", "24h", "30d"]).default("agora") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) =>
    ponte(context.userId, async (tx) => {
      const r = await tx.uma<{ r: UsuariosAtivos }>("select plataforma.usuarios_ativos($1) as r", [
        data.janela,
      ]);
      return r?.r ?? null;
    }),
  );

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export const lerAlertas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.tecnologia", "view"])])
  .handler(async ({ context }) =>
    ponte(context.userId, async (tx) => {
      const limites = await tx.uma<{ r: LimitesAlertas }>(
        "select plataforma.alertas_limites() as r",
      );
      const inc = await tx.uma<{ r: { incidentes: IncidenteResumo[]; total: number } }>(
        "select plataforma.listar_incidentes(null, 1) as r",
      );
      return {
        limites: limites?.r ?? null,
        incidentes: (inc?.r?.incidentes ?? []).slice(0, 30),
        totalIncidentes: inc?.r?.total ?? 0,
      };
    }),
  );

export const salvarAlertas = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.tecnologia", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        valores: z
          .record(
            z.string().regex(/^[a-z0-9_]{2,60}$/),
            z.number().min(0, "Use um número a partir de zero.").max(10_000_000),
          )
          .refine((v) => Object.keys(v).length > 0, "Nada para salvar."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await ponte(context.userId, (tx) =>
      tx.uma<{ r: Record<string, number> }>(
        "select plataforma.alterar_alertas_limites($1::jsonb) as r",
        [JSON.stringify(data.valores)],
      ),
    );
    return { ok: true as const, valores: r?.r ?? {} };
  });
