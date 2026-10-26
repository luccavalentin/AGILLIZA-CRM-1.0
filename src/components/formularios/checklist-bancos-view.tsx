/**
 * Checklist de documentos por banco (antes "Exigidos pelo banco") — pedido do dono de
 * 26/10/2026 (C44): "MELHORE O DESIGNER, ESTÃO ENORMES". Seletor de banco compacto com a logo
 * oficial, lista densa em duas colunas, títulos de seção (itens terminados em ":") como
 * cabeçalho, e as mesmas ações de antes: marcar o que vai, editar, incluir, obrigatório ou
 * opcional, compartilhar e baixar o PDF. As mudanças valem só para este envio.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, CheckCheck, Download, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CHECKLISTS_BANCOS } from "@/lib/formularios/checklists.functions";
import { BancoLogo, BancoMarca } from "@/components/bancos/banco-logo";
import { EncaminharChecklistDialog } from "./encaminhar-checklist-dialog";

interface Item {
  nome: string;
  obrigatorio: boolean;
}

const BANCOS: { id: string; nome: string }[] = [
  { id: "itau", nome: "Itaú" },
  { id: "bradesco", nome: "Bradesco" },
  { id: "santander", nome: "Santander" },
  { id: "inter", nome: "Banco Inter" },
  { id: "caixa", nome: "Caixa" },
].filter((b) => !!CHECKLISTS_BANCOS[b.id]);

/** "IMOVEL:", "REPRESENTANTES:" — título de seção dentro da lista do banco. */
const ehSecao = (nome: string) => nome.trim().endsWith(":");

function listaInicial(id: string): Item[] {
  return (CHECKLISTS_BANCOS[id]?.docs ?? []).map((d) => ({ nome: d, obrigatorio: true }));
}

export function ChecklistBancosView() {
  const search = useSearch({ from: "/_authenticated/formularios/$banco" });
  const navigate = useNavigate({ from: "/formularios/$banco" });
  const banco = search.banco && CHECKLISTS_BANCOS[search.banco] ? search.banco : (BANCOS[0]?.id ?? "itau");
  const nomeBanco = BANCOS.find((b) => b.id === banco)?.nome ?? banco;

  // Por banco: a lista (editável só nesta tela) e o que está marcado para ir.
  const [listas, setListas] = useState<Record<string, Item[]>>({});
  const [marcados, setMarcados] = useState<Record<string, string[]>>({});
  const [editando, setEditando] = useState<number | null>(null);
  const [valor, setValor] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);

  useEffect(() => {
    if (listas[banco]) return;
    const l = listaInicial(banco);
    setListas((p) => ({ ...p, [banco]: l }));
    setMarcados((p) => ({ ...p, [banco]: l.map((i) => i.nome) }));
  }, [banco, listas]);

  useEffect(() => setEditando(null), [banco]);

  const itens = listas[banco] ?? [];
  const sel = marcados[banco] ?? [];
  const documentos = itens.filter((i) => !ehSecao(i.nome));
  const totalMarcados = documentos.filter((i) => sel.includes(i.nome)).length;

  const trocarBanco = (id: string) => void navigate({ search: { banco: id }, replace: true });

  const alternar = (nome: string) =>
    setMarcados((p) => {
      const atual = p[banco] ?? [];
      return { ...p, [banco]: atual.includes(nome) ? atual.filter((n) => n !== nome) : [...atual, nome] };
    });

  const marcarTodos = (todos: boolean) =>
    setMarcados((p) => ({
      ...p,
      [banco]: todos ? itens.map((i) => i.nome) : itens.filter((i) => ehSecao(i.nome)).map((i) => i.nome),
    }));

  const atualizarItens = (fn: (l: Item[]) => Item[]) => setListas((p) => ({ ...p, [banco]: fn(p[banco] ?? []) }));

  function salvarEdicao(idx: number) {
    const novo = valor.trim();
    if (!novo) return setEditando(null);
    const antigo = itens[idx]?.nome;
    atualizarItens((l) => l.map((i, j) => (j === idx ? { ...i, nome: novo } : i)));
    // Continua marcado com o nome novo.
    setMarcados((p) => ({ ...p, [banco]: (p[banco] ?? []).map((n) => (n === antigo ? novo : n)) }));
    setEditando(null);
  }

  function adicionar() {
    const nome = "Novo documento";
    atualizarItens((l) => [...l, { nome, obrigatorio: true }]);
    setMarcados((p) => ({ ...p, [banco]: [...(p[banco] ?? []), nome] }));
    setEditando(itens.length);
    setValor(nome);
  }

  // O PDF leva os títulos de seção e os documentos marcados, na ordem da lista.
  const paraEnvio = useMemo(
    () => itens.filter((i) => ehSecao(i.nome) || sel.includes(i.nome)),
    [itens, sel],
  );

  async function baixar() {
    if (!documentos.some((i) => sel.includes(i.nome))) {
      toast.error("Marque pelo menos um documento.");
      return;
    }
    try {
      const { gerarChecklistBancoPDF } = await import("@/lib/formularios/checklist-pdf");
      await gerarChecklistBancoPDF(banco, undefined, paraEnvio);
      toast.success("PDF do checklist gerado.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF.");
    }
  }

  async function confirmarCompartilhar(dados: { email: string; whatsapp: string; canal: "email" | "whatsapp" | "pdf" }) {
    if (dados.canal === "pdf") return baixar();
    const texto = paraEnvio.map((i) => (ehSecao(i.nome) ? `\n${i.nome}` : `• ${i.nome}`)).join("\n");
    if (dados.canal === "whatsapp") {
      const msg = encodeURIComponent(
        `Olá! Segue o checklist de documentos para financiamento no banco ${nomeBanco}:\n${texto}\n\nAtenciosamente, Agilliza.`,
      );
      window.open(`https://api.whatsapp.com/send?phone=55${dados.whatsapp}&text=${msg}`, "_blank");
      toast.success("Abrindo o WhatsApp…");
    } else {
      const assunto = encodeURIComponent(`Checklist de documentos - ${nomeBanco}`);
      const corpo = encodeURIComponent(
        `Olá,\n\nSegue a relação de documentos necessários para o banco ${nomeBanco}:\n${texto}\n\nAtenciosamente,\nEquipe Agilliza`,
      );
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${dados.email}&su=${assunto}&body=${corpo}`, "_blank");
      toast.success("Abrindo o Gmail…");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Checklist de documentos por banco</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o banco, marque o que vai e envie ao cliente. As mudanças valem só para este envio.
        </p>
      </header>

      {/* Seletor de banco: compacto, com a logo oficial */}
      <div
        role="tablist"
        aria-label="Banco"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {BANCOS.map((b) => {
          const ativo = b.id === banco;
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => trocarBanco(b.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                ativo
                  ? "border-primary bg-primary/5 text-foreground shadow-sm ring-1 ring-primary/30"
                  : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <BancoLogo nome={b.nome} size="md" />
              {b.nome}
            </button>
          );
        })}
      </div>

      <section data-tour="checklist-bancos-lista" className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BancoMarca nome={nomeBanco} altura={22} />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{totalMarcados}</span> de {documentos.length} documentos
            </p>
          </div>
          <div data-tour="checklist-bancos-acoes" className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" className="h-8" onClick={() => marcarTodos(totalMarcados < documentos.length)}>
              <CheckCheck className="mr-1.5 h-4 w-4" />
              {totalMarcados < documentos.length ? "Marcar todos" : "Desmarcar todos"}
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={adicionar}>
              <Plus className="mr-1.5 h-4 w-4" /> Item
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setCompartilhar(true)}>
              <Share2 className="mr-1.5 h-4 w-4" /> Compartilhar
            </Button>
            <Button size="sm" className="h-8" onClick={baixar}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </div>

        {itens.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum documento neste checklist. Use “Item” para incluir.
          </p>
        ) : (
          <ul className="grid gap-x-6 px-2 py-2 sm:px-3 lg:grid-cols-2">
            {itens.map((item, idx) => {
              if (ehSecao(item.nome) && editando !== idx) {
                return (
                  <li
                    key={`${idx}-${item.nome}`}
                    className="col-span-full mt-2 border-b border-border/60 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-primary first:mt-0"
                  >
                    {item.nome.replace(/:\s*$/, "")}
                  </li>
                );
              }
              const marcado = sel.includes(item.nome);
              return (
                <li
                  key={`${idx}-${item.nome}`}
                  className={cn(
                    "group flex min-h-9 items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/50",
                    !marcado && "opacity-60",
                  )}
                >
                  {editando === idx ? (
                    <div className="flex flex-1 items-center gap-1">
                      <Input
                        value={valor}
                        autoFocus
                        maxLength={200}
                        onChange={(e) => setValor(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") salvarEdicao(idx);
                          if (e.key === "Escape") setEditando(null);
                        }}
                        className="h-8 text-sm"
                        aria-label="Nome do documento"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Salvar" onClick={() => salvarEdicao(idx)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancelar" onClick={() => setEditando(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={marcado}
                        onClick={() => alternar(item.nome)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            marcado ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                          )}
                        >
                          {marcado && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 text-[13px] leading-snug text-foreground">{item.nome}</span>
                      </button>
                      <button
                        type="button"
                        title="Alternar obrigatório/opcional"
                        onClick={() =>
                          atualizarItens((l) => l.map((i, j) => (j === idx ? { ...i, obrigatorio: !i.obrigatorio } : i)))
                        }
                        className={cn(
                          "shrink-0 rounded-full px-2 py-px text-[10px] font-semibold transition-colors",
                          item.obrigatorio ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.obrigatorio ? "Obrigatório" : "Opcional"}
                      </button>
                      <span className="flex shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          aria-label="Editar documento"
                          onClick={() => {
                            setEditando(idx);
                            setValor(item.nome);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Remover documento"
                          onClick={() => atualizarItens((l) => l.filter((_, j) => j !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EncaminharChecklistDialog
        aberto={compartilhar}
        onOpenChange={setCompartilhar}
        onConfirm={confirmarCompartilhar}
        bancoNome={nomeBanco}
      />
    </div>
  );
}
