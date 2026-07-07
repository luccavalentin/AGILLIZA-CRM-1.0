import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Folder,
  FolderOpen,
  ChevronRight,
  User,
  FileText,
  ClipboardList,
  Search,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import {
  explorarDocumentosGerais,
  obterFichaConsolidada,
  COMERCIAL_AGILLIZA_LABEL,
  type DGCliente,
} from "@/lib/crm/documentos-gerais.functions";

const brl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

const SEM_CORRETOR = "Sem corretor vinculado";
const COMERCIAL_KEY = "__comercial__";
const SEM_CORRETOR_KEY = "__sem_corretor__";

interface CorretorPasta {
  key: string;
  nome: string;
  clientes: DGCliente[];
}
interface ImobiliariaPasta {
  key: string;
  nome: string;
  comercial: boolean;
  corretores: CorretorPasta[];
  total_clientes: number;
}

export function DocumentosGerais() {
  const explorar = useServerFn(explorarDocumentosGerais);
  const [busca, setBusca] = useState("");
  const [filtroImob, setFiltroImob] = useState<string>("todas");
  const [filtroCorr, setFiltroCorr] = useState<string>("todos");
  const [imobAberta, setImobAberta] = useState<string | null>(null);
  const [corrAberto, setCorrAberto] = useState<string | null>(null);
  const [cliente, setCliente] = useState<DGCliente | null>(null);
  const [fichaAberta, setFichaAberta] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-documentos-gerais"],
    queryFn: () => explorar(),
  });

  const clientes = data?.clientes ?? [];
  const imobiliariasFiltro = data?.imobiliarias ?? [];
  const corretoresFiltro = data?.corretores ?? [];

  const filtrando =
    busca.trim() !== "" || filtroImob !== "todas" || filtroCorr !== "todos";

  // Clientes após aplicar os filtros da tela inicial.
  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filtroImob === "comercial" && c.imobiliaria_id) return false;
      if (filtroImob !== "todas" && filtroImob !== "comercial" && c.imobiliaria_id !== filtroImob)
        return false;
      if (filtroCorr !== "todos" && c.corretor_id !== filtroCorr) return false;
      if (
        q &&
        !c.nome.toLowerCase().includes(q) &&
        !(c.numero_cliente ?? "").toLowerCase().includes(q) &&
        !(c.documento ?? "").includes(q)
      )
        return false;
      return true;
    });
  }, [clientes, busca, filtroImob, filtroCorr]);

  // Árvore Imobiliária → Corretor → Cliente (ordenada alfabeticamente).
  const arvore = useMemo<ImobiliariaPasta[]>(() => {
    const imobs = new Map<string, ImobiliariaPasta>();
    for (const c of clientes) {
      const imobKey = c.imobiliaria_id ?? COMERCIAL_KEY;
      const imobNome = c.imobiliaria_id ? c.imobiliaria_nome ?? "—" : COMERCIAL_AGILLIZA_LABEL;
      if (!imobs.has(imobKey)) {
        imobs.set(imobKey, {
          key: imobKey,
          nome: imobNome,
          comercial: !c.imobiliaria_id,
          corretores: [],
          total_clientes: 0,
        });
      }
      const imob = imobs.get(imobKey)!;
      const corrKey = c.corretor_id ?? SEM_CORRETOR_KEY;
      const corrNome = c.corretor_id ? c.corretor_nome ?? "—" : SEM_CORRETOR;
      let corr = imob.corretores.find((x) => x.key === corrKey);
      if (!corr) {
        corr = { key: corrKey, nome: corrNome, clientes: [] };
        imob.corretores.push(corr);
      }
      corr.clientes.push(c);
      imob.total_clientes += 1;
    }
    const ordCli = (a: DGCliente, b: DGCliente) => a.nome.localeCompare(b.nome, "pt-BR");
    const lista = Array.from(imobs.values());
    for (const imob of lista) {
      imob.corretores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      for (const corr of imob.corretores) corr.clientes.sort(ordCli);
    }
    // Imobiliárias em ordem alfabética; "Comercial Agilliza" por último.
    return lista.sort((a, b) => {
      if (a.comercial !== b.comercial) return a.comercial ? 1 : -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [clientes]);

  const imobAtual = imobAberta ? arvore.find((i) => i.key === imobAberta) ?? null : null;
  const corrAtual =
    imobAtual && corrAberto ? imobAtual.corretores.find((c) => c.key === corrAberto) ?? null : null;

  function limparFiltros() {
    setBusca("");
    setFiltroImob("todas");
    setFiltroCorr("todos");
  }

  function abrirCliente(c: DGCliente) {
    setCliente(c);
    setFichaAberta(false);
  }

  // ===== Ficha do cliente selecionado =====
  if (cliente) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button className="hover:text-foreground" onClick={() => setCliente(null)}>
            Documentos Gerais
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">{cliente.nome}</span>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => setFichaAberta(true)}>
              <ClipboardList className="mr-1 h-4 w-4" /> Consultar ficha
            </Button>
          </div>
        </div>

        <DocumentosTab clienteId={cliente.cliente_id} />

        <FichaDialog
          clienteId={cliente.cliente_id}
          clienteNome={cliente.nome}
          open={fichaAberta}
          onOpenChange={setFichaAberta}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <button
          className="hover:text-foreground"
          onClick={() => {
            setImobAberta(null);
            setCorrAberto(null);
          }}
        >
          Documentos Gerais
        </button>
        {imobAtual && (
          <>
            <ChevronRight className="h-4 w-4" />
            <button
              className="font-medium text-foreground hover:underline"
              onClick={() => setCorrAberto(null)}
            >
              {imobAtual.nome}
            </button>
          </>
        )}
        {corrAtual && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{corrAtual.nome}</span>
          </>
        )}
      </div>

      {/* Filtros / consulta (tela inicial) */}
      {!imobAberta && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, número ou documento…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-52">
              <Select value={filtroImob} onValueChange={setFiltroImob}>
                <SelectTrigger>
                  <SelectValue placeholder="Imobiliária" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as imobiliárias</SelectItem>
                  <SelectItem value="comercial">{COMERCIAL_AGILLIZA_LABEL}</SelectItem>
                  {imobiliariasFiltro.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-52">
              <Select value={filtroCorr} onValueChange={setFiltroCorr}>
                <SelectTrigger>
                  <SelectValue placeholder="Corretor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os corretores</SelectItem>
                  {corretoresFiltro.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtrando && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="mr-1 h-4 w-4" /> Limpar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </CardContent>
        </Card>
      ) : filtrando && !imobAberta ? (
        // Resultado da consulta (lista plana de clientes)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((c) => (
            <button
              key={c.cliente_id}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => abrirCliente(c)}
            >
              <FolderOpen className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {(c.imobiliaria_nome ?? COMERCIAL_AGILLIZA_LABEL)} ·{" "}
                  {c.corretor_nome ?? SEM_CORRETOR}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" /> {c.total_documentos} documento(s)
                </p>
              </div>
            </button>
          ))}
          {clientesFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      ) : !imobAberta ? (
        // Nível 1: imobiliárias (+ Comercial Agilliza)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {arvore.map((imob) => (
            <button
              key={imob.key}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => {
                setImobAberta(imob.key);
                setCorrAberto(null);
              }}
            >
              <Building2 className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{imob.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {imob.corretores.length} corretor(es) · {imob.total_clientes} cliente(s)
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : !corrAberto ? (
        // Nível 2: corretores da imobiliária
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(imobAtual?.corretores ?? []).map((corr) => (
            <button
              key={corr.key}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => setCorrAberto(corr.key)}
            >
              <Folder className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{corr.nome}</p>
                <p className="text-xs text-muted-foreground">{corr.clientes.length} cliente(s)</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        // Nível 3: clientes do corretor
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(corrAtual?.clientes ?? []).map((c) => (
            <button
              key={c.cliente_id}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => abrirCliente(c)}
            >
              <FolderOpen className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.nome}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" /> {c.total_documentos} documento(s)
                </p>
              </div>
            </button>
          ))}
          {(corrAtual?.clientes ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}


function Campo({ rotulo, valor }: { rotulo: string; valor: any }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="text-sm text-foreground">{valor === null || valor === undefined || valor === "" ? "—" : String(valor)}</p>
    </div>
  );
}

function FichaDialog({
  clienteId,
  clienteNome,
  open,
  onOpenChange,
}: {
  clienteId: string;
  clienteNome: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const obter = useServerFn(obterFichaConsolidada);
  const { data, isLoading } = useQuery({
    queryKey: ["crm-ficha-consolidada", clienteId],
    queryFn: () => obter({ data: { cliente_id: clienteId } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Ficha consolidada — {clienteNome}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4">
          {isLoading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="comprador">
              <TabsList className="flex-wrap">
                <TabsTrigger value="comprador">Comprador</TabsTrigger>
                {data.conjuge && <TabsTrigger value="conjuge">Cônjuge</TabsTrigger>}
                <TabsTrigger value="vendedor">
                  Vendedor{data.vendedores.length > 1 ? `es (${data.vendedores.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="imovel">Imóvel</TabsTrigger>
              </TabsList>

              <TabsContent value="comprador" className="mt-4">
                {data.comprador ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo rotulo="Nome" valor={data.comprador.nome} />
                    <Campo rotulo="Documento" valor={data.comprador.documento} />
                    <Campo rotulo="Nascimento" valor={fmtData(data.comprador.data_nascimento)} />
                    <Campo rotulo="Estado civil" valor={data.comprador.estado_civil} />
                    <Campo rotulo="Profissão" valor={data.comprador.profissao} />
                    <Campo rotulo="Nacionalidade" valor={data.comprador.nacionalidade} />
                    <Campo rotulo="E-mail" valor={data.comprador.email} />
                    <Campo rotulo="Celular" valor={data.comprador.telefone_celular} />
                    <Campo rotulo="Renda declarada" valor={brl(data.comprador.renda_total_declarada)} />
                    <Campo rotulo="Nome da mãe" valor={data.comprador.nome_mae} />
                    <Campo rotulo="Banco" valor={data.comprador.banco_conta} />
                    <Campo rotulo="Agência / Conta" valor={[data.comprador.agencia, data.comprador.conta_corrente].filter(Boolean).join(" / ") || "—"} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                )}
              </TabsContent>

              {data.conjuge && (
                <TabsContent value="conjuge" className="mt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo rotulo="Nome" valor={data.conjuge.nome} />
                    <Campo rotulo="Documento" valor={data.conjuge.documento} />
                    <Campo rotulo="Nascimento" valor={fmtData(data.conjuge.data_nascimento)} />
                    <Campo rotulo="Profissão" valor={data.conjuge.profissao} />
                    <Campo rotulo="Nacionalidade" valor={data.conjuge.nacionalidade} />
                    <Campo rotulo="E-mail" valor={data.conjuge.email} />
                    <Campo rotulo="Celular" valor={data.conjuge.telefone_celular} />
                    <Campo rotulo="Renda" valor={brl(data.conjuge.renda)} />
                    <Campo rotulo="Nome da mãe" valor={data.conjuge.nome_mae} />
                    <Campo rotulo="Empresa" valor={data.conjuge.empresa} />
                    <Campo rotulo="Banco" valor={data.conjuge.banco_conta} />
                    <Campo rotulo="Agência / Conta" valor={[data.conjuge.agencia, data.conjuge.conta_corrente].filter(Boolean).join(" / ") || "—"} />
                  </div>
                </TabsContent>
              )}

              <TabsContent value="vendedor" className="mt-4 space-y-4">
                {data.vendedores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum vendedor cadastrado.</p>
                ) : (
                  data.vendedores.map((v, i) => (
                    <div key={v.id ?? i} className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        {v.nome ?? `Vendedor ${i + 1}`}
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Campo rotulo="Documento" valor={v.documento ?? v.cpf_cnpj} />
                        <Campo rotulo="Estado civil" valor={v.estado_civil} />
                        <Campo rotulo="Profissão" valor={v.profissao} />
                        <Campo rotulo="E-mail" valor={v.email} />
                        <Campo rotulo="Celular" valor={v.telefone_celular} />
                        <Campo rotulo="Banco" valor={v.banco_conta} />
                        <Campo rotulo="Agência / Conta" valor={[v.agencia, v.conta_corrente].filter(Boolean).join(" / ") || "—"} />
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="imovel" className="mt-4 space-y-4">
                {data.imoveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum imóvel cadastrado.</p>
                ) : (
                  data.imoveis.map((im, i) => (
                    <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                      <Campo rotulo="Tipo" valor={im.tipo} />
                      <Campo rotulo="Uso" valor={im.uso} />
                      <Campo rotulo="Logradouro" valor={im.logradouro} />
                      <Campo rotulo="Cidade / UF" valor={[im.cidade, im.uf].filter(Boolean).join(" / ") || "—"} />
                      <Campo rotulo="Valor" valor={brl(im.valor)} />
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
