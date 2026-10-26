-- Simular na base de um assinante (pedido do dono de 26/10/2026, C29).
--
-- A simulação feita no Agilliza para um assinante guarda a conta de destino: é por ela que a tela
-- mostra "Feita para <conta>" e oferece "Levar de novo à conta" quando a cópia não nasceu (a ponte
-- estava fora, por exemplo). Quem cria a cópia na conta é o Agilliza Tech (0318, pela ponte);
-- aqui fica só a marca, sem chave estrangeira (a conta mora nos esquemas do Agilliza Tech).
-- A coluna segue as políticas de linha que a tabela já tem (nada novo aberto).

alter table public.simulacoes add column if not exists conta_assinante_id uuid;
alter table public.simulacoes add column if not exists conta_assinante_nome text;
alter table public.simulacoes add column if not exists conta_assinante_simulacao_id uuid;
comment on column public.simulacoes.conta_assinante_id is
  'Conta (licença) do Agilliza Tech para a qual a simulação foi feita (C29). Nulo = sua base.';
comment on column public.simulacoes.conta_assinante_simulacao_id is
  'Cópia da simulação na conta do assinante (operacional.simulacoes), quando já criada.';
create index if not exists simulacoes_conta_assinante on public.simulacoes (conta_assinante_id)
  where conta_assinante_id is not null;
