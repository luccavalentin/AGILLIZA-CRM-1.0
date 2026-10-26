"use client";

/**
 * Janelas do chat universal: nova conversa (contatos da base por seção + @ exato),
 * grupo (participantes, administradores, foto, adicionar/remover, renomear, sair),
 * leituras, encaminhar, denunciar e configurações (meu @, presença, som, aviso, bloqueados).
 */
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Camera,
  Check,
  CheckCheck,
  Crown,
  LogOut,
  Search,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  ApiChat,
  CartaoPessoa,
  Contato,
  GrupoContato,
  ItemListaConversa,
  Leitura,
  MeuArroba,
  MensagemChat,
  MotivoDenuncia,
  Participante,
  PreferenciasChat,
} from "./tipos";
import { Aviso, Avatar, Botao, Modal } from "./ui";
import {
  ORDEM_GRUPO,
  TITULO_GRUPO,
  arrobaValido,
  limparArroba,
  resumoMensagem,
  semAcento,
} from "./util";

/* --------------------------------------------------------- contatos --- */

function useContatos(api: Pick<ApiChat, "contatos">, busca: string) {
  const [contatos, setContatos] = useState<Contato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vale = true;
    const t = setTimeout(
      () => {
        void api.contatos(busca.trim().replace(/^@/, "")).then((r) => {
          if (!vale) return;
          if (r.ok) {
            setContatos(r.dados ?? []);
            setErro(null);
          } else setErro(r.mensagem);
        });
      },
      busca ? 250 : 0,
    );
    return () => {
      vale = false;
      clearTimeout(t);
    };
  }, [api, busca]);
  return { contatos, erro };
}

function chaveContato(c: Contato) {
  return c.usuario_id ?? `cli:${c.cliente_agilliza_id}`;
}

function ListaContatos({
  contatos,
  marcados,
  aoEscolher,
  varios,
  ocultar = [],
}: {
  contatos: Contato[];
  marcados: string[];
  aoEscolher: (c: Contato) => void;
  varios: boolean;
  ocultar?: string[];
}) {
  const porGrupo = useMemo(() => {
    const m = new Map<GrupoContato, Contato[]>();
    for (const c of contatos) {
      if (c.usuario_id && ocultar.includes(c.usuario_id)) continue;
      if (varios && !c.usuario_id) continue;
      const l = m.get(c.grupo) ?? [];
      l.push(c);
      m.set(c.grupo, l);
    }
    return m;
  }, [contatos, ocultar, varios]);
  const grupos = ORDEM_GRUPO.filter((g) => (porGrupo.get(g)?.length ?? 0) > 0);
  if (grupos.length === 0)
    return (
      <p className="ce-nada">Ninguém encontrado na sua base. Para quem é de fora, use o @ exato.</p>
    );
  return (
    <div className="ce-rolagem">
      {grupos.map((g) => (
        <section key={g}>
          <p className="ce-secao">{TITULO_GRUPO[g]}</p>
          <ul className="ce-contatos">
            {porGrupo.get(g)!.map((c) => {
              const k = chaveContato(c);
              const on = marcados.includes(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    className={clsx("ce-contato", on && "ce-contato-on")}
                    onClick={() => aoEscolher(c)}
                    aria-pressed={varios ? on : undefined}
                  >
                    <Avatar nome={c.nome} online={c.online} tamanho={38} />
                    <span className="ce-contato-meio">
                      <b>{c.nome}</b>
                      <small>
                        {c.arroba ? `@${c.arroba}` : ""}
                        {c.arroba && c.detalhe ? " · " : ""}
                        {c.detalhe}
                      </small>
                    </span>
                    {varios && (
                      <span className={clsx("ce-marca", on && "ce-marca-on")}>
                        {on && <Check size={14} aria-hidden />}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Procurar pelo @ exato (C02): quem tiver o @ certo, mesmo fora da base. */
function ProcurarArroba({
  api,
  aoAbrir,
}: {
  api: Pick<ApiChat, "localizarArroba" | "abrirPorArroba">;
  aoAbrir: (id: string) => void;
}) {
  const [valor, setValor] = useState("");
  const [achado, setAchado] = useState<CartaoPessoa | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const procurar = async () => {
    setErro(null);
    setAchado(undefined);
    if (!arrobaValido(valor)) {
      setErro("Digite o @ completo (de 3 a 30 caracteres).");
      return;
    }
    setIndo(true);
    const r = await api.localizarArroba(limparArroba(valor));
    setIndo(false);
    if (!r.ok) setErro(r.mensagem);
    else setAchado(r.dados ?? null);
  };
  return (
    <div className="cu-arroba-busca">
      <form
        className="ce-busca"
        onSubmit={(e) => {
          e.preventDefault();
          void procurar();
        }}
      >
        <AtSign size={16} aria-hidden />
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Procurar pelo @ exato (ex.: maria.silva)"
          aria-label="Procurar pelo @ exato"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className="ec-filtro" disabled={indo}>
          {indo ? "Procurando…" : "Procurar"}
        </button>
      </form>
      {erro && <p className="ce-erro">{erro}</p>}
      {achado === null && (
        <p className="ce-nada">Ninguém com este @. Confira com a pessoa como está escrito.</p>
      )}
      {achado && (
        <div className="cu-cartao-pessoa">
          <Avatar nome={achado.nome} tamanho={44} />
          <span className="ce-contato-meio">
            <b>{achado.nome}</b>
            <small>
              {achado.arroba ? `@${achado.arroba}` : ""} · {achado.detalhe}
            </small>
            {!achado.eu && !achado.na_base && (
              <small className="cu-nota">
                Não é da sua base: a mensagem chega como pedido, e a pessoa aceita ou não.
              </small>
            )}
          </span>
          {!achado.eu && (
            <Botao
              carregando={indo}
              onClick={async () => {
                setIndo(true);
                const r = await api.abrirPorArroba(achado.arroba ?? limparArroba(valor));
                setIndo(false);
                if (r.ok && r.dados) aoAbrir(r.dados);
                else if (!r.ok) setErro(r.mensagem);
              }}
            >
              Mandar mensagem
            </Botao>
          )}
        </div>
      )}
    </div>
  );
}

export function ModalNovaConversa({
  api,
  podeGrupo,
  aoFechar,
  aoAbrir,
}: {
  api: ApiChat;
  podeGrupo: boolean;
  aoFechar: () => void;
  aoAbrir: (id: string) => void;
}) {
  const [modo, setModo] = useState<"conversa" | "grupo">("conversa");
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const { contatos, erro: erroLista } = useContatos(api, busca.length >= 2 ? busca : "");
  const filtrados = useMemo(() => {
    const t = semAcento(busca.replace(/^@/, "").trim());
    return (contatos ?? []).filter(
      (c) => !t || semAcento(`${c.nome} ${c.arroba ?? ""} ${c.detalhe ?? ""}`).includes(t),
    );
  }, [contatos, busca]);

  const abrir = async (c: Contato) => {
    if (modo === "grupo") {
      if (!c.usuario_id) return;
      setMarcados((m) =>
        m.includes(c.usuario_id!) ? m.filter((x) => x !== c.usuario_id) : [...m, c.usuario_id!],
      );
      return;
    }
    setIndo(true);
    const r = await api.abrirCom({
      usuarioId: c.usuario_id,
      clienteAgillizaId: c.cliente_agilliza_id,
    });
    setIndo(false);
    if (r.ok && r.dados) aoAbrir(r.dados);
    else if (!r.ok) setErro(r.mensagem);
  };

  return (
    <Modal
      titulo={modo === "grupo" ? "Novo grupo" : "Nova conversa"}
      descricao="Quem é da sua base aparece aqui. Para falar com alguém de fora, procure pelo @ exato."
      onFechar={aoFechar}
      largura="md"
      rodape={
        modo === "grupo" ? (
          <Botao
            carregando={indo}
            disabled={marcados.length === 0 || !titulo.trim()}
            onClick={async () => {
              setIndo(true);
              setErro(null);
              const r = await api.criarGrupo(titulo.trim(), marcados);
              setIndo(false);
              if (r.ok && r.dados) aoAbrir(r.dados);
              else if (!r.ok) setErro(r.mensagem);
            }}
          >
            <Users size={16} aria-hidden /> Criar grupo
            {marcados.length ? ` (${marcados.length + 1})` : ""}
          </Botao>
        ) : undefined
      }
    >
      <div className="ce-escolha">
        {podeGrupo && (
          <div className="ce-modos" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={modo === "conversa"}
              className={clsx("ce-modo", modo === "conversa" && "ce-modo-on")}
              onClick={() => setModo("conversa")}
            >
              Conversa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === "grupo"}
              className={clsx("ce-modo", modo === "grupo" && "ce-modo-on")}
              onClick={() => setModo("grupo")}
            >
              Grupo
            </button>
          </div>
        )}
        {modo === "grupo" && (
          <label className="ce-campo">
            <span>Nome do grupo</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Equipe de vendas"
            />
          </label>
        )}
        {modo === "conversa" && <ProcurarArroba api={api} aoAbrir={aoAbrir} />}
        <div className="ce-busca">
          <Search size={16} aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na sua base (nome, @ ou conta)"
            aria-label="Buscar na sua base"
          />
        </div>
        {(erro || erroLista) && <p className="ce-erro">{erro ?? erroLista}</p>}
        {contatos === null ? (
          <ul className="ce-contatos" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="ce-esqueleto" />
            ))}
          </ul>
        ) : (
          <ListaContatos
            contatos={filtrados}
            marcados={marcados}
            aoEscolher={(c) => void abrir(c)}
            varios={modo === "grupo"}
          />
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ grupo --- */

export function ModalGrupo({
  api,
  conversaId,
  titulo,
  fotoUrl,
  admin,
  aoFechar,
  aoMudar,
  aoSair,
}: {
  api: ApiChat;
  conversaId: string;
  titulo: string;
  fotoUrl?: string | null;
  admin: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
  aoSair: () => void;
}) {
  const [pessoas, setPessoas] = useState<Participante[] | null>(null);
  const [nome, setNome] = useState(titulo);
  const [adicionando, setAdicionando] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const { contatos } = useContatos(api, adicionando && busca.length >= 2 ? busca : "");

  const recarregar = async () => {
    const r = await api.participantes(conversaId);
    if (r.ok) setPessoas(r.dados ?? []);
    else setErro(r.mensagem);
  };
  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId]);

  const fazer = async (p: Promise<{ ok: boolean; mensagem?: string }>) => {
    setIndo(true);
    setErro(null);
    const r = await p;
    setIndo(false);
    if (!r.ok) setErro((r as { mensagem: string }).mensagem);
    await recarregar();
    aoMudar();
    return r.ok;
  };

  return (
    <Modal
      titulo="Dados do grupo"
      descricao={`${pessoas?.length ?? "…"} participantes`}
      onFechar={aoFechar}
      largura="md"
    >
      <div className="ce-escolha">
        <div className="cu-grupo-topo">
          <button
            type="button"
            className="cu-grupo-foto sem-toque"
            disabled={!admin || indo}
            onClick={() => seletor.current?.click()}
            aria-label={admin ? "Trocar a foto do grupo" : "Foto do grupo"}
          >
            <Avatar nome={titulo} url={fotoUrl} tamanho={64} grupo />
            {admin && (
              <span className="cu-grupo-foto-icone" aria-hidden>
                <Camera size={14} />
              </span>
            )}
          </button>
          <input
            ref={seletor}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setIndo(true);
              try {
                const a = await api.enviarArquivo(conversaId, f, () => {});
                await fazer(api.fotoGrupo(conversaId, a.id));
              } catch (x) {
                setErro(x instanceof Error ? x.message : "Não foi possível trocar a foto.");
                setIndo(false);
              }
            }}
          />
          <form
            className="ce-renomear"
            onSubmit={(e) => {
              e.preventDefault();
              if (nome.trim() && nome.trim() !== titulo)
                void fazer(api.renomear(conversaId, nome.trim()));
            }}
          >
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              aria-label="Nome do grupo"
            />
            <Botao
              variante="secundario"
              type="submit"
              disabled={!nome.trim() || nome.trim() === titulo}
            >
              Renomear
            </Botao>
          </form>
        </div>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        {admin && !adicionando && (
          <button type="button" className="ce-acao" onClick={() => setAdicionando(true)}>
            <UserPlus size={16} aria-hidden /> Adicionar pessoas
          </button>
        )}
        {adicionando && (
          <>
            <div className="ce-busca">
              <Search size={16} aria-hidden />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar na sua base"
                aria-label="Buscar na sua base"
              />
            </div>
            <ListaContatos
              contatos={contatos ?? []}
              marcados={marcados}
              varios
              ocultar={(pessoas ?? []).map((p) => p.usuario_id)}
              aoEscolher={(c) =>
                c.usuario_id &&
                setMarcados((m) =>
                  m.includes(c.usuario_id!)
                    ? m.filter((x) => x !== c.usuario_id)
                    : [...m, c.usuario_id!],
                )
              }
            />
            <div className="cu-linha-botoes">
              <Botao variante="fantasma" onClick={() => (setAdicionando(false), setMarcados([]))}>
                Cancelar
              </Botao>
              <Botao
                carregando={indo}
                disabled={marcados.length === 0}
                onClick={async () => {
                  if (await fazer(api.adicionar(conversaId, marcados))) {
                    setAdicionando(false);
                    setMarcados([]);
                  }
                }}
              >
                Adicionar{marcados.length ? ` (${marcados.length})` : ""}
              </Botao>
            </div>
          </>
        )}
        <ul className="ce-contatos">
          {(pessoas ?? []).map((p) => (
            <li key={p.usuario_id} className="ce-contato ce-contato-fixo">
              <Avatar nome={p.nome} online={p.online} tamanho={38} />
              <span className="ce-contato-meio">
                <b>
                  {p.eu ? "Você" : p.nome}
                  {p.admin && <span className="ce-admin">admin</span>}
                </b>
                <small>
                  {p.arroba ? `@${p.arroba} · ` : ""}
                  {p.detalhe}
                </small>
              </span>
              {admin && !p.eu && (
                <span className="cu-acoes-pessoa">
                  <button
                    type="button"
                    className="ce-remover"
                    onClick={() => void fazer(api.definirAdmin(conversaId, p.usuario_id, !p.admin))}
                    aria-label={
                      p.admin
                        ? `Tirar ${p.nome} de administrador`
                        : `Tornar ${p.nome} administrador`
                    }
                    title={p.admin ? "Tirar de administrador" : "Tornar administrador"}
                  >
                    <Crown size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="ce-remover"
                    onClick={() => void fazer(api.remover(conversaId, p.usuario_id))}
                    aria-label={`Remover ${p.nome}`}
                    title="Remover do grupo"
                  >
                    <UserMinus size={16} aria-hidden />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ce-acao ec-menu-perigo"
          onClick={async () => {
            const r = await api.remover(conversaId, null);
            if (r.ok) aoSair();
            else setErro(r.mensagem);
          }}
        >
          <LogOut size={16} aria-hidden /> Sair do grupo
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------------------- leituras, encaminhar --- */

export function ModalLeituras({
  api,
  mensagemId,
  aoFechar,
}: {
  api: ApiChat;
  mensagemId: string;
  aoFechar: () => void;
}) {
  const [lista, setLista] = useState<Leitura[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    void api
      .leituras(mensagemId)
      .then((r) => (r.ok ? setLista(r.dados ?? []) : setErro(r.mensagem)));
  }, [api, mensagemId]);
  return (
    <Modal titulo="Dados da mensagem" onFechar={aoFechar} largura="sm">
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      <ul className="ce-contatos">
        {(lista ?? []).map((l, i) => (
          <li key={i} className="ce-contato ce-contato-fixo">
            <Avatar nome={l.nome} tamanho={34} />
            <span className="ce-contato-meio">
              <b>{l.nome}</b>
              <small>
                {l.lida && l.lido_em
                  ? `Leu ${new Date(l.lido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : l.entregue
                    ? "Recebeu"
                    : "Ainda não recebeu"}
              </small>
            </span>
            {l.lida ? (
              <CheckCheck size={16} className="ec-visto-lida" aria-label="lida" />
            ) : l.entregue ? (
              <CheckCheck size={16} aria-label="entregue" />
            ) : (
              <Check size={16} aria-label="enviada" />
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function ModalEncaminhar({
  m,
  conversas,
  aoFechar,
  aoConcluir,
}: {
  m: MensagemChat;
  conversas: ItemListaConversa[];
  aoFechar: () => void;
  aoConcluir: (destinos: string[]) => void;
}) {
  const [marcados, setMarcados] = useState<string[]>([]);
  return (
    <Modal
      titulo="Encaminhar para…"
      descricao={resumoMensagem(m).slice(0, 80)}
      onFechar={aoFechar}
      largura="sm"
      rodape={
        <Botao onClick={() => aoConcluir(marcados)} disabled={marcados.length === 0}>
          Encaminhar{marcados.length ? ` (${marcados.length})` : ""}
        </Botao>
      }
    >
      {conversas.length === 0 ? (
        <p className="ce-nada">Você não tem outra conversa para encaminhar.</p>
      ) : (
        <ul className="ec-encaminhar">
          {conversas.map((c) => {
            const on = marcados.includes(c.id);
            return (
              <li key={c.id}>
                <label className={clsx(on && "ec-encaminhar-on")}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && marcados.length >= 5}
                    onChange={() =>
                      setMarcados((x) => (on ? x.filter((y) => y !== c.id) : [...x, c.id]))
                    }
                  />
                  <Avatar
                    nome={c.contraparte ?? "?"}
                    url={c.foto_url}
                    tamanho={34}
                    grupo={c.grupo}
                  />
                  <span className="cu-min0">
                    <b>{c.contraparte}</b>
                    <small>{c.detalhe}</small>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="cu-nota">Até 5 conversas. A mensagem chega marcada como encaminhada.</p>
    </Modal>
  );
}

/* --------------------------------------------------------- denunciar --- */

const MOTIVOS: { v: MotivoDenuncia; r: string }[] = [
  { v: "spam", r: "Spam ou propaganda" },
  { v: "golpe", r: "Golpe ou fraude" },
  { v: "assedio", r: "Assédio ou ameaça" },
  { v: "ofensa", r: "Ofensa ou discurso de ódio" },
  { v: "perfil_falso", r: "Perfil falso" },
  { v: "conteudo_improprio", r: "Conteúdo impróprio" },
  { v: "outro", r: "Outro motivo" },
];

export function ModalDenunciar({
  alvo,
  aoFechar,
  aoConcluir,
}: {
  alvo: string;
  aoFechar: () => void;
  aoConcluir: (
    motivo: MotivoDenuncia,
    detalhe: string,
    bloquear: boolean,
  ) => Promise<string | null>;
}) {
  const [motivo, setMotivo] = useState<MotivoDenuncia>("spam");
  const [detalhe, setDetalhe] = useState("");
  const [bloquear, setBloquear] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  return (
    <Modal
      titulo="Denunciar"
      descricao={`${alvo}. A equipe da plataforma analisa; a pessoa não fica sabendo quem denunciou.`}
      onFechar={aoFechar}
      largura="sm"
      rodape={
        <Botao
          variante="perigo"
          carregando={indo}
          onClick={async () => {
            setIndo(true);
            setErro(await aoConcluir(motivo, detalhe, bloquear));
            setIndo(false);
          }}
        >
          Enviar denúncia
        </Botao>
      }
    >
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      <div className="cu-opcoes" role="radiogroup" aria-label="Motivo">
        {MOTIVOS.map((m) => (
          <label key={m.v} className={clsx("cu-opcao", motivo === m.v && "cu-opcao-on")}>
            <input
              type="radio"
              name="motivo"
              checked={motivo === m.v}
              onChange={() => setMotivo(m.v)}
            />
            {m.r}
          </label>
        ))}
      </div>
      <label className="ce-campo">
        <span>Conte o que aconteceu {motivo === "outro" ? "(obrigatório)" : "(opcional)"}</span>
        <textarea
          className="ec-campo-form"
          rows={3}
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
          maxLength={1000}
        />
      </label>
      <label className="cu-checar">
        <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} />{" "}
        Bloquear também
      </label>
    </Modal>
  );
}

/* ---------------------------------------------------- configurações --- */

export function ModalConfiguracoes({ api, aoFechar }: { api: ApiChat; aoFechar: () => void }) {
  const [prefs, setPrefs] = useState<PreferenciasChat | null>(null);
  const [meu, setMeu] = useState<MeuArroba | null>(null);
  const [novo, setNovo] = useState("");
  const [livre, setLivre] = useState<{ livre: boolean; motivo?: string } | null>(null);
  const [bloqueados, setBloqueados] = useState<Participante[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    void api.preferencias().then((r) => r.ok && setPrefs(r.dados ?? null));
    void api.meuArroba().then((r) => r.ok && setMeu(r.dados ?? null));
    void api.bloqueados().then((r) => r.ok && setBloqueados(r.dados ?? []));
  }, [api]);

  useEffect(() => {
    setLivre(null);
    if (!arrobaValido(novo) || limparArroba(novo) === meu?.arroba) return;
    const t = setTimeout(() => {
      void api.arrobaDisponivel(limparArroba(novo)).then((r) => r.ok && setLivre(r.dados ?? null));
    }, 450);
    return () => clearTimeout(t);
  }, [api, novo, meu?.arroba]);

  const salvar = async (p: Partial<PreferenciasChat>) => {
    setPrefs((x) => (x ? { ...x, ...p } : x));
    const r = await api.salvarPreferencias(p);
    if (r.ok && r.dados) setPrefs(r.dados);
    else if (!r.ok) setErro(r.mensagem);
  };

  return (
    <Modal titulo="Configurações do chat" onFechar={aoFechar} largura="md">
      <div className="ce-escolha">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        {ok && <Aviso tom="sucesso">{ok}</Aviso>}
        <section className="cu-config-bloco">
          <p className="ce-secao">Seu @</p>
          <p className="cu-meu-arroba">@{meu?.arroba ?? "…"}</p>
          <p className="cu-nota">
            É por ele que qualquer pessoa do ecossistema acha você. Trocar libera o antigo só depois
            de 30 dias (ninguém se passa por você).
          </p>
          {meu?.pode_trocar_em ? (
            <p className="cu-nota">
              Você poderá trocar de novo em{" "}
              {new Date(meu.pode_trocar_em).toLocaleDateString("pt-BR")}.
            </p>
          ) : (
            <form
              className="ce-renomear"
              onSubmit={async (e) => {
                e.preventDefault();
                setErro(null);
                setOk(null);
                setIndo(true);
                const r = await api.trocarArroba(limparArroba(novo));
                setIndo(false);
                if (!r.ok) setErro(r.mensagem);
                else if (r.dados?.erro) setErro(r.dados.erro);
                else {
                  setMeu(r.dados ?? null);
                  setNovo("");
                  setOk("Pronto! Seu @ mudou.");
                }
              }}
            >
              <input
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                placeholder="novo.arroba"
                aria-label="Novo @"
                maxLength={31}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <Botao
                type="submit"
                variante="secundario"
                carregando={indo}
                disabled={!arrobaValido(novo) || livre?.livre === false}
              >
                Trocar
              </Botao>
            </form>
          )}
          {novo && !arrobaValido(novo) && (
            <p className="cu-nota">
              De 3 a 30 caracteres: letras sem acento, números, ponto (não no fim nem dois seguidos)
              ou sublinhado.
            </p>
          )}
          {livre && (
            <p className={clsx("cu-nota", livre.livre ? "cu-ok" : "cu-ruim")}>
              {livre.livre ? "Disponível" : (livre.motivo ?? "Indisponível")}
            </p>
          )}
        </section>

        <section className="cu-config-bloco">
          <p className="ce-secao">Privacidade e avisos</p>
          <label className="cu-checar">
            <input
              type="checkbox"
              checked={Boolean(prefs?.ocultar_presenca)}
              onChange={(e) => void salvar({ ocultar_presenca: e.target.checked })}
            />
            Ocultar "online" e "visto por último" (e você também não vê o dos outros)
          </label>
          <label className="cu-checar">
            <input
              type="checkbox"
              checked={prefs?.aviso_flutuante ?? true}
              onChange={(e) => void salvar({ aviso_flutuante: e.target.checked })}
            />
            Mostrar o aviso de mensagem nova nas outras telas
          </label>
          <label className="cu-checar">
            <input
              type="checkbox"
              checked={prefs?.som ?? true}
              onChange={(e) => void salvar({ som: e.target.checked })}
            />
            Tocar som quando chegar mensagem
          </label>
        </section>

        <section className="cu-config-bloco">
          <p className="ce-secao">Bloqueados</p>
          {bloqueados && bloqueados.length === 0 && <p className="ce-nada">Ninguém bloqueado.</p>}
          <ul className="ce-contatos">
            {(bloqueados ?? []).map((b) => (
              <li key={b.usuario_id} className="ce-contato ce-contato-fixo">
                <Avatar nome={b.nome} tamanho={34} />
                <span className="ce-contato-meio">
                  <b>{b.nome}</b>
                  <small>{b.arroba ? `@${b.arroba}` : b.detalhe}</small>
                </span>
                <button
                  type="button"
                  className="ce-remover"
                  onClick={async () => {
                    const r = await api.desbloquear(b.usuario_id);
                    if (r.ok)
                      setBloqueados((l) => (l ?? []).filter((x) => x.usuario_id !== b.usuario_id));
                    else setErro(r.mensagem);
                  }}
                  aria-label={`Desbloquear ${b.nome}`}
                  title="Desbloquear"
                >
                  <ShieldOff size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
