-- Tabelas filhas da proposta no Realtime.
--
-- O detalhe da proposta recarregava tudo a cada 15 s porque documentos,
-- documentos HomeFin, envolvidos e follow-ups não avisavam quando mudavam.
-- Publicadas aqui, a tela escuta cada uma (filtrando pela proposta aberta) e a
-- recarga periódica vira só rede de segurança. Tabelas pequenas; a regra de
-- acesso (já por consulta) vale para cada assinante.
do $$
declare t text;
begin
  foreach t in array array['proposta_documentos', 'proposta_documentos_homefin', 'proposta_envolvidos', 'proposta_followups'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
