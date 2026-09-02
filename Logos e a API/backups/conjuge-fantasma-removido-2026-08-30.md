# Remoção do cônjuge fantasma — 30/08/2026

Três linhas de `proposta_envolvidos` (tipo_qualificacao `TI`, LUCCA VALENTIN SANTANA,
CPF 42991426837) foram criadas indevidamente nas propostas PRO-000245, PRO-000246 e
PRO-000247, todas de titular **solteira** (PAMELA APARECIDA LIMA CANTON).

Causa: `criarProposta` decidia a existência do cônjuge com `||` — bastava o cadastro do
cliente ter resíduo de `conjuge_nome`/`conjuge_cpf` para criar o participante, mesmo com
estado civil solteiro. Corrigido em `src/lib/propostas/propostas.functions.ts`.

As três linhas tinham `homefin_id_participante = null`: nunca foram enviadas à HomeFin,
então a remoção não teve efeito no banco parceiro.

## IDs removidos

| id | proposta | conjuge_de |
|---|---|---|
| d34910f7-fd30-4f74-8fe7-bfc5de6a8e9c | d78aa01a-ff6f-4190-ab8e-ff2f528119bb (PRO-000245) | 6e83e393-b4c7-4c43-95e6-61baad65555e |
| 88b6bf95-d6e6-4813-ba65-4c2d48af129d | 7c571f53-b333-4d12-bef6-9cf761442fb7 (PRO-000246) | 7d5f7e4f-d1c4-4bed-a1e1-7758da00d38a |
| e27c8542-7493-421c-8e3c-3a64ce03d033 | e0e504e6-f9b9-4a74-9c14-b17874d54f6f (PRO-000247) | e5ed25d4-b962-4ed0-ae4f-24a3b0466521 |

## Dados (idênticos nas três, exceto id/proposta_id/conjuge_de)

nome: LUCCA VALENTIN SANTANA · cpf_cnpj: 42991426837 · data_nascimento: 1994-03-11
nome_mae: MARIA JOSE · tipo_sexo: M · estado_civil: S · tipo_pessoa: F · tipo_situacao: A
tipo_documento_identidade: RG · numero_documento: 402322095 · orgao_expedidor: SSP · uf_expedicao: SP
profissao: TESTE · empresa: TESTE · renda: 12000
email: thiago@agilliza.net.br · celular: (19) 98250-4656
cep: 13419020 · logradouro: RUA SANTA CRUZ · numero_logradouro: 1000
bairro: CIDADE ALTA · municipio: PIRACICABA · uf: SP
utiliza_fgts: false · fg_autorizacao_dados: false · regime_casamento: null
dados: { "nacionalidade": "BRASILEIRA", "banco_conta": null }
