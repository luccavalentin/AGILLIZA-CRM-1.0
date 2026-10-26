-- =============================================================================
-- Financeiro da matriz (frente a5) — 3/3: conciliação, painel, relatórios e leitura.
--
--   · extrato OFX/CSV importado (arquivo, quem, quando, resultado); a mesma movimentação
--     não entra duas vezes (hash por conta) e o mesmo arquivo pede confirmação;
--   · sugestões por valor, data ± N dias, descrição e documento — só sugestões: cada
--     uma é confirmada ou rejeitada por pessoa; índices únicos impedem conciliar a mesma
--     linha ou o mesmo pagamento duas vezes (inclusive em corrida);
--   · desfazer com motivo (estorna o pagamento que a conciliação criou) e trilha;
--   · painel e relatórios por natureza, sem misturar fluxos, com o caminho até a origem;
--   · listas e detalhe para as telas (cada função confere a permissão de ver).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extratos e conciliação
-- -----------------------------------------------------------------------------
create table if not exists public.fin_extratos (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  conta_bancaria_id  uuid not null references public.fin_contas_bancarias (id),
  arquivo_nome       text not null check (length(arquivo_nome) between 1 and 200),
  arquivo_sha256     text not null check (arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  formato            text not null check (formato in ('ofx', 'csv')),
  periodo_de         date,
  periodo_ate        date,
  linhas_total       integer not null default 0,
  linhas_novas       integer not null default 0,
  linhas_duplicadas  integer not null default 0,
  anexo_id           uuid references public.fin_anexos (id) on delete set null,
  importado_por      uuid,
  importado_em       timestamptz not null default now()
);
create index if not exists fin_extratos_corr on public.fin_extratos (correspondente_id, importado_em desc);

create table if not exists public.fin_extrato_linhas (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  extrato_id         uuid not null references public.fin_extratos (id) on delete cascade,
  conta_bancaria_id  uuid not null references public.fin_contas_bancarias (id),
  data               date not null,
  valor              numeric(14, 2) not null check (valor <> 0 and abs(valor) < 1000000000),
  descricao          text not null default '' check (length(descricao) <= 300),
  documento          text check (documento is null or length(documento) <= 120),
  fitid              text check (fitid is null or length(fitid) <= 120),
  hash               text not null,
  situacao           text not null default 'pendente' check (situacao in ('pendente', 'conciliada', 'ignorada', 'duplicada')),
  linha_original_id  uuid references public.fin_extrato_linhas (id),
  ignorada_motivo    text,
  ignorada_por       uuid,
  ignorada_em        timestamptz
);
create unique index if not exists fin_extrato_linhas_unica
  on public.fin_extrato_linhas (correspondente_id, conta_bancaria_id, hash) where situacao <> 'duplicada';
create index if not exists fin_extrato_linhas_extrato on public.fin_extrato_linhas (extrato_id, data);

create table if not exists public.fin_conciliacoes (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  linha_id           uuid not null references public.fin_extrato_linhas (id),
  baixa_id           uuid not null references public.fin_baixas (id),
  criou_baixa        boolean not null default false,
  confirmado_por     uuid,
  confirmado_em      timestamptz not null default now(),
  desfeita_em        timestamptz,
  desfeita_por       uuid,
  desfeita_motivo    text,
  check (desfeita_em is null or length(btrim(coalesce(desfeita_motivo, ''))) >= 5)
);
-- Impossível conciliar duas vezes (a mesma linha ou o mesmo pagamento), mesmo em corrida.
create unique index if not exists fin_conciliacoes_linha_unica on public.fin_conciliacoes (linha_id) where desfeita_em is null;
create unique index if not exists fin_conciliacoes_baixa_unica on public.fin_conciliacoes (baixa_id) where desfeita_em is null;

create table if not exists public.fin_sugestoes_rejeitadas (
  linha_id           uuid not null references public.fin_extrato_linhas (id) on delete cascade,
  alvo_tipo          text not null,
  alvo_id            uuid not null,
  correspondente_id  uuid not null,
  rejeitada_por      uuid,
  rejeitada_em       timestamptz not null default now(),
  primary key (linha_id, alvo_tipo, alvo_id)
);

do $$
declare t text;
begin
  foreach t in array array['fin_extratos', 'fin_extrato_linhas', 'fin_conciliacoes', 'fin_sugestoes_rejeitadas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated
                      using (correspondente_id = public.fin_corr() and public.fin_pode(''financeiro.conciliacao'', ''view''))',
                   t || '_sel', t);
    execute format('drop trigger if exists trg_fin_auditar on public.%I', t);
    execute format('create trigger trg_fin_auditar after insert or update or delete on public.%I
                      for each row execute function public.fin_tg_auditar()', t);
  end loop;
end $$;

/** Texto sem acento e minúsculo (comparação de descrições). */
create or replace function public.fin_normalizar(_t text)
returns text language sql immutable set search_path = public as $$
  select lower(translate(coalesce(_t, ''), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))
$$;

/** Quantas palavras (4+ letras/dígitos) as duas descrições têm em comum. */
create or replace function public.fin_similar(_a text, _b text)
returns integer language sql immutable set search_path = public as $$
  select count(*)::int from (
    select distinct w from regexp_split_to_table(public.fin_normalizar(_a), '[^a-z0-9]+') w where length(w) >= 4
    intersect
    select distinct w from regexp_split_to_table(public.fin_normalizar(_b), '[^a-z0-9]+') w where length(w) >= 4) x
$$;

/** Descrição legível de um lançamento (para extrato, relatórios e auditoria). */
create or replace function public.fin_descricao_alvo(_natureza text, _alvo uuid)
returns text language sql stable security definer set search_path = public as $$
  select case _natureza
    when 'comissao_banco' then (select 'Comissão ' || coalesce(c.banco_nome, 'banco') || coalesce(' · ' || c.cliente_nome, '')
                                       || coalesce(' · contrato ' || c.numero_contrato, '') from public.comissoes c where c.id = _alvo)
    when 'comissao_participante' then (select 'Comissão de ' || coalesce(pr.nome, 'participante') || coalesce(' · proposta ' || cu.numero_proposta, '')
                                         from public.comissoes_usuario cu left join public.profiles pr on pr.id = cu.usuario_id where cu.id = _alvo)
    when 'conta_pagar' then (select p.descricao || coalesce(' · ' || coalesce(f.nome, p.fornecedor, p.boleto_beneficiario), '')
                               from public.financial_payables p left join public.fin_fornecedores f on f.id = p.fornecedor_id where p.id = _alvo)
    when 'conta_receber' then (select r.descricao || coalesce(' · ' || r.pagador, '') from public.financial_receivables r where r.id = _alvo)
    when 'repasse_assinante' then 'Repasse ao assinante'
  end
$$;

create or replace function public.fin_importar_extrato(_conta uuid, _arquivo text, _sha text, _formato text, _linhas jsonb,
                                                       _confirmar boolean default false, _anexo uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'create');
  v_ext uuid;
  l jsonb;
  v_data date;
  v_valor numeric;
  v_desc text;
  v_doc text;
  v_fitid text;
  v_hash text;
  v_orig uuid;
  v_novas integer := 0;
  v_dup integer := 0;
  v_ant text;
begin
  if not exists (select 1 from public.fin_contas_bancarias where id = _conta and correspondente_id = v_corr and ativo) then
    raise exception 'Conta bancária não encontrada.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(_linhas) <> 'array' or jsonb_array_length(_linhas) = 0 then
    raise exception 'O arquivo não tem movimentações.' using errcode = '22023';
  end if;
  if jsonb_array_length(_linhas) > 5000 then raise exception 'No máximo 5.000 movimentações por arquivo.' using errcode = '22023'; end if;
  select to_char(importado_em, 'DD/MM/YYYY') into v_ant from public.fin_extratos
   where correspondente_id = v_corr and conta_bancaria_id = _conta and arquivo_sha256 = lower(_sha) limit 1;
  if v_ant is not null and not _confirmar then
    raise exception 'Este mesmo arquivo já foi importado em %. Confirme para importar de novo (as movimentações repetidas ficam marcadas).', v_ant
      using errcode = 'P0001', hint = 'duplicidade';
  end if;
  perform public.fin_ctx('extrato_importado', _arquivo);
  insert into public.fin_extratos (correspondente_id, conta_bancaria_id, arquivo_nome, arquivo_sha256, formato, anexo_id, importado_por)
  values (v_corr, _conta, left(_arquivo, 200), lower(_sha), _formato, _anexo, auth.uid())
  returning id into v_ext;
  for l in select * from jsonb_array_elements(_linhas) loop
    begin
      v_data := (l ->> 'data')::date;
      v_valor := round((l ->> 'valor')::numeric, 2);
    exception when others then
      raise exception 'Movimentação com data ou valor inválido: %', left(l::text, 120) using errcode = '22023';
    end;
    if v_data is null or v_valor is null or v_valor = 0 or abs(v_valor) >= 1000000000
       or v_data < date '2000-01-01' or v_data > current_date + 1 then
      raise exception 'Movimentação com data ou valor inválido: %', left(l::text, 120) using errcode = '22023';
    end if;
    v_desc := left(btrim(coalesce(l ->> 'descricao', '')), 300);
    v_doc := nullif(left(btrim(coalesce(l ->> 'documento', '')), 120), '');
    v_fitid := nullif(left(btrim(coalesce(l ->> 'fitid', '')), 120), '');
    v_hash := md5(_conta::text || '|' || v_data || '|' || v_valor || '|' ||
                  coalesce(v_fitid, public.fin_normalizar(v_desc) || '|' || coalesce(v_doc, '') || '|' || coalesce(l ->> 'ordem', '')));
    select id into v_orig from public.fin_extrato_linhas
     where correspondente_id = v_corr and conta_bancaria_id = _conta and hash = v_hash and situacao <> 'duplicada' limit 1;
    insert into public.fin_extrato_linhas (correspondente_id, extrato_id, conta_bancaria_id, data, valor, descricao, documento, fitid,
                                           hash, situacao, linha_original_id)
    values (v_corr, v_ext, _conta, v_data, v_valor, v_desc, v_doc, v_fitid, v_hash,
            case when v_orig is null then 'pendente' else 'duplicada' end, v_orig);
    if v_orig is null then v_novas := v_novas + 1; else v_dup := v_dup + 1; end if;
  end loop;
  update public.fin_extratos e
     set linhas_total = v_novas + v_dup, linhas_novas = v_novas, linhas_duplicadas = v_dup,
         periodo_de = (select min(data) from public.fin_extrato_linhas where extrato_id = v_ext),
         periodo_ate = (select max(data) from public.fin_extrato_linhas where extrato_id = v_ext)
   where id = v_ext;
  if _anexo is not null then
    update public.fin_anexos set entidade = 'fin_extratos', entidade_id = v_ext where id = _anexo and correspondente_id = v_corr and entidade_id is null;
  end if;
  perform public.fin_ctx_fim();
  return jsonb_build_object('extrato_id', v_ext, 'total', v_novas + v_dup, 'novas', v_novas, 'duplicadas', v_dup);
end $$;

/** Sugestões para as linhas pendentes de um extrato (só sugere: nada é gravado). */
create or replace function public.fin_sugestoes_conciliacao(_extrato uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'view');
  v_par public.fin_parametros := public.fin_param(v_corr);
  v_conta uuid;
  v_res jsonb;
begin
  select conta_bancaria_id into v_conta from public.fin_extratos where id = _extrato and correspondente_id = v_corr;
  if v_conta is null then raise exception 'Extrato não encontrado.' using errcode = 'P0002'; end if;
  with linhas as (
    select l.* from public.fin_extrato_linhas l where l.extrato_id = _extrato and l.situacao = 'pendente'
  ),
  abertos as (
    select 'comissao_banco'::text tipo, c.id, 'entrada'::text sentido,
           coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido saldo, c.previsao_recebimento ref_data,
           public.fin_descricao_alvo('comissao_banco', c.id) descricao, coalesce(c.numero_contrato, '') documento
      from public.comissoes c
     where c.correspondente_id = v_corr and c.situacao in ('previsto', 'a_receber', 'parcial', 'divergente')
       and coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido > 0
    union all
    select 'conta_receber', r.id, 'entrada', r.valor - r.valor_pago, r.vencimento,
           public.fin_descricao_alvo('conta_receber', r.id), coalesce(r.numero, '')
      from public.financial_receivables r
     where r.correspondente_id = v_corr and r.natureza = 'operacional' and r.status in ('aberta', 'parcial', 'atrasada')
    union all
    select 'conta_pagar', p.id, 'saida', p.valor - p.valor_pago, p.vencimento,
           public.fin_descricao_alvo('conta_pagar', p.id), coalesce(p.numero, '') || ' ' || coalesce(p.linha_digitavel, '')
      from public.financial_payables p
     where p.correspondente_id = v_corr and p.natureza = 'operacional' and not p.rascunho
       and p.status in ('aberta', 'parcial', 'atrasada')
    union all
    select 'comissao_participante', cu.id, 'saida', cu.valor_comissao - cu.valor_pago, cu.vencimento,
           public.fin_descricao_alvo('comissao_participante', cu.id), coalesce(cu.numero_proposta, '')
      from public.comissoes_usuario cu
     where cu.correspondente_id = v_corr and cu.situacao in ('aprovada', 'parcial')
  ),
  candidatos as (
    -- pagamentos já registrados e ainda não conciliados
    select l.id linha_id, 'baixa'::text tipo, b.id alvo_id, b.natureza, b.valor, b.data ref_data,
           public.fin_descricao_alvo(b.natureza, b.id) descricao,
           70 - 4 * least(abs(b.data - l.data), 10) + 12 * least(public.fin_similar(l.descricao, public.fin_descricao_alvo(b.natureza, b.id)), 3)
             + case when l.documento is not null and l.documento = b.documento then 20 else 0 end as pontos,
           array['pagamento_registrado', 'exato'] as sinais
      from linhas l
      join public.fin_baixas b on b.correspondente_id = v_corr and b.estornada_em is null
       and b.sentido = case when l.valor > 0 then 'entrada' else 'saida' end
       and abs(b.valor - abs(l.valor)) <= v_par.tolerancia_divergencia
       and abs(b.data - l.data) <= v_par.dias_janela_conciliacao
       and (b.conta_bancaria_id is null or b.conta_bancaria_id = v_conta)
       and not exists (select 1 from public.fin_conciliacoes fc where fc.baixa_id = b.id and fc.desfeita_em is null)
    union all
    -- lançamentos em aberto (a conciliação registra o pagamento ao confirmar)
    select l.id, a.tipo, a.id, a.tipo, a.saldo, a.ref_data, a.descricao,
           case when abs(a.saldo - abs(l.valor)) <= v_par.tolerancia_divergencia then 50 else 20 end
             - 2 * least(abs(coalesce(a.ref_data, l.data) - l.data), 15)
             + 12 * least(public.fin_similar(l.descricao, a.descricao || ' ' || a.documento), 3)
             + case when l.documento is not null and position(l.documento in a.documento) > 0 then 20 else 0 end,
           case when abs(a.saldo - abs(l.valor)) <= v_par.tolerancia_divergencia then array['exato']
                else array['parcial'] end
      from linhas l
      join abertos a on a.sentido = case when l.valor > 0 then 'entrada' else 'saida' end
       -- valor exato; parcial só com indício no texto ou no documento (senão toda tarifa "casaria")
       and (abs(a.saldo - abs(l.valor)) <= v_par.tolerancia_divergencia
            or (abs(l.valor) < a.saldo
                and (public.fin_similar(l.descricao, a.descricao || ' ' || a.documento) > 0
                     or (l.documento is not null and position(l.documento in a.documento) > 0))))
       and abs(coalesce(a.ref_data, l.data) - l.data) <= greatest(v_par.dias_janela_conciliacao * 10, 30)
  ),
  filtrados as (
    select c.*, row_number() over (partition by c.linha_id order by c.pontos desc, c.ref_data) as ordem,
           count(*) over (partition by c.tipo, c.alvo_id) as disputa
      from candidatos c
     where not exists (select 1 from public.fin_sugestoes_rejeitadas sr
                        where sr.linha_id = c.linha_id and sr.alvo_tipo = c.tipo and sr.alvo_id = c.alvo_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'linha_id', l.id, 'data', l.data, 'valor', l.valor, 'descricao', l.descricao, 'documento', l.documento,
           'sugestoes', coalesce((select jsonb_agg(jsonb_build_object(
                           'tipo', f.tipo, 'alvo_id', f.alvo_id, 'natureza', f.natureza, 'valor', f.valor, 'data', f.ref_data,
                           'descricao', f.descricao, 'pontos', f.pontos,
                           'sinais', to_jsonb(f.sinais || case when f.disputa > 1 then array['disputada'] else array[]::text[] end))
                           order by f.ordem)
                          from filtrados f where f.linha_id = l.id and f.ordem <= 3), '[]'::jsonb))
           order by l.data, l.valor), '[]'::jsonb)
    into v_res
    from linhas l;
  return v_res;
end $$;

create or replace function public.fin_conciliar(_linha uuid, _tipo text, _alvo uuid, _permitir_excedente boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'conciliar');
  l public.fin_extrato_linhas;
  b public.fin_baixas;
  v_baixa uuid;
  v_id uuid;
  v_criou boolean := false;
  v_tol numeric := (public.fin_param(v_corr)).tolerancia_divergencia;
begin
  select * into l from public.fin_extrato_linhas where id = _linha and correspondente_id = v_corr for update;
  if not found then raise exception 'Movimentação não encontrada.' using errcode = 'P0002'; end if;
  if l.situacao <> 'pendente' then
    raise exception 'Esta movimentação já está %.', l.situacao using errcode = '55000';
  end if;
  if _tipo = 'baixa' then
    select * into b from public.fin_baixas where id = _alvo and correspondente_id = v_corr for update;
    if not found or b.estornada_em is not null then raise exception 'Pagamento não encontrado ou estornado.' using errcode = 'P0002'; end if;
    if b.sentido <> (case when l.valor > 0 then 'entrada' else 'saida' end) then
      raise exception 'Entrada do extrato não concilia com pagamento (e vice-versa).' using errcode = '22023';
    end if;
    if abs(b.valor - abs(l.valor)) > v_tol then
      raise exception 'Valores diferentes (extrato R$ %, registrado R$ %).', to_char(abs(l.valor), 'FM999G999G990D00'),
        to_char(b.valor, 'FM999G999G990D00') using errcode = '22023';
    end if;
    if not public.fin_pode(public.fin_modulo_natureza(b.natureza), 'view') then
      raise exception 'Você não tem acesso a este lançamento.' using errcode = '42501';
    end if;
    v_baixa := b.id;
  elsif _tipo in ('comissao_banco', 'conta_receber', 'conta_pagar', 'comissao_participante') then
    if (_tipo in ('comissao_banco', 'conta_receber')) <> (l.valor > 0) then
      raise exception 'Entrada do extrato só concilia com recebimento (e saída com pagamento).' using errcode = '22023';
    end if;
    v_baixa := public.fin_registrar_baixa(_tipo, _alvo, abs(l.valor), l.data, l.conta_bancaria_id, 'Extrato', l.documento,
                                          left('Conciliação: ' || l.descricao, 500), null, _permitir_excedente, 'conciliacao');
    v_criou := true;
  else
    raise exception 'Tipo de conciliação inválido.' using errcode = '22023';
  end if;
  perform public.fin_ctx('conciliada', null);
  insert into public.fin_conciliacoes (correspondente_id, linha_id, baixa_id, criou_baixa, confirmado_por)
  values (v_corr, _linha, v_baixa, v_criou, auth.uid())
  returning id into v_id;
  update public.fin_extrato_linhas set situacao = 'conciliada' where id = _linha;
  perform public.fin_ctx_fim();
  return v_id;
exception when unique_violation then
  raise exception 'Esta movimentação ou este pagamento já foi conciliado.' using errcode = '55000';
end $$;

create or replace function public.fin_desfazer_conciliacao(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'conciliar');
  c public.fin_conciliacoes;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo para desfazer.' using errcode = '22023'; end if;
  select * into c from public.fin_conciliacoes where id = _id and correspondente_id = v_corr for update;
  if not found or c.desfeita_em is not null then raise exception 'Conciliação não encontrada ou já desfeita.' using errcode = 'P0002'; end if;
  perform public.fin_ctx('conciliacao_desfeita', _motivo);
  update public.fin_conciliacoes set desfeita_em = now(), desfeita_por = auth.uid(), desfeita_motivo = btrim(_motivo) where id = _id;
  update public.fin_extrato_linhas set situacao = 'pendente' where id = c.linha_id and situacao = 'conciliada';
  if c.criou_baixa then
    perform public.fin_estornar_baixa(c.baixa_id, 'Conciliação desfeita: ' || btrim(_motivo), 'conciliacao');
  end if;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_rejeitar_sugestao(_linha uuid, _tipo text, _alvo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'conciliar');
begin
  if not exists (select 1 from public.fin_extrato_linhas where id = _linha and correspondente_id = v_corr) then
    raise exception 'Movimentação não encontrada.' using errcode = 'P0002';
  end if;
  perform public.fin_ctx('sugestao_rejeitada', null);
  insert into public.fin_sugestoes_rejeitadas (linha_id, alvo_tipo, alvo_id, correspondente_id, rejeitada_por)
  values (_linha, _tipo, _alvo, v_corr, auth.uid()) on conflict do nothing;
  perform public.fin_ctx_fim();
end $$;

/** Ignorar (tarifa, transferência entre contas próprias…) ou reabrir uma movimentação. */
create or replace function public.fin_ignorar_linha(_linha uuid, _motivo text, _reabrir boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'conciliar');
begin
  if _reabrir then
    perform public.fin_ctx('linha_reaberta', _motivo);
    update public.fin_extrato_linhas set situacao = 'pendente', ignorada_motivo = null, ignorada_por = null, ignorada_em = null
     where id = _linha and correspondente_id = v_corr and situacao = 'ignorada';
  else
    if length(btrim(coalesce(_motivo, ''))) < 3 then raise exception 'Escreva por que a movimentação fica de fora.' using errcode = '22023'; end if;
    perform public.fin_ctx('linha_ignorada', _motivo);
    update public.fin_extrato_linhas set situacao = 'ignorada', ignorada_motivo = btrim(_motivo), ignorada_por = auth.uid(), ignorada_em = now()
     where id = _linha and correspondente_id = v_corr and situacao = 'pendente';
  end if;
  if not found then raise exception 'Movimentação não encontrada nessa situação.' using errcode = 'P0002'; end if;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_extratos_listar()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.fin_pode('financeiro.conciliacao', 'view') then null else
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'conta', cb.apelido, 'conta_bancaria_id', e.conta_bancaria_id, 'arquivo', e.arquivo_nome, 'formato', e.formato,
      'periodo_de', e.periodo_de, 'periodo_ate', e.periodo_ate, 'total', e.linhas_total, 'novas', e.linhas_novas,
      'duplicadas', e.linhas_duplicadas, 'importado_em', e.importado_em, 'importado_por', pr.nome,
      'pendentes', (select count(*) from public.fin_extrato_linhas l where l.extrato_id = e.id and l.situacao = 'pendente'),
      'conciliadas', (select count(*) from public.fin_extrato_linhas l where l.extrato_id = e.id and l.situacao = 'conciliada'))
      order by e.importado_em desc)
      from public.fin_extratos e
      join public.fin_contas_bancarias cb on cb.id = e.conta_bancaria_id
      left join public.profiles pr on pr.id = e.importado_por
     where e.correspondente_id = public.fin_corr()), '[]'::jsonb) end
$$;

create or replace function public.fin_extrato_detalhe(_extrato uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'view');
begin
  if not exists (select 1 from public.fin_extratos where id = _extrato and correspondente_id = v_corr) then
    raise exception 'Extrato não encontrado.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'linhas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'data', l.data, 'valor', l.valor, 'descricao', l.descricao, 'documento', l.documento, 'situacao', l.situacao,
        'ignorada_motivo', l.ignorada_motivo,
        'conciliacao', (select jsonb_build_object('id', fc.id, 'baixa_id', fc.baixa_id, 'criou_baixa', fc.criou_baixa,
                                                  'natureza', b.natureza, 'alvo_id', b.alvo_id,
                                                  'descricao', public.fin_descricao_alvo(b.natureza, b.alvo_id),
                                                  'confirmado_em', fc.confirmado_em, 'confirmado_por', pr.nome)
                          from public.fin_conciliacoes fc join public.fin_baixas b on b.id = fc.baixa_id
                          left join public.profiles pr on pr.id = fc.confirmado_por
                         where fc.linha_id = l.id and fc.desfeita_em is null))
        order by l.data, l.valor) from public.fin_extrato_linhas l where l.extrato_id = _extrato), '[]'::jsonb),
    'sugestoes', public.fin_sugestoes_conciliacao(_extrato));
end $$;

-- -----------------------------------------------------------------------------
-- 2. Listas e detalhe para as telas
-- -----------------------------------------------------------------------------
create or replace function public.fin_cb_listar(_f jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'view');
  v_busca text := nullif(public.fin_normalizar(btrim(_f ->> 'busca')), '');
  v_de date := nullif(_f ->> 'de', '')::date;
  v_ate date := nullif(_f ->> 'ate', '')::date;
begin
  return (with base as (
    select c.*, p.numero_proposta, p.status::text as proposta_status
      from public.comissoes c left join public.propostas p on p.id = c.proposta_id
     where c.correspondente_id = v_corr
       and (nullif(_f ->> 'situacao', '') is null or c.situacao = _f ->> 'situacao')
       and (nullif(_f ->> 'banco', '') is null or c.banco_nome = _f ->> 'banco')
       and (nullif(_f ->> 'produto', '') is null or c.produto = _f ->> 'produto')
       and (nullif(_f ->> 'proposta_id', '') is null or c.proposta_id = (_f ->> 'proposta_id')::uuid)
       and (v_de is null or coalesce(c.previsao_recebimento, c.created_at::date) >= v_de)
       and (v_ate is null or coalesce(c.previsao_recebimento, c.created_at::date) <= v_ate)
       and (v_busca is null or public.fin_normalizar(concat_ws(' ', c.cliente_nome, c.banco_nome, c.numero_contrato, p.numero_proposta)) like '%' || v_busca || '%'))
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'proposta_id', b.proposta_id, 'numero_proposta', b.numero_proposta, 'proposta_status', b.proposta_status,
        'cliente', b.cliente_nome, 'banco', b.banco_nome, 'produto', b.produto, 'contrato', b.numero_contrato,
        'base', b.valor_base, 'percentual', b.percentual, 'previsto', b.valor_bruto, 'informado', b.valor_informado,
        'recebido', b.valor_recebido, 'diferenca', case when b.valor_recebido > 0 or b.valor_informado is not null
                                                       then b.valor_recebido - coalesce(b.valor_informado, b.valor_bruto) end,
        'situacao', b.situacao, 'previsao_recebimento', b.previsao_recebimento, 'origem', b.origem,
        'sem_regra', coalesce((b.origem_calculo ->> 'sem_regra')::boolean, false), 'criado_em', b.created_at)
        order by coalesce(b.previsao_recebimento, b.created_at::date) desc)
        from (select * from base order by coalesce(previsao_recebimento, created_at::date) desc limit 500) b), '[]'::jsonb),
    'totais', (select jsonb_build_object(
        'quantidade', count(*) filter (where situacao <> 'cancelado'),
        'previsto', coalesce(sum(valor_bruto) filter (where situacao <> 'cancelado'), 0),
        'informado', coalesce(sum(valor_informado) filter (where situacao <> 'cancelado'), 0),
        'recebido', coalesce(sum(valor_recebido), 0),
        'a_receber', coalesce(sum(greatest(coalesce(valor_informado, valor_bruto) - valor_recebido, 0))
                              filter (where situacao in ('previsto', 'a_receber', 'parcial', 'divergente', 'contestado')), 0),
        'divergentes', count(*) filter (where situacao = 'divergente'),
        'contestadas', count(*) filter (where situacao = 'contestado'),
        'vencidas', count(*) filter (where situacao in ('previsto', 'a_receber', 'divergente') and valor_recebido = 0
                                     and previsao_recebimento < current_date)) from base)));
end $$;

create or replace function public.fin_cu_listar(_f jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'view');
  v_busca text := nullif(public.fin_normalizar(btrim(_f ->> 'busca')), '');
  v_de date := nullif(_f ->> 'de', '')::date;
  v_ate date := nullif(_f ->> 'ate', '')::date;
begin
  return (with base as (
    select cu.*, pr.nome as pessoa, pr.acesso_tipo::text as pessoa_tipo
      from public.comissoes_usuario cu left join public.profiles pr on pr.id = cu.usuario_id
     where cu.correspondente_id = v_corr
       and (nullif(_f ->> 'situacao', '') is null or cu.situacao = _f ->> 'situacao')
       and (nullif(_f ->> 'pessoa_id', '') is null or cu.usuario_id = (_f ->> 'pessoa_id')::uuid)
       and (nullif(_f ->> 'papel', '') is null or cu.papel = _f ->> 'papel')
       and (nullif(_f ->> 'banco', '') is null or cu.banco_nome = _f ->> 'banco')
       and (nullif(_f ->> 'proposta_id', '') is null or cu.proposta_id = (_f ->> 'proposta_id')::uuid)
       and (v_de is null or coalesce(cu.vencimento, cu.created_at::date) >= v_de)
       and (v_ate is null or coalesce(cu.vencimento, cu.created_at::date) <= v_ate)
       and (v_busca is null or public.fin_normalizar(concat_ws(' ', pr.nome, cu.numero_proposta, cu.banco_nome, cu.produto)) like '%' || v_busca || '%'))
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'proposta_id', b.proposta_id, 'numero_proposta', b.numero_proposta, 'pessoa_id', b.usuario_id, 'pessoa', b.pessoa,
        'pessoa_tipo', b.pessoa_tipo, 'papel', b.papel, 'tipo_vinculo', b.tipo_vinculo, 'gatilho', b.gatilho, 'banco', b.banco_nome,
        'produto', b.produto, 'base_calculo', b.base_calculo, 'base', b.valor_base, 'percentual', b.percentual,
        'tipo_valor', coalesce(b.regra_snapshot ->> 'tipo_valor', 'percentual'), 'valor', b.valor_comissao, 'valor_original', b.valor_original,
        'pago', b.valor_pago, 'saldo', b.valor_comissao - b.valor_pago, 'situacao', b.situacao, 'vencimento', b.vencimento,
        'origem', b.origem, 'regra_individual', coalesce((b.regra_snapshot ->> 'regra_individual')::boolean, b.regra_id is not null),
        'contestacao_motivo', b.contestacao_motivo, 'ajuste_motivo', b.ajuste_motivo, 'criado_em', b.created_at)
        order by coalesce(b.vencimento, b.created_at::date) desc)
        from (select * from base order by coalesce(vencimento, created_at::date) desc limit 500) b), '[]'::jsonb),
    'totais', (select jsonb_build_object(
        'quantidade', count(*) filter (where situacao <> 'cancelada'),
        'previstas', coalesce(sum(valor_comissao) filter (where situacao in ('prevista', 'ajustada')), 0),
        'aguardando', coalesce(sum(valor_comissao) filter (where situacao = 'aguardando_confirmacao'), 0),
        'aprovadas', coalesce(sum(valor_comissao - valor_pago) filter (where situacao in ('aprovada', 'parcial')), 0),
        'pagas', coalesce(sum(valor_pago), 0),
        'contestadas', count(*) filter (where situacao = 'contestada')) from base)));
end $$;

create or replace function public.fin_contas_listar(_tipo text, _f jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir(case _tipo when 'pagar' then 'financeiro.contas_pagar' else 'financeiro.contas_receber' end, 'view');
  v_busca text := nullif(public.fin_normalizar(btrim(_f ->> 'busca')), '');
  v_de date := nullif(_f ->> 'de', '')::date;
  v_ate date := nullif(_f ->> 'ate', '')::date;
  v_sit text := coalesce(nullif(_f ->> 'situacao', ''), 'abertas');
begin
  if _tipo not in ('pagar', 'receber') then raise exception 'Tipo inválido.' using errcode = '22023'; end if;
  return (with base as (
    select x.id, x.numero, x.descricao, x.contraparte, x.vencimento, x.valor, x.valor_pago, x.status::text as status, x.recorrencia::text recorrencia,
           x.parcela_numero, x.parcelas, x.categoria_id, x.cost_center_id, x.payment_method_id, x.rascunho, x.linha_digitavel,
           x.fornecedor_id, x.proposta_id, x.origem_tipo, x.observacao, x.created_at,
           (x.status in ('aberta', 'parcial', 'atrasada') and x.vencimento < current_date) as vencida,
           cat.nome as categoria, cc.nome as centro_custo
      from (select p.id, p.numero, p.descricao, coalesce(f.nome, p.fornecedor, p.boleto_beneficiario) contraparte, p.vencimento, p.valor,
                   p.valor_pago, p.status, p.recorrencia, p.parcela_numero, p.parcelas, p.categoria_id, p.cost_center_id,
                   p.payment_method_id, p.rascunho, p.linha_digitavel, p.fornecedor_id, null::uuid proposta_id, p.origem_tipo,
                   p.observacao, p.created_at
              from public.financial_payables p left join public.fin_fornecedores f on f.id = p.fornecedor_id
             where _tipo = 'pagar' and p.correspondente_id = v_corr and p.natureza = 'operacional'
            union all
            select r.id, r.numero, r.descricao, r.pagador, r.vencimento, r.valor, r.valor_pago, r.status, r.recorrencia,
                   r.parcela_numero, r.parcelas, r.categoria_id, r.cost_center_id, r.payment_method_id, false, null, null,
                   r.proposta_id, r.origem_tipo, r.observacao, r.created_at
              from public.financial_receivables r
             where _tipo = 'receber' and r.correspondente_id = v_corr and r.natureza = 'operacional') x
      left join public.financial_categories cat on cat.id = x.categoria_id
      left join public.financial_cost_centers cc on cc.id = x.cost_center_id
     where (nullif(_f ->> 'fornecedor_id', '') is null or x.fornecedor_id = (_f ->> 'fornecedor_id')::uuid)
       and (nullif(_f ->> 'categoria_id', '') is null or x.categoria_id = (_f ->> 'categoria_id')::uuid)
       and (v_de is null or x.vencimento >= v_de) and (v_ate is null or x.vencimento <= v_ate)
       and (v_busca is null or public.fin_normalizar(concat_ws(' ', x.numero, x.descricao, x.contraparte, cat.nome)) like '%' || v_busca || '%'))
  select jsonb_build_object(
    'itens', coalesce((select jsonb_agg(to_jsonb(b) order by b.vencimento, b.numero) from (
        select * from base
         where case v_sit
                 when 'abertas' then status in ('aberta', 'parcial', 'atrasada') and not rascunho
                 when 'vencidas' then vencida and not rascunho
                 when 'pagas' then status = 'paga'
                 when 'canceladas' then status = 'cancelada'
                 when 'rascunhos' then rascunho
                 when 'recorrentes' then recorrencia <> 'nenhuma' and not rascunho
                 else not rascunho end
         order by vencimento limit 800) b), '[]'::jsonb),
    'totais', (select jsonb_build_object(
        'abertas', coalesce(sum(valor - valor_pago) filter (where status in ('aberta', 'parcial', 'atrasada') and not rascunho), 0),
        'abertas_qtd', count(*) filter (where status in ('aberta', 'parcial', 'atrasada') and not rascunho),
        'vencidas', coalesce(sum(valor - valor_pago) filter (where vencida and not rascunho), 0),
        'vencidas_qtd', count(*) filter (where vencida and not rascunho),
        'pagas', coalesce(sum(valor_pago) filter (where not rascunho), 0),
        'recorrentes_qtd', count(*) filter (where recorrencia <> 'nenhuma' and not rascunho and status <> 'cancelada'),
        'rascunhos_qtd', count(*) filter (where rascunho)) from base)));
end $$;

/** Detalhe de qualquer lançamento: dados, pagamentos, anexos e trilha. */
create or replace function public.fin_lancamento_detalhe(_natureza text, _id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir(public.fin_modulo_natureza(_natureza), 'view');
  v_item jsonb;
  v_tab text := case _natureza when 'comissao_banco' then 'comissoes' when 'comissao_participante' then 'comissoes_usuario'
                               when 'conta_pagar' then 'financial_payables' when 'conta_receber' then 'financial_receivables' end;
begin
  if v_tab is null then raise exception 'Natureza inválida.' using errcode = '22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.correspondente_id = $2', v_tab) into v_item using _id, v_corr;
  if v_item is null then raise exception 'Lançamento não encontrado.' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'item', v_item,
    'descricao', public.fin_descricao_alvo(_natureza, _id),
    'baixas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'valor', b.valor, 'data', b.data, 'forma', b.forma, 'documento', b.documento, 'observacao', b.observacao,
        'origem', b.origem, 'conta', cb.apelido, 'registrado_por', pr.nome, 'registrado_em', b.registrado_em,
        'estornada_em', b.estornada_em, 'estorno_motivo', b.estorno_motivo,
        'anexo', case when a.id is not null then jsonb_build_object('id', a.id, 'nome', a.nome, 'caminho', a.caminho) end,
        'conciliada', exists (select 1 from public.fin_conciliacoes fc where fc.baixa_id = b.id and fc.desfeita_em is null))
        order by b.data, b.registrado_em)
        from public.fin_baixas b
        left join public.fin_contas_bancarias cb on cb.id = b.conta_bancaria_id
        left join public.profiles pr on pr.id = b.registrado_por
        left join public.fin_anexos a on a.id = b.anexo_id
       where b.natureza = _natureza and b.alvo_id = _id), '[]'::jsonb),
    'anexos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'caminho', a.caminho, 'tipo', a.tipo,
                                                             'enviado_em', a.enviado_em, 'enviado_por', pr.nome) order by a.enviado_em)
        from public.fin_anexos a left join public.profiles pr on pr.id = a.enviado_por
       where a.removido_em is null and a.correspondente_id = v_corr
         and ((a.entidade = v_tab and a.entidade_id = _id)
              or (a.entidade = 'fin_baixas' and a.entidade_id in (select id from public.fin_baixas where natureza = _natureza and alvo_id = _id)))), '[]'::jsonb),
    'trilha', case when public.fin_pode('financeiro.auditoria', 'view') or public.fin_pode(public.fin_modulo_natureza(_natureza), 'edit') then
        coalesce((select jsonb_agg(jsonb_build_object('acao', au.acao, 'quando', au.criado_em, 'quem', pr.nome, 'motivo', au.motivo,
                                                      'antes', au.antes, 'depois', au.depois, 'entidade', au.entidade) order by au.criado_em)
                    from public.fin_auditoria au left join public.profiles pr on pr.id = au.ator_id
                   where au.correspondente_id = v_corr
                     and ((au.entidade = v_tab and au.entidade_id = _id)
                          or (au.entidade = 'fin_baixas' and au.entidade_id in (select id from public.fin_baixas where natureza = _natureza and alvo_id = _id)))),
                 '[]'::jsonb) end);
end $$;

create or replace function public.fin_auditoria_listar(_f jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.auditoria', 'view');
  v_de date := nullif(_f ->> 'de', '')::date;
  v_ate date := nullif(_f ->> 'ate', '')::date;
begin
  return coalesce((select jsonb_agg(x order by (x ->> 'quando') desc) from (
    select jsonb_build_object('id', au.id, 'entidade', au.entidade, 'entidade_id', au.entidade_id, 'acao', au.acao,
                              'quando', au.criado_em, 'quem', pr.nome, 'motivo', au.motivo, 'antes', au.antes, 'depois', au.depois) x
      from public.fin_auditoria au left join public.profiles pr on pr.id = au.ator_id
     where au.correspondente_id = v_corr
       and (nullif(_f ->> 'entidade', '') is null or au.entidade = _f ->> 'entidade')
       and (nullif(_f ->> 'acao', '') is null or au.acao = _f ->> 'acao')
       and (nullif(_f ->> 'ator_id', '') is null or au.ator_id = (_f ->> 'ator_id')::uuid)
       and (v_de is null or au.criado_em >= v_de) and (v_ate is null or au.criado_em < v_ate + 1)
     order by au.criado_em desc limit 400) y), '[]'::jsonb);
end $$;

/** Tudo que as telas precisam para selects e regras. */
create or replace function public.fin_cadastros()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_corr uuid := public.fin_corr();
begin
  if v_corr is null or not public.usuario_pode_financeiro(auth.uid()) and not exists (
       select 1 from unnest(array['financeiro.painel', 'financeiro.comissoes_bancos', 'financeiro.repasses', 'financeiro.comissoes',
                                  'financeiro.contas_pagar', 'financeiro.contas_receber', 'financeiro.conciliacao',
                                  'financeiro.fluxo_caixa', 'financeiro.regras', 'financeiro.auditoria']) m where public.fin_pode(m, 'view')) then
    raise exception 'Você não tem acesso ao financeiro.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'parametros', to_jsonb(public.fin_param(v_corr)),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'tipo', tipo, 'ativo', ativo) order by nome)
                              from public.financial_categories where correspondente_id = v_corr), '[]'),
    'centros', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'ativo', ativo) order by nome)
                           from public.financial_cost_centers where correspondente_id = v_corr), '[]'),
    'formas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'ativo', ativo) order by nome)
                          from public.financial_payment_methods where correspondente_id = v_corr), '[]'),
    'contas_bancarias', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'apelido', apelido, 'banco_codigo', banco_codigo,
                                    'banco_nome', banco_nome, 'agencia', agencia, 'conta', conta, 'ativo', ativo) order by apelido)
                                    from public.fin_contas_bancarias where correspondente_id = v_corr), '[]'),
    'fornecedores', case when public.fin_pode('financeiro.contas_pagar', 'view') or public.fin_pode('financeiro.regras', 'view') then
                      coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'documento', documento, 'email', email,
                                  'telefone', telefone, 'categoria_id', categoria_id, 'ativo', ativo) order by nome)
                                  from public.fin_fornecedores where correspondente_id = v_corr), '[]') end,
    'regras_banco', case when public.fin_pode('financeiro.comissoes_bancos', 'view') then
                      coalesce((select jsonb_agg(to_jsonb(r) order by r.ativo desc, r.banco_nome nulls last, r.produto nulls last, r.faixa_min)
                                  from public.comissao_regras r where r.correspondente_id = v_corr), '[]') end,
    'regras_participantes', case when public.fin_pode('financeiro.comissoes', 'view') then
                      coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('pessoa', pr.nome) order by r.ativo desc, pr.nome nulls first)
                                  from public.comissao_regras_usuario r left join public.profiles pr on pr.id = r.usuario_id
                                 where r.correspondente_id = v_corr), '[]') end,
    'pessoas', case when public.fin_pode('financeiro.comissoes', 'view') then
                      coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', coalesce(pr.nome, pr.email), 'tipo', pr.acesso_tipo,
                                  'ativo', pr.ativo and pr.deleted_at is null) order by pr.nome)
                                  from public.profiles pr where pr.correspondente_id = v_corr and pr.deleted_at is null), '[]') end,
    'bancos', coalesce((select jsonb_agg(distinct banco_nome) from (
                          select banco_nome from public.comissoes where correspondente_id = v_corr and banco_nome is not null
                          union select nome_banco from public.propostas where correspondente_id = v_corr and nome_banco is not null) b), '[]'),
    'produtos', coalesce((select jsonb_agg(distinct produto) from public.propostas where correspondente_id = v_corr and produto is not null), '[]'));
end $$;

/** Demonstrativo individual (a própria pessoa, ou quem vê as comissões). */
create or replace function public.fin_demonstrativo(_pessoa uuid, _de date, _ate date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_corr uuid := public.correspondente_do_usuario(auth.uid());
begin
  if v_corr is null or not (public.fin_pode('financeiro.comissoes', 'view') or _pessoa = auth.uid()) then
    raise exception 'Você não tem permissão para ver este demonstrativo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _pessoa and correspondente_id = v_corr) then
    raise exception 'Pessoa não encontrada.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'pessoa', (select jsonb_build_object('id', id, 'nome', nome, 'email', email) from public.profiles where id = _pessoa),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', cu.id, 'proposta', cu.numero_proposta, 'banco', cu.banco_nome, 'produto', cu.produto, 'papel', cu.papel,
        'base', cu.valor_base, 'percentual', cu.percentual, 'valor', cu.valor_comissao, 'pago', cu.valor_pago,
        'situacao', cu.situacao, 'vencimento', cu.vencimento, 'criado_em', cu.created_at, 'contestacao_motivo', cu.contestacao_motivo,
        'pagamentos', coalesce((select jsonb_agg(jsonb_build_object('data', b.data, 'valor', b.valor, 'forma', b.forma) order by b.data)
                                  from public.fin_baixas b where b.natureza = 'comissao_participante' and b.alvo_id = cu.id
                                   and b.estornada_em is null), '[]'::jsonb))
        order by cu.created_at desc)
        from public.comissoes_usuario cu
       where cu.usuario_id = _pessoa and cu.correspondente_id = v_corr and cu.situacao <> 'cancelada'
         and (_de is null or cu.created_at >= _de) and (_ate is null or cu.created_at < _ate + 1)), '[]'::jsonb),
    'totais', (select jsonb_build_object(
        'previsto', coalesce(sum(valor_comissao) filter (where situacao in ('prevista', 'aguardando_confirmacao', 'ajustada', 'contestada')), 0),
        'a_pagar', coalesce(sum(valor_comissao - valor_pago) filter (where situacao in ('aprovada', 'parcial')), 0),
        'pago', coalesce(sum(valor_pago), 0))
        from public.comissoes_usuario
       where usuario_id = _pessoa and correspondente_id = v_corr and situacao <> 'cancelada'
         and (_de is null or created_at >= _de) and (_ate is null or created_at < _ate + 1)));
end $$;

-- -----------------------------------------------------------------------------
-- 3. Painel e relatórios (cada natureza no seu bloco; sem permissão de ver = bloco nulo)
-- -----------------------------------------------------------------------------
create or replace function public.fin_painel(_de date, _ate date, _f jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.painel', 'view');
  v_banco text := nullif(_f ->> 'banco', '');
  v_prod text := nullif(_f ->> 'produto', '');
  v_prop uuid := nullif(_f ->> 'proposta_id', '')::uuid;
  v_pessoa uuid := nullif(_f ->> 'pessoa_id', '')::uuid;
  v_forn uuid := nullif(_f ->> 'fornecedor_id', '')::uuid;
  v_cat uuid := nullif(_f ->> 'categoria_id', '')::uuid;
  v_ver_cb boolean := public.fin_pode('financeiro.comissoes_bancos', 'view');
  v_ver_cu boolean := public.fin_pode('financeiro.comissoes', 'view');
  v_ver_cp boolean := public.fin_pode('financeiro.contas_pagar', 'view');
  v_ver_cr boolean := public.fin_pode('financeiro.contas_receber', 'view');
  v_ver_rp boolean := public.fin_pode('financeiro.repasses', 'view');
begin
  if _de is null or _ate is null or _ate < _de or _ate - _de > 1100 then
    raise exception 'Período inválido (até 3 anos).' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'periodo', jsonb_build_object('de', _de, 'ate', _ate),
    'bancos', case when v_ver_cb then (
      select jsonb_build_object(
        'quantidade', count(*), 'previsto', coalesce(sum(c.valor_bruto), 0), 'informado', coalesce(sum(c.valor_informado), 0),
        'recebido', coalesce(sum(c.valor_recebido), 0),
        'a_receber', coalesce(sum(greatest(coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido, 0))
                              filter (where c.situacao not in ('recebido', 'cancelado')), 0),
        'divergentes', count(*) filter (where c.situacao = 'divergente'),
        'divergente_valor', coalesce(sum(abs(coalesce(c.valor_informado, c.valor_bruto) - case when c.valor_recebido > 0 then c.valor_recebido else c.valor_bruto end))
                                     filter (where c.situacao = 'divergente'), 0),
        'contestadas', count(*) filter (where c.situacao = 'contestado'),
        'vencidas_qtd', count(*) filter (where c.situacao in ('previsto', 'a_receber', 'divergente') and c.valor_recebido = 0 and c.previsao_recebimento < current_date),
        'vencidas_valor', coalesce(sum(coalesce(c.valor_informado, c.valor_bruto)) filter (where c.situacao in ('previsto', 'a_receber', 'divergente')
                                       and c.valor_recebido = 0 and c.previsao_recebimento < current_date), 0),
        'por_situacao', coalesce((select jsonb_object_agg(s, n) from (select situacao s, count(*) n from public.comissoes c2
                                   where c2.correspondente_id = v_corr and coalesce(c2.previsao_recebimento, c2.created_at::date) between _de and _ate
                                     and (v_banco is null or c2.banco_nome = v_banco) and (v_prod is null or c2.produto = v_prod)
                                     and (v_prop is null or c2.proposta_id = v_prop) group by situacao) z), '{}'::jsonb),
        'por_banco', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'previsto', previsto, 'recebido', recebido) order by previsto desc)
                                 from (select coalesce(c3.banco_nome, 'Sem banco') banco, sum(c3.valor_bruto) previsto, sum(c3.valor_recebido) recebido
                                         from public.comissoes c3
                                        where c3.correspondente_id = v_corr and c3.situacao <> 'cancelado'
                                          and coalesce(c3.previsao_recebimento, c3.created_at::date) between _de and _ate
                                          and (v_banco is null or c3.banco_nome = v_banco) and (v_prod is null or c3.produto = v_prod)
                                          and (v_prop is null or c3.proposta_id = v_prop)
                                        group by 1 order by 2 desc limit 12) w), '[]'::jsonb))
        from public.comissoes c
       where c.correspondente_id = v_corr and c.situacao <> 'cancelado'
         and coalesce(c.previsao_recebimento, c.created_at::date) between _de and _ate
         and (v_banco is null or c.banco_nome = v_banco) and (v_prod is null or c.produto = v_prod)
         and (v_prop is null or c.proposta_id = v_prop)) end,
    'participantes', case when v_ver_cu then (
      select jsonb_build_object(
        'quantidade', count(*), 'previstas', coalesce(sum(cu.valor_comissao) filter (where cu.situacao in ('prevista', 'ajustada')), 0),
        'aguardando', coalesce(sum(cu.valor_comissao) filter (where cu.situacao = 'aguardando_confirmacao'), 0),
        'aprovadas', coalesce(sum(cu.valor_comissao - cu.valor_pago) filter (where cu.situacao in ('aprovada', 'parcial')), 0),
        'pagas', coalesce(sum(cu.valor_pago), 0),
        'contestadas', count(*) filter (where cu.situacao = 'contestada'),
        'por_pessoa', coalesce((select jsonb_agg(jsonb_build_object('pessoa', nome, 'valor', valor, 'pago', pago) order by valor desc)
                                  from (select coalesce(pr.nome, 'Sem nome') nome, sum(x.valor_comissao) valor, sum(x.valor_pago) pago
                                          from public.comissoes_usuario x left join public.profiles pr on pr.id = x.usuario_id
                                         where x.correspondente_id = v_corr and x.situacao <> 'cancelada'
                                           and coalesce(x.vencimento, x.created_at::date) between _de and _ate
                                           and (v_pessoa is null or x.usuario_id = v_pessoa) and (v_banco is null or x.banco_nome = v_banco)
                                           and (v_prod is null or x.produto = v_prod) and (v_prop is null or x.proposta_id = v_prop)
                                         group by 1 order by 2 desc limit 10) w), '[]'::jsonb))
        from public.comissoes_usuario cu
       where cu.correspondente_id = v_corr and cu.situacao <> 'cancelada'
         and coalesce(cu.vencimento, cu.created_at::date) between _de and _ate
         and (v_pessoa is null or cu.usuario_id = v_pessoa) and (v_banco is null or cu.banco_nome = v_banco)
         and (v_prod is null or cu.produto = v_prod) and (v_prop is null or cu.proposta_id = v_prop)) end,
    'despesas', case when v_ver_cp then (
      select jsonb_build_object(
        'abertas', coalesce(sum(p.valor - p.valor_pago) filter (where p.status in ('aberta', 'parcial', 'atrasada')), 0),
        'vencidas', coalesce(sum(p.valor - p.valor_pago) filter (where p.status in ('aberta', 'parcial', 'atrasada') and p.vencimento < current_date), 0),
        'vencidas_qtd', count(*) filter (where p.status in ('aberta', 'parcial', 'atrasada') and p.vencimento < current_date),
        'pagas', coalesce(sum(p.valor_pago), 0),
        'recorrentes_qtd', count(*) filter (where p.recorrencia <> 'nenhuma' and p.status <> 'cancelada'),
        'rascunhos_qtd', (select count(*) from public.financial_payables r where r.correspondente_id = v_corr and r.rascunho),
        'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria', nome, 'valor', valor) order by valor desc)
                                     from (select coalesce(cat.nome, 'Sem categoria') nome, sum(x.valor) valor
                                             from public.financial_payables x left join public.financial_categories cat on cat.id = x.categoria_id
                                            where x.correspondente_id = v_corr and x.natureza = 'operacional' and not x.rascunho
                                              and x.status <> 'cancelada' and x.vencimento between _de and _ate
                                              and (v_forn is null or x.fornecedor_id = v_forn) and (v_cat is null or x.categoria_id = v_cat)
                                            group by 1 order by 2 desc limit 10) w), '[]'::jsonb))
        from public.financial_payables p
       where p.correspondente_id = v_corr and p.natureza = 'operacional' and not p.rascunho and p.status <> 'cancelada'
         and p.vencimento between _de and _ate
         and (v_forn is null or p.fornecedor_id = v_forn) and (v_cat is null or p.categoria_id = v_cat)) end,
    'receitas', case when v_ver_cr then (
      select jsonb_build_object(
        'abertas', coalesce(sum(r.valor - r.valor_pago) filter (where r.status in ('aberta', 'parcial', 'atrasada')), 0),
        'vencidas', coalesce(sum(r.valor - r.valor_pago) filter (where r.status in ('aberta', 'parcial', 'atrasada') and r.vencimento < current_date), 0),
        'recebidas', coalesce(sum(r.valor_pago), 0))
        from public.financial_receivables r
       where r.correspondente_id = v_corr and r.natureza = 'operacional' and r.status <> 'cancelada'
         and r.vencimento between _de and _ate and (v_cat is null or r.categoria_id = v_cat)) end,
    -- Realizado (livro) x previsto (saldos em aberto pela data esperada), mês a mês e por natureza.
    'fluxo', coalesce((
      select jsonb_agg(jsonb_build_object('mes', mes, 'natureza', natureza, 'previsto', previsto, 'realizado', realizado) order by mes, natureza)
        from (
          select to_char(m, 'YYYY-MM') mes, n natureza,
                 coalesce((select sum(valor) from public.fin_baixas b
                            where b.correspondente_id = v_corr and b.estornada_em is null and b.natureza = n
                              and date_trunc('month', b.data) = m
                              and public.fin_pode(public.fin_modulo_natureza(n), 'view')), 0) realizado,
                 coalesce(case n
                   when 'comissao_banco' then (select sum(greatest(coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido, 0))
                                                 from public.comissoes c where c.correspondente_id = v_corr and v_ver_cb
                                                  and c.situacao not in ('recebido', 'cancelado') and date_trunc('month', c.previsao_recebimento) = m)
                   when 'conta_receber' then (select sum(r.valor - r.valor_pago) from public.financial_receivables r
                                               where r.correspondente_id = v_corr and v_ver_cr and r.natureza = 'operacional'
                                                 and r.status in ('aberta', 'parcial', 'atrasada') and date_trunc('month', r.vencimento) = m)
                   when 'conta_pagar' then (select sum(p.valor - p.valor_pago) from public.financial_payables p
                                             where p.correspondente_id = v_corr and v_ver_cp and p.natureza = 'operacional' and not p.rascunho
                                               and p.status in ('aberta', 'parcial', 'atrasada') and date_trunc('month', p.vencimento) = m)
                   when 'comissao_participante' then (select sum(cu.valor_comissao - cu.valor_pago) from public.comissoes_usuario cu
                                                       where cu.correspondente_id = v_corr and v_ver_cu
                                                         and cu.situacao in ('prevista', 'aguardando_confirmacao', 'aprovada', 'parcial', 'ajustada', 'contestada')
                                                         and date_trunc('month', cu.vencimento) = m)
                 end, 0) previsto
            from generate_series(date_trunc('month', _de), date_trunc('month', _ate), interval '1 month') m
           cross join unnest(array['comissao_banco', 'conta_receber', 'conta_pagar', 'comissao_participante', 'repasse_assinante']) n) f
       where previsto <> 0 or realizado <> 0), '[]'::jsonb),
    'alertas', jsonb_build_object(
      'sem_previsao', case when v_ver_cb then (select count(*) from public.propostas p
                                               where p.correspondente_id = v_corr and p.deleted_at is null
                                                 and p.status::text in ('contrato_emitido', 'registrado')
                                                 and not exists (select 1 from public.comissoes c where c.proposta_id = p.id and c.situacao <> 'cancelado')) end,
      'sem_regra', case when v_ver_cb then (select count(*) from public.comissoes c where c.correspondente_id = v_corr
                                              and c.situacao = 'previsto' and c.valor_bruto = 0) end,
      'vencidas_sem_recebimento', case when v_ver_cb then (select count(*) from public.comissoes c where c.correspondente_id = v_corr
                                               and c.situacao in ('previsto', 'a_receber', 'divergente') and c.valor_recebido = 0
                                               and c.previsao_recebimento < current_date) end,
      'divergencias', case when v_ver_cb then (select count(*) from public.comissoes c where c.correspondente_id = v_corr and c.situacao = 'divergente') end,
      'soma_excedida', case when v_ver_cu then (select count(*) from public.comissoes c
                                                where c.correspondente_id = v_corr and c.situacao <> 'cancelado' and c.proposta_id is not null
                                                  and (select coalesce(sum(cu.valor_comissao), 0) from public.comissoes_usuario cu
                                                        where cu.proposta_id = c.proposta_id and cu.situacao <> 'cancelada')
                                                      > coalesce(case when c.situacao = 'recebido' then c.valor_recebido end, c.valor_informado, c.valor_bruto) + 0.01
                                                  and coalesce(c.valor_informado, c.valor_bruto) > 0) end,
      'contestacoes', case when v_ver_cu then (select count(*) from public.comissoes_usuario where correspondente_id = v_corr and situacao = 'contestada') end,
      'rascunhos', case when v_ver_cp then (select count(*) from public.financial_payables where correspondente_id = v_corr and rascunho) end,
      'despesas_vencidas', case when v_ver_cp then (select count(*) from public.financial_payables where correspondente_id = v_corr
                                                    and natureza = 'operacional' and not rascunho and status in ('aberta', 'parcial', 'atrasada')
                                                    and vencimento < current_date) end,
      'extrato_pendente', case when public.fin_pode('financeiro.conciliacao', 'view') then (
                             select count(*) from public.fin_extrato_linhas where correspondente_id = v_corr and situacao = 'pendente') end,
      'repasses_visiveis', v_ver_rp));
end $$;

/** Relatórios tabulares (cada linha leva o caminho até a origem). */
create or replace function public.fin_relatorio(_tipo text, _de date, _ate date, _f jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid;
  v_res jsonb;
  v_banco text := nullif(_f ->> 'banco', '');
  v_prod text := nullif(_f ->> 'produto', '');
  v_pessoa uuid := nullif(_f ->> 'pessoa_id', '')::uuid;
  v_forn uuid := nullif(_f ->> 'fornecedor_id', '')::uuid;
  v_cat uuid := nullif(_f ->> 'categoria_id', '')::uuid;
begin
  v_corr := public.fin_exigir(case _tipo
    when 'comissoes_bancos' then 'financeiro.comissoes_bancos' when 'sem_previsao' then 'financeiro.comissoes_bancos'
    when 'vencidas' then 'financeiro.comissoes_bancos' when 'diferencas' then 'financeiro.comissoes_bancos'
    when 'comissoes_participantes' then 'financeiro.comissoes' when 'despesas' then 'financeiro.contas_pagar'
    when 'receitas' then 'financeiro.contas_receber' when 'movimentos' then 'financeiro.fluxo_caixa'
    else 'financeiro.relatorio_invalido' end, 'view');
  if _de is null or _ate is null or _ate < _de then raise exception 'Período inválido.' using errcode = '22023'; end if;
  if _tipo = 'comissoes_bancos' or _tipo = 'diferencas' or _tipo = 'vencidas' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'origem', jsonb_build_object('tipo', 'comissao_banco', 'id', c.id, 'proposta_id', c.proposta_id),
             'proposta', p.numero_proposta, 'cliente', c.cliente_nome, 'banco', c.banco_nome, 'produto', c.produto,
             'contrato', c.numero_contrato, 'previsto', c.valor_bruto, 'informado', c.valor_informado, 'recebido', c.valor_recebido,
             'diferenca', case when c.valor_recebido > 0 then c.valor_recebido - coalesce(c.valor_informado, c.valor_bruto)
                               when c.valor_informado is not null then c.valor_informado - c.valor_bruto end,
             'situacao', c.situacao, 'previsao_recebimento', c.previsao_recebimento) order by c.previsao_recebimento), '[]')
      into v_res
      from public.comissoes c left join public.propostas p on p.id = c.proposta_id
     where c.correspondente_id = v_corr and coalesce(c.previsao_recebimento, c.created_at::date) between _de and _ate
       and (v_banco is null or c.banco_nome = v_banco) and (v_prod is null or c.produto = v_prod)
       and (_tipo <> 'diferencas' or c.situacao = 'divergente' or (c.encerrado_com_diferenca)
            or (c.valor_informado is not null and abs(c.valor_informado - c.valor_bruto) > 0.01))
       and (_tipo <> 'vencidas' or (c.situacao in ('previsto', 'a_receber', 'divergente') and c.valor_recebido = 0
                                    and c.previsao_recebimento < current_date));
  elsif _tipo = 'sem_previsao' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'origem', jsonb_build_object('tipo', 'proposta', 'id', p.id, 'proposta_id', p.id),
             'proposta', p.numero_proposta, 'cliente', p.nome_cliente, 'banco', p.nome_banco, 'produto', p.produto,
             'status', p.status, 'valor_financiado', coalesce(p.valor_financiamento_aprovado, p.valor_financiamento),
             'contrato_emitido_em', p.contrato_emitido_em) order by p.contrato_emitido_em nulls last), '[]')
      into v_res
      from public.propostas p
     where p.correspondente_id = v_corr and p.deleted_at is null and p.status::text in ('contrato_emitido', 'registrado')
       and coalesce(p.contrato_emitido_em, p.status_atualizado_em, p.updated_at)::date between _de and _ate
       and (v_banco is null or p.nome_banco = v_banco) and (v_prod is null or p.produto = v_prod)
       and not exists (select 1 from public.comissoes c where c.proposta_id = p.id and c.situacao <> 'cancelado');
  elsif _tipo = 'comissoes_participantes' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'origem', jsonb_build_object('tipo', 'comissao_participante', 'id', cu.id, 'proposta_id', cu.proposta_id),
             'pessoa', pr.nome, 'papel', cu.papel, 'proposta', cu.numero_proposta, 'banco', cu.banco_nome, 'produto', cu.produto,
             'base', cu.valor_base, 'percentual', cu.percentual, 'valor', cu.valor_comissao, 'pago', cu.valor_pago,
             'saldo', cu.valor_comissao - cu.valor_pago, 'situacao', cu.situacao, 'vencimento', cu.vencimento) order by cu.vencimento), '[]')
      into v_res
      from public.comissoes_usuario cu left join public.profiles pr on pr.id = cu.usuario_id
     where cu.correspondente_id = v_corr and coalesce(cu.vencimento, cu.created_at::date) between _de and _ate
       and (v_pessoa is null or cu.usuario_id = v_pessoa) and (v_banco is null or cu.banco_nome = v_banco)
       and (v_prod is null or cu.produto = v_prod);
  elsif _tipo = 'despesas' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'origem', jsonb_build_object('tipo', 'conta_pagar', 'id', p.id),
             'numero', p.numero, 'descricao', p.descricao, 'fornecedor', coalesce(f.nome, p.fornecedor), 'categoria', cat.nome,
             'centro_custo', cc.nome, 'vencimento', p.vencimento, 'valor', p.valor, 'pago', p.valor_pago, 'status', p.status,
             'recorrencia', p.recorrencia) order by p.vencimento), '[]')
      into v_res
      from public.financial_payables p
      left join public.fin_fornecedores f on f.id = p.fornecedor_id
      left join public.financial_categories cat on cat.id = p.categoria_id
      left join public.financial_cost_centers cc on cc.id = p.cost_center_id
     where p.correspondente_id = v_corr and p.natureza = 'operacional' and not p.rascunho and p.vencimento between _de and _ate
       and (v_forn is null or p.fornecedor_id = v_forn) and (v_cat is null or p.categoria_id = v_cat);
  elsif _tipo = 'receitas' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'origem', jsonb_build_object('tipo', 'conta_receber', 'id', r.id, 'proposta_id', r.proposta_id),
             'numero', r.numero, 'descricao', r.descricao, 'pagador', r.pagador, 'categoria', cat.nome, 'origem_tipo', r.origem_tipo,
             'vencimento', r.vencimento, 'valor', r.valor, 'recebido', r.valor_pago, 'status', r.status) order by r.vencimento), '[]')
      into v_res
      from public.financial_receivables r left join public.financial_categories cat on cat.id = r.categoria_id
     where r.correspondente_id = v_corr and r.natureza = 'operacional' and r.vencimento between _de and _ate
       and (v_cat is null or r.categoria_id = v_cat);
  elsif _tipo = 'movimentos' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'origem', jsonb_build_object('tipo', b.natureza, 'id', b.alvo_id),
             'data', b.data, 'natureza', b.natureza, 'sentido', b.sentido, 'valor', b.valor,
             'descricao', public.fin_descricao_alvo(b.natureza, b.alvo_id), 'forma', b.forma, 'conta', cb.apelido,
             'origem_baixa', b.origem, 'estornada', b.estornada_em is not null,
             'conciliada', exists (select 1 from public.fin_conciliacoes fc where fc.baixa_id = b.id and fc.desfeita_em is null))
             order by b.data), '[]')
      into v_res
      from public.fin_baixas b left join public.fin_contas_bancarias cb on cb.id = b.conta_bancaria_id
     where b.correspondente_id = v_corr and b.data between _de and _ate
       and public.fin_pode(public.fin_modulo_natureza(b.natureza), 'view');
  end if;
  return v_res;
end $$;

-- -----------------------------------------------------------------------------
-- Execução
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.fin_importar_extrato(uuid, text, text, text, jsonb, boolean, uuid)', 'public.fin_sugestoes_conciliacao(uuid)',
    'public.fin_conciliar(uuid, text, uuid, boolean)', 'public.fin_desfazer_conciliacao(uuid, text)',
    'public.fin_rejeitar_sugestao(uuid, text, uuid)', 'public.fin_ignorar_linha(uuid, text, boolean)', 'public.fin_extratos_listar()',
    'public.fin_extrato_detalhe(uuid)', 'public.fin_cb_listar(jsonb)', 'public.fin_cu_listar(jsonb)', 'public.fin_contas_listar(text, jsonb)',
    'public.fin_lancamento_detalhe(text, uuid)', 'public.fin_auditoria_listar(jsonb)', 'public.fin_cadastros()',
    'public.fin_demonstrativo(uuid, date, date)', 'public.fin_painel(date, date, jsonb)', 'public.fin_relatorio(text, date, date, jsonb)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.fin_normalizar(text)', 'public.fin_similar(text, text)', 'public.fin_descricao_alvo(text, uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
