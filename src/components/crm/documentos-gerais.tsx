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
  Check,
  ChevronsUpDown,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  n == null ? "—" : n.toLocaleString("pt-BR", {  style: "currency", currency: "BRL" });

function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
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

/** Formata documento (CPF/CNPJ) com máscara parcial estilo "389.***.***-20". */
function formatarDocumento(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length === 11) {
    return `CPF: ${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `CNPJ: ${digits.slice(0, 2)}.***.***/****-${digits.slice(12)}`;
  }
  return v;
}

type PastaTipo = "raiz" | "comercial" | "imob" | "corretor" | "analista";
type Aba = "cliente" | "comercial" | "imobiliaria" | "corretor" | "analista" | "lixeira";
type OrdemChave = "nome-asc" | "nome-desc" | "docs-desc" | "docs-asc";
type ModoLista = "grid" | "lista";

/** Modo de navegação: hierarquia completa ou visão agregada por dimensão. */
type Visao = "hierarquia" | "imobiliarias" | "corretores" | "analistas" | "clientes";


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
  analista: {
    label: "Analista",
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
  const [filtroAnalista, setFiltroAnalista] = useState<string>("todos");
  const [caminho, setCaminho] = useState<string[]>([]);
  const [visao, setVisao] = useState<Visao>("hierarquia");
  const [cliente, setCliente] = useState<DGCliente | null>(null);
  const [fichaAberta, setFichaAberta] = useState(false);
  const [aba, setAba] = useState<Aba>("cliente");
  const [ordem, setOrdem] = useState<OrdemChave>("nome-asc");
  const [modo, setModo] = useState<ModoLista>("grid");
  const [pagina, setPagina] = useState(1);
  const [filtrosSheet, setFiltrosSheet] = useState(false);
  const [arquivosAberto, setArquivosAberto] = useState(false);
  const POR_PAGINA = 8;

  const { data, isLoading } = useQuery({
    queryKey: ["crm-documentos-gerais"],
    queryFn: () => explorar(),
  });

  const clientes = data?.clientes ?? [];
  const imobiliariasFiltro = data?.imobiliarias ?? [];
  const corretoresFiltro = data?.corretores ?? [];
  const comerciaisBase = data?.comerciais ?? [];
  const analistasFiltro = data?.analistas ?? [];

  const filtrando =
    busca.trim() !== "" ||
    filtroComercial !== "todos" ||
    filtroImob !== "todas" ||
    filtroCorr !== "todos" ||
    filtroAnalista !== "todos";

  // Predicado por dimensão — permite calcular quais clientes ficam se
  // ignorarmos apenas o filtro daquela dimensão (afunilamento progressivo).
  const matchBusca = (c: DGCliente) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.numero_cliente ?? "").toLowerCase().includes(q) ||
      (c.documento ?? "").includes(q)
    );
  };
  const matchComercial = (c: DGCliente) =>
    filtroComercial === "todos" || c.comercial_id === filtroComercial;
  const matchImob = (c: DGCliente) => {
    if (filtroImob === "todas") return true;
    if (filtroImob === "comercial") return !c.imobiliaria_id;
    return c.imobiliaria_id === filtroImob;
  };
  const matchCorr = (c: DGCliente) => filtroCorr === "todos" || c.corretor_id === filtroCorr;
  const matchAnalista = (c: DGCliente) =>
    filtroAnalista === "todos" || c.analista_id === filtroAnalista;

  // Clientes após aplicar TODOS os filtros.
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(
      (c) =>
        matchBusca(c) &&
        matchComercial(c) &&
        matchImob(c) &&
        matchCorr(c) &&
        matchAnalista(c),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, busca, filtroComercial, filtroImob, filtroCorr, filtroAnalista]);

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
  // Cada comercial vira uma pasta solta no primeiro nível (sem envelopar tudo
  // em uma "pasta principal"). Dentro do comercial ficam suas imobiliárias e,
  // sob cada imobiliária, os corretores e clientes.
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
    lista.sort((a, b) => {
      const aSem = a.key === SEM_COMERCIAL_KEY;
      const bSem = b.key === SEM_COMERCIAL_KEY;
      if (aSem !== bSem) return aSem ? 1 : -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    return lista;
  }, [clientes, comerciaisBase]);

  // Árvore agregada conforme a visão escolhida (sempre lista solta no topo):
  //  - "hierarquia": cards de comerciais → Imobiliária → Corretor → Cliente
  //  - "imobiliarias" | "corretores" | "analistas": cards flat da dimensão,
  //    abrindo direto nos clientes daquela pessoa.
  //  - "clientes": não usa árvore (a aba "Por cliente" renderiza clientes direto).
  const arvore = useMemo<PastaNode[]>(() => {
    if (visao === "hierarquia") return raizes;
    if (visao === "clientes") return [];

    let dim: "imob" | "corr" | "analista";
    let base: { id: string; nome: string }[];
    let tipo: PastaTipo;
    let semKey: string;
    let semNome: string;
    if (visao === "imobiliarias") {
      dim = "imob";
      base = imobiliariasFiltro;
      tipo = "imob";
      semKey = SEM_IMOB_KEY;
      semNome = SEM_IMOB;
    } else if (visao === "corretores") {
      dim = "corr";
      base = corretoresFiltro;
      tipo = "corretor";
      semKey = SEM_CORRETOR_KEY;
      semNome = SEM_CORRETOR;
    } else {
      dim = "analista";
      base = analistasFiltro;
      tipo = "analista";
      // Regra: todo cliente cadastrado tem analista (criador). Nunca criamos
      // uma pasta "Sem analista" — clientes órfãos ficam soltos na raiz.
      semKey = "";
      semNome = "";
    }

    const map = new Map<string, PastaNode>();
    function garantir(key: string, nome: string): PastaNode {
      let node = map.get(key);
      if (!node) {
        node = { key, nome, tipo, subpastas: [], clientes: [], total_clientes: 0 };
        map.set(key, node);
      }
      return node;
    }
    const prefix = dim === "imob" ? "imob:" : dim === "corr" ? "corr:" : "ana:";
    // Semeia UMA pasta por cadastrado (todos aparecem, mesmo sem clientes).
    for (const b of base) garantir(`${prefix}${b.id}`, titulo(b.nome));

    // Vincula clientes apenas às pastas cadastradas; se o ID não estiver na
    // base (só imob/corr), o cliente cai em "Sem …". Na visão de analistas
    // não existe fallback: o criador sempre está na base.
    const idsBase = new Set(base.map((b) => b.id));
    const clientesSoltos: DGCliente[] = [];
    for (const c of clientes) {
      const id =
        dim === "imob" ? c.imobiliaria_id : dim === "corr" ? c.corretor_id : c.analista_id;
      const nome =
        dim === "imob" ? c.imobiliaria_nome : dim === "corr" ? c.corretor_nome : c.analista_nome;
      if (id && idsBase.has(id)) {
        const node = garantir(`${prefix}${id}`, titulo(nome));
        node.clientes.push(c);
      } else if (semKey) {
        const node = garantir(semKey, semNome);
        node.clientes.push(c);
      } else {
        clientesSoltos.push(c);
      }
    }

    const lista = Array.from(map.values());
    lista.forEach(finalizar);
    lista.sort((a, b) => {
      const aSem = semKey ? a.key === semKey : false;
      const bSem = semKey ? b.key === semKey : false;
      if (aSem !== bSem) return aSem ? 1 : -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    // Clientes órfãos (sem analista tipado) aparecem soltos como pseudo-pastas
    // "cliente" ao final — mantém a promessa de "não criar pasta fake".
    if (clientesSoltos.length > 0 && visao === "analistas") {
      for (const c of clientesSoltos) {
        lista.push({
          key: `cli:${c.cliente_id}`,
          nome: titulo(c.nome),
          tipo: "analista",
          subpastas: [],
          clientes: [c],
          total_clientes: 1,
        });
      }
    }
    return lista;

  }, [visao, raizes, clientes, imobiliariasFiltro, corretoresFiltro, analistasFiltro]);

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
    setCaminho([]);
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
    setFiltroAnalista("todos");
    setPagina(1);
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
      analista: { Icon: UserCog, classe: "from-primary/20 to-primary/5 text-primary" },

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

  // ⚠️ Todos os hooks devem ser chamados ANTES de qualquer early return.
  // A ficha do cliente (`if (cliente) return ...`) fica logo abaixo destes
  // useMemo — mover para dentro do IF causa erro #300 (fewer hooks).
  const clientesOrdenadosPre = useMemo(() => {
    const lista = [...clientesFiltrados];
    lista.sort((a, b) => {
      if (ordem === "docs-desc") return (b.total_documentos ?? 0) - (a.total_documentos ?? 0);
      if (ordem === "docs-asc") return (a.total_documentos ?? 0) - (b.total_documentos ?? 0);
      const na = titulo(a.nome);
      const nb = titulo(b.nome);
      return ordem === "nome-desc" ? nb.localeCompare(na, "pt-BR") : na.localeCompare(nb, "pt-BR");
    });
    return lista;
  }, [clientesFiltrados, ordem]);

  const pastasOrdenadasPre = useMemo(() => {
    const base = [...pastasNivel];
    base.sort((a, b) => {
      if (ordem === "docs-desc") return b.total_clientes - a.total_clientes;
      if (ordem === "docs-asc") return a.total_clientes - b.total_clientes;
      return ordem === "nome-desc"
        ? b.nome.localeCompare(a.nome, "pt-BR")
        : a.nome.localeCompare(b.nome, "pt-BR");
    });
    return base;
  }, [pastasNivel, ordem]);

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


  // ===== Mapeia aba escolhida para visão + reseta caminho =====
  function trocarAba(a: Aba) {
    setAba(a);
    setPagina(1);
    setCaminho([]);
    if (a === "cliente") setVisao("clientes");
    else if (a === "comercial") setVisao("hierarquia");
    else if (a === "imobiliaria") setVisao("imobiliarias");
    else if (a === "corretor") setVisao("corretores");
    else if (a === "analista") setVisao("analistas");
  }

  // Reutiliza os useMemo declarados antes do early return.
  const clientesOrdenados = clientesOrdenadosPre;
  const pastasOrdenadas = pastasOrdenadasPre;


  const listaAtual =
    aba === "cliente"
      ? clientesOrdenados
      : pastasNivel.length > 0
        ? pastasOrdenadas
        : clientesNivel;

  const totalItens = listaAtual.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const paginado = listaAtual.slice(inicio, inicio + POR_PAGINA);

  const kpis = {
    pastas: resumo.comerciais + resumo.imobiliarias + resumo.corretores,
    documentos: resumo.documentos,
    clientes: resumo.clientes,
    itens: resumo.documentos + resumo.clientes,
  };

  const tabsList: { key: Aba; label: string; Icon: typeof Users2 }[] = [
    { key: "cliente", label: "Por cliente", Icon: Users2 },
    { key: "comercial", label: "Por comercial", Icon: Briefcase },
    { key: "imobiliaria", label: "Por imobiliária", Icon: Building2 },
    { key: "corretor", label: "Por corretor", Icon: IdCard },
    { key: "analista", label: "Por analista", Icon: UserCog },
    { key: "lixeira", label: "Lixeira", Icon: Trash2 },
  ];

  const secaoTitulo =
    aba === "cliente"
      ? "Pastas por cliente"
      : aba === "lixeira"
        ? "Lixeira"
        : caminho.length === 0
          ? aba === "comercial"
            ? "Comerciais"
            : aba === "imobiliaria"
              ? "Imobiliárias"
              : aba === "corretor"
                ? "Corretores"
                : "Analistas"
          : trilha[trilha.length - 1]?.nome ?? "Pastas";

  return (
    <div className="space-y-5">
      {/* ==================== HERO ==================== */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-80 rounded-full opacity-60 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }}
        />
        <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <span className="inline-block h-1 w-6 rounded-full bg-primary" />
              CRM · Documentos
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-[28px]">
              Documentos Gerais
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Organizados por Comercial → Imobiliária → Corretor → Cliente, com a
              documentação de cada cliente.
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[600px]">
            {[
              { Icon: Folder, label: "Pastas", valor: kpis.pastas, aba: null as Aba | null },
              { Icon: FileText, label: "Documentos", valor: kpis.documentos, aba: null },
              { Icon: Users, label: "Clientes", valor: kpis.clientes, aba: "cliente" as Aba },
              { Icon: FolderKanban, label: "Itens", valor: kpis.itens, aba: null },
            ].map(({ Icon, label, valor, aba: destinoAba }) => (
              <button
                key={label}
                type="button"
                onClick={() => destinoAba && trocarAba(destinoAba)}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-background/60 p-3.5 text-left backdrop-blur-sm transition-all",
                  destinoAba
                    ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/[0.06]"
                    : "cursor-default",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-primary/70"
                />
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-7 items-center justify-center rounded-md text-primary" style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </p>
                </div>
                <p className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                  {valor.toLocaleString("pt-BR")}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== TABS (underline) ==================== */}
      <div className="border-b border-border/60">
        <div className="-mb-px flex flex-wrap items-center gap-1 overflow-x-auto">
          {tabsList.map(({ key, label, Icon }) => {
            const ativa = aba === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => trocarAba(key)}
                className={cn(
                  "relative inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  ativa
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
          <div className="ml-auto hidden pr-2 md:block">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setArquivosAberto(true)}
            >
              <FolderKanban className="h-4 w-4" /> Arquivos personalizados
            </Button>
          </div>
        </div>
      </div>

      {aba === "lixeira" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Trash2 className="h-7 w-7" />
            </span>
            <p className="text-sm font-medium text-foreground">Lixeira vazia</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Documentos e pastas removidos aparecerão aqui por 30 dias antes da
              exclusão definitiva.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ==================== FILTROS ==================== */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, documento ou e-mail…"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="h-10 pl-9 pr-9"
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    setBusca("");
                    setPagina(1);
                  }}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <FiltroPesquisa
              label="Comercial"
              value={filtroComercial}
              todosValue="todos"
              todosLabel="Todos os comerciais"
              placeholder="Pesquisar comercial..."
              opcoes={comerciaisBase}
              onChange={(v) => {
                setFiltroComercial(v);
                setPagina(1);
              }}
            />
            <FiltroPesquisa
              label="Imobiliária"
              value={filtroImob}
              todosValue="todas"
              todosLabel="Todas as imobiliárias"
              placeholder="Pesquisar imobiliária..."
              opcoes={imobiliariasFiltro}
              opcoesFixas={[{ id: "comercial", nome: SEM_IMOB }]}
              onChange={(v) => {
                setFiltroImob(v);
                setPagina(1);
              }}
            />
            <FiltroPesquisa
              label="Corretor"
              value={filtroCorr}
              todosValue="todos"
              todosLabel="Todos os corretores"
              placeholder="Pesquisar corretor..."
              opcoes={corretoresFiltro}
              onChange={(v) => {
                setFiltroCorr(v);
                setPagina(1);
              }}
            />
            <FiltroPesquisa
              label="Analista"
              value={filtroAnalista}
              todosValue="todos"
              todosLabel="Todos os analistas"
              placeholder="Pesquisar analista..."
              opcoes={analistasFiltro}
              onChange={(v) => {
                setFiltroAnalista(v);
                setPagina(1);
              }}
            />
            {filtrando && (
              <Button
                variant="ghost"
                className="h-10 gap-2 text-muted-foreground hover:text-foreground"
                onClick={limparFiltros}
              >
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
            <Button
              variant="outline"
              className="h-10 gap-2"
              onClick={() => setFiltrosSheet(true)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtros
            </Button>
          </div>

          {/* Breadcrumb (quando navegando em pastas) */}
          {aba !== "cliente" && trilha.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <button
                className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => setCaminho(caminho.slice(0, -1))}
              >
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <button className="hover:text-foreground" onClick={() => setCaminho([])}>
                Início
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
          )}

          {/* ==================== SECTION HEADER ==================== */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{secaoTitulo}</h2>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {totalItens.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Ordenar por:
              </span>
              <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemChave)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome-asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="nome-desc">Nome (Z-A)</SelectItem>
                  <SelectItem value="docs-desc">Mais documentos</SelectItem>
                  <SelectItem value="docs-asc">Menos documentos</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex overflow-hidden rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setModo("grid")}
                  aria-label="Grade"
                  className={cn(
                    "grid size-9 place-items-center transition-colors",
                    modo === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setModo("lista")}
                  aria-label="Lista"
                  className={cn(
                    "grid size-9 place-items-center border-l border-border/60 transition-colors",
                    modo === "lista"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ==================== CONTEÚDO ==================== */}
          {isLoading ? (
            <div
              className={cn(
                modo === "grid"
                  ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "space-y-2",
              )}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : totalItens === 0 ? (
            <Card>
              <CardContent className="py-14 text-center text-sm text-muted-foreground">
                Nenhum item encontrado com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            <div
              className={cn(
                modo === "grid"
                  ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "flex flex-col gap-2",
              )}
            >
              {paginado.map((item) => {
                if ("cliente_id" in item) {
                  const c = item as DGCliente;
                  return (
                    <CardCliente
                      key={c.cliente_id}
                      c={c}
                      modo={modo}
                      onOpen={() => abrirCliente(c)}
                    />
                  );
                }
                const p = item as PastaNode;
                return (
                  <CardPasta
                    key={p.key}
                    pasta={p}
                    modo={modo}
                    IconePasta={IconePasta}
                    onOpen={() => setCaminho([...caminho, p.key])}
                  />
                );
              })}
            </div>
          )}

          {/* ==================== PAGINAÇÃO ==================== */}
          {totalItens > POR_PAGINA && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Mostrando {inicio + 1} a {Math.min(inicio + POR_PAGINA, totalItens)} de{" "}
                {totalItens} itens
              </p>
              <Paginador
                pagina={paginaAtual}
                totalPaginas={totalPaginas}
                onIr={setPagina}
              />
            </div>
          )}
        </>
      )}

      {/* ==================== FAIXA DE SEGURANÇA ==================== */}
      <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 md:grid-cols-2">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Seus documentos sempre seguros
            </p>
            <p className="text-xs text-muted-foreground">
              Armazenamento criptografado e acesso controlado por permissões.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 md:justify-end">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Controle de acesso</p>
            <p className="text-xs text-muted-foreground">
              Permissões granulares por perfil e nível de acesso.
            </p>
          </div>
        </div>
      </div>

      {/* Sheet: Filtros avançados (limpar) */}
      <Sheet open={filtrosSheet} onOpenChange={setFiltrosSheet}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filtros avançados</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Filtros ativos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {filtroComercial !== "todos" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Comercial:{" "}
                    {titulo(
                      comerciaisBase.find((cm) => cm.id === filtroComercial)?.nome ?? "",
                    )}
                  </span>
                )}
                {filtroImob !== "todas" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Imobiliária:{" "}
                    {filtroImob === "comercial"
                      ? SEM_IMOB
                      : titulo(
                          imobiliariasFiltro.find((i) => i.id === filtroImob)?.nome ?? "",
                        )}
                  </span>
                )}
                {filtroCorr !== "todos" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Corretor:{" "}
                    {titulo(
                      corretoresFiltro.find((c) => c.id === filtroCorr)?.nome ?? "",
                    )}
                  </span>
                )}
                {filtroAnalista !== "todos" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Analista:{" "}
                    {titulo(
                      analistasFiltro.find((a) => a.id === filtroAnalista)?.nome ?? "",
                    )}
                  </span>
                )}
                {!filtrando && (
                  <span className="text-xs text-muted-foreground">Nenhum filtro ativo.</span>
                )}
              </div>
            </div>
            {filtrando && (
              <Button variant="outline" onClick={limparFiltros} className="w-full gap-2">
                <X className="h-4 w-4" /> Limpar todos os filtros
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: Arquivos personalizados */}
      <Sheet open={arquivosAberto} onOpenChange={setArquivosAberto}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" /> Arquivos personalizados
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <GerenciadorArquivos mostrarCabecalho={false} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type FiltroOpcao = { id: string; nome: string };

function FiltroPesquisa({
  label,
  value,
  todosValue,
  todosLabel,
  placeholder,
  opcoes,
  opcoesFixas = [],
  onChange,
}: {
  label: string;
  value: string;
  todosValue: string;
  todosLabel: string;
  placeholder: string;
  opcoes: FiltroOpcao[];
  opcoesFixas?: FiltroOpcao[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const itens = useMemo(() => {
    const map = new Map<string, FiltroOpcao>();
    for (const item of opcoesFixas) map.set(item.id, item);
    for (const item of opcoes) map.set(item.id, item);
    return Array.from(map.values()).sort((a, b) =>
      titulo(a.nome).localeCompare(titulo(b.nome), "pt-BR"),
    );
  }, [opcoes, opcoesFixas]);
  const selecionado = value === todosValue ? todosLabel : titulo(itens.find((i) => i.id === value)?.nome);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            "group flex h-10 min-w-[210px] max-w-full flex-1 items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 text-left text-sm shadow-sm transition-all sm:flex-none lg:w-[220px]",
            "hover:border-primary/35 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === todosValue ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selecionado && selecionado !== "—" ? selecionado : todosLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border-border/70 p-0 shadow-lg"
      >
        <Command
          filter={(itemValue, search) => {
            const normalize = (s: string) =>
              s
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();
            return normalize(itemValue).includes(normalize(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={placeholder} className="h-10" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={todosLabel}
                onSelect={() => {
                  onChange(todosValue);
                  setOpen(false);
                }}
                className="py-2.5"
              >
                <Check className={cn("size-4", value === todosValue ? "opacity-100" : "opacity-0")} />
                <span className="truncate font-medium">{todosLabel}</span>
              </CommandItem>
              {itens.map((item) => {
                const nome = titulo(item.nome);
                return (
                  <CommandItem
                    key={item.id}
                    value={`${nome} ${item.id}`}
                    onSelect={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className="py-2.5"
                  >
                    <Check className={cn("size-4", value === item.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{nome}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Paginação numérica com reticências. */
function Paginador({
  pagina,
  totalPaginas,
  onIr,
}: {
  pagina: number;
  totalPaginas: number;
  onIr: (p: number) => void;
}) {
  const paginas: (number | "...")[] = [];
  const push = (v: number | "...") => paginas.push(v);
  if (totalPaginas <= 6) {
    for (let i = 1; i <= totalPaginas; i++) push(i);
  } else {
    push(1);
    if (pagina > 3) push("...");
    for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPaginas - 1, pagina + 1); i++)
      push(i);
    if (pagina < totalPaginas - 2) push("...");
    push(totalPaginas);
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => onIr(pagina - 1)}
        className="grid size-8 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {paginas.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onIr(p)}
            className={cn(
              "grid size-8 place-items-center rounded-lg border text-xs font-medium transition-colors",
              p === pagina
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-card text-foreground hover:bg-muted",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => onIr(pagina + 1)}
        className="grid size-8 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Card de pasta (nível intermediário: comercial, imobiliária, corretor). */
function CardPasta({
  pasta,
  modo,
  IconePasta,
  onOpen,
}: {
  pasta: PastaNode;
  modo: ModoLista;
  IconePasta: (props: { tipo: PastaTipo; aberta?: boolean }) => React.JSX.Element;
  onOpen: () => void;
}) {
  const info = (
    <>
      {pasta.subpastas.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Folder className="h-3 w-3" /> {pasta.subpastas.length} pasta(s)
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Users className="h-3 w-3" /> {pasta.total_clientes} cliente(s)
      </span>
    </>
  );

  if (modo === "lista") {
    return (
      <button
        onClick={onOpen}
        className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <IconePasta tipo={pasta.tipo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{pasta.nome}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {info}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <IconePasta tipo={pasta.tipo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{pasta.nome}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {PASTA_BADGE[pasta.tipo].label}
          </p>
        </div>
      </div>
      <div className="h-0.5 w-full rounded-full bg-primary/20">
        <div
          className="h-0.5 rounded-full bg-primary"
          style={{
            width: `${Math.min(100, (pasta.total_clientes / Math.max(1, pasta.total_clientes)) * 100)}%`,
          }}
        />
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {info}
      </p>
    </button>
  );
}


/** Card de cliente com etiqueta do usuário que o cadastrou (target). */
function CardCliente({
  c,
  onOpen,
  modo = "grid",
  mostrarVinculos,
}: {
  c: DGCliente;
  onOpen: () => void;
  modo?: ModoLista;
  mostrarVinculos?: boolean;
}) {
  const docMasked = formatarDocumento(c.documento);
  const vinculo =
    mostrarVinculos || true
      ? `${c.imobiliaria_nome ? titulo(c.imobiliaria_nome) : SEM_IMOB} · ${c.corretor_nome ? titulo(c.corretor_nome) : SEM_CORRETOR}`
      : null;

  if (modo === "lista") {
    return (
      <button
        onClick={onOpen}
        className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <FolderOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {titulo(c.nome)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {docMasked ?? vinculo}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <FileText className="h-3 w-3" /> {c.total_documentos}
        </span>
      </button>
    );
  }

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
          {docMasked && (
            <p className="mt-0.5 truncate text-xs font-medium text-primary/80">
              {docMasked}
            </p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {c.imobiliaria_nome ? titulo(c.imobiliaria_nome) : SEM_IMOB} ·{" "}
            {c.corretor_nome ? titulo(c.corretor_nome) : SEM_CORRETOR}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> {c.total_documentos} documento(s)
        </span>
        {c.analista_nome && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
            title="Cadastrado por"
          >
            <UserCog className="h-3 w-3" />
            {primeiroNome(c.analista_nome)}
          </span>
        )}
      </div>
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
