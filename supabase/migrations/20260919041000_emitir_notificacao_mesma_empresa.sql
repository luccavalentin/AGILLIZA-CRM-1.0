-- emitir_notificacao: com sessão de usuário, só avisa gente da mesma empresa.
--
-- A função é SECURITY DEFINER e executável por `authenticated` (demandas e
-- tarefas a chamam com o client do usuário). Sem checagem, qualquer usuário
-- logado podia criar avisos para qualquer outra pessoa, de qualquer empresa,
-- chamando a RPC direto (QA 19/09/2026). Agora, havendo sessão (auth.uid()),
-- o destinatário precisa ter o mesmo correspondente de quem chama; sem sessão
-- (service role, rotinas) segue como antes. Fora da regra, sai sem avisar —
-- não quebra o fluxo de quem chamou.

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
  IF auth.uid() IS NOT NULL
     AND public.correspondente_do_usuario(_user_id)
         IS DISTINCT FROM public.correspondente_do_usuario(auth.uid()) THEN
    RETURN;
  END IF;
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
