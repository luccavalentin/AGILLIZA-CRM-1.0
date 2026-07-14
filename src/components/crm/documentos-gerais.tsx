import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Folder,
  FolderOpen,
  ChevronLeft,
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
  Printer,
  Cloud,
  Trash2,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Shield,
  Lock,
  FolderKanban,
  Users2,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import {
  explorarDocumentosGerais,
  obterFichaConsolidada,
  SEM_COMERCIAL_LABEL,
  type DGCliente,
} from "@/lib/crm/documentos-gerais.functions";
import { imprimirFichaPDF } from "@/lib/crm/ficha-pdf";
import { GerenciadorArquivos } from "@/components/documentos/gerenciador-arquivos";


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

type PastaTipo = "raiz" | "comercial" | "imob" | "corretor";

/** Modo de navegação: hierarquia completa ou visão agregada por dimensão. */
type Visao = "hierarquia" | "imobiliarias" | "corretores" | "clientes";

const RAIZ_KEY = "__raiz_principal__";
const RAIZ_NOME = "Pasta Comercial e documentos de clientes";

/** Rótulo e cor da etiqueta que identifica o nível da pasta. */
const PASTA_BADGE: Record<PastaTipo, { label: string; classe: string }> = {
  raiz: {
    label: "Pasta principal",
    classe: "border-primary/25 bg-primary/10 text-primary",
  },
  comercial: {
    label: "Comercial Agilliza",
    classe: "border-primary/25 bg-primary/10 text-primary",
  },
  imob: {
    label: "Imobiliária",
    classe: "border-primary/25 bg-primary/10 text-primary",
  },
  corretor: {
    label: "Corretor",
    classe: "border-primary/25 bg-primary/10 text-primary",
  },
};


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
  const [filtroComercial, setFiltroComercial] = useState<string>("todos");
  const [filtroImob, setFiltroImob] = useState<string>("todas");
  const [filtroCorr, setFiltroCorr] = useState<string>("todos");
  const [caminho, setCaminho] = useState<string[]>([]);
  const [visao, setVisao] = useState<Visao>("hierarquia");
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

  const filtrando =
    busca.trim() !== "" ||
    filtroComercial !== "todos" ||
    filtroImob !== "todas" ||
    filtroCorr !== "todos";

  // Clientes após aplicar os filtros da tela inicial.
  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filtroComercial !== "todos" && c.comercial_id !== filtroComercial) return false;
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
  }, [clientes, busca, filtroComercial, filtroImob, filtroCorr]);

  // Visão geral (KPIs) — sempre sobre a base completa, para dar contexto no topo.
  const resumo = useMemo(() => {
    const imobs = new Set<string>();
    const corrs = new Set<string>();
    let documentos = 0;
    for (const c of clientes) {
      if (c.imobiliaria_id) imobs.add(c.imobiliaria_id);
      if (c.corretor_id) corrs.add(c.corretor_id);
      documentos += c.total_documentos ?? 0;
    }
    return {
      comerciais: comerciaisBase.length,
      imobiliarias: imobs.size,
      corretores: corrs.size,
      clientes: clientes.length,
      documentos,
    };
  }, [clientes, comerciaisBase]);


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
    lista.sort((a, b) => {
      const aSem = a.key === SEM_COMERCIAL_KEY;
      const bSem = b.key === SEM_COMERCIAL_KEY;
      if (aSem !== bSem) return aSem ? 1 : -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    // Todos os comerciais ficam dentro de uma única pasta raiz.
    const raiz: PastaNode = {
      key: RAIZ_KEY,
      nome: RAIZ_NOME,
      tipo: "raiz",
      subpastas: lista,
      clientes: [],
      total_clientes: lista.reduce((acc, n) => acc + n.total_clientes, 0),
    };
    return [raiz];
  }, [clientes, comerciaisBase]);

  // Árvore agregada conforme a visão escolhida (cards de KPI):
  //  - "hierarquia": Comercial → Imobiliária → Corretor → Cliente (padrão)
  //  - "imobiliarias": lista todas as imobiliárias; cada uma abre seus clientes
  //  - "corretores": lista todos os corretores; cada um abre seus clientes
  //  - "clientes": lista todos os clientes diretamente
  const arvore = useMemo<PastaNode[]>(() => {
    if (visao === "hierarquia") return raizes;

    if (visao === "clientes") {
      const raiz: PastaNode = {
        key: RAIZ_KEY,
        nome: "Todos os clientes",
        tipo: "raiz",
        subpastas: [],
        clientes: [...clientes],
        total_clientes: clientes.length,
      };
      finalizar(raiz);
      return [raiz];
    }

    // imobiliarias | corretores → agrupa clientes pela dimensão
    const porDimensao = visao === "imobiliarias";
    const map = new Map<string, PastaNode>();
    const semKey = porDimensao ? SEM_IMOB_KEY : SEM_CORRETOR_KEY;
    const semNome = porDimensao ? SEM_IMOB : SEM_CORRETOR;
    const tipo: PastaTipo = porDimensao ? "imob" : "corretor";

    function garantir(key: string, nome: string): PastaNode {
      let node = map.get(key);
      if (!node) {
        node = { key, nome, tipo, subpastas: [], clientes: [], total_clientes: 0 };
        map.set(key, node);
      }
      return node;
    }

    // Semeia todas as entidades cadastradas (mesmo sem clientes vinculados).
    if (porDimensao) {
      for (const i of imobiliariasFiltro) garantir(`imob:${i.id}`, titulo(i.nome));
    } else {
      for (const co of corretoresFiltro) garantir(`corr:${co.id}`, titulo(co.nome));
    }

    for (const c of clientes) {
      const id = porDimensao ? c.imobiliaria_id : c.corretor_id;
      const nome = porDimensao ? c.imobiliaria_nome : c.corretor_nome;
      const key = id ? (porDimensao ? `imob:${id}` : `corr:${id}`) : semKey;
      const node = garantir(key, id ? titulo(nome) : semNome);
      node.clientes.push(c);
    }

    const lista = Array.from(map.values());
    lista.forEach(finalizar);
    lista.sort((a, b) => {
      const aSem = a.key === semKey;
      const bSem = b.key === semKey;
      if (aSem !== bSem) return aSem ? 1 : -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    const raiz: PastaNode = {
      key: RAIZ_KEY,
      nome: porDimensao ? "Imobiliárias" : "Corretores",
      tipo: "raiz",
      subpastas: lista,
      clientes: [],
      total_clientes: lista.reduce((acc, n) => acc + n.total_clientes, 0),
    };
    return [raiz];
  }, [visao, raizes, clientes, imobiliariasFiltro, corretoresFiltro]);

  // Traça o caminho atual na árvore, coletando as pastas percorridas.
  const trilha = useMemo<PastaNode[]>(() => {
    const nodes: PastaNode[] = [];
    let nivel = arvore;
    for (const key of caminho) {
      const found = nivel.find((n) => n.key === key);
      if (!found) break;
      nodes.push(found);
      nivel = found.subpastas;
    }
    return nodes;
  }, [arvore, caminho]);

  const atual = trilha.length > 0 ? trilha[trilha.length - 1] : null;
  const pastasNivel = atual ? atual.subpastas : arvore;
  const clientesNivel = atual && atual.subpastas.length === 0 ? atual.clientes : [];

  /** Abre uma visão agregada a partir dos cards de KPI. */
  function abrirVisao(v: Visao) {
    setVisao(v);
    setCaminho([RAIZ_KEY]);
  }

  /** Volta à raiz (cards de KPI) e restaura a visão hierárquica. */
  function irParaRaiz() {
    setVisao("hierarquia");
    setCaminho([]);
  }

  function limparFiltros() {
    setBusca("");
    setFiltroComercial("todos");
    setFiltroImob("todas");
    setFiltroCorr("todos");
  }

  function abrirCliente(c: DGCliente) {
    setCliente(c);
    setFichaAberta(false);
  }

  function IconePasta({ tipo, aberta }: { tipo: PastaTipo; aberta?: boolean }) {
    const conf: Record<PastaTipo, { Icon: typeof Folder; classe: string }> = {
      raiz: { Icon: FolderKanban, classe: "from-primary/20 to-primary/5 text-primary" },
      comercial: { Icon: Briefcase, classe: "from-primary/20 to-primary/5 text-primary" },
      imob: { Icon: Building2, classe: "from-primary/20 to-primary/5 text-primary" },
      corretor: { Icon: IdCard, classe: "from-primary/20 to-primary/5 text-primary" },

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
    <Tabs defaultValue="clientes" className="space-y-4">
      <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
        <TabsTrigger value="clientes" className="gap-2 data-[state=active]:shadow-sm">
          <Users2 className="h-4 w-4" /> Por cliente
        </TabsTrigger>
        <TabsTrigger value="arquivos" className="gap-2 data-[state=active]:shadow-sm">
          <FolderKanban className="h-4 w-4" /> Pastas &amp; arquivos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="arquivos" className="mt-0">
        <GerenciadorArquivos mostrarCabecalho={false} />
      </TabsContent>

      <TabsContent value="clientes" className="mt-0 space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {caminho.length > 0 && (
          <button
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted"
            onClick={() => {
              const next = caminho.slice(0, -1);
              if (next.length === 0) irParaRaiz();
              else setCaminho(next);
            }}
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>
        )}
        <button className="hover:text-foreground" onClick={irParaRaiz}>
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
              <Select value={filtroComercial} onValueChange={setFiltroComercial}>
                <SelectTrigger>
                  <SelectValue placeholder="Comercial Agilliza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os comerciais</SelectItem>
                  {comerciaisBase.map((cm) => (
                    <SelectItem key={cm.id} value={cm.id}>
                      {titulo(cm.nome)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Visão geral — KPIs da estrutura documental (apenas na raiz) */}
      {caminho.length === 0 && !filtrando && !isLoading && raizes.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              Icon: Briefcase,
              label: "Comerciais",
              valor: resumo.comerciais,
              acao: () => raizes[0] && setCaminho([raizes[0].key]),
            },
            {
              Icon: Building2,
              label: "Imobiliárias",
              valor: resumo.imobiliarias,
              acao: () => abrirVisao("imobiliarias"),
            },
            {
              Icon: IdCard,
              label: "Corretores",
              valor: resumo.corretores,
              acao: () => abrirVisao("corretores"),
            },
            {
              Icon: Users,
              label: "Clientes",
              valor: resumo.clientes,
              acao: () => abrirVisao("clientes"),
            },
            {
              Icon: FileText,
              label: "Documentos",
              valor: resumo.documentos,
              acao: () => raizes[0] && setCaminho([raizes[0].key]),
            },
          ].map(({ Icon, label, valor, acao }) => (
            <button
              key={label}
              type="button"
              onClick={acao}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-primary/[0.03] p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="pointer-events-none absolute -right-6 -top-6 size-16 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
              <div className="relative flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-none tracking-tight text-foreground tabular-nums">
                    {valor.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                </div>
              </div>
            </button>
          ))}

        </div>
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
                <span
                  className={cn(
                    "mb-1 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    PASTA_BADGE[p.tipo].classe,
                  )}
                >
                  {PASTA_BADGE[p.tipo].label}
                </span>
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
      </TabsContent>
    </Tabs>
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
          <div className="relative flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md ring-1 ring-inset ring-primary/30">
                <User className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ficha consolidada</span>
                <span className="text-base font-semibold text-foreground">{titulo(clienteNome)}</span>
              </span>
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={!data}
              onClick={() => data && imprimirFichaPDF(clienteNome, data)}
              className="mr-8 shrink-0 gap-2 border-primary/30 bg-background/70 text-primary hover:bg-primary/10"
            >
              <Printer className="h-4 w-4" /> Imprimir PDF
            </Button>
          </div>
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
