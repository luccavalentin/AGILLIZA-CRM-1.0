-- Até quando cada pessoa já leu os comentários de cada proposta.
--
-- O selo da documentação pisca enquanto houver retorno da HomeFin (documento
-- aprovado, recusado ou comentário do banco) mais novo que a última abertura
-- da janela de comentários. Isso morava no `localStorage` do navegador: trocar
-- de máquina, de navegador ou limpar os dados do site fazia o selo piscar de
-- novo em tudo que a pessoa já tinha lido.
--
-- Uma linha por (proposta, pessoa), substituída a cada abertura. Não entra em
-- `propostas` de propósito: é leitura de cada um, muda a cada clique e uma
-- escrita lá dispararia o realtime de todas as telas inscritas na proposta.

create table if not exists public.proposta_comentarios_vistos (
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visto_em timestamptz not null default now(),
  primary key (proposta_id, user_id)
);

alter table public.proposta_comentarios_vistos enable row level security;

-- Cada um enxerga e grava só a própria leitura. Não há política de delete: a
-- linha some junto com a proposta ou com o usuário, pelas chaves acima.
drop policy if exists "comentarios_vistos_proprios_select" on public.proposta_comentarios_vistos;
create policy "comentarios_vistos_proprios_select"
  on public.proposta_comentarios_vistos for select
  using (user_id = auth.uid());

drop policy if exists "comentarios_vistos_proprios_insert" on public.proposta_comentarios_vistos;
create policy "comentarios_vistos_proprios_insert"
  on public.proposta_comentarios_vistos for insert
  with check (user_id = auth.uid());

drop policy if exists "comentarios_vistos_proprios_update" on public.proposta_comentarios_vistos;
create policy "comentarios_vistos_proprios_update"
  on public.proposta_comentarios_vistos for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A consulta de propostas lê `in (lista de propostas) and user_id = <eu>`, que
-- usa o prefixo da chave primária. Este índice cobre o caminho inverso, para a
-- limpeza quando um usuário é removido.
create index if not exists proposta_comentarios_vistos_user_idx
  on public.proposta_comentarios_vistos (user_id);
