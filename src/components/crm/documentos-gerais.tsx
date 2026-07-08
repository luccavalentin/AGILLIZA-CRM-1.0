import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Folder,
  FolderOpen,
  ChevronRight,
  User,
  Users,
  FileText,
  ClipboardList,
  Search,
  UserCog,
  Briefcase,
  IdCard,
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
  AVULSO_LABEL,
  SEM_COMERCIAL_LABEL,
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
const SEM_CORRETOR_KEY = "__sem_corretor__";
const SEM_IMOB = "Sem imobiliária";
const SEM_IMOB_KEY = "__sem_imob__";
const SEM_COMERCIAL_KEY = "__sem_comercial__";

// Palavras que permanecem minúsculas no meio do nome.
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

/** Formata nomes em Maiúscula/minúscula corretas ("NOVA SOLUÇÃO" → "Nova Solução"). */
function titulo(s: string | null | undefined): string {
  if (!s || !s.trim()) return "—";
  return s
    .toLowerCase()
    .replace(/\S+/g, (palavra, offset: number) => {
      if (offset !== 0 && MINUSCULAS.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    });
}

type PastaTipo = "comercial" | "imob" | "corretor";

interface PastaNode {
  key: string;
  nome: string;
  tipo: PastaTipo;
  subpastas: PastaNode[];
  clientes: DGCliente[];
  total_clientes: number;
  /** Analistas (criadores) marcados como etiqueta na pasta comercial. */
  analistas?: Map<string, string>;
}

function garantirFilho(pai: PastaNode, key: string, nome: string, tipo: PastaTipo): PastaNode {
  let filho = pai.subpastas.find((p) => p.key === key);
  if (!filho) {
    filho = { key, nome, tipo, subpastas: [], clientes: [], total_clientes: 0 };
    pai.subpastas.push(filho);
  }
  return filho;
}

function finalizar(node: PastaNode): number {
  let total = node.clientes.length;
  for (const s of node.subpastas) total += finalizar(s);
  node.subpastas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  node.clientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  node.total_clientes = total;
  return total;
}

export function DocumentosGerais() {
  const explorar = useServerFn(explorarDocumentosGerais);
  const [busca, setBusca] = useState("");
  const [filtroImob, setFiltroImob] = useState<string>("todas");
  const [filtroCorr, setFiltroCorr] = useState<string>("todos");
  const [caminho, setCaminho] = useState<string[]>([]);
  const [cliente, setCliente] = useState<DGCliente | null>(null);
  const [fichaAberta, setFichaAberta] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-documentos-gerais"],
    queryFn: () => explorar(),
  });

  const clientes = data?.clientes ?? [];
  const imobiliariasFiltro = data?.imobiliarias ?? [];
  const corretoresFiltro = data?.corretores ?? [];

  const filtrando = busca.trim() !== "" || filtroImob !== "todas" || filtroCorr !== "todos";

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

  // Árvore de pastas (hierarquia oficial):
  //   Comercial Agilliza → Imobiliária → Corretor → Cliente
  // Todo comercial tem a sua pasta; dentro dela ficam as imobiliárias com que
  // trabalha (uma mesma imobiliária pode aparecer em vários comerciais), e cada
  // imobiliária lista os corretores e, por fim, os clientes.
  const raizes = useMemo<PastaNode[]>(() => {
    const comerciais = new Map<string, PastaNode>();

    for (const c of clientes) {
      const comKey = c.comercial_id ? `com:${c.comercial_id}` : SEM_COMERCIAL_KEY;
      const comNome = c.comercial_id ? titulo(c.comercial_nome) : SEM_COMERCIAL_LABEL;
      let com = comerciais.get(comKey);
      if (!com) {
        com = {
          key: comKey,
          nome: comNome,
          tipo: "comercial",
          subpastas: [],
          clientes: [],
          total_clientes: 0,
        };
        comerciais.set(comKey, com);
      }

      const imobKey = c.imobiliaria_id ? `imob:${c.imobiliaria_id}` : SEM_IMOB_KEY;
      const imobNome = c.imobiliaria_id ? titulo(c.imobiliaria_nome) : SEM_IMOB;
      const imob = garantirFilho(com, imobKey, imobNome, "imob");

      const corrKey = c.corretor_id ?? SEM_CORRETOR_KEY;
      const corrNome = c.corretor_id ? titulo(c.corretor_nome) : SEM_CORRETOR;
      const corr = garantirFilho(imob, corrKey, corrNome, "corretor");
      corr.clientes.push(c);
    }

    const lista = Array.from(comerciais.values());
    for (const r of lista) finalizar(r);
    // Comerciais em ordem alfabética; "Sem comercial" por último.
    return lista.sort((a, b) => {
      const aSem = a.key === SEM_COMERCIAL_KEY;
      const bSem = b.key === SEM_COMERCIAL_KEY;
      if (aSem !== bSem) return aSem ? 1 : -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [clientes]);

  // Traça o caminho atual na árvore, coletando as pastas percorridas.
  const trilha = useMemo<PastaNode[]>(() => {
    const nodes: PastaNode[] = [];
    let nivel = raizes;
    for (const key of caminho) {
      const found = nivel.find((n) => n.key === key);
      if (!found) break;
      nodes.push(found);
      nivel = found.subpastas;
    }
    return nodes;
  }, [raizes, caminho]);

  const atual = trilha.length > 0 ? trilha[trilha.length - 1] : null;
  const pastasNivel = atual ? atual.subpastas : raizes;
  const clientesNivel = atual && atual.subpastas.length === 0 ? atual.clientes : [];

  function limparFiltros() {
    setBusca("");
    setFiltroImob("todas");
    setFiltroCorr("todos");
  }

  function abrirCliente(c: DGCliente) {
    setCliente(c);
    setFichaAberta(false);
  }

  function iconePasta(tipo: PastaTipo) {
    if (tipo === "imob") return <Building2 className="h-8 w-8 shrink-0 text-primary" />;
    return <Folder className="h-8 w-8 shrink-0 text-primary" />;
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
          <span className="font-medium text-foreground">{titulo(cliente.nome)}</span>
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
        <button className="hover:text-foreground" onClick={() => setCaminho([])}>
          Documentos Gerais
        </button>
        {trilha.map((node, idx) => (
          <span key={node.key} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            <button
              className="font-medium text-foreground hover:underline"
              onClick={() => setCaminho(caminho.slice(0, idx + 1))}
            >
              {node.nome}
            </button>
          </span>
        ))}
      </div>

      {/* Filtros / consulta (tela inicial) */}
      {caminho.length === 0 && (
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
                  <SelectItem value="comercial">{AVULSO_LABEL}</SelectItem>
                  {imobiliariasFiltro.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {titulo(i.nome)}
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
                      {titulo(c.nome)}
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
      ) : filtrando && caminho.length === 0 ? (
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
                <p className="truncate font-medium text-foreground">{titulo(c.nome)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.imobiliaria_nome ? titulo(c.imobiliaria_nome) : AVULSO_LABEL} ·{" "}
                  {c.corretor_nome ? titulo(c.corretor_nome) : SEM_CORRETOR}
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
      ) : pastasNivel.length > 0 ? (
        // Nível de pastas (imobiliárias/avulso/comercial/corretor)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pastasNivel.map((p) => (
            <button
              key={p.key}
              className="flex flex-col gap-2 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => setCaminho([...caminho, p.key])}
            >
              <div className="flex items-center gap-3">
                {iconePasta(p.tipo)}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.subpastas.length > 0
                      ? `${p.subpastas.length} pasta(s) · ${p.total_clientes} cliente(s)`
                      : `${p.total_clientes} cliente(s)`}
                  </p>
                </div>
              </div>
              {p.tipo === "comercial" && p.analistas && p.analistas.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Array.from(p.analistas.values()).map((nome) => (
                    <span
                      key={nome}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      title="Analista que criou o cadastro"
                    >
                      <UserCog className="h-3 w-3" />
                      {nome}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        // Nível de clientes (dentro de um corretor)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientesNivel.map((c) => (
            <button
              key={c.cliente_id}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => abrirCliente(c)}
            >
              <FolderOpen className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{titulo(c.nome)}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" /> {c.total_documentos} documento(s)
                </p>
              </div>
            </button>
          ))}
          {clientesNivel.length === 0 && (
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
