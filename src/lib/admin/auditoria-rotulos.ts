/**
 * Rótulos da Auditoria — usados pela tela e pelo servidor.
 *
 * O servidor precisa dos mesmos rótulos para buscar pelo texto que a tela
 * mostra: procurar "Criou cliente" ou "Pessoas" não achava nada, porque a
 * busca só olhava os códigos crus ("cliente.criar", "profiles") — QA 20/10.
 */

/** Rótulo legível para cada tipo de ação registrada. */
export const ACAO_LABEL: Record<string, string> = {
  "cliente.criar": "Criou cliente",
  "cliente.atualizar": "Atualizou cliente",
  "cliente.excluir": "Excluiu cliente",
  "documento.anexar": "Anexou documento",
  "documento.editar": "Editou documento",
  "documento.excluir": "Excluiu documento",
  "documento.aprovar": "Aprovou documento",
  "documento.reprovar": "Reprovou documento",
  "documento.solicitar_correcao": "Pediu correção de documento",
  "documento_pasta.criar": "Criou pasta",
  "documento_pasta.renomear": "Renomeou pasta",
  "documento_pasta.excluir": "Excluiu pasta",
  "proposta.replicar": "Replicou proposta",
  "proposta.excluir": "Excluiu proposta",
  "proposta.excluir_definitivamente": "Excluiu proposta definitivamente",
  "proposta.enviar": "Enviou proposta",
  "proposta.enviar_banco": "Enviou proposta ao banco",
  "proposta.documentos_enviados": "Enviou documentos da proposta",
  "simulacao.enviar_banco": "Enviou simulação ao banco",
  "demanda.mensagem": "Escreveu na demanda",
  "demanda.participante_adicionado": "Adicionou participante na demanda",
  "chat.conversa.arquivar": "Arquivou conversa",
  "chat.conversa.desarquivar": "Desarquivou conversa",
  "chat.etiquetas.definir": "Definiu etiquetas da conversa",
  "chat.mensagem.editar": "Editou mensagem",
  "chat.mensagem.excluir": "Excluiu mensagem",
  "chat.meta.salvar": "Salvou dados da conversa",
  "chat.participante.adicionar": "Adicionou participante na conversa",
  "chat.participante.remover": "Removeu participante da conversa",
  "conciliacao.processar": "Processou conciliação",
  "conciliacao.excluir": "Excluiu conciliação",
  "pessoa.criar": "Cadastrou pessoa",
  "pessoa.atualizar": "Atualizou pessoa",
  "pessoa.excluir": "Excluiu pessoa",
  "pessoa.ativar": "Ativou pessoa",
  "pessoa.desativar": "Desativou pessoa",
  "pessoa.habilitar_login": "Habilitou login da pessoa",
  "pessoa.resetar_senha": "Redefiniu senha da pessoa",
  "pessoa.alterar_email": "Trocou e-mail da pessoa",
  "nivel_acesso.criar": "Criou papel de acesso",
  "nivel_acesso.atualizar": "Atualizou papel de acesso",
  "nivel_acesso.excluir": "Excluiu papel de acesso",
  "nivel_acesso.personalizar": "Personalizou papel de acesso",
  "nivel_acesso.salvar_permissoes": "Salvou permissões",
  "nivel_acesso.personalizar_permissoes": "Personalizou permissões",
  "rh.funcionario.criar": "Cadastrou funcionário",
  "rh.funcionario.atualizar": "Atualizou funcionário",
  "rh.funcionario.desligar": "Desligou funcionário",
  "rh.funcionario.excluir": "Excluiu funcionário",
};

/** Verbo no passado para o último pedaço do código, quando a ação não tem rótulo próprio. */
const VERBO: Record<string, string> = {
  criar: "Criou",
  cadastrar: "Cadastrou",
  atualizar: "Atualizou",
  editar: "Editou",
  excluir: "Excluiu",
  remover: "Removeu",
  adicionar: "Adicionou",
  anexar: "Anexou",
  aprovar: "Aprovou",
  reprovar: "Reprovou",
  enviar: "Enviou",
  arquivar: "Arquivou",
  desarquivar: "Desarquivou",
  salvar: "Salvou",
  definir: "Definiu",
  processar: "Processou",
  renomear: "Renomeou",
  ativar: "Ativou",
  desativar: "Desativou",
  gerar: "Gerou",
  baixar: "Baixou",
  exportar: "Exportou",
  importar: "Importou",
  restaurar: "Restaurou",
  cancelar: "Cancelou",
};

/** Ação sem rótulo: "backup.gerar" → "Gerou backup"; senão, o código em palavras. */
export function rotuloAcao(acao: string): string {
  const proprio = ACAO_LABEL[acao];
  if (proprio) return proprio;
  const partes = acao.split(".").filter(Boolean);
  const verbo = VERBO[partes[partes.length - 1] ?? ""];
  if (verbo && partes.length > 1) {
    return `${verbo} ${partes.slice(0, -1).join(" ").replace(/_/g, " ")}`;
  }
  const t = acao.replace(/[._]/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
}

/**
 * Mapeia o nome interno da entidade (tabela / recurso) para o nome da tela
 * correspondente no sistema, para exibição amigável na Auditoria.
 */
export const ENTIDADE_LABEL: Record<string, string> = {
  clientes: "CRM · Clientes",
  cliente: "CRM · Clientes",
  cliente_documentos: "CRM · Documentos do cliente",
  cliente_documento_pastas: "CRM · Pastas de documentos",
  cliente_interacoes: "CRM · Interações",
  cliente_pipeline: "CRM · Esteira",
  cliente_app_mensagens: "CRM · Mensagens do app do cliente",
  crm_chat_cliente_etiquetas: "CRM · Etiquetas do chat",
  crm_chat_meta: "CRM · Dados do chat",
  crm_chat_participantes: "CRM · Participantes do chat",
  cnh: "CRM · Leitura de CNH",
  propostas: "Operacional · Propostas",
  proposta_bancos: "Operacional · Propostas (Banco)",
  proposta_documentos: "Operacional · Documentos da proposta",
  simulacoes: "Operacional · Simulações",
  simulacao_bancos: "Operacional · Simulações (Banco)",
  tasks: "Operacional · Tarefas",
  demandas: "Operacional · Demandas",
  conciliacao_lotes: "Operacional · Conciliação",
  profiles: "Configurações gerais · Pessoas",
  access_levels: "Configurações gerais · Papéis de acesso",
  permissions: "Configurações gerais · Permissões",
  tipos_pessoa: "Configurações gerais · Tipos de pessoa",
  banco_credenciais: "Configurações gerais · Bancos",
  admin_api_integrations: "Configurações gerais · APIs de IA",
  parametros_globais: "Configurações gerais · Parâmetros",
  financial_payables: "Financeiro · Contas a pagar",
  financial_receivables: "Financeiro · Contas a receber",
  comissao_regras: "Financeiro · Regras de repasse",
  comissao_regras_usuario: "Financeiro · Regras de comissão",
  comissoes: "Financeiro · Repasses",
  comissoes_usuario: "Financeiro · Comissões",
  rh_funcionarios: "RH · Funcionários",
};

export function rotuloEntidade(entidade: string | null | undefined): string {
  if (!entidade) return "—";
  return ENTIDADE_LABEL[entidade] ?? entidade.replace(/[._]/g, " ");
}

/** Comparação sem acento e sem caixa, para a busca pelos rótulos. */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
