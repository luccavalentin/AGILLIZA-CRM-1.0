-- Os buckets nasceram pelo painel do Supabase, fora das migrações; as políticas de
-- storage.objects das migrações já os referenciam. Registrá-los aqui permite recriar o
-- banco do zero a partir do repositório. Todos privados, sem limite de tamanho ou tipo,
-- como em produção (conferido em 19/10/2026). Inócuo onde já existem.
insert into storage.buckets (id, name, public)
values
  ('arquivos', 'arquivos', false),
  ('avatars', 'avatars', false),
  ('chat-anexos', 'chat-anexos', false),
  ('cliente-documentos', 'cliente-documentos', false),
  ('demanda-anexos', 'demanda-anexos', false),
  ('documentos-proposta', 'documentos-proposta', false),
  ('financeiro-comprovantes', 'financeiro-comprovantes', false),
  ('formularios-bancarios', 'formularios-bancarios', false),
  ('rh-documentos', 'rh-documentos', false),
  ('scan-ia', 'scan-ia', false),
  ('simulacao-pdfs', 'simulacao-pdfs', false),
  ('tarefa-anexos', 'tarefa-anexos', false)
on conflict (id) do nothing;
