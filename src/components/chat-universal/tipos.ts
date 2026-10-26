/**
 * Chat universal (pedido de 26/10/2026: T01, T02, T60, C01, C02, C14) — formas e contrato.
 *
 * Esta pasta é PORTÁVEL: a mesma cópia roda no Agilliza Tech (Next) e no Agilliza
 * correspondente (TanStack Start). Nada aqui importa do app; quem fala com o servidor é o
 * adaptador `ApiChat`, que cada app monta com as próprias ações (no Tech, Server Actions com
 * a sessão; no Agilliza, server functions pela ponte). As regras (quem vê, quem escreve,
 * pedido de mensagem, bloqueio) moram TODAS no banco — a tela só desenha.
 *
 * Ao mudar algo aqui, copie a pasta inteira para o outro repositório (Tech:
 * apps/web/src/components/chat-universal; Agilliza: src/components/chat-universal, que tem
 * também `chat-base.css`, a cópia do `especialistas/chat.css` do Tech).
 */

export type Resposta<T = undefined> = { ok: true; dados?: T } | { ok: false; mensagem: string };

export type AnexoChat = {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
  largura?: number;
  altura?: number;
  /** Endereço curto e assinado, posto pelo servidor. */
  url?: string;
};

export type ReacaoChat = { emoji: string; total: number; minha: boolean };

export type MensagemChat = {
  id: string;
  tipo: "texto" | "imagem" | "arquivo" | "audio" | "sistema" | "orcamento" | "recibo";
  lado: "cliente" | "especialista";
  corpo: string | null;
  anexos: AnexoChat[];
  duracao_ms: number | null;
  meu: boolean;
  autor: string | null;
  encaminhada: boolean;
  editada: boolean;
  apagada: boolean;
  fixada?: boolean;
  /** Mensagem trazida do chat antigo do Agilliza (com o anexo antigo referenciado). */
  legado?: {
    origem?: string;
    anexo?: { bucket?: string; caminho?: string; nome?: string; mime?: string };
  } | null;
  criado_em: string;
  pode_editar: boolean;
  pode_apagar_todos: boolean;
  responde: {
    id: string;
    tipo: string;
    autor: string | null;
    meu: boolean;
    corpo: string | null;
    apagada: boolean;
  } | null;
  reacoes: ReacaoChat[];
  status: "enviada" | "entregue" | "lida" | null;
  /** Só na tela: ainda subindo (otimista) ou falhou. */
  local?: "enviando" | "falhou";
};

export type CabecalhoConversa = {
  id: string;
  contraparte: string | null;
  detalhe: string | null;
  arroba?: string | null;
  foto_midia_id: string | null;
  foto_url?: string | null;
  visto_em: string | null;
  online: boolean;
  fixada: boolean;
  arquivada: boolean;
  silenciada_ate: string | null;
  grupo?: boolean;
  admin?: boolean;
  escopo?: "conta" | "universal" | "imobnet" | "imobmatch";
  outro_id?: string | null;
};

export type PaginaConversa = {
  conversa: CabecalhoConversa;
  mensagens: MensagemChat[];
  tem_mais: boolean;
};

export type ItemListaConversa = {
  id: string;
  contraparte: string | null;
  detalhe: string | null;
  arroba?: string | null;
  foto_midia_id: string | null;
  foto_url?: string | null;
  fixada: boolean;
  arquivada: boolean;
  silenciada: boolean;
  nao_lida_manual?: boolean;
  pedido?: "enviado" | null;
  ultima_em: string;
  online: boolean;
  nao_lidas: number;
  ultima: Omit<MensagemChat, "reacoes" | "responde"> | null;
  grupo?: boolean;
  escopo?: string;
  outro_id?: string | null;
};

export type ResumoConversas = { arquivadas: number; nao_lidas: number; pedidos?: number };

export type ExtraConversa = {
  escopo: string;
  grupo: boolean;
  outro_id: string | null;
  arroba: string | null;
  bloqueado: boolean;
  eu_bloqueei: boolean;
  pedido: "recebido" | "enviado" | null;
  pode_escrever: boolean;
  foto_midia_id: string | null;
  foto_url?: string | null;
  fixadas: {
    id: string;
    tipo: string;
    corpo: string | null;
    autor: string | null;
    meu: boolean;
    fixada_em: string;
  }[];
};

/** Seções de contatos (o banco decide quem entra em cada uma). */
export type GrupoContato =
  | "equipe"
  | "clientes"
  | "correspondente"
  | "parceiros"
  | "clientes_agilliza"
  | "sua_base"
  | "assinantes"
  | "imobnet";

export type Contato = {
  usuario_id: string | null;
  /** Cliente do Agilliza ainda sem espelho (a equipe do correspondente abre por aqui). */
  cliente_agilliza_id?: string | null;
  nome: string;
  arroba?: string | null;
  detalhe: string | null;
  tipo?: string;
  grupo: GrupoContato;
  online?: boolean;
};

export type CartaoPessoa = {
  usuario_id: string;
  nome: string;
  arroba: string | null;
  detalhe: string | null;
  tipo: string;
  eu: boolean;
  na_base: boolean;
};

export type Pedido = {
  id: string;
  ultima_em: string;
  de: { usuario_id: string; nome: string; arroba: string | null; detalhe: string | null };
  ultima: Omit<MensagemChat, "reacoes" | "responde"> | null;
  total: number;
};

export type Participante = {
  usuario_id: string;
  nome: string;
  arroba?: string | null;
  detalhe: string | null;
  admin: boolean;
  eu: boolean;
  online: boolean;
};

export type Leitura = { nome: string; lida: boolean; entregue: boolean; lido_em: string | null };

export type Achado = {
  id: string;
  conversa_id?: string;
  corpo: string;
  criado_em: string;
  autor: string | null;
  meu: boolean;
  contraparte?: string | null;
  grupo?: boolean;
};

export type PreferenciasChat = {
  ocultar_presenca: boolean;
  som: boolean;
  aviso_flutuante: boolean;
};

export type MeuArroba = {
  arroba: string | null;
  trocado_em?: string | null;
  pode_trocar_em?: string | null;
  troca_dias?: number;
  erro?: string;
};

export type PreviaLink = {
  url: string;
  dominio: string;
  titulo: string | null;
  descricao: string | null;
};

export type AvisoNovo = {
  conversa_id: string;
  mensagem_id: string;
  total: number;
  de: string | null;
  de_id: string | null;
  grupo: string | null;
  tipo: string;
  criado_em: string;
};

export type Avisos = {
  agora: string;
  nao_lidas: number;
  pedidos: number;
  novas: AvisoNovo[];
  pedidos_novos: { conversa_id: string; de: string; arroba: string | null; criado_em: string }[];
  som: boolean;
  aviso: boolean;
  nao_perturbe: boolean;
};

export type AcaoPreferencia =
  "fixar" | "desafixar" | "arquivar" | "desarquivar" | "silenciar" | "reativar_som" | "limpar";

export type MotivoDenuncia =
  "spam" | "assedio" | "golpe" | "ofensa" | "perfil_falso" | "conteudo_improprio" | "outro";

/** Evento de tempo real repassado ao chat (no Tech, o cano /api/eventos; no Agilliza, não há). */
/**
 * Peça 3D do anfitrião (o padrão visual de cada sistema: `Bloco3D` no Tech, `Icone3D` no
 * Agilliza). Sem ela, a pasta desenha o ícone em traço fino.
 */
export type DesenharIcone3D = (
  icone: import("lucide-react").LucideIcon,
  tamanho: "md" | "lg" | "xl",
  tom?: "marca" | "sucesso" | "alerta" | "info",
) => import("react").ReactNode;

export type EventoChat =
  | {
      tipo: "chat";
      conversa_id?: string;
      acao?: string;
      autor?: string;
      quem?: string;
      mensagem_id?: string;
    }
  | { tipo: "digitando"; conversa_id: string; quem?: string };

/**
 * O que a tela precisa do servidor. Cada app implementa; todo método devolve `Resposta`
 * (nunca lança para a tela), exceto o envio de arquivo (que rejeita com a mensagem).
 */
export interface ApiChat {
  listar(
    arquivadas: boolean,
    busca: string,
  ): Promise<Resposta<{ conversas: ItemListaConversa[]; resumo: ResumoConversas }>>;
  carregar(conversaId: string, antes?: string | null): Promise<Resposta<PaginaConversa>>;
  desde(conversaId: string, desde: string): Promise<Resposta<MensagemChat[]>>;
  unica(mensagemId: string): Promise<Resposta<MensagemChat>>;
  extra(conversaId: string): Promise<Resposta<ExtraConversa>>;
  enviar(
    conversaId: string,
    corpo: string,
    opcoes: {
      anexos?: { id: string; largura?: number; altura?: number }[];
      duracaoMs?: number | null;
      respondeA?: string | null;
      chave?: string;
    },
  ): Promise<Resposta<string>>;
  editar(mensagemId: string, corpo: string): Promise<Resposta>;
  apagar(mensagemId: string, paraTodos: boolean): Promise<Resposta>;
  reagir(mensagemId: string, emoji: string): Promise<Resposta>;
  encaminhar(mensagemId: string, destinos: string[]): Promise<Resposta<number>>;
  fixar(mensagemId: string, fixar: boolean): Promise<Resposta>;
  marcarLida(conversaId: string): Promise<Resposta>;
  marcarNaoLida(conversaId: string): Promise<Resposta>;
  marcarEntregues(): Promise<void>;
  presenca(): Promise<void>;
  digitando(conversaId: string): Promise<void>;
  preferencia(conversaId: string, acao: AcaoPreferencia, horas?: number | null): Promise<Resposta>;
  buscarNaConversa(conversaId: string, termo: string): Promise<Resposta<Achado[]>>;
  buscarGlobal(termo: string): Promise<Resposta<Achado[]>>;
  contatos(busca: string): Promise<Resposta<Contato[]>>;
  localizarArroba(arroba: string): Promise<Resposta<CartaoPessoa | null>>;
  abrirCom(alvo: {
    usuarioId?: string | null;
    clienteAgillizaId?: string | null;
  }): Promise<Resposta<string>>;
  abrirPorArroba(arroba: string): Promise<Resposta<string>>;
  pedidos(): Promise<Resposta<Pedido[]>>;
  responderPedido(conversaId: string, acao: "aceitar" | "recusar" | "bloquear"): Promise<Resposta>;
  criarGrupo(titulo: string, usuarios: string[]): Promise<Resposta<string>>;
  participantes(conversaId: string): Promise<Resposta<Participante[]>>;
  adicionar(conversaId: string, usuarios: string[]): Promise<Resposta<number>>;
  remover(conversaId: string, usuarioId: string | null): Promise<Resposta>;
  renomear(conversaId: string, titulo: string): Promise<Resposta>;
  definirAdmin(conversaId: string, usuarioId: string, admin: boolean): Promise<Resposta>;
  fotoGrupo(conversaId: string, midiaId: string | null): Promise<Resposta>;
  leituras(mensagemId: string): Promise<Resposta<Leitura[]>>;
  bloquear(usuarioId: string): Promise<Resposta>;
  desbloquear(usuarioId: string): Promise<Resposta>;
  bloqueados(): Promise<Resposta<(Participante & { desde?: string })[]>>;
  denunciar(d: {
    conversaId: string | null;
    mensagemId: string | null;
    motivo: MotivoDenuncia;
    detalhe?: string;
    bloquear?: boolean;
  }): Promise<Resposta>;
  preferencias(): Promise<Resposta<PreferenciasChat>>;
  salvarPreferencias(p: Partial<PreferenciasChat>): Promise<Resposta<PreferenciasChat>>;
  meuArroba(): Promise<Resposta<MeuArroba>>;
  arrobaDisponivel(arroba: string): Promise<Resposta<{ livre: boolean; motivo?: string }>>;
  trocarArroba(arroba: string): Promise<Resposta<MeuArroba>>;
  /** Sobe um arquivo para a conversa e devolve o anexo registrado (rejeita com a mensagem). */
  enviarArquivo(
    conversaId: string,
    arquivo: File,
    aoProgresso: (p: number) => void,
  ): Promise<AnexoChat>;
  previaLink?(url: string): Promise<Resposta<PreviaLink | null>>;
  /** Anexo do chat antigo do Agilliza (só lá existe). */
  abrirAnexoAntigo?(mensagemId: string): Promise<Resposta<string>>;
  avisos(desde: string | null): Promise<Resposta<Avisos>>;
  ocultarAviso(conversas: string[]): Promise<Resposta>;
}

export const TETO_ANEXO_BYTES = 16 * 1024 * 1024;

export const MIMES_CONVERSA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
