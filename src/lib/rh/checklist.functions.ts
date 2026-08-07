import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Itens obrigatórios da admissão CLT + itens condicionais. */
export const CHECKLIST_CLT: Array<{ tipo: string; rotulo: string; obrigatorio: boolean }> = [
  { tipo: "rg", rotulo: "RG (frente e verso)", obrigatorio: true },
  { tipo: "cpf", rotulo: "CPF", obrigatorio: true },
  { tipo: "comprovante_residencia", rotulo: "Comprovante de residência (últimos 90 dias)", obrigatorio: true },
  { tipo: "ctps", rotulo: "CTPS (Carteira de Trabalho)", obrigatorio: true },
  { tipo: "titulo_eleitor", rotulo: "Título de eleitor", obrigatorio: true },
  { tipo: "pis_nis", rotulo: "PIS / PASEP / NIS", obrigatorio: true },
  { tipo: "certidao_nascimento_casamento", rotulo: "Certidão de nascimento ou casamento", obrigatorio: true },
  { tipo: "aso_admissional", rotulo: "ASO admissional (exame médico)", obrigatorio: true },
  { tipo: "foto_3x4", rotulo: "Foto 3x4", obrigatorio: true },
  { tipo: "dados_bancarios", rotulo: "Dados bancários / comprovante de conta", obrigatorio: true },
  { tipo: "reservista", rotulo: "Reservista (homens até 45 anos)", obrigatorio: false },
  { tipo: "cnh", rotulo: "CNH (se aplicável ao cargo)", obrigatorio: false },
  { tipo: "escolaridade", rotulo: "Comprovante de escolaridade", obrigatorio: false },
  { tipo: "certidao_filhos", rotulo: "Certidão de nascimento dos filhos", obrigatorio: false },
  { tipo: "cartao_vacinacao_filhos", rotulo: "Cartão de vacinação (filhos até 7 anos)", obrigatorio: false },
  { tipo: "declaracao_dependentes_ir", rotulo: "Declaração de dependentes de IR", obrigatorio: false },
  { tipo: "contrato_experiencia", rotulo: "Contrato de experiência assinado", obrigatorio: true },
  { tipo: "vale_transporte", rotulo: "Declaração de opção de vale-transporte", obrigatorio: false },
];

export interface ItemChecklist {
  id: string | null;
  tipo: string;
  rotulo: string;
  obrigatorio: boolean;
  status: "pendente" | "recebido" | "aprovado" | "vencido" | "dispensado";
  documento_id: string | null;
  validade: string | null;
  observacoes: string | null;
}

/** Lista o checklist CLT, criando itens padrão se ainda não existirem. */
export const listarChecklistCLT = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ funcionario_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ItemChecklist[]> => {
    const { supabase } = context;

    const { data: existentes } = await supabase
      .from("rh_documentos_checklist")
      .select("*")
      .eq("funcionario_id", data.funcionario_id);

    const porTipo = new Map<string, any>();
    (existentes ?? []).forEach((r: any) => porTipo.set(r.tipo, r));

    return CHECKLIST_CLT.map((c) => {
      const r = porTipo.get(c.tipo);
      return {
        id: r?.id ?? null,
        tipo: c.tipo,
        rotulo: r?.rotulo ?? c.rotulo,
        obrigatorio: r?.obrigatorio ?? c.obrigatorio,
        status: (r?.status ?? "pendente") as ItemChecklist["status"],
        documento_id: r?.documento_id ?? null,
        validade: r?.validade ?? null,
        observacoes: r?.observacoes ?? null,
      };
    });
  });

export const atualizarItemChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        tipo: z.string().min(1),
        status: z.enum(["pendente", "recebido", "aprovado", "vencido", "dispensado"]),
        observacoes: z.string().optional().nullable(),
        validade: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const corr = prof?.correspondente_id;
    if (!corr) throw new Error("Ecossistema não identificado.");

    const base = CHECKLIST_CLT.find((c) => c.tipo === data.tipo);
    const payload = {
      correspondente_id: corr,
      funcionario_id: data.funcionario_id,
      tipo: data.tipo,
      rotulo: base?.rotulo ?? data.tipo,
      obrigatorio: base?.obrigatorio ?? false,
      status: data.status,
      observacoes: data.observacoes ?? null,
      validade: data.validade || null,
    };

    const { data: existente } = await supabase
      .from("rh_documentos_checklist")
      .select("id")
      .eq("funcionario_id", data.funcionario_id)
      .eq("tipo", data.tipo)
      .maybeSingle();

    if (existente?.id) {
      const { error } = await supabase
        .from("rh_documentos_checklist")
        .update(payload)
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("rh_documentos_checklist")
        .insert(payload as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
