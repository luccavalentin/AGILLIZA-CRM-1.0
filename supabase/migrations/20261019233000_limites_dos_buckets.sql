-- Limites de tipo e tamanho aplicados pelo próprio Storage (o `accept` da tela só
-- filtra o seletor de arquivo: arrastar um .exe passava). Só nos buckets de uso
-- único — `cliente-documentos` também recebe anexo do chat do cliente e fica
-- validado nas telas de documento (`lib/storage/tipos-documento.ts`).
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'],
       file_size_limit = 10485760
 where id = 'documentos-proposta';

update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/*'],
       file_size_limit = 20971520
 where id = 'scan-ia';

-- Documentos gerais: qualquer tipo de arquivo de escritório, mas com teto.
update storage.buckets
   set file_size_limit = 52428800
 where id = 'arquivos';
