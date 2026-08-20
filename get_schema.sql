SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'simulacao_participantes'
ORDER BY 
    ordinal_position;

SELECT 
    column_name, 
    data_type
FROM 
    information_schema.columns
WHERE 
    table_name = 'simulacoes'
    AND column_name IN ('renda_conjuge', 'nome_conjuge', 'cpf_conjuge', 'compoe_renda_conjuge', 'renda_titular');
