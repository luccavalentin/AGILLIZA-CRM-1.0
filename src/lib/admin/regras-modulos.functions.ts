import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EscopoDados = "todos" | "equipe" | "proprios" | "personalizado";

export type EscopoAlvoTipo = "usuario" | "papel" | "tipo_pessoa";

export interface EscopoAlvo {
  alvo_tipo: EscopoAlvoTipo;
  alvo_id?: string | null;
  alvo_valor?: string | null;
}

export interface AcaoCatalogo {
  acao: string;
  label: string;
}

export interface ModuloCatalogo {
  modulo: string;
  label: string;
  grupo: string;
  acoes: AcaoCatalogo[];
}

/**
 * Catálogo canônico de módulos e ações do sistema interno.
 * A matriz de permissões (`/admin/regras-modulos`) é montada a partir daqui.
 */
export const CATALOGO_MODULOS: ModuloCatalogo[] = [
  {
    grupo: "CRM",
    modulo: "crm.clientes",
    label: "Clientes",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "delete", label: "Excluir" },
      { acao: "export", label: "Exportar" },
      { acao: "pii:view", label: "Ver dados sensíveis" },
    ],
  },
  {
    grupo: "CRM",
    modulo: "crm.parceiros",
    label: "Parceiros",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "delete", label: "Excluir" },
    ],
  },
  {
    grupo: "CRM",
    modulo: "crm.scan_ia",
    label: "Scan IA",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Processar" },
    ],
  },
  {
    grupo: "CRM",
    modulo: "crm.chat",
    label: "Chat e Follow-up do cliente",
    acoes: [
      { acao: "view", label: "Ver conversas" },
      { acao: "create", label: "Enviar mensagens" },
      { acao: "gerir", label: "Gerir atendimento (transferir/etiquetar)" },
    ],
  },
  {
    grupo: "Operacional",
    modulo: "operacional.chats",
    label: "Central de Conversas (chat interno)",
    acoes: [
      { acao: "view", label: "Ver conversas" },
      { acao: "create", label: "Iniciar/Enviar mensagens" },
      { acao: "anexar", label: "Enviar anexos" },
    ],
  },
  {
    grupo: "Operacional",
    modulo: "operacional.simulacoes",
    label: "Simulações",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Operacional",
    modulo: "operacional.propostas",
    label: "Propostas",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "enviar", label: "Enviar ao banco" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Operacional",
    modulo: "operacional.tarefas",
    label: "Tarefas",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "atribuir", label: "Atribuir" },
    ],
  },
  {
    grupo: "Operacional",
    modulo: "operacional.demandas",
    label: "Demandas",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "transferir", label: "Transferir" },
      { acao: "encerrar", label: "Encerrar" },
    ],
  },
  {
    grupo: "Documentos",
    modulo: "documentos.arquivos",
    label: "Arquivos",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Enviar" },
      { acao: "delete", label: "Excluir" },
    ],
  },
  {
    grupo: "Documentos",
    modulo: "documentos.formularios",
    label: "Formulários",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Enviar" },
    ],
  },
  {
    grupo: "Documentos",
    modulo: "documentos.links",
    label: "Links",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "delete", label: "Excluir" },
    ],
  },
  {
    grupo: "Documentos",
    modulo: "documentos.matriculas",
    label: "Controle de Matrículas",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Solicitar" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Financeiro",
    modulo: "financeiro.painel",
    label: "Painel financeiro",
    acoes: [{ acao: "view", label: "Ver" }],
  },
  {
    grupo: "Financeiro",
    modulo: "financeiro.contas_pagar",
    label: "Contas a pagar",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "baixar", label: "Baixar" },
    ],
  },
  {
    grupo: "Financeiro",
    modulo: "financeiro.contas_receber",
    label: "Contas a receber",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "baixar", label: "Baixar" },
    ],
  },
  {
    grupo: "Financeiro",
    modulo: "financeiro.comissoes",
    label: "Repasses",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Financeiro",
    modulo: "financeiro.fluxo_caixa",
    label: "Fluxo de caixa",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Relatórios",
    modulo: "relatorios.geral",
    label: "Relatórios",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.pessoas",
    label: "Pessoas",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.regras",
    label: "Regras & Módulos",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.integracoes",
    label: "Integrações",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.parametros",
    label: "Parâmetros",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.compras",
    label: "Compras (geral)",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.compras.pedidos",
    label: "Pedidos de compra",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.compras.aprovacoes",
    label: "Aprovação de compras",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Aprovar / reprovar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.comissoes",
    label: "Repasses (regras)",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.sla",
    label: "SLA & Feriados",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.notificacoes",
    label: "Notificações",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Administração",
    modulo: "admin.auditoria",
    label: "Auditoria",
    acoes: [{ acao: "view", label: "Ver" }],
  },
  {
    grupo: "Administração",
    modulo: "admin.backup",
    label: "Backup",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Gerar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.dashboard",
    label: "Dashboard de RH",
    acoes: [{ acao: "view", label: "Ver" }],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.funcionarios",
    label: "Funcionários",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
      { acao: "edit", label: "Editar" },
      { acao: "delete", label: "Excluir" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.documentos",
    label: "Documentos do funcionário",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Enviar" },
      { acao: "delete", label: "Excluir" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.ocorrencias",
    label: "Faltas, atestados e ocorrências",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Registrar" },
      { acao: "edit", label: "Editar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.ferias",
    label: "Férias",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Programar" },
      { acao: "edit", label: "Aprovar / editar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.beneficios",
    label: "Benefícios",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Configurar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.adiantamentos",
    label: "Adiantamentos",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Registrar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.descontos",
    label: "Descontos",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Registrar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.salariais",
    label: "Alterações salariais",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Registrar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.previa_folha",
    label: "Prévia da folha",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.holerites",
    label: "Holerites e recibos",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Anexar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.relatorios",
    label: "Relatórios de RH",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "export", label: "Exportar" },
    ],
  },
  {
    grupo: "Gestão de Pessoas e RH",
    modulo: "rh.configuracoes",
    label: "Configurações do RH",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
    ],
  },
];

export interface PermissaoAtual {
  modulo: string;
  acao: string;
  permitido: boolean;
  escopo_dados: EscopoDados;
}

export type PapelNivel = "gestor" | "comercial" | "analista" | "imobiliaria" | "corretor";
export type AcessoTipo = "sistema" | "portal_parceiro";

/** Papéis disponíveis por portal. */
export const PAPEIS_POR_PORTAL: Record<AcessoTipo, { value: PapelNivel; label: string }[]> = {
  sistema: [
    { value: "gestor", label: "Gestor" },
    { value: "gestor", label: "Gestão" },
    { value: "comercial", label: "Comercial" },
    { value: "analista", label: "Analista" },
  ],
  portal_parceiro: [
    { value: "corretor", label: "Corretor" },
    { value: "imobiliaria", label: "Imobiliária" },
  ],
};

export interface NivelAcesso {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  is_padrao: boolean;
  editavel: boolean;
  papel: PapelNivel;
  acesso_tipo: AcessoTipo;
  permissoes: PermissaoAtual[];
  /** Alvos do escopo personalizado, por módulo. */
  alvos: Record<string, EscopoAlvo[]>;
}

/** Lista os níveis de acesso visíveis ao usuário e suas permissões. */
export const listarNiveisAcesso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NivelAcesso[]> => {
    const { supabase, userId } = context;

    const { data: corresp } = await supabase.rpc("correspondente_do_usuario", {
      _user_id: userId,
    });
    const { data: podeGerenciar } = await supabase.rpc("pode_gerenciar_pessoas", {
      _user_id: userId,
    });

    const { data: niveis, error } = await supabase
      .from("access_levels")
      .select("id, nome, descricao, ativo, is_padrao, correspondente_id, papel, acesso_tipo")
      .order("is_padrao", { ascending: false })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (niveis ?? []).map((n) => n.id);
    const { data: perms } = ids.length
      ? await supabase
          .from("permissions")
          .select("id, nivel_acesso_id, modulo, acao, permitido, escopo_dados")
          .in("nivel_acesso_id", ids)
      : { data: [] as any[] };

    // Alvos do escopo personalizado (por permissão -> módulo).
    const permIds = (perms ?? []).map((p: any) => p.id);
    const { data: alvos } = permIds.length
      ? await supabase
          .from("permission_escopo_alvos")
          .select("permission_id, alvo_tipo, alvo_id, alvo_valor")
          .in("permission_id", permIds)
      : { data: [] as any[] };

    // Mapa permission_id -> { nivel, modulo }
    const permInfo = new Map<string, { nivel: string; modulo: string }>();
    (perms ?? []).forEach((p: any) =>
      permInfo.set(p.id, { nivel: p.nivel_acesso_id, modulo: p.modulo }),
    );
    // nivel -> modulo -> alvos (deduplicados)
    const alvosPorNivel = new Map<string, Record<string, EscopoAlvo[]>>();
    (alvos ?? []).forEach((a: any) => {
      const info = permInfo.get(a.permission_id);
      if (!info) return;
      const byModulo = alvosPorNivel.get(info.nivel) ?? {};
      const lista = byModulo[info.modulo] ?? [];
      const chave = `${a.alvo_tipo}:${a.alvo_id ?? ""}:${a.alvo_valor ?? ""}`;
      if (!lista.some((x) => `${x.alvo_tipo}:${x.alvo_id ?? ""}:${x.alvo_valor ?? ""}` === chave)) {
        lista.push({ alvo_tipo: a.alvo_tipo, alvo_id: a.alvo_id, alvo_valor: a.alvo_valor });
      }
      byModulo[info.modulo] = lista;
      alvosPorNivel.set(info.nivel, byModulo);
    });

    // Se o correspondente já possui a sua versão de um nível padrão (mesmo
    // nome + portal), escondemos o template global para não exibir duplicado.
    const chavesProprias = new Set(
      (niveis ?? [])
        .filter((n: any) => n.correspondente_id)
        .map((n: any) => `${n.nome}::${n.acesso_tipo ?? "sistema"}`),
    );

    return (niveis ?? [])
      .filter(
        (n: any) =>
          n.correspondente_id ||
          !chavesProprias.has(`${n.nome}::${n.acesso_tipo ?? "sistema"}`),
      )
      .map((n: any) => ({
        id: n.id,
        nome: n.nome,
        descricao: n.descricao,
        ativo: n.ativo,
        is_padrao: n.is_padrao,
        papel: (n.papel ?? "comercial") as PapelNivel,
        acesso_tipo: (n.acesso_tipo ?? "sistema") as AcessoTipo,
        // Qualquer usuário que pode gerenciar pessoas edita todos os níveis.
        editavel: podeGerenciar === true,
        permissoes: (perms ?? [])
          .filter((p: any) => p.nivel_acesso_id === n.id)
          .map((p: any) => ({
            modulo: p.modulo,
            acao: p.acao,
            permitido: p.permitido,
            escopo_dados: p.escopo_dados,
          })),
        alvos: alvosPorNivel.get(n.id) ?? {},
      }));
  });

/** Clona um nível padrão (global) em uma cópia editável do correspondente,
 *  copiando as permissões. Retorna o id da cópia. */
async function forkNivelPadrao(
  supabase: any,
  corresp: string,
  origemId: string,
  overrides?: {
    nome?: string;
    descricao?: string | null;
    papel?: PapelNivel;
    acesso_tipo?: AcessoTipo;
  },
): Promise<string> {
  const { data: origem, error: erroOrigem } = await supabase
    .from("access_levels")
    .select("id, nome, descricao, papel, acesso_tipo")
    .eq("id", origemId)
    .maybeSingle();
  if (erroOrigem) throw new Error(erroOrigem.message);
  if (!origem) throw new Error("Nível de acesso não encontrado.");

  const { data: copia, error: erroCopia } = await supabase
    .from("access_levels")
    .insert({
      nome: overrides?.nome ?? origem.nome,
      descricao: overrides?.descricao ?? origem.descricao ?? null,
      papel: overrides?.papel ?? origem.papel ?? "comercial",
      acesso_tipo: overrides?.acesso_tipo ?? origem.acesso_tipo ?? "sistema",
      correspondente_id: corresp,
      ativo: true,
      // Mantém como padrão do correspondente: a partir daqui ele edita este
      // registro no lugar (sem gerar novas cópias a cada alteração).
      is_padrao: true,
    })
    .select("id")
    .single();
  if (erroCopia) throw new Error(erroCopia.message);

  const { data: perms } = await supabase
    .from("permissions")
    .select("modulo, acao, permitido, escopo_dados")
    .eq("nivel_acesso_id", origemId)
    .eq("permitido", true);
  const rows = (perms ?? []).map((p: any) => ({
    nivel_acesso_id: copia.id,
    modulo: p.modulo,
    acao: p.acao,
    permitido: true,
    escopo_dados: p.escopo_dados,
  }));
  if (rows.length) {
    const { error: erroPerms } = await supabase.from("permissions").insert(rows);
    if (erroPerms) throw new Error(erroPerms.message);
  }

  // Se pessoas do ecossistema ainda apontam para o template global oculto,
  // movemos todas para a cópia visível/editável. Sem isso, a tela parece salvar,
  // mas o usuário continua usando as permissões antigas do template global.
  const { error: perfilErr } = await supabase
    .from("profiles")
    .update({ nivel_acesso_id: copia.id })
    .eq("correspondente_id", corresp)
    .eq("nivel_acesso_id", origemId);
  if (perfilErr) throw new Error(perfilErr.message);

  return copia.id;
}

/** Cria um novo nível de acesso customizado para o correspondente do usuário.
 *  Já nasce com uma matriz de permissões: copiada de outro nível (`copiar_de`)
 *  ou um baseline "somente leitura" (view = próprios) em todos os módulos. */
export const criarNivelAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      nome: string;
      descricao?: string;
      copiar_de?: string;
      papel?: PapelNivel;
      acesso_tipo?: AcessoTipo;
    }) =>
      z
        .object({
          nome: z.string().trim().min(2).max(60),
          descricao: z.string().trim().max(200).optional(),
          copiar_de: z.string().uuid().optional(),
          papel: z
            .enum(["gestor", "comercial", "analista", "imobiliaria", "corretor"])
            .default("comercial"),
          acesso_tipo: z.enum(["sistema", "portal_parceiro"]).default("sistema"),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: corresp } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    if (!corresp) throw new Error("Correspondente não encontrado para o usuário.");
    const { data: novo, error } = await supabase
      .from("access_levels")
      .insert({
        nome: data.nome,
        descricao: data.descricao ?? null,
        papel: data.papel,
        acesso_tipo: data.acesso_tipo,
        correspondente_id: corresp,
        ativo: true,
        is_padrao: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Monta a matriz inicial de permissões do novo nível.
    let rows: {
      nivel_acesso_id: string;
      modulo: string;
      acao: string;
      permitido: boolean;
      escopo_dados: EscopoDados;
    }[] = [];

    if (data.copiar_de) {
      // Confirma que o nível de origem é visível ao usuário antes de copiar.
      const { data: origem } = await supabase
        .from("access_levels")
        .select("id")
        .eq("id", data.copiar_de)
        .maybeSingle();
      if (origem) {
        const { data: perms } = await supabase
          .from("permissions")
          .select("modulo, acao, permitido, escopo_dados")
          .eq("nivel_acesso_id", data.copiar_de)
          .eq("permitido", true);
        rows = (perms ?? []).map((p: any) => ({
          nivel_acesso_id: novo.id,
          modulo: p.modulo,
          acao: p.acao,
          permitido: true,
          escopo_dados: p.escopo_dados,
        }));
      }
    } else {
      // Baseline: acesso de visualização (próprios) a cada módulo do catálogo.
      rows = CATALOGO_MODULOS.filter((m) => m.acoes.some((a) => a.acao === "view")).map((m) => ({
        nivel_acesso_id: novo.id,
        modulo: m.modulo,
        acao: "view",
        permitido: true,
        escopo_dados: "proprios" as EscopoDados,
      }));
    }

    if (rows.length) {
      const { error: permErr } = await supabase.from("permissions").insert(rows);
      if (permErr) throw new Error(permErr.message);
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corresp,
      acao: "nivel_acesso.criar",
      entidade: "access_levels",
      entidadeId: novo.id,
      payloadNovo: { nome: data.nome, copiar_de: data.copiar_de ?? null },
    });

    return { id: novo.id };
  });

/** Atualiza nome/descrição/papel/portal de um nível de acesso customizado. */
export const atualizarNivelAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      nome: string;
      descricao?: string;
      papel?: PapelNivel;
      acesso_tipo?: AcessoTipo;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          nome: z.string().trim().min(2).max(60),
          descricao: z.string().trim().max(200).optional(),
          papel: z.enum(["gestor", "comercial", "analista", "imobiliaria", "corretor"]).optional(),
          acesso_tipo: z.enum(["sistema", "portal_parceiro"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pode } = await supabase.rpc("pode_gerenciar_pessoas", { _user_id: userId });
    if (!pode) throw new Error("Você não tem permissão para editar níveis de acesso.");

    const { data: corresp } = await supabase.rpc("correspondente_do_usuario", {
      _user_id: userId,
    });
    if (!corresp) throw new Error("Correspondente não encontrado para o usuário.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: nivel } = await supabaseAdmin
      .from("access_levels")
      .select("id, is_padrao, correspondente_id, nome, descricao, papel, acesso_tipo")
      .eq("id", data.id)
      .maybeSingle();
    if (!nivel) throw new Error("Nível de acesso não encontrado.");

    // Só o template global (sem correspondente) é clonado uma única vez.
    // O nível padrão já pertencente ao correspondente é editado no lugar.
    if (nivel.is_padrao && !nivel.correspondente_id) {
      const novoId = await forkNivelPadrao(supabaseAdmin, corresp, data.id, {
        nome: data.nome,
        descricao: data.descricao ?? null,
        papel: (data.papel ?? nivel.papel) as PapelNivel,
        acesso_tipo: (data.acesso_tipo ?? nivel.acesso_tipo) as AcessoTipo,
      });
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: corresp,
        acao: "nivel_acesso.personalizar",
        entidade: "access_levels",
        entidadeId: novoId,
        payloadNovo: { origem: data.id, nome: data.nome },
      });
      return { ok: true, id: novoId, clonado: true };
    }

    if (nivel.correspondente_id !== corresp) {
      throw new Error("Este nível de acesso não pertence ao seu ecossistema.");
    }

    const { data: atualizado, error } = await supabaseAdmin
      .from("access_levels")
      .update({
        nome: data.nome,
        descricao: data.descricao ?? null,
        ...(data.papel ? { papel: data.papel } : {}),
        ...(data.acesso_tipo ? { acesso_tipo: data.acesso_tipo } : {}),
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!atualizado) throw new Error("Nenhum nível de acesso foi atualizado.");

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corresp,
      acao: "nivel_acesso.atualizar",
      entidade: "access_levels",
      entidadeId: data.id,
      payloadAnterior: { nome: nivel.nome, descricao: nivel.descricao },
      payloadNovo: { nome: data.nome, descricao: data.descricao ?? null },
    });
    return { ok: true, id: data.id, clonado: false };
  });

/** Exclui um nível de acesso customizado (e suas permissões). */
export const excluirNivelAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nivel } = await supabase
      .from("access_levels")
      .select("id, is_padrao, nome")
      .eq("id", data.id)
      .maybeSingle();
    if (!nivel) throw new Error("Nível de acesso não encontrado.");
    if (nivel.is_padrao)
      throw new Error(
        "Este é um nível padrão do sistema e não pode ser excluído. Edite-o para criar uma cópia personalizada — essa cópia pode ser excluída depois.",
      );

    // Impede exclusão se houver pessoas usando este nível.
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("nivel_acesso_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("Não é possível excluir: há pessoas usando este nível de acesso.");
    }

    await supabase.from("permissions").delete().eq("nivel_acesso_id", data.id);
    const { error } = await supabase.from("access_levels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "nivel_acesso.excluir",
      entidade: "access_levels",
      entidadeId: data.id,
      payloadAnterior: { nome: nivel.nome },
    });
    return { ok: true };
  });

const permSchema = z.object({
  nivel_acesso_id: z.string().uuid(),
  permissoes: z
    .array(
      z.object({
        modulo: z.string().min(1),
        acao: z.string().min(1),
        permitido: z.boolean(),
        escopo_dados: z.enum(["todos", "equipe", "proprios", "personalizado"]),
      }),
    )
    .max(500),
  /** Alvos do escopo personalizado, por módulo. */
  alvos: z
    .record(
      z.string(),
      z.array(
        z.object({
          alvo_tipo: z.enum(["usuario", "papel", "tipo_pessoa"]),
          alvo_id: z.string().uuid().optional().nullable(),
          alvo_valor: z.string().optional().nullable(),
        }),
      ),
    )
    .optional()
    .default({}),
});

/** Salva a matriz de permissões de um nível de acesso (substitui o conjunto). */
export const salvarPermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => permSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: pode } = await supabase.rpc("pode_gerenciar_pessoas", { _user_id: userId });
    if (!pode) throw new Error("Você não tem permissão para editar permissões.");

    const { data: corresp } = await supabase.rpc("correspondente_do_usuario", {
      _user_id: userId,
    });
    if (!corresp) throw new Error("Correspondente não encontrado para o usuário.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se o nível é padrão (global), cria uma cópia editável do correspondente
    // e grava as permissões nela em vez de tentar escrever no template global.
    let alvoId = data.nivel_acesso_id;
    let clonado = false;
    const { data: nivel, error: nivelErr } = await supabaseAdmin
      .from("access_levels")
      .select("id, is_padrao, correspondente_id")
      .eq("id", data.nivel_acesso_id)
      .maybeSingle();
    if (nivelErr) throw new Error(nivelErr.message);
    if (!nivel) throw new Error("Nível de acesso não encontrado.");

    if (nivel?.is_padrao && !nivel.correspondente_id) {
      alvoId = await forkNivelPadrao(supabaseAdmin, corresp, data.nivel_acesso_id);
      clonado = true;
    } else if (nivel.correspondente_id !== corresp) {
      throw new Error("Este nível de acesso não pertence ao seu ecossistema.");
    }

    // Remove as permissões antigas e regrava após a autorização acima. Usamos
    // escrita administrativa para evitar falso positivo de RLS (sem erro, 0 linhas afetadas).
    const { error: delErr } = await supabaseAdmin
      .from("permissions")
      .delete()
      .eq("nivel_acesso_id", alvoId);
    if (delErr) throw new Error(delErr.message);

    const rows = data.permissoes
      .filter((p) => p.permitido)
      .map((p) => ({
        nivel_acesso_id: alvoId,
        modulo: p.modulo,
        acao: p.acao,
        permitido: true,
        escopo_dados: p.escopo_dados,
      }));

    if (rows.length) {
      const { data: inseridas, error } = await supabaseAdmin
        .from("permissions")
        .insert(rows)
        .select("id, modulo, escopo_dados");
      if (error) throw new Error(error.message);

      // Alvos do escopo personalizado: um registro por (permissão do módulo × alvo).
      const alvoRows: {
        permission_id: string;
        alvo_tipo: string;
        alvo_id: string | null;
        alvo_valor: string | null;
      }[] = [];
      (inseridas ?? []).forEach((perm: any) => {
        if (perm.escopo_dados !== "personalizado") return;
        const lista = data.alvos?.[perm.modulo] ?? [];
        lista.forEach((a) => {
          alvoRows.push({
            permission_id: perm.id,
            alvo_tipo: a.alvo_tipo,
            alvo_id: a.alvo_id ?? null,
            alvo_valor: a.alvo_valor ?? null,
          });
        });
      });
      if (alvoRows.length) {
        const { error: alvoInsertErr } = await supabaseAdmin
          .from("permission_escopo_alvos")
          .insert(alvoRows);
        if (alvoInsertErr) throw new Error(alvoInsertErr.message);
      }
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corresp,
      acao: clonado ? "nivel_acesso.personalizar_permissoes" : "nivel_acesso.salvar_permissoes",
      entidade: "access_levels",
      entidadeId: alvoId,
      payloadNovo: { total: rows.length, origem: clonado ? data.nivel_acesso_id : undefined },
    });
    return { ok: true, total: rows.length, nivel_acesso_id: alvoId, clonado };
  });
