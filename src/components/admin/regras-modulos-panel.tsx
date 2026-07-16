import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CATALOGO_MODULOS,
  PAPEIS_POR_PORTAL,
  listarNiveisAcesso,
  criarNivelAcesso,
  atualizarNivelAcesso,
  excluirNivelAcesso,
  salvarPermissoes,
  type AcessoTipo,
  type EscopoAlvo,
  type EscopoDados,
  type NivelAcesso,
  type PapelNivel,
} from "@/lib/admin/regras-modulos.functions";
import { listarPessoas } from "@/lib/admin/pessoas.functions";
import { listarTiposPessoa } from "@/lib/admin/tipos-pessoa.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  chave,
  estadoInicial,
  type MatrizEstado,
} from "./regras-modulos/constants";
import { AbaPapeis } from "./regras-modulos/aba-papeis";
import { ListaNiveis, MatrizPermissoes } from "./regras-modulos/matriz";
import {
  DialogEditarNivel,
  DialogExcluirNivel,
  DialogNovoNivel,
} from "./regras-modulos/dialogs-nivel";
import { DialogAlvos } from "./regras-modulos/dialog-alvos";

export function RegrasModulosPanel() {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);
  const criar = useServerFn(criarNivelAcesso);
  const atualizar = useServerFn(atualizarNivelAcesso);
  const excluir = useServerFn(excluirNivelAcesso);
  const salvar = useServerFn(salvarPermissoes);

  const { data: niveis, isLoading } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  const [subaba, setSubaba] = useState<"papeis" | "permissoes">("papeis");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<MatrizEstado>({});
  const [alvos, setAlvos] = useState<Record<string, EscopoAlvo[]>>({});
  const [alvosModulo, setAlvosModulo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const pessoasQuery = useQuery({ queryKey: ["pessoas"], queryFn: () => listarPessoas() });
  const tiposQuery = useQuery({ queryKey: ["tipos-pessoa"], queryFn: () => listarTiposPessoa() });

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [copiarDe, setCopiarDe] = useState<string>("baseline");
  const [novoPortal, setNovoPortal] = useState<AcessoTipo>("sistema");
  const [novoPapel, setNovoPapel] = useState<PapelNivel>("comercial");

  const [editarOpen, setEditarOpen] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPortal, setEditPortal] = useState<AcessoTipo>("sistema");
  const [editPapel, setEditPapel] = useState<PapelNivel>("comercial");

  const [excluirOpen, setExcluirOpen] = useState(false);

  const selecionado = useMemo(() => {
    const lista = niveis ?? [];
    return lista.find((n) => n.id === selecionadoId) ?? lista[0] ?? null;
  }, [niveis, selecionadoId]);

  const nivelKey = selecionado?.id ?? "";
  const [carregadoPara, setCarregadoPara] = useState("");
  if (selecionado && carregadoPara !== nivelKey) {
    setEstado(estadoInicial(selecionado));
    setAlvos(selecionado.alvos ?? {});
    setCarregadoPara(nivelKey);
    setDirty(false);
  }

  const criarMut = useMutation({
    mutationFn: (v: {
      nome: string;
      descricao?: string;
      copiar_de?: string;
      papel: PapelNivel;
      acesso_tipo: AcessoTipo;
    }) => criar({ data: v }),
    onSuccess: async (r) => {
      toast.success("Nível de acesso criado com permissões iniciais.");
      setNovoOpen(false);
      setNovoNome("");
      setNovaDesc("");
      setCopiarDe("baseline");
      setNovoPortal("sistema");
      setNovoPapel("comercial");
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      setSelecionadoId(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarMut = useMutation({
    mutationFn: (v: {
      id: string;
      nome: string;
      descricao?: string;
      papel: PapelNivel;
      acesso_tipo: AcessoTipo;
    }) => atualizar({ data: v }),
    onSuccess: async (r: any) => {
      toast.success("Nível atualizado.");
      setEditarOpen(false);
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      if (r?.id) {
        setSelecionadoId(r.id);
        setCarregadoPara("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: async () => {
      toast.success("Nível excluído.");
      setExcluirOpen(false);
      setSelecionadoId(null);
      setCarregadoPara("");
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarMut = useMutation({
    mutationFn: () => {
      if (!selecionado) throw new Error("Selecione um nível.");
      const permissoes = Object.entries(estado).map(([k, v]) => {
        const idx = k.indexOf(":");
        const modulo = k.slice(0, idx);
        const acao = k.slice(idx + 1);
        return { modulo, acao, permitido: v.permitido, escopo_dados: v.escopo };
      });
      const modulosPersonalizados = new Set(
        permissoes.filter((p) => p.escopo_dados === "personalizado").map((p) => p.modulo),
      );
      const alvosFiltrados: Record<string, EscopoAlvo[]> = {};
      Object.entries(alvos).forEach(([modulo, lista]) => {
        if (modulosPersonalizados.has(modulo) && lista.length) alvosFiltrados[modulo] = lista;
      });
      return salvar({
        data: { nivel_acesso_id: selecionado.id, permissoes, alvos: alvosFiltrados },
      });
    },
    onSuccess: async (r: any) => {
      toast.success("Permissões salvas.");
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      if (r?.nivel_acesso_id) {
        setSelecionadoId(r.nivel_acesso_id);
        setCarregadoPara("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editavel = selecionado?.editavel ?? false;

  function toggle(modulo: string, acao: string, permitido: boolean) {
    setEstado((prev) => ({
      ...prev,
      [chave(modulo, acao)]: { ...prev[chave(modulo, acao)], permitido },
    }));
    setDirty(true);
  }
  function setEscopo(modulo: string, escopo: EscopoDados) {
    setEstado((prev) => {
      const next = { ...prev };
      for (const a of CATALOGO_MODULOS.find((m) => m.modulo === modulo)?.acoes ?? []) {
        const k = chave(modulo, a.acao);
        next[k] = { ...next[k], escopo };
      }
      return next;
    });
    setDirty(true);
  }
  function toggleModulo(modulo: string, permitido: boolean) {
    setEstado((prev) => {
      const next = { ...prev };
      for (const a of CATALOGO_MODULOS.find((m) => m.modulo === modulo)?.acoes ?? []) {
        const k = chave(modulo, a.acao);
        next[k] = { ...next[k], permitido };
      }
      return next;
    });
    setDirty(true);
  }

  function toggleAlvo(modulo: string, alvo: EscopoAlvo, ativo: boolean) {
    setAlvos((prev) => {
      const lista = prev[modulo] ?? [];
      const filtrada = lista.filter(
        (a) =>
          !(
            a.alvo_tipo === alvo.alvo_tipo &&
            (a.alvo_id ?? null) === (alvo.alvo_id ?? null) &&
            (a.alvo_valor ?? null) === (alvo.alvo_valor ?? null)
          ),
      );
      return { ...prev, [modulo]: ativo ? [...filtrada, alvo] : filtrada };
    });
    setDirty(true);
  }

  function abrirEditar(nivel?: NivelAcesso) {
    const alvo = nivel ?? selecionado;
    if (!alvo) return;
    if (nivel) setSelecionadoId(nivel.id);
    setEditNome(alvo.nome);
    setEditDesc(alvo.descricao ?? "");
    setEditPortal(alvo.acesso_tipo);
    setEditPapel(alvo.papel);
    setEditarOpen(true);
  }

  function configurarPermissoes(id: string) {
    setSelecionadoId(id);
    setCarregadoPara("");
    setSubaba("permissoes");
  }

  function pedirExcluir(id: string) {
    setSelecionadoId(id);
    setExcluirOpen(true);
  }

  function ajustarPapel(portal: AcessoTipo, papel: PapelNivel): PapelNivel {
    const opcoes = PAPEIS_POR_PORTAL[portal].map((p) => p.value);
    return opcoes.includes(papel) ? papel : opcoes[0];
  }

  const grupos = useMemo(() => {
    const map = new Map<string, typeof CATALOGO_MODULOS>();
    for (const m of CATALOGO_MODULOS) {
      const arr = map.get(m.grupo) ?? [];
      arr.push(m);
      map.set(m.grupo, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div>
      <Tabs value={subaba} onValueChange={(v) => setSubaba(v as typeof subaba)}>
        <TabsList className="mb-6">
          <TabsTrigger value="papeis">Papéis & Funções</TabsTrigger>
          <TabsTrigger value="permissoes">Regras & Módulos</TabsTrigger>
        </TabsList>

        <TabsContent value="papeis">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-foreground">Papéis & Funções</h2>
              <p className="text-sm text-muted-foreground">
                Cadastre e configure os papéis/funções (níveis de acesso) do seu ecossistema.
              </p>
            </div>
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4" /> Novo papel
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <AbaPapeis
              niveis={niveis ?? []}
              editavel={editavel}
              onConfigurar={configurarPermissoes}
              onEditar={abrirEditar}
              onExcluir={pedirExcluir}
            />
          )}
        </TabsContent>

        <TabsContent value="permissoes">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[240px_1fr]">
              <ListaNiveis
                niveis={niveis ?? []}
                selecionadoId={selecionado?.id ?? null}
                onSelecionar={setSelecionadoId}
              />
              {selecionado ? (
                <MatrizPermissoes
                  selecionado={selecionado}
                  estado={estado}
                  alvos={alvos}
                  editavel={editavel}
                  dirty={dirty}
                  salvando={salvarMut.isPending}
                  grupos={grupos}
                  onToggle={toggle}
                  onToggleModulo={toggleModulo}
                  onSetEscopo={setEscopo}
                  onAbrirAlvos={setAlvosModulo}
                  onSalvar={() => salvarMut.mutate()}
                  onEditar={() => abrirEditar()}
                  onExcluir={() => setExcluirOpen(true)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum nível de acesso encontrado.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DialogNovoNivel
        open={novoOpen}
        onOpenChange={setNovoOpen}
        nome={novoNome}
        setNome={setNovoNome}
        desc={novaDesc}
        setDesc={setNovaDesc}
        copiarDe={copiarDe}
        setCopiarDe={setCopiarDe}
        portal={novoPortal}
        setPortal={setNovoPortal}
        papel={novoPapel}
        setPapel={setNovoPapel}
        ajustarPapel={ajustarPapel}
        niveis={niveis ?? []}
        pending={criarMut.isPending}
        onCriar={() =>
          criarMut.mutate({
            nome: novoNome.trim(),
            descricao: novaDesc.trim() || undefined,
            copiar_de: copiarDe === "baseline" ? undefined : copiarDe,
            papel: novoPapel,
            acesso_tipo: novoPortal,
          })
        }
      />

      <DialogEditarNivel
        open={editarOpen}
        onOpenChange={setEditarOpen}
        nome={editNome}
        setNome={setEditNome}
        desc={editDesc}
        setDesc={setEditDesc}
        portal={editPortal}
        setPortal={setEditPortal}
        papel={editPapel}
        setPapel={setEditPapel}
        ajustarPapel={ajustarPapel}
        pending={atualizarMut.isPending}
        onSalvar={() =>
          selecionado &&
          atualizarMut.mutate({
            id: selecionado.id,
            nome: editNome.trim(),
            descricao: editDesc.trim() || undefined,
            papel: editPapel,
            acesso_tipo: editPortal,
          })
        }
      />

      <DialogExcluirNivel
        open={excluirOpen}
        onOpenChange={setExcluirOpen}
        nome={selecionado?.nome}
        pending={excluirMut.isPending}
        onConfirmar={() => selecionado && excluirMut.mutate(selecionado.id)}
      />

      <DialogAlvos
        moduloAtivo={alvosModulo}
        onClose={() => setAlvosModulo(null)}
        alvos={alvos}
        toggleAlvo={toggleAlvo}
        tipos={(tiposQuery.data ?? []) as any}
        pessoas={(pessoasQuery.data ?? []) as any}
      />
    </div>
  );
}
