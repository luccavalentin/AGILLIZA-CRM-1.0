import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Folder,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  ClipboardList,
  Search,
  UserCog,
  Briefcase,
  IdCard,
  X,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import {
  explorarDocumentosGerais,
  SEM_COMERCIAL_LABEL,
  type DGCliente,
} from "@/lib/crm/documentos-gerais.functions";
import { GerenciadorArquivos } from "@/components/documentos/gerenciador-arquivos";
import {
  finalizar,
  garantirFilho,
  primeiroNome,
  titulo,
  SEM_COMERCIAL_KEY,
  SEM_CORRETOR,
  SEM_CORRETOR_KEY,
  SEM_IMOB,
  SEM_IMOB_KEY,
  type Aba,
  type ModoLista,
  type OrdemChave,
  type PastaNode,
  type PastaTipo,
  type Visao,
} from "@/components/crm/documentos-gerais/helpers";
import { FiltroPesquisa } from "@/components/crm/documentos-gerais/filtro-pesquisa";
import { Paginador } from "@/components/crm/documentos-gerais/paginador";
import { CardPasta } from "@/components/crm/documentos-gerais/card-pasta";
import { CardCliente } from "@/components/crm/documentos-gerais/card-cliente";
import { FichaDialog } from "@/components/crm/documentos-gerais/ficha-dialog";

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

    for (const cm of comerciaisBase) {
      garantirComercial(`com:${cm.id}`, titulo(cm.nome));
    }

    for (const c of clientes) {
      const comKey = c.comercial_id ? `com:${c.comercial_id}` : SEM_COMERCIAL_KEY;
      const comNome = c.comercial_id ? titulo(c.comercial_nome) : SEM_COMERCIAL_LABEL;
      const com = garantirComercial(comKey, comNome);

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
    for (const b of base) garantir(`${prefix}${b.id}`, titulo(b.nome));

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
                  <span
                    className="inline-flex size-7 items-center justify-center rounded-md text-primary"
                    style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }}
                  >
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
              <span className="hidden text-xs text-muted-foreground sm:inline">Ordenar por:</span>
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
                    {titulo(comerciaisBase.find((cm) => cm.id === filtroComercial)?.nome ?? "")}
                  </span>
                )}
                {filtroImob !== "todas" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Imobiliária:{" "}
                    {filtroImob === "comercial"
                      ? SEM_IMOB
                      : titulo(imobiliariasFiltro.find((i) => i.id === filtroImob)?.nome ?? "")}
                  </span>
                )}
                {filtroCorr !== "todos" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Corretor:{" "}
                    {titulo(corretoresFiltro.find((c) => c.id === filtroCorr)?.nome ?? "")}
                  </span>
                )}
                {filtroAnalista !== "todos" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Analista:{" "}
                    {titulo(analistasFiltro.find((a) => a.id === filtroAnalista)?.nome ?? "")}
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
