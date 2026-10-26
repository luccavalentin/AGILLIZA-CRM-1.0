-- Portal do cliente do correspondente refeito (C15, pedido de 26/10/2026, frente a8).
--
-- O mesmo desenho e a mesma lógica do portal do cliente do Agilliza Tech: início com a
-- jornada da compra em etapas (com "Contrato registrado" depois de "Contrato emitido"),
-- pendências de documento com envio direto para a pasta certa do cliente, simulações e
-- propostas com o ID visível ("ID H." na proposta do correspondente), privacidade.
--
-- Regras de sempre do portal (20261023130000): as funções recebem o id do cliente que o
-- SERVIDOR tirou do cookie selado e só o service_role executa. Cada função devolve só o
-- que é do próprio cliente (`cliente_id = _cid`) e nunca o que é interno da equipe.
-- O login (CPF + nascimento / CNPJ + abertura) não muda.

-- -----------------------------------------------------------------------------
-- Jornada: as etapas do funil do cliente + "Contrato registrado"
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_jornada(_cid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ordem_atual int;
  v_ultima_ordem int;
  v_tem_etapa_registro boolean;
  v_registrado boolean;
  v_registrado_em timestamptz;
  v_emitido_em date;
  v_etapas jsonb;
  v_vist_agenda date;
  v_vist_ok date;
begin
  select ps.ordem into v_ordem_atual
    from public.cliente_pipeline cp join public.pipeline_stages ps on ps.id = cp.stage_id
   where cp.cliente_id = _cid;
  if v_ordem_atual is null then
    select min(ordem) into v_ordem_atual from public.pipeline_stages;
  end if;
  select max(ordem) into v_ultima_ordem from public.pipeline_stages;
  v_tem_etapa_registro := exists (select 1 from public.pipeline_stages where codigo = 'contrato_registrado');

  -- Contrato registrado: a proposta do cliente chegou a "registrado" (status da proposta).
  select count(*) > 0, max(coalesce(p.status_atualizado_em, p.updated_at)) into v_registrado, v_registrado_em
    from public.propostas p
   where p.cliente_id = _cid and p.deleted_at is null and p.status::text = 'registrado';
  v_registrado := coalesce(v_registrado, false);

  select c.vistoria_agendada_em, c.vistoria_concluida_em, c.contrato_emitido_em
    into v_vist_agenda, v_vist_ok, v_emitido_em
    from public.clientes c where c.id = _cid;

  -- Registrado: tudo antes dele está feito.
  if v_registrado then
    v_ordem_atual := v_ultima_ordem + 1;
  -- Parado na última etapa do funil (contrato emitido) sem etapa própria de registro: o
  -- contrato já foi emitido e o que falta é o registro.
  elsif not v_tem_etapa_registro and v_ordem_atual = v_ultima_ordem then
    v_ordem_atual := v_ultima_ordem + 1;
  end if;

  select coalesce(jsonb_agg(e order by (e ->> 'ordem')::int), '[]'::jsonb) into v_etapas
    from (
      select jsonb_build_object(
               'ordem', s.ordem,
               'codigo', s.codigo,
               'nome', s.nome,
               'descricao_cliente', s.mensagem_cliente,
               'status', case
                 when s.codigo = 'contrato_registrado' and v_registrado then 'concluida'
                 when s.ordem < v_ordem_atual then 'concluida'
                 when s.ordem = v_ordem_atual then 'atual' else 'proxima' end,
               'concluida_em', case when s.ordem < v_ordem_atual then
                 coalesce((select min(h.created_at) from public.cliente_pipeline_historico h
                            where h.cliente_id = _cid and h.stage_id = s.id),
                          case when s.codigo = 'contrato_emitido' then v_emitido_em::timestamptz end) end,
               'data_marco', case when s.codigo = 'engenharia_vistoria' then to_jsonb(coalesce(v_vist_ok, v_vist_agenda)) end
             ) as e
        from public.pipeline_stages s
      union all
      -- Sem etapa própria no funil, "Contrato registrado" entra logo depois do contrato emitido.
      select jsonb_build_object(
               'ordem', v_ultima_ordem + 1,
               'codigo', 'contrato_registrado',
               'nome', 'Contrato registrado',
               'descricao_cliente', case when v_registrado
                 then 'Contrato registrado em cartório. Parabéns pela conquista!'
                 else 'Depois da assinatura, o contrato é registrado no cartório de imóveis.' end,
               'status', case when v_registrado then 'concluida'
                              when v_ordem_atual = v_ultima_ordem + 1 then 'atual' else 'proxima' end,
               'concluida_em', case when v_registrado then v_registrado_em end,
               'data_marco', null)
       where not v_tem_etapa_registro and v_ultima_ordem is not null
    ) x;

  return v_etapas;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rótulo da pasta de um documento (pasta própria ou a padrão da categoria)
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_rotulo_pasta(_cid uuid, _pasta uuid, _categoria text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.nome from public.cliente_documento_pastas p where p.id = _pasta and p.cliente_id = _cid),
    case _categoria
      when 'comprador' then 'Comprador / Titular e Cônjuge'
      when 'conjuge' then 'Comprador / Titular e Cônjuge'
      when 'vendedor' then 'Vendedor e Cônjuge'
      when 'vendedor_conjuge' then 'Vendedor e Cônjuge'
      when 'imovel' then 'Imóvel'
      else 'Outros' end)
$$;

-- -----------------------------------------------------------------------------
-- Início: jornada, pendências, propostas (com ID H.), simulações e atendimento
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_inicio(_cid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cli record;
  v_resp uuid;
  v_contato jsonb;
  v_pend jsonb;
  v_props jsonb;
  v_sim jsonb;
  v_docs jsonb;
  v_ultima timestamptz;
begin
  select c.id, c.nome, c.foto_url, c.responsavel_id into v_cli
    from public.clientes c
   where c.id = _cid and c.ativo is true and c.portal_acesso_ativo is true and c.deleted_at is null;
  if v_cli.id is null then return null; end if;

  select cp.ultima_atualizacao_em into v_ultima from public.cliente_pipeline cp where cp.cliente_id = _cid;

  -- Quem atende: o responsável pela proposta mais recente enviada; senão, o do cliente.
  select coalesce(pr.usuario_responsavel_id, pr.usuario_criador_id) into v_resp
    from public.propostas pr
   where pr.cliente_id = _cid and pr.deleted_at is null
     and coalesce(pr.usuario_responsavel_id, pr.usuario_criador_id) is not null
   order by case when pr.enviada_em is not null then 0 else 1 end, coalesce(pr.enviada_em, pr.created_at) desc
   limit 1;
  v_resp := coalesce(v_resp, v_cli.responsavel_id);
  if v_resp is not null then
    select jsonb_build_object('nome', p.nome, 'foto_url', coalesce(p.foto_url, p.avatar_url)) into v_contato
      from public.profiles p where p.id = v_resp;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'tipo_documento', d.tipo_documento, 'status', d.status,
           'pasta', public.portal_cliente_rotulo_pasta(_cid, d.pasta_id, d.categoria::text),
           'atualizado_em', d.updated_at)
           order by case d.status when 'reprovado' then 0 else 1 end, d.created_at), '[]'::jsonb)
    into v_pend
    from public.cliente_documentos d
   where d.cliente_id = _cid and d.status in ('pendente', 'reprovado');

  select jsonb_build_object(
           'total', count(*),
           'aprovados', count(*) filter (where d.status = 'aprovado'),
           'em_analise', count(*) filter (where d.status = 'recebido'),
           'pendentes', count(*) filter (where d.status in ('pendente', 'reprovado')))
    into v_docs
    from public.cliente_documentos d where d.cliente_id = _cid;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'id_h', p.homefin_id_oportunidade, 'numero', p.numero_proposta,
           'banco', p.nome_banco, 'produto', p.produto, 'valor', p.valor_financiamento,
           'valor_aprovado', p.valor_financiamento_aprovado, 'parcela', p.valor_parcela_aprovado,
           'taxa_ano', p.taxa_juros_ano_aprovado, 'prazo', coalesce(p.prazo_aprovado, p.prazo),
           'status', p.status, 'enviada_em', p.enviada_em, 'contrato_emitido_em', p.contrato_emitido_em)
           order by p.created_at desc), '[]'::jsonb)
    into v_props
    from public.propostas p
   where p.cliente_id = _cid and p.deleted_at is null
     and p.status::text in ('credito_aprovado', 'checklist_documentacao', 'cadastro_complementar', 'dossie_completo',
                            'formularios', 'envio_documentos_banco', 'vistoria_agendamento', 'vistoria_concluida',
                            'emissao_contrato', 'contrato_emitido', 'aguardando_documentos', 'engenharia_vistoria',
                            'analise_juridica', 'registrado');

  select jsonb_build_object(
           'total', count(distinct s.id),
           'melhor_parcela', min(b.valor_parcela) filter (where b.status_banco::text = 'simulada' and b.valor_parcela > 0))
    into v_sim
    from public.simulacoes s
    left join public.simulacao_bancos b on b.simulacao_id = s.id
   where s.cliente_id = _cid and s.deleted_at is null
     and s.status::text in ('simulada', 'parcialmente_simulada', 'promovida');

  return jsonb_build_object(
    'cliente', jsonb_build_object('nome', v_cli.nome, 'foto_url', v_cli.foto_url),
    'jornada', public.portal_cliente_jornada(_cid),
    'ultima_atualizacao', v_ultima,
    'contato', v_contato,
    'pendencias', v_pend,
    'documentos', v_docs,
    'propostas', v_props,
    'simulacoes', v_sim,
    'mensagens_nao_lidas', (select count(*) from public.cliente_app_mensagens m
                             where m.cliente_id = _cid and m.remetente_tipo = 'time' and m.lida_em is null),
    'notificacoes_nao_lidas', (select count(*) from public.cliente_app_notificacoes n
                                where n.cliente_id = _cid and n.lida = false));
end;
$$;

-- -----------------------------------------------------------------------------
-- Simulações do cliente com a cotação de cada banco (o ID aparece como "ID")
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_simulacoes(_cid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'numero', s.numero_simulacao, 'id_externo', s.homefin_id_oportunidade,
           'criada_em', s.created_at, 'valor_imovel', s.valor_imovel, 'valor_entrada', s.valor_entrada,
           'valor_financiamento', s.valor_financiamento, 'prazo', s.prazo, 'sistema', s.sistema_amortizacao,
           'produto', s.produto, 'tipo_imovel', s.tipo_imovel,
           'bancos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'banco', b.nome_banco, 'codigo_banco', b.codigo_banco, 'parcela', b.valor_parcela,
                      'taxa_ano', b.taxa_juros_ano, 'cet_ano', b.taxa_cet_ano,
                      'prazo', coalesce(b.prazo_pagamento_max, s.prazo), 'sistema', b.sistema_amortizacao_banco,
                      'financiamento_max', b.valor_financiamento_max)
                      order by b.valor_parcela nulls last)
               from public.simulacao_bancos b
              where b.simulacao_id = s.id and b.status_banco::text = 'simulada' and b.valor_parcela > 0), '[]'::jsonb))
           order by s.created_at desc), '[]'::jsonb)
    from public.simulacoes s
   where s.cliente_id = _cid and s.deleted_at is null
     and s.status::text in ('simulada', 'parcialmente_simulada', 'promovida')
     and exists (select 1 from public.clientes c where c.id = _cid and c.portal_acesso_ativo is true and c.deleted_at is null);
$$;

-- -----------------------------------------------------------------------------
-- Documentos: pastas do cliente e o que está em cada uma
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_documentos(_cid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not exists (select 1 from public.clientes c where c.id = _cid and c.portal_acesso_ativo is true and c.deleted_at is null)
    then null else jsonb_build_object(
    'pastas', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'slug', p.slug) order by p.ordem, p.created_at)
        from public.cliente_documento_pastas p
       where p.cliente_id = _cid and p.parent_id is null), '[]'::jsonb),
    'documentos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'tipo_documento', d.tipo_documento, 'nome_arquivo', case when d.status = 'pendente' then null else d.nome_arquivo end,
               'status', d.status, 'pasta', public.portal_cliente_rotulo_pasta(_cid, d.pasta_id, d.categoria::text),
               'versao', d.versao, 'atualizado_em', d.updated_at)
               order by case d.status when 'reprovado' then 0 when 'pendente' then 1 when 'recebido' then 2 else 3 end, d.updated_at desc)
        from public.cliente_documentos d
       where d.cliente_id = _cid), '[]'::jsonb)) end
$$;

-- -----------------------------------------------------------------------------
-- Envio de documento pelo cliente, direto na pasta certa
--   · _doc: atende a pendência (o arquivo entra no MESMO registro, com a pasta e a
--     categoria que a equipe definiu; reenvio de reprovado sobe a versão);
--   · sem _doc: documento novo na pasta escolhida (do próprio cliente) ou na categoria.
-- O caminho do arquivo é montado pelo servidor e precisa ficar na pasta do cliente.
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_enviar_documento(
  _cid uuid, _doc uuid, _pasta uuid, _categoria text, _tipo text, _nome text, _path text, _mime text, _tamanho bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  v_pasta record;
  v_cat public.doc_categoria;
  v_id uuid;
begin
  if not exists (select 1 from public.clientes c where c.id = _cid and c.ativo is true and c.portal_acesso_ativo is true and c.deleted_at is null) then
    raise exception 'Acesso do cliente inválido.' using errcode = '42501';
  end if;
  if _path is null or _path not like _cid::text || '/app/%' or _path like '%..%' then
    raise exception 'Caminho de arquivo inválido.' using errcode = '22023';
  end if;
  if coalesce(_tamanho, 0) <= 0 or _tamanho > 10 * 1024 * 1024 then
    raise exception 'Arquivo vazio ou maior que 10 MB.' using errcode = '22023';
  end if;
  if length(coalesce(btrim(_nome), '')) = 0 then
    raise exception 'Arquivo sem nome.' using errcode = '22023';
  end if;

  if _doc is not null then
    select * into d from public.cliente_documentos x where x.id = _doc and x.cliente_id = _cid for update;
    if d.id is null then
      raise exception 'Pendência não encontrada.' using errcode = 'P0002';
    end if;
    if d.status not in ('pendente', 'reprovado') then
      raise exception 'Este documento não está pendente.' using errcode = '55000';
    end if;
    update public.cliente_documentos
       set nome_arquivo = left(_nome, 255), storage_path = _path, mime_type = left(_mime, 120), tamanho_bytes = _tamanho,
           status = 'recebido', versao = case when d.status = 'reprovado' then d.versao + 1 else d.versao end,
           aprovado_por = null, aprovado_em = null, enviado_por = null, updated_at = now()
     where id = d.id;
    v_id := d.id;
    v_cat := d.categoria;
  else
    if length(coalesce(btrim(_tipo), '')) = 0 then
      raise exception 'Diga que documento é este.' using errcode = '22023';
    end if;
    if _pasta is not null then
      select p.id, p.slug into v_pasta from public.cliente_documento_pastas p where p.id = _pasta and p.cliente_id = _cid;
      if v_pasta.id is null then
        raise exception 'Pasta não encontrada.' using errcode = 'P0002';
      end if;
      v_cat := case v_pasta.slug when 'comprador' then 'comprador' when 'vendedor' then 'vendedor'
                                 when 'imovel' then 'imovel' else 'outros' end::public.doc_categoria;
    else
      v_cat := case when _categoria in ('comprador', 'vendedor', 'imovel') then _categoria else 'outros' end::public.doc_categoria;
    end if;
    insert into public.cliente_documentos (cliente_id, categoria, pasta_id, tipo_documento, nome_arquivo, storage_path,
                                           mime_type, tamanho_bytes, status)
    values (_cid, v_cat, _pasta, left(btrim(_tipo), 120), left(_nome, 255), _path, left(_mime, 120), _tamanho, 'recebido')
    returning id into v_id;
  end if;

  insert into public.cliente_historico (cliente_id, tipo, descricao, metadata)
  values (_cid, 'documento', 'Cliente enviou um documento pelo App do Cliente.',
          jsonb_build_object('documento_id', v_id, 'pendencia', _doc is not null));

  return jsonb_build_object('ok', true, 'id', v_id,
                            'pasta', public.portal_cliente_rotulo_pasta(_cid, coalesce(_pasta, (select pasta_id from public.cliente_documentos where id = v_id)), v_cat::text));
end;
$$;

-- -----------------------------------------------------------------------------
-- Privacidade: o que o cliente consentiu e os pedidos LGPD que ele abriu
-- -----------------------------------------------------------------------------
create or replace function public.portal_cliente_privacidade(_cid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'consentimento_em', c.lgpd_aceite_em,
    'consentimento_versao', c.lgpd_aceite_versao,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', dm.id, 'titulo', dm.titulo, 'status', dm.status, 'criado_em', dm.created_at)
                       order by dm.created_at desc)
        from public.demandas dm where dm.cliente_id = _cid and dm.tipo::text = 'lgpd'), '[]'::jsonb)) end
    from (select null::uuid) z
    left join public.clientes c on c.id = _cid and c.portal_acesso_ativo is true and c.deleted_at is null
$$;

-- -----------------------------------------------------------------------------
-- Só o servidor (service_role) chama. Nada para anon/authenticated.
-- -----------------------------------------------------------------------------
revoke all on function public.portal_cliente_jornada(uuid) from public, anon, authenticated;
revoke all on function public.portal_cliente_rotulo_pasta(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.portal_cliente_inicio(uuid) from public, anon, authenticated;
revoke all on function public.portal_cliente_simulacoes(uuid) from public, anon, authenticated;
revoke all on function public.portal_cliente_documentos(uuid) from public, anon, authenticated;
revoke all on function public.portal_cliente_enviar_documento(uuid, uuid, uuid, text, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.portal_cliente_privacidade(uuid) from public, anon, authenticated;

grant execute on function public.portal_cliente_jornada(uuid) to service_role;
grant execute on function public.portal_cliente_inicio(uuid) to service_role;
grant execute on function public.portal_cliente_simulacoes(uuid) to service_role;
grant execute on function public.portal_cliente_documentos(uuid) to service_role;
grant execute on function public.portal_cliente_enviar_documento(uuid, uuid, uuid, text, text, text, text, text, bigint) to service_role;
grant execute on function public.portal_cliente_privacidade(uuid) to service_role;
