import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { consultar, isoLocal } from "@/lib/financeiro/cliente";
import type { ItemAuditoria } from "@/lib/financeiro/tipos";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carregando, Erro, FiltroPeriodo, PaginaFin, Vazio, moeda } from "@/components/financeiro/matriz/base";

export const Route = createFileRoute("/_authenticated/financeiro/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria do financeiro — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.auditoria"),
  component: Pagina,
});

const ENTIDADES: Record<string, string> = {
  comissoes: "Comissões dos bancos",
  comissao_regras: "Regras dos bancos",
  comissoes_usuario: "Corretores e parceiros",
  comissao_regras_usuario: "Regras de corretores e parceiros",
  financial_payables: "Contas a pagar",
  financial_receivables: "Contas a receber",
  fin_baixas: "Recebimentos e pagamentos",
  fin_anexos: "Anexos",
  fin_extratos: "Extratos",
  fin_extrato_linhas: "Movimentações do extrato",
  fin_conciliacoes: "Conciliações",
  fin_sugestoes_rejeitadas: "Sugestões rejeitadas",
  fin_contas_bancarias: "Contas bancárias",
  fin_fornecedores: "Fornecedores",
  fin_parametros: "Parâmetros",
  fin_proposta_participantes: "Participantes das propostas",
  financial_categories: "Categorias",
  financial_cost_centers: "Centros de custo",
  financial_payment_methods: "Formas de pagamento",
  propostas: "Propostas (gatilho)",
};

const ACOES: Record<string, string> = {
  insert: "Criado",
  update: "Alterado",
  delete: "Excluído",
  previsao_gerada: "Previsão gerada",
  lancamento_manual: "Lançamento manual",
  valor_informado: "Valor informado pelo banco",
  previsao_corrigida: "Previsão corrigida",
  contestada: "Contestação",
  contestacao_resolvida: "Contestação resolvida",
  cancelada: "Cancelamento",
  encerrada_com_diferenca: "Encerrado com diferença",
  recebimento_registrado: "Recebimento",
  pagamento_registrado: "Pagamento",
  estornada: "Estorno",
  aprovada_para_pagamento: "Aprovação para pagamento",
  ajustada: "Ajuste",
  base_confirmada: "Base confirmada",
  criada: "Criação",
  editada: "Edição",
  rascunho_conferido: "Rascunho conferido",
  rascunho_descartado: "Rascunho descartado",
  conciliada: "Conciliação",
  conciliacao_desfeita: "Conciliação desfeita",
  sugestao_rejeitada: "Sugestão rejeitada",
  linha_ignorada: "Movimentação deixada de fora",
  linha_reaberta: "Movimentação reaberta",
  extrato_importado: "Extrato importado",
  regra_criada: "Regra criada",
  regra_alterada: "Regra alterada",
  regra_encerrada: "Regra encerrada",
  participantes_definidos: "Participantes definidos",
  cadastro_criado: "Cadastro criado",
  cadastro_alterado: "Cadastro alterado",
  parametros_alterados: "Parâmetros alterados",
  anexo_enviado: "Anexo enviado",
  falha_gatilho_financeiro: "Falha no gatilho (não travou a proposta)",
};

function resumo(o: Record<string, unknown> | null): string {
  if (!o) return "";
  return Object.entries(o)
    .filter(([k]) => !["id", "correspondente_id", "created_at", "updated_at", "origem_calculo", "regra_snapshot"].includes(k))
    .slice(0, 6)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" && /valor|pago|recebido|bruto|informado/.test(k) ? moeda(v) : String(v ?? "—").slice(0, 60)}`)
    .join(" · ");
}

function Pagina() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({ de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 30)), ate: isoLocal(hoje) });
  const [entidade, setEntidade] = useState("");
  const [acao, setAcao] = useState("");
  const q = useQuery({
    queryKey: ["financeiro", "auditoria", periodo, entidade, acao],
    queryFn: () => consultar<ItemAuditoria[]>("auditoria", { _f: { de: periodo.de, ate: periodo.ate, entidade: entidade || null, acao: acao || null } }),
  });
  const itens = q.data ?? [];
  return (
    <PaginaFin
      titulo="Auditoria do financeiro"
      descricao="Quem criou, editou, aprovou, recebeu, pagou, conciliou, ajustou ou cancelou — com valores antes/depois e o motivo. A trilha não pode ser alterada por ninguém."
      icone={History}
      acoes={
        <ExportarFinanceiro
          titulo="Auditoria do financeiro"
          descricao={`Últimos registros (até 400) de ${periodo.de} a ${periodo.ate}`}
          columns={[
            { key: "quando", label: "Quando" },
            { key: "quem", label: "Quem" },
            { key: "entidade", label: "Onde" },
            { key: "acao", label: "Ação" },
            { key: "motivo", label: "Motivo" },
            { key: "antes", label: "Antes" },
            { key: "depois", label: "Depois" },
          ]}
          rows={itens.map((i) => ({
            quando: new Date(i.quando).toLocaleString("pt-BR"),
            quem: i.quem ?? "Sistema",
            entidade: ENTIDADES[i.entidade] ?? i.entidade,
            acao: ACOES[i.acao] ?? i.acao,
            motivo: i.motivo ?? "",
            antes: resumo(i.antes),
            depois: resumo(i.depois),
          }))}
          size="sm"
          variant="outline"
          orientation="landscape"
        />
      }
    >
      <div data-tour="financeiro-auditoria-filtros" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <div className="flex flex-wrap gap-2">
          <Select value={entidade || "_"} onValueChange={(v) => setEntidade(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Onde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Tudo</SelectItem>
              {Object.entries(ENTIDADES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={acao || "_"} onValueChange={(v) => setAcao(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todas as ações</SelectItem>
              {Object.entries(ACOES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : itens.length === 0 ? (
        <Vazio titulo="Nenhum registro no período" icone={History} />
      ) : (
        <ol data-tour="financeiro-auditoria-trilha" className="space-y-2">
          {itens.map((i) => (
            <li key={i.id} className="rounded-2xl border border-border/70 bg-card p-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {ACOES[i.acao] ?? i.acao} <span className="font-normal text-muted-foreground">· {ENTIDADES[i.entidade] ?? i.entidade}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(i.quando).toLocaleString("pt-BR")} · {i.quem ?? "Sistema"}
                </p>
              </div>
              {i.motivo && <p className="mt-1 text-xs italic">“{i.motivo}”</p>}
              {(i.antes || i.depois) && (
                <div className="mt-1.5 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                  {i.antes && (
                    <p className="break-words">
                      <b>Antes:</b> {resumo(i.antes)}
                    </p>
                  )}
                  {i.depois && (
                    <p className="break-words">
                      <b>Depois:</b> {resumo(i.depois)}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </PaginaFin>
  );
}
