-- Servidor de e-mail (pedido do dono, 26/10/2026 — C26).
--
-- "CÓDIGO DE ACESSO DEVE SER SERVIDOR DE E-MAIL > DEVE PERMITIR CADASTRAR E EDITAR PARA
-- VIGIAR MAIS DE UMA CAIXA, E TAMBÉM DEVE TER O FILTRO DE PALAVRAS".
--
-- Os "Códigos de acesso" (20261022100000) viram o "Servidor de e-mail": várias caixas
-- IMAP, cada uma com nome, usuário de login (quando não é o próprio e-mail), SSL, pasta
-- vigiada, pausa e teste de conexão; e um filtro de palavras por caixa:
--
--   · "contém" (qualquer uma das regras basta): captura o e-mail mesmo sem palavra de código;
--   · "não contém" (todas valem): o e-mail que tiver o termo naquele campo é ignorado;
--   · campos: assunto, remetente (nome + endereço), corpo ou qualquer um deles;
--   · `usar_palavras_padrao`: além das regras, captura os e-mails de código (o
--     comportamento de sempre: código, token, OTP, senha, verificação…).
--
-- Continua tudo fechado para a API do navegador: o servidor lê e grava com o client de
-- serviço depois de conferir `operacional.codigos` e a equipe interna. A senha segue
-- cifrada pelo servidor (coluna `senha_cifrada` de sempre; nenhuma coluna nova de segredo).

alter table public.codigos_caixas
  add column if not exists nome text check (nome is null or length(nome) <= 80),
  add column if not exists usuario text check (usuario is null or length(usuario) <= 200),
  add column if not exists imap_ssl boolean not null default true,
  add column if not exists pasta text not null default 'INBOX' check (length(btrim(pasta)) between 1 and 120),
  add column if not exists usar_palavras_padrao boolean not null default true,
  add column if not exists teste_em timestamptz,
  add column if not exists teste_ok boolean,
  add column if not exists teste_msg text check (teste_msg is null or length(teste_msg) <= 300);

comment on column public.codigos_caixas.usuario is
  'Login IMAP quando não é o próprio e-mail (nulo = usa o e-mail).';
comment on column public.codigos_caixas.usar_palavras_padrao is
  'Captura os e-mails com palavra de código (código, token, OTP, senha…) além das regras "contém".';

create table if not exists public.codigos_filtros (
  id          uuid primary key default gen_random_uuid(),
  caixa_id    uuid not null references public.codigos_caixas (id) on delete cascade,
  operador    text not null check (operador in ('contem', 'nao_contem')),
  campo       text not null check (campo in ('qualquer', 'assunto', 'remetente', 'corpo')),
  termo       text not null check (length(btrim(termo)) between 2 and 120),
  ativo       boolean not null default true,
  criado_por  uuid,
  created_at  timestamptz not null default now()
);

create unique index if not exists codigos_filtros_uniq
  on public.codigos_filtros (caixa_id, operador, campo, lower(btrim(termo)));
create index if not exists codigos_filtros_caixa_idx on public.codigos_filtros (caixa_id);

-- Por que a mensagem entrou (palavra de código ou a regra que casou).
alter table public.codigos_recebidos
  add column if not exists motivo text check (motivo is null or length(motivo) <= 200);

alter table public.codigos_filtros enable row level security;
revoke all on public.codigos_filtros from anon, authenticated;
grant all on public.codigos_filtros to service_role;

-- Leitura pela API só para a equipe interna com o módulo (as regras não são segredo,
-- mas o portal do parceiro não tem o que fazer aqui). Escrita só pelo servidor.
drop policy if exists "codigos_filtros leitura interna" on public.codigos_filtros;
create policy "codigos_filtros leitura interna" on public.codigos_filtros
  for select to authenticated
  using (public.is_interno((select auth.uid()))
         and public.usuario_tem_permissao((select auth.uid()), 'operacional.codigos', 'view'));
grant select on public.codigos_filtros to authenticated;

/**
 * Troca o conjunto de regras da caixa de uma vez (apaga e grava na mesma transação):
 * a tela edita a lista inteira, e uma regra pela metade nunca fica valendo. Até 50 regras.
 */
create or replace function public.codigos_substituir_filtros(p_caixa uuid, p_filtros jsonb, p_autor uuid)
returns integer
language plpgsql
-- Sem SECURITY DEFINER: só o client de serviço (servidor) executa, com os privilégios dele.
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if not exists (select 1 from public.codigos_caixas where id = p_caixa for update) then
    raise exception 'Caixa não encontrada.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_filtros, '[]'::jsonb)) <> 'array' then
    raise exception 'Regras em formato inválido.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_filtros, '[]'::jsonb)) > 50 then
    raise exception 'Use no máximo 50 regras por caixa.' using errcode = '22023';
  end if;
  delete from public.codigos_filtros where caixa_id = p_caixa;
  insert into public.codigos_filtros (caixa_id, operador, campo, termo, ativo, criado_por)
  select distinct on (f ->> 'operador', f ->> 'campo', lower(btrim(f ->> 'termo')))
         p_caixa, f ->> 'operador', f ->> 'campo', btrim(f ->> 'termo'),
         coalesce((f ->> 'ativo')::boolean, true), p_autor
    from jsonb_array_elements(coalesce(p_filtros, '[]'::jsonb)) f;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.codigos_substituir_filtros(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.codigos_substituir_filtros(uuid, jsonb, uuid) to service_role;
