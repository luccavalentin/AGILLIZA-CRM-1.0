-- A HomeFin aprova documentos (tipoSituacao "A") e o código grava a situação
-- "aprovado" (situacaoDoItem), mas a regra da tabela só aceitava
-- enviado/homefin/erro: toda sincronização de documento aprovado falhava com 400.
alter table public.proposta_documentos_homefin
  drop constraint if exists proposta_documentos_homefin_situacao_check;

alter table public.proposta_documentos_homefin
  add constraint proposta_documentos_homefin_situacao_check
  check (situacao = any (array['enviado'::text, 'homefin'::text, 'erro'::text, 'aprovado'::text]));
