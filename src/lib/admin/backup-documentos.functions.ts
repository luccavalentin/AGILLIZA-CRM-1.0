import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ItemBackupDoc {
  pasta: string;
  nomeArquivo: string;
  url: string;
}

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

function sanitize(s: string | null | undefined, fallback = "sem-nome"): string {
  const base = (s ?? "").toString().trim() || fallback;
  return base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 120);
}

/** Extrai um nome de arquivo legível de um storage_path. */
function nomeDoPath(path: string, preferido?: string | null): string {
  if (preferido && preferido.trim()) return sanitize(preferido);
  const partes = path.split("/");
  return sanitize(partes[partes.length - 1] || path);
}

type Bruto = { bucket: string; path: string; pasta: string; nome: string };

/** Monta o inventário de todos os documentos do sistema com links assinados, organizados por pasta. */
export const montarInventarioDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ itens: ItemBackupDoc[]; falhas: number }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return { itens: [], falhas: 0 };

    const brutos: Bruto[] = [];

    // 1. Documentos de clientes
    {
      const { data } = await supabase
        .from("cliente_documentos")
        .select("storage_path, nome_arquivo, clientes!inner(nome, correspondente_id)")
        .eq("clientes.correspondente_id", corr)
        .limit(5000);
      for (const d of (data ?? []) as any[]) {
        if (!d.storage_path) continue;
        brutos.push({
          bucket: "cliente-documentos",
          path: d.storage_path,
          pasta: `Clientes/${sanitize(d.clientes?.nome, "cliente")}`,
          nome: nomeDoPath(d.storage_path, d.nome_arquivo),
        });
      }
    }

    // 2. Documentos de propostas
    {
      const { data } = await supabase
        .from("proposta_documentos")
        .select("storage_path, nome_documento, propostas!inner(numero_proposta, correspondente_id)")
        .eq("propostas.correspondente_id", corr)
        .limit(5000);
      for (const d of (data ?? []) as any[]) {
        if (!d.storage_path) continue;
        brutos.push({
          bucket: "documentos-proposta",
          path: d.storage_path,
          pasta: `Propostas/${sanitize(d.propostas?.numero_proposta, "proposta")}`,
          nome: nomeDoPath(d.storage_path, d.nome_documento),
        });
      }
    }

    // 3. Anexos de tarefas
    {
      const { data } = await supabase
        .from("task_attachments")
        .select("storage_path, nome, tasks!inner(numero, correspondente_id)")
        .eq("tasks.correspondente_id", corr)
        .limit(5000);
      for (const d of (data ?? []) as any[]) {
        if (!d.storage_path) continue;
        brutos.push({
          bucket: "tarefa-anexos",
          path: d.storage_path,
          pasta: `Tarefas/${sanitize(d.tasks?.numero, "tarefa")}`,
          nome: nomeDoPath(d.storage_path, d.nome),
        });
      }
    }

    // 4. Anexos de demandas
    {
      const { data } = await supabase
        .from("demanda_anexos")
        .select("storage_path, nome, demandas!inner(numero, correspondente_id)")
        .eq("demandas.correspondente_id", corr)
        .limit(5000);
      for (const d of (data ?? []) as any[]) {
        if (!d.storage_path) continue;
        brutos.push({
          bucket: "demanda-anexos",
          path: d.storage_path,
          pasta: `Demandas/${sanitize(d.demandas?.numero, "demanda")}`,
          nome: nomeDoPath(d.storage_path, d.nome),
        });
      }
    }

    // 5. Comprovantes financeiros (contas a pagar/receber)
    {
      const { data: pag } = await supabase
        .from("financial_payables")
        .select("comprovante_path, numero")
        .eq("correspondente_id", corr)
        .not("comprovante_path", "is", null)
        .limit(5000);
      for (const d of (pag ?? []) as any[]) {
        if (!d.comprovante_path) continue;
        brutos.push({
          bucket: "financeiro-comprovantes",
          path: d.comprovante_path,
          pasta: "Financeiro/Contas a Pagar",
          nome: nomeDoPath(d.comprovante_path, d.numero ? `${d.numero}` : null),
        });
      }
      const { data: rec } = await supabase
        .from("financial_receivables")
        .select("comprovante_path, numero")
        .eq("correspondente_id", corr)
        .not("comprovante_path", "is", null)
        .limit(5000);
      for (const d of (rec ?? []) as any[]) {
        if (!d.comprovante_path) continue;
        brutos.push({
          bucket: "financeiro-comprovantes",
          path: d.comprovante_path,
          pasta: "Financeiro/Contas a Receber",
          nome: nomeDoPath(d.comprovante_path, d.numero ? `${d.numero}` : null),
        });
      }
    }

    // 6. Formulários bancários (referências compartilhadas)
    {
      const { data } = await supabase
        .from("formularios_bancarios")
        .select("storage_path, nome, banco")
        .not("storage_path", "is", null)
        .limit(5000);
      for (const d of (data ?? []) as any[]) {
        if (!d.storage_path) continue;
        brutos.push({
          bucket: "formularios-bancarios",
          path: d.storage_path,
          pasta: `Formulários/${sanitize(d.banco, "diversos")}`,
          nome: nomeDoPath(d.storage_path, d.nome),
        });
      }
    }

    // 7. Módulo Arquivos (árvore de pastas)
    {
      const { data } = await supabase
        .from("arquivos_nos")
        .select("id, parent_id, tipo, nome, storage_path")
        .eq("correspondente_id", corr)
        .limit(10000);
      const nos = (data ?? []) as {
        id: string;
        parent_id: string | null;
        tipo: string;
        nome: string;
        storage_path: string | null;
      }[];
      const mapa = new Map(nos.map((n) => [n.id, n]));
      const caminho = (id: string | null): string => {
        const partes: string[] = [];
        let atual = id;
        for (let i = 0; i < 50 && atual; i++) {
          const n = mapa.get(atual);
          if (!n) break;
          partes.unshift(sanitize(n.nome, "pasta"));
          atual = n.parent_id;
        }
        return partes.join("/");
      };
      for (const n of nos) {
        if (n.tipo !== "arquivo" || !n.storage_path) continue;
        const sub = caminho(n.parent_id);
        brutos.push({
          bucket: "arquivos",
          path: n.storage_path,
          pasta: sub ? `Arquivos/${sub}` : "Arquivos",
          nome: sanitize(n.nome),
        });
      }
    }

    // Gera links assinados em lote por bucket.
    const porBucket = new Map<string, Bruto[]>();
    for (const b of brutos) {
      const arr = porBucket.get(b.bucket) ?? [];
      arr.push(b);
      porBucket.set(b.bucket, arr);
    }

    const itens: ItemBackupDoc[] = [];
    let falhas = 0;
    const usados = new Set<string>();

    for (const [bucket, lista] of porBucket) {
      for (let i = 0; i < lista.length; i += 100) {
        const chunk = lista.slice(i, i + 100);
        const { data: signed, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(
            chunk.map((c) => c.path),
            3600,
          );
        if (error || !signed) {
          falhas += chunk.length;
          continue;
        }
        signed.forEach((s: any, idx: number) => {
          const c = chunk[idx];
          if (!s?.signedUrl) {
            falhas += 1;
            return;
          }
          // Evita colisão de nome dentro da mesma pasta.
          let nome = c.nome;
          let chave = `${c.pasta}/${nome}`;
          if (usados.has(chave)) {
            const ponto = nome.lastIndexOf(".");
            const base = ponto > 0 ? nome.slice(0, ponto) : nome;
            const ext = ponto > 0 ? nome.slice(ponto) : "";
            let n = 2;
            while (usados.has(`${c.pasta}/${base} (${n})${ext}`)) n++;
            nome = `${base} (${n})${ext}`;
            chave = `${c.pasta}/${nome}`;
          }
          usados.add(chave);
          itens.push({ pasta: c.pasta, nomeArquivo: nome, url: s.signedUrl });
        });
      }
    }

    return { itens, falhas };
  });
