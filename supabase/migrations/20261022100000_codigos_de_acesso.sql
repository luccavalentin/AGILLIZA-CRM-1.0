-- Códigos de acesso (pedido do dono, 22/10/2026).
--
-- Substitui o antigo "Gerenciador de E-mail" de forma mais simples: em vez de
-- reencaminhar por e-mail o código que o banco manda para a caixa da equipe (o
-- reencaminhamento era a principal causa de bloqueio da caixa no provedor), o
-- servidor do Agilliza só LÊ a caixa e grava o código aqui. A equipe vê o código
-- na tela "Códigos de acesso", com o banco, o remetente e o assunto.
--
-- 1. codigos_caixas: caixa vigiada. A senha fica cifrada pelo servidor (nunca em
--    texto claro). Guarda também o estado da leitura e a espera entre logins
--    depois de uma recusa, que sobrevive a reinícios (insistir no login durante
--    um bloqueio do provedor só o prolonga).
-- 2. codigos_recebidos: um código por e-mail lido.
-- 3. codigos_assumir_caixa: "aluguel" da caixa por um único leitor. Dois logins
--    ao mesmo tempo na mesma caixa fazem o provedor bloquear; o banco garante que
--    só um processo lê cada caixa.
--
-- Nada aqui é acessível pela API do navegador: as telas leem e gravam pelo
-- servidor, com o client de serviço, depois de conferir a permissão
-- `operacional.codigos`.

create table if not exists public.codigos_caixas (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  imap_host      text not null default 'imap.uhserver.com',
  imap_port      int  not null default 993 check (imap_port between 1 and 65535),
  senha_cifrada  text not null default '',
  ativo          boolean not null default true,
  -- Só e-mails recebidos a partir daqui entram (ligar a caixa não importa o passado).
  desde          timestamptz not null default now(),
  ultima_uid     bigint,
  uid_validity   bigint,
  leitor         text,
  leitor_ate     timestamptz,
  espera_ate     timestamptz,
  falhas         int not null default 0,
  status         text not null default 'aguardando'
                 check (status in ('aguardando', 'conectado', 'espera', 'erro', 'desligado')),
  erro           text,
  ultima_leitura timestamptz,
  criado_por     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists codigos_caixas_email_uniq on public.codigos_caixas (lower(email));

create table if not exists public.codigos_recebidos (
  id              uuid primary key default gen_random_uuid(),
  caixa_id        uuid not null references public.codigos_caixas (id) on delete cascade,
  message_id      text not null,
  recebido_em     timestamptz not null,
  remetente_nome  text,
  remetente_email text,
  banco           text,
  assunto         text,
  trecho          text,
  codigo          text,
  created_at      timestamptz not null default now(),
  unique (caixa_id, message_id)
);

create index if not exists codigos_recebidos_recentes_idx
  on public.codigos_recebidos (recebido_em desc);

alter table public.codigos_caixas enable row level security;
alter table public.codigos_recebidos enable row level security;

revoke all on public.codigos_caixas from anon, authenticated;
revoke all on public.codigos_recebidos from anon, authenticated;
grant all on public.codigos_caixas to service_role;
grant all on public.codigos_recebidos to service_role;

/**
 * Aluga a caixa para um leitor por alguns segundos. Devolve true se o leitor é o
 * dono do aluguel agora (assumiu uma caixa livre ou renovou o próprio).
 */
create or replace function public.codigos_assumir_caixa(p_caixa uuid, p_leitor text, p_segundos int)
returns boolean
language sql
security definer
set search_path = public
as $$
  with assumida as (
    update public.codigos_caixas
       set leitor = p_leitor,
           leitor_ate = now() + make_interval(secs => greatest(p_segundos, 10))
     where id = p_caixa
       and ativo
       and (leitor is null or leitor = p_leitor or leitor_ate is null or leitor_ate < now())
    returning 1
  )
  select exists (select 1 from assumida);
$$;

/** Solta a caixa (ao desligar o leitor), para outro processo poder assumir na hora. */
create or replace function public.codigos_soltar_caixa(p_caixa uuid, p_leitor text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.codigos_caixas
     set leitor = null, leitor_ate = null
   where id = p_caixa and leitor = p_leitor;
$$;

revoke all on function public.codigos_assumir_caixa(uuid, text, int) from public, anon, authenticated;
revoke all on function public.codigos_soltar_caixa(uuid, text) from public, anon, authenticated;
grant execute on function public.codigos_assumir_caixa(uuid, text, int) to service_role;
grant execute on function public.codigos_soltar_caixa(uuid, text) to service_role;
