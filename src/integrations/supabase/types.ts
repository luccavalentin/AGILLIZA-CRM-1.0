export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_levels: {
        Row: {
          acesso_tipo: Database["public"]["Enums"]["acesso_tipo"]
          ativo: boolean
          correspondente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          is_padrao: boolean
          nome: string
          papel: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          papel?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          papel?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_api_integrations: {
        Row: {
          ativo: boolean
          base_url: string | null
          chave: string
          config: Json
          correspondente_id: string
          created_at: string
          id: string
          nome: string
          secret_names: Json
          status: string
          ultimo_ping_em: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base_url?: string | null
          chave: string
          config?: Json
          correspondente_id: string
          created_at?: string
          id?: string
          nome: string
          secret_names?: Json
          status?: string
          ultimo_ping_em?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base_url?: string | null
          chave?: string
          config?: Json
          correspondente_id?: string
          created_at?: string
          id?: string
          nome?: string
          secret_names?: Json
          status?: string
          ultimo_ping_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          acao: string
          correspondente_id: string | null
          created_at: string
          descricao: string | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          payload_anterior: Json | null
          payload_novo: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          payload_anterior?: Json | null
          payload_novo?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          payload_anterior?: Json | null
          payload_novo?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      arquivos_nos: {
        Row: {
          content_type: string | null
          correspondente_id: string
          created_at: string
          criado_por: string | null
          id: string
          nome: string
          parent_id: string | null
          storage_path: string | null
          tamanho: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          correspondente_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
          parent_id?: string | null
          storage_path?: string | null
          tamanho?: number | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          correspondente_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
          parent_id?: string | null
          storage_path?: string | null
          tamanho?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_nos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "arquivos_nos"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_jobs: {
        Row: {
          concluido_em: string | null
          correspondente_id: string
          created_at: string
          criador_id: string | null
          erro: string | null
          id: string
          iniciado_em: string
          manifesto: Json
          status: string
          tamanho_bytes: number | null
        }
        Insert: {
          concluido_em?: string | null
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          erro?: string | null
          id?: string
          iniciado_em?: string
          manifesto?: Json
          status?: string
          tamanho_bytes?: number | null
        }
        Update: {
          concluido_em?: string | null
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          erro?: string | null
          id?: string
          iniciado_em?: string
          manifesto?: Json
          status?: string
          tamanho_bytes?: number | null
        }
        Relationships: []
      }
      banco_credenciais: {
        Row: {
          ambiente: string
          ativo: boolean
          banco_id: string | null
          base_url: string | null
          client_id_secret_name: string | null
          client_secret_name: string | null
          correspondente_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          banco_id?: string | null
          base_url?: string | null
          client_id_secret_name?: string | null
          client_secret_name?: string | null
          correspondente_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          banco_id?: string | null
          base_url?: string | null
          client_id_secret_name?: string | null
          client_secret_name?: string | null
          correspondente_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_credenciais_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "homefin_bancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_credenciais_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "vw_bancos_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_app_acessos: {
        Row: {
          cliente_id: string | null
          created_at: string
          documento_hash: string
          id: string
          ip: string | null
          motivo_bloqueio: string | null
          sucesso: boolean
          tipo_acesso: string
          user_agent: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          documento_hash: string
          id?: string
          ip?: string | null
          motivo_bloqueio?: string | null
          sucesso?: boolean
          tipo_acesso?: string
          user_agent?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          documento_hash?: string
          id?: string
          ip?: string | null
          motivo_bloqueio?: string | null
          sucesso?: boolean
          tipo_acesso?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_app_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_app_mensagens: {
        Row: {
          anexo_url: string | null
          atendente_id: string | null
          cliente_id: string
          correspondente_id: string | null
          criada_em: string
          editada_em: string | null
          excluida_em: string | null
          id: string
          lida_em: string | null
          mensagem: string
          proposta_id: string | null
          remetente_id: string | null
          remetente_tipo: string
          responde_a: string | null
        }
        Insert: {
          anexo_url?: string | null
          atendente_id?: string | null
          cliente_id: string
          correspondente_id?: string | null
          criada_em?: string
          editada_em?: string | null
          excluida_em?: string | null
          id?: string
          lida_em?: string | null
          mensagem: string
          proposta_id?: string | null
          remetente_id?: string | null
          remetente_tipo: string
          responde_a?: string | null
        }
        Update: {
          anexo_url?: string | null
          atendente_id?: string | null
          cliente_id?: string
          correspondente_id?: string | null
          criada_em?: string
          editada_em?: string | null
          excluida_em?: string | null
          id?: string
          lida_em?: string | null
          mensagem?: string
          proposta_id?: string | null
          remetente_id?: string | null
          remetente_tipo?: string
          responde_a?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_app_mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_app_mensagens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_app_mensagens_responde_a_fkey"
            columns: ["responde_a"]
            isOneToOne: false
            referencedRelation: "cliente_app_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_app_notificacoes: {
        Row: {
          cliente_id: string
          corpo: string | null
          correspondente_id: string | null
          criada_em: string
          id: string
          lida: boolean
          link: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          cliente_id: string
          corpo?: string | null
          correspondente_id?: string | null
          criada_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          cliente_id?: string
          corpo?: string | null
          correspondente_id?: string | null
          criada_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_app_notificacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_documento_pastas: {
        Row: {
          cliente_id: string
          correspondente_id: string
          created_at: string
          criado_por: string | null
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          correspondente_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          correspondente_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documento_pastas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documento_pastas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documento_pastas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cliente_documento_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_documentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          categoria: Database["public"]["Enums"]["doc_categoria"]
          cliente_id: string
          created_at: string
          enviado_por: string | null
          erro_integracao: string | null
          expira_em: string | null
          id: string
          integrado_em: string | null
          mime_type: string | null
          nome_arquivo: string
          pasta_id: string | null
          situacao_integracao: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          tamanho_bytes: number | null
          tipo_documento: string
          updated_at: string
          versao: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: Database["public"]["Enums"]["doc_categoria"]
          cliente_id: string
          created_at?: string
          enviado_por?: string | null
          erro_integracao?: string | null
          expira_em?: string | null
          id?: string
          integrado_em?: string | null
          mime_type?: string | null
          nome_arquivo: string
          pasta_id?: string | null
          situacao_integracao?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          tamanho_bytes?: number | null
          tipo_documento: string
          updated_at?: string
          versao?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: Database["public"]["Enums"]["doc_categoria"]
          cliente_id?: string
          created_at?: string
          enviado_por?: string | null
          erro_integracao?: string | null
          expira_em?: string | null
          id?: string
          integrado_em?: string | null
          mime_type?: string | null
          nome_arquivo?: string
          pasta_id?: string | null
          situacao_integracao?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "cliente_documento_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_enderecos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          created_at: string
          id: string
          logradouro: string | null
          numero: string | null
          principal: boolean
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          created_at?: string
          id?: string
          logradouro?: string | null
          numero?: string | null
          principal?: boolean
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          created_at?: string
          id?: string
          logradouro?: string | null
          numero?: string | null
          principal?: boolean
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_enderecos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_historico: {
        Row: {
          ator_id: string | null
          cliente_id: string
          created_at: string
          descricao: string
          id: string
          metadata: Json | null
          tipo: string
        }
        Insert: {
          ator_id?: string | null
          cliente_id: string
          created_at?: string
          descricao: string
          id?: string
          metadata?: Json | null
          tipo: string
        }
        Update: {
          ator_id?: string | null
          cliente_id?: string
          created_at?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_imoveis: {
        Row: {
          cidade: string | null
          cliente_id: string
          created_at: string
          id: string
          logradouro: string | null
          tipo: string | null
          uf: string | null
          updated_at: string
          uso: string | null
          valor: number | null
        }
        Insert: {
          cidade?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          logradouro?: string | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string
          uso?: string | null
          valor?: number | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          logradouro?: string | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string
          uso?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_imoveis_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_interacoes: {
        Row: {
          canal: Database["public"]["Enums"]["interacao_canal"]
          cliente_id: string
          created_at: string
          id: string
          observacao: string | null
          ocorrido_em: string
          responsavel_id: string | null
          resultado: string | null
        }
        Insert: {
          canal: Database["public"]["Enums"]["interacao_canal"]
          cliente_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          ocorrido_em?: string
          responsavel_id?: string | null
          resultado?: string | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["interacao_canal"]
          cliente_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          ocorrido_em?: string
          responsavel_id?: string | null
          resultado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_interacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_parceiros: {
        Row: {
          cliente_id: string
          correspondente_id: string
          created_at: string
          id: string
          parceiro_id: string
          tipo_vinculo: string
        }
        Insert: {
          cliente_id: string
          correspondente_id: string
          created_at?: string
          id?: string
          parceiro_id: string
          tipo_vinculo?: string
        }
        Update: {
          cliente_id?: string
          correspondente_id?: string
          created_at?: string
          id?: string
          parceiro_id?: string
          tipo_vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_parceiros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_parceiros_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_pipeline: {
        Row: {
          cliente_id: string
          stage_id: string
          ultima_atualizacao_em: string
        }
        Insert: {
          cliente_id: string
          stage_id: string
          ultima_atualizacao_em?: string
        }
        Update: {
          cliente_id?: string
          stage_id?: string
          ultima_atualizacao_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_pipeline_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_pipeline_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_pipeline_historico: {
        Row: {
          acao: string | null
          ator_id: string | null
          cliente_id: string
          created_at: string
          enviar_ao_cliente: boolean
          id: string
          mensagem_cliente: string | null
          observacao: string | null
          stage_id: string
        }
        Insert: {
          acao?: string | null
          ator_id?: string | null
          cliente_id: string
          created_at?: string
          enviar_ao_cliente?: boolean
          id?: string
          mensagem_cliente?: string | null
          observacao?: string | null
          stage_id: string
        }
        Update: {
          acao?: string | null
          ator_id?: string | null
          cliente_id?: string
          created_at?: string
          enviar_ao_cliente?: boolean
          id?: string
          mensagem_cliente?: string | null
          observacao?: string | null
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_pipeline_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_pipeline_historico_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_portal_acessos: {
        Row: {
          ativo: boolean
          cliente_id: string
          data_referencia: string | null
          documento_hash: string
          habilitado_em: string
          habilitado_por: string | null
          id: string
          revogado_em: string | null
          revogado_por: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          data_referencia?: string | null
          documento_hash: string
          habilitado_em?: string
          habilitado_por?: string | null
          id?: string
          revogado_em?: string | null
          revogado_por?: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          data_referencia?: string | null
          documento_hash?: string
          habilitado_em?: string
          habilitado_por?: string | null
          id?: string
          revogado_em?: string | null
          revogado_por?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Relationships: [
          {
            foreignKeyName: "cliente_portal_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_vendedores: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco_conta: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          conjuge_agencia: string | null
          conjuge_banco_conta: string | null
          conjuge_conta_corrente: string | null
          conjuge_digito_conta: string | null
          conta_corrente: string | null
          created_at: string
          data_expedicao: string | null
          data_nascimento: string | null
          digito_conta: string | null
          documento: string | null
          documento_secundario: string | null
          email: string | null
          empresa: string | null
          estado_civil: string | null
          fg_autorizacao_dados: boolean
          id: string
          logradouro: string | null
          mae: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome: string
          numero: string | null
          numero_documento: string | null
          orgao_expedidor: string | null
          pai: string | null
          profissao: string | null
          regime_casamento: string | null
          renda_total_declarada: number | null
          sexo: string | null
          telefone_celular: string | null
          tipo_documento_identidade: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          uf: string | null
          uf_expedicao: string | null
          updated_at: string
          utiliza_fgts: boolean
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco_conta?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          conjuge_agencia?: string | null
          conjuge_banco_conta?: string | null
          conjuge_conta_corrente?: string | null
          conjuge_digito_conta?: string | null
          conta_corrente?: string | null
          created_at?: string
          data_expedicao?: string | null
          data_nascimento?: string | null
          digito_conta?: string | null
          documento?: string | null
          documento_secundario?: string | null
          email?: string | null
          empresa?: string | null
          estado_civil?: string | null
          fg_autorizacao_dados?: boolean
          id?: string
          logradouro?: string | null
          mae?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome: string
          numero?: string | null
          numero_documento?: string | null
          orgao_expedidor?: string | null
          pai?: string | null
          profissao?: string | null
          regime_casamento?: string | null
          renda_total_declarada?: number | null
          sexo?: string | null
          telefone_celular?: string | null
          tipo_documento_identidade?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf?: string | null
          uf_expedicao?: string | null
          updated_at?: string
          utiliza_fgts?: boolean
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco_conta?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          conjuge_agencia?: string | null
          conjuge_banco_conta?: string | null
          conjuge_conta_corrente?: string | null
          conjuge_digito_conta?: string | null
          conta_corrente?: string | null
          created_at?: string
          data_expedicao?: string | null
          data_nascimento?: string | null
          digito_conta?: string | null
          documento?: string | null
          documento_secundario?: string | null
          email?: string | null
          empresa?: string | null
          estado_civil?: string | null
          fg_autorizacao_dados?: boolean
          id?: string
          logradouro?: string | null
          mae?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome?: string
          numero?: string | null
          numero_documento?: string | null
          orgao_expedidor?: string | null
          pai?: string | null
          profissao?: string | null
          regime_casamento?: string | null
          renda_total_declarada?: number | null
          sexo?: string | null
          telefone_celular?: string | null
          tipo_documento_identidade?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf?: string | null
          uf_expedicao?: string | null
          updated_at?: string
          utiliza_fgts?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cliente_vendedores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco_conta: string | null
          conjuge_agencia: string | null
          conjuge_banco_conta: string | null
          conjuge_celular: string | null
          conjuge_conta_corrente: string | null
          conjuge_cpf: string | null
          conjuge_data_expedicao: string | null
          conjuge_data_nascimento: string | null
          conjuge_digito_conta: string | null
          conjuge_email: string | null
          conjuge_empresa: string | null
          conjuge_nacionalidade: string | null
          conjuge_nome: string | null
          conjuge_nome_mae: string | null
          conjuge_numero_documento: string | null
          conjuge_orgao_expedidor: string | null
          conjuge_profissao: string | null
          conjuge_renda: number | null
          conjuge_sexo: string | null
          conjuge_tipo_documento_identidade: string | null
          conjuge_uf_expedicao: string | null
          conta_corrente: string | null
          contrato_arquivado_em: string | null
          contrato_emitido_em: string | null
          correspondente_id: string
          created_at: string
          criador_id: string | null
          data_expedicao: string | null
          data_nascimento: string | null
          digito_conta: string | null
          documento: string
          documento_secundario: string | null
          documentos_checklist: Json
          email: string | null
          empresa: string | null
          estado_civil:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          fg_autorizacao_dados: boolean
          foto_url: string | null
          id: string
          imovel_bairro: string | null
          imovel_cep: string | null
          imovel_cidade: string | null
          imovel_complemento: string | null
          imovel_logradouro: string | null
          imovel_numero: string | null
          imovel_situacao: string | null
          imovel_tipo: string | null
          imovel_uf: string | null
          imovel_uso: string | null
          imovel_valor: number | null
          iq_comentario: string | null
          iq_nome: string | null
          lgpd_aceite_em: string | null
          lgpd_aceite_ip: string | null
          lgpd_aceite_versao: string | null
          mae: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome: string
          numero_cliente: string
          numero_documento: string | null
          orgao_expedidor: string | null
          origem: Database["public"]["Enums"]["cliente_origem"]
          pai: string | null
          portal_acesso_ativo: boolean
          profissao: string | null
          regime_casamento:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada: number | null
          responsavel_id: string | null
          sexo: string | null
          telefone_celular: string | null
          tipo_documento_identidade: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          uf_expedicao: string | null
          uf_interesse: string | null
          updated_at: string
          utiliza_fgts: boolean
          vistoria_agendada_em: string | null
          vistoria_concluida_em: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco_conta?: string | null
          conjuge_agencia?: string | null
          conjuge_banco_conta?: string | null
          conjuge_celular?: string | null
          conjuge_conta_corrente?: string | null
          conjuge_cpf?: string | null
          conjuge_data_expedicao?: string | null
          conjuge_data_nascimento?: string | null
          conjuge_digito_conta?: string | null
          conjuge_email?: string | null
          conjuge_empresa?: string | null
          conjuge_nacionalidade?: string | null
          conjuge_nome?: string | null
          conjuge_nome_mae?: string | null
          conjuge_numero_documento?: string | null
          conjuge_orgao_expedidor?: string | null
          conjuge_profissao?: string | null
          conjuge_renda?: number | null
          conjuge_sexo?: string | null
          conjuge_tipo_documento_identidade?: string | null
          conjuge_uf_expedicao?: string | null
          conta_corrente?: string | null
          contrato_arquivado_em?: string | null
          contrato_emitido_em?: string | null
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          data_expedicao?: string | null
          data_nascimento?: string | null
          digito_conta?: string | null
          documento: string
          documento_secundario?: string | null
          documentos_checklist?: Json
          email?: string | null
          empresa?: string | null
          estado_civil?:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          fg_autorizacao_dados?: boolean
          foto_url?: string | null
          id?: string
          imovel_bairro?: string | null
          imovel_cep?: string | null
          imovel_cidade?: string | null
          imovel_complemento?: string | null
          imovel_logradouro?: string | null
          imovel_numero?: string | null
          imovel_situacao?: string | null
          imovel_tipo?: string | null
          imovel_uf?: string | null
          imovel_uso?: string | null
          imovel_valor?: number | null
          iq_comentario?: string | null
          iq_nome?: string | null
          lgpd_aceite_em?: string | null
          lgpd_aceite_ip?: string | null
          lgpd_aceite_versao?: string | null
          mae?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome: string
          numero_cliente: string
          numero_documento?: string | null
          orgao_expedidor?: string | null
          origem?: Database["public"]["Enums"]["cliente_origem"]
          pai?: string | null
          portal_acesso_ativo?: boolean
          profissao?: string | null
          regime_casamento?:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada?: number | null
          responsavel_id?: string | null
          sexo?: string | null
          telefone_celular?: string | null
          tipo_documento_identidade?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf_expedicao?: string | null
          uf_interesse?: string | null
          updated_at?: string
          utiliza_fgts?: boolean
          vistoria_agendada_em?: string | null
          vistoria_concluida_em?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco_conta?: string | null
          conjuge_agencia?: string | null
          conjuge_banco_conta?: string | null
          conjuge_celular?: string | null
          conjuge_conta_corrente?: string | null
          conjuge_cpf?: string | null
          conjuge_data_expedicao?: string | null
          conjuge_data_nascimento?: string | null
          conjuge_digito_conta?: string | null
          conjuge_email?: string | null
          conjuge_empresa?: string | null
          conjuge_nacionalidade?: string | null
          conjuge_nome?: string | null
          conjuge_nome_mae?: string | null
          conjuge_numero_documento?: string | null
          conjuge_orgao_expedidor?: string | null
          conjuge_profissao?: string | null
          conjuge_renda?: number | null
          conjuge_sexo?: string | null
          conjuge_tipo_documento_identidade?: string | null
          conjuge_uf_expedicao?: string | null
          conta_corrente?: string | null
          contrato_arquivado_em?: string | null
          contrato_emitido_em?: string | null
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          data_expedicao?: string | null
          data_nascimento?: string | null
          digito_conta?: string | null
          documento?: string
          documento_secundario?: string | null
          documentos_checklist?: Json
          email?: string | null
          empresa?: string | null
          estado_civil?:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          fg_autorizacao_dados?: boolean
          foto_url?: string | null
          id?: string
          imovel_bairro?: string | null
          imovel_cep?: string | null
          imovel_cidade?: string | null
          imovel_complemento?: string | null
          imovel_logradouro?: string | null
          imovel_numero?: string | null
          imovel_situacao?: string | null
          imovel_tipo?: string | null
          imovel_uf?: string | null
          imovel_uso?: string | null
          imovel_valor?: number | null
          iq_comentario?: string | null
          iq_nome?: string | null
          lgpd_aceite_em?: string | null
          lgpd_aceite_ip?: string | null
          lgpd_aceite_versao?: string | null
          mae?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome?: string
          numero_cliente?: string
          numero_documento?: string | null
          orgao_expedidor?: string | null
          origem?: Database["public"]["Enums"]["cliente_origem"]
          pai?: string | null
          portal_acesso_ativo?: boolean
          profissao?: string | null
          regime_casamento?:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada?: number | null
          responsavel_id?: string | null
          sexo?: string | null
          telefone_celular?: string | null
          tipo_documento_identidade?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf_expedicao?: string | null
          uf_interesse?: string | null
          updated_at?: string
          utiliza_fgts?: boolean
          vistoria_agendada_em?: string | null
          vistoria_concluida_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_criador_id_fkey"
            columns: ["criador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_regras: {
        Row: {
          ativo: boolean
          banco_codigo: string | null
          banco_nome: string | null
          correspondente_id: string
          created_at: string
          faixa_max: number | null
          faixa_min: number
          id: string
          percentual_interno: number
          percentual_parceiro: number
          produto: string | null
          tipo: Database["public"]["Enums"]["comissao_regra_tipo"]
          updated_at: string
          valor: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          banco_codigo?: string | null
          banco_nome?: string | null
          correspondente_id: string
          created_at?: string
          faixa_max?: number | null
          faixa_min?: number
          id?: string
          percentual_interno?: number
          percentual_parceiro?: number
          produto?: string | null
          tipo?: Database["public"]["Enums"]["comissao_regra_tipo"]
          updated_at?: string
          valor?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          banco_codigo?: string | null
          banco_nome?: string | null
          correspondente_id?: string
          created_at?: string
          faixa_max?: number | null
          faixa_min?: number
          id?: string
          percentual_interno?: number
          percentual_parceiro?: number
          produto?: string | null
          tipo?: Database["public"]["Enums"]["comissao_regra_tipo"]
          updated_at?: string
          valor?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          banco_codigo: string | null
          banco_nome: string | null
          correspondente_id: string
          created_at: string
          id: string
          parceiro_id: string | null
          payable_id: string | null
          percentual: number
          produto: string | null
          proposta_id: string | null
          receivable_id: string | null
          regra_id: string | null
          split_interno: number
          split_parceiro: number
          status: Database["public"]["Enums"]["comissao_status"]
          updated_at: string
          usuario_responsavel_id: string | null
          valor_base: number
          valor_bruto: number
        }
        Insert: {
          banco_codigo?: string | null
          banco_nome?: string | null
          correspondente_id: string
          created_at?: string
          id?: string
          parceiro_id?: string | null
          payable_id?: string | null
          percentual?: number
          produto?: string | null
          proposta_id?: string | null
          receivable_id?: string | null
          regra_id?: string | null
          split_interno?: number
          split_parceiro?: number
          status?: Database["public"]["Enums"]["comissao_status"]
          updated_at?: string
          usuario_responsavel_id?: string | null
          valor_base?: number
          valor_bruto?: number
        }
        Update: {
          banco_codigo?: string | null
          banco_nome?: string | null
          correspondente_id?: string
          created_at?: string
          id?: string
          parceiro_id?: string | null
          payable_id?: string | null
          percentual?: number
          produto?: string | null
          proposta_id?: string | null
          receivable_id?: string | null
          regra_id?: string | null
          split_interno?: number
          split_parceiro?: number
          status?: Database["public"]["Enums"]["comissao_status"]
          updated_at?: string
          usuario_responsavel_id?: string | null
          valor_base?: number
          valor_bruto?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "comissao_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_modulos: {
        Row: {
          config: Json
          correspondente_id: string
          created_at: string
          id: string
          modulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          correspondente_id: string
          created_at?: string
          id?: string
          modulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          correspondente_id?: string
          created_at?: string
          id?: string
          modulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      crm_chat_cliente_etiquetas: {
        Row: {
          cliente_id: string
          correspondente_id: string
          created_at: string
          etiqueta_id: string
        }
        Insert: {
          cliente_id: string
          correspondente_id: string
          created_at?: string
          etiqueta_id: string
        }
        Update: {
          cliente_id?: string
          correspondente_id?: string
          created_at?: string
          etiqueta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_chat_cliente_etiquetas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "crm_chat_etiquetas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_chat_etiquetas: {
        Row: {
          cor: string
          correspondente_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          correspondente_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          correspondente_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_chat_meta: {
        Row: {
          arquivado: boolean
          arquivado_em: string | null
          cliente_id: string
          correspondente_id: string
          created_at: string
          lembrete_em: string | null
          lembrete_nota: string | null
          sla_atualizacao_horas: number
          updated_at: string
        }
        Insert: {
          arquivado?: boolean
          arquivado_em?: string | null
          cliente_id: string
          correspondente_id: string
          created_at?: string
          lembrete_em?: string | null
          lembrete_nota?: string | null
          sla_atualizacao_horas?: number
          updated_at?: string
        }
        Update: {
          arquivado?: boolean
          arquivado_em?: string | null
          cliente_id?: string
          correspondente_id?: string
          created_at?: string
          lembrete_em?: string | null
          lembrete_nota?: string | null
          sla_atualizacao_horas?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_chat_participantes: {
        Row: {
          atendente_id: string
          cliente_id: string
          created_at: string
          criado_por: string | null
          id: string
          usuario_id: string
        }
        Insert: {
          atendente_id: string
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          usuario_id: string
        }
        Update: {
          atendente_id?: string
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_chat_participantes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_anexos: {
        Row: {
          autor_id: string | null
          created_at: string
          demanda_id: string
          id: string
          nome: string
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          demanda_id: string
          id?: string
          nome: string
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          demanda_id?: string
          id?: string
          nome?: string
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demanda_anexos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_historico: {
        Row: {
          acao: string
          ator_id: string | null
          created_at: string
          demanda_id: string
          detalhe: string | null
          id: string
          motivo: string | null
          responsavel_anterior_id: string | null
          responsavel_novo_id: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          created_at?: string
          demanda_id: string
          detalhe?: string | null
          id?: string
          motivo?: string | null
          responsavel_anterior_id?: string | null
          responsavel_novo_id?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          created_at?: string
          demanda_id?: string
          detalhe?: string | null
          id?: string
          motivo?: string | null
          responsavel_anterior_id?: string | null
          responsavel_novo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demanda_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_leituras: {
        Row: {
          demanda_id: string
          lida_em: string
          user_id: string
        }
        Insert: {
          demanda_id: string
          lida_em?: string
          user_id: string
        }
        Update: {
          demanda_id?: string
          lida_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_leituras_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_mensagens: {
        Row: {
          anexo_nome: string | null
          anexo_path: string | null
          anexo_tamanho: number | null
          autor_id: string
          corpo: string
          created_at: string
          demanda_id: string
          id: string
          visivel_cliente: boolean
        }
        Insert: {
          anexo_nome?: string | null
          anexo_path?: string | null
          anexo_tamanho?: number | null
          autor_id: string
          corpo: string
          created_at?: string
          demanda_id: string
          id?: string
          visivel_cliente?: boolean
        }
        Update: {
          anexo_nome?: string | null
          anexo_path?: string | null
          anexo_tamanho?: number | null
          autor_id?: string
          corpo?: string
          created_at?: string
          demanda_id?: string
          id?: string
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demanda_mensagens_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_participantes: {
        Row: {
          created_at: string
          demanda_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demanda_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demanda_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_participantes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          cliente_id: string | null
          concluida_em: string | null
          correspondente_id: string
          created_at: string
          criador_id: string | null
          dados_simulacao: string | null
          descricao: string | null
          escalonada: boolean
          escalonada_em: string | null
          id: string
          numero: string | null
          origem: string
          prazo_sla: string | null
          prioridade: Database["public"]["Enums"]["prioridade_op"]
          responsavel_id: string | null
          sla_horas: number | null
          sla_inicio: string
          status: Database["public"]["Enums"]["demanda_status"]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          concluida_em?: string | null
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          dados_simulacao?: string | null
          descricao?: string | null
          escalonada?: boolean
          escalonada_em?: string | null
          id?: string
          numero?: string | null
          origem?: string
          prazo_sla?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_op"]
          responsavel_id?: string | null
          sla_horas?: number | null
          sla_inicio?: string
          status?: Database["public"]["Enums"]["demanda_status"]
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          concluida_em?: string | null
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          dados_simulacao?: string | null
          descricao?: string | null
          escalonada?: boolean
          escalonada_em?: string | null
          id?: string
          numero?: string | null
          origem?: string
          prazo_sla?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_op"]
          responsavel_id?: string | null
          sla_horas?: number | null
          sla_inicio?: string
          status?: Database["public"]["Enums"]["demanda_status"]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          correspondente_id: string | null
          created_at: string
          data: string
          descricao: string
          id: string
        }
        Insert: {
          correspondente_id?: string | null
          created_at?: string
          data: string
          descricao: string
          id?: string
        }
        Update: {
          correspondente_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      financial_audit_logs: {
        Row: {
          acao: string
          ator_id: string | null
          correspondente_id: string
          created_at: string
          dados: Json | null
          entidade: string
          entidade_id: string | null
          id: string
        }
        Insert: {
          acao: string
          ator_id?: string | null
          correspondente_id: string
          created_at?: string
          dados?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
        }
        Update: {
          acao?: string
          ator_id?: string | null
          correspondente_id?: string
          created_at?: string
          dados?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          ativo: boolean
          correspondente_id: string
          created_at: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["financial_categoria_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id: string
          created_at?: string
          id?: string
          nome: string
          tipo?: Database["public"]["Enums"]["financial_categoria_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string
          created_at?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["financial_categoria_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      financial_cost_centers: {
        Row: {
          ativo: boolean
          correspondente_id: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_payable_history: {
        Row: {
          ator_id: string | null
          correspondente_id: string
          created_at: string
          descricao: string | null
          entidade: string
          entidade_id: string
          evento: string
          id: string
          valor: number | null
        }
        Insert: {
          ator_id?: string | null
          correspondente_id: string
          created_at?: string
          descricao?: string | null
          entidade?: string
          entidade_id: string
          evento: string
          id?: string
          valor?: number | null
        }
        Update: {
          ator_id?: string | null
          correspondente_id?: string
          created_at?: string
          descricao?: string | null
          entidade?: string
          entidade_id?: string
          evento?: string
          id?: string
          valor?: number | null
        }
        Relationships: []
      }
      financial_payables: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          categoria_id: string | null
          comissao_id: string | null
          comprovante_path: string | null
          correspondente_id: string
          cost_center_id: string | null
          created_at: string
          criador_id: string | null
          data_pagamento: string | null
          descricao: string
          estornada: boolean
          estorno_de: string | null
          estorno_motivo: string | null
          fornecedor: string | null
          id: string
          numero: string | null
          parceiro_id: string | null
          parcela_numero: number | null
          parcelas: number | null
          payment_method_id: string | null
          recorrencia: Database["public"]["Enums"]["financial_recorrencia"]
          recorrencia_ate: string | null
          recorrencia_origem_id: string | null
          status: Database["public"]["Enums"]["financial_status"]
          updated_at: string
          valor: number
          valor_pago: number
          vencimento: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria_id?: string | null
          comissao_id?: string | null
          comprovante_path?: string | null
          correspondente_id: string
          cost_center_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_pagamento?: string | null
          descricao: string
          estornada?: boolean
          estorno_de?: string | null
          estorno_motivo?: string | null
          fornecedor?: string | null
          id?: string
          numero?: string | null
          parceiro_id?: string | null
          parcela_numero?: number | null
          parcelas?: number | null
          payment_method_id?: string | null
          recorrencia?: Database["public"]["Enums"]["financial_recorrencia"]
          recorrencia_ate?: string | null
          recorrencia_origem_id?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria_id?: string | null
          comissao_id?: string | null
          comprovante_path?: string | null
          correspondente_id?: string
          cost_center_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_pagamento?: string | null
          descricao?: string
          estornada?: boolean
          estorno_de?: string | null
          estorno_motivo?: string | null
          fornecedor?: string | null
          id?: string
          numero?: string | null
          parceiro_id?: string | null
          parcela_numero?: number | null
          parcelas?: number | null
          payment_method_id?: string | null
          recorrencia?: Database["public"]["Enums"]["financial_recorrencia"]
          recorrencia_ate?: string | null
          recorrencia_origem_id?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payables_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payables_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_methods: {
        Row: {
          ativo: boolean
          correspondente_id: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_receivables: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          banco_codigo: string | null
          banco_nome: string | null
          categoria_id: string | null
          comissao_id: string | null
          comprovante_path: string | null
          correspondente_id: string
          cost_center_id: string | null
          created_at: string
          criador_id: string | null
          data_pagamento: string | null
          descricao: string
          estornada: boolean
          estorno_de: string | null
          estorno_motivo: string | null
          id: string
          numero: string | null
          pagador: string | null
          parcela_numero: number | null
          parcelas: number | null
          payment_method_id: string | null
          proposta_id: string | null
          recorrencia: Database["public"]["Enums"]["financial_recorrencia"]
          recorrencia_ate: string | null
          recorrencia_origem_id: string | null
          status: Database["public"]["Enums"]["financial_status"]
          updated_at: string
          valor: number
          valor_pago: number
          vencimento: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          categoria_id?: string | null
          comissao_id?: string | null
          comprovante_path?: string | null
          correspondente_id: string
          cost_center_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_pagamento?: string | null
          descricao: string
          estornada?: boolean
          estorno_de?: string | null
          estorno_motivo?: string | null
          id?: string
          numero?: string | null
          pagador?: string | null
          parcela_numero?: number | null
          parcelas?: number | null
          payment_method_id?: string | null
          proposta_id?: string | null
          recorrencia?: Database["public"]["Enums"]["financial_recorrencia"]
          recorrencia_ate?: string | null
          recorrencia_origem_id?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          categoria_id?: string | null
          comissao_id?: string | null
          comprovante_path?: string | null
          correspondente_id?: string
          cost_center_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_pagamento?: string | null
          descricao?: string
          estornada?: boolean
          estorno_de?: string | null
          estorno_motivo?: string | null
          id?: string
          numero?: string | null
          pagador?: string | null
          parcela_numero?: number | null
          parcelas?: number | null
          payment_method_id?: string | null
          proposta_id?: string | null
          recorrencia?: Database["public"]["Enums"]["financial_recorrencia"]
          recorrencia_ate?: string | null
          recorrencia_origem_id?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_receivables_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receivables_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      fluxo_caixa: {
        Row: {
          correspondente_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string | null
          realizado: boolean
          ref_id: string | null
          tipo: Database["public"]["Enums"]["fluxo_tipo"]
          valor: number
        }
        Insert: {
          correspondente_id: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          origem?: string | null
          realizado?: boolean
          ref_id?: string | null
          tipo: Database["public"]["Enums"]["fluxo_tipo"]
          valor?: number
        }
        Update: {
          correspondente_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string | null
          realizado?: boolean
          ref_id?: string | null
          tipo?: Database["public"]["Enums"]["fluxo_tipo"]
          valor?: number
        }
        Relationships: []
      }
      formularios_bancarios: {
        Row: {
          banco: string
          content_type: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          storage_path: string
          tamanho: number | null
          updated_at: string
        }
        Insert: {
          banco: string
          content_type?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          storage_path: string
          tamanho?: number | null
          updated_at?: string
        }
        Update: {
          banco?: string
          content_type?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          storage_path?: string
          tamanho?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      homefin_auth_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          id_parceiro: string | null
          id_regional: string | null
          id_usuario_parceiro: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          id_parceiro?: string | null
          id_regional?: string | null
          id_usuario_parceiro?: string | null
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          id_parceiro?: string | null
          id_regional?: string | null
          id_usuario_parceiro?: string | null
          token?: string
        }
        Relationships: []
      }
      homefin_bancos: {
        Row: {
          ativo: boolean
          codigo_agencia_padrao: string | null
          codigo_banco: number
          codigo_parceiro: string | null
          contatos: Json
          created_at: string
          flag_padrao: boolean
          flag_simulacao: string
          id: string
          id_banco: number | null
          logo_url: string | null
          nome_banco: string
          ordem: number
          produtos: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_agencia_padrao?: string | null
          codigo_banco: number
          codigo_parceiro?: string | null
          contatos?: Json
          created_at?: string
          flag_padrao?: boolean
          flag_simulacao?: string
          id?: string
          id_banco?: number | null
          logo_url?: string | null
          nome_banco: string
          ordem?: number
          produtos?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_agencia_padrao?: string | null
          codigo_banco?: number
          codigo_parceiro?: string | null
          contatos?: Json
          created_at?: string
          flag_padrao?: boolean
          flag_simulacao?: string
          id?: string
          id_banco?: number | null
          logo_url?: string | null
          nome_banco?: string
          ordem?: number
          produtos?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      homefin_email_otp: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          ip: string | null
          tentativas: number
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip?: string | null
          tentativas?: number
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip?: string | null
          tentativas?: number
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      homefin_operacoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          id_operacao: number
          nome_operacao: string
          produto_sistema: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          id_operacao: number
          nome_operacao: string
          produto_sistema: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          id_operacao?: number
          nome_operacao?: string
          produto_sistema?: string
          updated_at?: string
        }
        Relationships: []
      }
      integracao_health_checks: {
        Row: {
          ator_id: string | null
          correspondente_id: string
          created_at: string
          detalhe: string | null
          id: string
          integracao: string
          latencia_ms: number | null
          sucesso: boolean
        }
        Insert: {
          ator_id?: string | null
          correspondente_id: string
          created_at?: string
          detalhe?: string | null
          id?: string
          integracao: string
          latencia_ms?: number | null
          sucesso: boolean
        }
        Update: {
          ator_id?: string | null
          correspondente_id?: string
          created_at?: string
          detalhe?: string | null
          id?: string
          integracao?: string
          latencia_ms?: number | null
          sucesso?: boolean
        }
        Relationships: []
      }
      links_uteis: {
        Row: {
          categoria: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          titulo: string
          updated_at: string
          url: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          titulo: string
          updated_at?: string
          url: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      matricula_config: {
        Row: {
          correspondente_id: string
          pix_chave: string | null
          pix_titular: string | null
          updated_at: string
        }
        Insert: {
          correspondente_id: string
          pix_chave?: string | null
          pix_titular?: string | null
          updated_at?: string
        }
        Update: {
          correspondente_id?: string
          pix_chave?: string | null
          pix_titular?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      matricula_creditos: {
        Row: {
          correspondente_id: string
          created_at: string
          criado_por: string | null
          data: string
          descricao: string | null
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          correspondente_id: string
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          correspondente_id?: string
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      matricula_solicitacoes: {
        Row: {
          cliente: string | null
          correspondente_id: string
          corretor: string | null
          created_at: string
          criado_por: string | null
          data_pagto_reembolso: string | null
          data_solicitacao: string
          id: string
          numero_matricula: string | null
          observacao: string | null
          reembolsado: boolean
          reembolsado_em: string | null
          solicitante: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente?: string | null
          correspondente_id: string
          corretor?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagto_reembolso?: string | null
          data_solicitacao?: string
          id?: string
          numero_matricula?: string | null
          observacao?: string | null
          reembolsado?: boolean
          reembolsado_em?: string | null
          solicitante: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente?: string | null
          correspondente_id?: string
          corretor?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagto_reembolso?: string | null
          data_solicitacao?: string
          id?: string
          numero_matricula?: string | null
          observacao?: string | null
          reembolsado?: boolean
          reembolsado_em?: string | null
          solicitante?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      notificacao_regras: {
        Row: {
          ativo: boolean
          canal: string
          correspondente_id: string
          created_at: string
          destinatarios: string[]
          evento: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          correspondente_id: string
          created_at?: string
          destinatarios?: string[]
          evento: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          correspondente_id?: string
          created_at?: string
          destinatarios?: string[]
          evento?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          corpo: string | null
          correspondente_id: string | null
          created_at: string
          id: string
          lida: boolean
          link: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          corpo?: string | null
          correspondente_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          corpo?: string | null
          correspondente_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      parametros_globais: {
        Row: {
          backup_retencao_dias: number
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cor_primaria: string | null
          correspondente_id: string
          created_at: string
          email_dpo: string | null
          email_empresa: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          logradouro: string | null
          nome_empresa: string | null
          nome_fantasia: string | null
          numero: string | null
          politica_lgpd: string | null
          politica_privacidade: string | null
          razao_social: string | null
          responsavel_nome: string | null
          site: string | null
          telefone_empresa: string | null
          telefone_sac: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          backup_retencao_dias?: number
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cor_primaria?: string | null
          correspondente_id: string
          created_at?: string
          email_dpo?: string | null
          email_empresa?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome_empresa?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          politica_lgpd?: string | null
          politica_privacidade?: string | null
          razao_social?: string | null
          responsavel_nome?: string | null
          site?: string | null
          telefone_empresa?: string | null
          telefone_sac?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          backup_retencao_dias?: number
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cor_primaria?: string | null
          correspondente_id?: string
          created_at?: string
          email_dpo?: string | null
          email_empresa?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome_empresa?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          politica_lgpd?: string | null
          politica_privacidade?: string | null
          razao_social?: string | null
          responsavel_nome?: string | null
          site?: string | null
          telefone_empresa?: string | null
          telefone_sac?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parceiro_detalhes: {
        Row: {
          correspondente_id: string
          created_at: string
          creci: string | null
          id: string
          imobiliaria_id: string | null
          logo_url: string | null
          percentual_comissao: number
          profile_id: string
          razao_social: string | null
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          correspondente_id: string
          created_at?: string
          creci?: string | null
          id?: string
          imobiliaria_id?: string | null
          logo_url?: string | null
          percentual_comissao?: number
          profile_id: string
          razao_social?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Update: {
          correspondente_id?: string
          created_at?: string
          creci?: string | null
          id?: string
          imobiliaria_id?: string | null
          logo_url?: string | null
          percentual_comissao?: number
          profile_id?: string
          razao_social?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_detalhes_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_detalhes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_escopo_alvos: {
        Row: {
          alvo_id: string | null
          alvo_tipo: string
          alvo_valor: string | null
          created_at: string
          id: string
          permission_id: string
        }
        Insert: {
          alvo_id?: string | null
          alvo_tipo: string
          alvo_valor?: string | null
          created_at?: string
          id?: string
          permission_id: string
        }
        Update: {
          alvo_id?: string | null
          alvo_tipo?: string
          alvo_valor?: string | null
          created_at?: string
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_escopo_alvos_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          acao: string
          created_at: string
          escopo_dados: Database["public"]["Enums"]["escopo_dados"]
          id: string
          modulo: string
          nivel_acesso_id: string
          permitido: boolean
          updated_at: string
        }
        Insert: {
          acao: string
          created_at?: string
          escopo_dados?: Database["public"]["Enums"]["escopo_dados"]
          id?: string
          modulo: string
          nivel_acesso_id: string
          permitido?: boolean
          updated_at?: string
        }
        Update: {
          acao?: string
          created_at?: string
          escopo_dados?: Database["public"]["Enums"]["escopo_dados"]
          id?: string
          modulo?: string
          nivel_acesso_id?: string
          permitido?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_nivel_acesso_id_fkey"
            columns: ["nivel_acesso_id"]
            isOneToOne: false
            referencedRelation: "access_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          codigo: string
          created_at: string
          id: string
          mensagem_cliente: string
          nome: string
          ordem: number
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          mensagem_cliente: string
          nome: string
          ordem: number
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          mensagem_cliente?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acesso_tipo: Database["public"]["Enums"]["acesso_tipo"]
          ativo: boolean
          bloqueado_em: string | null
          consentimento_lgpd_em: string | null
          correspondente_id: string | null
          created_at: string
          deleted_at: string | null
          documento: string | null
          email: string | null
          foto_url: string | null
          id: string
          login_habilitado: boolean
          nivel_acesso_id: string | null
          nome: string | null
          telefone: string | null
          tipo_pessoa: string
          tipos_pessoa: string[]
          ultima_atividade: string | null
          updated_at: string
        }
        Insert: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          bloqueado_em?: string | null
          consentimento_lgpd_em?: string | null
          correspondente_id?: string | null
          created_at?: string
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          foto_url?: string | null
          id: string
          login_habilitado?: boolean
          nivel_acesso_id?: string | null
          nome?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          tipos_pessoa?: string[]
          ultima_atividade?: string | null
          updated_at?: string
        }
        Update: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          bloqueado_em?: string | null
          consentimento_lgpd_em?: string | null
          correspondente_id?: string | null
          created_at?: string
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          login_habilitado?: boolean
          nivel_acesso_id?: string | null
          nome?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          tipos_pessoa?: string[]
          ultima_atividade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_nivel_acesso_id_fkey"
            columns: ["nivel_acesso_id"]
            isOneToOne: false
            referencedRelation: "access_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_bancos: {
        Row: {
          agencia: string | null
          banco_id: string | null
          codigo_banco: number | null
          codigo_indexador: string | null
          conta_corrente: string | null
          created_at: string
          digito_conta: string | null
          homefin_id_banco: number | null
          homefin_id_simulacao_banco: string | null
          id: string
          mensagem_banco: string | null
          nome_banco: string | null
          numero_proposta_banco: string | null
          prazo_pagamento_max: number | null
          proposta_id: string
          raw_response: Json | null
          selecionado: boolean | null
          simulacao_banco_id: string | null
          sistema_amortizacao_banco: string | null
          situacao_banco: string
          status_banco: string | null
          taxa_juros_ano: number | null
          updated_at: string
          valor_financiamento_max: number | null
          valor_iof: number | null
          valor_parcela: number | null
        }
        Insert: {
          agencia?: string | null
          banco_id?: string | null
          codigo_banco?: number | null
          codigo_indexador?: string | null
          conta_corrente?: string | null
          created_at?: string
          digito_conta?: string | null
          homefin_id_banco?: number | null
          homefin_id_simulacao_banco?: string | null
          id?: string
          mensagem_banco?: string | null
          nome_banco?: string | null
          numero_proposta_banco?: string | null
          prazo_pagamento_max?: number | null
          proposta_id: string
          raw_response?: Json | null
          selecionado?: boolean | null
          simulacao_banco_id?: string | null
          sistema_amortizacao_banco?: string | null
          situacao_banco?: string
          status_banco?: string | null
          taxa_juros_ano?: number | null
          updated_at?: string
          valor_financiamento_max?: number | null
          valor_iof?: number | null
          valor_parcela?: number | null
        }
        Update: {
          agencia?: string | null
          banco_id?: string | null
          codigo_banco?: number | null
          codigo_indexador?: string | null
          conta_corrente?: string | null
          created_at?: string
          digito_conta?: string | null
          homefin_id_banco?: number | null
          homefin_id_simulacao_banco?: string | null
          id?: string
          mensagem_banco?: string | null
          nome_banco?: string | null
          numero_proposta_banco?: string | null
          prazo_pagamento_max?: number | null
          proposta_id?: string
          raw_response?: Json | null
          selecionado?: boolean | null
          simulacao_banco_id?: string | null
          sistema_amortizacao_banco?: string | null
          situacao_banco?: string
          status_banco?: string | null
          taxa_juros_ano?: number | null
          updated_at?: string
          valor_financiamento_max?: number | null
          valor_iof?: number | null
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_bancos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_bancos_simulacao_banco_id_fkey"
            columns: ["simulacao_banco_id"]
            isOneToOne: false
            referencedRelation: "simulacao_bancos"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_documentos: {
        Row: {
          arquivo_url: string | null
          correspondente_id: string
          created_at: string
          enviado_em: string | null
          enviado_por: string | null
          erro_integracao: string | null
          expira_em: string | null
          homefin_id_documento: string | null
          homefin_id_oportunidade: string | null
          homefin_id_simulacao: string | null
          id: string
          integrado_em: string | null
          mime_type: string | null
          nome_documento: string
          obrigatorio: boolean | null
          parte: string | null
          proposta_id: string
          request_payload: Json | null
          response_payload: Json | null
          simulacao_id: string | null
          situacao_integracao: string | null
          status: Database["public"]["Enums"]["proposta_doc_status"]
          storage_path: string | null
          tamanho_bytes: number | null
          tipo_documento: string | null
          updated_at: string
          versao: number | null
        }
        Insert: {
          arquivo_url?: string | null
          correspondente_id: string
          created_at?: string
          enviado_em?: string | null
          enviado_por?: string | null
          erro_integracao?: string | null
          expira_em?: string | null
          homefin_id_documento?: string | null
          homefin_id_oportunidade?: string | null
          homefin_id_simulacao?: string | null
          id?: string
          integrado_em?: string | null
          mime_type?: string | null
          nome_documento: string
          obrigatorio?: boolean | null
          parte?: string | null
          proposta_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          simulacao_id?: string | null
          situacao_integracao?: string | null
          status?: Database["public"]["Enums"]["proposta_doc_status"]
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          versao?: number | null
        }
        Update: {
          arquivo_url?: string | null
          correspondente_id?: string
          created_at?: string
          enviado_em?: string | null
          enviado_por?: string | null
          erro_integracao?: string | null
          expira_em?: string | null
          homefin_id_documento?: string | null
          homefin_id_oportunidade?: string | null
          homefin_id_simulacao?: string | null
          id?: string
          integrado_em?: string | null
          mime_type?: string | null
          nome_documento?: string
          obrigatorio?: boolean | null
          parte?: string | null
          proposta_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          simulacao_id?: string | null
          situacao_integracao?: string | null
          status?: Database["public"]["Enums"]["proposta_doc_status"]
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_documentos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_envolvidos: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco_id_conta: number | null
          celular: string | null
          cep: string | null
          cliente_id: string | null
          complemento: string | null
          conjuge_de: string | null
          conta_corrente: string | null
          cpf_cnpj: string | null
          created_at: string
          dados: Json | null
          data_expedicao: string | null
          data_nascimento: string | null
          digito_conta: string | null
          email: string | null
          empresa: string | null
          estado_civil: string | null
          fg_autorizacao_dados: boolean
          homefin_id_participante: string | null
          id: string
          logradouro: string | null
          municipio: string | null
          nome: string | null
          nome_mae: string | null
          numero_documento: string | null
          numero_logradouro: string | null
          orgao_expedidor: string | null
          profissao: string | null
          proposta_id: string
          regime_casamento: string | null
          renda: number | null
          tipo_documento_identidade: string | null
          tipo_pessoa: string | null
          tipo_qualificacao: string
          tipo_sexo: string | null
          tipo_situacao: string
          uf: string | null
          uf_expedicao: string | null
          updated_at: string
          utiliza_fgts: boolean
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco_id_conta?: number | null
          celular?: string | null
          cep?: string | null
          cliente_id?: string | null
          complemento?: string | null
          conjuge_de?: string | null
          conta_corrente?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dados?: Json | null
          data_expedicao?: string | null
          data_nascimento?: string | null
          digito_conta?: string | null
          email?: string | null
          empresa?: string | null
          estado_civil?: string | null
          fg_autorizacao_dados?: boolean
          homefin_id_participante?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          nome?: string | null
          nome_mae?: string | null
          numero_documento?: string | null
          numero_logradouro?: string | null
          orgao_expedidor?: string | null
          profissao?: string | null
          proposta_id: string
          regime_casamento?: string | null
          renda?: number | null
          tipo_documento_identidade?: string | null
          tipo_pessoa?: string | null
          tipo_qualificacao?: string
          tipo_sexo?: string | null
          tipo_situacao?: string
          uf?: string | null
          uf_expedicao?: string | null
          updated_at?: string
          utiliza_fgts?: boolean
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco_id_conta?: number | null
          celular?: string | null
          cep?: string | null
          cliente_id?: string | null
          complemento?: string | null
          conjuge_de?: string | null
          conta_corrente?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dados?: Json | null
          data_expedicao?: string | null
          data_nascimento?: string | null
          digito_conta?: string | null
          email?: string | null
          empresa?: string | null
          estado_civil?: string | null
          fg_autorizacao_dados?: boolean
          homefin_id_participante?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          nome?: string | null
          nome_mae?: string | null
          numero_documento?: string | null
          numero_logradouro?: string | null
          orgao_expedidor?: string | null
          profissao?: string | null
          proposta_id?: string
          regime_casamento?: string | null
          renda?: number | null
          tipo_documento_identidade?: string | null
          tipo_pessoa?: string | null
          tipo_qualificacao?: string
          tipo_sexo?: string | null
          tipo_situacao?: string
          uf?: string | null
          uf_expedicao?: string | null
          updated_at?: string
          utiliza_fgts?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "proposta_envolvidos_conjuge_de_fkey"
            columns: ["conjuge_de"]
            isOneToOne: false
            referencedRelation: "proposta_envolvidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_envolvidos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_followups: {
        Row: {
          autor_id: string | null
          comentario: string
          created_at: string
          data_previsao: string | null
          homefin_enviado: boolean | null
          id: string
          proposta_id: string
          responsavel_id: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          autor_id?: string | null
          comentario: string
          created_at?: string
          data_previsao?: string | null
          homefin_enviado?: boolean | null
          id?: string
          proposta_id: string
          responsavel_id?: string | null
          tipo?: string
          titulo?: string | null
        }
        Update: {
          autor_id?: string | null
          comentario?: string
          created_at?: string
          data_previsao?: string | null
          homefin_enviado?: boolean | null
          id?: string
          proposta_id?: string
          responsavel_id?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_followups_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_historico: {
        Row: {
          ator_id: string | null
          created_at: string
          descricao: string | null
          id: string
          proposta_id: string
          status_anterior: Database["public"]["Enums"]["proposta_status"] | null
          status_novo: Database["public"]["Enums"]["proposta_status"] | null
          tipo_evento: string
        }
        Insert: {
          ator_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          proposta_id: string
          status_anterior?:
            | Database["public"]["Enums"]["proposta_status"]
            | null
          status_novo?: Database["public"]["Enums"]["proposta_status"] | null
          tipo_evento: string
        }
        Update: {
          ator_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          proposta_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["proposta_status"]
            | null
          status_novo?: Database["public"]["Enums"]["proposta_status"] | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_historico_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_logs_homefin: {
        Row: {
          correspondente_id: string | null
          created_at: string
          endpoint: string
          erro: string | null
          id: string
          metodo: string
          proposta_id: string | null
          request_masked: Json | null
          response: Json | null
          status_http: number | null
        }
        Insert: {
          correspondente_id?: string | null
          created_at?: string
          endpoint: string
          erro?: string | null
          id?: string
          metodo: string
          proposta_id?: string | null
          request_masked?: Json | null
          response?: Json | null
          status_http?: number | null
        }
        Update: {
          correspondente_id?: string | null
          created_at?: string
          endpoint?: string
          erro?: string | null
          id?: string
          metodo?: string
          proposta_id?: string | null
          request_masked?: Json | null
          response?: Json | null
          status_http?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_logs_homefin_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_pdfs: {
        Row: {
          created_at: string
          gerado_por: string | null
          id: string
          proposta_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          gerado_por?: string | null
          id?: string
          proposta_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          gerado_por?: string | null
          id?: string
          proposta_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_pdfs_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          agencia: string | null
          analista_id: string | null
          analista_nome: string | null
          bairro_imovel: string | null
          banco_id: string | null
          celular: string | null
          cep_imovel: string | null
          cidade_imovel: string | null
          cliente_id: string | null
          codigo_indexador_aprovado: string | null
          codigo_oportunidade_homefin: string | null
          comercial_id: string | null
          comissao_status: string | null
          complemento_imovel: string | null
          compoe_renda: boolean | null
          consentimento_lgpd: boolean | null
          consentimento_scr: boolean | null
          consultor_nome: string | null
          conta_corrente: string | null
          contato_avaliacao_nome: string | null
          contato_avaliacao_telefone: string | null
          contrato_emitido_em: string | null
          correspondente_id: string
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          detalhe_status_atual: string | null
          digito_conta: string | null
          email: string | null
          endereco_imovel: string | null
          enviada_em: string | null
          estado_civil: string | null
          etapas_banco: Json
          financia_despesas_cartorarias: boolean | null
          homefin_id_oportunidade: string | null
          homefin_id_simulacao: string | null
          id: string
          id_operacao_homefin: number | null
          ip_consentimento: string | null
          iq_comentario: string | null
          iq_nome: string | null
          motivo_cancelamento: string | null
          nome_banco: string | null
          nome_cliente: string | null
          numero_imovel: string | null
          numero_proposta: string
          numero_proposta_banco: string | null
          parceiro_id: string | null
          parceiro_nome: string | null
          possui_conjuge: boolean | null
          prazo: number | null
          prazo_aprovado: number | null
          produto: string | null
          regional_nome: string | null
          regra_comissao_id: string | null
          renda_total: number | null
          simulacao_id: string | null
          sistema_amortizacao: string | null
          sistema_amortizacao_aprovado: string | null
          situacao_imovel: string | null
          status: Database["public"]["Enums"]["proposta_status"]
          status_atualizado_em: string | null
          taxa_juros_ano_aprovado: number | null
          tipo_imovel: string | null
          uf: string | null
          ultima_sincronizacao_em: string | null
          ultimo_erro: string | null
          updated_at: string
          uso_imovel: string | null
          usuario_criador_id: string | null
          usuario_parceiro_id: string | null
          usuario_responsavel_id: string | null
          utiliza_fgts: boolean | null
          valor_comissao_calculada: number | null
          valor_financiamento: number | null
          valor_financiamento_aprovado: number | null
          valor_imovel: number | null
          valor_iof_aprovado: number | null
          valor_parcela_aprovado: number | null
        }
        Insert: {
          agencia?: string | null
          analista_id?: string | null
          analista_nome?: string | null
          bairro_imovel?: string | null
          banco_id?: string | null
          celular?: string | null
          cep_imovel?: string | null
          cidade_imovel?: string | null
          cliente_id?: string | null
          codigo_indexador_aprovado?: string | null
          codigo_oportunidade_homefin?: string | null
          comercial_id?: string | null
          comissao_status?: string | null
          complemento_imovel?: string | null
          compoe_renda?: boolean | null
          consentimento_lgpd?: boolean | null
          consentimento_scr?: boolean | null
          consultor_nome?: string | null
          conta_corrente?: string | null
          contato_avaliacao_nome?: string | null
          contato_avaliacao_telefone?: string | null
          contrato_emitido_em?: string | null
          correspondente_id: string
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          detalhe_status_atual?: string | null
          digito_conta?: string | null
          email?: string | null
          endereco_imovel?: string | null
          enviada_em?: string | null
          estado_civil?: string | null
          etapas_banco?: Json
          financia_despesas_cartorarias?: boolean | null
          homefin_id_oportunidade?: string | null
          homefin_id_simulacao?: string | null
          id?: string
          id_operacao_homefin?: number | null
          ip_consentimento?: string | null
          iq_comentario?: string | null
          iq_nome?: string | null
          motivo_cancelamento?: string | null
          nome_banco?: string | null
          nome_cliente?: string | null
          numero_imovel?: string | null
          numero_proposta: string
          numero_proposta_banco?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          possui_conjuge?: boolean | null
          prazo?: number | null
          prazo_aprovado?: number | null
          produto?: string | null
          regional_nome?: string | null
          regra_comissao_id?: string | null
          renda_total?: number | null
          simulacao_id?: string | null
          sistema_amortizacao?: string | null
          sistema_amortizacao_aprovado?: string | null
          situacao_imovel?: string | null
          status?: Database["public"]["Enums"]["proposta_status"]
          status_atualizado_em?: string | null
          taxa_juros_ano_aprovado?: number | null
          tipo_imovel?: string | null
          uf?: string | null
          ultima_sincronizacao_em?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          uso_imovel?: string | null
          usuario_criador_id?: string | null
          usuario_parceiro_id?: string | null
          usuario_responsavel_id?: string | null
          utiliza_fgts?: boolean | null
          valor_comissao_calculada?: number | null
          valor_financiamento?: number | null
          valor_financiamento_aprovado?: number | null
          valor_imovel?: number | null
          valor_iof_aprovado?: number | null
          valor_parcela_aprovado?: number | null
        }
        Update: {
          agencia?: string | null
          analista_id?: string | null
          analista_nome?: string | null
          bairro_imovel?: string | null
          banco_id?: string | null
          celular?: string | null
          cep_imovel?: string | null
          cidade_imovel?: string | null
          cliente_id?: string | null
          codigo_indexador_aprovado?: string | null
          codigo_oportunidade_homefin?: string | null
          comercial_id?: string | null
          comissao_status?: string | null
          complemento_imovel?: string | null
          compoe_renda?: boolean | null
          consentimento_lgpd?: boolean | null
          consentimento_scr?: boolean | null
          consultor_nome?: string | null
          conta_corrente?: string | null
          contato_avaliacao_nome?: string | null
          contato_avaliacao_telefone?: string | null
          contrato_emitido_em?: string | null
          correspondente_id?: string
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          detalhe_status_atual?: string | null
          digito_conta?: string | null
          email?: string | null
          endereco_imovel?: string | null
          enviada_em?: string | null
          estado_civil?: string | null
          etapas_banco?: Json
          financia_despesas_cartorarias?: boolean | null
          homefin_id_oportunidade?: string | null
          homefin_id_simulacao?: string | null
          id?: string
          id_operacao_homefin?: number | null
          ip_consentimento?: string | null
          iq_comentario?: string | null
          iq_nome?: string | null
          motivo_cancelamento?: string | null
          nome_banco?: string | null
          nome_cliente?: string | null
          numero_imovel?: string | null
          numero_proposta?: string
          numero_proposta_banco?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          possui_conjuge?: boolean | null
          prazo?: number | null
          prazo_aprovado?: number | null
          produto?: string | null
          regional_nome?: string | null
          regra_comissao_id?: string | null
          renda_total?: number | null
          simulacao_id?: string | null
          sistema_amortizacao?: string | null
          sistema_amortizacao_aprovado?: string | null
          situacao_imovel?: string | null
          status?: Database["public"]["Enums"]["proposta_status"]
          status_atualizado_em?: string | null
          taxa_juros_ano_aprovado?: number | null
          tipo_imovel?: string | null
          uf?: string | null
          ultima_sincronizacao_em?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          uso_imovel?: string | null
          usuario_criador_id?: string | null
          usuario_parceiro_id?: string | null
          usuario_responsavel_id?: string | null
          utiliza_fgts?: boolean | null
          valor_comissao_calculada?: number | null
          valor_financiamento?: number | null
          valor_financiamento_aprovado?: number | null
          valor_imovel?: number | null
          valor_iof_aprovado?: number | null
          valor_parcela_aprovado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          aprovado_em: string | null
          aprovador_id: string | null
          categoria: string | null
          correspondente_id: string
          created_at: string
          descricao: string
          id: string
          numero: string | null
          observacao: string | null
          payable_id: string | null
          solicitante_id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          categoria?: string | null
          correspondente_id: string
          created_at?: string
          descricao: string
          id?: string
          numero?: string | null
          observacao?: string | null
          payable_id?: string | null
          solicitante_id: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          categoria?: string | null
          correspondente_id?: string
          created_at?: string
          descricao?: string
          id?: string
          numero?: string | null
          observacao?: string | null
          payable_id?: string | null
          solicitante_id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "financial_payables"
            referencedColumns: ["id"]
          },
        ]
      }
      report_audit_logs: {
        Row: {
          acao: string
          correspondente_id: string
          created_at: string
          filtros: Json
          formato: string | null
          id: string
          registros: number
          report_codigo: string
          user_id: string
        }
        Insert: {
          acao: string
          correspondente_id: string
          created_at?: string
          filtros?: Json
          formato?: string | null
          id?: string
          registros?: number
          report_codigo: string
          user_id: string
        }
        Update: {
          acao?: string
          correspondente_id?: string
          created_at?: string
          filtros?: Json
          formato?: string | null
          id?: string
          registros?: number
          report_codigo?: string
          user_id?: string
        }
        Relationships: []
      }
      report_definitions: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          modulo: string
          ordem: number
          titulo: string
          view_base: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo: string
          ordem?: number
          titulo: string
          view_base?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string
          ordem?: number
          titulo?: string
          view_base?: string | null
        }
        Relationships: []
      }
      report_exports: {
        Row: {
          arquivo_path: string | null
          correspondente_id: string
          created_at: string
          filtros: Json
          formato: string
          id: string
          registros: number
          report_codigo: string
          status: string
          user_id: string
        }
        Insert: {
          arquivo_path?: string | null
          correspondente_id: string
          created_at?: string
          filtros?: Json
          formato: string
          id?: string
          registros?: number
          report_codigo: string
          status?: string
          user_id: string
        }
        Update: {
          arquivo_path?: string | null
          correspondente_id?: string
          created_at?: string
          filtros?: Json
          formato?: string
          id?: string
          registros?: number
          report_codigo?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      report_saved_filters: {
        Row: {
          colunas: Json | null
          correspondente_id: string
          created_at: string
          filtros: Json
          grafico: string | null
          id: string
          nome: string
          report_codigo: string
          updated_at: string
          user_id: string
          view_base: string | null
          visibilidade: string
        }
        Insert: {
          colunas?: Json | null
          correspondente_id: string
          created_at?: string
          filtros?: Json
          grafico?: string | null
          id?: string
          nome: string
          report_codigo: string
          updated_at?: string
          user_id: string
          view_base?: string | null
          visibilidade?: string
        }
        Update: {
          colunas?: Json | null
          correspondente_id?: string
          created_at?: string
          filtros?: Json
          grafico?: string | null
          id?: string
          nome?: string
          report_codigo?: string
          updated_at?: string
          user_id?: string
          view_base?: string | null
          visibilidade?: string
        }
        Relationships: []
      }
      scan_ia_auditoria: {
        Row: {
          acao: string
          ator_id: string | null
          correspondente_id: string
          created_at: string
          dados: Json
          id: string
          leitura_id: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          correspondente_id: string
          created_at?: string
          dados?: Json
          id?: string
          leitura_id?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          correspondente_id?: string
          created_at?: string
          dados?: Json
          id?: string
          leitura_id?: string | null
        }
        Relationships: []
      }
      scan_ia_campos_extraidos: {
        Row: {
          campo: string
          confianca: number
          created_at: string
          id: string
          leitura_id: string
          valor: string | null
        }
        Insert: {
          campo: string
          confianca?: number
          created_at?: string
          id?: string
          leitura_id: string
          valor?: string | null
        }
        Update: {
          campo?: string
          confianca?: number
          created_at?: string
          id?: string
          leitura_id?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_ia_campos_extraidos_leitura_id_fkey"
            columns: ["leitura_id"]
            isOneToOne: false
            referencedRelation: "scan_ia_leituras"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_ia_leituras: {
        Row: {
          arquivo_url: string
          cliente_id: string | null
          correspondente_id: string
          created_at: string
          criador_id: string | null
          erro: string | null
          id: string
          proposta_id: string | null
          status: string
          tipo_documento: string | null
          updated_at: string
        }
        Insert: {
          arquivo_url: string
          cliente_id?: string | null
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          erro?: string | null
          id?: string
          proposta_id?: string | null
          status?: string
          tipo_documento?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_url?: string
          cliente_id?: string | null
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          erro?: string | null
          id?: string
          proposta_id?: string | null
          status?: string
          tipo_documento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_ia_leituras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_ia_leituras_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacao_bancos: {
        Row: {
          banco_id: string | null
          codigo_banco: number | null
          codigo_indexador: string | null
          created_at: string
          flag_simulacao: string | null
          homefin_id_banco: number | null
          homefin_id_simulacao_banco: string | null
          id: string
          mensagem_banco: string | null
          nome_banco: string | null
          prazo_pagamento_max: number | null
          raw_request: Json | null
          raw_response: Json | null
          selecionado: boolean
          simulacao_id: string
          simulado_em: string | null
          sistema_amortizacao_banco: string | null
          status_banco: Database["public"]["Enums"]["simulacao_banco_status"]
          taxa_juros_ano: number | null
          updated_at: string
          valor_financiamento_max: number | null
          valor_iof: number | null
          valor_parcela: number | null
          valor_parcela_max: number | null
        }
        Insert: {
          banco_id?: string | null
          codigo_banco?: number | null
          codigo_indexador?: string | null
          created_at?: string
          flag_simulacao?: string | null
          homefin_id_banco?: number | null
          homefin_id_simulacao_banco?: string | null
          id?: string
          mensagem_banco?: string | null
          nome_banco?: string | null
          prazo_pagamento_max?: number | null
          raw_request?: Json | null
          raw_response?: Json | null
          selecionado?: boolean
          simulacao_id: string
          simulado_em?: string | null
          sistema_amortizacao_banco?: string | null
          status_banco?: Database["public"]["Enums"]["simulacao_banco_status"]
          taxa_juros_ano?: number | null
          updated_at?: string
          valor_financiamento_max?: number | null
          valor_iof?: number | null
          valor_parcela?: number | null
          valor_parcela_max?: number | null
        }
        Update: {
          banco_id?: string | null
          codigo_banco?: number | null
          codigo_indexador?: string | null
          created_at?: string
          flag_simulacao?: string | null
          homefin_id_banco?: number | null
          homefin_id_simulacao_banco?: string | null
          id?: string
          mensagem_banco?: string | null
          nome_banco?: string | null
          prazo_pagamento_max?: number | null
          raw_request?: Json | null
          raw_response?: Json | null
          selecionado?: boolean
          simulacao_id?: string
          simulado_em?: string | null
          sistema_amortizacao_banco?: string | null
          status_banco?: Database["public"]["Enums"]["simulacao_banco_status"]
          taxa_juros_ano?: number | null
          updated_at?: string
          valor_financiamento_max?: number | null
          valor_iof?: number | null
          valor_parcela?: number | null
          valor_parcela_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_bancos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "homefin_bancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacao_bancos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "vw_bancos_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacao_bancos_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacao_historico: {
        Row: {
          ator_id: string | null
          created_at: string
          descricao: string
          id: string
          simulacao_id: string
          tipo: string
        }
        Insert: {
          ator_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          simulacao_id: string
          tipo: string
        }
        Update: {
          ator_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          simulacao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_historico_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacao_logs_homefin: {
        Row: {
          correspondente_id: string | null
          created_at: string
          endpoint: string
          erro: string | null
          id: string
          metodo: string
          request_masked: Json | null
          response: Json | null
          simulacao_id: string | null
          status_http: number | null
        }
        Insert: {
          correspondente_id?: string | null
          created_at?: string
          endpoint: string
          erro?: string | null
          id?: string
          metodo: string
          request_masked?: Json | null
          response?: Json | null
          simulacao_id?: string | null
          status_http?: number | null
        }
        Update: {
          correspondente_id?: string | null
          created_at?: string
          endpoint?: string
          erro?: string | null
          id?: string
          metodo?: string
          request_masked?: Json | null
          response?: Json | null
          simulacao_id?: string | null
          status_http?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_logs_homefin_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacao_participantes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          dados: Json | null
          data_nascimento: string | null
          estado_civil: string | null
          homefin_id_participante: string | null
          id: string
          nome: string | null
          renda: number | null
          simulacao_id: string
          tipo_pessoa: string | null
          tipo_qualificacao: string | null
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          dados?: Json | null
          data_nascimento?: string | null
          estado_civil?: string | null
          homefin_id_participante?: string | null
          id?: string
          nome?: string | null
          renda?: number | null
          simulacao_id: string
          tipo_pessoa?: string | null
          tipo_qualificacao?: string | null
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          dados?: Json | null
          data_nascimento?: string | null
          estado_civil?: string | null
          homefin_id_participante?: string | null
          id?: string
          nome?: string | null
          renda?: number | null
          simulacao_id?: string
          tipo_pessoa?: string | null
          tipo_qualificacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_participantes_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacao_pdfs: {
        Row: {
          banco_id: string | null
          created_at: string
          gerado_por: string | null
          id: string
          simulacao_id: string
          storage_path: string
        }
        Insert: {
          banco_id?: string | null
          created_at?: string
          gerado_por?: string | null
          id?: string
          simulacao_id: string
          storage_path: string
        }
        Update: {
          banco_id?: string | null
          created_at?: string
          gerado_por?: string | null
          id?: string
          simulacao_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_pdfs_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacoes: {
        Row: {
          analista_id: string | null
          celular: string | null
          celular_conjuge: string | null
          cep_imovel: string | null
          cliente_id: string | null
          codigo_oportunidade_homefin: string | null
          comercial_id: string | null
          compoe_renda: boolean
          consentimento_em: string | null
          consentimento_ip: string | null
          consentimento_lgpd: boolean
          consentimento_scr: boolean
          correspondente_id: string
          cpf_cnpj: string | null
          cpf_conjuge: string | null
          created_at: string
          data_nascimento: string | null
          data_nascimento_conjuge: string | null
          email: string | null
          email_conjuge: string | null
          email_verificado_em: string | null
          email_verificado_por: string | null
          estado_civil: string | null
          estado_civil_conjuge: string | null
          fg_financiar_despesas: boolean | null
          homefin_id_oportunidade: string | null
          id: string
          id_operacao_homefin: number | null
          nome_cliente: string | null
          nome_conjuge: string | null
          numero_simulacao: string
          parceiro_id: string | null
          percentual_despesas: number | null
          possui_conjuge: boolean
          possui_imovel_escolhido: boolean | null
          prazo: number | null
          prazo_anos: number | null
          produto: string | null
          regime_casamento: string | null
          renda_conjuge: number | null
          renda_total: number | null
          sistema_amortizacao: string | null
          situacao_imovel: string | null
          status: Database["public"]["Enums"]["simulacao_status"]
          tipo_imovel: string | null
          tipo_simulacao: Database["public"]["Enums"]["simulacao_tipo"]
          uf: string | null
          ultimo_envio_em: string | null
          ultimo_erro: string | null
          updated_at: string
          uso_imovel: string | null
          usuario_criador_id: string
          usuario_responsavel_id: string | null
          utiliza_fgts: string | null
          valor_despesas_financiadas: number
          valor_entrada: number | null
          valor_financiamento: number | null
          valor_imovel: number | null
        }
        Insert: {
          analista_id?: string | null
          celular?: string | null
          celular_conjuge?: string | null
          cep_imovel?: string | null
          cliente_id?: string | null
          codigo_oportunidade_homefin?: string | null
          comercial_id?: string | null
          compoe_renda?: boolean
          consentimento_em?: string | null
          consentimento_ip?: string | null
          consentimento_lgpd?: boolean
          consentimento_scr?: boolean
          correspondente_id: string
          cpf_cnpj?: string | null
          cpf_conjuge?: string | null
          created_at?: string
          data_nascimento?: string | null
          data_nascimento_conjuge?: string | null
          email?: string | null
          email_conjuge?: string | null
          email_verificado_em?: string | null
          email_verificado_por?: string | null
          estado_civil?: string | null
          estado_civil_conjuge?: string | null
          fg_financiar_despesas?: boolean | null
          homefin_id_oportunidade?: string | null
          id?: string
          id_operacao_homefin?: number | null
          nome_cliente?: string | null
          nome_conjuge?: string | null
          numero_simulacao: string
          parceiro_id?: string | null
          percentual_despesas?: number | null
          possui_conjuge?: boolean
          possui_imovel_escolhido?: boolean | null
          prazo?: number | null
          prazo_anos?: number | null
          produto?: string | null
          regime_casamento?: string | null
          renda_conjuge?: number | null
          renda_total?: number | null
          sistema_amortizacao?: string | null
          situacao_imovel?: string | null
          status?: Database["public"]["Enums"]["simulacao_status"]
          tipo_imovel?: string | null
          tipo_simulacao?: Database["public"]["Enums"]["simulacao_tipo"]
          uf?: string | null
          ultimo_envio_em?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          uso_imovel?: string | null
          usuario_criador_id: string
          usuario_responsavel_id?: string | null
          utiliza_fgts?: string | null
          valor_despesas_financiadas?: number
          valor_entrada?: number | null
          valor_financiamento?: number | null
          valor_imovel?: number | null
        }
        Update: {
          analista_id?: string | null
          celular?: string | null
          celular_conjuge?: string | null
          cep_imovel?: string | null
          cliente_id?: string | null
          codigo_oportunidade_homefin?: string | null
          comercial_id?: string | null
          compoe_renda?: boolean
          consentimento_em?: string | null
          consentimento_ip?: string | null
          consentimento_lgpd?: boolean
          consentimento_scr?: boolean
          correspondente_id?: string
          cpf_cnpj?: string | null
          cpf_conjuge?: string | null
          created_at?: string
          data_nascimento?: string | null
          data_nascimento_conjuge?: string | null
          email?: string | null
          email_conjuge?: string | null
          email_verificado_em?: string | null
          email_verificado_por?: string | null
          estado_civil?: string | null
          estado_civil_conjuge?: string | null
          fg_financiar_despesas?: boolean | null
          homefin_id_oportunidade?: string | null
          id?: string
          id_operacao_homefin?: number | null
          nome_cliente?: string | null
          nome_conjuge?: string | null
          numero_simulacao?: string
          parceiro_id?: string | null
          percentual_despesas?: number | null
          possui_conjuge?: boolean
          possui_imovel_escolhido?: boolean | null
          prazo?: number | null
          prazo_anos?: number | null
          produto?: string | null
          regime_casamento?: string | null
          renda_conjuge?: number | null
          renda_total?: number | null
          sistema_amortizacao?: string | null
          situacao_imovel?: string | null
          status?: Database["public"]["Enums"]["simulacao_status"]
          tipo_imovel?: string | null
          tipo_simulacao?: Database["public"]["Enums"]["simulacao_tipo"]
          uf?: string | null
          ultimo_envio_em?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          uso_imovel?: string | null
          usuario_criador_id?: string
          usuario_responsavel_id?: string | null
          utiliza_fgts?: string | null
          valor_despesas_financiadas?: number
          valor_entrada?: number | null
          valor_financiamento?: number | null
          valor_imovel?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_catalogo_itens: {
        Row: {
          ativo: boolean
          categoria: string
          correspondente_id: string
          created_at: string
          id: string
          label: string
          ordem: number
          updated_at: string
          valor: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          correspondente_id: string
          created_at?: string
          id?: string
          label: string
          ordem?: number
          updated_at?: string
          valor: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          correspondente_id?: string
          created_at?: string
          id?: string
          label?: string
          ordem?: number
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      sla_configuracoes: {
        Row: {
          ativo: boolean
          canal_escalonamento: string
          correspondente_id: string
          created_at: string
          horas_uteis: number
          id: string
          prioridade: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal_escalonamento?: string
          correspondente_id: string
          created_at?: string
          horas_uteis?: number
          id?: string
          prioridade?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal_escalonamento?: string
          correspondente_id?: string
          created_at?: string
          horas_uteis?: number
          id?: string
          prioridade?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          autor_id: string | null
          created_at: string
          id: string
          nome: string
          storage_path: string
          tamanho: number | null
          task_id: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          id?: string
          nome: string
          storage_path: string
          tamanho?: number | null
          task_id: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          id?: string
          nome?: string
          storage_path?: string
          tamanho?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_audit_logs: {
        Row: {
          acao: string
          ator_id: string | null
          correspondente_id: string | null
          created_at: string
          dados: Json | null
          id: string
          task_id: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          correspondente_id?: string | null
          created_at?: string
          dados?: Json | null
          id?: string
          task_id?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          correspondente_id?: string | null
          created_at?: string
          dados?: Json | null
          id?: string
          task_id?: string | null
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          concluido: boolean
          created_at: string
          descricao: string
          id: string
          ordem: number
          task_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          task_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          autor_id: string
          corpo: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          autor_id: string
          corpo: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          autor_id?: string
          corpo?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          acao: string
          ator_id: string | null
          created_at: string
          detalhe: string | null
          id: string
          task_id: string
        }
        Insert: {
          acao: string
          ator_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          task_id: string
        }
        Update: {
          acao?: string
          ator_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_participants: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tag_links: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "task_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tag_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          cor: string
          correspondente_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          correspondente_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          correspondente_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          cliente_id: string | null
          concluida_em: string | null
          correspondente_id: string
          created_at: string
          criador_id: string | null
          descricao: string | null
          id: string
          numero: string | null
          origem: string
          prazo: string | null
          prioridade: Database["public"]["Enums"]["prioridade_op"]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          concluida_em?: string | null
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          descricao?: string | null
          id?: string
          numero?: string | null
          origem?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_op"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          concluida_em?: string | null
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          descricao?: string | null
          id?: string
          numero?: string | null
          origem?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_op"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_pessoa: {
        Row: {
          acesso_tipo: Database["public"]["Enums"]["acesso_tipo"]
          ativo: boolean
          correspondente_id: string
          created_at: string
          descricao: string | null
          id: string
          is_padrao: boolean
          login_padrao: boolean
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          correspondente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          login_padrao?: boolean
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          correspondente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          login_padrao?: boolean
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_bancos_ativos: {
        Row: {
          codigo_banco: number | null
          flag_padrao: boolean | null
          flag_simulacao: string | null
          id: string | null
          id_banco: number | null
          nome_banco: string | null
          ordem: number | null
        }
        Insert: {
          codigo_banco?: number | null
          flag_padrao?: boolean | null
          flag_simulacao?: string | null
          id?: string | null
          id_banco?: number | null
          nome_banco?: string | null
          ordem?: number | null
        }
        Update: {
          codigo_banco?: number | null
          flag_padrao?: boolean | null
          flag_simulacao?: string | null
          id?: string | null
          id_banco?: number | null
          nome_banco?: string | null
          ordem?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_horas_uteis: {
        Args: { _corr: string; _horas: number; _inicio: string }
        Returns: string
      }
      calcular_comissao_proposta: {
        Args: { _prop_id: string }
        Returns: string
      }
      can_view_global_reports: { Args: { _user_id: string }; Returns: boolean }
      can_view_team_reports: { Args: { _user_id: string }; Returns: boolean }
      cliente_cadastro_esta_completo: {
        Args: { _cliente_id: string }
        Returns: boolean
      }
      cliente_pipeline_avancar_para: {
        Args: {
          _acao?: string
          _cliente_id: string
          _codigo_destino: string
          _obs?: string
        }
        Returns: undefined
      }
      cliente_pipeline_definir: {
        Args: { _cliente_id: string; _codigo_destino: string; _obs?: string }
        Returns: undefined
      }
      cliente_vinculado_ao_parceiro: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
      }
      correspondente_do_usuario: { Args: { _user_id: string }; Returns: string }
      demanda_escalar_vencidas: { Args: { _corr: string }; Returns: number }
      domingo_de_pascoa: { Args: { ano: number }; Returns: string }
      emitir_notificacao: {
        Args: {
          _corpo: string
          _corr: string
          _link: string
          _tipo: string
          _titulo: string
          _user_id: string
        }
        Returns: undefined
      }
      garantir_feriados_nacionais: {
        Args: { ano_fim: number; ano_inicio: number }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_correspondente: { Args: { _user_id: string }; Returns: boolean }
      is_dia_util: { Args: { _corr: string; _d: string }; Returns: boolean }
      is_equipe_interna: { Args: { _user_id: string }; Returns: boolean }
      is_interno: { Args: { _user_id: string }; Returns: boolean }
      mask_pii_jsonb: { Args: { _data: Json }; Returns: Json }
      notificar_cliente_portal: {
        Args: {
          _cliente_id: string
          _corpo: string
          _corr: string
          _link?: string
          _tipo: string
          _titulo: string
        }
        Returns: undefined
      }
      pode_gerenciar_pessoas: { Args: { _user_id: string }; Returns: boolean }
      portal_acompanhamento: { Args: { _cid: string }; Returns: Json }
      portal_baixar_dados: { Args: { _cid: string }; Returns: Json }
      portal_cliente_login: {
        Args: {
          _data_nasc: string
          _doc_hash: string
          _documento: string
          _ip: string
          _tipo: string
          _ua: string
        }
        Returns: Json
      }
      portal_cliente_sessao: { Args: { _cid: string }; Returns: Json }
      portal_enviar_mensagem: {
        Args: {
          _anexo: string
          _atendente: string
          _cid: string
          _corr: string
          _msg: string
        }
        Returns: Json
      }
      portal_excluir_app_cliente: { Args: { _cid: string }; Returns: Json }
      portal_listar_atendentes: { Args: { _cid: string }; Returns: Json }
      portal_listar_mensagens: {
        Args: { _atendente: string; _cid: string }
        Returns: Json
      }
      portal_listar_notificacoes: { Args: { _cid: string }; Returns: Json }
      portal_marcar_lida: {
        Args: { _cid: string; _ids: string[] }
        Returns: undefined
      }
      portal_marcar_notif_lida: {
        Args: { _cid: string; _id: string }
        Returns: undefined
      }
      portal_meus_documentos: { Args: { _cid: string }; Returns: Json }
      portal_minhas_propostas: { Args: { _cid: string }; Returns: Json }
      portal_registrar_consentimento_lgpd: {
        Args: { _cid: string; _ip: string; _ua: string; _versao: string }
        Returns: Json
      }
      portal_registrar_documento: {
        Args: {
          _cid: string
          _mime: string
          _nome: string
          _path: string
          _tamanho: number
          _tipo: string
        }
        Returns: undefined
      }
      portal_solicitar_lgpd: {
        Args: { _acao: string; _cid: string; _corr: string }
        Returns: undefined
      }
      portal_time_marcar_lidas: { Args: { _cid: string }; Returns: undefined }
      portal_time_responder: {
        Args: { _anexo: string; _cid: string; _msg: string }
        Returns: Json
      }
      portal_time_responder_thread: {
        Args: { _anexo: string; _atendente: string; _cid: string; _msg: string }
        Returns: Json
      }
      portal_visao_geral: { Args: { _cid: string }; Returns: Json }
      purgar_conversas_pos_contrato: { Args: never; Returns: number }
      registrar_auditoria:
        | {
            Args: {
              _acao: string
              _entidade?: string
              _entidade_id?: string
              _ip?: string
              _payload_anterior?: Json
              _payload_novo?: Json
              _user_agent?: string
            }
            Returns: string
          }
        | {
            Args: {
              _acao: string
              _descricao?: string
              _entidade?: string
              _entidade_id?: string
              _ip?: string
              _payload_anterior?: Json
              _payload_novo?: Json
              _user_agent?: string
            }
            Returns: string
          }
      usuario_escopo_dados: {
        Args: { _modulo: string; _user_id: string }
        Returns: Database["public"]["Enums"]["escopo_dados"]
      }
      usuario_escopo_inclui_dono: {
        Args: { _modulo: string; _owner_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_participa_chat: {
        Args: { _atendente_id: string; _cliente_id: string; _uid: string }
        Returns: boolean
      }
      usuario_pode_admin: { Args: { _user_id: string }; Returns: boolean }
      usuario_pode_financeiro: { Args: { _user_id: string }; Returns: boolean }
      usuario_tem_acesso_cliente: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_demanda: {
        Args: { _dem_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_proposta: {
        Args: { _prop_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_simulacao: {
        Args: { _sim_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_tarefa: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_permissao: {
        Args: { _acao: string; _modulo: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      acesso_tipo: "sistema" | "portal_parceiro"
      app_role:
        | "admin"
        | "correspondente"
        | "gestor"
        | "comercial"
        | "analista"
        | "imobiliaria"
        | "corretor"
        | "cliente"
        | "financeiro"
      cliente_estado_civil:
        | "solteiro"
        | "casado"
        | "uniao_estavel"
        | "divorciado"
        | "viuvo"
      cliente_origem: "direto" | "parceiro" | "indicacao" | "importacao"
      comissao_regra_tipo: "percentual" | "fixo"
      comissao_status: "a_receber" | "recebida" | "paga_parceiro" | "encerrada"
      demanda_status:
        | "aberta"
        | "em_andamento"
        | "aguardando"
        | "concluida"
        | "cancelada"
      doc_categoria:
        | "comprador"
        | "conjuge"
        | "vendedor"
        | "imovel"
        | "outros"
        | "vendedor_conjuge"
      doc_status:
        | "pendente"
        | "recebido"
        | "aprovado"
        | "reprovado"
        | "expirado"
      escopo_dados: "todos" | "equipe" | "proprios" | "personalizado"
      financial_categoria_tipo: "despesa" | "receita"
      financial_recorrencia: "nenhuma" | "mensal" | "anual" | "parcelado"
      financial_status:
        | "aberta"
        | "parcial"
        | "paga"
        | "atrasada"
        | "cancelada"
        | "estornada"
      fluxo_tipo: "entrada" | "saida"
      interacao_canal:
        | "ligacao"
        | "whatsapp"
        | "email"
        | "reuniao"
        | "presencial"
        | "followup"
        | "outro"
      prioridade_op: "p1" | "p2" | "p3"
      proposta_doc_status:
        | "pendente"
        | "enviado"
        | "aprovado"
        | "reprovado"
        | "expirado"
      proposta_status:
        | "rascunho"
        | "enviada_banco"
        | "em_analise_credito"
        | "credito_aprovado"
        | "credito_recusado"
        | "aguardando_documentos"
        | "engenharia_vistoria"
        | "analise_juridica"
        | "contrato_emitido"
        | "registrado"
        | "erro_envio"
        | "cancelada"
        | "checklist_documentacao"
        | "cadastro_complementar"
        | "dossie_completo"
        | "formularios"
        | "envio_documentos_banco"
        | "vistoria_agendamento"
        | "vistoria_concluida"
        | "emissao_contrato"
      regime_casamento:
        | "comunhao_parcial"
        | "comunhao_universal"
        | "separacao_total"
        | "participacao_final"
        | "nao_aplicavel"
      simulacao_banco_status: "aguardando" | "simulada" | "erro" | "expirada"
      simulacao_status:
        | "rascunho"
        | "enviando"
        | "simulada"
        | "parcialmente_simulada"
        | "erro_banco"
        | "expirada"
        | "cancelada"
        | "promovida"
      simulacao_tipo: "simplificada" | "completa"
      tarefa_status: "aberta" | "em_andamento" | "concluida" | "cancelada"
      tipo_pessoa: "PF" | "PJ"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acesso_tipo: ["sistema", "portal_parceiro"],
      app_role: [
        "admin",
        "correspondente",
        "gestor",
        "comercial",
        "analista",
        "imobiliaria",
        "corretor",
        "cliente",
        "financeiro",
      ],
      cliente_estado_civil: [
        "solteiro",
        "casado",
        "uniao_estavel",
        "divorciado",
        "viuvo",
      ],
      cliente_origem: ["direto", "parceiro", "indicacao", "importacao"],
      comissao_regra_tipo: ["percentual", "fixo"],
      comissao_status: ["a_receber", "recebida", "paga_parceiro", "encerrada"],
      demanda_status: [
        "aberta",
        "em_andamento",
        "aguardando",
        "concluida",
        "cancelada",
      ],
      doc_categoria: [
        "comprador",
        "conjuge",
        "vendedor",
        "imovel",
        "outros",
        "vendedor_conjuge",
      ],
      doc_status: ["pendente", "recebido", "aprovado", "reprovado", "expirado"],
      escopo_dados: ["todos", "equipe", "proprios", "personalizado"],
      financial_categoria_tipo: ["despesa", "receita"],
      financial_recorrencia: ["nenhuma", "mensal", "anual", "parcelado"],
      financial_status: [
        "aberta",
        "parcial",
        "paga",
        "atrasada",
        "cancelada",
        "estornada",
      ],
      fluxo_tipo: ["entrada", "saida"],
      interacao_canal: [
        "ligacao",
        "whatsapp",
        "email",
        "reuniao",
        "presencial",
        "followup",
        "outro",
      ],
      prioridade_op: ["p1", "p2", "p3"],
      proposta_doc_status: [
        "pendente",
        "enviado",
        "aprovado",
        "reprovado",
        "expirado",
      ],
      proposta_status: [
        "rascunho",
        "enviada_banco",
        "em_analise_credito",
        "credito_aprovado",
        "credito_recusado",
        "aguardando_documentos",
        "engenharia_vistoria",
        "analise_juridica",
        "contrato_emitido",
        "registrado",
        "erro_envio",
        "cancelada",
        "checklist_documentacao",
        "cadastro_complementar",
        "dossie_completo",
        "formularios",
        "envio_documentos_banco",
        "vistoria_agendamento",
        "vistoria_concluida",
        "emissao_contrato",
      ],
      regime_casamento: [
        "comunhao_parcial",
        "comunhao_universal",
        "separacao_total",
        "participacao_final",
        "nao_aplicavel",
      ],
      simulacao_banco_status: ["aguardando", "simulada", "erro", "expirada"],
      simulacao_status: [
        "rascunho",
        "enviando",
        "simulada",
        "parcialmente_simulada",
        "erro_banco",
        "expirada",
        "cancelada",
        "promovida",
      ],
      simulacao_tipo: ["simplificada", "completa"],
      tarefa_status: ["aberta", "em_andamento", "concluida", "cancelada"],
      tipo_pessoa: ["PF", "PJ"],
    },
  },
} as const
