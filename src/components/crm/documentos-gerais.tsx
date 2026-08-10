import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  IdCard,
  Trash2,
  FolderKanban,
  UserCog,
  Users2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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
import { Paginador } from "@/components/crm/documentos-gerais/paginador";
import { CardPasta } from "@/components/crm/documentos-gerais/card-pasta";
import { CardCliente } from "@/components/crm/documentos-gerais/card-cliente";
import { DocumentosHero } from "@/components/crm/documentos-gerais/hero";
import { IconePasta } from "@/components/crm/documentos-gerais/icone-pasta";
import { FichaClienteView } from "@/components/crm/documentos-gerais/ficha-cliente-view";
import { FiltrosBar } from "@/components/crm/documentos-gerais/filtros-bar";
import { SecaoHeader } from "@/components/crm/documentos-gerais/secao-header";
import { FaixaSeguranca } from "@/components/crm/documentos-gerais/faixa-seguranca";
import { SheetFiltrosAvancados } from "@/components/crm/documentos-gerais/sheet-filtros-avancados";

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

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      const matchBusca =
        !q ||
        c.nome.toLowerCase().includes(q) ||
        (c.numero_cliente ?? "").toLowerCase().includes(q) ||
        (c.documento ?? "").includes(q);
      const matchComercial = filtroComercial === "todos" || c.comercial_id === filtroComercial;
      const matchImob =
        filtroImob === "todas"
          ? true
          : filtroImob === "comercial"
            ? !c.imobiliaria_id
            : c.imobiliaria_id === filtroImob;
      const matchCorr = filtroCorr === "todos" || c.corretor_id === filtroCorr;
      const matchAnalista = filtroAnalista === "todos" || c.analista_id === filtroAnalista;
      return matchBusca && matchComercial && matchImob && matchCorr && matchAnalista;
    });
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
      const id = dim === "imob" ? c.imobiliaria_id : dim === "corr" ? c.corretor_id : c.analista_id;
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

  // ===== Ficha do cliente selecionado =====
  if (cliente) {
    return (
      <FichaClienteView
        cliente={cliente}
        fichaAberta={fichaAberta}
        onVoltar={() => setCliente(null)}
        onAbrirFicha={() => setFichaAberta(true)}
        onFecharFicha={setFichaAberta}
      />
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
          : (trilha[trilha.length - 1]?.nome ?? "Pastas");

  return (
    <div className="space-y-5">
      <DocumentosHero kpis={kpis} onTrocarAba={trocarAba} />

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
              Documentos e pastas removidos aparecerão aqui por 30 dias antes da exclusão
              definitiva.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <FiltrosBar
            busca={busca}
            onBusca={setBusca}
            filtroComercial={filtroComercial}
            setFiltroComercial={setFiltroComercial}
            filtroImob={filtroImob}
            setFiltroImob={setFiltroImob}
            filtroCorr={filtroCorr}
            setFiltroCorr={setFiltroCorr}
            filtroAnalista={filtroAnalista}
            setFiltroAnalista={setFiltroAnalista}
            comerciais={comerciaisBase}
            imobiliarias={imobiliariasFiltro}
            corretores={corretoresFiltro}
            analistas={analistasFiltro}
            filtrando={filtrando}
            onLimpar={limparFiltros}
            onAbrirSheet={() => setFiltrosSheet(true)}
            onPagina={setPagina}
          />

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

          <SecaoHeader
            titulo={secaoTitulo}
            total={totalItens}
            ordem={ordem}
            setOrdem={setOrdem}
            modo={modo}
            setModo={setModo}
          />

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

          {totalItens > POR_PAGINA && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Mostrando {inicio + 1} a {Math.min(inicio + POR_PAGINA, totalItens)} de {totalItens}{" "}
                itens
              </p>
              <Paginador pagina={paginaAtual} totalPaginas={totalPaginas} onIr={setPagina} />
            </div>
          )}
        </>
      )}

      <FaixaSeguranca />

      <SheetFiltrosAvancados
        open={filtrosSheet}
        onOpenChange={setFiltrosSheet}
        filtroComercial={filtroComercial}
        filtroImob={filtroImob}
        filtroCorr={filtroCorr}
        filtroAnalista={filtroAnalista}
        comerciais={comerciaisBase}
        imobiliarias={imobiliariasFiltro}
        corretores={corretoresFiltro}
        analistas={analistasFiltro}
        filtrando={filtrando}
        onLimpar={limparFiltros}
      />

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
