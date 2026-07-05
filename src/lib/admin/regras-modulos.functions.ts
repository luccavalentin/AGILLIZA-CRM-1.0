import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EscopoDados = "todos" | "equipe" | "proprios";

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
    modulo: "operacional.contratos",
    label: "Contratos",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "edit", label: "Editar" },
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
    label: "Comissões",
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
    label: "Compras",
    acoes: [
      { acao: "view", label: "Ver" },
      { acao: "create", label: "Criar" },
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
];

export interface PermissaoAtual {
  modulo: string;
  acao: string;
  permitido: boolean;
  escopo_dados: EscopoDados;
}

export interface NivelAcesso {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  is_padrao: boolean;
  editavel: boolean;
  permissoes: PermissaoAtual[];
}

/** Lista os níveis de acesso visíveis ao usuário e suas permissões. */
export const listarNiveisAcesso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NivelAcesso[]> => {
    const { supabase, userId } = context;

    const { data: corresp } = await supabase.rpc("correspondente_do_usuario", {
      _uid: userId,
    });

    const { data: niveis, error } = await supabase
      .from("access_levels")
      .select("id, nome, descricao, ativo, is_padrao, correspondente_id")
      .order("is_padrao", { ascending: false })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (niveis ?? []).map((n) => n.id);
    const { data: perms } = ids.length
      ? await supabase
          .from("permissions")
          .select("nivel_acesso_id, modulo, acao, permitido, escopo_dados")
          .in("nivel_acesso_id", ids)
      : { data: [] as any[] };

    return (niveis ?? []).map((n: any) => ({
      id: n.id,
      nome: n.nome,
      descricao: n.descricao,
      ativo: n.ativo,
      is_padrao: n.is_padrao,
      editavel: !n.is_padrao && n.correspondente_id === corresp,
      permissoes: (perms ?? [])
        .filter((p: any) => p.nivel_acesso_id === n.id)
        .map((p: any) => ({
          modulo: p.modulo,
          acao: p.acao,
          permitido: p.permitido,
          escopo_dados: p.escopo_dados,
        })),
    }));
  });

/** Cria um novo nível de acesso customizado para o correspondente do usuário. */
export const criarNivelAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; descricao?: string }) =>
    z
      .object({ nome: z.string().trim().min(2).max(60), descricao: z.string().trim().max(200).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: corresp } = await supabase.rpc("correspondente_do_usuario", { _uid: userId });
    if (!corresp) throw new Error("Correspondente não encontrado para o usuário.");
    const { data: novo, error } = await supabase
      .from("access_levels")
      .insert({ nome: data.nome, descricao: data.descricao ?? null, correspondente_id: corresp, ativo: true, is_padrao: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: novo.id };
  });

const permSchema = z.object({
  nivel_acesso_id: z.string().uuid(),
  permissoes: z
    .array(
      z.object({
        modulo: z.string().min(1),
        acao: z.string().min(1),
        permitido: z.boolean(),
        escopo_dados: z.enum(["todos", "equipe", "proprios"]),
      }),
    )
    .max(500),
});

/** Salva a matriz de permissões de um nível de acesso (substitui o conjunto). */
export const salvarPermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => permSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Remove as permissões antigas e regrava (RLS garante que só níveis do
    // próprio correspondente e gestor autorizado podem escrever).
    const { error: delErr } = await supabase
      .from("permissions")
      .delete()
      .eq("nivel_acesso_id", data.nivel_acesso_id);
    if (delErr) throw new Error(delErr.message);

    const rows = data.permissoes
      .filter((p) => p.permitido)
      .map((p) => ({
        nivel_acesso_id: data.nivel_acesso_id,
        modulo: p.modulo,
        acao: p.acao,
        permitido: true,
        escopo_dados: p.escopo_dados,
      }));

    if (rows.length) {
      const { error } = await supabase.from("permissions").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, total: rows.length };
  });
