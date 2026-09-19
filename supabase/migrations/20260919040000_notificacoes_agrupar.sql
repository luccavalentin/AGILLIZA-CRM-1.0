-- Notificações agrupadas por assunto.
--
-- Cada mudança de status de simulação/proposta criava um aviso NOVO para o
-- responsável, mesmo com outro não lido do mesmo assunto: 4.215 "Simulação
-- atualizada" para 2.779 simulações, e o sino chegava a 1.169 não lidas por
-- usuário — o aviso importante se perdia (QA 19/09/2026).
--
-- Agora, se já existe aviso NÃO LIDO do mesmo usuário, tipo e link, ele é
-- atualizado (título, texto) e volta ao topo (created_at = agora) em vez de
-- ganhar um irmão. Lido ou sem link, cria um novo como antes. A tela ouve
-- qualquer mudança em `notificacoes` (event "*"), então atualizar também avisa.

create index if not exists idx_notificacoes_nao_lidas_assunto
  on public.notificacoes (user_id, tipo, link)
  where lida = false;

create or replace function public.emitir_notificacao(
  _user_id uuid, _corr uuid, _tipo text, _titulo text, _corpo text, _link text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  IF _link IS NOT NULL THEN
    UPDATE public.notificacoes
       SET titulo = _titulo,
           corpo = _corpo,
           correspondente_id = _corr,
           created_at = now()
     WHERE user_id = _user_id
       AND tipo = _tipo
       AND link = _link
       AND lida = false;
    IF FOUND THEN RETURN; END IF;
  END IF;
  INSERT INTO public.notificacoes (user_id, correspondente_id, tipo, titulo, corpo, link)
  VALUES (_user_id, _corr, _tipo, _titulo, _corpo, _link);
END;
$$;

-- Acumulado: fica não lido só o aviso mais recente de cada assunto; os
-- anteriores repetidos são marcados como lidos (nada é apagado).
with ranqueadas as (
  select id, row_number() over (partition by user_id, tipo, link order by created_at desc, id desc) rn
  from public.notificacoes
  where lida = false and link is not null
)
update public.notificacoes n
   set lida = true
  from ranqueadas r
 where n.id = r.id and r.rn > 1;
