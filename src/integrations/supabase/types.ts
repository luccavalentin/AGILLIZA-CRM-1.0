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
          ativo: boolean
          correspondente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          is_padrao: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          acao: string
          correspondente_id: string | null
          created_at: string
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
      cliente_documentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          categoria: Database["public"]["Enums"]["doc_categoria"]
          cliente_id: string
          created_at: string
          enviado_por: string | null
          expira_em: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
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
          expira_em?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
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
          expira_em?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
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
      clientes: {
        Row: {
          ativo: boolean
          correspondente_id: string
          created_at: string
          criador_id: string | null
          data_nascimento: string | null
          documento: string
          documento_secundario: string | null
          email: string | null
          estado_civil:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          foto_url: string | null
          id: string
          mae: string | null
          nome: string
          numero_cliente: string
          origem: Database["public"]["Enums"]["cliente_origem"]
          portal_acesso_ativo: boolean
          regime_casamento:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada: number | null
          responsavel_id: string | null
          telefone_celular: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          uf_interesse: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          data_nascimento?: string | null
          documento: string
          documento_secundario?: string | null
          email?: string | null
          estado_civil?:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          foto_url?: string | null
          id?: string
          mae?: string | null
          nome: string
          numero_cliente: string
          origem?: Database["public"]["Enums"]["cliente_origem"]
          portal_acesso_ativo?: boolean
          regime_casamento?:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada?: number | null
          responsavel_id?: string | null
          telefone_celular?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf_interesse?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          data_nascimento?: string | null
          documento?: string
          documento_secundario?: string | null
          email?: string | null
          estado_civil?:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          foto_url?: string | null
          id?: string
          mae?: string | null
          nome?: string
          numero_cliente?: string
          origem?: Database["public"]["Enums"]["cliente_origem"]
          portal_acesso_ativo?: boolean
          regime_casamento?:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada?: number | null
          responsavel_id?: string | null
          telefone_celular?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf_interesse?: string | null
          updated_at?: string
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
          codigo_banco: number
          created_at: string
          flag_padrao: boolean
          flag_simulacao: string
          id: string
          id_banco: number | null
          nome_banco: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_banco: number
          created_at?: string
          flag_padrao?: boolean
          flag_simulacao?: string
          id?: string
          id_banco?: number | null
          nome_banco: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_banco?: number
          created_at?: string
          flag_padrao?: boolean
          flag_simulacao?: string
          id?: string
          id_banco?: number | null
          nome_banco?: string
          ordem?: number
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
          email: string | null
          foto_url: string | null
          id: string
          nivel_acesso_id: string | null
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          bloqueado_em?: string | null
          consentimento_lgpd_em?: string | null
          correspondente_id?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id: string
          nivel_acesso_id?: string | null
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          bloqueado_em?: string | null
          consentimento_lgpd_em?: string | null
          correspondente_id?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nivel_acesso_id?: string | null
          nome?: string | null
          telefone?: string | null
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
      cliente_pipeline_avancar_para: {
        Args: {
          _acao?: string
          _cliente_id: string
          _codigo_destino: string
          _obs?: string
        }
        Returns: undefined
      }
      correspondente_do_usuario: { Args: { _user_id: string }; Returns: string }
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
      is_interno: { Args: { _user_id: string }; Returns: boolean }
      mask_pii_jsonb: { Args: { _data: Json }; Returns: Json }
      pode_gerenciar_pessoas: { Args: { _user_id: string }; Returns: boolean }
      usuario_escopo_dados: {
        Args: { _modulo: string; _user_id: string }
        Returns: Database["public"]["Enums"]["escopo_dados"]
      }
      usuario_tem_acesso_cliente: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_simulacao: {
        Args: { _sim_id: string; _user_id: string }
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
      cliente_estado_civil:
        | "solteiro"
        | "casado"
        | "uniao_estavel"
        | "divorciado"
        | "viuvo"
      cliente_origem: "direto" | "parceiro" | "indicacao" | "importacao"
      doc_categoria: "comprador" | "conjuge" | "vendedor" | "imovel" | "outros"
      doc_status:
        | "pendente"
        | "recebido"
        | "aprovado"
        | "reprovado"
        | "expirado"
      escopo_dados: "todos" | "equipe" | "proprios"
      interacao_canal:
        | "ligacao"
        | "whatsapp"
        | "email"
        | "reuniao"
        | "presencial"
        | "followup"
        | "outro"
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
      ],
      cliente_estado_civil: [
        "solteiro",
        "casado",
        "uniao_estavel",
        "divorciado",
        "viuvo",
      ],
      cliente_origem: ["direto", "parceiro", "indicacao", "importacao"],
      doc_categoria: ["comprador", "conjuge", "vendedor", "imovel", "outros"],
      doc_status: ["pendente", "recebido", "aprovado", "reprovado", "expirado"],
      escopo_dados: ["todos", "equipe", "proprios"],
      interacao_canal: [
        "ligacao",
        "whatsapp",
        "email",
        "reuniao",
        "presencial",
        "followup",
        "outro",
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
      tipo_pessoa: ["PF", "PJ"],
    },
  },
} as const
