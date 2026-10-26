-- Nomes de clientes no padrão "Primeira Letra Maiúscula As Demais Minúsculas" (pedido do dono de
-- 26/10/2026, C32). Uma função só (`public.nome_proprio`) e um gatilho genérico normalizam AO
-- GRAVAR o nome do cliente, da mãe, do pai, do cônjuge (e da mãe do cônjuge) e dos vendedores —
-- de qualquer tela, importação ou função. Preposições (de, da, do, das, dos, e) minúsculas fora da
-- primeira palavra; hífen e apóstrofo respeitados; acentos tratados sem depender da colação.
-- O Agilliza Tech tem a função irmã `crm.nome_proprio` (migração 0317 de lá).
-- Os cadastros existentes são corrigidos aqui sem disparar a propagação para simulações/propostas
-- nem mexer em updated_at (correção de padrão, não edição de cadastro).

create or replace function public.nome_proprio(p text)
returns text
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $$
-- "Primeira Letra Maiúscula As Demais Minúsculas" (C32, 26/10/2026), independente da colação do
-- banco (as acentuadas são trocadas por `translate`, não por `upper`/`lower` da localidade):
--   · espaços (inclusive o não separável) viram um só e as pontas somem;
--   · de, da, do, das, dos, e ficam minúsculas fora da primeira palavra;
--   · partes com hífen ("Ana-Paula") e apóstrofo ("D'Ávila", "O'Brien") têm cada parte maiúscula;
--     a elisão "d'" fica minúscula fora da primeira palavra ("João d'Ávila");
--   · numerais romanos (II…XII) e siglas de empresa (ME, EPP, EIRELI, MEI, S/A, S.A.) ficam maiúsculos
--     fora da primeira palavra.
declare
  minus constant text := 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ';
  maius constant text := 'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝŸ';
  s text;
  palavras text[];
  partes text[];
  pedacos text[];
  res text[] := '{}';
  w text;
  i integer;
  j integer;
  k integer;
begin
  if p is null then return null; end if;
  s := replace(replace(p, chr(160), ' '), '’', '''');
  s := btrim(regexp_replace(s, '[[:space:]]+', ' ', 'g'));
  if s = '' then return s; end if;
  s := translate(lower(s), maius, minus);
  palavras := string_to_array(s, ' ');
  for i in 1 .. array_length(palavras, 1) loop
    w := palavras[i];
    if i > 1 and w in ('de', 'da', 'do', 'das', 'dos', 'e') then
      res := res || w;
      continue;
    end if;
    if i > 1 and (w ~ '^(ii|iii|iv|vi|vii|viii|ix|xi|xii)$' or w in ('me', 'epp', 'eireli', 'mei', 's/a', 's.a.', 's.a')) then
      res := res || translate(upper(w), minus, maius);
      continue;
    end if;
    partes := string_to_array(w, '-');
    for j in 1 .. array_length(partes, 1) loop
      if partes[j] = '' then continue; end if;
      if (i > 1 or j > 1) and partes[j] ~ '^d''.' then
        partes[j] := 'd''' || translate(upper(substr(partes[j], 3, 1)), minus, maius) || substr(partes[j], 4);
        continue;
      end if;
      pedacos := string_to_array(partes[j], '''');
      for k in 1 .. array_length(pedacos, 1) loop
        if pedacos[k] <> '' then
          pedacos[k] := translate(upper(left(pedacos[k], 1)), minus, maius) || substr(pedacos[k], 2);
        end if;
      end loop;
      partes[j] := array_to_string(pedacos, '''');
    end loop;
    res := res || array_to_string(partes, '-');
  end loop;
  return array_to_string(res, ' ');
end $$;
-- Função pura (sem acesso a dados): fica executável por todos os papéis que gravam clientes.
comment on function public.nome_proprio(text) is
  'Padrão de nome de pessoa dos cadastros (C32): Primeira Letra Maiúscula, preposições minúsculas.';

create or replace function public.tg_nome_proprio()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  col text;
  novos jsonb := '{}';
  atual jsonb := to_jsonb(new);
begin
  foreach col in array tg_argv loop
    if atual ? col and jsonb_typeof(atual -> col) = 'string' then
      novos := novos || jsonb_build_object(col, public.nome_proprio(atual ->> col));
    end if;
  end loop;
  if novos <> '{}' then new := jsonb_populate_record(new, novos); end if;
  return new;
end $$;
revoke all on function public.tg_nome_proprio() from public, anon, authenticated;

drop trigger if exists trg_nome_proprio on public.clientes;
create trigger trg_nome_proprio before insert or update of nome, mae, pai, conjuge_nome, conjuge_nome_mae
  on public.clientes
  for each row execute function public.tg_nome_proprio('nome', 'mae', 'pai', 'conjuge_nome', 'conjuge_nome_mae');
drop trigger if exists trg_nome_proprio on public.cliente_vendedores;
create trigger trg_nome_proprio before insert or update of nome, mae, pai
  on public.cliente_vendedores
  for each row execute function public.tg_nome_proprio('nome', 'mae', 'pai');

-- Cadastros existentes (todas as contas do correspondente).
alter table public.clientes disable trigger trg_sync_cliente_derivados;
alter table public.clientes disable trigger trg_cliente_sincronizar_cadastro_completo;
alter table public.clientes disable trigger trg_clientes_updated;
update public.clientes
   set nome = public.nome_proprio(nome), mae = public.nome_proprio(mae), pai = public.nome_proprio(pai),
       conjuge_nome = public.nome_proprio(conjuge_nome), conjuge_nome_mae = public.nome_proprio(conjuge_nome_mae)
 where nome is distinct from public.nome_proprio(nome)
    or mae is distinct from public.nome_proprio(mae)
    or pai is distinct from public.nome_proprio(pai)
    or conjuge_nome is distinct from public.nome_proprio(conjuge_nome)
    or conjuge_nome_mae is distinct from public.nome_proprio(conjuge_nome_mae);
alter table public.clientes enable trigger trg_clientes_updated;
alter table public.clientes enable trigger trg_cliente_sincronizar_cadastro_completo;
alter table public.clientes enable trigger trg_sync_cliente_derivados;

alter table public.cliente_vendedores disable trigger trg_cliente_vendedores_updated;
update public.cliente_vendedores
   set nome = public.nome_proprio(nome), mae = public.nome_proprio(mae), pai = public.nome_proprio(pai)
 where nome is distinct from public.nome_proprio(nome)
    or mae is distinct from public.nome_proprio(mae)
    or pai is distinct from public.nome_proprio(pai);
alter table public.cliente_vendedores enable trigger trg_cliente_vendedores_updated;
