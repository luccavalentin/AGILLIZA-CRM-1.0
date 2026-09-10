-- Módulo de consulta a bureau de crédito (SPC/Serasa e agregadores).
--
-- Duas tabelas:
--   bureau_credenciais — o fornecedor contratado e as chaves de acesso.
--   bureau_consultas   — o registro de cada consulta feita.
--
-- O registro não é conveniência: consulta a bureau é tratamento de dado
-- pessoal sensível. A LGPD e os próprios contratos de bureau exigem saber
-- quem consultou, quando, qual documento e com que finalidade.

create table if not exists public.bureau_credenciais (
  id uuid primary key default gen_random_uuid(),
  correspondente_id uuid not null,
  -- Chave do adaptador em src/lib/bureau/provedores (ex.: "serasa", "spc").
  provedor text not null,
  nome text not null,
  base_url text,
  -- Valores das chaves. Nunca saem do servidor: as funções que a tela chama
  -- devolvem apenas os NOMES dos campos preenchidos e uma máscara.
  credenciais jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (correspondente_id, provedor)
);

create table if not exists public.bureau_consultas (
  id uuid primary key default gen_random_uuid(),
  correspondente_id uuid not null,
  cliente_id uuid,
  -- Só dígitos.
  documento text not null,
  tipo_pessoa text not null check (tipo_pessoa in ('F', 'J')),
  finalidade text not null,
  provedor text not null,
  sucesso boolean not null default true,
  erro text,
  -- Ficha normalizada devolvida ao operador.
  ficha jsonb,
  ator_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists bureau_consultas_corr_data_idx
  on public.bureau_consultas (correspondente_id, created_at desc);
create index if not exists bureau_consultas_documento_idx
  on public.bureau_consultas (correspondente_id, documento, created_at desc);
create index if not exists bureau_consultas_cliente_idx
  on public.bureau_consultas (cliente_id, created_at desc)
  where cliente_id is not null;

alter table public.bureau_credenciais enable row level security;
alter table public.bureau_consultas enable row level security;

-- Credenciais: só quem administra o ecossistema enxerga a linha, e mesmo
-- assim os valores nunca são enviados ao navegador pelas server functions.
drop policy if exists bureau_credenciais_admin on public.bureau_credenciais;
create policy bureau_credenciais_admin on public.bureau_credenciais
  for all
  using (
    public.is_interno(auth.uid())
    and correspondente_id = public.correspondente_do_usuario(auth.uid())
  )
  with check (
    public.is_interno(auth.uid())
    and correspondente_id = public.correspondente_do_usuario(auth.uid())
  );

-- Consultas: equipe interna do próprio ecossistema lê; ninguém edita nem
-- apaga pela API — o histórico é registro de auditoria.
drop policy if exists bureau_consultas_leitura on public.bureau_consultas;
create policy bureau_consultas_leitura on public.bureau_consultas
  for select
  using (
    public.is_interno(auth.uid())
    and correspondente_id = public.correspondente_do_usuario(auth.uid())
  );
