import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import { consultar, isoLocal } from "@/lib/financeiro/cliente";
import type { LinhaRelatorio } from "@/lib/financeiro/tipos";
import type { ReportColumn } from "@/lib/relatorios/shared";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carregando, Erro, FiltroPeriodo, PaginaFin, Pilulas, Vazio, dataBR, moeda, pct } from "@/components/financeiro/matriz/base";
import { useCadastros } from "@/components/financeiro/matriz/comuns";
import { LinkOrigem, type Origem } from "@/components/financeiro/matriz/origem";

export const Route = createFileRoute("/_authenticated/financeiro/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios financeiros — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.painel", ["financeiro.fluxo_caixa", "financeiro.comissoes_bancos", "financeiro.comissoes"]),
  component: Pagina,
});

type Tipo = "comissoes_bancos" | "sem_previsao" | "vencidas" | "diferencas" | "comissoes_participantes" | "despesas" | "receitas" | "movimentos";

const RELATORIOS: { tipo: Tipo; rotulo: string; modulo: string; descricao: string; colunas: ReportColumn[] }[] = [
  {
    tipo: "comissoes_bancos",
    rotulo: "Comissões dos bancos",
    modulo: "financeiro.comissoes_bancos",
    descricao: "Previstas, informadas, recebidas e diferenças, por banco e proposta.",
    colunas: [
      { key: "banco", label: "Banco" },
      { key: "proposta", label: "Proposta" },
      { key: "cliente", label: "Cliente" },
      { key: "produto", label: "Produto" },
      { key: "previsto", label: "Previsto", format: "brl", align: "right", footer: "sum" },
      { key: "informado", label: "Informado", format: "brl", align: "right", footer: "sum" },
      { key: "recebido", label: "Recebido", format: "brl", align: "right", footer: "sum" },
      { key: "diferenca", label: "Diferença", format: "brl", align: "right", footer: "sum" },
      { key: "previsao_recebimento", label: "Previsão", format: "date" },
      { key: "situacao", label: "Situação" },
    ],
  },
  {
    tipo: "sem_previsao",
    rotulo: "Contrato sem previsão",
    modulo: "financeiro.comissoes_bancos",
    descricao: "Propostas com contrato emitido/registrado e nenhuma comissão do banco prevista.",
    colunas: [
      { key: "proposta", label: "Proposta" },
      { key: "cliente", label: "Cliente" },
      { key: "banco", label: "Banco" },
      { key: "produto", label: "Produto" },
      { key: "status", label: "Etapa" },
      { key: "valor_financiado", label: "Financiado", format: "brl", align: "right", footer: "sum" },
      { key: "contrato_emitido_em", label: "Contrato em", format: "date" },
    ],
  },
  {
    tipo: "vencidas",
    rotulo: "Previsões vencidas",
    modulo: "financeiro.comissoes_bancos",
    descricao: "Comissões dos bancos com a data prevista passada e nada recebido.",
    colunas: [
      { key: "banco", label: "Banco" },
      { key: "proposta", label: "Proposta" },
      { key: "cliente", label: "Cliente" },
      { key: "previsto", label: "Previsto", format: "brl", align: "right", footer: "sum" },
      { key: "informado", label: "Informado", format: "brl", align: "right" },
      { key: "previsao_recebimento", label: "Previsão", format: "date" },
    ],
  },
  {
    tipo: "diferencas",
    rotulo: "Diferenças",
    modulo: "financeiro.comissoes_bancos",
    descricao: "Previsto x informado x recebido que não batem.",
    colunas: [
      { key: "banco", label: "Banco" },
      { key: "proposta", label: "Proposta" },
      { key: "previsto", label: "Previsto", format: "brl", align: "right" },
      { key: "informado", label: "Informado", format: "brl", align: "right" },
      { key: "recebido", label: "Recebido", format: "brl", align: "right" },
      { key: "diferenca", label: "Diferença", format: "brl", align: "right", footer: "sum" },
      { key: "situacao", label: "Situação" },
    ],
  },
  {
    tipo: "comissoes_participantes",
    rotulo: "Corretores e parceiros",
    modulo: "financeiro.comissoes",
    descricao: "Comissões previstas e pagas por pessoa, papel e proposta.",
    colunas: [
      { key: "pessoa", label: "Pessoa" },
      { key: "papel", label: "Papel" },
      { key: "proposta", label: "Proposta" },
      { key: "banco", label: "Banco" },
      { key: "base", label: "Base", format: "brl", align: "right" },
      { key: "percentual", label: "%", format: "pct", align: "right" },
      { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
      { key: "pago", label: "Pago", format: "brl", align: "right", footer: "sum" },
      { key: "saldo", label: "Saldo", format: "brl", align: "right", footer: "sum" },
      { key: "situacao", label: "Situação" },
    ],
  },
  {
    tipo: "despesas",
    rotulo: "Despesas",
    modulo: "financeiro.contas_pagar",
    descricao: "Abertas, vencidas, pagas e recorrentes, por fornecedor e categoria.",
    colunas: [
      { key: "numero", label: "Nº" },
      { key: "descricao", label: "Descrição" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "categoria", label: "Categoria" },
      { key: "centro_custo", label: "Centro de custo" },
      { key: "vencimento", label: "Vencimento", format: "date" },
      { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
      { key: "pago", label: "Pago", format: "brl", align: "right", footer: "sum" },
      { key: "status", label: "Situação" },
    ],
  },
  {
    tipo: "receitas",
    rotulo: "Outras receitas",
    modulo: "financeiro.contas_receber",
    descricao: "Receitas avulsas do correspondente.",
    colunas: [
      { key: "numero", label: "Nº" },
      { key: "descricao", label: "Descrição" },
      { key: "pagador", label: "Pagador" },
      { key: "categoria", label: "Categoria" },
      { key: "vencimento", label: "Vencimento", format: "date" },
      { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
      { key: "recebido", label: "Recebido", format: "brl", align: "right", footer: "sum" },
      { key: "status", label: "Situação" },
    ],
  },
  {
    tipo: "movimentos",
    rotulo: "Movimentos realizados",
    modulo: "financeiro.fluxo_caixa",
    descricao: "Cada recebimento e pagamento do livro, com a natureza e a conciliação.",
    colunas: [
      { key: "data", label: "Data", format: "date" },
      { key: "natureza", label: "Natureza" },
      { key: "descricao", label: "Descrição" },
      { key: "sentido", label: "Sentido" },
      { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
      { key: "conta", label: "Conta" },
      { key: "conciliada", label: "Conciliada" },
    ],
  },
];

function formatar(c: ReportColumn, v: unknown): string {
  if (v == null || v === "") return "—";
  if (c.format === "brl") return moeda(Number(v));
  if (c.format === "pct") return pct(Number(v), 4);
  if (c.format === "date") return dataBR(String(v));
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v).replace(/_/g, " ");
}

function Pagina() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)),
    ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  });
  // A mesma matriz do menu (cache ["minhas-permissoes"]); o banco confere de novo em cada relatório.
  const perms = useQuery({ queryKey: ["minhas-permissoes"], queryFn: () => getMinhasPermissoes(), staleTime: 5 * 60_000 });
  const permitidos = RELATORIOS.filter((r) => perms.data?.todas || perms.data?.chaves.includes(`${r.modulo}:view`));
  const [tipo, setTipo] = useState<Tipo>("comissoes_bancos");
  const atual = permitidos.find((r) => r.tipo === tipo) ?? permitidos[0];
  const [banco, setBanco] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [categoria, setCategoria] = useState("");
  const cad = useCadastros();
  const q = useQuery({
    queryKey: ["financeiro", "relatorio", atual?.tipo, periodo, banco, pessoa, fornecedor, categoria],
    enabled: !!atual,
    queryFn: () =>
      consultar<LinhaRelatorio[]>("relatorio", {
        _tipo: atual!.tipo,
        _de: periodo.de,
        _ate: periodo.ate,
        _f: { banco: banco || null, pessoa_id: pessoa || null, fornecedor_id: fornecedor || null, categoria_id: categoria || null },
      }),
  });
  const linhas = q.data ?? [];
  const exportar = useMemo(
    () =>
      linhas.map((l) => {
        const o: Record<string, string | number | null> = {};
        for (const c of atual?.colunas ?? []) {
          const v = l[c.key];
          o[c.key] = c.format === "brl" || c.format === "pct" ? Number(v ?? 0) : v == null ? "" : typeof v === "boolean" ? (v ? "sim" : "não") : String(v);
        }
        return o;
      }),
    [linhas, atual],
  );

  return (
    <PaginaFin
      titulo="Relatórios financeiros"
      descricao="Cada relatório por natureza, com filtros por período, banco, pessoa, fornecedor e categoria — e o caminho de cada linha até o lançamento de origem."
      icone={FileBarChart2}
      acoes={
        atual && (
          <ExportarFinanceiro
            titulo={atual.rotulo}
            descricao={`${atual.descricao} De ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}.`}
            columns={atual.colunas}
            rows={exportar}
            size="sm"
            orientation="landscape"
          />
        )
      }
    >
      {!atual ? (
        <Vazio titulo="Sem relatórios liberados para o seu perfil" />
      ) : (
        <>
          <Pilulas valor={atual.tipo} onChange={setTipo} opcoes={permitidos.map((r) => ({ valor: r.tipo, rotulo: r.rotulo }))} />
          <div data-tour="financeiro-relatorios-filtros" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
            <div className="flex flex-wrap gap-2">
              {["comissoes_bancos", "vencidas", "diferencas", "sem_previsao", "comissoes_participantes"].includes(atual.tipo) && (
                <Select value={banco || "_"} onValueChange={(v) => setBanco(v === "_" ? "" : v)}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue placeholder="Banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Todos os bancos</SelectItem>
                    {(cad.data?.bancos ?? []).map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {atual.tipo === "comissoes_participantes" && (
                <Select value={pessoa || "_"} onValueChange={(v) => setPessoa(v === "_" ? "" : v)}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Todas as pessoas</SelectItem>
                    {(cad.data?.pessoas ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {atual.tipo === "despesas" && (
                <Select value={fornecedor || "_"} onValueChange={(v) => setFornecedor(v === "_" ? "" : v)}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Todos os fornecedores</SelectItem>
                    {(cad.data?.fornecedores ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(atual.tipo === "despesas" || atual.tipo === "receitas") && (
                <Select value={categoria || "_"} onValueChange={(v) => setCategoria(v === "_" ? "" : v)}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Todas as categorias</SelectItem>
                    {(cad.data?.categorias ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{atual.descricao}</p>
          {q.isLoading ? (
            <Carregando />
          ) : q.error ? (
            <Erro erro={q.error} onTentar={() => q.refetch()} />
          ) : linhas.length === 0 ? (
            <Vazio titulo="Nada neste relatório para o período e filtros" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {atual.colunas.map((c) => (
                      <th key={c.key} className={`px-3 py-2.5 text-left font-medium ${c.align === "right" ? "text-right" : ""}`}>
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {linhas.map((l, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      {atual.colunas.map((c) => (
                        <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right font-mono tabular-nums" : ""}`}>
                          {formatar(c, l[c.key])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <LinkOrigem origem={l.origem as Origem} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </PaginaFin>
  );
}
