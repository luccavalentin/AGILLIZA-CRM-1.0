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
import { cn } from "@/lib/utils";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import {
  explorarDocumentosGerais,
  obterFichaConsolidada,
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

/** Primeiro nome já formatado ("LUCCA VALENTIN" → "Lucca"). */
function primeiroNome(s: string | null | undefined): string {
  const t = titulo(s);
  return t === "—" ? "" : t.split(" ")[0];
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
  const comerciaisBase = data?.comerciais ?? [];

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

    function garantirComercial(key: string, nome: string): PastaNode {
      let com = comerciais.get(key);
      if (!com) {
        com = {
          key,
          nome,
          tipo: "comercial",
          subpastas: [],
          clientes: [],
          total_clientes: 0,
        };
        comerciais.set(key, com);
      }
      return com;
    }

    // Semeia uma pasta para cada comercial cadastrado na base (mesmo sem clientes).
    for (const cm of comerciaisBase) {
      garantirComercial(`com:${cm.id}`, titulo(cm.nome));
    }

    for (const c of clientes) {
      const comKey = c.comercial_id ? `com:${c.comercial_id}` : SEM_COMERCIAL_KEY;
      const comNome = c.comercial_id ? titulo(c.comercial_nome) : SEM_COMERCIAL_LABEL;
      const com = garantirComercial(comKey, comNome);

      // Sem imobiliária: usa "Avulso · <primeiro nome do comercial>".
      const semImobNome = c.comercial_id
        ? `Avulso · ${primeiroNome(c.comercial_nome)}`.trim().replace(/·\s*$/, "").trim()
        : SEM_IMOB;
      const imobKey = c.imobiliaria_id ? `imob:${c.imobiliaria_id}` : SEM_IMOB_KEY;
      const imobNome = c.imobiliaria_id ? titulo(c.imobiliaria_nome) : semImobNome;
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
  }, [clientes, comerciaisBase]);


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

  function IconePasta({ tipo, aberta }: { tipo: PastaTipo; aberta?: boolean }) {
    const conf: Record<PastaTipo, { Icon: typeof Folder; classe: string }> = {
      comercial: { Icon: Briefcase, classe: "from-primary/20 to-primary/5 text-primary" },
      imob: { Icon: Building2, classe: "from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400" },
      corretor: { Icon: IdCard, classe: "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400" },
    };
    const { Icon, classe } = conf[tipo];
    return (
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner ring-1 ring-inset ring-border/40",
          classe,
        )}
      >
        {aberta ? <FolderOpen className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </span>
    );
  }

  // ===== Ficha do cliente selecionado =====
  if (cliente) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button className="hover:text-foreground" onClick={() => setCliente(null)}>
            Documentos Gerais
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">{titulo(cliente.nome)}</span>
        </div>

        {/* Cabeçalho sofisticado do cliente */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
          <span className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg ring-1 ring-inset ring-primary/30">
                <FolderOpen className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-foreground">{titulo(cliente.nome)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {cliente.numero_cliente && (
                    <span className="inline-flex items-center gap-1">
                      <IdCard className="h-3 w-3" /> {cliente.numero_cliente}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {cliente.total_documentos} documento(s)
                  </span>
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => setFichaAberta(true)}
              className="group relative w-full overflow-hidden bg-gradient-to-r from-primary to-primary/80 shadow-md transition-all hover:shadow-lg hover:brightness-110 sm:w-auto"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <ClipboardList className="mr-2 h-4 w-4" /> Consultar ficha
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
                  <SelectItem value="comercial">{SEM_IMOB}</SelectItem>
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
      ) : raizes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum comercial cadastrado.
          </CardContent>
        </Card>

      ) : filtrando && caminho.length === 0 ? (
        // Resultado da consulta (lista plana de clientes)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clientesFiltrados.map((c) => (
            <CardCliente key={c.cliente_id} c={c} onOpen={() => abrirCliente(c)} mostrarVinculos />
          ))}
          {clientesFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      ) : pastasNivel.length > 0 ? (
        // Nível de pastas (comercial → imobiliária → corretor)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pastasNivel.map((p) => (
            <button
              key={p.key}
              className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              onClick={() => setCaminho([...caminho, p.key])}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-primary/60 to-primary/10 transition-transform group-hover:scale-x-100" />
              <IconePasta tipo={p.tipo} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{p.nome}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {p.subpastas.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Folder className="h-3 w-3" /> {p.subpastas.length} pasta(s)
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {p.total_clientes} cliente(s)
                  </span>
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      ) : (
        // Nível de clientes (dentro de um corretor)
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clientesNivel.map((c) => (
            <CardCliente key={c.cliente_id} c={c} onOpen={() => abrirCliente(c)} />
          ))}
          {clientesNivel.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Card de cliente com etiqueta do usuário que o cadastrou (target). */
function CardCliente({
  c,
  onOpen,
  mostrarVinculos,
}: {
  c: DGCliente;
  onOpen: () => void;
  mostrarVinculos?: boolean;
}) {
  return (
    <button
      className="group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      onClick={onOpen}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-primary/60 to-primary/10 transition-transform group-hover:scale-x-100" />
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-inset ring-border/40">
          <FolderOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{titulo(c.nome)}</p>
          {mostrarVinculos && (
            <p className="truncate text-xs text-muted-foreground">
              {c.imobiliaria_nome ? titulo(c.imobiliaria_nome) : SEM_IMOB} ·{" "}
              {c.corretor_nome ? titulo(c.corretor_nome) : SEM_CORRETOR}
            </p>
          )}
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" /> {c.total_documentos} documento(s)
          </p>
        </div>
      </div>
      {c.analista_nome && (
        <span
          className="inline-flex w-fit items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
          title="Cadastrado por"
        >
          <UserCog className="h-3 w-3" />
          {titulo(c.analista_nome)}
        </span>
      )}
    </button>
  );
}


function Campo({ rotulo, valor }: { rotulo: string; valor: any }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/50">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{valor === null || valor === undefined || valor === "" ? "—" : String(valor)}</p>
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
        <DialogHeader className="relative overflow-hidden border-b border-border/60 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent p-5">
          <span className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/10 blur-3xl" />
          <DialogTitle className="relative flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md ring-1 ring-inset ring-primary/30">
              <User className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ficha consolidada</span>
              <span className="text-base font-semibold text-foreground">{titulo(clienteNome)}</span>
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto p-5">

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
