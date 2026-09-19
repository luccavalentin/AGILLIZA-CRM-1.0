-- Portal do cliente: avisos agrupados por assunto.
--
-- Cada mudança de status de simulação/proposta criava um aviso novo no sino
-- do cliente, mesmo já existindo um não lido do mesmo assunto: 19.337 avisos,
-- todos não lidos, com um cliente sozinho acumulando 988 — 515 deles a mesma
-- frase de "proposta.status" (QA 19/09/2026). Como a lista do portal mostra
-- só os 100 mais recentes, o aviso útil ficava soterrado.
--
-- Mesma regra já aplicada ao sino interno (20260919040000): existindo aviso
-- NÃO LIDO do mesmo cliente, tipo e link, ele é atualizado e volta ao topo;
-- lido, cria um novo.

create index if not exists idx_cliente_app_notif_nao_lidas_assunto
  on public.cliente_app_notificacoes (cliente_id, tipo, link)
  where lida = false;

create or replace function public.notificar_cliente_portal(
  _cliente_id uuid, _corr uuid, _tipo text, _titulo text, _corpo text, _link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF _cliente_id IS NULL THEN
    RETURN;
  END IF;

  IF _link IS NOT NULL THEN
    UPDATE public.cliente_app_notificacoes
       SET titulo = _titulo,
           corpo = _corpo,
           correspondente_id = _corr,
           criada_em = now()
     WHERE cliente_id = _cliente_id
       AND tipo = _tipo
       AND link = _link
       AND lida = false;
    IF FOUND THEN RETURN; END IF;
  END IF;

  INSERT INTO public.cliente_app_notificacoes (cliente_id, correspondente_id, tipo, titulo, corpo, link)
  VALUES (_cliente_id, _corr, _tipo, _titulo, _corpo, _link);
END;
$$;

-- Acumulado: de cada assunto fica não lido só o aviso mais recente; os
-- repetidos anteriores passam a lidos (nada é apagado).
with ranqueadas as (
  select id, row_number() over (
           partition by cliente_id, tipo, link order by criada_em desc, id desc
         ) rn
    from public.cliente_app_notificacoes
   where lida = false and link is not null
)
update public.cliente_app_notificacoes n
   set lida = true
  from ranqueadas r
 where n.id = r.id and r.rn > 1;
