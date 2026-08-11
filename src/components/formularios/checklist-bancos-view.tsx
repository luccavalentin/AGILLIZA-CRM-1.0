import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ListChecks,
  Download,
  Share2,
  Mail,
  MessageCircle,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { CHECKLISTS_BANCOS } from "@/lib/formularios/checklists.functions";
import { resolveBancoBrand } from "@/lib/relatorios/banco-brand";
import { gerarChecklistBancoPDF } from "@/lib/formularios/checklist-pdf";
import { EncaminharChecklistDialog } from "./encaminhar-checklist-dialog";
import { toast } from "sonner";

export function ChecklistBancosView() {
  const search = useSearch({ from: "/_authenticated/formularios/$banco" });
  const [bancoSelecionado, setBancoSelecionado] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [bancoParaCompartilhar, setBancoParaCompartilhar] = useState<{
    id: string;
    nome: string;
  } | null>(null);

  // Estado para gerenciar itens de checklist por banco (iniciado com os dados fixos)
  const [checklists, setChecklists] = useState<
    Record<string, { nome: string; obrigatorio: boolean }[]>
  >({});
  const [selecionados, setSelecionados] = useState<Record<string, string[]>>({});
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [novoValor, setNovoValor] = useState("");

  useEffect(() => {
    // Inicializar checklists e selecionados a partir da config se ainda não estiverem no estado
    const initial: Record<string, { nome: string; obrigatorio: boolean }[]> = {};
    const initialSelected: Record<string, string[]> = {};
    Object.keys(CHECKLISTS_BANCOS).forEach((key) => {
      initial[key] = CHECKLISTS_BANCOS[key].docs.map((doc) => ({ nome: doc, obrigatorio: true }));
      initialSelected[key] = [...CHECKLISTS_BANCOS[key].docs];
    });
    setChecklists(initial);
    setSelecionados(initialSelected);
  }, []);

  useEffect(() => {
    if (search.banco && CHECKLISTS_BANCOS[search.banco]) {
      setBancoSelecionado(search.banco);
    }
  }, [search.banco]);

  const bancos = [
    { id: "itau", nome: "Itaú" },
    { id: "caixa", nome: "Caixa Econômica" },
    { id: "inter", nome: "Inter" },
    { id: "bradesco", nome: "Bradesco" },
    { id: "santander", nome: "Santander" },
  ];

  const handleDownload = async (bancoId: string) => {
    try {
      // Filtrar apenas os itens selecionados (que agora são objetos)
      const todosItems = checklists[bancoId] || [];
      const nomesSelecionados = selecionados[bancoId] || [];
      const itemsParaPdf = todosItems.filter((item) => nomesSelecionados.includes(item.nome));

      await gerarChecklistBancoPDF(bancoId, undefined, itemsParaPdf);
      toast.success("Checklist gerado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar checklist.");
    }
  };

  const handleShare = (bancoId: string, bancoNome: string) => {
    setBancoParaCompartilhar({ id: bancoId, nome: bancoNome });
    setShareDialogOpen(true);
  };

  const onConfirmShare = async (dados: {
    email: string;
    whatsapp: string;
    canal: "email" | "whatsapp" | "pdf";
  }) => {
    if (!bancoParaCompartilhar) return;

    if (dados.canal === "pdf") {
      await handleDownload(bancoParaCompartilhar.id);
      return;
    }

    const docs = selecionados[bancoParaCompartilhar.id] || [];
    const listaTexto = docs.map((doc) => `• ${doc}`).join("\n");

    if (dados.canal === "whatsapp") {
      const msg = encodeURIComponent(
        `Olá! Segue o checklist de documentos para financiamento no banco ${bancoParaCompartilhar.nome}:\n\n${listaTexto}\n\nAtenciosamente, Agilliza.`,
      );
      window.open(`https://api.whatsapp.com/send?phone=55${dados.whatsapp}&text=${msg}`, "_blank");
      toast.success("Redirecionando para o WhatsApp...");
    }

    if (dados.canal === "email") {
      const subject = encodeURIComponent(`Checklist de Documentos - ${bancoParaCompartilhar.nome}`);
      const body = encodeURIComponent(
        `Olá,\n\nSegue a relação de documentos necessários para o banco ${bancoParaCompartilhar.nome}:\n\n${listaTexto}\n\nAtenciosamente,\nEquipe Agilliza`,
      );
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${dados.email}&su=${subject}&body=${body}`,
        "_blank",
      );
      toast.success("Redirecionando para o Gmail...");
    }
  };

  const adicionarItem = () => {
    if (!bancoSelecionado) return;
    setChecklists((prev) => ({
      ...prev,
      [bancoSelecionado]: [
        ...(prev[bancoSelecionado] || []),
        { nome: "Novo Documento", obrigatorio: true },
      ],
    }));
    setEditandoIndex(checklists[bancoSelecionado]?.length || 0);
    setNovoValor("Novo Documento");
  };

  const removerItem = (index: number) => {
    if (!bancoSelecionado) return;
    setChecklists((prev) => ({
      ...prev,
      [bancoSelecionado]: prev[bancoSelecionado].filter((_, i) => i !== index),
    }));
    toast.success("Item removido.");
  };

  const toggleObrigatoriedade = (index: number) => {
    if (!bancoSelecionado) return;
    setChecklists((prev) => {
      const novos = [...prev[bancoSelecionado]];
      novos[index] = { ...novos[index], obrigatorio: !novos[index].obrigatorio };
      return { ...prev, [bancoSelecionado]: novos };
    });
  };

  const iniciarEdicao = (index: number, valor: string) => {
    setEditandoIndex(index);
    setNovoValor(valor);
  };

  const salvarEdicao = (index: number) => {
    if (!bancoSelecionado) return;
    setChecklists((prev) => {
      const novos = [...prev[bancoSelecionado]];
      novos[index] = { ...novos[index], nome: novoValor };
      return { ...prev, [bancoSelecionado]: novos };
    });
    setEditandoIndex(null);
    toast.success("Item atualizado.");
  };

  const brandAtiva = bancoSelecionado ? resolveBancoBrand(bancoSelecionado) : null;
  const itemsAtivos = bancoSelecionado ? checklists[bancoSelecionado] || [] : [];
  const selecionadosAtivos = bancoSelecionado ? selecionados[bancoSelecionado] || [] : [];

  const toggleSelecao = (docNome: string) => {
    if (!bancoSelecionado) return;
    setSelecionados((prev) => {
      const bancoDocs = prev[bancoSelecionado] || [];
      if (bancoDocs.includes(docNome)) {
        return { ...prev, [bancoSelecionado]: bancoDocs.filter((d) => d !== docNome) };
      }
      return { ...prev, [bancoSelecionado]: [...bancoDocs, docNome] };
    });
  };

  const handleToggleDoc = (e: React.MouseEvent, docNome: string) => {
    e.stopPropagation();
    toggleSelecao(docNome);
  };

  return (
    <div className="container py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Checklist de Documentação</h1>
        <p className="text-muted-foreground">
          Selecione um banco para visualizar, editar e compartilhar a lista de documentos
          necessários.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {bancos.map((b) => {
          const brand = resolveBancoBrand(b.id);
          const isSelected = bancoSelecionado === b.id;

          return (
            <Card
              key={b.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent/50"
              }`}
              onClick={() => setBancoSelecionado(b.id)}
            >
              <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center p-3 shadow-sm"
                  style={{ backgroundColor: brand?.cor || "#F1F5F9" }}
                >
                  {brand?.logo ? (
                    <img
                      src={brand.logo}
                      alt={b.nome}
                      className={`w-full h-full object-contain ${b.id === "itau" ? "" : "brightness-0 invert"}`}
                    />
                  ) : (
                    <ListChecks className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">{b.nome}</h3>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {bancoSelecionado && (
        <Card className="animate-in slide-in-from-bottom-4 duration-500 border-none shadow-xl bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 px-8 py-6 rounded-t-xl">
            <div className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-3">
                <div
                  className="w-3 h-8 rounded-full"
                  style={{ backgroundColor: brandAtiva?.cor || "var(--primary)" }}
                />
                Checklist {bancos.find((b) => b.id === bancoSelecionado)?.nome}
              </CardTitle>
              <CardDescription>
                Personalize a relação de documentos antes de baixar ou enviar.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={adicionarItem}
                className="hover:bg-primary/5 border-primary/20 text-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Item
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handleShare(
                    bancoSelecionado,
                    bancos.find((b) => b.id === bancoSelecionado)?.nome || "",
                  )
                }
                className="hover:bg-primary/5"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar
              </Button>
              <Button
                onClick={() => handleDownload(bancoSelecionado)}
                className="shadow-lg shadow-primary/20"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {itemsAtivos.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-4 p-4 rounded-lg hover:bg-white transition-colors group border border-transparent hover:border-border cursor-pointer ${
                    !selecionadosAtivos.includes(item.nome)
                      ? "bg-slate-50/50 border-slate-100"
                      : "bg-white shadow-sm border-slate-200"
                  }`}
                  onClick={() => toggleSelecao(item.nome)}
                >
                  <div
                    className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selecionadosAtivos.includes(item.nome)
                        ? "border-primary bg-primary"
                        : "border-primary/30 group-hover:border-primary"
                    }`}
                  >
                    {selecionadosAtivos.includes(item.nome) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    {editandoIndex === idx ? (
                      <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={novoValor}
                          onChange={(e) => setNovoValor(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") salvarEdicao(idx);
                            if (e.key === "Escape") setEditandoIndex(null);
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600"
                          onClick={() => salvarEdicao(idx)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600"
                          onClick={() => setEditandoIndex(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-700 leading-tight">{item.nome}</p>
                          <div
                            className="flex items-center gap-2 mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleObrigatoriedade(idx);
                            }}
                          >
                            <div
                              className={`h-4 w-8 rounded-full transition-colors relative flex items-center px-1 ${item.obrigatorio ? "bg-primary" : "bg-slate-300"}`}
                            >
                              <div
                                className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${item.obrigatorio ? "translate-x-3.5" : "translate-x-0"}`}
                              />
                            </div>
                            <span className="text-xs text-slate-400">
                              {item.obrigatorio ? "Documento Obrigatório" : "Documento Opcional"}
                            </span>
                          </div>
                        </div>
                        <div
                          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => iniciarEdicao(idx, item.nome)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removerItem(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {itemsAtivos.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <p>Nenhum item no checklist. Adicione um novo item acima.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!bancoSelecionado && (
        <div className="py-20 text-center space-y-4 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Nenhum banco selecionado</h3>
            <p className="text-muted-foreground max-w-xs mx-auto text-sm">
              Escolha um dos bancos acima para gerar o checklist personalizado com a marca Agilliza.
            </p>
          </div>
        </div>
      )}

      <EncaminharChecklistDialog
        aberto={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onConfirm={onConfirmShare}
        bancoNome={bancoParaCompartilhar?.nome || ""}
      />
    </div>
  );
}
